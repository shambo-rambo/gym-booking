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
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const [upcoming, queueEntries, past] = await Promise.all([
      prisma.booking.findMany({
        where: { userId, date: { gte: now } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.queueEntry.findMany({
        where: { userId, date: { gte: now } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { position: 'asc' }],
      }),
      prisma.booking.findMany({
        where: { userId, date: { lt: now } },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        take: 20,
      }),
    ])

    // Fire last-minute notifications for any unnotified queue entries within 3 hours.
    // notifyNextInQueue is idempotent (filters notifiedAt: null), so duplicate calls are safe.
    const rightNow = new Date()
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
