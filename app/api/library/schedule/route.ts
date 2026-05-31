import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType } from "@prisma/client"
import { parseLocalDate } from "@/lib/date-utils"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")

    if (!dateStr) {
      return NextResponse.json({ error: "date is required" }, { status: 400 })
    }

    const date = parseLocalDate(dateStr)

    const bookings = await prisma.booking.findMany({
      where: { facilityType: FacilityType.LIBRARY, date },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        userId: true,
        startTime: true,
        endTime: true,
        duration: true,
        user: { select: { name: true } },
      },
    })

    return NextResponse.json(
      bookings.map(b => ({
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime ?? null,
        duration: b.duration,
        isYours: b.userId === userId,
        firstName: b.user.name.split(" ")[0],
      }))
    )
  } catch (error) {
    console.error("Library schedule error:", error)
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 })
  }
}
