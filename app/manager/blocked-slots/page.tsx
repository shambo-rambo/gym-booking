"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, Clock, XCircle, Dumbbell, Waves, Plus } from "lucide-react"
import { format } from "date-fns"

type BlockedSlot = {
  id: string
  facilityType: string
  date: string
  startTime: string
  duration: number
  reason: string
  recurring: boolean
  creator: {
    name: string
  }
  createdAt: string
}

type ConflictingBooking = {
  id: string
  user: {
    name: string
    email: string
  }
}

export default function ManagerBlockedSlotsPage() {
  const { data: session, status } = useSession()
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictingBookings, setConflictingBookings] = useState<ConflictingBooking[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  // Form state
  const [facilityType, setFacilityType] = useState("GYM")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [duration, setDuration] = useState(60)
  const [reason, setReason] = useState("")
  const [recurring, setRecurring] = useState(false)
  const [cancelExisting, setCancelExisting] = useState(false)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  const isManager = (session.user as any)?.role === "MANAGER"

  if (!isManager) {
    redirect("/")
  }

  useEffect(() => {
    fetchBlockedSlots()
  }, [])

  const fetchBlockedSlots = async () => {
    try {
      const response = await fetch("/api/manager/blocked-slots")
      if (response.ok) {
        const data = await response.json()
        setBlockedSlots(data.blockedSlots)
      }
    } catch (error) {
      console.error("Failed to fetch blocked slots:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setFacilityType("GYM")
    setDate("")
    setStartTime("09:00")
    setDuration(60)
    setReason("")
    setRecurring(false)
    setCancelExisting(false)
    setCreateDialogOpen(true)
  }

  const handleCreateSubmit = async () => {
    if (!date || !startTime || !reason) {
      alert("Please fill in all required fields")
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch("/api/manager/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityType,
          date,
          startTime,
          duration,
          reason,
          recurring,
          cancelExisting
        })
      })

      if (response.ok) {
        setCreateDialogOpen(false)
        await fetchBlockedSlots()
      } else if (response.status === 409) {
        const data = await response.json()
        setConflictingBookings(data.conflictingBookings)
        setConflictDialogOpen(true)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error("Failed to create blocked slot:", error)
      alert("Failed to create blocked slot")
    } finally {
      setActionLoading(false)
    }
  }

  const handleConflictResolve = async () => {
    setCancelExisting(true)
    setConflictDialogOpen(false)
    await handleCreateSubmit()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this blocked slot?")) {
      return
    }

    try {
      const response = await fetch(`/api/manager/blocked-slots/${id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await fetchBlockedSlots()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error("Failed to delete blocked slot:", error)
      alert("Failed to delete blocked slot")
    }
  }

  const getEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  // Generate time slot options
  const timeSlots = []
  for (let hour = 5; hour < 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      timeSlots.push(timeStr)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
          <p>Loading blocked slots...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Facility Management</h1>
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Block Slot
          </Button>
        </div>

        {blockedSlots.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No blocked slots. Click "Block Slot" to add one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {blockedSlots.map(slot => (
              <Card key={slot.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {slot.facilityType === "GYM" ? (
                          <Dumbbell className="h-5 w-5" />
                        ) : (
                          <Waves className="h-5 w-5" />
                        )}
                        <CardTitle className="text-lg">
                          {slot.facilityType}
                        </CardTitle>
                        {slot.recurring && (
                          <Badge variant="secondary">Recurring</Badge>
                        )}
                      </div>

                      <CardDescription>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {slot.startTime} - {getEndTime(slot.startTime, slot.duration)} ({slot.duration} min)
                          </div>
                          <div className="mt-2">
                            <p className="font-medium">Reason:</p>
                            <p className="text-gray-700">{slot.reason}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Created by {slot.creator.name}
                          </p>
                        </div>
                      </CardDescription>
                    </div>

                    <Button
                      onClick={() => handleDelete(slot.id)}
                      size="sm"
                      variant="destructive"
                      className="ml-4"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Block Time Slot</DialogTitle>
              <DialogDescription>
                Block a time slot for maintenance or other reasons
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="facility">Facility *</Label>
                <Select value={facilityType} onValueChange={setFacilityType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GYM">Gym</SelectItem>
                    <SelectItem value="SAUNA">Sauna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Equipment maintenance, Deep cleaning"
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="recurring" className="cursor-pointer">
                  Recurring (weekly)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? "Creating..." : "Block Slot"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conflicting Bookings Found</DialogTitle>
              <DialogDescription>
                There are existing bookings for this time slot. Do you want to cancel them and block the slot?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {conflictingBookings.map((booking, index) => (
                <div key={booking.id} className="p-3 bg-gray-50 rounded">
                  <p className="font-medium">{booking.user.name}</p>
                  <p className="text-sm text-gray-600">{booking.user.email}</p>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConflictDialogOpen(false)}
              >
                Keep Bookings
              </Button>
              <Button
                variant="destructive"
                onClick={handleConflictResolve}
              >
                Cancel Bookings & Block Slot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
