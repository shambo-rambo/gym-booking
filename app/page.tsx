"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Navbar from "@/components/Navbar"
import { BookingCalendar } from "@/components/calendar/BookingCalendar"
import { FacilityType, EquipmentType } from "@prisma/client"
import { cn } from "@/lib/utils"

const EQUIPMENT_OPTIONS = [
  { value: "all",                          label: "All Equipment" },
  { value: EquipmentType.WEIGHTS_MACHINE,  label: "Weights" },
  { value: EquipmentType.FREE_DUMBBELLS,   label: "Dumbbells" },
  { value: EquipmentType.TREADMILL,        label: "Treadmill" },
  { value: EquipmentType.ROWING_MACHINE,   label: "Rowing" },
  { value: EquipmentType.EXERCISE_BIKE,    label: "Bike" },
] as const

export default function Home() {
  const { data: session, status } = useSession()
  const [facilityType, setFacilityType] = useState<FacilityType>(FacilityType.GYM)
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | "all">("all")

  useEffect(() => {
    setEquipmentFilter("all")
  }, [facilityType])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <main className="pt-20 pb-28 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mt-6 mb-8">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-1.5 block">
            Amenity Booking
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary mb-6">
            Reserve Your Space
          </h2>

          {/* Facility switcher */}
          <div className="flex gap-3 mb-5">
            {[
              { value: FacilityType.GYM,   label: "Gym & Fitness" },
              { value: FacilityType.SAUNA, label: "Private Sauna" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFacilityType(value)}
                className={cn(
                  "px-5 py-2.5 rounded-md font-semibold text-sm transition-all active:scale-95",
                  facilityType === value
                    ? "bg-primary text-on-primary shadow-card"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Equipment filter — gym only */}
          {facilityType === FacilityType.GYM && (
            <div className="flex gap-2 flex-wrap">
              {EQUIPMENT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setEquipmentFilter(value as EquipmentType | "all")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors",
                    equipmentFilter === value
                      ? "bg-secondary text-on-secondary"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <BookingCalendar
          facilityType={facilityType}
          equipmentFilter={equipmentFilter}
        />
      </main>
    </div>
  )
}
