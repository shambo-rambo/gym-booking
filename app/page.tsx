"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { CalendarPlus, Clock } from "lucide-react"
import { EQUIPMENT_LABELS } from "@/lib/equipment"
import type { EquipmentType } from "@prisma/client"

interface Booking {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: string
  startTime: string
  duration: number
  createdAt: string
}

interface WaitlistEntry {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: string
  startTime: string
  duration: number
  position: number
  notifiedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface BookingSession {
  ids: string[]
  facilityType: string
  bookingType: string
  equipment: (EquipmentType | null)[]
  date: string
  startTime: string
  duration: number
  createdAt: string
}

function groupIntoSessions(bookings: Booking[]): BookingSession[] {
  const map = new Map<string, BookingSession>()
  for (const b of bookings) {
    const key = `${b.facilityType}|${b.date}|${b.startTime}|${b.duration}|${b.bookingType}`
    const existing = map.get(key)
    if (existing) {
      existing.ids.push(b.id)
      existing.equipment.push(b.equipmentType as EquipmentType | null)
    } else {
      map.set(key, {
        ids: [b.id],
        facilityType: b.facilityType,
        bookingType: b.bookingType,
        equipment: [b.equipmentType as EquipmentType | null],
        date: b.date,
        startTime: b.startTime,
        duration: b.duration,
        createdAt: b.createdAt,
      })
    }
  }
  return Array.from(map.values())
}

function equipmentLabel(e: EquipmentType | null): string {
  if (!e) return ""
  return EQUIPMENT_LABELS[e] ?? e
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<{ upcoming: Booking[] }>({ upcoming: [] })
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingKey, setCancellingKey] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [confirmCancelKey, setConfirmCancelKey] = useState<string | null>(null)
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") fetchData()
  }, [status])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/bookings/my-bookings")
      if (res.ok) {
        const data = await res.json()
        setBookings({ upcoming: data.upcoming })
        setWaitlist(data.queue || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (sessionKey: string, ids: string[]) => {
    setCancellingKey(sessionKey)
    setCancelError(null)
    try {
      const results = await Promise.all(
        ids.map(id => fetch(`/api/bookings/${id}`, { method: "DELETE" }))
      )
      const failed = await Promise.all(
        results.filter(r => !r.ok).map(r => r.json())
      )
      if (failed.length > 0) {
        setCancelError(failed[0]?.error || "Could not cancel booking")
      } else {
        fetchData()
      }
    } finally {
      setCancellingKey(null)
    }
  }

  const handleLeaveWaitlist = async (id: string) => {
    setLeavingId(id)
    try {
      const res = await fetch(`/api/queue/${id}`, { method: "DELETE" })
      if (res.ok) fetchData()
    } finally {
      setLeavingId(null)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const upcomingSessions = groupIntoSessions(bookings.upcoming)
  const hasAnything = upcomingSessions.length > 0 || waitlist.length > 0

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-28">

        {/* Make a Booking CTA */}
        <div className="mt-6 mb-8">
          <Link href="/book">
            <button className="w-full flex items-center justify-center gap-3 bg-primary text-on-primary font-bold text-base py-4 rounded-xl shadow-card active:scale-[0.98] transition-all">
              <CalendarPlus className="w-5 h-5" />
              Make a Booking
            </button>
          </Link>
        </div>

        {cancelError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {cancelError}
          </div>
        )}

        {/* Waitlist */}
        {waitlist.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-3">
              Waitlist ({waitlist.length})
            </h2>
            <div className="space-y-3">
              {waitlist.map(entry => {
                const isNotified = !!entry.notifiedAt
                const hasExpired = entry.expiresAt && new Date(entry.expiresAt) < new Date()
                return (
                  <div
                    key={entry.id}
                    className={`bg-white rounded-xl shadow-sm border p-4 ${isNotified && !hasExpired ? "border-green-400 border-2" : "border-outline-variant/20"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-primary">
                          {entry.facilityType === "GYM" ? "Gym" : "Sauna"}
                          {isNotified && !hasExpired && (
                            <span className="ml-2 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              Slot Available!
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-on-surface-variant">
                          {format(new Date(entry.date), "EEE, MMM d")} · {entry.startTime} ({entry.duration} min)
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">#{entry.position}</Badge>
                    </div>
                    {entry.equipmentType && (
                      <p className="text-xs text-on-surface-variant mb-3">
                        {equipmentLabel(entry.equipmentType as EquipmentType)}
                      </p>
                    )}
                    {isNotified && !hasExpired && entry.expiresAt && (
                      <div className="bg-green-50 rounded-lg px-3 py-2 mb-3">
                        <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Claim before {format(new Date(entry.expiresAt), "h:mm a")}
                          {" · "}
                          {formatDistanceToNow(new Date(entry.expiresAt), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {isNotified && !hasExpired ? (
                        <Link href="/queue" className="flex-1">
                          <Button size="sm" className="w-full bg-green-500 hover:bg-green-600 text-white">
                            Claim Slot
                          </Button>
                        </Link>
                      ) : confirmLeaveId === entry.id ? (
                        <div className="flex gap-2 flex-1">
                          <Button size="sm" variant="destructive" className="flex-1"
                            disabled={leavingId === entry.id}
                            onClick={() => { setConfirmLeaveId(null); handleLeaveWaitlist(entry.id) }}>
                            {leavingId === entry.id ? "Leaving…" : "Yes, leave"}
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1"
                            onClick={() => setConfirmLeaveId(null)}>
                            Keep spot
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmLeaveId(entry.id)}
                        >
                          Leave Waitlist
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Upcoming Bookings */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-3">
            Upcoming Bookings
          </h2>

          {!hasAnything ? (
            <div className="bg-white rounded-xl shadow-sm border border-outline-variant/20 p-8 text-center">
              <p className="text-on-surface-variant font-medium mb-1">No upcoming bookings</p>
              <p className="text-sm text-on-surface-variant/60">Use the button above to reserve a slot.</p>
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-outline-variant/20 p-8 text-center">
              <p className="text-sm text-on-surface-variant">No confirmed bookings yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map(s => {
                const key = s.ids.join(",")
                const equipment = s.equipment.filter(Boolean) as EquipmentType[]
                const dateStr = String(s.date).slice(0, 10)
                const start = new Date(`${dateStr}T${s.startTime}:00`)
                const minutesUntil = (start.getTime() - Date.now()) / (1000 * 60)
                const canCancel = minutesUntil > 30

                return (
                  <div
                    key={key}
                    className="bg-white rounded-xl shadow-sm border border-outline-variant/20 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-primary">
                          {s.facilityType === "GYM" ? "Gym" : "Sauna"}
                        </p>
                        <p className="text-sm text-on-surface-variant">
                          {format(new Date(s.date), "EEE, MMM d")} · {s.startTime} ({s.duration} min)
                        </p>
                      </div>
                      <Badge variant={s.bookingType === "EXCLUSIVE" ? "default" : "secondary"} className="text-xs">
                        {s.bookingType === "EXCLUSIVE" ? "Private" : "Shared"}
                      </Badge>
                    </div>
                    {equipment.length > 0 && (
                      <p className="text-xs text-on-surface-variant mb-3">
                        {equipment.map(e => equipmentLabel(e)).join(", ")}
                      </p>
                    )}
                    {!canCancel && (
                      <p className="text-xs text-amber-600 mb-2">
                        Cannot cancel within 30 minutes of start
                      </p>
                    )}
                    {confirmCancelKey === key ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1"
                          disabled={cancellingKey === key}
                          onClick={() => { setConfirmCancelKey(null); handleCancel(key, s.ids) }}>
                          {cancellingKey === key ? "Cancelling…" : "Yes, cancel"}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1"
                          onClick={() => setConfirmCancelKey(null)}>
                          Keep booking
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                        disabled={!canCancel}
                        onClick={() => setConfirmCancelKey(key)}
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
