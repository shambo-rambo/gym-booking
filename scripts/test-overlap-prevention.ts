#!/usr/bin/env npx tsx
/**
 * Test script to verify overlapping booking prevention
 */

import { PrismaClient, FacilityType, BookingType, EquipmentType } from '@prisma/client'
import { parseLocalDate } from '../lib/date-utils'
import { isSlotAvailable } from '../lib/booking-rules'

const prisma = new PrismaClient()

async function testOverlapPrevention() {
  console.log('\n=== Testing Overlap Prevention ===\n')

  const dateStr = '2026-01-25'
  const date = parseLocalDate(dateStr)
  const user1Id = 'cmkf9trny0002hw9i02sdqrd6'

  // Clean up
  await prisma.booking.deleteMany({
    where: {
      date,
      startTime: { in: ['09:00', '09:30'] }
    }
  })

  // Create a 60-minute exclusive booking at 09:00 (covers 09:00-10:00)
  const booking = await prisma.booking.create({
    data: {
      userId: user1Id,
      facilityType: FacilityType.GYM,
      bookingType: BookingType.EXCLUSIVE,
      date,
      startTime: '09:00',
      duration: 60
    }
  })

  console.log('Created 60-min booking at 09:00 (covers 09:00-10:00)')

  // Test 1: Try to book 09:00 for 30 minutes - should be blocked
  const test1 = await isSlotAvailable(
    FacilityType.GYM,
    BookingType.SHARED,
    EquipmentType.TREADMILL,
    date,
    '09:00',
    30
  )

  console.log(`\nTest 1 - Book 09:00 for 30 min (exact start match):`)
  console.log(`  Allowed: ${test1.allowed}`)
  console.log(`  ${test1.allowed ? '✗ FAIL' : '✓ PASS'} - Should be blocked`)
  if (test1.reason) console.log(`  Reason: ${test1.reason}`)

  // Test 2: Try to book 09:30 for 30 minutes - should be blocked (overlaps with 09:00-10:00 booking)
  const test2 = await isSlotAvailable(
    FacilityType.GYM,
    BookingType.SHARED,
    EquipmentType.TREADMILL,
    date,
    '09:30',
    30
  )

  console.log(`\nTest 2 - Book 09:30 for 30 min (overlaps with existing 60-min):`)
  console.log(`  Allowed: ${test2.allowed}`)
  console.log(`  ${test2.allowed ? '✗ FAIL' : '✓ PASS'} - Should be blocked`)
  if (test2.reason) console.log(`  Reason: ${test2.reason}`)

  // Test 3: Try to book 10:00 for 30 minutes - should be allowed (no overlap)
  const test3 = await isSlotAvailable(
    FacilityType.GYM,
    BookingType.SHARED,
    EquipmentType.TREADMILL,
    date,
    '10:00',
    30
  )

  console.log(`\nTest 3 - Book 10:00 for 30 min (no overlap):`)
  console.log(`  Allowed: ${test3.allowed}`)
  console.log(`  ${test3.allowed ? '✓ PASS' : '✗ FAIL'} - Should be allowed`)
  if (test3.reason) console.log(`  Reason: ${test3.reason}`)

  // Test 4: Try to book 08:30 for 60 minutes - should be blocked (would end at 09:30, overlapping with 09:00-10:00)
  const test4 = await isSlotAvailable(
    FacilityType.GYM,
    BookingType.SHARED,
    EquipmentType.TREADMILL,
    date,
    '08:30',
    60
  )

  console.log(`\nTest 4 - Book 08:30 for 60 min (would overlap 09:00-10:00):`)
  console.log(`  Allowed: ${test4.allowed}`)
  console.log(`  ${test4.allowed ? '✗ FAIL' : '✓ PASS'} - Should be blocked`)
  if (test4.reason) console.log(`  Reason: ${test4.reason}`)

  // Test 5: Try to book 08:00 for 30 minutes - should be allowed (ends at 08:30, no overlap)
  const test5 = await isSlotAvailable(
    FacilityType.GYM,
    BookingType.SHARED,
    EquipmentType.TREADMILL,
    date,
    '08:00',
    30
  )

  console.log(`\nTest 5 - Book 08:00 for 30 min (ends at 08:30, no overlap):`)
  console.log(`  Allowed: ${test5.allowed}`)
  console.log(`  ${test5.allowed ? '✓ PASS' : '✗ FAIL'} - Should be allowed`)
  if (test5.reason) console.log(`  Reason: ${test5.reason}`)

  // Clean up
  await prisma.booking.delete({ where: { id: booking.id } })

  const allPassed = !test1.allowed && !test2.allowed && test3.allowed && !test4.allowed && test5.allowed

  console.log('\n' + '='.repeat(60))
  if (allPassed) {
    console.log('\x1b[32m✓ All overlap prevention tests PASSED!\x1b[0m')
  } else {
    console.log('\x1b[31m✗ Some overlap prevention tests FAILED!\x1b[0m')
  }
  console.log('='.repeat(60) + '\n')

  return allPassed
}

async function main() {
  try {
    const passed = await testOverlapPrevention()
    process.exit(passed ? 0 : 1)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
