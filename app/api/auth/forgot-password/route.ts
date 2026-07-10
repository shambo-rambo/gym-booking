import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { Resend } from "resend"
import crypto from "crypto"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const { email } = schema.parse(await request.json())

    // Always return success to avoid revealing whether an email is registered
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, password: true },
    })

    if (user && !user.password) {
      // Google sign-in account — no password exists, let them know
      if (resend) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        await resend.emails
          .send({
            from: process.env.RESEND_FROM_EMAIL || "The Watertower <onboarding@resend.dev>",
            to: email,
            subject: "Sign in with Google",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Your account uses Google sign-in</h2>
                <p>Hi ${user.name.replace(/</g, "&lt;")},</p>
                <p>You requested a password reset, but your account is linked to Google — there's no password to reset.</p>
                <p>Head back and use the "Continue with Google" button to sign in.</p>
                <a href="${appUrl}/login" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Go to sign in</a>
                <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          })
          .catch((err) => console.error("[Email] Failed to send Google account notice:", err))
      }
    } else if (user?.password) {
      // Credentials account — generate reset token
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

      const rawToken = crypto.randomBytes(32).toString("hex")
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

      if (resend) {
        await resend.emails
          .send({
            from: process.env.RESEND_FROM_EMAIL || "The Watertower <onboarding@resend.dev>",
            to: email,
            subject: "Reset your password",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Reset your password</h2>
                <p>Hi ${user.name.replace(/</g, "&lt;")},</p>
                <p>Click the button below to reset your password. This link expires in 1 hour.</p>
                <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset password</a>
                <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          })
          .catch((err) => console.error("[Email] Failed to send password reset:", err))
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }
    console.error("Forgot password error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
