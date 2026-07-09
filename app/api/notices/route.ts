import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = (session.user as any).id

  const recipients = await prisma.noticeRecipient.findMany({
    where: { userId },
    include: {
      notice: {
        include: { creator: { select: { name: true } } },
      },
    },
    orderBy: { notice: { createdAt: "desc" } },
  })

  const notices = recipients
    .filter((r) => !r.notice.expiresAt || r.notice.expiresAt > new Date())
    .map((r) => ({
      id: r.notice.id,
      title: r.notice.title,
      message: r.notice.message,
      category: r.notice.category,
      createdAt: r.notice.createdAt,
      createdByName: r.notice.creator.name,
      readAt: r.readAt,
    }))
    .sort((a, b) => {
      if (a.category === "URGENT" && b.category !== "URGENT") return -1
      if (b.category === "URGENT" && a.category !== "URGENT") return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  return NextResponse.json({ notices })
}
