import { NextRequest, NextResponse } from "next/server"
import { releaseWaitlistedSlots } from "@/lib/queue-notifications"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const releasedCount = await releaseWaitlistedSlots()

    return NextResponse.json({
      success: true,
      message: `Released ${releasedCount} waitlisted slots`
    })

  } catch (error) {
    console.error('Release waitlisted slots cron error:', error)
    return NextResponse.json(
      { error: 'Failed to release waitlisted slots' },
      { status: 500 }
    )
  }
}
