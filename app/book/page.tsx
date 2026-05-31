"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { BookingCalendar } from "@/components/calendar/BookingCalendar"
import { LibraryBookingPanel } from "@/components/library/LibraryBookingPanel"
import { FacilityType, BookingType } from "@prisma/client"
import { cn } from "@/lib/utils"

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
  const [gymBookingType, setGymBookingType] = useState<BookingType>(BookingType.SHARED)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const facilityType = amenity === "sauna" ? FacilityType.SAUNA : FacilityType.GYM
  const bookingType = amenity === "sauna" ? BookingType.EXCLUSIVE : gymBookingType

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
            {amenity === "gym" && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex rounded-md overflow-hidden border border-outline-variant">
                  <button
                    onClick={() => setGymBookingType(BookingType.SHARED)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      gymBookingType === BookingType.SHARED
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    Shared
                  </button>
                  <button
                    onClick={() => setGymBookingType(BookingType.EXCLUSIVE)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      gymBookingType === BookingType.EXCLUSIVE
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    Private
                  </button>
                </div>
              </div>
            )}

            <BookingCalendar
              facilityType={facilityType}
              defaultBookingType={bookingType}
            />
          </>
        )}
      </main>
    </div>
  )
}
