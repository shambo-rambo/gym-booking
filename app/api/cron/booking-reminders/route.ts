import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    // Verify this is from Vercel Cron (optional but recommended)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Find bookings starting in 2 hours
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const twoHoursOneMinuteFromNow = new Date(now.getTime() + (2 * 60 + 1) * 60 * 1000)

    // Get bookings in the 2-hour window
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        date: {
          gte: now,
          lte: twoHoursOneMinuteFromNow
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
