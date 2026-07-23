import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  validateBookingTime,
  checkSessionLimit,
  checkDailyLimit,
  checkConsecutiveDays,
  isSlotAvailable,
  parseSlotDateTime,
  LAST_MINUTE_BYPASS_MINUTES,
} from "@/lib/booking-rules"
import { BookingType, FacilityType, EquipmentType } from "@prisma/client"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"

export const dynamic = 'force-dynamic'

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

    const minutesUntilSlot = (parseSlotDateTime(queueEntry.date, queueEntry.startTime).getTime() - Date.now()) / (1000 * 60)
    const isLastMinute = minutesUntilSlot <= LAST_MINUTE_BYPASS_MINUTES

    // Last-minute bypass: skip notification requirement and anti-hoarding checks
    if (!isLastMinute) {
      if (!queueEntry.notifiedAt) {
        return NextResponse.json(
          { error: "You have not been notified for this slot yet" },
          { status: 400 }
        )
      }

      if (queueEntry.expiresAt && new Date() > queueEntry.expiresAt) {
        return NextResponse.json(
          { error: "Your claim window has expired" },
          { status: 400 }
        )
      }
    }

    // Validate booking time constraints (always enforced)
    const timeValidation = validateBookingTime(
      queueEntry.date,
      queueEntry.startTime,
      queueEntry.duration,
      queueEntry.facilityType
    )

    if (!timeValidation.allowed) {
      return NextResponse.json(
        { error: timeValidation.reason },
        { status: 400 }
      )
    }

    // The daily 1-hour limit is never bypassed, even for last-minute claims — otherwise a
    // resident could stack extra time onto an already-maxed-out day as the clock ticks down.
    const dailyCheck = await checkDailyLimit(userId, queueEntry.facilityType, queueEntry.date, queueEntry.startTime, queueEntry.duration)
    if (!dailyCheck.allowed) {
      return NextResponse.json({ error: dailyCheck.reason }, { status: 400 })
    }

    // Session-count and consecutive-day checks are skipped for last-minute claims
    if (!isLastMinute) {
      const sessionCheck = await checkSessionLimit(userId, queueEntry.facilityType)
      if (!sessionCheck.allowed) {
        return NextResponse.json({ error: sessionCheck.reason }, { status: 400 })
      }

      const consecutiveCheck = await checkConsecutiveDays(userId, queueEntry.facilityType, queueEntry.date, queueEntry.startTime)
      if (!consecutiveCheck.allowed) {
        return NextResponse.json({ error: consecutiveCheck.reason }, { status: 400 })
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
        sendNotification(user, 'BOOKING_CONFIRMATION', {
          facilityType: result.facilityType.toString(),
          bookingType: result.bookingType.toString(),
          equipmentType: result.equipmentType?.toString(),
          date: format(result.date, 'EEEE, MMMM d, yyyy'),
          startTime: result.startTime,
          duration: result.duration
        }).catch(err => console.error('[Queue] Notification failed:', err))
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
