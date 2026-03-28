"use client"

import { cn } from "@/lib/utils"
import { FacilityType, EquipmentType } from "@prisma/client"

interface TimeSlotProps {
  date: Date
  startTime: string
  availability: any
  loading: boolean
  facilityType: FacilityType
  equipmentFilter?: EquipmentType | 'all'
  onSelect: (availability: any) => void
}

export function TimeSlot({
  date,
  startTime,
  availability,
  loading,
  facilityType,
  equipmentFilter = 'all',
  onSelect
}: TimeSlotProps) {
  // Only show loading placeholder if we're actually in a loading state
  // AND there's no data available
  if (!availability || !availability.durations || availability.durations.length === 0) {
    // If loading is false but we have no data, render as available
    // This prevents gray cells during refetches
    if (!loading) {
      return (
        <button
          onClick={() => onSelect({ durations: [] })}
          className="p-1 border-l border-b h-12 bg-green-50 hover:bg-green-100 border-green-200 cursor-pointer"
        />
      )
    }

    // Actually loading - show gray placeholder
    return (
      <div className="p-1 border-l border-b h-12 bg-gray-50 animate-pulse" />
    )
  }

  // Check ALL durations (30 and 60 minutes) for user bookings and status
  const hasUserBooking = availability.durations.some((d: any) => d.userBooking)

  // Use 30-minute slot as primary for display, but check both durations
  const slot30 = availability.durations.find((d: any) => d.duration === 30)
  const slot60 = availability.durations.find((d: any) => d.duration === 60)

  // Check if ANY duration is blocked
  const isBlocked = availability.durations.some((d: any) => d.exclusive?.status === "blocked")

  // Check if ALL durations are fully booked
  // Only show as red/full if there's no way to book any duration
  const isFullyBooked = availability.durations.every((d: any) => {
    const allSharedBooked = d.shared && Object.values(d.shared).every(
      (status: any) => status === "booked" || status === "full"
    )
    return d.exclusive?.status === "booked" || d.bookedCount >= 2 || allSharedBooked
  })

  // Check if partially booked
  const isPartiallyBooked = !isFullyBooked && availability.durations.some((d: any) => d.bookedCount > 0)

  // Check if unavailable (anti-hoarding) - BOTH exclusive AND all shared must be unavailable
  const isUnavailable = !isBlocked && !isFullyBooked &&
    availability.durations.every((d: any) => {
      const exclusiveUnavailable = d.exclusive?.status === "unavailable"
      const allSharedUnavailable = d.shared && Object.values(d.shared).every(
        (status: any) => status === "unavailable" || status === "booked" || status === "blocked" || status === "full"
      )
      // Only consider unavailable if BOTH are unavailable
      return exclusiveUnavailable && allSharedUnavailable
    })

  // Check for user queue entry
  const userQueueEntry = availability?.durations?.find((d: any) => d.userQueueEntry)?.userQueueEntry
  const hasUserQueueEntry = !!userQueueEntry

  // Determine if user's queue entry is a waitlist (anti-hoarding)
  const isWaitlist = userQueueEntry && (
    slot30?.exclusive?.status === "unavailable" ||
    slot60?.exclusive?.status === "unavailable"
  )

  // Equipment filter logic - show filtered slots as unavailable
  let isFilteredOut = false
  if (equipmentFilter !== 'all' && facilityType === FacilityType.GYM && availability) {
    // Check if filtered equipment is available
    const equipmentAvailable =
      slot30?.shared?.[equipmentFilter] === "available" ||
      slot60?.shared?.[equipmentFilter] === "available"

    const hasUserBookingThisEquipment =
      slot30?.userBooking?.equipmentType === equipmentFilter ||
      slot60?.userBooking?.equipmentType === equipmentFilter

    const hasUserQueueThisEquipment =
      slot30?.userQueueEntry?.equipmentType === equipmentFilter ||
      slot60?.userQueueEntry?.equipmentType === equipmentFilter

    // Mark as filtered if equipment not available and user doesn't have booking/queue for it
    isFilteredOut = !equipmentAvailable && !hasUserBookingThisEquipment && !hasUserQueueThisEquipment
  }

  let status = "available"
  let bgColor = "bg-green-50 hover:bg-green-100"
  let borderColor = "border-green-200"

  if (hasUserBooking) {
    status = "yours"
    bgColor = "bg-blue-100"
    borderColor = "border-blue-300"
  } else if (hasUserQueueEntry) {
    // User has queue entry - different color for waitlist vs regular queue
    status = isWaitlist ? "waitlist" : "queue"
    bgColor = isWaitlist ? "bg-amber-100" : "bg-orange-100"
    borderColor = isWaitlist ? "border-amber-300" : "border-orange-300"
  } else if (isBlocked) {
    status = "blocked"
    bgColor = "bg-purple-100"
    borderColor = "border-purple-300"
  } else if (isFilteredOut) {
    // Equipment filter: show as unavailable/red
    status = "filtered"
    bgColor = "bg-red-50"
    borderColor = "border-red-200"
  } else if (isFullyBooked) {
    status = "full"
    bgColor = "bg-red-50 hover:bg-red-100"
    borderColor = "border-red-200"
  } else if (isPartiallyBooked) {
    status = "partial"
    bgColor = "bg-yellow-50 hover:bg-yellow-100"
    borderColor = "border-yellow-200"
  } else if (isUnavailable) {
    status = "unavailable"
    // Show as red (like full) so users know they can join queue
    bgColor = "bg-red-50 hover:bg-red-100"
    borderColor = "border-red-200"
  }

  const now = new Date()
  const slotDateTime = new Date(date)
  const [hour, minute] = startTime.split(':').map(Number)
  slotDateTime.setHours(hour, minute, 0, 0)
  const isPast = slotDateTime < now

  // Return empty cell for past slots
  if (isPast) {
    return (
      <div className="p-1 border-l border-b h-12 bg-gray-50" />
    )
  }

  return (
    <button
      onClick={() => onSelect(availability)}
      className={cn(
        "p-1 border-l border-b h-12 text-xs flex flex-col items-center justify-center relative transition-colors cursor-pointer",
        bgColor,
        borderColor
      )}
    >
      {hasUserBooking && (
        <div className="absolute top-1 left-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        </div>
      )}
      {hasUserQueueEntry && (
        <div className="absolute top-0.5 right-0.5">
          <div className={cn(
            "text-[9px] font-bold px-1 rounded",
            isWaitlist
              ? "bg-amber-600 text-white"
              : "bg-orange-600 text-white"
          )}>
            {isWaitlist ? 'W' : `#${userQueueEntry.position}`}
          </div>
        </div>
      )}
      {!hasUserBooking && !hasUserQueueEntry && isPartiallyBooked && (
        <div className="text-[10px] font-semibold text-gray-700">
          {slot30?.bookedCount || slot60?.bookedCount || 0}/2
        </div>
      )}
      {!hasUserQueueEntry && (slot30?.queueCount > 0 || slot60?.queueCount > 0) && (
        <div className="text-[9px] text-gray-500">
          Q:{Math.max(slot30?.queueCount || 0, slot60?.queueCount || 0)}
        </div>
      )}
    </button>
  )
}
