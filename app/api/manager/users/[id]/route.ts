import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendNotification } from "@/lib/notifications"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const updateUserSchema = z.object({
  status: z.enum(["VERIFIED", "DEACTIVATED"])
})

const editUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  apartmentNumber: z.number().int().min(1).max(9999),
  phoneNumber: z.string().nullable().optional(),
  residencyType: z.enum(["TENANT", "OWNER_OCCUPIER", "NON_RESIDENT_OWNER"]).nullable().optional(),
  fobNumber: z.string().nullable().optional(),
  notificationPreference: z.enum(["EMAIL_ONLY", "SMS_ONLY", "BOTH"]).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is manager
    const manager = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const userId = params.id
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: validatedData.status }
    })

    // If verifying, send welcome notification
    if (validatedData.status === "VERIFIED" && user.status === "PENDING") {
      sendNotification(updatedUser, 'ACCOUNT_VERIFIED', {}).catch(err => console.error('[Users] Notification failed:', err))
    }

    // If deactivating, cancel all their bookings
    if (validatedData.status === "DEACTIVATED") {
      const now = new Date()
      await prisma.booking.deleteMany({
        where: {
          userId,
          date: { gte: now }
        }
      })
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Update user error:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const data = editUserSchema.parse(body)

    const conflict = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: params.id } }
    })
    if (conflict) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    if (
      (data.notificationPreference === "SMS_ONLY" || data.notificationPreference === "BOTH") &&
      !data.phoneNumber
    ) {
      return NextResponse.json(
        { error: "A phone number is required to enable text notifications" },
        { status: 400 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: data.name,
        email: data.email,
        apartmentNumber: data.apartmentNumber,
        phoneNumber: data.phoneNumber ?? null,
        residencyType: data.residencyType ?? null,
        fobNumber: data.fobNumber ?? null,
        notificationPreference: data.notificationPreference,
      }
    })

    return NextResponse.json({ success: true, user: updatedUser })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Edit user error:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
