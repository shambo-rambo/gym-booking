import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is manager
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user || user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const userSelect = {
      id: true,
      email: true,
      name: true,
      apartmentNumber: true,
      phoneNumber: true,
      role: true,
      status: true,
      notificationPreference: true,
      residencyType: true,
      fobNumber: true,
      createdAt: true,
      updatedAt: true,
    }

    // Get all users grouped by status
    const pending = await prisma.user.findMany({
      where: { status: "PENDING" },
      select: userSelect,
      orderBy: { createdAt: 'desc' }
    })

    const verified = await prisma.user.findMany({
      where: { status: "VERIFIED" },
      select: userSelect,
      orderBy: { name: 'asc' }
    })

    const deactivated = await prisma.user.findMany({
      where: { status: "DEACTIVATED" },
      select: userSelect,
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({
      pending,
      verified,
      deactivated
    })

  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}
