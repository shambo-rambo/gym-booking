import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashTrustedDeviceToken, TRUSTED_DEVICE_COOKIE } from "@/lib/twoFactor"
import { refreshSessionToken } from "@/lib/sessionToken"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rawToken = request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value
  if (!rawToken) {
    return NextResponse.json({ trusted: false })
  }

  const userId = (session.user as any).id
  const tokenHash = hashTrustedDeviceToken(rawToken)

  const device = await prisma.trustedDevice.findFirst({
    where: { userId, tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
  })

  if (!device) {
    const res = NextResponse.json({ trusted: false })
    res.cookies.delete(TRUSTED_DEVICE_COOKIE)
    return res
  }

  await prisma.$transaction([
    prisma.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { twoFactorVerifiedAt: new Date() } }),
  ])

  const res = NextResponse.json({ trusted: true })
  await refreshSessionToken(request, res, { twoFactorVerified: true })
  return res
}
