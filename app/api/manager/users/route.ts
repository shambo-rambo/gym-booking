import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    // Get all users grouped by status
    const pending = await prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: 'desc' }
    })

    const verified = await prisma.user.findMany({
      where: { status: "VERIFIED" },
      orderBy: { name: 'asc' }
    })

    const deactivated = await prisma.user.findMany({
      where: { status: "DEACTIVATED" },
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
