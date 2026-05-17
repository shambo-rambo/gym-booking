import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { Resend } from "resend"
import { VALID_UNITS } from "@/lib/apartments"

export const dynamic = 'force-dynamic'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const onboardingSchema = z.object({
  apartmentNumber: z.number().int().refine((n) => VALID_UNITS.has(n), {
    message: "That unit number isn't recognised. Please check and try again.",
  }),
  buildingCode: z.string().min(1, "Building code is required"),
  phoneNumber: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!(session.user as any).needsOnboarding) {
      return NextResponse.json({ error: "Already onboarded" }, { status: 400 })
    }

    const body = await request.json()
    const validated = onboardingSchema.parse(body)

    // Check building code
    const buildingCode = process.env.BUILDING_CODE
    const codeCorrect =
      buildingCode &&
      validated.buildingCode.trim().toLowerCase() === buildingCode.trim().toLowerCase()

    if (!codeCorrect) {
      return NextResponse.json(
        { error: "Invalid building code. Contact your building manager." },
        { status: 400 }
      )
    }

    // Check unit capacity
    const apartmentUserCount = await prisma.user.count({
      where: { apartmentNumber: validated.apartmentNumber, status: "VERIFIED" },
    })
    if (apartmentUserCount >= 4) {
      return NextResponse.json(
        { error: "That unit already has 4 registered residents. Please contact management." },
        { status: 400 }
      )
    }

    if (validated.phoneNumber) {
      const phoneRegex = /^\+61\d{9}$/
      if (!phoneRegex.test(validated.phoneNumber)) {
        return NextResponse.json(
          { error: "Invalid Australian phone number format. Use +61XXXXXXXXX" },
          { status: 400 }
        )
      }
    }

    // Check email not already taken (e.g. if they had a credentials account)
    const existing = await prisma.user.findUnique({
      where: { email: session.user.email },
    })
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 }
      )
    }

    await prisma.user.create({
      data: {
        email: session.user.email,
        name: session.user.name ?? session.user.email.split("@")[0],
        password: null,
        apartmentNumber: validated.apartmentNumber,
        phoneNumber: validated.phoneNumber ?? null,
        notificationPreference: "EMAIL_ONLY",
        status: "VERIFIED",
        role: "RESIDENT",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Onboarding error:", error)
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 })
  }
}
