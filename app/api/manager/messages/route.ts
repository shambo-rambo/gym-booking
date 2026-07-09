import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { resolveNoticeRecipients } from "@/lib/notice-targeting"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const sendSchema = z.object({
  category: z.enum(["AMENITY", "MAINTENANCE", "URGENT", "GENERAL"]),
  targetType: z.enum(["ALL", "RESIDENCY", "FLOOR", "APARTMENT"]),
  targetValues: z.array(z.string()).default([]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  sendEmail: z.boolean(),
  sendSms: z.boolean(),
})

const BATCH_SIZE = 20

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
    const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = sendSchema.parse(await request.json())
    const recipients = await resolveNoticeRecipients(data.targetType, data.targetValues)

    const notice = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        createdBy: manager.id,
        category: data.category,
        targetType: data.targetType,
        targetValues: data.targetValues,
        sentEmail: data.sendEmail,
        sentSms: data.sendSms,
      },
    })

    if (recipients.length > 0) {
      await prisma.noticeRecipient.createMany({
        data: recipients.map((u) => ({ noticeId: notice.id, userId: u.id })),
        skipDuplicates: true,
      })
    }

    // Fan out email/SMS in small concurrent batches so we don't hammer Resend/Twilio at once.
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map((user) =>
          sendNotification(
            user,
            "BUILDING_MESSAGE",
            { title: data.title, body: data.message },
            { email: data.sendEmail, sms: data.sendSms, forceSms: data.category === "URGENT" }
          ).catch((err) => console.error("[Messages] Notification failed for", user.id, err))
        )
      )
    }

    return NextResponse.json({ success: true, noticeId: notice.id, recipientCount: recipients.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Send message error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
