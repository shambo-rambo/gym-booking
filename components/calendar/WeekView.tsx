"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns"
import { Button } from "@/components/ui/button"
import { TimeSlot } from "./TimeSlot"
import { BookingDialog } from "./BookingDialog"
import { FacilityType, EquipmentType } from "@prisma/client"

interface WeekViewProps {
  facilityType: FacilityType
  timeFilter?: 'all' | 'morning' | 'afternoon' | 'evening'
  equipmentFilter?: EquipmentType | 'all'
}

export function WeekView({
  facilityType,
  timeFilter = 'all',
  equipmentFilter = 'all'
}: WeekViewProps) {
  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date
    startTime: string
    availability: any
  } | null>(null)
  const [availabilityData, setAvailabilityData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const hasLoadedDataRef = useRef(false)
  const currentWeekKeyRef = useRef<string>("")

  const days = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 })

    // If currentWeek is current week, show from today onwards
    if (currentWeekStart.getTime() === todayWeekStart.getTime()) {
      const daysFromToday = 7 - today.getDay() + (today.getDay() === 0 ? 1 : 0)
      const daysToShow = Math.min(7, daysFromToday + 1)
      return Array.from({ length: daysToShow }, (_, i) => addDays(today, i))
    }

    // For future weeks, calculate days within 7-day limit
    const maxDate = addDays(today, 7)
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
    return weekDays.filter(day => day <= maxDate && day >= today)
  }, [currentWeek])

  // Reset loaded flag when week or facility changes, but DON'T clear data
  // Let the fetch replace the data to prevent gray cells during transition
  useEffect(() => {
    const weekKey = `${format(currentWeek, "yyyy-MM-dd")}-${facilityType}`

    if (weekKey !== currentWeekKeyRef.current) {
      currentWeekKeyRef.current = weekKey
      hasLoadedDataRef.current = false
      // Don't clear data here - let fetchWeekAvailability replace it atomically
    }
  }, [currentWeek, facilityType])

  const fetchWeekAvailability = useCallback(async () => {
    // Show loading only if we haven't loaded data for this week yet
    if (!hasLoadedDataRef.current) {
      setLoading(true)
    }

    // Fetch all days' data
    const results = await Promise.all(
      days.map(async (day) => {
        const dateStr = format(day, "yyyy-MM-dd")
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
      })
    )

    // Build new data object
    const newData: Record<string, any> = {}
    results.forEach(result => {
      if (result) {
        newData[result.dateStr] = result.data
      }
    })

    // Update state atomically - React 18 automatically batches these updates
    // Set data first, then loading state to ensure data is available before re-render
    setAvailabilityData(newData)
    setLoading(false)
    hasLoadedDataRef.current = true
  }, [days, facilityType])

  useEffect(() => {
    fetchWeekAvailability()
  }, [fetchWeekAvailability])

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

    // Filter out past slots
    const now = new Date()
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes()

    const visibleSlots = filteredSlots.filter(time => {
      const [hour, minute] = time.split(':').map(Number)
      const slotTimeInMinutes = hour * 60 + minute

      // Check if any day showing this slot is today and the slot has passed
      const hasPassed = days.some(day => {
        const isToday = day.toDateString() === now.toDateString()
        return isToday && slotTimeInMinutes < currentTimeInMinutes
      })

      return !hasPassed
    })

    setVisibleTimeSlots(visibleSlots)
  }, [timeFilter, days])

  const canGoNext = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const maxDate = addDays(today, 7)
    const nextWeekStart = addWeeks(currentWeek, 1)
    return nextWeekStart <= maxDate
  }, [currentWeek])

  const canGoPrev = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const prevWeekStart = subWeeks(currentWeek, 1)
    const prevWeekEnd = addDays(prevWeekStart, 6)
    return prevWeekEnd >= today
  }, [currentWeek])

  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1))
  const prevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1))
  const today = () => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {format(currentWeek, "MMMM yyyy")}
          </h2>
          {days.length > 0 && (
            <p className="text-sm text-gray-600">
              {format(days[0], "MMM d")} - {format(days[days.length - 1], "MMM d")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={prevWeek}
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
          >
            Previous
          </Button>
          <Button onClick={today} variant="outline" size="sm">
            Today
          </Button>
          <Button
            onClick={nextWeek}
            variant="outline"
            size="sm"
            disabled={!canGoNext}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-200 rounded" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded relative">
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold">1/2</span>
          </div>
          <span>Partially Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded relative">
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold">2/2</span>
          </div>
          <span>Full</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded relative">
            <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-blue-500 rounded-full" />
          </div>
          <span>Your Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded relative">
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold">#1</span>
          </div>
          <span>Queue Position</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-100 border border-amber-300 rounded relative">
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold">W</span>
          </div>
          <span>Waitlist</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded" />
          <span>Blocked</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden bg-white">
        {/* Day headers */}
        <div
          className="border-b bg-gray-50"
          style={{ display: 'grid', gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}
        >
          <div className="p-2 text-sm font-medium text-gray-600">Time</div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="p-2 text-center border-l"
            >
              <div className="text-sm font-semibold">{format(day, "EEE")}</div>
              <div className="text-lg">{format(day, "d")}</div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="divide-y">
          {visibleTimeSlots.map((time) => (
            <div
              key={time}
              style={{ display: 'grid', gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}
            >
              <div className="p-2 text-sm text-gray-600 border-r bg-gray-50">
                {time}
              </div>
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd")
                const dayData = availabilityData[dateStr]
                const slot = dayData?.slots?.find((s: any) => s.startTime === time)

                return (
                  <TimeSlot
                    key={`${day.toISOString()}-${time}`}
                    date={day}
                    startTime={time}
                    availability={slot}
                    loading={loading}
                    facilityType={facilityType}
                    equipmentFilter={facilityType === FacilityType.GYM ? equipmentFilter : 'all'}
                    onSelect={(availability) => {
                      setSelectedSlot({ date: day, startTime: time, availability })
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
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
          onBookingSuccess={fetchWeekAvailability}
        />
      )}
    </div>
  )
}
