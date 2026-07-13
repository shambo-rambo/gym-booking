import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // NoticeRecipient rows cascade-delete with the Announcement (onDelete: Cascade
    // in the schema), so this also removes it from every resident's feed.
    await prisma.announcement.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete notice error:", error)
    return NextResponse.json({ error: "Failed to delete notice" }, { status: 500 })
  }
}
