import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encryptSecret, generateTotpSecret, totpUri } from "@/lib/twoFactor"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (dbUser.twoFactorEnabled) {
      return NextResponse.json({ error: "Two-factor authentication is already enabled" }, { status: 400 })
    }

    // Re-callable: overwrites any prior unconfirmed secret (twoFactorEnabled is still false).
    const secret = generateTotpSecret()
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { twoFactorSecret: encryptSecret(secret) },
    })

    return NextResponse.json({ secret, otpauthUrl: totpUri(secret, dbUser.email) })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
