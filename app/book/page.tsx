"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { BookingCalendar } from "@/components/calendar/BookingCalendar"
import { LibraryBookingPanel } from "@/components/library/LibraryBookingPanel"
import { FacilityType, BookingType } from "@prisma/client"
import { cn } from "@/lib/utils"
import { loadBookingPrefs } from "@/lib/bookingPrefs"

type Amenity = "gym" | "sauna" | "library"

const AMENITIES: { value: Amenity; label: string }[] = [
  { value: "gym",     label: "Gym"     },
  { value: "sauna",   label: "Sauna"   },
  { value: "library", label: "Library" },
]

export default function BookPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [amenity, setAmenity] = useState<Amenity>("gym")

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    const prefs = loadBookingPrefs()
    if (prefs?.amenity) setAmenity(prefs.amenity)
  }, [])

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const facilityType = amenity === "sauna" ? FacilityType.SAUNA : FacilityType.GYM

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

          <div data-highlight="book-amenity-tabs" className="flex gap-3 flex-wrap mb-5">
            {AMENITIES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAmenity(value)}
                className={cn(
                  "px-5 py-2.5 rounded-md font-semibold text-sm transition-all active:scale-95",
                  amenity === value
                    ? "bg-primary text-on-primary shadow-card"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {amenity === "library" ? (
          <LibraryBookingPanel />
        ) : (
          <>
            <BookingCalendar
              facilityType={facilityType}
              defaultBookingType={BookingType.EXCLUSIVE}
            />
          </>
        )}
      </main>
    </div>
  )
}
