import { NextRequest, NextResponse } from "next/server"
import { expireUnclaimedQueueSlots } from "@/lib/queue-notifications"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run the expiry function
    const expiredCount = await expireUnclaimedQueueSlots()

    return NextResponse.json({
      success: true,
      message: `Expired ${expiredCount} queue claims and notified next in line`
    })

  } catch (error) {
    console.error('Expire queue claims cron error:', error)
    return NextResponse.json(
      { error: 'Failed to expire queue claims' },
      { status: 500 }
    )
  }
}
