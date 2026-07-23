import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const device = await prisma.trustedDevice.findUnique({ where: { id: params.id } })
  if (!device || device.userId !== (session.user as any).id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.trustedDevice.update({ where: { id: params.id }, data: { revokedAt: new Date() } })

  return NextResponse.json({ success: true })
}
