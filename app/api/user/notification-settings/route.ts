import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getEffectiveSetting } from "@/lib/notifications"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const CATEGORIES = ["BOOKINGS", "AMENITY", "MAINTENANCE", "URGENT", "GENERAL", "MOVE"] as const

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = (session.user as any).id

  const [settings, user] = await Promise.all([
    Promise.all(
      CATEGORIES.map(async (category) => ({
        category,
        ...(await getEffectiveSetting(userId, category)),
      }))
    ),
    prisma.user.findUnique({ where: { id: userId }, select: { confirmBookingChecks: true } }),
  ])

  return NextResponse.json({ settings, confirmBookingChecks: user?.confirmBookingChecks ?? false })
}

const patchSchema = z.object({
  settings: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
      })
    )
    .min(1),
  confirmBookingChecks: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = (session.user as any).id

  try {
    const { settings, confirmBookingChecks } = patchSchema.parse(await request.json())

    for (const setting of settings) {
      if (setting.category === "URGENT" && (!setting.email || !setting.sms)) {
        return NextResponse.json(
          { error: "Urgent alerts must always be sent by SMS and email." },
          { status: 400 }
        )
      }
    }

    const needsPhone = settings.some((s) => s.sms)
    if (needsPhone) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } })
      if (!user?.phoneNumber) {
        return NextResponse.json(
          { error: "Add a phone number in your profile before enabling SMS notifications." },
          { status: 400 }
        )
      }
    }

    await Promise.all([
      ...settings.map((setting) =>
        prisma.notificationSetting.upsert({
          where: { userId_category: { userId, category: setting.category } },
          create: { userId, category: setting.category, email: setting.email, sms: setting.sms, push: setting.push },
          update: { email: setting.email, sms: setting.sms, push: setting.push },
        })
      ),
      ...(confirmBookingChecks !== undefined
        ? [prisma.user.update({ where: { id: userId }, data: { confirmBookingChecks } })]
        : []),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Update notification settings error:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
