import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import {
  generateTimeSlots,
  canBookExclusiveSlot,
  canBookSharedSlot,
  parseSlotDateTime
} from "@/lib/booking-rules"
import { parseLocalDate } from "@/lib/date-utils"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const facilityType = searchParams.get("facilityType") as FacilityType
    const dateStr = searchParams.get("date")

    if (!facilityType || !dateStr) {
      return NextResponse.json(
        { error: "facilityType and date are required" },
        { status: 400 }
      )
    }

    const date = parseLocalDate(dateStr)
    const userId = (session.user as any).id

    // Check if this date is more than 7 days in advance
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    const slotDate = new Date(date)
    slotDate.setHours(0, 0, 0, 0)

    const daysDifference = Math.floor((slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const isBeyond7Days = daysDifference > 7

    const timeSlots = generateTimeSlots()

    // Get all bookings for this facility on this date
    const existingBookings = await prisma.booking.findMany({
      where: {
        facilityType,
        date
      }
    })

    // Get all blocked slots for this facility on this date
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: {
        facilityType,
        date
      }
    })

    // Get queue counts
    const queueEntries = await prisma.queueEntry.findMany({
      where: {
        facilityType,
        date
      }
    })

    // Process each time slot
    const slots = await Promise.all(
      timeSlots.map(async (startTime) => {
        // Check both 30 and 60 minute durations
        const durations = [30, 60]

        const durationAvailability = await Promise.all(
          durations.map(async (duration) => {
            // Check if blocked
            const isBlocked = blockedSlots.some(
              b => b.startTime === startTime && b.duration === duration
            )

            // Parse slot start time for overlap calculation
            const [slotHour, slotMinute] = startTime.split(':').map(Number)
            const slotStartMinutes = slotHour * 60 + slotMinute
            const slotEndMinutes = slotStartMinutes + duration

            // Get bookings that overlap with this time slot
            // A booking overlaps if: booking_start < slot_end AND booking_end > slot_start
            const slotBookings = existingBookings.filter(b => {
              const [bookingHour, bookingMinute] = b.startTime.split(':').map(Number)
              const bookingStartMinutes = bookingHour * 60 + bookingMinute
              const bookingEndMinutes = bookingStartMinutes + b.duration

              // Check for overlap
              return bookingStartMinutes < slotEndMinutes && bookingEndMinutes > slotStartMinutes
            })

            // Check if user has a booking here
            // Two cases:
            // 1. User's booking starts at this exact time and duration
            // 2. User's booking started earlier but extends into this slot (for visual continuity)
            const userBookingStartsHere = existingBookings.find(
              b => b.userId === userId && b.startTime === startTime && b.duration === duration
            )

            // Check if user's booking from an earlier slot extends into this one
            const userBookingExtendsHere = !userBookingStartsHere && existingBookings.find(b => {
              if (b.userId !== userId) return false

              const [bookingHour, bookingMinute] = b.startTime.split(':').map(Number)
              const bookingStartMinutes = bookingHour * 60 + bookingMinute
              const bookingEndMinutes = bookingStartMinutes + b.duration

              // User's booking extends into this slot if:
              // - It started before this slot starts
              // - It ends after this slot starts (i.e., overlaps)
              return bookingStartMinutes < slotStartMinutes && bookingEndMinutes > slotStartMinutes
            })

            const userBooking = userBookingStartsHere || userBookingExtendsHere

            // Count queue entries that should display on this slot
            const queueCount = queueEntries.filter(q => {
              // Only show queue entries that START at this time
              // A 60-min entry at 6:00 shows on both 6:00 slots (30-min and 60-min)
              // and on 6:30 30-min slot (the second half)
              if (q.startTime === startTime) {
                return true
              }

              // For 30-min slots, also show if a longer queue entry started earlier and extends here
              if (duration === 30) {
                const [qHour, qMinute] = q.startTime.split(':').map(Number)
                const queueStartMinutes = qHour * 60 + qMinute
                const queueEndMinutes = queueStartMinutes + q.duration

                // Queue entry extends into this slot if it started before and ends after slot starts
                return queueStartMinutes < slotStartMinutes && queueEndMinutes > slotStartMinutes
              }

              return false
            }).length

            // Check if user has a queue entry here
            // Two cases:
            // 1. User's queue entry starts at this exact time and duration
            // 2. User's queue entry started earlier but extends into this slot (for visual continuity)
            const userQueueEntryStartsHere = queueEntries.find(
              q => q.userId === userId && q.startTime === startTime && q.duration === duration
            )

            // Check if user's queue entry from an earlier slot extends into this one
            const userQueueEntryExtendsHere = !userQueueEntryStartsHere && queueEntries.find(q => {
              if (q.userId !== userId) return false

              const [queueHour, queueMinute] = q.startTime.split(':').map(Number)
              const queueStartMinutes = queueHour * 60 + queueMinute
              const queueEndMinutes = queueStartMinutes + q.duration

              // User's queue entry extends into this slot if:
              // - It started before this slot starts
              // - It ends after this slot starts (i.e., overlaps)
              return queueStartMinutes < slotStartMinutes && queueEndMinutes > slotStartMinutes
            })

            const userQueueEntry = userQueueEntryStartsHere || userQueueEntryExtendsHere

            // Check if there's an exclusive booking (blocks everything)
            const hasExclusiveBooking = slotBookings.some(
              b => b.bookingType === BookingType.EXCLUSIVE
            )

            // Check exclusive availability
            let exclusiveAvailable = "available"
            let exclusiveReason = ""

            if (isBeyond7Days) {
              exclusiveAvailable = "blocked"
              exclusiveReason = "Cannot book more than 7 days in advance."
            } else if (isBlocked) {
              exclusiveAvailable = "blocked"
              const blocked = blockedSlots.find(
                b => b.startTime === startTime && b.duration === duration
              )
              exclusiveReason = blocked?.reason || "Blocked"
            } else if (slotBookings.length > 0) {
              exclusiveAvailable = "booked"
            } else {
              // Check anti-hoarding rules for user
              const canBook = await canBookExclusiveSlot(
                userId,
                facilityType,
                date,
                startTime,
                duration
              )
              if (!canBook.allowed) {
                exclusiveAvailable = "unavailable"
                exclusiveReason = canBook.reason || ""
              }
            }

            // Check shared availability (for gym equipment and sauna)
            let sharedAvailability: any = {}

            if (facilityType === FacilityType.GYM) {
              // Check each equipment
              const equipmentTypes = [
                EquipmentType.WEIGHTS_MACHINE,
                EquipmentType.FREE_DUMBBELLS,
                EquipmentType.TREADMILL,
                EquipmentType.ROWING_MACHINE,
                EquipmentType.EXERCISE_BIKE
              ]

              for (const equipment of equipmentTypes) {
                const equipmentBooked = slotBookings.some(
                  b => b.equipmentType === equipment
                )

                if (isBeyond7Days) {
                  sharedAvailability[equipment] = "blocked"
                } else if (isBlocked) {
                  sharedAvailability[equipment] = "blocked"
                } else if (hasExclusiveBooking) {
                  // If someone booked exclusive, no one else can book
                  sharedAvailability[equipment] = "booked"
                } else if (equipmentBooked) {
                  sharedAvailability[equipment] = "booked"
                } else if (slotBookings.length >= 2) {
                  // Gym is full (2 people max)
                  sharedAvailability[equipment] = "full"
                } else {
                  // Check anti-hoarding for shared
                  const canBook = await canBookSharedSlot(
                    userId,
                    facilityType,
                    equipment,
                    date,
                    startTime
                  )
                  sharedAvailability[equipment] = canBook.allowed
                    ? "available"
                    : "unavailable"
                }
              }
            } else if (facilityType === FacilityType.SAUNA) {
              // Shared sauna availability
              if (isBeyond7Days) {
                sharedAvailability.capacity = "blocked"
              } else if (isBlocked) {
                sharedAvailability.capacity = "blocked"
              } else if (hasExclusiveBooking) {
                // If someone booked exclusive, no one else can book
                sharedAvailability.capacity = "booked"
              } else if (slotBookings.length >= 2) {
                sharedAvailability.capacity = "full"
              } else {
                const canBook = await canBookSharedSlot(
                  userId,
                  facilityType,
                  null,
                  date,
                  startTime
                )
                sharedAvailability.capacity = canBook.allowed
                  ? "available"
                  : "unavailable"
              }
            }

            // For display: only count bookings that START at this exact time
            // Don't count bookings that just overlap from earlier times
            const bookingsStartingHere = existingBookings.filter(
              b => b.startTime === startTime && b.duration === duration
            )

            return {
              duration,
              exclusive: {
                status: exclusiveAvailable,
                reason: exclusiveReason
              },
              shared: sharedAvailability,
              userBooking: userBooking
                ? {
                    id: userBooking.id,
                    bookingType: userBooking.bookingType,
                    equipmentType: userBooking.equipmentType
                  }
                : null,
              userQueueEntry: userQueueEntry
                ? {
                    id: userQueueEntry.id,
                    bookingType: userQueueEntry.bookingType,
                    equipmentType: userQueueEntry.equipmentType,
                    position: userQueueEntry.position
                  }
                : null,
              queueCount,
              bookedCount: bookingsStartingHere.length  // Only count bookings starting here
            }
          })
        )

        return {
          startTime,
          durations: durationAvailability
        }
      })
    )

    return NextResponse.json({
      date: dateStr,
      facilityType,
      slots
    })
  } catch (error) {
    console.error("Availability error:", error)
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    )
  }
}
