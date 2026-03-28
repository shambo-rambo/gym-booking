"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface Booking {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: Date
  startTime: string
  duration: number
  createdAt: Date
}

interface QueueEntry {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: Date
  startTime: string
  duration: number
  position: number
  createdAt: Date
}

export default function MyBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<{ upcoming: Booking[], past: Booking[] }>({
    upcoming: [],
    past: []
  })
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [leavingQueueId, setLeavingQueueId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated") {
      fetchBookings()
    }
  }, [status])

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings/my-bookings")
      if (response.ok) {
        const data = await response.json()
        setBookings({ upcoming: data.upcoming, past: data.past })
        setQueueEntries(data.queue || [])
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveQueue = async (queueId: string) => {
    if (!confirm("Are you sure you want to leave this queue?")) {
      return
    }

    setLeavingQueueId(queueId)

    try {
      const response = await fetch(`/api/queue/${queueId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        // Refresh bookings and queue
        fetchBookings()
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to leave queue")
      }
    } catch (error) {
      alert("Failed to leave queue")
    } finally {
      setLeavingQueueId(null)
    }
  }

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return
    }

    setCancellingId(bookingId)

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        // Refresh bookings
        fetchBookings()
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to cancel booking")
      }
    } catch (error) {
      alert("Failed to cancel booking")
    } finally {
      setCancellingId(null)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  const BookingCard = ({ booking, showCancel = true }: { booking: Booking, showCancel?: boolean }) => (
    <Card key={booking.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {booking.facilityType === "GYM" ? "Gym" : "Sauna"}
            </CardTitle>
            <CardDescription>
              {format(new Date(booking.date), "EEEE, MMMM d, yyyy")}
            </CardDescription>
          </div>
          <Badge variant={booking.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
            {booking.bookingType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Time:</span>
            <span className="font-medium">{booking.startTime} ({booking.duration} min)</span>
          </div>
          {booking.equipmentType && (
            <div className="flex justify-between">
              <span className="text-gray-600">Equipment:</span>
              <span className="font-medium">
                {booking.equipmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Booked:</span>
            <span className="text-sm text-gray-500">
              {format(new Date(booking.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
        </div>

        {showCancel && (
          <div className="mt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleCancel(booking.id)}
              disabled={cancellingId === booking.id}
              className="w-full"
            >
              {cancellingId === booking.id ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const QueueCard = ({ entry }: { entry: QueueEntry }) => (
    <Card key={entry.id} className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {entry.facilityType === "GYM" ? "Gym" : "Sauna"}
              </CardTitle>
              <Badge variant="outline" className="bg-blue-600 text-white border-blue-600">
                Queue Position: {entry.position}
              </Badge>
            </div>
            <CardDescription>
              {format(new Date(entry.date), "EEEE, MMMM d, yyyy")}
            </CardDescription>
          </div>
          <Badge variant={entry.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
            {entry.bookingType}
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
                {entry.equipmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Joined Queue:</span>
            <span className="text-sm text-gray-500">
              {format(new Date(entry.createdAt), "MMM d, h:mm a")}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLeaveQueue(entry.id)}
            disabled={leavingQueueId === entry.id}
            className="w-full"
          >
            {leavingQueueId === entry.id ? "Leaving..." : "Leave Queue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-6">My Bookings & Queue</h1>

        {/* Queue Entries */}
        {queueEntries.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">
              In Queue ({queueEntries.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {queueEntries.map(entry => (
                <QueueCard key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Bookings */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Upcoming Bookings</h2>
          {bookings.upcoming.length === 0 && queueEntries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No upcoming bookings or queue entries. Book a slot from the calendar!
              </CardContent>
            </Card>
          ) : bookings.upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No confirmed bookings yet. Your queue entries are shown above.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {bookings.upcoming.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>

        {/* Past Bookings */}
        {bookings.past.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Past</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {bookings.past.map(booking => (
                <BookingCard key={booking.id} booking={booking} showCancel={false} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
