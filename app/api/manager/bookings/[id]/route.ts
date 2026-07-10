import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { notifyNextInQueue, notifyLibraryQueueAfterCancellation } from "@/lib/queue-notifications"
import { format } from "date-fns"
import { z } from "zod"

export const dynamic = 'force-dynamic'

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

    // Exclusive (Gym + Sauna) bookings are two linked rows sharing a groupId — cancelling
    // either one must free both, since they represent a single booking action.
    const linkedBookings = booking.groupId
      ? await prisma.booking.findMany({ where: { groupId: booking.groupId } })
      : [booking]

    await prisma.booking.deleteMany({
      where: booking.groupId ? { groupId: booking.groupId } : { id: bookingId }
    })

    // Notify user if requested
    if (validatedData.notifyUser) {
      const facilityLabel = linkedBookings.length > 1
        ? "Gym & Sauna"
        : booking.facilityType.toString()
      sendNotification(booking.user, 'BOOKING_CANCELLED_BY_ADMIN', {
        facilityType: facilityLabel,
        date: format(booking.date, 'EEEE, MMMM d, yyyy'),
        startTime: booking.startTime,
        reason: validatedData.reason
      }).catch(err => console.error('[Booking] Notification failed:', err))
    }

    // Check if anyone is queued for the freed slot(s) and notify them
    for (const freed of linkedBookings) {
      if (freed.facilityType === "LIBRARY") {
        await notifyLibraryQueueAfterCancellation(freed.date)
      } else {
        await notifyNextInQueue(
          freed.facilityType,
          freed.bookingType,
          freed.equipmentType,
          freed.date,
          freed.startTime,
          freed.duration
        )
      }
    }

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
