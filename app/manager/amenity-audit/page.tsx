"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DoorOpen, Home, Clock, AlertTriangle, UserX } from "lucide-react"

type AmenityAuditException = {
  id: string
  exceptionType: "UNBOOKED_ACCESS" | "NO_SHOW"
  unitNumber: number
  rawSystemIdentifier: string | null
  location: string
  windowLabel: string
  createdAt: string
}

export default function ManagerAmenityAuditPage() {
  const { data: session, status } = useSession()
  const [exceptions, setExceptions] = useState<AmenityAuditException[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("ALL")

  useEffect(() => {
    if (session && (session.user as any)?.role === "MANAGER") {
      fetchExceptions()
    }
  }, [typeFilter, session])

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

  const fetchExceptions = async () => {
    try {
      const params = new URLSearchParams()
      if (typeFilter !== "ALL") {
        params.append("exceptionType", typeFilter)
      }

      const response = await fetch(`/api/manager/amenity-audit?${params}`)
      if (response.ok) {
        const data = await response.json()
        setExceptions(data.exceptions)
      }
    } catch (error) {
      console.error("Failed to fetch amenity audit exceptions:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
          <p>Loading exceptions...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-2">Amenity Access Audit</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Weekly reconciliation of gym/sauna fob access against bookings, most recent audit week.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="type">Exception type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All exceptions</SelectItem>
                <SelectItem value="UNBOOKED_ACCESS">Un-booked access</SelectItem>
                <SelectItem value="NO_SHOW">No-show / unused booking</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {exceptions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No exceptions found for this audit week.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {exceptions.map((exception) => (
              <Card key={exception.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {exception.exceptionType === "UNBOOKED_ACCESS" ? (
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <UserX className="h-5 w-5 flex-shrink-0" />
                    )}
                    <CardTitle className="text-lg">
                      {exception.exceptionType === "UNBOOKED_ACCESS" ? "Un-booked access" : "No-show / unused booking"}
                    </CardTitle>
                    <Badge variant={exception.exceptionType === "UNBOOKED_ACCESS" ? "destructive" : "secondary"}>
                      {exception.exceptionType === "UNBOOKED_ACCESS" ? "UN-BOOKED ACCESS" : "NO-SHOW"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Unit {exception.unitNumber}
                    </div>
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4" />
                      {exception.location}
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                      <Clock className="h-4 w-4" />
                      {exception.windowLabel}
                    </div>
                    {exception.rawSystemIdentifier && (
                      <div className="md:col-span-2 text-xs text-on-surface-variant">
                        Raw identifier: {exception.rawSystemIdentifier}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
