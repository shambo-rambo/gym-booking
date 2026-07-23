import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { z } from "zod"
import { isSlotAvailable, checkConsecutiveDays, checkDailyLimit, checkSessionLimit, parseSlotDateTime, validateBookingTime, LAST_MINUTE_BYPASS_MINUTES } from "@/lib/booking-rules"
import { parseLocalDate } from "@/lib/date-utils"

export const dynamic = 'force-dynamic'

const joinQueueSchema = z.object({
  facilityType: z.enum(["GYM", "SAUNA", "LIBRARY"]),
  bookingType: z.enum(["EXCLUSIVE", "SHARED", "EXCLUSIVE_BOTH"]),
  equipmentType: z.enum([
    "WEIGHTS_MACHINE",
    "FREE_DUMBBELLS",
    "TREADMILL",
    "ROWING_MACHINE",
    "EXERCISE_BIKE"
  ]).optional(),
  date: z.string(),
  startTime: z.string(),
  duration: z.number().positive().int()
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

    // Check user is verified
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user || user.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Your account is not yet verified" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = joinQueueSchema.parse(body)

    const {
      facilityType,
      bookingType,
      equipmentType,
      date: dateStr,
      startTime,
      duration
    } = validatedData

    const date = parseLocalDate(dateStr)
    const isLibrary = facilityType === "LIBRARY"

    // Duration/time-of-day rules must be 30 or 60 for gym/sauna; library allows any positive duration
    if (!isLibrary) {
      const timeValidation = validateBookingTime(date, startTime, duration, facilityType as FacilityType)
      if (!timeValidation.allowed) {
        return NextResponse.json({ error: timeValidation.reason }, { status: 400 })
      }
    }

    // Validate equipment type for shared gym
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

    const resolvedBookingType = isLibrary ? BookingType.EXCLUSIVE : bookingType as BookingType
    const resolvedEquipmentType = isLibrary ? null : equipmentType as EquipmentType || null

    // Check if slot is physically available (not full)
    const slotAvailability = await isSlotAvailable(
      facilityType as FacilityType,
      resolvedBookingType,
      resolvedEquipmentType,
      date,
      startTime,
      duration
    )

    let canUserBook = true
    const minutesUntilSlot = (parseSlotDateTime(date, startTime).getTime() - Date.now()) / (1000 * 60)
    const isLastMinute = minutesUntilSlot <= LAST_MINUTE_BYPASS_MINUTES

    if (isLibrary) {
      // Library has no booking limits — if the slot is free, book directly
      if (slotAvailability.allowed) {
        return NextResponse.json(
          { error: "Library is available. Please book it directly." },
          { status: 400 }
        )
      }
    } else {
      // Check booking rules for gym/sauna. The daily 1-hour limit is never bypassed, even
      // last-minute — otherwise a resident could stack extra time onto an already-maxed-out
      // day as the clock ticks down. Session-count and consecutive-day are bypassed last-minute.
      const dailyCheck = await checkDailyLimit(userId, facilityType as FacilityType, date, startTime, duration)
      let antiHoardingCheck = dailyCheck
      if (dailyCheck.allowed && !isLastMinute) {
        const [sessionCheck, consecutiveCheck] = await Promise.all([
          checkSessionLimit(userId, facilityType as FacilityType),
          checkConsecutiveDays(userId, facilityType as FacilityType, date, startTime),
        ])
        antiHoardingCheck = sessionCheck.allowed && consecutiveCheck.allowed
          ? { allowed: true }
          : { allowed: false, reason: sessionCheck.reason ?? consecutiveCheck.reason }
      }
      canUserBook = antiHoardingCheck.allowed

      // Last-minute window: session/consecutive-day limits are bypassed, so if the slot is
      // physically available and the daily limit doesn't block it, the user should book
      // directly rather than queue
      if (isLastMinute && slotAvailability.allowed && antiHoardingCheck.allowed) {
        return NextResponse.json(
          { error: `This slot is available to book directly — booking limits don't apply within ${LAST_MINUTE_BYPASS_MINUTES} minutes of the session.` },
          { status: 400 }
        )
      }

      // Only prevent queue join if BOTH slot is available AND user passes anti-hoarding
      // If slot is full OR user is blocked by anti-hoarding, allow queue join
      if (slotAvailability.allowed && antiHoardingCheck.allowed) {
        return NextResponse.json(
          { error: "This slot is available. Please book it directly instead of joining the queue." },
          { status: 400 }
        )
      }
    }

    // Check if user already in queue for this exact slot
    const existingQueueEntry = await prisma.queueEntry.findFirst({
      where: {
        userId,
        facilityType: facilityType as FacilityType,
        bookingType: resolvedBookingType,
        equipmentType: resolvedEquipmentType,
        date,
        startTime,
        duration
      }
    })

    if (existingQueueEntry) {
      return NextResponse.json(
        { error: "You are already in the queue for this slot" },
        { status: 400 }
      )
    }

    // Check if user already has a booking overlapping this time
    const existingBookings = await prisma.booking.findMany({
      where: { userId, facilityType: facilityType as FacilityType, date }
    })

    const reqStart = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
    const reqEnd = reqStart + duration

    const alreadyBooked = existingBookings.some(b => {
      const [bh, bm] = b.startTime.split(':').map(Number)
      const bStart = bh * 60 + bm
      return bStart < reqEnd && bStart + b.duration > reqStart
    })

    if (alreadyBooked) {
      return NextResponse.json(
        { error: "You already have a booking at this time" },
        { status: 400 }
      )
    }

    // SMART QUEUE: Calculate position based on whether user can actually book
    // Users who can book (not blocked by anti-hoarding) get priority
    const allQueueEntries = await prisma.queueEntry.findMany({
      where: {
        facilityType: facilityType as FacilityType,
        bookingType: resolvedBookingType,
        equipmentType: resolvedEquipmentType,
        date,
        startTime,
        duration
      },
      orderBy: { position: 'asc' }
    })

    let newPosition

    if (canUserBook) {
      // User CAN book - find the last position among users who can also book
      // They should be ahead of users who are blocked by anti-hoarding
      let lastCanBookPosition = 0

      if (!isLibrary) {
        for (const entry of allQueueEntries) {
          const entryDaily = await checkDailyLimit(entry.userId, facilityType as FacilityType, date, startTime, duration)
          let entryCanBook = entryDaily.allowed
          if (entryCanBook && !isLastMinute) {
            const [entrySession, entryConsecutive] = await Promise.all([
              checkSessionLimit(entry.userId, facilityType as FacilityType),
              checkConsecutiveDays(entry.userId, facilityType as FacilityType, date, startTime),
            ])
            entryCanBook = entrySession.allowed && entryConsecutive.allowed
          }
          if (entryCanBook) {
            lastCanBookPosition = entry.position
          }
        }
      } else {
        // For library all users can book, so just go to end
        lastCanBookPosition = allQueueEntries[allQueueEntries.length - 1]?.position ?? 0
      }

      newPosition = lastCanBookPosition + 1
    } else {
      // User is blocked by anti-hoarding - go to the end of the queue
      const maxPosition = allQueueEntries[allQueueEntries.length - 1]
      newPosition = (maxPosition?.position || 0) + 1
    }

    // Reorder queue entries if needed (shift positions down for users after new position)
    if (canUserBook && newPosition <= allQueueEntries.length) {
      // Shift positions for entries that should come after this one
      await prisma.queueEntry.updateMany({
        where: {
          facilityType: facilityType as FacilityType,
          bookingType: resolvedBookingType,
          equipmentType: resolvedEquipmentType,
          date,
          startTime,
          duration,
          position: { gte: newPosition }
        },
        data: {
          position: { increment: 1 }
        }
      })
    }

    // Create queue entry
    const queueEntry = await prisma.queueEntry.create({
      data: {
        userId,
        facilityType: facilityType as FacilityType,
        bookingType: resolvedBookingType,
        equipmentType: resolvedEquipmentType,
        date,
        startTime,
        duration,
        position: newPosition
      }
    })

    return NextResponse.json({
      success: true,
      queueEntry: {
        id: queueEntry.id,
        position: queueEntry.position
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Join queue error:", error)
    return NextResponse.json(
      { error: "Failed to join queue" },
      { status: 500 }
    )
  }
}
