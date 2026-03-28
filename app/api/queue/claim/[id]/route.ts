import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  validateBookingTime,
  checkBookingLimits,
  isSlotAvailable,
  canBookExclusiveSlot,
  canBookSharedSlot
} from "@/lib/booking-rules"
import { BookingType, FacilityType, EquipmentType } from "@prisma/client"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"

export async function POST(
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
    const queueEntryId = params.id

    // Get the queue entry
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id: queueEntryId }
    })

    if (!queueEntry) {
      return NextResponse.json(
        { error: "Queue entry not found" },
        { status: 404 }
      )
    }

    // Check ownership
    if (queueEntry.userId !== userId) {
      return NextResponse.json(
        { error: "This queue entry does not belong to you" },
        { status: 403 }
      )
    }

    // Check if user was notified
    if (!queueEntry.notifiedAt) {
      return NextResponse.json(
        { error: "You have not been notified for this slot yet" },
        { status: 400 }
      )
    }

    // Check if claim window expired
    if (queueEntry.expiresAt && new Date() > queueEntry.expiresAt) {
      return NextResponse.json(
        { error: "Your claim window has expired" },
        { status: 400 }
      )
    }

    // Validate booking time constraints
    const timeValidation = validateBookingTime(
      queueEntry.date,
      queueEntry.startTime,
      queueEntry.duration
    )

    if (!timeValidation.allowed) {
      return NextResponse.json(
        { error: timeValidation.reason },
        { status: 400 }
      )
    }

    // Check booking limits
    const limitsCheck = await checkBookingLimits(
      userId,
      queueEntry.bookingType,
      queueEntry.facilityType
    )

    if (!limitsCheck.allowed) {
      return NextResponse.json(
        { error: limitsCheck.reason },
        { status: 400 }
      )
    }

    // Check anti-hoarding rules
    if (queueEntry.bookingType === BookingType.EXCLUSIVE) {
      const antiHoardingCheck = await canBookExclusiveSlot(
        userId,
        queueEntry.facilityType,
        queueEntry.date,
        queueEntry.startTime,
        queueEntry.duration
      )
      if (!antiHoardingCheck.allowed) {
        return NextResponse.json(
          { error: antiHoardingCheck.reason },
          { status: 400 }
        )
      }
    } else {
      const antiHoardingCheck = await canBookSharedSlot(
        userId,
        queueEntry.facilityType,
        queueEntry.equipmentType,
        queueEntry.date,
        queueEntry.startTime
      )
      if (!antiHoardingCheck.allowed) {
        return NextResponse.json(
          { error: antiHoardingCheck.reason },
          { status: 400 }
        )
      }
    }

    // Create booking and delete queue entry in transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Re-check availability
        const availabilityCheck = await isSlotAvailable(
          queueEntry.facilityType,
          queueEntry.bookingType,
          queueEntry.equipmentType,
          queueEntry.date,
          queueEntry.startTime,
          queueEntry.duration
        )

        if (!availabilityCheck.allowed) {
          throw new Error(availabilityCheck.reason || "Slot is no longer available")
        }

        // Create the booking
        const booking = await tx.booking.create({
          data: {
            userId,
            facilityType: queueEntry.facilityType,
            bookingType: queueEntry.bookingType,
            equipmentType: queueEntry.equipmentType,
            date: queueEntry.date,
            startTime: queueEntry.startTime,
            duration: queueEntry.duration
          }
        })

        // Delete this queue entry
        await tx.queueEntry.delete({
          where: { id: queueEntryId }
        })

        return booking
      })

      // Get user for notification
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      // Send booking confirmation notification
      if (user) {
        await sendNotification(user, 'BOOKING_CONFIRMATION', {
          facilityType: result.facilityType.toString(),
          bookingType: result.bookingType.toString(),
          equipmentType: result.equipmentType?.toString(),
          date: format(result.date, 'EEEE, MMMM d, yyyy'),
          startTime: result.startTime,
          duration: result.duration
        })
      }

      return NextResponse.json({
        success: true,
        booking: {
          id: result.id,
          facilityType: result.facilityType,
          bookingType: result.bookingType,
          equipmentType: result.equipmentType,
          date: result.date,
          startTime: result.startTime,
          duration: result.duration
        }
      })

    } catch (transactionError: any) {
      return NextResponse.json(
        { error: transactionError.message || "Failed to claim slot" },
        { status: 409 }
      )
    }

  } catch (error) {
    console.error("Claim slot error:", error)
    return NextResponse.json(
      { error: "Failed to claim slot" },
      { status: 500 }
    )
  }
}
