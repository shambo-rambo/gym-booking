"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { format, addDays, subDays } from "date-fns"
import { useSwipeable } from "react-swipeable"
import { Button } from "@/components/ui/button"
import { TimeSlot } from "./TimeSlot"
import { BookingDialog } from "./BookingDialog"
import { FacilityType, EquipmentType } from "@prisma/client"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DayViewProps {
  facilityType: FacilityType
  timeFilter?: 'all' | 'morning' | 'afternoon' | 'evening'
  equipmentFilter?: EquipmentType | 'all'
}

export function DayView({
  facilityType,
  timeFilter = 'all',
  equipmentFilter = 'all'
}: DayViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date
    startTime: string
    availability: any
  } | null>(null)
  const [availabilityData, setAvailabilityData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const hasLoadedDataRef = useRef(false)
  const currentDateKeyRef = useRef<string>("")

  // Reset loaded flag when date or facility changes
  useEffect(() => {
    const dateKey = `${format(currentDate, "yyyy-MM-dd")}-${facilityType}`

    if (dateKey !== currentDateKeyRef.current) {
      currentDateKeyRef.current = dateKey
      hasLoadedDataRef.current = false
    }
  }, [currentDate, facilityType])

  const fetchDayAvailability = useCallback(async (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    try {
      const response = await fetch(
        `/api/bookings/availability?facilityType=${facilityType}&date=${dateStr}`
      )
      if (response.ok) {
        return { dateStr, data: await response.json() }
      }
    } catch (error) {
      console.error(`Failed to fetch availability for ${dateStr}:`, error)
    }
    return null
  }, [facilityType])

  const fetchAndPrefetchAvailability = useCallback(async () => {
    // Show loading only if we haven't loaded data yet
    if (!hasLoadedDataRef.current) {
      setLoading(true)
    }

    // Fetch current day and prefetch adjacent days for smooth swipe
    const prevDay = subDays(currentDate, 1)
    const nextDay = addDays(currentDate, 1)

    const [currentResult, prevResult, nextResult] = await Promise.all([
      fetchDayAvailability(currentDate),
      fetchDayAvailability(prevDay),
      fetchDayAvailability(nextDay)
    ])

    // Build new data object
    const newData: Record<string, any> = {}
    if (currentResult) newData[currentResult.dateStr] = currentResult.data
    if (prevResult) newData[prevResult.dateStr] = prevResult.data
    if (nextResult) newData[nextResult.dateStr] = nextResult.data

    // Update state atomically
    setAvailabilityData(newData)
    setLoading(false)
    hasLoadedDataRef.current = true
  }, [currentDate, fetchDayAvailability])

  useEffect(() => {
    fetchAndPrefetchAvailability()
  }, [fetchAndPrefetchAvailability])

  const [visibleTimeSlots, setVisibleTimeSlots] = useState<string[]>([])

  useEffect(() => {
    const allSlots = [
      "05:00", "05:30", "06:00", "06:30", "07:00", "07:30",
      "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
      "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
      "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
      "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
      "20:00", "20:30", "21:00", "21:30"
    ]

    let filteredSlots = allSlots

    // Apply time range filter
    if (timeFilter === 'morning') {
      filteredSlots = allSlots.filter(time => time >= '05:00' && time <= '11:30')
    } else if (timeFilter === 'afternoon') {
      filteredSlots = allSlots.filter(time => time >= '12:00' && time <= '16:30')
    } else if (timeFilter === 'evening') {
      filteredSlots = allSlots.filter(time => time >= '17:00' && time <= '21:30')
    }

    // Filter out past slots for today
    const now = new Date()
    const isToday = currentDate.toDateString() === now.toDateString()
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes()

    const visibleSlots = filteredSlots.filter(time => {
      if (!isToday) return true

      const [hour, minute] = time.split(':').map(Number)
      const slotTimeInMinutes = hour * 60 + minute
      return slotTimeInMinutes >= currentTimeInMinutes
    })

    setVisibleTimeSlots(visibleSlots)
  }, [timeFilter, currentDate])

  const canGoNext = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const maxDate = addDays(today, 7)
    const nextDate = addDays(currentDate, 1)
    nextDate.setHours(0, 0, 0, 0)
    return nextDate <= maxDate
  }, [currentDate])

  const canGoPrev = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const prevDate = subDays(currentDate, 1)
    prevDate.setHours(0, 0, 0, 0)
    return prevDate >= today
  }, [currentDate])

  const nextDay = () => {
    if (canGoNext) {
      setCurrentDate(addDays(currentDate, 1))
    }
  }

  const prevDay = () => {
    if (canGoPrev) {
      setCurrentDate(subDays(currentDate, 1))
    }
  }

  const today = () => setCurrentDate(new Date())

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => canGoNext && nextDay(),
    onSwipedRight: () => canGoPrev && prevDay(),
    trackMouse: true, // for desktop testing
    delta: 50, // minimum swipe distance
    preventScrollOnSwipe: true
  })

  const dateStr = format(currentDate, "yyyy-MM-dd")
  const dayData = availabilityData[dateStr]

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={prevDay}
            variant="outline"
            size="icon"
            className="h-11 w-11"
            disabled={!canGoPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-[200px] text-center">
            <h2 className="text-2xl font-bold">
              {format(currentDate, "EEEE")}
            </h2>
            <p className="text-sm text-gray-600">
              {format(currentDate, "MMMM d, yyyy")}
            </p>
          </div>
          <Button
            onClick={nextDay}
            variant="outline"
            size="icon"
            className="h-11 w-11"
            disabled={!canGoNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Button onClick={today} variant="outline" size="sm">
          Today
        </Button>
      </div>

      {/* Swipe indicator hint */}
      <p className="text-xs text-center text-gray-500">
        Swipe left or right to change days
      </p>

      {/* Time slots list with swipe gesture */}
      <div {...handlers} className="space-y-2">
        {visibleTimeSlots.map((time) => {
          const slot = dayData?.slots?.find((s: any) => s.startTime === time)

          return (
            <button
              key={time}
              onClick={() => {
                setSelectedSlot({ date: currentDate, startTime: time, availability: slot })
              }}
              className="w-full min-h-[64px] border rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition-shadow bg-white"
            >
              {/* Time label */}
              <div className="text-left min-w-[80px]">
                <div className="text-base font-semibold text-gray-900">{time}</div>
                <div className="text-xs text-gray-500">
                  {parseInt(time.split(':')[0]) < 12 ? 'AM' : 'PM'}
                </div>
              </div>

              {/* Status indicator using TimeSlot component */}
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-shrink-0">
                  <TimeSlot
                    date={currentDate}
                    startTime={time}
                    availability={slot}
                    loading={loading}
                    facilityType={facilityType}
                    equipmentFilter={facilityType === FacilityType.GYM ? equipmentFilter : 'all'}
                    onSelect={(availability) => {
                      setSelectedSlot({ date: currentDate, startTime: time, availability })
                    }}
                  />
                </div>
                <div className="text-left flex-1">
                  {slot && (
                    <div className="space-y-1">
                      {slot.durations && slot.durations.map((d: any) => {
                        // Only show "Your booking" if this is where the booking actually STARTS
                        // Check if there's an earlier slot with a booking that overlaps into this one
                        const [currentHour, currentMinute] = time.split(':').map(Number)
                        const currentMinutes = currentHour * 60 + currentMinute

                        const hasEarlierBooking = visibleTimeSlots.some(earlierTime => {
                          const [earlierHour, earlierMinute] = earlierTime.split(':').map(Number)
                          const earlierMinutes = earlierHour * 60 + earlierMinute

                          if (earlierMinutes >= currentMinutes) return false

                          const earlierSlot = dayData?.slots?.find((s: any) => s.startTime === earlierTime)
                          return earlierSlot?.durations?.some((earlierDur: any) => {
                            return earlierDur.userBooking &&
                                   earlierMinutes + earlierDur.duration > currentMinutes
                          })
                        })

                        const sharedEntries: [string, string][] = d.shared ? Object.entries(d.shared) : []
                        const hasAvailableShared = sharedEntries.some(([, v]) => v === 'available')
                        const bookedSharedEquip = sharedEntries.filter(([, v]) => v === 'booked').map(([k]) => k)
                        // Use bookedSharedEquip.length rather than bookedCount: for overlapping
                        // durations (e.g. 60-min row when only a 30-min booking exists) bookedCount
                        // is 0, but the shared equipment map still shows "booked" entries.
                        const isPartialShared = d.exclusive?.status === 'booked' && hasAvailableShared && bookedSharedEquip.length > 0

                        const equipNames: Record<string, string> = {
                          WEIGHTS_MACHINE: 'Weights',
                          FREE_DUMBBELLS: 'Dumbbells',
                          TREADMILL: 'Treadmill',
                          ROWING_MACHINE: 'Rowing machine',
                          EXERCISE_BIKE: 'Exercise bike',
                        }

                        if (d.userBooking && !hasEarlierBooking) {
                          const isShared = d.userBooking.bookingType === "SHARED"
                          const myEquip = d.userBooking.equipmentType as EquipmentType | null
                          const othersEquip = isShared
                            ? bookedSharedEquip.filter((e) => e !== myEquip)
                            : []
                          return (
                            <div key={d.duration} className="text-xs">
                              <span className="font-medium text-gray-600">{d.duration} min:</span>{' '}
                              <span className="font-semibold text-blue-600">
                                Your booking · {isShared ? "Shared" : "Private"}
                              </span>
                              {isShared && myEquip && (
                                <span className="text-gray-500"> · {equipNames[myEquip] || myEquip}</span>
                              )}
                              {isShared && othersEquip.length > 0 && (
                                <span className="text-gray-500"> + {othersEquip.map(e => equipNames[e] || e).join(', ')} in use</span>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div key={d.duration} className="text-xs text-gray-600">
                            <span className="font-medium">{d.duration} min:</span>{' '}
                            {isPartialShared && (
                              <span className="font-semibold text-yellow-700">Share available</span>
                            )}
                            {!isPartialShared && d.exclusive?.status === 'available' && 'Available'}
                            {!isPartialShared && d.exclusive?.status === 'booked' && 'Full'}
                            {d.exclusive?.status === 'blocked' && 'Blocked'}
                            {d.exclusive?.status === 'unavailable' && 'Limit reached'}
                            {isPartialShared && bookedSharedEquip.length > 0 && (
                              <span className="text-gray-500"> · {bookedSharedEquip.map(e => equipNames[e] || e).join(', ')} in use</span>
                            )}
                            {isPartialShared && facilityType === FacilityType.SAUNA && (
                              <span className="text-gray-500"> · {d.bookedCount}/2 in session</span>
                            )}
                            {d.userQueueEntry && <span className="text-orange-600 font-semibold"> (In queue)</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}

        {visibleTimeSlots.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No time slots available for the selected filters
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      {selectedSlot && (
        <BookingDialog
          open={!!selectedSlot}
          onClose={() => setSelectedSlot(null)}
          facilityType={facilityType}
          date={selectedSlot.date}
          startTime={selectedSlot.startTime}
          availability={selectedSlot.availability}
          onBookingSuccess={fetchAndPrefetchAvailability}
        />
      )}
    </div>
  )
}
