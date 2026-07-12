import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ASSISTANT_SYSTEM_INSTRUCTION, RESIDENT_KNOWLEDGE, ADMIN_KNOWLEDGE } from "@/lib/assistant/knowledge"
import { buildNavigateTool, pagesForRole, PAGE_HOWTO, PAGE_HIGHLIGHT } from "@/lib/assistant/navigateTool"

export const dynamic = 'force-dynamic'

const DAILY_MESSAGE_CAP = 40
const MAX_HISTORY_TURNS = 8

const client = new Anthropic()

function isSameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id
  const isManager = (session.user as any).role === "MANAGER"

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { assistantMessagesToday: true, assistantUsageDate: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const now = new Date()
  const isNewDay = !user.assistantUsageDate || !isSameUtcDay(user.assistantUsageDate, now)
  const messagesSoFar = isNewDay ? 0 : user.assistantMessagesToday

  if (messagesSoFar >= DAILY_MESSAGE_CAP) {
    return NextResponse.json(
      { error: "You've hit today's question limit — try again tomorrow." },
      { status: 429 }
    )
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      assistantMessagesToday: messagesSoFar + 1,
      assistantUsageDate: now,
    },
  })

  const body = await request.json()
  const clientMessages: { role: "user" | "assistant"; content: string }[] = Array.isArray(body?.messages)
    ? body.messages
    : []
  const messages = clientMessages.slice(-MAX_HISTORY_TURNS)

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const knowledge = isManager ? `${RESIDENT_KNOWLEDGE}\n\n${ADMIN_KNOWLEDGE}` : RESIDENT_KNOWLEDGE
  const roleLine = isManager
    ? "The person you're talking to right now is a manager — answer manager/admin questions directly, don't decline them or tell them to become a manager."
    : "The person you're talking to right now is a resident, not a manager — decline manager/admin-only questions as instructed above."

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: `${ASSISTANT_SYSTEM_INSTRUCTION}\n\n${roleLine}\n\n${knowledge}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [buildNavigateTool(isManager)],
      messages,
    })

    const pages = pagesForRole(isManager)
    let text = ""
    let navigate: { page: string; label: string } | null = null

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text
      } else if (block.type === "tool_use" && block.name === "navigate") {
        const input = block.input as { page?: string }
        const label = input?.page ? pages[input.page] : undefined
        if (input?.page && label) {
          navigate = { page: input.page, label }
        }
      }
    }

    // Whenever a page is being suggested, use the curated step-by-step text for
    // that page as the authoritative answer rather than the model's own prose —
    // this keeps "how do I do X" answers complete and consistent regardless of
    // how much detail the model chooses to include on a given response.
    if (navigate) {
      text = PAGE_HOWTO[navigate.page] ?? (text || `You can do that from ${navigate.label}.`)
    }

    const highlight = navigate ? PAGE_HIGHLIGHT[navigate.page] ?? null : null

    return NextResponse.json({ text, navigate, highlight })
  } catch (error) {
    console.error("Assistant chat error:", error)
    return NextResponse.json({ error: "The assistant is unavailable right now." }, { status: 502 })
  }
}
