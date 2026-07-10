import webpush from 'web-push'
import { prisma } from './prisma'
import { NotificationChannel, NotificationType, User } from '@prisma/client'
import { logNotification } from './notifications'

const vapidConfigured = !!(
  process.env.VAPID_SUBJECT &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
)

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

interface PushContent {
  subject: string
  emailBody: string
  smsBody: string
}

interface PushSourceData {
  title?: string
  body?: string
  manageUrl?: string
  claimUrl?: string
}

function resolveUrl(type: NotificationType, data: PushSourceData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (type === 'QUEUE_SLOT_AVAILABLE') return data.claimUrl || `${appUrl}/queue`
  if (type === 'BUILDING_MESSAGE') return appUrl
  return data.manageUrl || `${appUrl}/my-bookings`
}

export async function sendPush(
  user: User,
  type: NotificationType,
  data: PushSourceData,
  content: PushContent
) {
  if (!vapidConfigured) {
    console.log('[Push - Not Configured] Would notify:', user.id)
    return
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: user.id } })
  if (subscriptions.length === 0) return

  const title = data.title || content.subject
  const body = data.body || content.smsBody
  const url = resolveUrl(type, data)
  const payload = JSON.stringify({
    title,
    body,
    url,
    tag: type,
    icon: '/api/icons/192',
    badge: '/api/icons/192',
  })

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        await logNotification(user.id, type, NotificationChannel.PUSH, payload, true)
      } catch (error: any) {
        const statusCode = error?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
        console.error('[Push] Failed:', error)
        await logNotification(user.id, type, NotificationChannel.PUSH, payload, false, error?.message)
      }
    })
  )
}
