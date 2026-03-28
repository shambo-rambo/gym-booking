import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { z } from "zod"
import { isSlotAvailable, canBookExclusiveSlot, canBookSharedSlot } from "@/lib/booking-rules"
import { parseLocalDate } from "@/lib/date-utils"

const joinQueueSchema = z.object({
  facilityType: z.enum(["GYM", "SAUNA"]),
  bookingType: z.enum(["EXCLUSIVE", "SHARED"]),
  equipmentType: z.enum([
    "WEIGHTS_MACHINE",
    "FREE_DUMBBELLS",
    "TREADMILL",
    "ROWING_MACHINE",
    "EXERCISE_BIKE"
  ]).optional(),
  date: z.string(),
  startTime: z.string(),
  duration: z.number().refine(d => d === 30 || d === 60)
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

    // Check if slot is physically available (not full)
    const slotAvailability = await isSlotAvailable(
      facilityType as FacilityType,
      bookingType as BookingType,
      equipmentType as EquipmentType || null,
      date,
      startTime,
      duration
    )

    // Check anti-hoarding rules for this user
    let antiHoardingCheck
    if (bookingType === BookingType.EXCLUSIVE) {
      antiHoardingCheck = await canBookExclusiveSlot(
        userId,
        facilityType as FacilityType,
        date,
        startTime,
        duration
      )
    } else {
      antiHoardingCheck = await canBookSharedSlot(
        userId,
        facilityType as FacilityType,
        equipmentType as EquipmentType || null,
        date,
        startTime
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

    // Check if user already in queue for this exact slot
    const existingQueueEntry = await prisma.queueEntry.findFirst({
      where: {
        userId,
        facilityType: facilityType as FacilityType,
        bookingType: bookingType as BookingType,
        equipmentType: equipmentType as EquipmentType || null,
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

    // Check if user already has a booking at this time
    const existingBooking = await prisma.booking.findFirst({
      where: {
        userId,
        facilityType: facilityType as FacilityType,
        date,
        startTime,
        duration
      }
    })

    if (existingBooking) {
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
        bookingType: bookingType as BookingType,
        equipmentType: equipmentType as EquipmentType || null,
        date,
        startTime,
        duration
      },
      orderBy: { position: 'asc' }
    })

    let newPosition
    const canUserBook = antiHoardingCheck.allowed

    if (canUserBook) {
      // User CAN book - find the last position among users who can also book
      // They should be ahead of users who are blocked by anti-hoarding
      let lastCanBookPosition = 0

      for (const entry of allQueueEntries) {
        // Check if this queue entry user can book
        let entryCanBook
        if (bookingType === BookingType.EXCLUSIVE) {
          entryCanBook = await canBookExclusiveSlot(
            entry.userId,
            facilityType as FacilityType,
            date,
            startTime,
            duration
          )
        } else {
          entryCanBook = await canBookSharedSlot(
            entry.userId,
            facilityType as FacilityType,
            equipmentType as EquipmentType || null,
            date,
            startTime
          )
        }

        if (entryCanBook.allowed) {
          lastCanBookPosition = entry.position
        }
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
          bookingType: bookingType as BookingType,
          equipmentType: equipmentType as EquipmentType || null,
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
        bookingType: bookingType as BookingType,
        equipmentType: equipmentType as EquipmentType || null,
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
