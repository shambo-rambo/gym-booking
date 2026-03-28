"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"

interface QueueEntry {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: Date
  startTime: string
  duration: number
  position: number
  notifiedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export default function QueuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [queues, setQueues] = useState<{ active: QueueEntry[] }>({ active: [] })
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated") {
      fetchQueues()
      // Poll every 30 seconds to check for updates
      const interval = setInterval(fetchQueues, 30000)
      return () => clearInterval(interval)
    }
  }, [status])

  const fetchQueues = async () => {
    try {
      const response = await fetch("/api/queue/my-queues")
      if (response.ok) {
        const data = await response.json()
        setQueues(data)
      }
    } catch (error) {
      console.error("Failed to fetch queues:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (queueId: string) => {
    setActioningId(queueId)

    try {
      const response = await fetch(`/api/queue/claim/${queueId}`, {
        method: "POST"
      })

      const data = await response.json()

      if (response.ok) {
        alert("Booking claimed successfully!")
        fetchQueues()
        router.push("/my-bookings")
      } else {
        alert(data.error || "Failed to claim slot")
      }
    } catch (error) {
      alert("Failed to claim slot")
    } finally {
      setActioningId(null)
    }
  }

  const handleLeave = async (queueId: string) => {
    if (!confirm("Are you sure you want to leave this queue?")) {
      return
    }

    setActioningId(queueId)

    try {
      const response = await fetch(`/api/queue/${queueId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        fetchQueues()
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to leave queue")
      }
    } catch (error) {
      alert("Failed to leave queue")
    } finally {
      setActioningId(null)
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

  const QueueCard = ({ queue }: { queue: QueueEntry }) => {
    const isNotified = !!queue.notifiedAt
    const isExpiringSoon = queue.expiresAt && new Date(queue.expiresAt) < new Date(Date.now() + 10 * 60 * 1000) // 10 min
    const hasExpired = queue.expiresAt && new Date(queue.expiresAt) < new Date()

    return (
      <Card key={queue.id} className={isNotified ? "border-green-500 border-2" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {queue.facilityType === "GYM" ? "Gym" : "Sauna"}
                {isNotified && (
                  <Badge variant="default" className="ml-2 bg-green-500">
                    Slot Available!
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {format(new Date(queue.date), "EEEE, MMMM d, yyyy")}
              </CardDescription>
            </div>
            <Badge variant={queue.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
              {queue.bookingType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{queue.startTime} ({queue.duration} min)</span>
            </div>
            {queue.equipmentType && (
              <div className="flex justify-between">
                <span className="text-gray-600">Equipment:</span>
                <span className="font-medium">
                  {queue.equipmentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Position:</span>
              <span className="font-medium">#{queue.position}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">In queue since:</span>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(queue.createdAt), { addSuffix: true })}
              </span>
            </div>

            {isNotified && queue.expiresAt && !hasExpired && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                <p className="font-medium text-green-900 mb-1">
                  {isExpiringSoon ? "⚠️ Expires soon!" : "Slot available!"}
                </p>
                <p className="text-sm text-green-700">
                  Claim before: {format(new Date(queue.expiresAt), "h:mm a")}
                  <br />
                  ({formatDistanceToNow(new Date(queue.expiresAt), { addSuffix: true })})
                </p>
              </div>
            )}

            {hasExpired && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-700">
                  Claim window expired
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            {isNotified && !hasExpired ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleClaim(queue.id)}
                disabled={actioningId === queue.id}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {actioningId === queue.id ? "Claiming..." : "Claim Slot"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLeave(queue.id)}
                disabled={actioningId === queue.id}
                className="flex-1"
              >
                {actioningId === queue.id ? "Leaving..." : "Leave Queue"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Queue</h1>
          <Button variant="outline" size="sm" onClick={fetchQueues}>
            Refresh
          </Button>
        </div>

        {queues.active.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              You're not in any queues. Join a queue from the calendar when a slot is full!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {queues.active.map(queue => (
              <QueueCard key={queue.id} queue={queue} />
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-900">
            <strong>How the queue works:</strong>
          </p>
          <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
            <li>When someone cancels, the first person in queue gets notified</li>
            <li>You have 30 minutes to claim the slot</li>
            <li>If you don't claim it, the next person gets notified</li>
            <li>This page auto-refreshes every 30 seconds</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
