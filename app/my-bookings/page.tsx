"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
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

interface QueueEntry {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: string
  startTime: string
  duration: number
  position: number
  createdAt: string
}

// Multiple equipment items at the same slot = one session
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

export default function MyBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<{ upcoming: Booking[]; past: Booking[] }>({ upcoming: [], past: [] })
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingKey, setCancellingKey] = useState<string | null>(null)
  const [leavingQueueId, setLeavingQueueId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated") fetchBookings()
  }, [status])

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/bookings/my-bookings")
      if (res.ok) {
        const data = await res.json()
        setBookings({ upcoming: data.upcoming, past: data.past })
        setQueueEntries(data.queue || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (sessionKey: string, ids: string[]) => {
    if (!confirm("Cancel this booking?")) return
    setCancellingKey(sessionKey)
    try {
      await Promise.all(ids.map(id => fetch(`/api/bookings/${id}`, { method: "DELETE" })))
      fetchBookings()
      router.refresh()
    } finally {
      setCancellingKey(null)
    }
  }

  const handleLeaveQueue = async (queueId: string) => {
    if (!confirm("Leave this queue?")) return
    setLeavingQueueId(queueId)
    try {
      const res = await fetch(`/api/queue/${queueId}`, { method: "DELETE" })
      if (res.ok) { fetchBookings(); router.refresh() }
      else alert((await res.json()).error || "Failed to leave queue")
    } finally {
      setLeavingQueueId(null)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  const SessionCard = ({ s, showCancel = true }: { s: BookingSession; showCancel?: boolean }) => {
    const key = s.ids.join(",")
    const equipment = s.equipment.filter(Boolean) as EquipmentType[]
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {s.facilityType === "GYM" ? "Gym" : "Sauna"}
              </CardTitle>
              <CardDescription>
                {format(new Date(s.date), "EEEE, MMMM d, yyyy")}
              </CardDescription>
            </div>
            <Badge variant={s.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
              {s.bookingType === "EXCLUSIVE" ? "Private" : "Shared"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{s.startTime} ({s.duration} min)</span>
            </div>
            {equipment.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Equipment:</span>
                <span className="font-medium text-right">
                  {equipment.map(e => equipmentLabel(e)).join(", ")}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Booked:</span>
              <span className="text-gray-500">{format(new Date(s.createdAt), "MMM d, h:mm a")}</span>
            </div>
          </div>
          {showCancel && (
            <div className="mt-4">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={cancellingKey === key}
                onClick={() => handleCancel(key, s.ids)}
              >
                {cancellingKey === key ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const QueueCard = ({ entry }: { entry: QueueEntry }) => (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {entry.facilityType === "GYM" ? "Gym" : "Sauna"}
              </CardTitle>
              <Badge variant="outline" className="bg-blue-600 text-white border-blue-600">
                Queue #{entry.position}
              </Badge>
            </div>
            <CardDescription>
              {format(new Date(entry.date), "EEEE, MMMM d, yyyy")}
            </CardDescription>
          </div>
          <Badge variant={entry.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
            {entry.bookingType === "EXCLUSIVE" ? "Private" : "Shared"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Time:</span>
            <span className="font-medium">{entry.startTime} ({entry.duration} min)</span>
          </div>
          {entry.equipmentType && (
            <div className="flex justify-between">
              <span className="text-gray-600">Equipment:</span>
              <span className="font-medium">
                {equipmentLabel(entry.equipmentType as EquipmentType)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Joined:</span>
            <span className="text-gray-500">{format(new Date(entry.createdAt), "MMM d, h:mm a")}</span>
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={leavingQueueId === entry.id}
            onClick={() => handleLeaveQueue(entry.id)}
          >
            {leavingQueueId === entry.id ? "Leaving..." : "Leave Queue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  const upcomingSessions = groupIntoSessions(bookings.upcoming)
  const pastSessions = groupIntoSessions(bookings.past)

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-6">My Bookings & Queue</h1>

        {queueEntries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">In Queue ({queueEntries.length})</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {queueEntries.map(entry => <QueueCard key={entry.id} entry={entry} />)}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Upcoming Bookings</h2>
          {upcomingSessions.length === 0 && queueEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No upcoming bookings. Book a slot from the calendar!
              </CardContent>
            </Card>
          ) : upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No confirmed bookings yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingSessions.map(s => <SessionCard key={s.ids.join(",")} s={s} />)}
            </div>
          )}
        </div>

        {pastSessions.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Past</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pastSessions.map(s => <SessionCard key={s.ids.join(",")} s={s} showCancel={false} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
