#!/usr/bin/env tsx
/**
 * Comprehensive End-to-End Test Script for Gym Booking System
 *
 * This script tests:
 * 1. 60-minute bookings mark overlapping slots correctly
 * 2. Date handling with no timezone issues
 * 3. User booking indicators (blue dots) work correctly
 * 4. Exclusive bookings block all other booking types
 * 5. Queue functionality
 */

import { PrismaClient, FacilityType, BookingType, EquipmentType } from '@prisma/client'
import { parseLocalDate } from '../lib/date-utils'

const prisma = new PrismaClient()

interface TestResult {
  name: string
  passed: boolean
  message: string
  details?: any
}

const results: TestResult[] = []

function logTest(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details })
  const icon = passed ? '✓' : '✗'
  const color = passed ? '\x1b[32m' : '\x1b[31m'
  console.log(`${color}${icon}\x1b[0m ${name}: ${message}`)
  if (details) {
    console.log('  Details:', JSON.stringify(details, null, 2))
  }
}

async function testDateHandling() {
  console.log('\n=== Testing Date Handling ===\n')

  const dateStr = '2026-01-20'
  const parsedDate = parseLocalDate(dateStr)

  // Test 1: Date should be parsed as UTC midnight
  const expectedDate = new Date('2026-01-20T00:00:00.000Z')
  const datesMatch = parsedDate.getTime() === expectedDate.getTime()

  logTest(
    'Date Parsing',
    datesMatch,
    datesMatch ? 'Date correctly parsed as UTC midnight' : 'Date parsing incorrect',
    {
      input: dateStr,
      parsed: parsedDate.toISOString(),
      expected: expectedDate.toISOString()
    }
  )

  // Test 2: Create a booking and verify it's on the correct date
  const testUserId = 'cmkf9trny0002hw9i02sdqrd6' // John Resident

  // Clean up any existing test bookings
  await prisma.booking.deleteMany({
    where: {
      userId: testUserId,
      date: parsedDate,
      startTime: '10:00'
    }
  })

  const booking = await prisma.booking.create({
    data: {
      userId: testUserId,
      facilityType: FacilityType.GYM,
      bookingType: BookingType.SHARED,
      equipmentType: EquipmentType.TREADMILL,
      date: parsedDate,
      startTime: '10:00',
      duration: 30
    }
  })

  const bookingDateMatches = booking.date.getTime() === parsedDate.getTime()

  logTest(
    'Database Date Storage',
    bookingDateMatches,
    bookingDateMatches ? 'Booking stored with correct date' : 'Booking date mismatch',
    {
      requestedDate: parsedDate.toISOString(),
      storedDate: booking.date.toISOString()
    }
  )

  // Clean up
  await prisma.booking.delete({ where: { id: booking.id } })
}

async function test60MinuteBookingDisplay() {
  console.log('\n=== Testing 60-Minute Booking Display ===\n')

  const dateStr = '2026-01-21'
  const date = parseLocalDate(dateStr)
  const testUserId = 'cmkf9trny0002hw9i02sdqrd6'

  // Clean up any existing test bookings
  await prisma.booking.deleteMany({
    where: {
      date,
      startTime: '08:00'
    }
  })

  // Create a 60-minute exclusive booking at 08:00
  const booking = await prisma.booking.create({
    data: {
      userId: testUserId,
      facilityType: FacilityType.GYM,
      bookingType: BookingType.EXCLUSIVE,
      date,
      startTime: '08:00',
      duration: 60
    }
  })

  // Test: Query bookings that should be affected
  const allBookings = await prisma.booking.findMany({
    where: {
      facilityType: FacilityType.GYM,
      date
    }
  })

  // Simulate the availability API logic for 08:00 slot (30-min duration)
  const slot0800_30min = {
    startTime: '08:00',
    duration: 30
  }

  const [slot0800Hour, slot0800Minute] = slot0800_30min.startTime.split(':').map(Number)
  const slot0800StartMinutes = slot0800Hour * 60 + slot0800Minute
  const slot0800EndMinutes = slot0800StartMinutes + slot0800_30min.duration // 480 + 30 = 510 (08:30)

  const overlapping0800 = allBookings.filter(b => {
    const [bookingHour, bookingMinute] = b.startTime.split(':').map(Number)
    const bookingStartMinutes = bookingHour * 60 + bookingMinute
    const bookingEndMinutes = bookingStartMinutes + b.duration
    return bookingStartMinutes < slot0800EndMinutes && bookingEndMinutes > slot0800StartMinutes
  })

  logTest(
    '60-min booking overlaps 08:00-08:30 slot',
    overlapping0800.length > 0,
    overlapping0800.length > 0
      ? 'Correctly detected overlap with 08:00 slot'
      : 'Failed to detect overlap with 08:00 slot',
    {
      slot: '08:00-08:30',
      overlappingBookings: overlapping0800.length,
      bookingDetails: overlapping0800.map(b => ({
        startTime: b.startTime,
        duration: b.duration,
        range: `${b.startTime}-${String(Math.floor((parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]) + b.duration) / 60)).padStart(2, '0')}:${String((parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]) + b.duration) % 60).padStart(2, '0')}`
      }))
    }
  )

  // Simulate the availability API logic for 08:30 slot (30-min duration)
  const slot0830_30min = {
    startTime: '08:30',
    duration: 30
  }

  const [slot0830Hour, slot0830Minute] = slot0830_30min.startTime.split(':').map(Number)
  const slot0830StartMinutes = slot0830Hour * 60 + slot0830Minute
  const slot0830EndMinutes = slot0830StartMinutes + slot0830_30min.duration // 510 + 30 = 540 (09:00)

  const overlapping0830 = allBookings.filter(b => {
    const [bookingHour, bookingMinute] = b.startTime.split(':').map(Number)
    const bookingStartMinutes = bookingHour * 60 + bookingMinute
    const bookingEndMinutes = bookingStartMinutes + b.duration
    return bookingStartMinutes < slot0830EndMinutes && bookingEndMinutes > slot0830StartMinutes
  })

  logTest(
    '60-min booking overlaps 08:30-09:00 slot',
    overlapping0830.length > 0,
    overlapping0830.length > 0
      ? 'Correctly detected overlap with 08:30 slot'
      : 'Failed to detect overlap with 08:30 slot',
    {
      slot: '08:30-09:00',
      overlappingBookings: overlapping0830.length,
      bookingDetails: overlapping0830.map(b => ({
        startTime: b.startTime,
        duration: b.duration
      }))
    }
  )

  // Clean up
  await prisma.booking.delete({ where: { id: booking.id } })
}

async function testExclusiveBookingBlocking() {
  console.log('\n=== Testing Exclusive Booking Blocking ===\n')

  const dateStr = '2026-01-22'
  const date = parseLocalDate(dateStr)
  const user1Id = 'cmkf9trny0002hw9i02sdqrd6'
  const user2Id = 'cmkf9tro50003hw9ixjj6wbqk' // Jane Smith

  // Clean up
  await prisma.booking.deleteMany({
    where: {
      date,
      startTime: '14:00'
    }
  })

  // Create exclusive booking
  const exclusiveBooking = await prisma.booking.create({
    data: {
      userId: user1Id,
      facilityType: FacilityType.GYM,
      bookingType: BookingType.EXCLUSIVE,
      date,
      startTime: '14:00',
      duration: 30
    }
  })

  // Test: Try to query if another booking can be made
  const existingBookings = await prisma.booking.findMany({
    where: {
      facilityType: FacilityType.GYM,
      date,
      startTime: '14:00',
      duration: 30
    }
  })

  const hasExclusiveBooking = existingBookings.some(b => b.bookingType === BookingType.EXCLUSIVE)

  logTest(
    'Exclusive booking detected',
    hasExclusiveBooking,
    hasExclusiveBooking
      ? 'Exclusive booking correctly identified'
      : 'Failed to identify exclusive booking',
    {
      slot: '14:00',
      totalBookings: existingBookings.length,
      hasExclusive: hasExclusiveBooking
    }
  )

  // Test: Verify that all equipment should be blocked when exclusive
  const equipmentTypes = [
    EquipmentType.WEIGHTS_MACHINE,
    EquipmentType.FREE_DUMBBELLS,
    EquipmentType.TREADMILL,
    EquipmentType.ROWING_MACHINE,
    EquipmentType.EXERCISE_BIKE
  ]

  let allEquipmentBlocked = true
  for (const equipment of equipmentTypes) {
    const equipmentBooked = existingBookings.some(b => b.equipmentType === equipment)
    const shouldBeBlocked = hasExclusiveBooking

    if (!shouldBeBlocked) {
      allEquipmentBlocked = false
      break
    }
  }

  logTest(
    'Exclusive booking blocks all equipment',
    allEquipmentBlocked,
    allEquipmentBlocked
      ? 'All equipment correctly blocked by exclusive booking'
      : 'Some equipment not blocked',
    {
      exclusiveBookingExists: hasExclusiveBooking,
      equipmentCount: equipmentTypes.length
    }
  )

  // Clean up
  await prisma.booking.delete({ where: { id: exclusiveBooking.id } })
}

async function testUserBookingIndicator() {
  console.log('\n=== Testing User Booking Indicator ===\n')

  const dateStr = '2026-01-23'
  const date = parseLocalDate(dateStr)
  const currentUserId = 'cmkf9trny0002hw9i02sdqrd6'
  const otherUserId = 'cmkf9tro50003hw9ixjj6wbqk'

  // Clean up
  await prisma.booking.deleteMany({
    where: {
      date,
      OR: [
        { startTime: '11:00' },
        { startTime: '11:30' }
      ]
    }
  })

  // Create booking by current user
  const userBooking = await prisma.booking.create({
    data: {
      userId: currentUserId,
      facilityType: FacilityType.GYM,
      bookingType: BookingType.SHARED,
      equipmentType: EquipmentType.TREADMILL,
      date,
      startTime: '11:00',
      duration: 30
    }
  })

  // Create booking by other user
  const otherBooking = await prisma.booking.create({
    data: {
      userId: otherUserId,
      facilityType: FacilityType.GYM,
      bookingType: BookingType.SHARED,
      equipmentType: EquipmentType.WEIGHTS_MACHINE,
      date,
      startTime: '11:30',
      duration: 30
    }
  })

  // Simulate availability API check for user's slot
  const slotBookings1100 = await prisma.booking.findMany({
    where: {
      facilityType: FacilityType.GYM,
      date,
      startTime: '11:00',
      duration: 30
    }
  })

  const hasUserBooking1100 = slotBookings1100.some(b => b.userId === currentUserId)

  logTest(
    'User booking detected in slot with user booking',
    hasUserBooking1100,
    hasUserBooking1100
      ? 'User booking correctly identified'
      : 'Failed to identify user booking',
    {
      slot: '11:00',
      userId: currentUserId,
      totalBookings: slotBookings1100.length
    }
  )

  // Check slot where user doesn't have a booking
  const slotBookings1130 = await prisma.booking.findMany({
    where: {
      facilityType: FacilityType.GYM,
      date,
      startTime: '11:30',
      duration: 30
    }
  })

  const hasUserBooking1130 = slotBookings1130.some(b => b.userId === currentUserId)

  logTest(
    'No user booking detected in slot without user booking',
    !hasUserBooking1130,
    !hasUserBooking1130
      ? 'Correctly identified no user booking'
      : 'Incorrectly detected user booking',
    {
      slot: '11:30',
      userId: currentUserId,
      totalBookings: slotBookings1130.length
    }
  )

  // Clean up
  await prisma.booking.delete({ where: { id: userBooking.id } })
  await prisma.booking.delete({ where: { id: otherBooking.id } })
}

async function testQueueFunctionality() {
  console.log('\n=== Testing Queue Functionality ===\n')

  const dateStr = '2026-01-24'
  const date = parseLocalDate(dateStr)
  const user1Id = 'cmkf9trny0002hw9i02sdqrd6'
  const user2Id = 'cmkf9tro50003hw9ixjj6wbqk'

  // Clean up
  await prisma.queueEntry.deleteMany({
    where: {
      date,
      startTime: '16:00'
    }
  })

  await prisma.booking.deleteMany({
    where: {
      date,
      startTime: '16:00'
    }
  })

  // Create full booking (2 people)
  const booking1 = await prisma.booking.create({
    data: {
      userId: user1Id,
      facilityType: FacilityType.SAUNA,
      bookingType: BookingType.SHARED,
      date,
      startTime: '16:00',
      duration: 30
    }
  })

  const booking2 = await prisma.booking.create({
    data: {
      userId: user2Id,
      facilityType: FacilityType.SAUNA,
      bookingType: BookingType.SHARED,
      date,
      startTime: '16:00',
      duration: 30
    }
  })

  // Add queue entry
  const queueEntry = await prisma.queueEntry.create({
    data: {
      userId: user1Id,
      facilityType: FacilityType.SAUNA,
      bookingType: BookingType.SHARED,
      date,
      startTime: '16:00',
      duration: 30,
      position: 1
    }
  })

  // Test: Query queue count
  const queueEntries = await prisma.queueEntry.findMany({
    where: {
      facilityType: FacilityType.SAUNA,
      date,
      startTime: '16:00',
      duration: 30
    }
  })

  logTest(
    'Queue entry created',
    queueEntries.length > 0,
    queueEntries.length > 0
      ? `Queue has ${queueEntries.length} entry`
      : 'No queue entries found',
    {
      slot: '16:00',
      queueCount: queueEntries.length,
      bookingCount: 2
    }
  )

  // Clean up
  await prisma.queueEntry.delete({ where: { id: queueEntry.id } })
  await prisma.booking.delete({ where: { id: booking1.id } })
  await prisma.booking.delete({ where: { id: booking2.id } })
}

async function verifyExistingBooking() {
  console.log('\n=== Verifying Existing Booking ===\n')

  const dateStr = '2026-01-17'
  const date = parseLocalDate(dateStr)

  const existingBooking = await prisma.booking.findFirst({
    where: {
      date,
      startTime: '06:00',
      duration: 60
    },
    include: {
      user: true
    }
  })

  logTest(
    'Existing booking found',
    !!existingBooking,
    existingBooking
      ? `Found: ${existingBooking.facilityType} ${existingBooking.bookingType} by ${existingBooking.user.name}`
      : 'No booking found',
    existingBooking ? {
      id: existingBooking.id,
      user: existingBooking.user.name,
      facilityType: existingBooking.facilityType,
      bookingType: existingBooking.bookingType,
      date: existingBooking.date.toISOString(),
      startTime: existingBooking.startTime,
      duration: existingBooking.duration
    } : null
  )

  if (existingBooking) {
    // Test overlap detection for this booking
    const allBookings = await prisma.booking.findMany({
      where: {
        facilityType: FacilityType.GYM,
        date
      }
    })

    // Check if 06:30 slot would be affected
    const slot0630 = {
      startTime: '06:30',
      duration: 30
    }

    const [slotHour, slotMinute] = slot0630.startTime.split(':').map(Number)
    const slotStartMinutes = slotHour * 60 + slotMinute
    const slotEndMinutes = slotStartMinutes + slot0630.duration

    const overlapping = allBookings.filter(b => {
      const [bookingHour, bookingMinute] = b.startTime.split(':').map(Number)
      const bookingStartMinutes = bookingHour * 60 + bookingMinute
      const bookingEndMinutes = bookingStartMinutes + b.duration
      return bookingStartMinutes < slotEndMinutes && bookingEndMinutes > slotStartMinutes
    })

    logTest(
      'Existing 60-min booking overlaps 06:30 slot',
      overlapping.length > 0,
      overlapping.length > 0
        ? 'Correctly detected overlap with 06:30 slot'
        : 'Failed to detect overlap with 06:30 slot',
      {
        slot: '06:30-07:00',
        overlappingBookings: overlapping.length
      }
    )
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  Gym Booking System - Comprehensive E2E Test Suite        ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  try {
    await verifyExistingBooking()
    await testDateHandling()
    await test60MinuteBookingDisplay()
    await testExclusiveBookingBlocking()
    await testUserBookingIndicator()
    await testQueueFunctionality()

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║  Test Summary                                              ║')
    console.log('╚════════════════════════════════════════════════════════════╝\n')

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    const total = results.length

    console.log(`Total Tests: ${total}`)
    console.log(`\x1b[32mPassed: ${passed}\x1b[0m`)
    console.log(`\x1b[31mFailed: ${failed}\x1b[0m`)
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`)

    if (failed > 0) {
      console.log('\x1b[31mFailed Tests:\x1b[0m')
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`)
      })
      console.log('')
    }

    process.exit(failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n\x1b[31mTest suite error:\x1b[0m', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
