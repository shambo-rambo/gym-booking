import { NextRequest, NextResponse } from "next/server"
import { runAmenityAudit } from "@/lib/amenity-audit"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekEnd = new Date()
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)

    const { unbookedCount, noShowCount } = await runAmenityAudit(weekStart, weekEnd)

    return NextResponse.json({
      success: true,
      message: `Amenity audit complete: ${unbookedCount} un-booked access, ${noShowCount} no-show exceptions`,
      unbookedCount,
      noShowCount,
    })

  } catch (error) {
    console.error('Amenity audit cron error:', error)
    return NextResponse.json(
      { error: 'Failed to run amenity audit' },
      { status: 500 }
    )
  }
}
