import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (!manager || manager.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const fob = await prisma.fob.findUnique({ where: { id: params.id } })
  if (!fob) {
    return NextResponse.json({ error: "Fob not found" }, { status: 404 })
  }

  await prisma.fob.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
