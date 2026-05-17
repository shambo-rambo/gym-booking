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
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")

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
        setName(data.name || "")
        setEmail(data.email || "")
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setProfileError("")
    setProfileSuccess("")
    setSavingProfile(true)
    try {
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      })
      const data = await response.json()
      if (!response.ok) {
        setProfileError(data.error || "Failed to update profile")
        return
      }
      setSettings(data.user)
      setProfileSuccess("Profile updated successfully!")
      setTimeout(() => setProfileSuccess(""), 3000)
    } catch {
      setProfileError("An error occurred. Please try again.")
    } finally {
      setSavingProfile(false)
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
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        <div className="space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Update your name and email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Apartment Number</Label>
                <p className="text-sm text-gray-600">#{settings?.apartmentNumber}</p>
                <p className="text-xs text-gray-400">To change your apartment number, contact the building manager.</p>
              </div>
              {profileError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                  {profileSuccess}
                </div>
              )}
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                All notifications are currently sent by email only. SMS notifications coming soon.
              </CardDescription>
            </CardHeader>
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
