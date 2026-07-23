"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  format, addDays, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, subMonths, addMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import { BookingDialog } from "./BookingDialog"
import { cn } from "@/lib/utils"
import type { DayAvailability, DisplayStatus, SlotAvailability } from "@/lib/types"
import { EQUIPMENT_LABELS } from "@/lib/equipment"
import { isPeakTime } from "@/lib/peak-time"

interface BookingCalendarProps {
  facilityType: FacilityType
  defaultBookingType?: BookingType
  defaultEquipment?: EquipmentType[]
}

const ALL_SLOTS = [
  "06:00","06:30","07:00","07:30",
  "08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30",
  "17:00","17:30","18:00","18:30","19:00","19:30",
  "20:00","20:30","21:00","21:30","22:00","22:30",
]

function getPeriod(time: string): string {
  const hour = parseInt(time.split(":")[0])
  if (hour < 12) return "Morning"
  if (hour < 17) return "Afternoon"
  if (hour < 20) return "Evening"
  return "Night"
}

// Peak and off-peak slots each have two independently-computed duration entries (30
// and 60 min), and they can genuinely disagree — e.g. a 60-min entry can overlap an
// existing booking while the 30-min entry at the same start time doesn't. Rather than
// trying to reconcile two possibly-conflicting statuses, the tile's overall status is
// judged from the one duration a click would actually default to (30 min in peak
// hours, 60 min off-peak) — "yours"/"queued" still check across both, since those are
// exact-match concerns regardless of which duration the user originally booked.
function getSlotStatus(slot: SlotAvailability | undefined, time: string): DisplayStatus {
  if (!slot?.durations?.length) return "available"
  if (slot.durations.some((d) => d.userBooking !== null)) return "yours"
  if (slot.durations.some((d) => d.userQueueEntry !== null)) return "queued"

  const defaultDuration = isPeakTime(time) ? 30 : 60
  const d = slot.durations.find((x) => x.duration === defaultDuration) ?? slot.durations[0]
  if (!d) return "available"

  if (d.exclusive?.status === "blocked") return "blocked"
  const sharedFull = !!d.shared && Object.values(d.shared).every((s) => s === "booked" || s === "full")
  if (d.bookedCount >= 2 || sharedFull) return "full"
  if (d.exclusive?.status === "unavailable") return "unavailable"
  const isPartial =
    d.exclusive?.status === "booked" &&
    (() => {
      const vals = d.shared ? Object.values(d.shared) : []
      return vals.some((s) => s === "booked") && vals.some((s) => s === "available")
    })()
  if (isPartial) return "partial"
  return "available"
}

function getStatusText(slot: SlotAvailability | undefined, status: DisplayStatus, time: string): string {
  const defaultDuration = isPeakTime(time) ? 30 : 60
  const d = slot?.durations?.find((x) => x.duration === defaultDuration) ?? slot?.durations?.[0]
  switch (status) {
    case "yours": {
      const yd = slot?.durations?.find((d) => d.userBooking !== null)
      if (yd?.userBooking?.bookingType === "EXCLUSIVE") return "Your booking · Private"
      if (yd?.userBooking?.bookingType === "EXCLUSIVE_BOTH") return "Your booking · Exclusive"
      return "Your booking · Shared"
    }
    case "queued": {
      const qd = slot?.durations?.find((d) => d.userQueueEntry !== null)
      return qd?.userQueueEntry?.position
        ? `Queue #${qd.userQueueEntry.position}`
        : "In queue"
    }
    case "partial": return "Share available"
    case "full": {
      const queueCount = d?.queueCount ?? 0
      return queueCount > 0 ? `Full · ${queueCount} waiting` : "Fully booked"
    }
    case "blocked":     return "Maintenance"
    case "unavailable": return "Limit reached"
    default: {
      const queueCount = d?.queueCount ?? 0
      return queueCount > 0 ? `${queueCount} in queue` : "Available"
    }
  }
}

export function BookingCalendar({
  facilityType,
  defaultBookingType,
  defaultEquipment = [],
}: BookingCalendarProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const maxDate = useMemo(() => addDays(today, 7), [today])

  const [viewMonth, setViewMonth] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [timeFilter, setTimeFilter] = useState<"all" | "morning" | "afternoon" | "evening">("all")
  const [availabilityData, setAvailabilityData] = useState<Record<string, DayAvailability>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date
    startTime: string
    availability: SlotAvailability
  } | null>(null)

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewMonth)
    const end = endOfMonth(viewMonth)
    const days = eachDayOfInterval({ start, end })
    const firstDow = getDay(start)
    const offset = firstDow === 0 ? 6 : firstDow - 1
    return [...Array(offset).fill(null), ...days]
  }, [viewMonth])

  const fetchDay = useCallback(
    async (date: Date, noCache?: boolean) => {
      const dateStr = format(date, "yyyy-MM-dd")
      try {
        const res = await fetch(
          `/api/bookings/availability?facilityType=${facilityType}&date=${dateStr}`,
          noCache ? { cache: "no-store" } : undefined
        )
        if (res.ok) return { dateStr, data: await res.json() as DayAvailability }
      } catch (err) {
        console.error(`Failed to fetch availability for ${dateStr}:`, err)
      }
      return null
    },
    [facilityType]
  )

  // Called after a booking/cancel action — bypasses HTTP cache so the slot
  // updates immediately instead of serving up to 40s of stale data.
  const handleBookingSuccess = useCallback(async () => {
    const cur = await fetchDay(selectedDate, true)
    if (cur) setAvailabilityData((old) => ({ ...old, [cur.dateStr]: cur.data }))
  }, [selectedDate, fetchDay])

  const fetchForDate = useCallback(async () => {
    setLoading(true)
    setFetchError(false)
    const cur = await fetchDay(selectedDate)
    if (cur) {
      setAvailabilityData((old) => ({ ...old, [cur.dateStr]: cur.data }))
    } else {
      setFetchError(true)
    }
    setLoading(false)

    // Prefetch neighbours after the current day is shown
    Promise.all([
      fetchDay(addDays(selectedDate, -1)),
      fetchDay(addDays(selectedDate, 1)),
    ]).then((results) => {
      const extra: Record<string, DayAvailability> = {}
      results.forEach((r) => { if (r) extra[r.dateStr] = r.data })
      if (Object.keys(extra).length) setAvailabilityData((old) => ({ ...old, ...extra }))
    })
  }, [selectedDate, fetchDay])

  useEffect(() => {
    fetchForDate()
  }, [fetchForDate])

  const isBookable = (day: Date) => {
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    return d >= today && d <= maxDate
  }

  const canPrevMonth = useMemo(
    () => endOfMonth(subMonths(viewMonth, 1)) >= today,
    [viewMonth, today]
  )
  const canNextMonth = useMemo(
    () => startOfMonth(addMonths(viewMonth, 1)) <= maxDate,
    [viewMonth, maxDate]
  )

  const isTodaySelected = isSameDay(selectedDate, today)

  const visibleSlots = useMemo(() => {
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const todaySelected = isSameDay(selectedDate, today)

    return ALL_SLOTS.filter((time) => {
      if (todaySelected) {
        // A slot stays visible/bookable for its whole hour, not just up to its exact
        // start minute — e.g. the 3:00 slot is still shown at 3:45 if not yet taken.
        const [h] = time.split(":").map(Number)
        if ((h + 1) * 60 <= nowMinutes) return false
      }
      // Off-peak, the gym only offers hourly slots (see validateBookingTime) — the
      // half-hour slot has nothing bookable in it, so hide it rather than showing an
      // always-disabled cell. Sauna is unaffected; it keeps the full 30-min grid.
      if (facilityType === FacilityType.GYM && !time.endsWith(":00") && !isPeakTime(time)) return false

      if (timeFilter === "morning")   return time >= "06:00" && time <= "11:30"
      if (timeFilter === "afternoon") return time >= "12:00" && time <= "16:30"
      if (timeFilter === "evening")   return time >= "17:00" && time <= "22:30"
      return true
    })
  }, [selectedDate, today, timeFilter, facilityType])

  const dayData = availabilityData[format(selectedDate, "yyyy-MM-dd")]

  return (
    <div>
      {/* ── Mobile date carousel ── */}
      <div className="lg:hidden mb-5 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {Array.from({ length: 8 }, (_, i) => addDays(today, i)).map((day) => {
            const sel = isSameDay(day, selectedDate)
            const tod = isToday(day)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center flex-shrink-0 w-[62px] py-3 rounded-xl transition-all active:scale-95",
                  sel ? "bg-primary text-on-primary shadow-md" : "bg-surface-container-low text-primary"
                )}
              >
                <span className={cn("text-[10px] font-bold uppercase tracking-wide", sel ? "text-on-primary/70" : "text-on-surface-variant")}>
                  {tod ? "Today" : format(day, "EEE")}
                </span>
                <span className="text-2xl font-extrabold leading-tight">{format(day, "d")}</span>
                <span className={cn("text-[10px]", sel ? "text-on-primary/60" : "text-on-surface-variant/60")}>
                  {format(day, "MMM")}
                </span>
              </button>
            )
          })}
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
      {/* ── Mini Calendar (desktop only) ── */}
      <section className="hidden lg:block lg:col-span-5">
        <div className="bg-white rounded-xl shadow-card p-6 lg:p-8">
          {/* Month nav */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold tracking-tight text-primary">
              {format(viewMonth, "MMMM yyyy")}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => canPrevMonth && setViewMonth(subMonths(viewMonth, 1))}
                disabled={!canPrevMonth}
                className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => canNextMonth && setViewMonth(addMonths(viewMonth, 1))}
                disabled={!canNextMonth}
                className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 text-center mb-2">
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
              <div key={d} className="text-[10px] uppercase tracking-widest font-bold text-outline py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const bookable = isBookable(day)
              const selected = isSameDay(day, selectedDate)
              const todayCell = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => bookable && setSelectedDate(day)}
                  disabled={!bookable}
                  className={cn(
                    "py-2.5 text-sm rounded-lg transition-all font-medium",
                    selected
                      ? "bg-primary text-on-primary font-bold scale-105 shadow-md"
                      : todayCell && bookable
                      ? "ring-1 ring-primary text-primary hover:bg-surface-container"
                      : bookable
                      ? "text-primary hover:bg-surface-container cursor-pointer"
                      : "text-outline/40 cursor-not-allowed"
                  )}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>

        </div>
      </section>

      {/* ── Time Slots ── */}
      <section className="lg:col-span-7">
        {/* Header + filters */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-primary">Select a Time</h3>
            <p className="text-sm text-on-surface-variant">
              30 or 60 minute sessions &middot; <span className="text-orange-600 font-medium">peak hours (3&ndash;9pm)</span>
              {facilityType === FacilityType.GYM && " · hourly slots only outside peak"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "morning", "afternoon", "evening"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors",
                  timeFilter === f
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {f === "all" ? "All day" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-5 flex-wrap">
          {[
            { color: "bg-secondary", label: "Available" },
            { color: "bg-primary", label: "Yours" },
            { color: "bg-blue-400", label: "In Queue" },
            { color: "bg-yellow-400", label: "Share Available" },
            { color: "bg-red-400", label: "Full" },
            { color: "bg-amber-400", label: "Limit Reached" },
            { color: "bg-orange-400", label: "Peak (3–9pm)" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", color)} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{label}</span>
            </div>
          ))}
        </div>

        {/* Slot grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-[88px] bg-surface-container animate-pulse rounded-xl" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-16 text-on-surface-variant">
            <p className="font-semibold">Could not load availability</p>
            <button
              onClick={fetchForDate}
              className="text-sm text-secondary underline mt-2"
            >
              Try again
            </button>
          </div>
        ) : visibleSlots.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <p className="font-semibold">No slots for this filter</p>
            <button
              onClick={() => setTimeFilter("all")}
              className="text-sm text-secondary underline mt-2"
            >
              Show all times
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleSlots.map((time) => {
              const slot = dayData?.slots?.find((s) => s.startTime === time)
              const status = getSlotStatus(slot, time)
              const text = getStatusText(slot, status, time)
              const period = getPeriod(time)
              const isClickable = status !== "blocked"
              const peak = isPeakTime(time)

              return (
                <button
                  key={time}
                  onClick={() => isClickable && slot && setSelectedSlot({ date: selectedDate, startTime: time, availability: slot })}
                  disabled={!isClickable || !slot}
                  className={cn(
                    "relative p-5 rounded-xl text-left transition-all",
                    peak && "border-t-[3px] border-t-orange-400",
                    status === "yours"
                      ? "bg-primary ring-4 ring-primary/10 shadow-card-lg"
                      : status === "queued"
                      ? "bg-blue-50 border border-blue-300 hover:ring-2 hover:ring-blue-400/40 shadow-sm"
                      : status === "partial"
                      ? "bg-yellow-50 border border-yellow-300 hover:ring-2 hover:ring-yellow-400/40 shadow-sm active:scale-95"
                      : status === "full"
                      ? "bg-red-50 border border-red-300 hover:ring-2 hover:ring-red-400/30"
                      : status === "blocked"
                      ? "bg-surface-container-low opacity-50 cursor-not-allowed"
                      : status === "unavailable"
                      ? "bg-amber-50 border border-amber-300 hover:ring-2 hover:ring-amber-400/40 cursor-pointer"
                      : "bg-secondary/10 border border-secondary/30 hover:ring-2 hover:ring-secondary/40 shadow-sm active:scale-95"
                  )}
                >
                  {/* Status dot */}
                  <span
                    className={cn(
                      "absolute top-3 right-3 w-1.5 h-1.5 rounded-full",
                      status === "yours"      ? "bg-white/50" :
                      status === "queued"     ? "bg-blue-500" :
                      status === "full"       ? "bg-red-500" :
                      status === "partial"    ? "bg-yellow-500" :
                      status === "unavailable" ? "bg-amber-500" :
                      status === "available"  ? "bg-secondary" :
                      "bg-outline/40"
                    )}
                  />

                  <span
                    className={cn(
                      "block text-[10px] font-bold uppercase tracking-widest mb-1",
                      peak && status !== "yours" ? "text-orange-500" : status === "yours" ? "text-white/60" : "text-outline"
                    )}
                  >
                    {peak ? "Peak" : period}
                  </span>
                  <span
                    className={cn(
                      "block text-lg font-extrabold tracking-tight",
                      status === "yours"       ? "text-white" :
                      status === "queued"      ? "text-blue-900" :
                      status === "partial"     ? "text-yellow-800" :
                      status === "full"        ? "text-red-900" :
                      status === "unavailable" ? "text-amber-900" :
                      status === "blocked"
                        ? "text-on-surface-variant"
                        : "text-primary"
                    )}
                  >
                    {time}
                  </span>
                  <span
                    className={cn(
                      "block text-[10px] mt-0.5",
                      status === "yours"       ? "text-white/70" :
                      status === "queued"      ? "text-blue-700" :
                      status === "partial"     ? "text-yellow-700" :
                      status === "full"        ? "text-red-700" :
                      status === "unavailable" ? "text-amber-700" :
                      "text-on-surface-variant/70"
                    )}
                  >
                    {text}
                  </span>
                  {status === "yours" && (() => {
                    const d = slot?.durations?.find((d) => d.userBooking !== null)
                    if (!d || d.userBooking?.bookingType !== "SHARED") return null
                    const myEquip = d.userBooking.equipmentType as EquipmentType | null
                    const allBooked = d.shared
                      ? Object.entries(d.shared).filter(([, v]) => v === "booked").map(([k]) => k as EquipmentType)
                      : []
                    const othersEquip = allBooked.filter((k) => k !== myEquip)
                    const parts: string[] = []
                    if (myEquip) parts.push(EQUIPMENT_LABELS[myEquip])
                    othersEquip.forEach((k) => parts.push(EQUIPMENT_LABELS[k]))
                    return parts.length > 0
                      ? <span className="block text-[9px] mt-0.5 text-white/50">{parts.join(" · ")}</span>
                      : null
                  })()}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {selectedSlot && (
        <BookingDialog
          open={!!selectedSlot}
          onClose={() => setSelectedSlot(null)}
          facilityType={facilityType}
          date={selectedSlot.date}
          startTime={selectedSlot.startTime}
          availability={selectedSlot.availability}
          defaultBookingType={defaultBookingType}
          defaultDuration={isPeakTime(selectedSlot.startTime) ? 30 : 60}
          defaultEquipment={defaultEquipment}
          onBookingSuccess={handleBookingSuccess}
        />
      )}
    </div>
    </div>
  )
}
