import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType, User } from "@prisma/client"
import { z } from "zod"
import {
  validateBookingTime,
  validateLibraryBookingTime,
  checkConsecutiveDays,
  checkDailyLimit,
  checkSessionLimit,
  parseSlotDateTime,
  EXCLUSIVE_TYPES,
  LAST_MINUTE_BYPASS_MINUTES,
} from "@/lib/booking-rules"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"
import { parseLocalDate } from "@/lib/date-utils"
import { generateBookingICS } from "@/lib/ics"

export const dynamic = 'force-dynamic'

const createBookingSchema = z.object({
  facilityType: z.enum(["GYM", "SAUNA", "LIBRARY"]),
  bookingType: z.enum(["EXCLUSIVE", "SHARED", "EXCLUSIVE_BOTH"]).optional(),
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

// Creates a linked pair of Booking rows (one GYM, one SAUNA) sharing a groupId, so the
// whole slot is locked on both facilities at once. Follows the same rules as a plain
// Private (EXCLUSIVE) booking, just checked/applied against both facilities together.
async function createExclusiveBothBooking(
  user: User,
  userId: string,
  requestedFacilityType: FacilityType,
  date: Date,
  startTime: string,
  duration: number
) {
  const timeValidation = validateBookingTime(date, startTime, duration)
  if (!timeValidation.allowed) {
    return NextResponse.json({ error: timeValidation.reason }, { status: 400 })
  }

  const minutesUntilSlot = (parseSlotDateTime(date, startTime).getTime() - Date.now()) / (1000 * 60)
  const isLastMinute = minutesUntilSlot <= LAST_MINUTE_BYPASS_MINUTES
  const facilities = [FacilityType.GYM, FacilityType.SAUNA] as const

  // The daily 1-hour limit is never bypassed, even last-minute — otherwise a resident
  // could stack extra time onto an already-maxed-out day as the clock ticks down.
  const dailyResults = await Promise.all(
    facilities.map((facility) =>
      checkDailyLimit(userId, facility, date, startTime, duration).then((r) => ({ ...r, facility }))
    )
  )
  const failedDaily = dailyResults.find((r) => !r.allowed)
  if (failedDaily) {
    const label = failedDaily.facility === FacilityType.GYM ? "Gym" : "Sauna"
    return NextResponse.json({ error: `${label}: ${failedDaily.reason}` }, { status: 400 })
  }

  if (!isLastMinute) {
    const results = await Promise.all(
      facilities.flatMap((facility) => [
        checkSessionLimit(userId, facility).then((r) => ({ ...r, facility })),
        checkConsecutiveDays(userId, facility, date, startTime).then((r) => ({ ...r, facility })),
      ])
    )
    const failed = results.find((r) => !r.allowed)
    if (failed) {
      const label = failed.facility === FacilityType.GYM ? "Gym" : "Sauna"
      return NextResponse.json({ error: `${label}: ${failed.reason}` }, { status: 400 })
    }
  }

  try {
    const bookings = await prisma.$transaction(async (tx) => {
      const [slotHour, slotMinute] = startTime.split(':').map(Number)
      const slotStart = slotHour * 60 + slotMinute
      const slotEnd = slotStart + duration

      const overlaps = (existing: { startTime: string; duration: number }[]) =>
        existing.some((b) => {
          const [bh, bm] = b.startTime.split(':').map(Number)
          const bStart = bh * 60 + bm
          return bStart < slotEnd && bStart + b.duration > slotStart
        })

      const [gymBlocked, saunaBlocked, gymBookings, saunaBookings] = await Promise.all([
        tx.blockedSlot.findFirst({ where: { facilityType: FacilityType.GYM, date, startTime, duration } }),
        tx.blockedSlot.findFirst({ where: { facilityType: FacilityType.SAUNA, date, startTime, duration } }),
        tx.booking.findMany({ where: { facilityType: FacilityType.GYM, date } }),
        tx.booking.findMany({ where: { facilityType: FacilityType.SAUNA, date } }),
      ])

      if (gymBlocked) throw new Error(`Gym: ${gymBlocked.reason}`)
      if (saunaBlocked) throw new Error(`Sauna: ${saunaBlocked.reason}`)
      if (overlaps(gymBookings)) throw new Error("Gym: Slot is already booked.")
      if (overlaps(saunaBookings)) throw new Error("Sauna: Slot is already booked.")

      const groupId = randomUUID()
      const shared = { userId, bookingType: BookingType.EXCLUSIVE_BOTH, date, startTime, duration, groupId }

      return Promise.all([
        tx.booking.create({ data: { ...shared, facilityType: FacilityType.GYM } }),
        tx.booking.create({ data: { ...shared, facilityType: FacilityType.SAUNA } }),
      ])
    }, { maxWait: 5000, timeout: 10000 })

    // Clean up any queue entries the user had for this slot on either facility
    prisma.queueEntry.deleteMany({
      where: { userId, facilityType: { in: [FacilityType.GYM, FacilityType.SAUNA] }, date, startTime, duration }
    }).catch((err) => console.error('[Booking] Queue cleanup failed:', err))

    const icsContent = generateBookingICS({
      id: bookings[0].id,
      facilityType: bookings[0].facilityType,
      bookingType: 'EXCLUSIVE_BOTH',
      date,
      startTime,
      duration,
    })

    sendNotification(user, 'BOOKING_CONFIRMATION', {
      facilityType: 'Gym & Sauna',
      bookingType: 'Exclusive',
      date: format(date, 'EEEE, MMMM d, yyyy'),
      startTime,
      duration,
      icsContent,
      icsFilename: 'booking.ics',
    }).catch((err) => console.error('[Booking] Notification failed:', err))

    const primary = bookings.find((b) => b.facilityType === requestedFacilityType) ?? bookings[0]

    return NextResponse.json({
      success: true,
      booking: {
        id: primary.id,
        facilityType: primary.facilityType,
        bookingType: primary.bookingType,
        equipmentType: null,
        date: primary.date,
        startTime: primary.startTime,
        duration: primary.duration,
        createdAt: primary.createdAt,
      },
      linkedBookings: bookings.map((b) => ({ id: b.id, facilityType: b.facilityType })),
    })
  } catch (transactionError: any) {
    return NextResponse.json(
      { error: transactionError.message || "Slot just became unavailable. Please try another." },
      { status: 409 }
    )
  }
}

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
          icsContent: generateBookingICS({
            id: booking.id,
            facilityType: booking.facilityType,
            bookingType: booking.bookingType,
            date: booking.date,
            startTime: booking.startTime,
            duration: booking.duration,
            endTime: booking.endTime,
          }),
          icsFilename: 'booking.ics',
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

    // ── Exclusive (Gym + Sauna together) booking ─────────────────────────────
    if (bookingType === BookingType.EXCLUSIVE_BOTH) {
      if (equipmentType) {
        return NextResponse.json(
          { error: "Equipment type is not applicable for an exclusive booking." },
          { status: 400 }
        )
      }
      return createExclusiveBothBooking(user, userId, facilityType as FacilityType, date, startTime, duration)
    }

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

    // Last-minute bypass: slots starting within LAST_MINUTE_BYPASS_MINUTES skip the
    // session-count and consecutive-day checks. The daily 1-hour limit is never bypassed
    // — otherwise a resident could stack extra time onto an already-maxed-out day as the
    // clock ticks down. Capacity rules (isSlotAvailable, the transaction re-check) still
    // apply normally regardless.
    const minutesUntilSlot = (parseSlotDateTime(date, startTime).getTime() - Date.now()) / (1000 * 60)
    const isLastMinute = minutesUntilSlot <= LAST_MINUTE_BYPASS_MINUTES

    const dailyCheck = await checkDailyLimit(userId, facilityType as FacilityType, date, startTime, duration)
    if (!dailyCheck.allowed) {
      return NextResponse.json({ error: dailyCheck.reason }, { status: 400 })
    }

    // Validations 4-5: run remaining read-only checks in parallel (skipped for last-minute slots)
    if (!isLastMinute) {
      const [sessionCheck, consecutiveCheck] = await Promise.all([
        checkSessionLimit(userId, facilityType as FacilityType),
        checkConsecutiveDays(userId, facilityType as FacilityType, date, startTime),
      ])

      if (!sessionCheck.allowed) {
        return NextResponse.json({ error: sessionCheck.reason }, { status: 400 })
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

        const hasExclusive = overlapping.some(b => EXCLUSIVE_TYPES.includes(b.bookingType))
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
          // Equipment isn't physically shareable — one holder at a time.
          if (equipmentType && overlapping.some(b => b.equipmentType === equipmentType && b.userId !== userId)) {
            throw new Error("That equipment is already booked for this time.")
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
        duration: booking.duration,
        icsContent: generateBookingICS({
          id: booking.id,
          facilityType: booking.facilityType,
          bookingType: booking.bookingType,
          equipmentType: booking.equipmentType,
          date: booking.date,
          startTime: booking.startTime,
          duration: booking.duration,
        }),
        icsFilename: 'booking.ics',
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
