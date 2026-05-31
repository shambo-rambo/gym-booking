import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { z } from "zod"
import {
  validateBookingTime,
  validateLibraryBookingTime,
  checkConsecutiveDays,
  checkDailyLimit,
  checkSessionLimit,
  parseSlotDateTime,
} from "@/lib/booking-rules"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"
import { parseLocalDate } from "@/lib/date-utils"

export const dynamic = 'force-dynamic'

const createBookingSchema = z.object({
  facilityType: z.enum(["GYM", "SAUNA", "LIBRARY"]),
  bookingType: z.enum(["EXCLUSIVE", "SHARED"]).optional(),
  equipmentType: z.enum([
    "WEIGHTS_MACHINE",
    "FREE_DUMBBELLS",
    "TREADMILL",
    "ROWING_MACHINE",
    "EXERCISE_BIKE"
  ]).optional(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(), // Library only
  duration: z.number().optional(), // Required for GYM/SAUNA
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
      endTime,
      duration: rawDuration,
    } = validatedData

    const date = parseLocalDate(dateStr)

    // ── Library booking (open start/end, exclusive, one at a time) ──────────
    if (facilityType === "LIBRARY") {
      if (!endTime) {
        return NextResponse.json({ error: "End time is required for library bookings." }, { status: 400 })
      }

      const timeValidation = validateLibraryBookingTime(date, startTime, endTime)
      if (!timeValidation.allowed) {
        return NextResponse.json({ error: timeValidation.reason }, { status: 400 })
      }

      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      const newStart = sh * 60 + sm
      const newEnd = eh * 60 + em
      const duration = newEnd - newStart

      try {
        const booking = await prisma.$transaction(async (tx) => {
          const existing = await tx.booking.findMany({
            where: { facilityType: FacilityType.LIBRARY, date },
          })

          const hasClash = existing.some(b => {
            const [bh, bm] = b.startTime.split(':').map(Number)
            const bStart = bh * 60 + bm
            const bEnd = bStart + b.duration
            return bStart < newEnd && bEnd > newStart
          })

          if (hasClash) throw new Error("Library is already booked during this time.")

          return tx.booking.create({
            data: {
              userId,
              facilityType: FacilityType.LIBRARY,
              bookingType: BookingType.EXCLUSIVE,
              date,
              startTime,
              endTime,
              duration,
            },
            include: { user: { select: { name: true, email: true } } },
          })
        }, { maxWait: 5000, timeout: 10000 })

        sendNotification(user, 'BOOKING_CONFIRMATION', {
          facilityType: 'Library',
          bookingType: 'EXCLUSIVE',
          date: format(booking.date, 'EEEE, MMMM d, yyyy'),
          startTime: booking.startTime,
          duration: booking.duration,
        }).catch(err => console.error('[Booking] Notification failed:', err))

        return NextResponse.json({
          success: true,
          booking: {
            id: booking.id,
            facilityType: booking.facilityType,
            bookingType: booking.bookingType,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            duration: booking.duration,
            createdAt: booking.createdAt,
          },
        })
      } catch (err: any) {
        if (err.message === "Library is already booked during this time.") {
          return NextResponse.json({ error: err.message }, { status: 409 })
        }
        console.error("Library booking creation error:", err)
        return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
      }
    }

    // ── Gym / Sauna booking ───────────────────────────────────────────────────
    if (!bookingType) {
      return NextResponse.json({ error: "Booking type is required." }, { status: 400 })
    }
    if (rawDuration === undefined || (rawDuration !== 30 && rawDuration !== 60)) {
      return NextResponse.json({ error: "Duration must be 30 or 60 minutes." }, { status: 400 })
    }
    const duration = rawDuration

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

    // Last-minute bypass: slots starting within 3 hours skip all three limit checks.
    // Capacity rules (isSlotAvailable, the transaction re-check) still apply normally.
    const minutesUntilSlot = (parseSlotDateTime(date, startTime).getTime() - Date.now()) / (1000 * 60)
    const isLastMinute = minutesUntilSlot <= 180

    // Validations 3-5: run all read-only checks in parallel (skipped for last-minute slots)
    if (!isLastMinute) {
      const [sessionCheck, dailyCheck, consecutiveCheck] = await Promise.all([
        checkSessionLimit(userId, facilityType as FacilityType),
        checkDailyLimit(userId, facilityType as FacilityType, date, startTime, duration),
        checkConsecutiveDays(userId, facilityType as FacilityType, date, startTime),
      ])

      if (!sessionCheck.allowed) {
        return NextResponse.json({ error: sessionCheck.reason }, { status: 400 })
      }
      if (!dailyCheck.allowed) {
        return NextResponse.json({ error: dailyCheck.reason }, { status: 400 })
      }
      if (!consecutiveCheck.allowed) {
        return NextResponse.json({ error: consecutiveCheck.reason }, { status: 400 })
      }
    }

    // Validation 6: Check availability and create booking in transaction
    // Transaction is kept minimal (reads parallel, write last) to avoid timeouts
    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Re-check availability inside transaction with parallel reads
        const [slotHour, slotMinute] = startTime.split(':').map(Number)
        const slotStart = slotHour * 60 + slotMinute
        const slotEnd = slotStart + duration

        const [blockedSlot, allBookings] = await Promise.all([
          tx.blockedSlot.findFirst({ where: { facilityType: facilityType as FacilityType, date, startTime, duration } }),
          tx.booking.findMany({ where: { facilityType: facilityType as FacilityType, date } }),
        ])

        if (blockedSlot) throw new Error(blockedSlot.reason)

        const overlapping = allBookings.filter(b => {
          const [bh, bm] = b.startTime.split(':').map(Number)
          const bStart = bh * 60 + bm
          return bStart < slotEnd && bStart + b.duration > slotStart
        })

        const hasExclusive = overlapping.some(b => b.bookingType === BookingType.EXCLUSIVE)
        if (hasExclusive) throw new Error("Slot has an exclusive booking.")

        if (bookingType === BookingType.EXCLUSIVE) {
          if (overlapping.length > 0) throw new Error("Slot is already booked.")
        } else if (facilityType === FacilityType.SAUNA) {
          if (overlapping.length >= 2) throw new Error("Sauna is full (2 people max).")
        } else {
          const distinctExistingUsers = new Set(overlapping.map(b => b.userId))
          // Only block if this user is a *new* person and the slot already has 2 people.
          // Allowing the same user to create multiple equipment bookings must not count as extra people.
          if (!distinctExistingUsers.has(userId) && distinctExistingUsers.size >= 2) {
            throw new Error("Gym is full (2 people max).")
          }
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

      // Clean up any queue entry the user had for this slot (fire-and-forget)
      prisma.queueEntry.deleteMany({
        where: { userId, facilityType: facilityType as FacilityType, date, startTime, duration }
      }).catch(err => console.error('[Booking] Queue cleanup failed:', err))

      // Fire-and-forget — don't block the response on email/SMS delivery
      sendNotification(user, 'BOOKING_CONFIRMATION', {
        facilityType: booking.facilityType.toString(),
        bookingType: booking.bookingType.toString(),
        equipmentType: booking.equipmentType?.toString(),
        date: format(booking.date, 'EEEE, MMMM d, yyyy'),
        startTime: booking.startTime,
        duration: booking.duration
      }).catch(err => console.error('[Booking] Notification failed:', err))

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
