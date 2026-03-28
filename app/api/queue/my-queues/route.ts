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

    // Get active queue entries (future dates)
    const activeQueues = await prisma.queueEntry.findMany({
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
      active: activeQueues
    })

  } catch (error) {
    console.error("My queues error:", error)
    return NextResponse.json(
      { error: "Failed to fetch queue entries" },
      { status: 500 }
    )
  }
}
