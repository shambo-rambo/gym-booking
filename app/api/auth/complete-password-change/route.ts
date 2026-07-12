import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

export const dynamic = 'force-dynamic'

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").refine(
    (pw) => pw.toLowerCase() !== "watertower",
    "Choose a different password from the temporary one"
  ),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { newPassword } = changePasswordSchema.parse(body)

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: (session.user as any).id },
      data: { password: hashed, mustChangePassword: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("Complete password change error:", error)
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
  }
}
