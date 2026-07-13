import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAndSendNotice } from "@/lib/notice-send"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const sendSchema = z.object({
  category: z.enum(["AMENITY", "MAINTENANCE", "URGENT", "GENERAL"]),
  targetType: z.enum(["ALL", "RESIDENCY", "FLOOR", "APARTMENT"]),
  targetValues: z.array(z.string()).default([]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  sendSms: z.boolean(),
  excludedUserIds: z.array(z.string()).default([]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!manager || manager.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const notices = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      creator: { select: { name: true } },
      _count: { select: { recipients: true } },
    },
  })

  return NextResponse.json({
    notices: notices.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.category,
      targetType: n.targetType,
      targetValues: n.targetValues,
      sentEmail: n.sentEmail,
      sentSms: n.sentSms,
      createdAt: n.createdAt,
      createdByName: n.creator.name,
      recipientCount: n._count.recipients,
    })),
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = sendSchema.parse(await request.json())

    const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { noticeId, recipientCount } = await createAndSendNotice({
      createdBy: manager.id,
      category: data.category,
      targetType: data.targetType,
      targetValues: data.targetValues,
      title: data.title,
      message: data.message,
      sendSms: data.sendSms,
      forceSms: data.category === "URGENT",
      excludedUserIds: data.excludedUserIds,
    })

    return NextResponse.json({ success: true, noticeId, recipientCount })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Send message error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
