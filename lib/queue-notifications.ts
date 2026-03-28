import { prisma } from "./prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { sendNotification } from "./notifications"
import { format } from "date-fns"

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
