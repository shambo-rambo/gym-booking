"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  format, addDays, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, subMonths, addMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { FacilityType, EquipmentType } from "@prisma/client"
import { BookingDialog } from "./BookingDialog"
import { cn } from "@/lib/utils"

interface BookingCalendarProps {
  facilityType: FacilityType
  equipmentFilter?: EquipmentType | "all"
}

function getPeriod(time: string): string {
  const hour = parseInt(time.split(":")[0])
  if (hour < 12) return "Morning"
  if (hour < 17) return "Afternoon"
  if (hour < 20) return "Evening"
  return "Night"
}

function getSlotStatus(slot: any): string {
  if (!slot?.durations?.length) return "available"
  if (slot.durations.some((d: any) => d.userBooking)) return "yours"
  if (slot.durations.some((d: any) => d.userQueueEntry)) return "queued"
  if (slot.durations.some((d: any) => d.exclusive?.status === "blocked")) return "blocked"
  const allFull = slot.durations.every((d: any) => {
    const sharedFull =
      d.shared &&
      Object.values(d.shared).every((s: any) => s === "booked" || s === "full")
    return d.exclusive?.status === "booked" || d.bookedCount >= 2 || sharedFull
  })
  if (allFull) return "full"
  const allUnavailable = slot.durations.every(
    (d: any) => d.exclusive?.status === "unavailable"
  )
  if (allUnavailable) return "unavailable"
  return "available"
}

function getStatusText(slot: any, status: string): string {
  switch (status) {
    case "yours": {
      const d = slot.durations.find((d: any) => d.userBooking)
      return d?.userBooking?.bookingType === "EXCLUSIVE"
        ? "Your exclusive"
        : "Your booking"
    }
    case "queued": {
      const d = slot.durations.find((d: any) => d.userQueueEntry)
      return d?.userQueueEntry?.position
        ? `Queue #${d.userQueueEntry.position}`
        : "In queue"
    }
    case "full": {
      const maxQueue = Math.max(
        slot.durations[0]?.queueCount || 0,
        slot.durations[1]?.queueCount || 0
      )
      return maxQueue > 0 ? `Full · ${maxQueue} waiting` : "Fully booked"
    }
    case "blocked":     return "Maintenance"
    case "unavailable": return "Limit reached"
    default: {
      const maxQueue = Math.max(
        slot.durations[0]?.queueCount || 0,
        slot.durations[1]?.queueCount || 0
      )
      return maxQueue > 0 ? `${maxQueue} in queue` : "Available"
    }
  }
}

export function BookingCalendar({
  facilityType,
  equipmentFilter = "all",
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
  const [availabilityData, setAvailabilityData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date
    startTime: string
    availability: any
  } | null>(null)

  // Calendar days for mini month picker
  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewMonth)
    const end = endOfMonth(viewMonth)
    const days = eachDayOfInterval({ start, end })
    // Monday-first offset
    const firstDow = getDay(start)
    const offset = firstDow === 0 ? 6 : firstDow - 1
    return [...Array(offset).fill(null), ...days]
  }, [viewMonth])

  const fetchDay = useCallback(
    async (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd")
      try {
        const res = await fetch(
          `/api/bookings/availability?facilityType=${facilityType}&date=${dateStr}`
        )
        if (res.ok) return { dateStr, data: await res.json() }
      } catch (err) {
        console.error(`Failed to fetch availability for ${dateStr}:`, err)
      }
      return null
    },
    [facilityType]
  )

  const fetchForDate = useCallback(async () => {
    setLoading(true)
    const [cur, prev, next] = await Promise.all([
      fetchDay(selectedDate),
      fetchDay(addDays(selectedDate, -1)),
      fetchDay(addDays(selectedDate, 1)),
    ])
    const newData: Record<string, any> = {}
    ;[cur, prev, next].forEach((r) => {
      if (r) newData[r.dateStr] = r.data
    })
    setAvailabilityData((old) => ({ ...old, ...newData }))
    setLoading(false)
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

  const allSlots = [
    "05:00","05:30","06:00","06:30","07:00","07:30",
    "08:00","08:30","09:00","09:30","10:00","10:30",
    "11:00","11:30","12:00","12:30","13:00","13:30",
    "14:00","14:30","15:00","15:30","16:00","16:30",
    "17:00","17:30","18:00","18:30","19:00","19:30",
    "20:00","20:30","21:00","21:30",
  ]

  const now = new Date()
  const isTodaySelected = isSameDay(selectedDate, today)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const visibleSlots = allSlots.filter((time) => {
    if (isTodaySelected) {
      const [h, m] = time.split(":").map(Number)
      if (h * 60 + m <= nowMinutes) return false
    }
    if (timeFilter === "morning")   return time >= "05:00" && time <= "11:30"
    if (timeFilter === "afternoon") return time >= "12:00" && time <= "16:30"
    if (timeFilter === "evening")   return time >= "17:00" && time <= "21:30"
    return true
  })

  const dayData = availabilityData[format(selectedDate, "yyyy-MM-dd")]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
      {/* ── Mini Calendar ── */}
      <section className="lg:col-span-5">
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

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-outline-variant/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Selected</span>
              <span className="text-sm font-bold text-primary">
                {isTodaySelected ? "Today" : format(selectedDate, "EEEE, MMM d")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Facility</span>
              <span className="text-sm font-bold text-primary">
                {facilityType === FacilityType.GYM ? "Gym & Fitness" : "Private Sauna"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Time Slots ── */}
      <section className="lg:col-span-7">
        {/* Header + filters */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-primary">Select a Time</h3>
            <p className="text-sm text-on-surface-variant">30 or 60 minute sessions</p>
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
        <div className="flex gap-4 mb-5">
          {[
            { color: "bg-secondary", label: "Available" },
            { color: "bg-primary/30", label: "Yours" },
            { color: "bg-secondary-container border border-secondary/20", label: "In Queue" },
            { color: "bg-surface-dim", label: "Full / N/A" },
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
              const slot = dayData?.slots?.find((s: any) => s.startTime === time)
              const status = getSlotStatus(slot)
              const text = getStatusText(slot, status)
              const period = getPeriod(time)
              const isClickable = !["blocked", "unavailable"].includes(status)

              return (
                <button
                  key={time}
                  onClick={() => isClickable && slot && setSelectedSlot({ date: selectedDate, startTime: time, availability: slot })}
                  disabled={!isClickable || !slot}
                  className={cn(
                    "relative p-5 rounded-xl text-left transition-all",
                    status === "yours"
                      ? "bg-primary ring-4 ring-primary/10 shadow-card-lg"
                      : status === "queued"
                      ? "bg-secondary-container border border-secondary/20 hover:ring-2 hover:ring-secondary/30"
                      : status === "full"
                      ? "bg-surface-container-low border border-outline-variant/30 hover:ring-2 hover:ring-error/20"
                      : status === "blocked" || status === "unavailable"
                      ? "bg-surface-container-low opacity-50 cursor-not-allowed"
                      : "bg-white border border-outline-variant/30 hover:ring-2 hover:ring-secondary/30 shadow-sm active:scale-95"
                  )}
                >
                  {/* Status dot */}
                  <span
                    className={cn(
                      "absolute top-3 right-3 w-1.5 h-1.5 rounded-full",
                      status === "yours"      ? "bg-white/50" :
                      status === "queued"     ? "bg-secondary" :
                      status === "full"       ? "bg-error/60" :
                      status === "available"  ? "bg-secondary" :
                      "bg-outline/40"
                    )}
                  />

                  <span
                    className={cn(
                      "block text-[10px] font-bold uppercase tracking-widest mb-1",
                      status === "yours" ? "text-white/60" : "text-outline"
                    )}
                  >
                    {period}
                  </span>
                  <span
                    className={cn(
                      "block text-lg font-extrabold tracking-tight",
                      status === "yours"    ? "text-white" :
                      status === "queued"   ? "text-on-secondary-container" :
                      ["full","blocked","unavailable"].includes(status)
                        ? "text-on-surface-variant"
                        : "text-primary"
                    )}
                  >
                    {time}
                  </span>
                  <span
                    className={cn(
                      "block text-[10px] mt-0.5",
                      status === "yours"  ? "text-white/70" :
                      status === "full"   ? "text-error/80" :
                      "text-on-surface-variant/70"
                    )}
                  >
                    {text}
                  </span>
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
          onBookingSuccess={fetchForDate}
        />
      )}
    </div>
  )
}
