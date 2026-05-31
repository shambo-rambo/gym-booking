"use client"

import { useState, useEffect, useCallback } from "react"
import { format, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react"

// 30-min increments from 06:00 to 22:30
const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`)
}
// End times go up to 23:00
const END_TIME_OPTIONS: string[] = [...TIME_OPTIONS, "23:00"]

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number)
  const suffix = h < 12 ? "am" : "pm"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`
}

interface ScheduleEntry {
  id: string
  startTime: string
  endTime: string | null
  duration: number
  isYours: boolean
  firstName: string
}

interface LibraryBookingPanelProps {
  onBooked?: () => void
}

export function LibraryBookingPanel({ onBooked }: LibraryBookingPanelProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dateOffset, setDateOffset] = useState(0) // for carousel paging on mobile

  const DAYS_SHOWN = 8
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i))

  const dateStr = format(selectedDate, "yyyy-MM-dd")

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true)
    try {
      const res = await fetch(`/api/library/schedule?date=${dateStr}`)
      if (res.ok) setSchedule(await res.json())
    } finally {
      setLoadingSchedule(false)
    }
  }, [dateStr])

  useEffect(() => {
    fetchSchedule()
    setError(null)
    setSuccess(false)
  }, [fetchSchedule])

  // Clamp endTime to always be after startTime
  useEffect(() => {
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      const next = END_TIME_OPTIONS.find(t => toMinutes(t) > toMinutes(startTime))
      if (next) setEndTime(next)
    }
  }, [startTime, endTime])

  const validEndTimes = END_TIME_OPTIONS.filter(t => toMinutes(t) > toMinutes(startTime))
  const durationMins = toMinutes(endTime) - toMinutes(startTime)

  const handleBook = async () => {
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityType: "LIBRARY",
          date: dateStr,
          startTime,
          endTime,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create booking")
      } else {
        setSuccess(true)
        fetchSchedule()
        onBooked?.()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd")

  return (
    <div className="space-y-6">
      {/* Date carousel */}
      <div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {days.map(day => {
            const isSelected = format(day, "yyyy-MM-dd") === selectedDateStr
            const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
            return (
              <button
                key={format(day, "yyyy-MM-dd")}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center min-w-[52px] py-2 px-1 rounded-xl transition-all text-sm font-medium",
                  isSelected
                    ? "bg-primary text-on-primary shadow-card"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {isToday ? "Today" : format(day, "EEE")}
                </span>
                <span className="text-lg font-bold leading-tight">{format(day, "d")}</span>
                <span className="text-[10px] opacity-60">{format(day, "MMM")}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Time range pickers */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
          Select Time
        </h3>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-on-surface-variant mb-1 block">Start</label>
            <select
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {TIME_OPTIONS.map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </div>

          <div className="text-on-surface-variant mt-5">→</div>

          <div className="flex-1">
            <label className="text-xs text-on-surface-variant mb-1 block">End</label>
            <select
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {validEndTimes.map(t => (
                <option key={t} value={t}>{formatTime(t)}</option>
              ))}
            </select>
          </div>
        </div>

        {durationMins > 0 && (
          <p className="text-xs text-on-surface-variant">
            Duration: <span className="font-semibold text-primary">{formatDuration(durationMins)}</span>
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 font-medium">
            Library booked! See your booking below.
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleBook}
          disabled={submitting || durationMins <= 0}
        >
          {submitting ? "Booking…" : "Book Library"}
        </Button>
      </div>

      {/* Day schedule */}
      <div>
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-3">
          {format(selectedDate, "EEEE, MMMM d")} — Library Schedule
        </h3>

        {loadingSchedule ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : schedule.length === 0 ? (
          <div className="bg-white rounded-xl border border-outline-variant/20 p-6 text-center text-sm text-on-surface-variant">
            No bookings yet — library is free all day.
          </div>
        ) : (
          <div className="space-y-2">
            {schedule.map(entry => {
              const endLabel = entry.endTime
                ? formatTime(entry.endTime)
                : `+${formatDuration(entry.duration)}`
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3",
                    entry.isYours
                      ? "bg-primary/5 border-primary/30"
                      : "bg-white border-outline-variant/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className={cn("w-4 h-4 shrink-0", entry.isYours ? "text-primary" : "text-on-surface-variant")} />
                    <div>
                      <p className={cn("text-sm font-semibold", entry.isYours ? "text-primary" : "text-on-surface")}>
                        {formatTime(entry.startTime)} – {endLabel}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {entry.isYours ? "Your booking" : entry.firstName} · {formatDuration(entry.duration)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
