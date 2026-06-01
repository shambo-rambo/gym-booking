"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { format, addDays, isSameDay } from "date-fns"
import { BookingType, EquipmentType } from "@prisma/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EQUIPMENT_LABELS } from "@/lib/equipment"
import { saveBookingPrefs } from "@/lib/bookingPrefs"

const ALL_SLOTS = [
  "06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30",
  "21:00","21:30","22:00","22:30",
]

type SlotStatus = "available" | "taken" | "yours"

export interface RepeatSession {
  facilityType: string
  bookingType: string
  equipment: (EquipmentType | null)[]
  startTime: string
  duration: number
}

interface Props {
  open: boolean
  onClose: () => void
  session: RepeatSession
  onSuccess: () => void
}

export function BookAgainDialog({ open, onClose, session, onSuccess }: Props) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const [h, m] = session.startTime.split(":").map(Number)
    const slotToday = new Date()
    slotToday.setHours(h, m, 0, 0)
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return slotToday > new Date() ? d : addDays(d, 1)
  })
  const [selectedTime, setSelectedTime] = useState(session.startTime)
  const [slotMap, setSlotMap] = useState<Map<string, any>>(new Map())
  const [availLoading, setAvailLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const equipment = session.equipment.filter(Boolean) as EquipmentType[]
  const isSharedGym = session.facilityType === "GYM" && session.bookingType === "SHARED"
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i))

  const fetchAvailability = useCallback(async (date: Date) => {
    setAvailLoading(true)
    try {
      const res = await fetch(
        `/api/bookings/availability?facilityType=${session.facilityType}&date=${format(date, "yyyy-MM-dd")}`
      )
      if (res.ok) {
        const data = await res.json()
        const map = new Map<string, any>()
        for (const slot of data.slots ?? []) {
          map.set(slot.startTime, slot)
        }
        setSlotMap(map)
      }
    } finally {
      setAvailLoading(false)
    }
  }, [session.facilityType])

  useEffect(() => {
    if (open) fetchAvailability(selectedDate)
  }, [open, selectedDate, fetchAvailability])

  function getTimeStatus(time: string): SlotStatus {
    const slot = slotMap.get(time)
    if (!slot) return "available"
    const d = slot.durations?.find((x: any) => x.duration === session.duration)
    if (!d) return "available"
    if (d.userBooking || d.userBookings?.length > 0) return "yours"

    if (session.bookingType !== "SHARED") {
      // Exclusive: taken only when explicitly occupied or blocked
      const s = d.exclusive?.status
      return (s === "booked" || s === "blocked" || s === "full") ? "taken" : "available"
    }

    // Shared gym: available unless ALL of the user's equipment is occupied
    // "booked" = in use (including overlap with existing session), "blocked" = maintenance, "full" = capacity
    const shared: Record<string, string> = d.shared ?? {}
    if (equipment.length === 0) return "available"
    const allOccupied = equipment.every(eq => {
      const s = shared[eq]
      return s === "blocked" || s === "full" || s === "booked"
    })
    return allOccupied ? "taken" : "available"
  }

  const visibleTimes = ALL_SLOTS.filter(time => {
    if (!isSameDay(selectedDate, today)) return true
    const [h, m] = time.split(":").map(Number)
    const t = new Date()
    t.setHours(h, m, 0, 0)
    return t > new Date()
  })

  const handleDateSelect = (day: Date) => {
    setSelectedDate(day)
    if (isSameDay(day, today)) {
      const [h, m] = selectedTime.split(":").map(Number)
      const t = new Date()
      t.setHours(h, m, 0, 0)
      if (t <= new Date()) {
        const next = ALL_SLOTS.find(s => {
          const [sh, sm] = s.split(":").map(Number)
          const st = new Date()
          st.setHours(sh, sm, 0, 0)
          return st > new Date()
        })
        if (next) setSelectedTime(next)
      }
    }
  }

  const handleConfirm = async () => {
    setError("")
    setLoading(true)
    const items: (EquipmentType | undefined)[] =
      isSharedGym && equipment.length > 0 ? equipment : [undefined]
    const createdIds: string[] = []

    try {
      for (const eq of items) {
        const res = await fetch("/api/bookings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityType: session.facilityType,
            bookingType: session.bookingType,
            date: format(selectedDate, "yyyy-MM-dd"),
            startTime: selectedTime,
            duration: session.duration,
            ...(eq && { equipmentType: eq }),
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (createdIds.length > 0) {
            await Promise.allSettled(
              createdIds.map(id => fetch(`/api/bookings/${id}`, { method: "DELETE" }))
            )
          }
          setError(data.error || "Failed to create booking")
          setLoading(false)
          return
        }
        if (data.booking?.id) createdIds.push(data.booking.id)
      }
      saveBookingPrefs({
        amenity: session.facilityType === "GYM" ? "gym" : "sauna",
        bookingType: session.bookingType as BookingType,
        duration: session.duration as 30 | 60,
        equipment,
      })
      onSuccess()
      onClose()
    } catch {
      if (createdIds.length > 0) {
        await Promise.allSettled(
          createdIds.map(id => fetch(`/api/bookings/${id}`, { method: "DELETE" }))
        )
      }
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const selectedStatus = getTimeStatus(selectedTime)
  const canConfirm = !loading && !availLoading && selectedStatus === "available"

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-[420px]",
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0",
          "max-sm:top-auto max-sm:translate-y-0 max-sm:translate-x-0",
          "max-sm:rounded-t-2xl max-sm:rounded-b-none",
          "max-sm:max-h-[90vh] max-sm:overflow-y-auto"
        )}
      >
        <div className="sm:hidden flex justify-center mb-2 -mt-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        <DialogHeader>
          <DialogTitle className="text-xl sm:text-lg">Book Again</DialogTitle>
          <DialogDescription className="text-base sm:text-sm">
            {session.facilityType === "GYM" ? "Gym" : "Sauna"}
            {" · "}
            {session.bookingType === "EXCLUSIVE" ? "Private" : "Shared"}
            {" · "}
            {session.duration} min
            {equipment.length > 0 && ` · ${equipment.map(e => EQUIPMENT_LABELS[e]).join(", ")}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-hidden">
          {/* Date */}
          <div>
            <p className="text-sm font-medium mb-2">Date</p>
            <div className="overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              <div className="flex gap-2 pb-1">
                {days.map(day => {
                  const sel = isSameDay(day, selectedDate)
                  const isToday = isSameDay(day, today)
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDateSelect(day)}
                      className={cn(
                        "flex flex-col items-center flex-shrink-0 w-[62px] py-3 rounded-xl transition-all active:scale-95 outline-none",
                        sel
                          ? "bg-primary text-on-primary shadow-md"
                          : "bg-surface-container-low text-primary hover:bg-surface-container-high"
                      )}
                    >
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide", sel ? "text-on-primary/70" : "text-on-surface-variant")}>
                        {isToday ? "Today" : format(day, "EEE")}
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
          </div>

          {/* Time */}
          <div>
            <p className="text-sm font-medium mb-2">Time</p>
            {availLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {visibleTimes.map(time => {
                  const status = getTimeStatus(time)
                  const sel = selectedTime === time
                  const taken = status === "taken"
                  const yours = status === "yours"
                  return (
                    <button
                      key={time}
                      onClick={() => !taken && !yours && setSelectedTime(time)}
                      disabled={taken || yours}
                      className={cn(
                        "py-2.5 rounded-lg text-sm font-medium transition-colors outline-none text-center",
                        sel && !taken && !yours
                          ? "bg-primary text-on-primary"
                          : taken
                          ? "bg-surface-container text-on-surface-variant/30 line-through cursor-not-allowed"
                          : yours
                          ? "bg-primary/10 text-primary/40 cursor-not-allowed"
                          : "bg-surface-container-low text-primary hover:bg-surface-container-high"
                      )}
                    >
                      {time}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedStatus === "yours" && (
            <p className="text-xs text-amber-600">You already have a booking at this time — pick a different slot.</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading} size="lg" className="min-h-[48px] text-base">
            Close
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} size="lg" className="min-h-[48px] text-base">
            {loading ? "Booking…" : "Confirm Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
