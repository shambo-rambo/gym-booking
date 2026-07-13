"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import LoadingSpinner from "@/components/LoadingSpinner"
import { ChevronLeft, Truck } from "lucide-react"

type Direction = "IN" | "OUT"

export default function LogMovePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [apartmentNumber, setApartmentNumber] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [direction, setDirection] = useState<Direction>("OUT")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  // Synchronous guard against a fast double-click/double-tap firing two overlapping
  // submits before `disabled={submitting}` reaches the DOM — see the same fix on
  // the manager message wizard's send button.
  const submittingRef = useRef(false)

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/settings")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setApartmentNumber(data.apartmentNumber))
        .finally(() => setLoading(false))
    }
  }, [status])

  if (status === "loading" || loading) return <LoadingSpinner />
  if (!session) redirect("/login")

  const handleSubmit = async () => {
    setError("")
    if (!date || !time) {
      setError("Please choose a date and time.")
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const eventAt = new Date(`${date}T${time}`).toISOString()
      const res = await fetch("/api/notices/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, eventAt }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to log move")
        return
      }
      setDone(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 sm:px-6 pt-20 pb-28">
          <Card className="mt-10">
            <CardContent className="p-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-bold text-lg text-primary mb-1">Move posted</p>
              <p className="text-sm text-on-surface-variant mb-6">
                Other residents can now see your move in the Notices feed.
              </p>
              <Link href="/">
                <Button style={{ minHeight: "60px" }} className="w-full text-base">
                  Back to Notices
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 sm:px-6 pt-20 pb-28">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <ChevronLeft className="w-4 h-4" />
          Back to Notices
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <Truck className="w-5 h-5 text-secondary" />
          <h1 className="text-2xl font-bold text-primary">Post Moving In / Out</h1>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">
          Let your neighbours know so they can plan around lift/lobby use. This posts straight to the
          Notices feed — no need to contact the manager.
        </p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-base">Unit</Label>
            <p style={{ minHeight: "60px" }} className="flex items-center px-5 rounded-xl border-2 border-outline-variant/30 bg-white text-lg font-bold text-primary">
              Apt {apartmentNumber}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Moving in or out?</Label>
            <RadioGroup value={direction} onValueChange={(v) => setDirection(v as Direction)} className="gap-3">
              {[
                { value: "IN", label: "Moving In" },
                { value: "OUT", label: "Moving Out" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{ minHeight: "60px" }}
                  className="flex items-center gap-4 px-5 rounded-xl border-2 border-outline-variant/30 bg-white cursor-pointer has-[[data-state=checked]]:border-secondary"
                >
                  <RadioGroupItem value={opt.value} id={opt.value} className="w-5 h-5" />
                  <span className="text-base font-semibold text-primary">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-base">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-base"
                style={{ minHeight: "60px" }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-base"
                style={{ minHeight: "60px" }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            className="w-full text-base"
            style={{ minHeight: "60px" }}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Posting…" : "Post to Notices"}
          </Button>
        </div>
      </main>
    </div>
  )
}
