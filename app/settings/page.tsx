"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface UserSettings {
  email: string
  name: string
  phoneNumber: string | null
  notificationPreference: string
  apartmentNumber: number
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [notificationPreference, setNotificationPreference] = useState("EMAIL_ONLY")
  const [phoneNumber, setPhoneNumber] = useState("")

  useEffect(() => {
    if (status === "authenticated") {
      fetchSettings()
    }
  }, [status])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/user/settings")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        setNotificationPreference(data.notificationPreference)
        setPhoneNumber(data.phoneNumber || "")
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setError("")
    setSuccess("")
    setSaving(true)

    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPreference,
          phoneNumber: phoneNumber || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to update settings")
        setSaving(false)
        return
      }

      setSuccess("Settings updated successfully!")
      setSettings(data.user)
      setTimeout(() => setSuccess(""), 3000)

    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setSaving(false)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        <div className="space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <p className="text-sm text-gray-600 mt-1">{settings?.name}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="text-sm text-gray-600 mt-1">{settings?.email}</p>
              </div>
              <div>
                <Label>Apartment Number</Label>
                <p className="text-sm text-gray-600 mt-1">#{settings?.apartmentNumber}</p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you'd like to receive booking notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notificationPreference">Notification Method</Label>
                <select
                  id="notificationPreference"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={notificationPreference}
                  onChange={(e) => setNotificationPreference(e.target.value)}
                >
                  <option value="EMAIL_ONLY">Email Only</option>
                  <option value="SMS_ONLY">SMS Only</option>
                  <option value="BOTH">Both Email and SMS</option>
                </select>
                <p className="text-xs text-gray-500">
                  SMS is great for urgent queue notifications
                </p>
              </div>

              {(notificationPreference === "SMS_ONLY" || notificationPreference === "BOTH") && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+61..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Australian mobile format: +61XXXXXXXXX
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Notification Info */}
          <Card>
            <CardHeader>
              <CardTitle>What You'll Receive</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Booking confirmations</li>
                <li>✓ Booking reminders (2 hours before)</li>
                <li>✓ Queue slot available alerts (when someone cancels)</li>
                <li>✓ Account verification updates</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
