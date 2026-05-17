import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { z } from "zod"
import {
  validateBookingTime,
  checkConsecutiveDays,
  checkDailyLimit,
  checkSessionLimit,
  isSlotAvailable,
} from "@/lib/booking-rules"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"
import { parseLocalDate } from "@/lib/date-utils"

const createBookingSchema = z.object({
  facilityType: z.enum(["GYM", "SAUNA"]),
  bookingType: z.enum(["EXCLUSIVE", "SHARED"]),
  equipmentType: z.enum([
    "WEIGHTS_MACHINE",
    "FREE_DUMBBELLS",
    "TREADMILL",
    "ROWING_MACHINE",
    "EXERCISE_BIKE"
  ]).optional(),
  date: z.string(),
  startTime: z.string(),
  duration: z.number().refine(d => d === 30 || d === 60)
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = (session.user as any).id

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Check if user is verified
    if (user.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Your account is not yet verified. Please wait for manager approval." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createBookingSchema.parse(body)

    const {
      facilityType,
      bookingType,
      equipmentType,
      date: dateStr,
      startTime,
      duration
    } = validatedData

    const date = parseLocalDate(dateStr)

    // Validation 1: Equipment type required for shared gym bookings
    if (
      facilityType === FacilityType.GYM &&
      bookingType === BookingType.SHARED &&
      !equipmentType
    ) {
      return NextResponse.json(
        { error: "Equipment type is required for shared gym bookings" },
        { status: 400 }
      )
    }

    // Validation 2: Check booking time constraints
    const timeValidation = validateBookingTime(date, startTime, duration)
    if (!timeValidation.allowed) {
      return NextResponse.json(
        { error: timeValidation.reason },
        { status: 400 }
      )
    }

    // Validation 3: Max 3 upcoming sessions per facility
    const sessionCheck = await checkSessionLimit(userId, facilityType as FacilityType)
    if (!sessionCheck.allowed) {
      return NextResponse.json({ error: sessionCheck.reason }, { status: 400 })
    }

    // Validation 4: Max 1 hour per day per facility
    const dailyCheck = await checkDailyLimit(userId, facilityType as FacilityType, date, startTime, duration)
    if (!dailyCheck.allowed) {
      return NextResponse.json({ error: dailyCheck.reason }, { status: 400 })
    }

    // Validation 5: No same start time on consecutive days
    const consecutiveCheck = await checkConsecutiveDays(userId, facilityType as FacilityType, date, startTime)
    if (!consecutiveCheck.allowed) {
      return NextResponse.json({ error: consecutiveCheck.reason }, { status: 400 })
    }

    // Validation 6: Check availability and create booking in transaction
    // This handles race conditions
    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Re-check availability inside transaction
        const availabilityCheck = await isSlotAvailable(
          facilityType as FacilityType,
          bookingType as BookingType,
          equipmentType as EquipmentType || null,
          date,
          startTime,
          duration
        )

        if (!availabilityCheck.allowed) {
          throw new Error(availabilityCheck.reason || "Slot is not available")
        }

        // Create the booking
        return tx.booking.create({
          data: {
            userId,
            facilityType: facilityType as FacilityType,
            bookingType: bookingType as BookingType,
            equipmentType: equipmentType as EquipmentType || null,
            date,
            startTime,
            duration
          },
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        })
      }, {
        maxWait: 5000,
        timeout: 10000,
      })

      // Send confirmation notification
      await sendNotification(user, 'BOOKING_CONFIRMATION', {
        facilityType: booking.facilityType.toString(),
        bookingType: booking.bookingType.toString(),
        equipmentType: booking.equipmentType?.toString(),
        date: format(booking.date, 'EEEE, MMMM d, yyyy'),
        startTime: booking.startTime,
        duration: booking.duration
      })

      return NextResponse.json({
        success: true,
        booking: {
          id: booking.id,
          facilityType: booking.facilityType,
          bookingType: booking.bookingType,
          equipmentType: booking.equipmentType,
          date: booking.date,
          startTime: booking.startTime,
          duration: booking.duration,
          createdAt: booking.createdAt
        }
      })

    } catch (transactionError: any) {
      // Handle race condition where slot was just taken
      return NextResponse.json(
        { error: transactionError.message || "Slot just became unavailable. Please try another." },
        { status: 409 }
      )
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Booking creation error:", error)
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    )
  }
}
