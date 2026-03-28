import { prisma } from "./prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { startOfWeek, endOfWeek, addDays } from "date-fns"

export interface ValidationResult {
  allowed: boolean
  reason?: string
}

// Parse a slot time string and date into a full DateTime
export function parseSlotDateTime(date: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

// Get the start of the week (Monday)
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

// Get the end of the week (Sunday)
export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 })
}

// Anti-hoarding validation for exclusive bookings
export async function canBookExclusiveSlot(
  userId: string,
  facilityType: FacilityType,
  date: Date,
  startTime: string,
  duration: number
): Promise<ValidationResult> {

  // Rule 1: Cannot book same timeslot as yesterday (if it would overlap)
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)

  const yesterdayBooking = await prisma.booking.findFirst({
    where: {
      userId,
      facilityType,
      bookingType: BookingType.EXCLUSIVE,
      date: yesterday,
      startTime
    }
  })

  if (yesterdayBooking) {
    // Check if yesterday's booking actually conflicts with today's slot
    // Parse times for overlap calculation
    const [slotHour, slotMinute] = startTime.split(':').map(Number)
    const slotStartMinutes = slotHour * 60 + slotMinute
    const slotEndMinutes = slotStartMinutes + duration

    const [bookingHour, bookingMinute] = yesterdayBooking.startTime.split(':').map(Number)
    const bookingStartMinutes = bookingHour * 60 + bookingMinute
    const bookingEndMinutes = bookingStartMinutes + yesterdayBooking.duration

    // Only block if yesterday's booking would actually overlap with today's slot
    // For example: booking 7am Sat + 1440min ends at 7am Sun, doesn't overlap with 7am Sun slot
    // Overlap check: booking_end > slot_start (on the same day)
    // Since both are on different days, we need to check if the booking extends past midnight
    const bookingExtendsPastMidnight = bookingEndMinutes > 1440 // More than 24 hours (past midnight)

    if (bookingExtendsPastMidnight) {
      // Calculate how far into today the yesterday booking extends
      const minutesIntoToday = bookingEndMinutes - 1440

      // Check if it overlaps with today's slot
      // Yesterday booking (in today's timeline): starts at 0, ends at minutesIntoToday
      // Today's slot: starts at slotStartMinutes, ends at slotEndMinutes
      // Overlap if: 0 < slotEndMinutes AND minutesIntoToday > slotStartMinutes
      const overlaps = minutesIntoToday > slotStartMinutes

      if (overlaps) {
        return {
          allowed: false,
          reason: "You booked this timeslot yesterday. Please choose a different time."
        }
      }
    } else {
      // Yesterday's booking doesn't extend to today, but same start time still blocked
      return {
        allowed: false,
        reason: "You booked this timeslot yesterday. Please choose a different time."
      }
    }
  }

  // Rule 2: Next week's same slot only visible 24h before
  const now = new Date()
  const slotDateTime = parseSlotDateTime(date, startTime)
  const hoursUntilSlot = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  // Check if this is exactly 7 days ahead (using calendar days)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const slotDate = new Date(date)
  slotDate.setHours(0, 0, 0, 0)

  const daysDifference = Math.floor((slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // If it's exactly 7 calendar days ahead AND more than 24 hours away, block it
  if (daysDifference === 7 && hoursUntilSlot > 24) {
    return {
      allowed: false,
      reason: "This slot becomes available 24 hours before the booking time."
    }
  }

  return { allowed: true }
}

// Anti-hoarding validation for shared bookings
export async function canBookSharedSlot(
  userId: string,
  facilityType: FacilityType,
  equipmentType: EquipmentType | null,
  date: Date,
  startTime: string
): Promise<ValidationResult> {

  // Get all bookings for this user in the same week
  const weekStart = getWeekStart(date)
  const weekEnd = getWeekEnd(date)

  const sameSlotBookingsThisWeek = await prisma.booking.findMany({
    where: {
      userId,
      facilityType,
      bookingType: BookingType.SHARED,
      equipmentType, // null for sauna, specific equipment for gym
      startTime,
      date: {
        gte: weekStart,
        lte: weekEnd
      }
    }
  })

  if (sameSlotBookingsThisWeek.length >= 3) {
    return {
      allowed: false,
      reason: "You've already booked this timeslot 3 times this week. Try a different time."
    }
  }

  return { allowed: true }
}

// Check user booking limits
export async function checkBookingLimits(
  userId: string,
  bookingType: BookingType,
  facilityType: FacilityType
): Promise<ValidationResult> {

  const now = new Date()
  now.setHours(0, 0, 0, 0) // Start of today

  if (bookingType === BookingType.EXCLUSIVE) {
    const count = await prisma.booking.count({
      where: {
        userId,
        facilityType,
        bookingType: BookingType.EXCLUSIVE,
        date: { gte: now }
      }
    })

    const limit = 3
    if (count >= limit) {
      return {
        allowed: false,
        reason: `You have ${limit} active exclusive ${facilityType.toLowerCase()} bookings (limit reached).`
      }
    }
  } else {
    // Shared bookings - count across all facilities
    const count = await prisma.booking.count({
      where: {
        userId,
        bookingType: BookingType.SHARED,
        date: { gte: now }
      }
    })

    const limit = 5
    if (count >= limit) {
      return {
        allowed: false,
        reason: `You have ${limit} active shared bookings (limit reached).`
      }
    }
  }

  return { allowed: true }
}

// Check slot capacity
export async function isSlotAvailable(
  facilityType: FacilityType,
  bookingType: BookingType,
  equipmentType: EquipmentType | null,
  date: Date,
  startTime: string,
  duration: number
): Promise<ValidationResult> {

  // Check if slot is blocked
  const blocked = await prisma.blockedSlot.findFirst({
    where: {
      facilityType,
      date,
      startTime,
      duration
    }
  })

  if (blocked) {
    return { allowed: false, reason: blocked.reason }
  }

  // Get all bookings for this facility on this date
  const allBookings = await prisma.booking.findMany({
    where: { facilityType, date }
  })

  // Parse requested slot time for overlap calculation
  const [slotHour, slotMinute] = startTime.split(':').map(Number)
  const slotStartMinutes = slotHour * 60 + slotMinute
  const slotEndMinutes = slotStartMinutes + duration

  // Filter for bookings that overlap with the requested time slot
  // A booking overlaps if: booking_start < slot_end AND booking_end > slot_start
  const existingBookings = allBookings.filter(b => {
    const [bookingHour, bookingMinute] = b.startTime.split(':').map(Number)
    const bookingStartMinutes = bookingHour * 60 + bookingMinute
    const bookingEndMinutes = bookingStartMinutes + b.duration

    return bookingStartMinutes < slotEndMinutes && bookingEndMinutes > slotStartMinutes
  })

  // Check if there's an exclusive booking (blocks everything)
  const hasExclusiveBooking = existingBookings.some(
    b => b.bookingType === BookingType.EXCLUSIVE
  )

  if (hasExclusiveBooking) {
    return { allowed: false, reason: "Slot has an exclusive booking." }
  }

  if (bookingType === BookingType.EXCLUSIVE) {
    // If we're trying to book exclusive, any existing booking blocks it
    if (existingBookings.length > 0) {
      return { allowed: false, reason: "Slot is already booked." }
    }
  } else {
    // Shared booking
    if (facilityType === FacilityType.SAUNA) {
      if (existingBookings.length >= 2) {
        return { allowed: false, reason: "Sauna is full (2 people max)." }
      }
    } else {
      // Gym shared
      if (existingBookings.length >= 2) {
        return { allowed: false, reason: "Gym is full (2 people max)." }
      }

      // Check if this specific equipment is taken
      const equipmentBooked = existingBookings.some(
        b => b.equipmentType === equipmentType
      )
      if (equipmentBooked) {
        return { allowed: false, reason: "This equipment is already booked." }
      }
    }
  }

  return { allowed: true }
}

// Validate booking time constraints
export function validateBookingTime(
  date: Date,
  startTime: string,
  duration: number
): ValidationResult {
  const now = new Date()
  const slotDateTime = parseSlotDateTime(date, startTime)

  // Cannot book in the past
  if (slotDateTime < now) {
    return {
      allowed: false,
      reason: "Cannot book a slot in the past."
    }
  }

  // Cannot book more than 7 days in advance (using calendar days)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const slotDate = new Date(date)
  slotDate.setHours(0, 0, 0, 0)

  const daysDifference = Math.floor((slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDifference > 7) {
    return {
      allowed: false,
      reason: "Cannot book more than 7 days in advance."
    }
  }

  // Check operating hours (5am to 10pm)
  const [hours, minutes] = startTime.split(':').map(Number)

  if (hours < 5) {
    return {
      allowed: false,
      reason: "Facilities open at 5:00 AM."
    }
  }

  // Check end time doesn't go past 10pm
  const endMinutes = hours * 60 + minutes + duration
  const endHours = Math.floor(endMinutes / 60)

  if (endHours > 22 || (endHours === 22 && endMinutes % 60 > 0)) {
    return {
      allowed: false,
      reason: "Facilities close at 10:00 PM. This booking would end after closing."
    }
  }

  // Validate duration (must be 30 or 60)
  if (duration !== 30 && duration !== 60) {
    return {
      allowed: false,
      reason: "Duration must be 30 or 60 minutes."
    }
  }

  return { allowed: true }
}

// Generate all time slots for a day (5am to 10pm in 30-minute intervals)
export function generateTimeSlots(): string[] {
  const slots: string[] = []

  for (let hour = 5; hour <= 21; hour++) {
    // Add hour:00 slot
    slots.push(`${hour.toString().padStart(2, '0')}:00`)

    // Add hour:30 slot if not the last hour (21:30 is the last valid start time for 30min slot)
    if (hour < 22) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
  }

  return slots
}
