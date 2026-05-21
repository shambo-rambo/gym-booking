"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { BookingCalendar } from "@/components/calendar/BookingCalendar"
import { BookingRules } from "@/components/BookingRules"
import { FacilityType, BookingType } from "@prisma/client"
import { cn } from "@/lib/utils"

type BookingMode = "shared-gym" | "private-gym" | "private-sauna"

const MODES: { value: BookingMode; label: string }[] = [
  { value: "shared-gym",    label: "Shared Gym"    },
  { value: "private-gym",   label: "Private Gym"   },
  { value: "private-sauna", label: "Private Sauna" },
]

function modeToFacility(mode: BookingMode): FacilityType {
  return mode === "private-sauna" ? FacilityType.SAUNA : FacilityType.GYM
}

function modeToBookingType(mode: BookingMode): BookingType {
  return mode === "shared-gym" ? BookingType.SHARED : BookingType.EXCLUSIVE
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [mode, setMode] = useState<BookingMode>("shared-gym")
  const [showRules, setShowRules] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <main className="pt-20 pb-28 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="mt-6 mb-8">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-1.5 block">
            Amenity Booking
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary mb-6">
            Reserve Your Space
          </h2>

          <div className="flex gap-3 flex-wrap mb-5">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setMode(value); setShowRules(false) }}
                className={cn(
                  "px-5 py-2.5 rounded-md font-semibold text-sm transition-all active:scale-95",
                  !showRules && mode === value
                    ? "bg-primary text-on-primary shadow-card"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {label}
              </button>
            ))}

            <button
              onClick={() => setShowRules((v) => !v)}
              className={cn(
                "px-5 py-2.5 rounded-md font-semibold text-sm transition-all active:scale-95 ml-auto",
                showRules
                  ? "bg-secondary text-on-secondary shadow-card"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              Booking Rules
            </button>
          </div>
        </div>

        {showRules ? (
          <BookingRules />
        ) : (
          <BookingCalendar
            facilityType={modeToFacility(mode)}
            defaultBookingType={modeToBookingType(mode)}
          />
        )}
      </main>
    </div>
  )
}
