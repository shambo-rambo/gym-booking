import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyNextInQueue } from "@/lib/queue-notifications"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = (session.user as any).id
    const rightNow = new Date()
    const todayMidnight = new Date(rightNow)
    todayMidnight.setHours(0, 0, 0, 0)

    const [todayOrLater, definitelyPast, queueEntries] = await Promise.all([
      prisma.booking.findMany({
        where: { userId, date: { gte: todayMidnight } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.booking.findMany({
        where: { userId, date: { lt: todayMidnight } },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: 20,
      }),
      prisma.queueEntry.findMany({
        where: { userId, date: { gte: todayMidnight } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { position: 'asc' }],
      }),
    ])

    // A booking dated today isn't necessarily still upcoming — split today's
    // bookings by whether they've actually finished (start/endTime + duration).
    const hasEnded = (booking: typeof todayOrLater[number]) => {
      const end = new Date(booking.date)
      if (booking.endTime) {
        const [h, m] = booking.endTime.split(':').map(Number)
        end.setHours(h, m, 0, 0)
      } else {
        const [h, m] = booking.startTime.split(':').map(Number)
        end.setHours(h, m, 0, 0)
        end.setMinutes(end.getMinutes() + booking.duration)
      }
      return end <= rightNow
    }

    const upcoming = todayOrLater.filter((b) => !hasEnded(b))
    const finishedToday = todayOrLater.filter(hasEnded)

    const past = [...finishedToday, ...definitelyPast]
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
        if (dateDiff !== 0) return dateDiff
        return b.startTime.localeCompare(a.startTime)
      })
      .slice(0, 20)

    // Fire last-minute notifications for any unnotified queue entries within 3 hours.
    // notifyNextInQueue is idempotent (filters notifiedAt: null), so duplicate calls are safe.
    for (const entry of queueEntries) {
      if (entry.notifiedAt) continue
      const [h, m] = entry.startTime.split(':').map(Number)
      const slotDateTime = new Date(entry.date)
      slotDateTime.setHours(h, m, 0, 0)
      const minutesUntilSlot = (slotDateTime.getTime() - rightNow.getTime()) / (1000 * 60)
      if (minutesUntilSlot > 0 && minutesUntilSlot <= 180) {
        notifyNextInQueue(
          entry.facilityType,
          entry.bookingType,
          entry.equipmentType,
          entry.date,
          entry.startTime,
          entry.duration
        ).catch(err => console.error('[my-bookings] Last-minute queue notification failed:', err))
      }
    }

    return NextResponse.json({ upcoming, queue: queueEntries, past })

  } catch (error) {
    console.error("My bookings error:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}
