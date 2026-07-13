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
      eventAt: r.notice.eventAt,
      createdByName: r.notice.creator.name,
      readAt: r.readAt,
    }))
    .sort((a, b) => {
      // Ascending by effective date (eventAt if the notice is about a specific
      // date, otherwise when it was posted). The client groups these into
      // Today/Upcoming/Past sections (Urgent included — it's no longer pinned
      // above them) and reverses order within Past — a single flat sort can't
      // express "ascending here, descending there" on its own.
      const aDate = new Date(a.eventAt ?? a.createdAt).getTime()
      const bDate = new Date(b.eventAt ?? b.createdAt).getTime()
      return aDate - bDate
    })

  return NextResponse.json({ notices })
}
