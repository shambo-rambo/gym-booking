import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { VALID_UNITS } from "@/lib/apartments"
import { z } from "zod"

export const dynamic = 'force-dynamic'

async function requireManager() {
  const session = await auth()
  if (!session?.user) return null
  const manager = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  return manager?.role === "MANAGER" ? manager : null
}

export async function GET(request: NextRequest) {
  const manager = await requireManager()
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const apartmentNumber = Number(request.nextUrl.searchParams.get("apartmentNumber"))
  if (!apartmentNumber || !VALID_UNITS.has(apartmentNumber)) {
    return NextResponse.json({ error: "Invalid apartment number" }, { status: 400 })
  }

  const fobs = await prisma.fob.findMany({
    where: { apartmentNumber },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ fobs })
}

const createFobSchema = z.object({
  apartmentNumber: z.number().int().refine((n) => VALID_UNITS.has(n), { message: "Unit number isn't recognised" }),
  fobNumber: z.string().regex(/^\d{3}$/, "Fob number must be exactly 3 digits"),
})

export async function POST(request: NextRequest) {
  const manager = await requireManager()
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const data = createFobSchema.parse(await request.json())

    const existing = await prisma.fob.findUnique({
      where: { apartmentNumber_fobNumber: { apartmentNumber: data.apartmentNumber, fobNumber: data.fobNumber } },
    })
    if (existing) {
      return NextResponse.json({ error: "That fob is already on file for this apartment" }, { status: 409 })
    }

    const fob = await prisma.fob.create({ data })
    return NextResponse.json({ success: true, fob })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Create fob error:", error)
    return NextResponse.json({ error: "Failed to add fob" }, { status: 500 })
  }
}
