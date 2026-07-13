import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAndSendNotice } from "@/lib/notice-send"
import { format } from "date-fns"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const moveSchema = z.object({
  direction: z.enum(["IN", "OUT"]),
  eventAt: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (user.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Your account is not yet verified. Please wait for manager approval." },
        { status: 403 }
      )
    }

    const data = moveSchema.parse(await request.json())
    const eventAt = new Date(data.eventAt)

    // Title/message are composed server-side from the poster's own account and
    // the submitted date — this endpoint has no freeform text fields, so an
    // unverified/malicious client can't post arbitrary content, only a
    // structured move notice for their own unit.
    const directionLabel = data.direction === "IN" ? "Move In" : "Move Out"
    const title = `${directionLabel} — Apt ${user.apartmentNumber}`
    const message = `${user.name} is moving ${data.direction === "IN" ? "in to" : "out of"} Apt ${user.apartmentNumber} on ${format(eventAt, "EEEE d MMMM 'at' h:mma")}.`

    const { noticeId, recipientCount } = await createAndSendNotice({
      createdBy: user.id,
      category: "MOVE",
      targetType: "ALL",
      targetValues: [],
      title,
      message,
      eventAt,
      sendSms: true,
      forceSms: false,
    })

    return NextResponse.json({ success: true, noticeId, recipientCount })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Log move error:", error)
    return NextResponse.json({ error: "Failed to log move" }, { status: 500 })
  }
}
