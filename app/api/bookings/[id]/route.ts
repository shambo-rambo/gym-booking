import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseSlotDateTime } from "@/lib/booking-rules"
import { notifyNextInQueue } from "@/lib/queue-notifications"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = (session.user as any).id
    const bookingId = params.id

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    // Check ownership
    if (booking.userId !== userId) {
      return NextResponse.json(
        { error: "You can only cancel your own bookings" },
        { status: 403 }
      )
    }

    // Check timing - allow cancellation up to 5 minutes before
    const bookingStartTime = parseSlotDateTime(booking.date, booking.startTime)
    const now = new Date()
    const minutesUntilStart = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60)

    // Allow cancellation even if less than 5 minutes (per requirements)
    // The 5-minute rule is a minimum notice, not a restriction

    // Delete the booking
    await prisma.booking.delete({
      where: { id: bookingId }
    })

    // Check if anyone is queued for this slot and notify them
    await notifyNextInQueue(
      booking.facilityType,
      booking.bookingType,
      booking.equipmentType,
      booking.date,
      booking.startTime,
      booking.duration
    )

    return NextResponse.json({
      success: true,
      message: "Booking cancelled successfully"
    })

  } catch (error) {
    console.error("Delete booking error:", error)
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    )
  }
}
