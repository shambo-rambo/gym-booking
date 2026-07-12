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
  sendSms: z.boolean(),
  excludedUserIds: z.array(z.string()).default([]),
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

    const data = sendSchema.parse(await request.json())

    // The manager-permission check and resolving recipients are independent
    // reads — run them concurrently instead of one after the other. If the
    // manager check fails below, the (unused) recipients result is just
    // discarded — it's read-only, so there's no side effect to worry about.
    const [manager, resolvedRecipients] = await Promise.all([
      prisma.user.findUnique({ where: { id: (session.user as any).id } }),
      resolveNoticeRecipients(data.targetType, data.targetValues),
    ])
    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const excluded = new Set(data.excludedUserIds)
    const recipients = resolvedRecipients.filter((u) => !excluded.has(u.id))
    const forceSms = data.category === "URGENT"

    const notice = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        createdBy: manager.id,
        category: data.category,
        targetType: data.targetType,
        targetValues: data.targetValues,
        sentEmail: true,
        sentSms: data.sendSms,
      },
    })

    if (recipients.length > 0) {
      await prisma.noticeRecipient.createMany({
        data: recipients.map((u) => ({ noticeId: notice.id, userId: u.id })),
        skipDuplicates: true,
      })
    }

    // Fan out in small concurrent batches so we don't hammer Resend/ClickSend at once.
    // Cascade per resident: text wins if they're reachable by SMS, otherwise they always
    // get the email (residents can opt out of SMS but not email — email carries things
    // like AGM votes). Urgent messages force SMS to anyone with a phone on file.
    //
    // Not awaited: the message is already saved (notice + recipients created above), so
    // the manager doesn't need to wait for every email/SMS to actually go out before
    // getting a response — that was adding the full Resend/ClickSend round-trip time
    // per batch to the request. Sends continue in the background; same fire-and-forget
    // pattern already used for the ACCOUNT_VERIFIED notification in the users route.
    ;(async () => {
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE)
        const batchSettings = await prisma.notificationSetting.findMany({
          where: { userId: { in: batch.map((u) => u.id) }, category: data.category },
        })
        const smsByUserId = new Map(batchSettings.map((s) => [s.userId, s.sms]))

        await Promise.all(
          batch.map((user) => {
            const smsAllowed = smsByUserId.get(user.id) ?? false
            const textEligible = data.sendSms && !!user.phoneNumber && (forceSms || smsAllowed)
            return sendNotification(
              user,
              "BUILDING_MESSAGE",
              { title: data.title, body: data.message, category: data.category },
              { email: !textEligible, sms: textEligible, forceSms }
            ).catch((err) => console.error("[Messages] Notification failed for", user.id, err))
          })
        )
      }
    })().catch((err) => console.error("[Messages] Notification fan-out failed:", err))

    return NextResponse.json({ success: true, noticeId: notice.id, recipientCount: recipients.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Send message error:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
