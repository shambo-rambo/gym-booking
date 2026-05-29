import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const dynamic = 'force-dynamic'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    })

    if (!user?.password) {
      return NextResponse.json(
        { error: "Password change is not available for accounts linked via Google" },
        { status: 400 }
      )
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Change password error:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}
