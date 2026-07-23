import { prisma } from './prisma'
import { sendNotification } from './notifications'
import { resolveNoticeRecipients } from './notice-targeting'
import { NoticeCategory, NoticeTargetType } from '@prisma/client'

const BATCH_SIZE = 20

interface CreateAndSendNoticeParams {
  createdBy: string
  category: NoticeCategory
  targetType: NoticeTargetType
  targetValues: string[]
  title: string
  message: string
  eventAt?: Date
  // Whether SMS is even attempted for this notice (still gated per-recipient by
  // their own notification settings unless forceSms is set).
  sendSms: boolean
  // Overrides recipients' own settings and sends SMS to anyone with a phone
  // number on file — used for Urgent building messages only.
  forceSms: boolean
  excludedUserIds?: string[]
}

// Shared by the manager message wizard and the resident-authored Move In/Out
// flow: resolves the target audience, creates the Announcement + NoticeRecipient
// rows, and fans out email/SMS/push notifications.
export async function createAndSendNotice(params: CreateAndSendNoticeParams) {
  const resolvedRecipients = await resolveNoticeRecipients(params.targetType, params.targetValues)
  const excluded = new Set(params.excludedUserIds ?? [])
  const recipients = resolvedRecipients.filter((u) => !excluded.has(u.id))

  // Urgent notices auto-expire 48h after posting so they don't linger in the
  // feed indefinitely — everything else stays until a manager deletes it.
  const expiresAt = params.category === 'URGENT' ? new Date(Date.now() + 48 * 60 * 60 * 1000) : undefined

  const notice = await prisma.announcement.create({
    data: {
      title: params.title,
      message: params.message,
      createdBy: params.createdBy,
      category: params.category,
      targetType: params.targetType,
      targetValues: params.targetValues,
      eventAt: params.eventAt,
      expiresAt,
      sentEmail: true,
      sentSms: params.sendSms,
    },
  })

  if (recipients.length > 0) {
    await prisma.noticeRecipient.createMany({
      data: recipients.map((u) => ({ noticeId: notice.id, userId: u.id })),
      skipDuplicates: true,
    })
  }

  // Fan out in small concurrent batches so we don't hammer Resend/ClickSend at once.
  // Cascade per resident: SMS wins if they're reachable by SMS, otherwise they always
  // get the email (residents can opt out of SMS but not email — email carries things
  // like AGM votes). forceSms overrides recipients' own settings and sends SMS to
  // anyone with a phone on file.
  //
  // Not awaited: the message is already saved (notice + recipients created above), so
  // the caller doesn't need to wait for every email/SMS to actually go out before
  // getting a response — that was adding the full Resend/ClickSend round-trip time
  // per batch to the request. Sends continue in the background; same fire-and-forget
  // pattern already used for the ACCOUNT_VERIFIED notification in the users route.
  ;(async () => {
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)
      const batchSettings = await prisma.notificationSetting.findMany({
        where: { userId: { in: batch.map((u) => u.id) }, category: params.category },
      })
      const smsByUserId = new Map(batchSettings.map((s) => [s.userId, s.sms]))

      await Promise.all(
        batch.map((user) => {
          const smsAllowed = smsByUserId.get(user.id) ?? false
          const textEligible = params.sendSms && !!user.phoneNumber && (params.forceSms || smsAllowed)
          return sendNotification(
            user,
            "BUILDING_MESSAGE",
            { title: params.title, body: params.message, category: params.category },
            { email: !textEligible, sms: textEligible, forceSms: params.forceSms }
          ).catch((err) => console.error("[Notices] Notification failed for", user.id, err))
        })
      )
    }
  })().catch((err) => console.error("[Notices] Notification fan-out failed:", err))

  return { noticeId: notice.id, recipientCount: recipients.length }
}
