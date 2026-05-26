import { prisma } from "./prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { sendNotification } from "./notifications"
import { format } from "date-fns"
import { isSlotAvailable } from "./booking-rules"

/**
 * Notify the next person in queue when a slot becomes available
 * Sets their notifiedAt and expiresAt (30 minutes to claim)
 */
export async function notifyNextInQueue(
  facilityType: FacilityType,
  bookingType: BookingType,
  equipmentType: EquipmentType | null,
  date: Date,
  startTime: string,
  duration: number
) {
  // Find the first person in queue for this exact slot
  const nextInQueue = await prisma.queueEntry.findFirst({
    where: {
      facilityType,
      bookingType,
      equipmentType,
      date,
      startTime,
      duration,
      notifiedAt: null // Not yet notified
    },
    orderBy: { position: 'asc' },
    include: {
      user: true
    }
  })

  if (!nextInQueue) {
    // No one in queue
    return null
  }

  // Set their notification time and expiry (30 minutes from now)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes

  const updated = await prisma.queueEntry.update({
    where: { id: nextInQueue.id },
    data: {
      notifiedAt: now,
      expiresAt
    }
  })

  // Send notification
  await sendNotification(nextInQueue.user, 'QUEUE_SLOT_AVAILABLE', {
    facilityType: facilityType.toString(),
    equipmentType: equipmentType?.toString(),
    date: format(date, 'yyyy-MM-dd'),
    startTime,
    duration,
    claimUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/queue`
  })

  console.log(`Notified user ${nextInQueue.user.email} about available slot`)

  return updated
}

/**
 * Expire queue claims that haven't been claimed within the 30-minute window
 * Notify the next person in line
 */
export async function expireUnclaimedQueueSlots() {
  const now = new Date()

  // Find all expired queue entries
  const expiredEntries = await prisma.queueEntry.findMany({
    where: {
      notifiedAt: { not: null },
      expiresAt: { lte: now }
    }
  })

  for (const entry of expiredEntries) {
    // Delete the expired entry
    await prisma.queueEntry.delete({
      where: { id: entry.id }
    })

    console.log(`Expired queue entry for user ${entry.userId}`)

    // Notify the next person in queue
    await notifyNextInQueue(
      entry.facilityType,
      entry.bookingType,
      entry.equipmentType,
      entry.date,
      entry.startTime,
      entry.duration
    )
  }

  return expiredEntries.length
}

/**
 * 3-hour rule: if a slot is still available 3 hours before it starts and
 * someone is in the waitlist queue for it, notify the first person so they
 * can claim it. Runs once per hour via cron.
 */
export async function releaseWaitlistedSlots() {
  const now = new Date()

  // Notify for any unnotified slot starting in the future within 3.5 hours.
  // Previously this was a narrow 2.5–3.5h band; widening to the full window ensures
  // entries created after the band already passed are still caught on the next cron run.
  const windowEnd = new Date(now.getTime() + 3.5 * 60 * 60 * 1000)

  // Find unnotified queue entries — we'll filter by slot time in code
  const pendingEntries = await prisma.queueEntry.findMany({
    where: { notifiedAt: null },
    orderBy: { position: 'asc' },
  })

  // Deduplicate to one notification per unique slot
  const notified = new Set<string>()
  let releasedCount = 0

  for (const entry of pendingEntries) {
    const slotKey = `${entry.facilityType}|${entry.bookingType}|${entry.equipmentType ?? ''}|${entry.date.toISOString()}|${entry.startTime}|${entry.duration}`
    if (notified.has(slotKey)) continue

    // Reconstruct slot datetime (matches how validateBookingTime works)
    const [h, m] = entry.startTime.split(':').map(Number)
    const slotDateTime = new Date(entry.date)
    slotDateTime.setHours(h, m, 0, 0)

    if (slotDateTime <= now || slotDateTime > windowEnd) continue

    // Only release if the slot is still genuinely available
    const availability = await isSlotAvailable(
      entry.facilityType,
      entry.bookingType,
      entry.equipmentType,
      entry.date,
      entry.startTime,
      entry.duration
    )

    if (!availability.allowed) continue

    notified.add(slotKey)
    await notifyNextInQueue(
      entry.facilityType,
      entry.bookingType,
      entry.equipmentType,
      entry.date,
      entry.startTime,
      entry.duration
    )
    releasedCount++
    console.log(`[3hr release] Notified queue for ${entry.facilityType} ${entry.date.toISOString()} ${entry.startTime}`)
  }

  return releasedCount
}
