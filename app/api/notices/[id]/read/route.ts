import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = (session.user as any).id

  await prisma.noticeRecipient.updateMany({
    where: { noticeId: params.id, userId, readAt: null },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
