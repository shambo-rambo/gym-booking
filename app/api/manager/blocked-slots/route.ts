import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { sendNotification } from "@/lib/notifications"
import { format } from "date-fns"
import { parseLocalDate } from "@/lib/date-utils"

const createBlockedSlotSchema = z.object({
  facilityType: z.enum(["GYM", "SAUNA"]),
  date: z.string(),
  startTime: z.string(),
  duration: z.number(),
  reason: z.string(),
  recurring: z.boolean().default(false),
  cancelExisting: z.boolean().default(false)
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user || user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all blocked slots (future dates)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: {
        date: { gte: now }
      },
      include: {
        creator: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    })

    return NextResponse.json({
      blockedSlots
    })

  } catch (error) {
    console.error("Get blocked slots error:", error)
    return NextResponse.json(
      { error: "Failed to fetch blocked slots" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const manager = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createBlockedSlotSchema.parse(body)

    const date = parseLocalDate(validatedData.date)

    // Check if there are existing bookings
    const existingBookings = await prisma.booking.findMany({
      where: {
        facilityType: validatedData.facilityType as any,
        date,
        startTime: validatedData.startTime,
        duration: validatedData.duration
      },
      include: {
        user: true
      }
    })

    if (existingBookings.length > 0 && !validatedData.cancelExisting) {
      return NextResponse.json({
        error: "Existing bookings found",
        conflictingBookings: existingBookings
      }, { status: 409 })
    }

    // Create blocked slot
    const blockedSlot = await prisma.blockedSlot.create({
      data: {
        facilityType: validatedData.facilityType as any,
        date,
        startTime: validatedData.startTime,
        duration: validatedData.duration,
        reason: validatedData.reason,
        recurring: validatedData.recurring,
        createdBy: manager.id
      }
    })

    // Cancel existing bookings if requested
    if (validatedData.cancelExisting && existingBookings.length > 0) {
      for (const booking of existingBookings) {
        await prisma.booking.delete({
          where: { id: booking.id }
        })

        // Notify user
        await sendNotification(booking.user, 'BOOKING_CANCELLED_BY_ADMIN', {
          facilityType: booking.facilityType.toString(),
          date: format(booking.date, 'EEEE, MMMM d, yyyy'),
          startTime: booking.startTime,
          reason: `Facility blocked: ${validatedData.reason}`
        })
      }
    }

    return NextResponse.json({
      success: true,
      blockedSlot
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Create blocked slot error:", error)
    return NextResponse.json(
      { error: "Failed to create blocked slot" },
      { status: 500 }
    )
  }
}
