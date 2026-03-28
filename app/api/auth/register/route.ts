import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  apartmentNumber: z.number().min(1).max(65),
  phoneNumber: z.string().optional(),
  notificationPreference: z.enum(["EMAIL_ONLY", "SMS_ONLY", "BOTH"])
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = registerSchema.parse(body)

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Email already registered" },
        { status: 400 }
      )
    }

    // Check if apartment already has 4 verified users
    const apartmentUserCount = await prisma.user.count({
      where: {
        apartmentNumber: validatedData.apartmentNumber,
        status: "VERIFIED"
      }
    })

    if (apartmentUserCount >= 4) {
      return NextResponse.json(
        { success: false, message: "Apartment already has 4 verified users. Please contact management." },
        { status: 400 }
      )
    }

    // Validate phone number format if provided
    if (validatedData.phoneNumber) {
      const phoneRegex = /^\+61\d{9}$/
      if (!phoneRegex.test(validatedData.phoneNumber)) {
        return NextResponse.json(
          { success: false, message: "Invalid Australian phone number format. Use +61XXXXXXXXX" },
          { status: 400 }
        )
      }
    }

    // Validate phone number is required for SMS notifications
    if ((validatedData.notificationPreference === "SMS_ONLY" || validatedData.notificationPreference === "BOTH") && !validatedData.phoneNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required for SMS notifications" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    // Create user with PENDING status
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        apartmentNumber: validatedData.apartmentNumber,
        phoneNumber: validatedData.phoneNumber,
        notificationPreference: validatedData.notificationPreference,
        status: "PENDING",
        role: "RESIDENT"
      }
    })

    // Notify all managers about the new registration
    const managers = await prisma.user.findMany({
      where: { role: "MANAGER" },
      select: { email: true }
    })

    if (resend && managers.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Gym Booking <onboarding@resend.dev>",
        to: managers.map((m) => m.email),
        subject: "New resident registration pending approval",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">New registration pending approval</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Name:</strong> ${user.name}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin: 5px 0;"><strong>Apartment:</strong> ${user.apartmentNumber}</p>
            </div>
            <a href="${appUrl}/manager/users" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Review in Manager Dashboard</a>
          </div>
        `
      }).catch((err) => console.error("[Email] Failed to notify managers:", err))
    } else if (!resend) {
      console.log("[Email - Not Configured] Would notify managers of new registration:", user.email)
    }

    return NextResponse.json({
      success: true,
      message: "Registration successful! Your account is pending manager approval.",
      userId: user.id
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Invalid input data", errors: error.issues },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { success: false, message: "An error occurred during registration" },
      { status: 500 }
    )
  }
}
