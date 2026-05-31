import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Resend } from "resend"
import { VALID_UNITS } from "@/lib/apartments"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  apartmentNumber: z.number().refine((n) => VALID_UNITS.has(n), {
    message: "That unit number isn't recognised. Please check and try again.",
  }),
  buildingCode: z.string().optional(),
  notificationPreference: z.enum(["EMAIL_ONLY", "SMS_ONLY", "BOTH"]).default("EMAIL_ONLY"),
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Email already registered" },
        { status: 400 }
      )
    }

    const apartmentUserCount = await prisma.user.count({
      where: {
        apartmentNumber: validatedData.apartmentNumber,
        status: "VERIFIED",
      },
    })
    if (apartmentUserCount >= 6) {
      return NextResponse.json(
        { success: false, message: "That unit already has 6 registered residents. Please contact management." },
        { status: 400 }
      )
    }

    const buildingCode = process.env.BUILDING_CODE
    const codeCorrect =
      buildingCode &&
      validatedData.buildingCode?.trim().toLowerCase() === buildingCode.trim().toLowerCase()

    const status = codeCorrect ? "VERIFIED" : "PENDING"

    const hashedPassword = await bcrypt.hash(validatedData.password, 10)

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        apartmentNumber: validatedData.apartmentNumber,
        notificationPreference: "EMAIL_ONLY",
        status,
        role: "RESIDENT",
      },
    })

    // Notify managers of all new registrations
    const managers = await prisma.user.findMany({
      where: { role: "MANAGER" },
      select: { email: true },
    })

    if (resend && managers.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const isPending = status === "PENDING"
      await resend.emails
        .send({
          from: process.env.RESEND_FROM_EMAIL || "Gym Booking <onboarding@resend.dev>",
          to: managers.map((m) => m.email),
          subject: isPending
            ? "New resident registration pending approval"
            : "New resident registered",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">${isPending ? "New registration pending approval" : "New resident registered"}</h2>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Name:</strong> ${escapeHtml(user.name)}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${escapeHtml(user.email)}</p>
                <p style="margin: 5px 0;"><strong>Unit:</strong> ${user.apartmentNumber}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> ${isPending ? "Pending approval" : "Auto-verified"}</p>
              </div>
              <a href="${appUrl}/manager/users" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View in Manager Dashboard</a>
            </div>
          `,
        })
        .catch((err) => console.error("[Email] Failed to notify managers:", err))
    }

    return NextResponse.json({
      success: true,
      verified: status === "VERIFIED",
      message:
        status === "VERIFIED"
          ? "You're all set! You can log in now."
          : "Registration received. A manager will approve your account shortly.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message ?? "Invalid input data" },
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
