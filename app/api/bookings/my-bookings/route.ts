import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Get upcoming bookings (today and future)
    const upcoming = await prisma.booking.findMany({
      where: {
        userId,
        date: { gte: now }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    })

    // Get past bookings (optional)
    const past = await prisma.booking.findMany({
      where: {
        userId,
        date: { lt: now }
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'desc' }
      ],
      take: 10 // Limit to last 10
    })

    // Get queue entries (upcoming only)
    const queueEntries = await prisma.queueEntry.findMany({
      where: {
        userId,
        date: { gte: now }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
        { position: 'asc' }
      ]
    })

    return NextResponse.json({
      upcoming,
      past,
      queue: queueEntries
    })

  } catch (error) {
    console.error("My bookings error:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}
