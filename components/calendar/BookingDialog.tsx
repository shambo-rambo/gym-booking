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
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface BookingDialogProps {
  open: boolean
  onClose: () => void
  facilityType: FacilityType
  date: Date
  startTime: string
  availability: any
  onBookingSuccess?: () => void
}

export function BookingDialog({
  open,
  onClose,
  facilityType,
  date,
  startTime,
  availability,
  onBookingSuccess
}: BookingDialogProps) {
  const router = useRouter()
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(30)
  const [selectedBookingType, setSelectedBookingType] = useState<BookingType>(BookingType.SHARED)
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Clear anti-hoarding errors when booking type changes
  useEffect(() => {
    if (error && error.includes("booked this timeslot yesterday")) {
      setError("")
    }
  }, [selectedBookingType, error])

  const slot = availability?.durations?.find((d: any) => d.duration === selectedDuration)

  // Calculate total queue count across all durations for this time slot
  const totalQueueCount = availability?.durations?.reduce((sum: number, d: any) => sum + (d.queueCount || 0), 0) || 0

  // Check if user has an existing booking at this time (any duration)
  const existingUserBooking = availability?.durations?.find((d: any) => d.userBooking)?.userBooking

  // Check if user has an existing queue entry at this time (any duration)
  const existingUserQueueEntry = availability?.durations?.find((d: any) => d.userQueueEntry)?.userQueueEntry

  const handleCancelBooking = async () => {
    if (!existingUserBooking) return
    if (!confirm("Are you sure you want to cancel this booking?")) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/bookings/${existingUserBooking.id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        onBookingSuccess?.()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to cancel booking")
      }
    } catch (error) {
      setError("Failed to cancel booking")
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveQueue = async () => {
    if (!existingUserQueueEntry) return
    if (!confirm("Are you sure you want to leave this queue?")) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/queue/${existingUserQueueEntry.id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        onBookingSuccess?.()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || "Failed to leave queue")
      }
    } catch (error) {
      setError("Failed to leave queue")
    } finally {
      setLoading(false)
    }
  }

  const handleJoinQueue = async () => {
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const queueData: any = {
        facilityType,
        bookingType: selectedBookingType,
        date: format(date, "yyyy-MM-dd"),
        startTime,
        duration: selectedDuration
      }

      // Only include equipmentType if it's not null
      if (selectedEquipment) {
        queueData.equipmentType = selectedEquipment
      }

      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queueData)
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to join queue")
        setLoading(false)
        return
      }

      // Success! Show different message for waitlist (anti-hoarding) vs regular queue
      const isWaitlist = (exclusiveBlockedByAntiHoarding && selectedBookingType === BookingType.EXCLUSIVE) ||
                         (sharedBlockedByAntiHoarding && selectedBookingType === BookingType.SHARED)

      if (isWaitlist) {
        setSuccess("You have joined the waitlist! If no one books this spot, we'll release it to you 1 hour before the session starts.")
      } else {
        setSuccess(`You're in the queue! Position: ${data.queueEntry.position}`)
      }

      setLoading(false)
      setTimeout(() => {
        onBookingSuccess?.()
        onClose()
      }, 2000)

    } catch (err) {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleBook = async () => {
    setError("")
    setLoading(true)

    try {
      const bookingData: any = {
        facilityType,
        bookingType: selectedBookingType,
        date: format(date, "yyyy-MM-dd"),
        startTime,
        duration: selectedDuration
      }

      // Only include equipmentType if it's not null
      if (selectedEquipment) {
        bookingData.equipmentType = selectedEquipment
      }

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData)
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Booking error:", data)
        setError(data.error || "Failed to create booking")
        setLoading(false)
        return
      }

      // Success!
      onBookingSuccess?.()
      onClose()
      // Don't use router.refresh() - it causes full page reload and state reset
      // onBookingSuccess already refetches the data

    } catch (err) {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const canBookExclusive = slot?.exclusive?.status === "available"
  const canBookShared = facilityType === FacilityType.GYM
    ? Object.values(slot?.shared || {}).some((s: any) => s === "available")
    : slot?.shared?.capacity === "available"

  // Check if slots are physically taken (not just unavailable due to anti-hoarding)
  const exclusivePhysicallyTaken = slot?.exclusive?.status === "booked" || slot?.exclusive?.status === "blocked"
  const sharedPhysicallyTaken = facilityType === FacilityType.GYM
    ? Object.values(slot?.shared || {}).every((s: any) => s === "booked" || s === "blocked" || s === "full")
    : slot?.shared?.capacity === "booked" || slot?.shared?.capacity === "blocked" || slot?.shared?.capacity === "full"

  // Check if unavailable due to anti-hoarding rules
  const exclusiveBlockedByAntiHoarding = slot?.exclusive?.status === "unavailable"
  const sharedBlockedByAntiHoarding = facilityType === FacilityType.GYM
    ? Object.values(slot?.shared || {}).some((s: any) => s === "unavailable")
    : slot?.shared?.capacity === "unavailable"

  // Get the anti-hoarding reason if it exists
  const antiHoardingReason = slot?.exclusive?.reason || ""

  // Check if the SELECTED booking type can be booked
  const canBookSelectedType = selectedBookingType === BookingType.EXCLUSIVE
    ? canBookExclusive
    : canBookShared

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={cn(
        // Desktop: centered modal
        "sm:max-w-[500px]",
        // Mobile: bottom sheet
        "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0",
        "max-sm:top-auto max-sm:translate-y-0 max-sm:translate-x-0",
        "max-sm:rounded-t-2xl max-sm:rounded-b-none",
        "max-sm:max-h-[90vh] max-sm:overflow-y-auto"
      )}>
        {/* Drag handle for mobile */}
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
          // Show existing booking details
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
                    {availability?.durations?.find((d: any) => d.userBooking)?.duration} minutes
                  </span>
                </div>
                {existingUserBooking.equipmentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Equipment:</span>
                    <span className="font-medium">
                      {existingUserBooking.equipmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelBooking}
                disabled={loading}
              >
                {loading ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        ) : existingUserQueueEntry ? (
          // Show existing queue entry details
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
                  <span className="text-gray-600">Booking Type:</span>
                  <Badge variant={existingUserQueueEntry.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
                    {existingUserQueueEntry.bookingType}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {availability?.durations?.find((d: any) => d.userQueueEntry)?.duration} minutes
                  </span>
                </div>
                {existingUserQueueEntry.equipmentType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Equipment:</span>
                    <span className="font-medium">
                      {existingUserQueueEntry.equipmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleLeaveQueue}
                disabled={loading}
              >
                {loading ? "Leaving..." : "Leave Queue"}
              </Button>
            </div>
          </div>
        ) : (
          // Show booking form
          <>
            <div className="space-y-4 py-4">
              {/* Duration Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Duration</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    size="lg"
                    variant={selectedDuration === 30 ? "default" : "outline"}
                    onClick={() => setSelectedDuration(30)}
                    className="flex-1 min-h-[48px] text-base"
                  >
                    30 minutes
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={selectedDuration === 60 ? "default" : "outline"}
                    onClick={() => setSelectedDuration(60)}
                    className="flex-1 min-h-[48px] text-base"
                  >
                    60 minutes
                  </Button>
                </div>
              </div>

              {/* Booking Type Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Booking Type</Label>
                {!canBookSelectedType && (
                  <p className="text-xs text-blue-600">
                    Select the type of booking you want to {
                      (exclusiveBlockedByAntiHoarding || sharedBlockedByAntiHoarding)
                        ? "join the waitlist for"
                        : "queue for"
                    }
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    size="lg"
                    variant={selectedBookingType === BookingType.SHARED ? "default" : "outline"}
                    onClick={() => setSelectedBookingType(BookingType.SHARED)}
                    disabled={sharedPhysicallyTaken}
                    className="flex-1 min-h-[48px] text-base"
                  >
                    Shared
                    {sharedPhysicallyTaken && (
                      <Badge variant="secondary" className="ml-2">Full</Badge>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={selectedBookingType === BookingType.EXCLUSIVE ? "default" : "outline"}
                    onClick={() => setSelectedBookingType(BookingType.EXCLUSIVE)}
                    disabled={exclusivePhysicallyTaken}
                    className="flex-1 min-h-[48px] text-base"
                  >
                    Exclusive
                    {exclusivePhysicallyTaken && (
                      <Badge variant="secondary" className="ml-2">Taken</Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Equipment Selection (for shared gym bookings) */}
              {facilityType === FacilityType.GYM && selectedBookingType === BookingType.SHARED && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Equipment <span className="text-red-500">*</span></Label>
                  <p className="text-xs text-gray-600">
                    {!canBookSelectedType
                      ? (sharedBlockedByAntiHoarding ? "Select equipment to join waitlist for" : "Select equipment to join queue for")
                      : "Select which equipment you'll use"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { value: EquipmentType.WEIGHTS_MACHINE, label: "Weights Machine" },
                      { value: EquipmentType.FREE_DUMBBELLS, label: "Free Dumbbells" },
                      { value: EquipmentType.TREADMILL, label: "Treadmill" },
                      { value: EquipmentType.ROWING_MACHINE, label: "Rowing Machine" },
                      { value: EquipmentType.EXERCISE_BIKE, label: "Exercise Bike" },
                    ].map((equipment) => {
                      const equipmentStatus = slot?.shared?.[equipment.value]
                      const isAvailable = equipmentStatus === "available"
                      const isPhysicallyTaken = equipmentStatus === "booked" || equipmentStatus === "blocked" || equipmentStatus === "full"

                      // Only disable if physically taken (not just unavailable due to anti-hoarding)
                      const shouldDisable = isPhysicallyTaken

                      return (
                        <Button
                          key={equipment.value}
                          type="button"
                          variant={selectedEquipment === equipment.value ? "default" : "outline"}
                          onClick={() => setSelectedEquipment(equipment.value)}
                          disabled={shouldDisable}
                          className="h-14 text-base justify-start"
                        >
                          {equipment.label}
                          {isPhysicallyTaken && <span className="ml-auto text-xs">Taken</span>}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* User's existing booking notice */}
              {slot?.userBooking && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-medium text-blue-900">You already have a booking here</p>
                  <p className="text-blue-700">
                    {slot.userBooking.bookingType === "EXCLUSIVE" ? "Exclusive" : `Shared - ${slot.userBooking.equipmentType}`}
                  </p>
                </div>
              )}

              {/* Error message - but don't show anti-hoarding errors, they're shown in the waitlist banner */}
              {error && !error.includes("booked this timeslot yesterday") && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Success message */}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              {/* Anti-hoarding waitlist banner */}
              {(exclusiveBlockedByAntiHoarding && selectedBookingType === BookingType.EXCLUSIVE) && !slot?.userBooking && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    Waitlist Available
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    {antiHoardingReason}
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Join the waitlist - if no one books this spot, we'll release it to you 1 hour before the session starts.
                  </p>
                </div>
              )}

              {/* Queue info banner - show when slot is physically full */}
              {!canBookExclusive && !canBookShared && !exclusiveBlockedByAntiHoarding && !sharedBlockedByAntiHoarding && !slot?.userBooking && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        This slot is fully booked
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {totalQueueCount > 0 ? (
                          <>
                            <strong>{totalQueueCount}</strong> {totalQueueCount === 1 ? "person is" : "people are"} already waiting in queue
                          </>
                        ) : (
                          "No one in queue yet - be the first!"
                        )}
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {totalQueueCount}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {/* Helper text when equipment not selected for queue/waitlist */}
              {!canBookSelectedType && !slot?.userBooking &&
                selectedBookingType === BookingType.SHARED &&
                facilityType === FacilityType.GYM &&
                !selectedEquipment && (
                  <p className="text-xs text-amber-600 text-right">
                    Please select equipment to {sharedBlockedByAntiHoarding ? "join the waitlist" : "join the queue"}
                  </p>
                )}

              {/* Helper text when equipment not selected for booking */}
              {canBookSelectedType &&
                selectedBookingType === BookingType.SHARED &&
                facilityType === FacilityType.GYM &&
                !selectedEquipment && (
                  <p className="text-xs text-amber-600 text-right">
                    Please select equipment to continue
                  </p>
                )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  size="lg"
                  className="min-h-[48px] text-base"
                >
                  Close
                </Button>

                {/* Show Join Waitlist/Queue button if selected type is unavailable */}
                {!canBookSelectedType && !slot?.userBooking && (
                  <Button
                    onClick={handleJoinQueue}
                    disabled={
                      loading ||
                      (selectedBookingType === BookingType.SHARED &&
                        facilityType === FacilityType.GYM &&
                        !selectedEquipment)
                    }
                    variant="secondary"
                    size="lg"
                    className="min-h-[48px] text-base"
                  >
                    {loading ? "Joining..." : (
                      (exclusiveBlockedByAntiHoarding && selectedBookingType === BookingType.EXCLUSIVE) ||
                      (sharedBlockedByAntiHoarding && selectedBookingType === BookingType.SHARED)
                        ? "Join Waitlist"
                        : "Join Queue"
                    )}
                  </Button>
                )}

                {/* Show Book button if selected type is available */}
                {canBookSelectedType && !slot?.userBooking && (
                  <Button
                    onClick={handleBook}
                    disabled={
                      loading ||
                      (selectedBookingType === BookingType.SHARED &&
                        facilityType === FacilityType.GYM &&
                        !selectedEquipment)
                    }
                    size="lg"
                    className="min-h-[48px] text-base"
                  >
                    {loading ? "Booking..." : "Confirm Booking"}
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
