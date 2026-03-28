import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  expiresAt: z.string().optional(),
  sendEmail: z.boolean().default(false)
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get active announcements (not expired)
    const now = new Date()
    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      include: {
        creator: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      announcements
    })

  } catch (error) {
    console.error("Get announcements error:", error)
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
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
    const validatedData = createAnnouncementSchema.parse(body)

    // Create announcement
    const announcement = await prisma.announcement.create({
      data: {
        title: validatedData.title,
        message: validatedData.message,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        createdBy: manager.id
      }
    })

    if (validatedData.sendEmail) {
      const verifiedUsers = await prisma.user.findMany({
        where: {
          status: "VERIFIED",
          notificationPreference: { in: ["EMAIL_ONLY", "BOTH"] }
        },
        select: { email: true }
      })

      if (resend && verifiedUsers.length > 0) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        // Send in batches of 50 to stay within API limits
        const batchSize = 50
        for (let i = 0; i < verifiedUsers.length; i += batchSize) {
          const batch = verifiedUsers.slice(i, i + batchSize).map((u) => u.email)
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "Gym Booking <onboarding@resend.dev>",
            to: batch,
            subject: `Announcement: ${announcement.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">${announcement.title}</h2>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p style="white-space: pre-wrap; margin: 0;">${announcement.message}</p>
                </div>
                ${announcement.expiresAt ? `<p style="color: #6b7280; font-size: 14px;">This announcement expires on ${new Date(announcement.expiresAt).toLocaleDateString()}.</p>` : ""}
                <a href="${appUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Go to Booking App</a>
              </div>
            `
          }).catch((err) => console.error("[Email] Failed to send announcement batch:", err))
        }
        console.log(`[Email] Announcement sent to ${verifiedUsers.length} users`)
      } else if (!resend) {
        console.log(`[Email - Not Configured] Would send announcement to ${verifiedUsers.length} users`)
      }
    }

    return NextResponse.json({
      success: true,
      announcement
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Create announcement error:", error)
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    )
  }
}
