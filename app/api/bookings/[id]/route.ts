import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseSlotDateTime } from "@/lib/booking-rules"
import { notifyNextInQueue, notifyLibraryQueueAfterCancellation } from "@/lib/queue-notifications"

export const dynamic = 'force-dynamic'

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

    // Block cancellation within 30 minutes of start (or after it's started)
    const bookingStartTime = parseSlotDateTime(booking.date, booking.startTime)
    const now = new Date()
    const minutesUntilStart = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60)

    if (minutesUntilStart <= 30) {
      return NextResponse.json(
        { error: "Bookings cannot be cancelled within 30 minutes of the start time." },
        { status: 400 }
      )
    }

    // Delete the booking
    await prisma.booking.delete({
      where: { id: bookingId }
    })

    // Check if anyone is queued for this slot and notify them
    if (booking.facilityType === "LIBRARY") {
      await notifyLibraryQueueAfterCancellation(booking.date)
    } else {
      await notifyNextInQueue(
        booking.facilityType,
        booking.bookingType,
        booking.equipmentType,
        booking.date,
        booking.startTime,
        booking.duration
      )
    }

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
