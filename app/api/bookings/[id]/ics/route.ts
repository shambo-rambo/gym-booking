import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateBookingICS } from "@/lib/ics"

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const booking = await prisma.booking.findUnique({ where: { id: params.id } })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ error: "You can only export your own bookings" }, { status: 403 })
    }

    const ics = generateBookingICS({
      id: booking.id,
      facilityType: booking.facilityType,
      bookingType: booking.bookingType,
      equipmentType: booking.equipmentType,
      date: booking.date,
      startTime: booking.startTime,
      duration: booking.duration,
      endTime: booking.endTime,
    })

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="booking-${booking.id}.ics"`,
      },
    })
  } catch (error) {
    console.error("Generate booking ICS error:", error)
    return NextResponse.json({ error: "Failed to generate calendar file" }, { status: 500 })
  }
}
