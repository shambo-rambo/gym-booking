import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Query by calendar date only (date column stores midnight UTC).
    // Comparing a full datetime against @db.Date causes today's bookings to never
    // match (stored as 00:00:00Z < current time), so we fetch today + tomorrow
    // and filter precisely in code below.
    const startOfToday = new Date(now)
    startOfToday.setUTCHours(0, 0, 0, 0)
    const startOfDayAfterTomorrow = new Date(startOfToday)
    startOfDayAfterTomorrow.setUTCDate(startOfDayAfterTomorrow.getUTCDate() + 2)

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        date: {
          gte: startOfToday,
          lt: startOfDayAfterTomorrow,
        }
      },
      include: {
        user: true
      }
    })

    let sentCount = 0

    for (const booking of upcomingBookings) {
      // Parse the booking time
      const [hours, minutes] = booking.startTime.split(':').map(Number)
      const bookingDateTime = new Date(booking.date)
      bookingDateTime.setHours(hours, minutes, 0, 0)

      // Check if it's approximately 2 hours from now (within a 5-minute window)
      const timeDiff = bookingDateTime.getTime() - now.getTime()
      const hoursUntil = timeDiff / (1000 * 60 * 60)

      if (hoursUntil >= 1.92 && hoursUntil <= 2.08) { // 2 hours ± 5 minutes
        // Residents who've opted in (off by default) get an interactive "still coming?"
        // push/email with Yes/No actions instead of the plain reminder below.
        if (booking.user.confirmBookingChecks) {
          await sendNotification(
            booking.user,
            'BOOKING_CONFIRM_CHECK',
            {
              facilityType: booking.facilityType.toString(),
              date: format(booking.date, 'EEEE, MMMM d, yyyy'),
              startTime: booking.startTime,
              bookingId: booking.id,
            },
            { sms: false }
          )

          sentCount++
          continue
        }

        // Check if anyone is queued for this slot
        const queueCount = await prisma.queueEntry.count({
          where: {
            facilityType: booking.facilityType,
            bookingType: booking.bookingType,
            equipmentType: booking.equipmentType,
            date: booking.date,
            startTime: booking.startTime,
            duration: booking.duration
          }
        })

        // Send reminder
        await sendNotification(booking.user, 'BOOKING_REMINDER', {
          facilityType: booking.facilityType.toString(),
          date: format(booking.date, 'EEEE, MMMM d, yyyy'),
          startTime: booking.startTime,
          queueCount
        })

        sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} booking reminders`
    })

  } catch (error) {
    console.error('Booking reminders cron error:', error)
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    )
  }
}
