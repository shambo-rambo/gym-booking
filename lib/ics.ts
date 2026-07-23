import { EQUIPMENT_LABELS, formatBookingType } from "./equipment"
import type { EquipmentType } from "@prisma/client"

// All bookings happen at one physical building in Australia's eastern timezone.
// Referencing the IANA TZID directly (without a full embedded VTIMEZONE block) is
// understood correctly by Google Calendar, Apple Calendar, and Outlook in practice,
// and keeps this generator simple while still handling AEST/AEDT correctly.
const BUILDING_TZID = "Australia/Sydney"

export interface ICSBookingInput {
  id: string
  facilityType: string
  bookingType: string
  equipmentType?: string | null
  date: Date | string
  startTime: string
  duration: number
  endTime?: string | null // Library bookings only — overrides duration-based end time
}

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

// Local wall-clock time, formatted for a TZID-qualified DTSTART/DTEND (no trailing Z).
function formatLocal(date: Date, hours: number, minutes: number): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}${pad(m)}${pad(d)}T${pad(hours)}${pad(minutes)}00`
}

// UTC timestamp for DTSTAMP/UID, per RFC 5545.
function formatUtcNow(): string {
  const now = new Date()
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

// Escapes text per RFC 5545 §3.3.11 (comma, semicolon, backslash, newline).
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n")
}

function facilityLabel(facilityType: string): string {
  if (facilityType === "GYM") return "Gym"
  if (facilityType === "SAUNA") return "Sauna"
  if (facilityType === "LIBRARY") return "Library"
  return facilityType
}

function sessionLabel(bookingType: string, equipmentType?: string | null): string {
  if (bookingType === "EXCLUSIVE_BOTH") return "Exclusive (Gym + Sauna)"
  if (equipmentType) return EQUIPMENT_LABELS[equipmentType as EquipmentType]
  return formatBookingType(bookingType)
}

// Folds long lines to 75 octets as required by RFC 5545 §3.1 (continuation lines
// start with a single space).
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75))
    rest = " " + rest.slice(75)
  }
  chunks.push(rest)
  return chunks.join("\r\n")
}

export function generateBookingICS(booking: ICSBookingInput): string {
  const date = typeof booking.date === "string" ? new Date(booking.date) : booking.date
  const [startHour, startMinute] = booking.startTime.split(":").map(Number)

  let endHour: number, endMinute: number
  if (booking.endTime) {
    ;[endHour, endMinute] = booking.endTime.split(":").map(Number)
  } else {
    const endTotal = startHour * 60 + startMinute + booking.duration
    endHour = Math.floor(endTotal / 60)
    endMinute = endTotal % 60
  }

  const summary = `${facilityLabel(booking.facilityType)} — ${sessionLabel(booking.bookingType, booking.equipmentType)}`
  const description = "Booked via The Watertower amenity booking app."

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Watertower//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@thewatertower.app`,
    `DTSTAMP:${formatUtcNow()}`,
    `DTSTART;TZID=${BUILDING_TZID}:${formatLocal(date, startHour, startMinute)}`,
    `DTEND;TZID=${BUILDING_TZID}:${formatLocal(date, endHour, endMinute)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(`The Watertower — ${facilityLabel(booking.facilityType)}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  return lines.map(foldLine).join("\r\n") + "\r\n"
}
