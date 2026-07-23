"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { CheckCircle2, XCircle, Clock } from "lucide-react"
import { EQUIPMENT_LABELS } from "@/lib/equipment"
import type { EquipmentType } from "@prisma/client"

interface BookingDetails {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: string
  startTime: string
  duration: number
}

type Status = "loading" | "ready" | "cancelling" | "cancelled" | "kept" | "error" | "gone"

export default function BookingCheckPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [canCancel, setCanCancel] = useState(true)
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          setStatus("gone")
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || "Couldn't load this booking.")
          setStatus("error")
          return
        }
        setBooking(data.booking)
        setCanCancel(data.canCancel)
        setStatus("ready")
      })
      .catch(() => {
        setError("Couldn't load this booking.")
        setStatus("error")
      })
  }, [id])

  const handleCancel = async () => {
    setStatus("cancelling")
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Couldn't cancel booking.")
        setStatus("ready")
        return
      }
      setStatus("cancelled")
    } catch {
      setError("Couldn't cancel booking. Check your connection and try again.")
      setStatus("ready")
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-card p-6 text-center">
          {status === "loading" && (
            <p className="text-on-surface-variant py-8">Loading your booking…</p>
          )}

          {status === "gone" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-secondary mx-auto mb-3" />
              <h1 className="text-lg font-bold text-primary mb-1">Already sorted</h1>
              <p className="text-sm text-on-surface-variant">This booking no longer exists — it may already be cancelled.</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 text-error mx-auto mb-3" />
              <h1 className="text-lg font-bold text-primary mb-1">Something went wrong</h1>
              <p className="text-sm text-on-surface-variant">{error}</p>
            </>
          )}

          {status === "cancelled" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-secondary mx-auto mb-3" />
              <h1 className="text-lg font-bold text-primary mb-1">Booking cancelled</h1>
              <p className="text-sm text-on-surface-variant mb-5">Your slot has been freed up for the next person in the queue.</p>
              <Button variant="outline" className="w-full" onClick={() => router.push("/my-bookings")}>
                Go to My Bookings
              </Button>
            </>
          )}

          {(status === "ready" || status === "cancelling") && booking && (
            <>
              <Clock className="w-10 h-10 text-primary mx-auto mb-3" />
              <h1 className="text-lg font-bold text-primary mb-1">Still coming?</h1>
              <p className="text-sm text-on-surface-variant mb-5">
                Your session is coming up. Let us know if you still need it.
              </p>

              <div className="bg-surface-container-low rounded-xl p-4 mb-5 text-left space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Facility</span>
                  <span className="font-semibold text-primary">
                    {booking.facilityType === "GYM" ? "Gym" : booking.facilityType === "SAUNA" ? "Sauna" : booking.facilityType}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Date</span>
                  <span className="font-semibold text-primary">{format(new Date(booking.date), "EEEE, MMM d")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Time</span>
                  <span className="font-semibold text-primary">{booking.startTime} &middot; {booking.duration} min</span>
                </div>
                {booking.equipmentType && (
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Equipment</span>
                    <span className="font-semibold text-primary">{EQUIPMENT_LABELS[booking.equipmentType as EquipmentType]}</span>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-error mb-3">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[48px] border-error/30 text-error hover:bg-error/5"
                  disabled={status === "cancelling" || !canCancel}
                  onClick={handleCancel}
                >
                  {status === "cancelling" ? "Cancelling…" : "No, cancel it"}
                </Button>
                <Button
                  className="flex-1 min-h-[48px]"
                  disabled={status === "cancelling"}
                  onClick={() => router.push("/my-bookings")}
                >
                  Yes, keep it
                </Button>
              </div>
              {!canCancel && (
                <p className="text-xs text-amber-600 mt-3">
                  This booking starts too soon to cancel online — contact a manager if you can no longer make it.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
