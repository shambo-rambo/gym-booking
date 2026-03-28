import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSettingsSchema = z.object({
  notificationPreference: z.enum(["EMAIL_ONLY", "SMS_ONLY", "BOTH"]),
  phoneNumber: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        phoneNumber: true,
        notificationPreference: true,
        apartmentNumber: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)

  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const validatedData = updateSettingsSchema.parse(body)

    // Validate phone number if SMS is enabled
    if (
      (validatedData.notificationPreference === "SMS_ONLY" ||
       validatedData.notificationPreference === "BOTH") &&
      !validatedData.phoneNumber
    ) {
      return NextResponse.json(
        { error: "Phone number is required for SMS notifications" },
        { status: 400 }
      )
    }

    // Validate phone number format if provided
    if (validatedData.phoneNumber) {
      const phoneRegex = /^\+61\d{9}$/
      if (!phoneRegex.test(validatedData.phoneNumber)) {
        return NextResponse.json(
          { error: "Invalid Australian phone number format. Use +61XXXXXXXXX" },
          { status: 400 }
        )
      }
    }

    // Update user settings
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreference: validatedData.notificationPreference,
        phoneNumber: validatedData.phoneNumber || null
      },
      select: {
        email: true,
        name: true,
        phoneNumber: true,
        notificationPreference: true,
        apartmentNumber: true
      }
    })

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

    console.error("Update settings error:", error)
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    )
  }
}
