import { Resend } from 'resend'
import { prisma } from './prisma'
import { NotificationType, NotificationChannel, User } from '@prisma/client'

// Initialize services (will only work if env vars are set)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY
const CLICKSEND_SENDER_ID = process.env.CLICKSEND_SENDER_ID
const clickSendConfigured = !!(CLICKSEND_USERNAME && CLICKSEND_API_KEY)

interface NotificationData {
  facilityType?: string
  bookingType?: string
  equipmentType?: string
  date?: string
  startTime?: string
  duration?: number
  queueCount?: number
  claimUrl?: string
  manageUrl?: string
  reason?: string
  title?: string
  body?: string
}

interface ChannelOverride {
  email?: boolean
  sms?: boolean
  // If true, SMS sends to anyone with a phone number regardless of their
  // notificationPreference — used for Urgent building messages only.
  forceSms?: boolean
}

export async function sendNotification(
  user: User,
  type: NotificationType,
  data: NotificationData,
  channelOverride?: ChannelOverride
) {
  const { notificationPreference } = user
  const emailAllowed = channelOverride?.email ?? true
  const smsAllowed = channelOverride?.sms ?? true

  const content = generateNotificationContent(type, data)

  // Send via email
  if (
    emailAllowed &&
    (notificationPreference === 'EMAIL_ONLY' || notificationPreference === 'BOTH')
  ) {
    await sendEmail(user.email, content.subject, content.emailBody, user.id, type)
  }

  // Send via SMS
  if (
    smsAllowed &&
    user.phoneNumber &&
    (channelOverride?.forceSms || notificationPreference === 'SMS_ONLY' || notificationPreference === 'BOTH')
  ) {
    await sendSMS(user.phoneNumber, content.smsBody, user.id, type)
  }
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  userId: string,
  type: NotificationType
) {
  if (!resend) {
    console.log('[Email - Not Configured] Would send to:', to)
    console.log('[Email - Not Configured] Subject:', subject)
    console.log('[Email - Not Configured] Body:', html)

    await logNotification(userId, type, NotificationChannel.EMAIL, html, false, 'Resend not configured')
    return
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Gym Booking <onboarding@resend.dev>',
      to,
      subject,
      html
    })

    await logNotification(userId, type, NotificationChannel.EMAIL, html, true)
    console.log('[Email] Sent to:', to)
  } catch (error: any) {
    console.error('[Email] Failed:', error)
    await logNotification(userId, type, NotificationChannel.EMAIL, html, false, error.message)
  }
}

async function sendSMS(
  to: string,
  body: string,
  userId: string,
  type: NotificationType
): Promise<void> {
  if (!clickSendConfigured) {
    console.log('[SMS - Not Configured] Would send to:', to)
    console.log('[SMS - Not Configured] Body:', body)

    await logNotification(userId, type, NotificationChannel.SMS, body, false, 'ClickSend not configured')
    return
  }

  try {
    const auth = Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64')
    const res = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            body,
            to,
            ...(CLICKSEND_SENDER_ID ? { from: CLICKSEND_SENDER_ID } : {}),
          },
        ],
      }),
    })

    const data = await res.json()
    const result = data?.data?.messages?.[0]

    if (!res.ok || result?.status !== 'SUCCESS') {
      throw new Error(result?.status || data?.response_msg || `ClickSend request failed (${res.status})`)
    }

    // ClickSend returns the actual per-message price when available; fall back to a rough AUD estimate.
    const cost = typeof result?.message_price === 'number' ? result.message_price : 0.06
    await logNotification(userId, type, NotificationChannel.SMS, body, true, null, cost)
    console.log('[SMS] Sent to:', to)
  } catch (error: any) {
    console.error('[SMS] Failed:', error)
    await logNotification(userId, type, NotificationChannel.SMS, body, false, error.message)
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function generateNotificationContent(type: NotificationType, data: NotificationData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const manageUrl = data.manageUrl || `${appUrl}/my-bookings`
  const claimUrl = data.claimUrl || `${appUrl}/queue`

  switch (type) {
    case 'BOOKING_CONFIRMATION':
      return {
        subject: 'Booking Confirmed',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Your booking is confirmed!</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Facility:</strong> ${data.facilityType}</p>
              <p style="margin: 5px 0;"><strong>Type:</strong> ${data.bookingType}</p>
              ${data.equipmentType ? `<p style="margin: 5px 0;"><strong>Equipment:</strong> ${data.equipmentType.replace(/_/g, ' ')}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Date:</strong> ${data.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${data.startTime} (${data.duration} minutes)</p>
            </div>
            <a href="${manageUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Manage Booking</a>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">See you at the ${data.facilityType?.toLowerCase()}!</p>
          </div>
        `,
        smsBody: `Booking confirmed: ${data.facilityType} ${data.date} ${data.startTime} (${data.duration}min). ${manageUrl}`
      }

    case 'BOOKING_REMINDER':
      const queueInfo = data.queueCount && data.queueCount > 0
        ? `${data.queueCount} ${data.queueCount === 1 ? 'person is' : 'people are'} waiting for this slot.`
        : ''

      return {
        subject: 'Reminder: Booking Soon',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Reminder: You have a booking soon</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Facility:</strong> ${data.facilityType}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${data.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${data.startTime}</p>
            </div>
            ${queueInfo ? `<p style="color: #dc2626; font-weight: 600;">${queueInfo} If you can't make it, please cancel to let them book.</p>` : ''}
            <a href="${manageUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Manage Booking</a>
          </div>
        `,
        smsBody: `Reminder: ${data.facilityType} ${data.date} ${data.startTime}. ${queueInfo ? queueInfo + ' ' : ''}${manageUrl}`
      }

    case 'QUEUE_SLOT_AVAILABLE':
      return {
        subject: '🎉 Slot Available!',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">A slot you queued for is now available!</h2>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 5px 0;"><strong>Facility:</strong> ${data.facilityType}</p>
              ${data.equipmentType ? `<p style="margin: 5px 0;"><strong>Equipment:</strong> ${data.equipmentType.replace(/_/g, ' ')}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Date:</strong> ${data.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${data.startTime}</p>
            </div>
            <p style="color: #dc2626; font-weight: 600;">⚠️ You have 30 minutes to claim this slot!</p>
            <a href="${claimUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Claim Slot Now</a>
          </div>
        `,
        smsBody: `SLOT AVAILABLE! ${data.facilityType} ${data.date} ${data.startTime}. Claim in 30min: ${claimUrl}`
      }

    case 'ACCOUNT_VERIFIED':
      return {
        subject: 'Account Verified - You Can Now Book!',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Welcome! Your account has been verified</h2>
            <p>You can now start booking gym and sauna facilities.</p>
            <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Go to Calendar</a>
          </div>
        `,
        smsBody: `Your gym booking account is verified! Start booking: ${appUrl}`
      }

    case 'BOOKING_CANCELLED_BY_ADMIN':
      return {
        subject: 'Booking Cancelled',
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Your booking has been cancelled</h2>
            <p>A manager has cancelled your booking for the following slot:</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 5px 0;"><strong>Facility:</strong> ${data.facilityType}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${data.date}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${data.startTime}</p>
              ${data.reason ? `<p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>` : ''}
            </div>
            <p>We apologize for any inconvenience.</p>
          </div>
        `,
        smsBody: `Your booking was cancelled: ${data.facilityType} ${data.date} ${data.startTime}. ${data.reason ? `Reason: ${data.reason}` : ''}`
      }

    case 'BUILDING_MESSAGE':
      const title = data.title || 'Building Notice'
      const body = data.body || ''
      return {
        subject: title,
        emailBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">${escapeHtml(title)}</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap;">${escapeHtml(body)}</div>
            <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Open The Residences</a>
          </div>
        `,
        // Keep SMS short: title + a truncated body so the total stays close to the 160-char guideline.
        smsBody: `${title}: ${body}`.slice(0, 150) + ` ${appUrl}`
      }

    default:
      return {
        subject: 'Notification',
        emailBody: '<p>You have a notification</p>',
        smsBody: 'You have a notification'
      }
  }
}

async function logNotification(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  content: string,
  success: boolean,
  error?: string | null,
  cost?: number
) {
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        type,
        channel,
        content,
        success,
        error,
        cost
      }
    })
  } catch (err) {
    console.error('[Notification Log] Failed to log:', err)
  }
}
