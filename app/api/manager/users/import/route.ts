import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { VALID_UNITS } from "@/lib/apartments"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const rowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  apartmentNumber: z.number().int().refine((n) => VALID_UNITS.has(n), {
    message: "Unit number isn't recognised",
  }),
  mobile: z.string().optional().nullable(),
  residencyType: z.enum(["TENANT", "OWNER_OCCUPIER", "NON_RESIDENT_OWNER"], {
    error: "residencyType must be TENANT, OWNER_OCCUPIER, or NON_RESIDENT_OWNER",
  }),
  fobNumber: z.string().optional().nullable(),
})

const importSchema = z.object({
  rows: z.array(rowSchema).min(1),
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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      // Report every row's error, keyed by row number, so nothing partially imports.
      const errors = parsed.error.issues.map((issue) => ({
        row: typeof issue.path[0] === "number" ? issue.path[0] + 1 : null,
        message: issue.message,
      }))
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    const { rows } = parsed.data

    const emails = rows.map((r) => r.email.toLowerCase())
    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    })
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Some emails are already registered", details: existing.map((e) => e.email) },
        { status: 409 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const created: { email: string; name: string }[] = []
    const defaultPasswordHash = await bcrypt.hash("watertower", 10)

    for (const row of rows) {
      const user = await prisma.user.create({
        data: {
          email: row.email.toLowerCase(),
          password: defaultPasswordHash,
          mustChangePassword: true,
          name: row.name,
          apartmentNumber: row.apartmentNumber,
          phoneNumber: row.mobile || null,
          residencyType: row.residencyType,
          fobNumber: row.fobNumber || null,
          notificationPreference: "EMAIL_ONLY",
          status: "VERIFIED",
          role: "RESIDENT",
        },
      })

      if (resend) {
        await resend.emails
          .send({
            from: process.env.RESEND_FROM_EMAIL || "The Watertower <onboarding@resend.dev>",
            to: user.email,
            subject: "Welcome to The Watertower",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Welcome, ${escapeHtml(user.name)}!</h2>
                <p>Your building manager has set up your account for The Watertower (Unit ${user.apartmentNumber}).</p>
                <p>Log in with your email and this temporary password: <strong>watertower</strong></p>
                <p>You'll be asked to set your own password the first time you log in.</p>
                <a href="${appUrl}/login" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Log in</a>
              </div>
            `,
          })
          .catch((err) => console.error("[Email] Failed to send import welcome:", err))
      }

      created.push({ email: user.email, name: user.name })
    }

    return NextResponse.json({ success: true, created })
  } catch (error) {
    console.error("Import users error:", error)
    return NextResponse.json({ error: "Failed to import residents" }, { status: 500 })
  }
}
