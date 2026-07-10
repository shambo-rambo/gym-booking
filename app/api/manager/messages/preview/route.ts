import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveNoticeRecipients } from "@/lib/notice-targeting"
import { z } from "zod"

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

    // Email can't be opted out of for building notices (it's the channel of record for
    // things like AGM votes) — residents can only opt out of SMS. So every recipient is
    // email-eligible; SMS eligibility still depends on their preference + having a phone.
    const recipientDetails = recipients
      .map((u) => ({
        id: u.id,
        name: u.name,
        apartmentNumber: u.apartmentNumber,
        smsEligible: !!u.phoneNumber && (forceSms || u.notificationPreference === "SMS_ONLY" || u.notificationPreference === "BOTH"),
      }))
      .sort((a, b) => a.apartmentNumber - b.apartmentNumber)

    const smsEligible = recipientDetails.filter((u) => u.smsEligible).length

    return NextResponse.json({
      total: recipients.length,
      smsEligible,
      smsForced: forceSms,
      recipients: recipientDetails,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    console.error("Message preview error:", error)
    return NextResponse.json({ error: "Failed to preview recipients" }, { status: 500 })
  }
}
