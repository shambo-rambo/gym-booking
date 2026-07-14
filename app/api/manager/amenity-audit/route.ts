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

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id }
    })

    if (!user || user.role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const exceptionType = searchParams.get("exceptionType")
    const weekStartStr = searchParams.get("weekStart")

    const where: any = {}

    if (exceptionType) {
      where.exceptionType = exceptionType
    }

    if (weekStartStr) {
      where.auditWeekStart = new Date(weekStartStr)
    } else {
      const latest = await prisma.amenityAuditException.findFirst({
        orderBy: { auditWeekStart: "desc" },
        select: { auditWeekStart: true },
      })
      if (latest) {
        where.auditWeekStart = latest.auditWeekStart
      }
    }

    const exceptions = await prisma.amenityAuditException.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ exceptions })

  } catch (error) {
    console.error('Amenity audit fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch amenity audit exceptions' },
      { status: 500 }
    )
  }
}
