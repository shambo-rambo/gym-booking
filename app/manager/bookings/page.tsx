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
import { Calendar, Clock, User, Home, Mail, XCircle, Dumbbell, Waves } from "lucide-react"
import { format } from "date-fns"

type Booking = {
  id: string
  facilityType: string
  bookingType: string
  equipmentType: string | null
  date: string
  startTime: string
  duration: number
  user: {
    name: string
    apartmentNumber: number
    email: string
  }
}

export default function ManagerBookingsPage() {
  const { data: session, status } = useSession()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState("")
  const [facilityFilter, setFacilityFilter] = useState("ALL")
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [notifyUser, setNotifyUser] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

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
    fetchBookings()
  }, [dateFilter, facilityFilter])

  const fetchBookings = async () => {
    try {
      const params = new URLSearchParams()
      if (dateFilter) {
        params.append("date", dateFilter)
      }
      if (facilityFilter !== "ALL") {
        params.append("facilityType", facilityFilter)
      }

      const response = await fetch(`/api/manager/bookings?${params}`)
      if (response.ok) {
        const data = await response.json()
        setBookings(data.bookings)
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelClick = (booking: Booking) => {
    setSelectedBooking(booking)
    setCancelReason("")
    setNotifyUser(true)
    setCancelDialogOpen(true)
  }

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/manager/bookings/${selectedBooking.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason || undefined,
          notifyUser
        })
      })

      if (response.ok) {
        setCancelDialogOpen(false)
        await fetchBookings()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error("Failed to cancel booking:", error)
      alert("Failed to cancel booking")
    } finally {
      setActionLoading(false)
    }
  }

  const getEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p>Loading bookings...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">Booking Management</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="facility">Facility</Label>
                <Select value={facilityFilter} onValueChange={setFacilityFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Facilities</SelectItem>
                    <SelectItem value="GYM">Gym</SelectItem>
                    <SelectItem value="SAUNA">Sauna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No bookings found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map(booking => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {booking.facilityType === "GYM" ? (
                          <Dumbbell className="h-5 w-5" />
                        ) : (
                          <Waves className="h-5 w-5" />
                        )}
                        <CardTitle className="text-lg">
                          {booking.facilityType}
                        </CardTitle>
                        <Badge variant={booking.bookingType === "EXCLUSIVE" ? "default" : "secondary"}>
                          {booking.bookingType}
                        </Badge>
                        {booking.equipmentType && (
                          <Badge variant="outline">{booking.equipmentType}</Badge>
                        )}
                      </div>

                      <CardDescription>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {booking.user.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Apartment {booking.user.apartmentNumber}
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {booking.user.email}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {booking.startTime} - {getEndTime(booking.startTime, booking.duration)} ({booking.duration} min)
                          </div>
                        </div>
                      </CardDescription>
                    </div>

                    <Button
                      onClick={() => handleCancelClick(booking)}
                      size="sm"
                      variant="destructive"
                      className="ml-4"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Booking</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this booking? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {selectedBooking && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium">{selectedBooking.user.name}</p>
                  <p className="text-sm text-gray-600">
                    {selectedBooking.facilityType} - {format(new Date(selectedBooking.date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedBooking.startTime} - {getEndTime(selectedBooking.startTime, selectedBooking.duration)}
                  </p>
                </div>

                <div>
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g., Maintenance required, Emergency closure"
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notifyUser"
                    checked={notifyUser}
                    onChange={(e) => setNotifyUser(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="notifyUser" className="cursor-pointer">
                    Send cancellation notification to user
                  </Label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={actionLoading}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
