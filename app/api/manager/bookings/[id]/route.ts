import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { notifyNextInQueue } from "@/lib/queue-notifications"
import { format } from "date-fns"
import { z } from "zod"

const cancelBookingSchema = z.object({
  reason: z.string().optional(),
  notifyUser: z.boolean().default(true)
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is manager
    const manager = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const bookingId = params.id
    const body = await request.json()
    const validatedData = cancelBookingSchema.parse(body)

    // Get the booking with user details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true }
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Delete the booking
    await prisma.booking.delete({
      where: { id: bookingId }
    })

    // Notify user if requested
    if (validatedData.notifyUser) {
      await sendNotification(booking.user, 'BOOKING_CANCELLED_BY_ADMIN', {
        facilityType: booking.facilityType.toString(),
        date: format(booking.date, 'EEEE, MMMM d, yyyy'),
        startTime: booking.startTime,
        reason: validatedData.reason
      })
    }

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Cancel booking error:", error)
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    )
  }
}
