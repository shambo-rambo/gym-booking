import { prisma } from "./prisma"
import { fetchAccessReviewEvents } from "./inception-client"
import { extractUnitNumber } from "./amenity-audit-parse"
import { getBookingTimeRange } from "./date-utils"
import { format } from "date-fns"

const AMENITY_LOCATION_LABEL = "Gym/Sauna Amenity Door"
const AMENITY_WHERE_ID = process.env.INCEPTION_AMENITY_WHERE_ID

interface ParsedAccessLog {
  unitNumber: number
  timestamp: Date
  raw: string
}

// fetchAccessReviewEvents already filters to granted door-access events server-side
// (Inception message type 2006), so every event returned here is a successful swipe.
async function fetchParsedAccessLogs(weekStart: Date, weekEnd: Date): Promise<ParsedAccessLog[]> {
  const events = await fetchAccessReviewEvents(weekStart, weekEnd)

  const parsed: ParsedAccessLog[] = []
  for (const event of events) {
    if (AMENITY_WHERE_ID && event.WhereID !== AMENITY_WHERE_ID) continue
    if (!event.When) continue

    const unitNumber = extractUnitNumber(event.Who)
    if (unitNumber === null) continue

    parsed.push({ unitNumber, timestamp: new Date(event.When), raw: event.Who ?? "" })
  }

  return parsed
}

export async function runAmenityAudit(weekStart: Date, weekEnd: Date): Promise<{ unbookedCount: number; noShowCount: number }> {
  const [bookings, accessLogs] = await Promise.all([
    prisma.booking.findMany({
      where: {
        facilityType: { in: ["GYM", "SAUNA"] },
        date: { gte: weekStart, lt: weekEnd },
      },
      include: { user: true },
    }),
    fetchParsedAccessLogs(weekStart, weekEnd),
  ])

  const bookingWindows = bookings.map((booking) => ({
    booking,
    unitNumber: booking.user.apartmentNumber,
    ...getBookingTimeRange(booking.date, booking.startTime, booking.duration),
  }))

  let unbookedCount = 0
  let noShowCount = 0

  // Un-booked access: a swipe with no covering booking for that unit.
  for (const log of accessLogs) {
    const hasBooking = bookingWindows.some(
      (bw) => bw.unitNumber === log.unitNumber && log.timestamp >= bw.start && log.timestamp <= bw.end
    )
    if (hasBooking) continue

    const dedupeKey = `unbooked:${log.unitNumber}:${log.timestamp.toISOString()}`
    await prisma.amenityAuditException.upsert({
      where: { dedupeKey },
      create: {
        exceptionType: "UNBOOKED_ACCESS",
        unitNumber: log.unitNumber,
        rawSystemIdentifier: log.raw,
        location: AMENITY_LOCATION_LABEL,
        windowLabel: format(log.timestamp, "EEEE, MMMM d, yyyy h:mm a"),
        eventAt: log.timestamp,
        auditWeekStart: weekStart,
        auditWeekEnd: weekEnd,
        dedupeKey,
      },
      update: {},
    })
    unbookedCount++
  }

  // No-show: a booking with no swipe from that unit during its window.
  for (const bw of bookingWindows) {
    const hasAccess = accessLogs.some(
      (log) => log.unitNumber === bw.unitNumber && log.timestamp >= bw.start && log.timestamp <= bw.end
    )
    if (hasAccess) continue

    const dedupeKey = `noshow:${bw.booking.id}`
    await prisma.amenityAuditException.upsert({
      where: { dedupeKey },
      create: {
        exceptionType: "NO_SHOW",
        unitNumber: bw.unitNumber,
        rawSystemIdentifier: null,
        location: AMENITY_LOCATION_LABEL,
        windowLabel: `${format(bw.start, "EEEE, MMMM d, yyyy h:mm a")} - ${format(bw.end, "h:mm a")}`,
        bookingId: bw.booking.id,
        windowStart: bw.start,
        windowEnd: bw.end,
        auditWeekStart: weekStart,
        auditWeekEnd: weekEnd,
        dedupeKey,
      },
      update: {},
    })
    noShowCount++
  }

  return { unbookedCount, noShowCount }
}
