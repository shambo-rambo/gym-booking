import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const [upcoming, queueEntries] = await Promise.all([
      prisma.booking.findMany({
        where: { userId, date: { gte: now } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.queueEntry.findMany({
        where: { userId, date: { gte: now } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { position: 'asc' }],
      }),
    ])

    return NextResponse.json({ upcoming, queue: queueEntries })

  } catch (error) {
    console.error("My bookings error:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}
