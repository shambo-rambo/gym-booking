import { prisma } from "./prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { startOfWeek, endOfWeek } from "date-fns"

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 })
}

export interface ValidationResult {
  allowed: boolean
  reason?: string
}

export function parseSlotDateTime(date: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Rule 1: No same start time on consecutive days (shared or exclusive)
export async function checkConsecutiveDays(
  userId: string,
  facilityType: FacilityType,
  date: Date,
  startTime: string
): Promise<ValidationResult> {
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)

  const clash = await prisma.booking.findFirst({
    where: { userId, facilityType, date: yesterday, startTime }
  })

  if (clash) {
    return {
      allowed: false,
      reason: "You have this time slot booked yesterday. Please choose a different time."
    }
  }

  return { allowed: true }
}

// Rule 2: Max 1 hour of wall-clock time per facility per day
// Uses interval union so multiple shared equipment bookings at the same time count once
export async function checkDailyLimit(
  userId: string,
  facilityType: FacilityType,
  date: Date,
  startTime: string,
  duration: number
): Promise<ValidationResult> {
  const existing = await prisma.booking.findMany({
    where: { userId, facilityType, date }
  })

  const intervals: [number, number][] = [
    ...existing.map(b => [toMinutes(b.startTime), toMinutes(b.startTime) + b.duration] as [number, number]),
    [toMinutes(startTime), toMinutes(startTime) + duration],
  ]

  intervals.sort((a, b) => a[0] - b[0])

  let total = 0
  let curStart = intervals[0][0]
  let curEnd = intervals[0][1]

  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i]
    if (s < curEnd) {
      curEnd = Math.max(curEnd, e)
    } else {
      total += curEnd - curStart
      curStart = s
      curEnd = e
    }
  }
  total += curEnd - curStart

  if (total > 60) {
    return {
      allowed: false,
      reason: "You've reached your 1-hour daily limit for this facility."
    }
  }

  return { allowed: true }
}

// Rule 3: Max 3 upcoming sessions per facility
// A "session" is a distinct (date, startTime) pair — multiple equipment bookings at the same time count as one
export async function checkSessionLimit(
  userId: string,
  facilityType: FacilityType
): Promise<ValidationResult> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const upcomingSessions = await prisma.booking.findMany({
    where: { userId, facilityType, date: { gte: now } },
    distinct: ['date', 'startTime'],
    select: { date: true, startTime: true }
  })

  if (upcomingSessions.length >= 3) {
    return {
      allowed: false,
      reason: `You already have 3 upcoming ${facilityType.toLowerCase()} sessions booked (limit reached).`
    }
  }

  return { allowed: true }
}

// Check slot capacity and blocked slots
export async function isSlotAvailable(
  facilityType: FacilityType,
  bookingType: BookingType,
  equipmentType: EquipmentType | null,
  date: Date,
  startTime: string,
  duration: number
): Promise<ValidationResult> {
  const blocked = await prisma.blockedSlot.findFirst({
    where: { facilityType, date, startTime, duration }
  })

  if (blocked) {
    return { allowed: false, reason: blocked.reason }
  }

  const allBookings = await prisma.booking.findMany({
    where: { facilityType, date }
  })

  const [slotHour, slotMinute] = startTime.split(':').map(Number)
  const slotStart = slotHour * 60 + slotMinute
  const slotEnd = slotStart + duration

  const overlapping = allBookings.filter(b => {
    const [bh, bm] = b.startTime.split(':').map(Number)
    const bStart = bh * 60 + bm
    const bEnd = bStart + b.duration
    return bStart < slotEnd && bEnd > slotStart
  })

  const hasExclusive = overlapping.some(b => b.bookingType === BookingType.EXCLUSIVE)
  if (hasExclusive) {
    return { allowed: false, reason: "Slot has an exclusive booking." }
  }

  if (bookingType === BookingType.EXCLUSIVE) {
    if (overlapping.length > 0) {
      return { allowed: false, reason: "Slot is already booked." }
    }
  } else if (facilityType === FacilityType.SAUNA) {
    if (overlapping.length >= 2) {
      return { allowed: false, reason: "Sauna is full (2 people max)." }
    }
  } else {
    // Gym shared — max 2 distinct people, plus per equipment type
    const distinctUsers = new Set(overlapping.map(b => b.userId)).size
    if (distinctUsers >= 2) {
      return { allowed: false, reason: "Gym is full (2 people max)." }
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

  if (slotDateTime < now) {
    return { allowed: false, reason: "Cannot book a slot in the past." }
  }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const slotDate = new Date(date)
  slotDate.setHours(0, 0, 0, 0)
  const daysDiff = Math.floor((slotDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff > 7) {
    return { allowed: false, reason: "Cannot book more than 7 days in advance." }
  }

  const [hours, minutes] = startTime.split(':').map(Number)

  if (hours < 6) {
    return { allowed: false, reason: "Facilities open at 6:00 AM." }
  }

  const endMinutes = hours * 60 + minutes + duration
  const endHours = Math.floor(endMinutes / 60)
  if (endHours > 23 || (endHours === 23 && endMinutes % 60 > 0)) {
    return { allowed: false, reason: "Facilities close at 11:00 PM. This booking would end after closing." }
  }

  if (duration !== 30 && duration !== 60) {
    return { allowed: false, reason: "Duration must be 30 or 60 minutes." }
  }

  return { allowed: true }
}

// Generate all time slots for a day (5am to 10:30pm in 30-minute intervals)
export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 5; hour <= 22; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`)
    slots.push(`${hour.toString().padStart(2, '0')}:30`)
  }
  return slots
}
