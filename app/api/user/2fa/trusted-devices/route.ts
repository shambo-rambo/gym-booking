import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const devices = await prisma.trustedDevice.findMany({
    where: {
      userId: (session.user as any).id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userAgent: true, createdAt: true, expiresAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ devices })
}
