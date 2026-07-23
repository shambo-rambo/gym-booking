import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import {
  verifyTotp,
  decryptSecret,
  hashBackupCode,
  generateBackupCodes,
  TWO_FACTOR_MAX_ATTEMPTS,
  TWO_FACTOR_LOCKOUT_MS,
} from "@/lib/twoFactor"

export const dynamic = "force-dynamic"

const schema = z.object({ code: z.string().optional(), backupCode: z.string().optional() })

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code, backupCode } = schema.parse(await request.json())
    if (!code && !backupCode) {
      return NextResponse.json({ error: "A code is required" }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!dbUser?.twoFactorEnabled || !dbUser.twoFactorSecret) {
      return NextResponse.json({ error: "Two-factor authentication is not enabled" }, { status: 400 })
    }

    if (dbUser.twoFactorLockedUntil && dbUser.twoFactorLockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
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
      valid = !!match
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
        { error: lockout ? "Too many attempts. Please try again later." : "Invalid code" },
        { status: lockout ? 429 : 401 }
      )
    }

    const newCodes = generateBackupCodes()

    await prisma.$transaction([
      prisma.backupCode.deleteMany({ where: { userId: dbUser.id } }),
      prisma.backupCode.createMany({
        data: newCodes.map((raw) => ({ userId: dbUser.id, codeHash: hashBackupCode(raw) })),
      }),
      prisma.user.update({
        where: { id: dbUser.id },
        data: { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null },
      }),
    ])

    return NextResponse.json({ success: true, backupCodes: newCodes })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("2FA regenerate backup codes error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
