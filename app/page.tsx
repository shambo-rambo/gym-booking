"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Navbar from "@/components/Navbar"
import { WeekView } from "@/components/calendar/WeekView"
import { DayView } from "@/components/calendar/DayView"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FacilityType, EquipmentType } from "@prisma/client"

export default function Home() {
  const { data: session, status } = useSession()
  const [facilityType, setFacilityType] = useState<FacilityType>(FacilityType.GYM)
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all')
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | 'all'>('all')

  // Reset equipment filter when facility type changes
  useEffect(() => {
    setEquipmentFilter('all')
  }, [facilityType])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">Book Facilities</h1>

          {/* Instructions */}
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>How to book:</strong> Select a facility below, then click on any time slot in the calendar to make a booking.
              The calendar shows all residents' bookings in real-time. Numbers like "1/2" show how many people have booked that slot.
              Your bookings are marked with a blue dot.
            </p>
          </div>

          {/* Booking Rules Dropdown */}
          <details className="mb-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
            <summary className="cursor-pointer font-semibold text-gray-900 hover:text-gray-700">
              📋 Booking Rules (Click to expand)
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">General Rules:</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>Operating hours: 5:00 AM to 10:00 PM</li>
                  <li>Booking duration: 30 or 60 minutes</li>
                  <li>Cannot book in the past</li>
                  <li>Cannot book more than 7 days in advance</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Exclusive Bookings (Full Facility):</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>Maximum 3 active exclusive bookings per facility type</li>
                  <li>Cannot book the same timeslot as yesterday (anti-hoarding)</li>
                  <li>Next week's same slot becomes available 24 hours before the booking time</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">Shared Bookings:</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>Maximum 5 active shared bookings total</li>
                  <li>Cannot book the same timeslot more than 3 times per week</li>
                  <li>Maximum capacity: 2 people per slot (gym or sauna)</li>
                  <li>Gym equipment: Each piece can only be booked by one person per slot</li>
                </ul>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <h3 className="font-semibold text-sm mb-2 text-orange-700">⚠️ Rules To Be Implemented:</h3>
                <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                  <li>Cannot book the same time slot in consecutive weeks (e.g., Saturday 5:30am two weeks in a row). Must join the queue - slot is assigned 1 hour prior to booking time.</li>
                </ul>
              </div>
            </div>
          </details>

          {/* Facility Type - Mobile (Select) */}
          <div className="md:hidden mb-4 space-y-3">
            <Label className="text-sm font-medium">Facility</Label>
            <Select
              value={facilityType}
              onValueChange={(value) => setFacilityType(value as FacilityType)}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FacilityType.GYM}>Gym</SelectItem>
                <SelectItem value={FacilityType.SAUNA}>Sauna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Facility Type - Desktop (Buttons) */}
          <div className="hidden md:flex gap-2 mb-4">
            <Button
              variant={facilityType === FacilityType.GYM ? "default" : "outline"}
              onClick={() => setFacilityType(FacilityType.GYM)}
            >
              Gym
            </Button>
            <Button
              variant={facilityType === FacilityType.SAUNA ? "default" : "outline"}
              onClick={() => setFacilityType(FacilityType.SAUNA)}
            >
              Sauna
            </Button>
          </div>

          {/* Time Range Filter - Mobile (Select) */}
          <div className="md:hidden mb-4 space-y-3">
            <Label className="text-sm font-medium">Time Range</Label>
            <Select
              value={timeFilter}
              onValueChange={(value: any) => setTimeFilter(value)}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Day</SelectItem>
                <SelectItem value="morning">Morning (5:00-11:30)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12:00-16:30)</SelectItem>
                <SelectItem value="evening">Evening (17:00-21:30)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Range Filter - Desktop (Buttons) */}
          <div className="hidden md:block mb-4">
            <Label className="mb-2 block">Time Range</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={timeFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setTimeFilter('all')}
                size="sm"
              >
                All Day
              </Button>
              <Button
                variant={timeFilter === 'morning' ? 'default' : 'outline'}
                onClick={() => setTimeFilter('morning')}
                size="sm"
              >
                Morning (5:00-11:30)
              </Button>
              <Button
                variant={timeFilter === 'afternoon' ? 'default' : 'outline'}
                onClick={() => setTimeFilter('afternoon')}
                size="sm"
              >
                Afternoon (12:00-16:30)
              </Button>
              <Button
                variant={timeFilter === 'evening' ? 'default' : 'outline'}
                onClick={() => setTimeFilter('evening')}
                size="sm"
              >
                Evening (17:00-21:30)
              </Button>
            </div>
          </div>

          {/* Equipment Filter - Only for GYM */}
          {facilityType === FacilityType.GYM && (
            <>
              {/* Equipment Filter - Mobile (Select) */}
              <div className="md:hidden mb-4 space-y-3">
                <Label className="text-sm font-medium">Equipment</Label>
                <Select
                  value={equipmentFilter}
                  onValueChange={(value: any) => setEquipmentFilter(value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment</SelectItem>
                    <SelectItem value={EquipmentType.WEIGHTS_MACHINE}>Weights Machine</SelectItem>
                    <SelectItem value={EquipmentType.FREE_DUMBBELLS}>Free Dumbbells</SelectItem>
                    <SelectItem value={EquipmentType.TREADMILL}>Treadmill</SelectItem>
                    <SelectItem value={EquipmentType.ROWING_MACHINE}>Rowing Machine</SelectItem>
                    <SelectItem value={EquipmentType.EXERCISE_BIKE}>Exercise Bike</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Equipment Filter - Desktop (Buttons) */}
              <div className="hidden md:block mb-4">
                <Label className="mb-2 block">Equipment Filter</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={equipmentFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter('all')}
                    size="sm"
                  >
                    All Equipment
                  </Button>
                  <Button
                    variant={equipmentFilter === EquipmentType.WEIGHTS_MACHINE ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter(EquipmentType.WEIGHTS_MACHINE)}
                    size="sm"
                  >
                    Weights Machine
                  </Button>
                  <Button
                    variant={equipmentFilter === EquipmentType.FREE_DUMBBELLS ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter(EquipmentType.FREE_DUMBBELLS)}
                    size="sm"
                  >
                    Free Dumbbells
                  </Button>
                  <Button
                    variant={equipmentFilter === EquipmentType.TREADMILL ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter(EquipmentType.TREADMILL)}
                    size="sm"
                  >
                    Treadmill
                  </Button>
                  <Button
                    variant={equipmentFilter === EquipmentType.ROWING_MACHINE ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter(EquipmentType.ROWING_MACHINE)}
                    size="sm"
                  >
                    Rowing Machine
                  </Button>
                  <Button
                    variant={equipmentFilter === EquipmentType.EXERCISE_BIKE ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter(EquipmentType.EXERCISE_BIKE)}
                    size="sm"
                  >
                    Exercise Bike
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Calendar View - Mobile: DayView */}
        <div className="md:hidden">
          <DayView
            facilityType={facilityType}
            timeFilter={timeFilter}
            equipmentFilter={equipmentFilter}
          />
        </div>

        {/* Calendar View - Desktop: WeekView */}
        <div className="hidden md:block">
          <WeekView
            facilityType={facilityType}
            timeFilter={timeFilter}
            equipmentFilter={equipmentFilter}
          />
        </div>
      </main>
    </div>
  )
}
