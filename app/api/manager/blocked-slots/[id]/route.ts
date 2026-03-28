import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const manager = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!manager || manager.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const blockedSlotId = params.id

    // Delete the blocked slot
    await prisma.blockedSlot.delete({
      where: { id: blockedSlotId }
    })

    return NextResponse.json({
      success: true,
      message: "Blocked slot removed successfully"
    })

  } catch (error) {
    console.error("Delete blocked slot error:", error)
    return NextResponse.json(
      { error: "Failed to delete blocked slot" },
      { status: 500 }
    )
  }
}
