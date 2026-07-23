import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { verifyTotp, decryptSecret, generateBackupCodes, hashBackupCode } from "@/lib/twoFactor"
import { refreshSessionToken } from "@/lib/sessionToken"

export const dynamic = "force-dynamic"

const schema = z.object({ code: z.string().min(6).max(6) })

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code } = schema.parse(await request.json())

    const dbUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!dbUser?.twoFactorSecret) {
      return NextResponse.json({ error: "Start setup first" }, { status: 400 })
    }
    if (dbUser.twoFactorEnabled) {
      return NextResponse.json({ error: "Two-factor authentication is already enabled" }, { status: 400 })
    }

    if (!verifyTotp(decryptSecret(dbUser.twoFactorSecret), code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 401 })
    }

    const backupCodes = generateBackupCodes()

    await prisma.$transaction([
      prisma.user.update({
        where: { id: dbUser.id },
        data: {
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date(),
          twoFactorVerifiedAt: new Date(),
          twoFactorFailedAttempts: 0,
          twoFactorLockedUntil: null,
        },
      }),
      prisma.backupCode.createMany({
        data: backupCodes.map((raw) => ({ userId: dbUser.id, codeHash: hashBackupCode(raw) })),
      }),
    ])

    const res = NextResponse.json({ success: true, backupCodes })
    await refreshSessionToken(request, res, {
      twoFactorEnabled: true,
      twoFactorVerified: true,
      twoFactorSetupRequired: false,
    })
    return res
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("2FA enable error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
