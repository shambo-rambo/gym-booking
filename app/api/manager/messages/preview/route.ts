import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveNoticeRecipients } from "@/lib/notice-targeting"
import { z } from "zod"

const SMS_COST_ESTIMATE = 0.06 // AUD per message, matches the ClickSend fallback estimate in lib/notifications.ts

const previewSchema = z.object({
  targetType: z.enum(["ALL", "RESIDENCY", "FLOOR", "APARTMENT"]),
  targetValues: z.array(z.string()).default([]),
  category: z.enum(["AMENITY", "MAINTENANCE", "URGENT", "GENERAL"]).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { targetType, targetValues, category } = previewSchema.parse(await request.json())
    const recipients = await resolveNoticeRecipients(targetType, targetValues)
    const forceSms = category === "URGENT"

    const emailEligible = recipients.filter(
      (u) => u.notificationPreference === "EMAIL_ONLY" || u.notificationPreference === "BOTH"
    ).length
    const smsEligible = recipients.filter(
      (u) => u.phoneNumber && (forceSms || u.notificationPreference === "SMS_ONLY" || u.notificationPreference === "BOTH")
    ).length

    return NextResponse.json({
      total: recipients.length,
      emailEligible,
      smsEligible,
      smsForced: forceSms,
      estimatedSmsCost: Math.round(smsEligible * SMS_COST_ESTIMATE * 100) / 100,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    console.error("Message preview error:", error)
    return NextResponse.json({ error: "Failed to preview recipients" }, { status: 500 })
  }
}
