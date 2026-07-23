import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import {
  verifyTotp,
  decryptSecret,
  hashBackupCode,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_MAX_AGE_SECONDS,
  TWO_FACTOR_MAX_ATTEMPTS,
  TWO_FACTOR_LOCKOUT_MS,
} from "@/lib/twoFactor"
import { refreshSessionToken } from "@/lib/sessionToken"

export const dynamic = "force-dynamic"

const schema = z.object({
  code: z.string().optional(),
  backupCode: z.string().optional(),
  trustDevice: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code, backupCode, trustDevice } = schema.parse(await request.json())
    if (!code && !backupCode) {
      return NextResponse.json({ error: "A code is required" }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!dbUser?.twoFactorEnabled || !dbUser.twoFactorSecret) {
      return NextResponse.json({ error: "Two-factor authentication is not enabled" }, { status: 400 })
    }

    if (dbUser.twoFactorLockedUntil && dbUser.twoFactorLockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later.", locked: true },
        { status: 429 }
      )
    }

    let valid = false
    if (code) {
      valid = verifyTotp(decryptSecret(dbUser.twoFactorSecret), code)
    } else if (backupCode) {
      const codeHash = hashBackupCode(backupCode)
      const match = await prisma.backupCode.findFirst({
        where: { userId: dbUser.id, codeHash, usedAt: null },
      })
      if (match) {
        await prisma.backupCode.update({ where: { id: match.id }, data: { usedAt: new Date() } })
        valid = true
      }
    }

    if (!valid) {
      const attempts = dbUser.twoFactorFailedAttempts + 1
      const lockout = attempts >= TWO_FACTOR_MAX_ATTEMPTS
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          twoFactorFailedAttempts: lockout ? 0 : attempts,
          twoFactorLockedUntil: lockout ? new Date(Date.now() + TWO_FACTOR_LOCKOUT_MS) : null,
        },
      })
      return NextResponse.json(
        {
          error: lockout ? "Too many attempts. Please try again later." : "Invalid code",
          locked: lockout,
          attemptsRemaining: lockout ? 0 : TWO_FACTOR_MAX_ATTEMPTS - attempts,
        },
        { status: lockout ? 429 : 401 }
      )
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null, twoFactorVerifiedAt: new Date() },
    })

    const res = NextResponse.json({ success: true })
    await refreshSessionToken(request, res, { twoFactorVerified: true })

    if (trustDevice) {
      const rawToken = generateTrustedDeviceToken()
      await prisma.trustedDevice.create({
        data: {
          userId: dbUser.id,
          tokenHash: hashTrustedDeviceToken(rawToken),
          userAgent: request.headers.get("user-agent") ?? undefined,
          expiresAt: new Date(Date.now() + TRUSTED_DEVICE_MAX_AGE_SECONDS * 1000),
        },
      })
      res.cookies.set(TRUSTED_DEVICE_COOKIE, rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
      })
    }

    return res
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("2FA verify-login error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
