"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ManagerPage() {
  const { data: session, status } = useSession()

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

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-6">Manager Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/manager/users">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Approve and manage user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  • Verify pending registrations
                  <br />
                  • View all users
                  <br />
                  • Deactivate accounts
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/manager/bookings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>Booking Management</CardTitle>
                <CardDescription>View and manage all bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  • View all bookings
                  <br />
                  • Cancel bookings
                  <br />
                  • See user details
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/manager/blocked-slots">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>Facility Management</CardTitle>
                <CardDescription>Block slots for maintenance</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  • Block time slots
                  <br />
                  • Set maintenance periods
                  <br />
                  • View blocked slots
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/manager/announcements">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
                <CardDescription>Post building announcements</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  • Create announcements
                  <br />
                  • Set expiry dates
                  <br />
                  • Email all users
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  )
}
