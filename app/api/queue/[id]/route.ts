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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = (session.user as any).id
    const queueEntryId = params.id

    // Get the queue entry
    const queueEntry = await prisma.queueEntry.findUnique({
      where: { id: queueEntryId }
    })

    if (!queueEntry) {
      return NextResponse.json(
        { error: "Queue entry not found" },
        { status: 404 }
      )
    }

    // Check ownership
    if (queueEntry.userId !== userId) {
      return NextResponse.json(
        { error: "You can only leave your own queue entries" },
        { status: 403 }
      )
    }

    // Delete the queue entry and update positions of others
    await prisma.$transaction(async (tx) => {
      // Delete this entry
      await tx.queueEntry.delete({
        where: { id: queueEntryId }
      })

      // Update positions of everyone behind this person
      await tx.queueEntry.updateMany({
        where: {
          facilityType: queueEntry.facilityType,
          bookingType: queueEntry.bookingType,
          equipmentType: queueEntry.equipmentType,
          date: queueEntry.date,
          startTime: queueEntry.startTime,
          duration: queueEntry.duration,
          position: { gt: queueEntry.position }
        },
        data: {
          position: { decrement: 1 }
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: "Left queue successfully"
    })

  } catch (error) {
    console.error("Leave queue error:", error)
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    )
  }
}
