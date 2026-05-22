import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { generateTimeSlots } from "@/lib/booking-rules"
import { parseLocalDate } from "@/lib/date-utils"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const facilityTypeParam = searchParams.get("facilityType")
    const dateStr = searchParams.get("date")

    if (!facilityTypeParam || !dateStr) {
      return NextResponse.json(
        { error: "facilityType and date are required" },
        { status: 400 }
      )
    }

    const validFacilityTypes = Object.values(FacilityType) as string[]
    if (!validFacilityTypes.includes(facilityTypeParam)) {
      return NextResponse.json({ error: "Invalid facilityType" }, { status: 400 })
    }
    const facilityType = facilityTypeParam as FacilityType

    const date = parseLocalDate(dateStr)
    const userId = (session.user as any).id

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const slotDate = new Date(date)
    slotDate.setHours(0, 0, 0, 0)
    const daysDifference = Math.floor(
      (slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    const isBeyond7Days = daysDifference > 7

    const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000)

    // Fetch all required data in a single parallel round-trip
    const [
      existingBookings,
      blockedSlots,
      queueEntries,
      yesterdayUserBookings,  // for consecutive-day check
      userDateBookings,        // for daily 1-hour limit check
      upcomingUserBookings,    // for session limit check (max 3)
    ] = await Promise.all([
      prisma.booking.findMany({ where: { facilityType, date } }),
      prisma.blockedSlot.findMany({ where: { facilityType, date } }),
      prisma.queueEntry.findMany({ where: { facilityType, date } }),
      prisma.booking.findMany({ where: { userId, facilityType, date: yesterday } }),
      prisma.booking.findMany({ where: { userId, facilityType, date } }),
      prisma.booking.findMany({
        where: { userId, facilityType, date: { gte: today } },
        select: { date: true, startTime: true },
      }),
    ])

    // Distinct upcoming sessions (date+startTime pairs)
    const upcomingSessionKeys = new Set(
      upcomingUserBookings.map((b) => `${b.date.toISOString()}|${b.startTime}`)
    )
    const upcomingSessionCount = upcomingSessionKeys.size

    // Consecutive-day check: did this user book the same start time yesterday?
    function isConsecutiveDayConflict(startTime: string): boolean {
      return yesterdayUserBookings.some((b) => b.startTime === startTime)
    }

    // Daily limit check: would adding this slot push the user over 60 min today?
    function exceedsDailyLimit(startTime: string, duration: number): boolean {
      const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m }
      const intervals: [number, number][] = [
        ...userDateBookings.map((b) => [toMin(b.startTime), toMin(b.startTime) + b.duration] as [number, number]),
        [toMin(startTime), toMin(startTime) + duration],
      ]
      intervals.sort((a, b) => a[0] - b[0])
      let total = 0
      let [cs, ce] = intervals[0]
      for (let i = 1; i < intervals.length; i++) {
        const [s, e] = intervals[i]
        if (s < ce) ce = Math.max(ce, e)
        else { total += ce - cs; cs = s; ce = e }
      }
      total += ce - cs
      return total > 60
    }

    // Session limit check: is the user at their 3-session cap for a new slot?
    function exceedsSessionLimit(startTime: string): boolean {
      if (upcomingSessionCount < 3) return false
      // If this date+time is already one of their sessions, it doesn't count as new
      const key = `${date.toISOString()}|${startTime}`
      return !upcomingSessionKeys.has(key)
    }

    const timeSlots = generateTimeSlots()
    const durations = [30, 60] as const

    const slots = timeSlots.map((startTime) => {
      const durationAvailability = durations.map((duration) => {
        const isBlocked = blockedSlots.some(
          (b) => b.startTime === startTime && b.duration === duration
        )

        const [slotHour, slotMinute] = startTime.split(":").map(Number)
        const slotStartMinutes = slotHour * 60 + slotMinute
        const slotEndMinutes = slotStartMinutes + duration

        const slotBookings = existingBookings.filter((b) => {
          const [bh, bm] = b.startTime.split(":").map(Number)
          const bookingStart = bh * 60 + bm
          return bookingStart < slotEndMinutes && bookingStart + b.duration > slotStartMinutes
        })

        const userBookingStartsHere = existingBookings.find(
          (b) => b.userId === userId && b.startTime === startTime && b.duration === duration
        ) ?? null

        const userBookingExtendsHere =
          userBookingStartsHere === null
            ? existingBookings.find((b) => {
                if (b.userId !== userId) return false
                const [bh, bm] = b.startTime.split(":").map(Number)
                const bookingStart = bh * 60 + bm
                return bookingStart < slotStartMinutes && bookingStart + b.duration > slotStartMinutes
              }) ?? null
            : null

        const userBooking = userBookingStartsHere ?? userBookingExtendsHere

        const queueCount = queueEntries.filter((q) => {
          if (q.startTime === startTime) return true
          if (duration === 30) {
            const [qh, qm] = q.startTime.split(":").map(Number)
            const queueStart = qh * 60 + qm
            return queueStart < slotStartMinutes && queueStart + q.duration > slotStartMinutes
          }
          return false
        }).length

        const userQueueEntryStartsHere = queueEntries.find(
          (q) => q.userId === userId && q.startTime === startTime && q.duration === duration
        ) ?? null

        const userQueueEntryExtendsHere =
          userQueueEntryStartsHere === null
            ? queueEntries.find((q) => {
                if (q.userId !== userId) return false
                const [qh, qm] = q.startTime.split(":").map(Number)
                const queueStart = qh * 60 + qm
                return queueStart < slotStartMinutes && queueStart + q.duration > slotStartMinutes
              }) ?? null
            : null

        const userQueueEntry = userQueueEntryStartsHere ?? userQueueEntryExtendsHere

        const hasExclusiveBooking = slotBookings.some(
          (b) => b.bookingType === BookingType.EXCLUSIVE
        )

        // Shared anti-hoarding: applies to all slot types for this user
        const antiHoardingBlocked =
          !userBooking && (
            isConsecutiveDayConflict(startTime) ||
            exceedsDailyLimit(startTime, duration) ||
            exceedsSessionLimit(startTime)
          )

        let exclusiveStatus = "available"
        let exclusiveReason = ""

        if (isBeyond7Days) {
          exclusiveStatus = "blocked"
          exclusiveReason = "Cannot book more than 7 days in advance."
        } else if (isBlocked) {
          exclusiveStatus = "blocked"
          exclusiveReason =
            blockedSlots.find((b) => b.startTime === startTime && b.duration === duration)?.reason ?? ""
        } else if (slotBookings.length > 0) {
          exclusiveStatus = "booked"
        } else if (antiHoardingBlocked) {
          exclusiveStatus = "unavailable"
          exclusiveReason = "Booking limit reached."
        }

        const sharedAvailability: Record<string, string> = {}

        if (facilityType === FacilityType.GYM) {
          const distinctGymUsers = new Set(slotBookings.map((b) => b.userId)).size
          const gymFull = !hasExclusiveBooking && distinctGymUsers >= 2
          for (const equipment of [
            EquipmentType.WEIGHTS_MACHINE,
            EquipmentType.FREE_DUMBBELLS,
            EquipmentType.TREADMILL,
            EquipmentType.ROWING_MACHINE,
            EquipmentType.EXERCISE_BIKE,
          ]) {
            if (isBeyond7Days || isBlocked) {
              sharedAvailability[equipment] = "blocked"
            } else if (hasExclusiveBooking) {
              sharedAvailability[equipment] = "booked"
            } else if (gymFull) {
              sharedAvailability[equipment] = "full"
            } else if (slotBookings.some((b) => b.equipmentType === equipment)) {
              sharedAvailability[equipment] = "booked"
            } else if (antiHoardingBlocked) {
              sharedAvailability[equipment] = "unavailable"
            } else {
              sharedAvailability[equipment] = "available"
            }
          }
        } else {
          if (isBeyond7Days || isBlocked) {
            sharedAvailability.capacity = "blocked"
          } else if (hasExclusiveBooking || slotBookings.length >= 2) {
            sharedAvailability.capacity = slotBookings.length >= 2 ? "full" : "booked"
          } else if (antiHoardingBlocked) {
            sharedAvailability.capacity = "unavailable"
          } else {
            sharedAvailability.capacity = "available"
          }
        }

        const bookingsStartingHere = existingBookings.filter(
          (b) => b.startTime === startTime && b.duration === duration
        )

        return {
          duration,
          exclusive: { status: exclusiveStatus, reason: exclusiveReason },
          shared: sharedAvailability,
          userBooking: userBooking
            ? {
                id: userBooking.id,
                bookingType: userBooking.bookingType,
                equipmentType: userBooking.equipmentType,
              }
            : null,
          userQueueEntry: userQueueEntry
            ? {
                id: userQueueEntry.id,
                bookingType: userQueueEntry.bookingType,
                equipmentType: userQueueEntry.equipmentType,
                position: userQueueEntry.position,
              }
            : null,
          queueCount,
          bookedCount: bookingsStartingHere.length,
        }
      })

      return { startTime, durations: durationAvailability }
    })

    return NextResponse.json(
      { date: dateStr, facilityType, slots },
      { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" } }
    )
  } catch (error) {
    console.error("Availability error:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}
