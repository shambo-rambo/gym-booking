"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { FacilityType, BookingType, EquipmentType } from "@prisma/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SlotAvailability } from "@/lib/types"
import { EQUIPMENT_LABELS, EQUIPMENT_LIST } from "@/lib/equipment"
import { loadBookingPrefs, saveBookingPrefs } from "@/lib/bookingPrefs"

interface BookingPayload {
  facilityType: FacilityType
  bookingType: BookingType
  date: string
  startTime: string
  duration: 30 | 60
  equipmentType?: EquipmentType
}

interface BookingDialogProps {
  open: boolean
  onClose: () => void
  facilityType: FacilityType
  date: Date
  startTime: string
  availability: SlotAvailability
  defaultBookingType?: BookingType
  defaultEquipment?: EquipmentType[]
  onBookingSuccess?: () => void
}

export function BookingDialog({
  open,
  onClose,
  facilityType,
  date,
  startTime,
  availability,
  defaultBookingType = BookingType.SHARED,
  defaultEquipment = [],
  onBookingSuccess,
}: BookingDialogProps) {
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(30)
  const [selectedBookingType, setSelectedBookingType] = useState<BookingType>(defaultBookingType)
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType[]>(defaultEquipment)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Reset state only when the dialog opens — NOT on every prop change.
  // defaultEquipment defaults to [] in the parent, creating a new array reference
  // on every render. Watching it directly causes equipment to reset mid-session.
  useEffect(() => {
    if (open) {
      if (facilityType === FacilityType.GYM) {
        const prefs = loadBookingPrefs()
        setSelectedBookingType(prefs?.bookingType ?? defaultBookingType)
        setSelectedDuration(prefs?.duration ?? 30)
        setSelectedEquipment(prefs?.equipment ?? defaultEquipment)
      } else {
        setSelectedBookingType(defaultBookingType)
        setSelectedEquipment(defaultEquipment)
      }
      setError("")
      setSuccess("")
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error && error.includes("booked this timeslot yesterday")) setError("")
  }, [selectedBookingType, error])

  const MAX_EQUIPMENT = 3

  const toggleEquipment = (item: EquipmentType) => {
    setSelectedEquipment((prev) => {
      if (prev.includes(item)) return prev.filter((e) => e !== item)
      if (prev.length >= MAX_EQUIPMENT) return prev
      return [...prev, item]
    })
  }

  const slot = availability?.durations?.find((d) => d.duration === selectedDuration)
  const totalQueueCount = availability?.durations?.reduce((sum, d) => sum + d.queueCount, 0) ?? 0

  // Collect all user bookings across all durations (deduped by id)
  const existingUserBookings = (() => {
    const seen = new Set<string>()
    const all: NonNullable<SlotAvailability["durations"][number]["userBooking"]>[] = []
    for (const d of availability?.durations ?? []) {
      const bookings: typeof all = d.userBookings ?? (d.userBooking ? [d.userBooking] : [])
      for (const b of bookings) {
        if (!seen.has(b.id)) { seen.add(b.id); all.push(b) }
      }
    }
    return all
  })()
  const existingUserBooking = existingUserBookings[0] ?? null
  const existingUserQueueEntry = availability?.durations?.find((d) => d.userQueueEntry !== null)?.userQueueEntry ?? null

  const isSharedGym = facilityType === FacilityType.GYM && selectedBookingType === BookingType.SHARED
  const needsEquipment = isSharedGym && selectedEquipment.length === 0

  const minutesUntilBooking = (() => {
    const [h, m] = startTime.split(":").map(Number)
    const start = new Date(date)
    start.setHours(h, m, 0, 0)
    return (start.getTime() - Date.now()) / (1000 * 60)
  })()
  const canCancel = minutesUntilBooking > 30

  const handleCancelBooking = async () => {
    if (existingUserBookings.length === 0) return
    if (!confirm("Cancel this booking?")) return
    setLoading(true)
    setError("")
    try {
      const results = await Promise.all(
        existingUserBookings.map((b) => fetch(`/api/bookings/${b.id}`, { method: "DELETE" }))
      )
      const failed = results.find((r) => !r.ok)
      if (failed) setError((await failed.json()).error || "Failed to cancel booking")
      else { onBookingSuccess?.(); onClose() }
    } catch { setError("Failed to cancel booking") }
    finally { setLoading(false) }
  }

  const handleLeaveQueue = async () => {
    if (!existingUserQueueEntry) return
    if (!confirm("Leave this queue?")) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/queue/${existingUserQueueEntry.id}`, { method: "DELETE" })
      if (response.ok) { onBookingSuccess?.(); onClose() }
      else setError((await response.json()).error || "Failed to leave queue")
    } catch { setError("Failed to leave queue") }
    finally { setLoading(false) }
  }

  const handleBook = async () => {
    setError("")
    setLoading(true)

    // For shared gym, create one booking per selected equipment
    const equipmentItems: (EquipmentType | undefined)[] =
      isSharedGym ? selectedEquipment : [undefined]

    const createdIds: string[] = []

    try {
      for (const equipment of equipmentItems) {
        const bookingData: BookingPayload = {
          facilityType,
          bookingType: selectedBookingType,
          date: format(date, "yyyy-MM-dd"),
          startTime,
          duration: selectedDuration,
          ...(equipment && { equipmentType: equipment }),
        }
        const response = await fetch("/api/bookings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        })
        const data = await response.json()
        if (!response.ok) {
          // Roll back any bookings already created in this batch
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
      const currentPrefs = loadBookingPrefs()
      saveBookingPrefs({
        amenity: facilityType === FacilityType.GYM ? "gym" : "sauna",
        bookingType: selectedBookingType,
        duration: selectedDuration,
        equipment: facilityType === FacilityType.GYM ? selectedEquipment : (currentPrefs?.equipment ?? []),
      })
      onBookingSuccess?.()
      onClose()
    } catch {
      // Roll back any bookings already created in this batch
      if (createdIds.length > 0) {
        await Promise.allSettled(
          createdIds.map(id => fetch(`/api/bookings/${id}`, { method: "DELETE" }))
        )
      }
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleJoinQueue = async () => {
    setError("")
    setSuccess("")
    setLoading(true)
    // Queue for the first selected equipment (or none for exclusive/sauna)
    const equipment = isSharedGym ? selectedEquipment[0] : undefined
    try {
      const queueData: BookingPayload = {
        facilityType,
        bookingType: selectedBookingType,
        date: format(date, "yyyy-MM-dd"),
        startTime,
        duration: selectedDuration,
        ...(equipment && { equipmentType: equipment }),
      }
      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queueData),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Failed to join queue")
        setLoading(false)
        return
      }
      const isWaitlist =
        (exclusiveBlockedByAntiHoarding && selectedBookingType === BookingType.EXCLUSIVE) ||
        (sharedBlockedByAntiHoarding && selectedBookingType === BookingType.SHARED)

      setSuccess(
        isWaitlist
          ? "You've joined the waitlist! We'll release it to you 1 hour before the session if no one books."
          : `You're in the queue! Position: ${data.queueEntry.position}`
      )
      setLoading(false)
      setTimeout(() => { onBookingSuccess?.(); onClose() }, 2000)
    } catch {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const canBookExclusive = slot?.exclusive?.status === "available"
  const canBookShared =
    facilityType === FacilityType.GYM
      ? Object.values(slot?.shared ?? {}).some((s) => s === "available")
      : slot?.shared?.capacity === "available"

  const exclusivePhysicallyTaken =
    slot?.exclusive?.status === "booked" || slot?.exclusive?.status === "blocked"
  const sharedPhysicallyTaken =
    facilityType === FacilityType.GYM
      ? Object.values(slot?.shared ?? {}).every((s) => s === "booked" || s === "blocked" || s === "full")
      : slot?.shared?.capacity === "booked" || slot?.shared?.capacity === "blocked" || slot?.shared?.capacity === "full"

  const exclusiveBlockedByAntiHoarding = slot?.exclusive?.status === "unavailable"
  const sharedBlockedByAntiHoarding =
    facilityType === FacilityType.GYM
      ? Object.values(slot?.shared ?? {}).some((s) => s === "unavailable")
      : slot?.shared?.capacity === "unavailable"

  const antiHoardingReason = slot?.exclusive?.reason ?? ""
  const canBookSelectedType =
    selectedBookingType === BookingType.EXCLUSIVE ? canBookExclusive : canBookShared

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-[500px]",
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
          <DialogTitle className="text-xl sm:text-lg">
            {existingUserBooking
              ? "Your Booking"
              : existingUserQueueEntry
              ? "Your Queue Entry"
              : `Book ${facilityType === FacilityType.GYM ? "Gym" : "Sauna"}`}
          </DialogTitle>
          <DialogDescription className="text-base sm:text-sm">
            {format(date, "EEEE, MMMM d, yyyy")} at {startTime}
          </DialogDescription>
        </DialogHeader>

        {existingUserBooking ? (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-blue-900">You have a booking here</h3>
                <Badge variant={existingUserBooking.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
                  {existingUserBooking.bookingType}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {availability?.durations?.find((d) => d.userBooking !== null)?.duration} minutes
                  </span>
                </div>
                {existingUserBookings.some((b) => b.equipmentType) && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Equipment:</span>
                    <span className="font-medium text-right">
                      {existingUserBookings
                        .filter((b) => b.equipmentType)
                        .map((b) => EQUIPMENT_LABELS[b.equipmentType!])
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {!canCancel && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                Cancellations are not allowed within 30 minutes of the start time.
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button variant="destructive" onClick={handleCancelBooking} disabled={loading || !canCancel}>
                {loading ? "Cancelling…" : "Cancel Booking"}
              </Button>
            </div>
          </div>
        ) : existingUserQueueEntry ? (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-blue-900">You are in the queue</h3>
                <Badge variant="outline" className="bg-blue-600 text-white border-blue-600">
                  Position: {existingUserQueueEntry.position}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {availability?.durations?.find((d) => d.userQueueEntry !== null)?.duration} minutes
                  </span>
                </div>
                {existingUserQueueEntry.equipmentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Equipment:</span>
                    <span className="font-medium">
                      {EQUIPMENT_LABELS[existingUserQueueEntry.equipmentType]}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button variant="destructive" onClick={handleLeaveQueue} disabled={loading}>
                {loading ? "Leaving…" : "Leave Queue"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Duration</Label>
                <div className="flex gap-3">
                  {([30, 60] as const).map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="lg"
                      variant={selectedDuration === d ? "default" : "outline"}
                      onClick={() => setSelectedDuration(d)}
                      className="flex-1 min-h-[48px] text-base"
                    >
                      {d} minutes
                    </Button>
                  ))}
                </div>
              </div>

              {/* Booking type — gym only */}
              {facilityType === FacilityType.GYM && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Session type</Label>
                  <div className="flex rounded-md overflow-hidden border border-outline-variant">
                    <button
                      onClick={() => setSelectedBookingType(BookingType.SHARED)}
                      className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                        selectedBookingType === BookingType.SHARED
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                      )}
                    >
                      Shared
                    </button>
                    <button
                      onClick={() => setSelectedBookingType(BookingType.EXCLUSIVE)}
                      className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                        selectedBookingType === BookingType.EXCLUSIVE
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                      )}
                    >
                      Private
                    </button>
                  </div>
                </div>
              )}

              {/* Equipment — shared gym only, multi-select */}
              {isSharedGym && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Equipment you'll use <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500">
                    Select up to {MAX_EQUIPMENT} items — other residents can see what's free
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EQUIPMENT_LIST.map(([value, label]) => {
                      const status = slot?.shared?.[value]
                      const sharedInUse = status === "booked"
                      const taken = status === "blocked" || status === "full"
                      const active = selectedEquipment.includes(value)
                      const atLimit = selectedEquipment.length >= MAX_EQUIPMENT && !active
                      return (
                        <Button
                          key={value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          onClick={() => !taken && toggleEquipment(value)}
                          disabled={taken || atLimit}
                          className={cn(
                            "h-12 text-sm justify-start",
                            sharedInUse && !active && "border-yellow-400 bg-yellow-50 hover:bg-yellow-100 text-yellow-900"
                          )}
                        >
                          {label}
                          {sharedInUse && !active && <span className="ml-auto text-xs text-yellow-700 font-semibold">Share</span>}
                          {taken && <span className="ml-auto text-xs opacity-60">Taken</span>}
                        </Button>
                      )
                    })}
                  </div>
                  {selectedEquipment.length >= MAX_EQUIPMENT && (
                    <p className="text-xs text-amber-600">
                      Using more than {MAX_EQUIPMENT} pieces? Book a Private Gym session instead.
                    </p>
                  )}
                </div>
              )}

              {/* Existing booking notice */}
              {slot?.userBooking && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-medium text-blue-900">You already have a booking here</p>
                  <p className="text-blue-700">
                    {slot.userBooking.bookingType === "EXCLUSIVE"
                      ? "Private session"
                      : slot.userBooking.equipmentType
                      ? EQUIPMENT_LABELS[slot.userBooking.equipmentType]
                      : "Shared"}
                  </p>
                </div>
              )}

              {error && !error.includes("booked this timeslot yesterday") && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{success}</div>
              )}

              {/* Anti-hoarding waitlist banner */}
              {exclusiveBlockedByAntiHoarding && selectedBookingType === BookingType.EXCLUSIVE && !slot?.userBooking && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-sm font-semibold text-amber-900">Waitlist available</p>
                  <p className="text-xs text-amber-800 mt-1">{antiHoardingReason}</p>
                  <p className="text-xs text-amber-700 mt-2">
                    Join the waitlist — if no one books, we'll release it to you 1 hour before the session.
                  </p>
                </div>
              )}

              {/* Slot full banner */}
              {!canBookExclusive && !canBookShared && !exclusiveBlockedByAntiHoarding && !sharedBlockedByAntiHoarding && !slot?.userBooking && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Fully booked</p>
                      <p className="text-xs text-blue-700 mt-1">
                        {totalQueueCount > 0
                          ? <><strong>{totalQueueCount}</strong> {totalQueueCount === 1 ? "person" : "people"} waiting</>
                          : "No one in queue yet — be first!"}
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{totalQueueCount}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {needsEquipment && (
                <p className="text-xs text-amber-600 text-right">Select at least one piece of equipment to continue</p>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose} disabled={loading} size="lg" className="min-h-[48px] text-base">
                  Close
                </Button>

                {!canBookSelectedType && !slot?.userBooking && (
                  <Button
                    onClick={handleJoinQueue}
                    disabled={loading || needsEquipment}
                    variant="secondary"
                    size="lg"
                    className="min-h-[48px] text-base"
                  >
                    {loading
                      ? "Joining…"
                      : (exclusiveBlockedByAntiHoarding && selectedBookingType === BookingType.EXCLUSIVE) ||
                        (sharedBlockedByAntiHoarding && selectedBookingType === BookingType.SHARED)
                      ? "Join Waitlist"
                      : "Join Queue"}
                  </Button>
                )}

                {canBookSelectedType && !slot?.userBooking && (
                  <Button
                    onClick={handleBook}
                    disabled={loading || needsEquipment}
                    size="lg"
                    className="min-h-[48px] text-base"
                  >
                    {loading ? "Booking…" : "Confirm Booking"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
