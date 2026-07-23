"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import LoadingSpinner from "@/components/LoadingSpinner"

interface UserSettings {
  email: string
  name: string
  phoneNumber: string | null
  notificationPreference: string
  apartmentNumber: number
  hasPassword: boolean
  twoFactorEnabled: boolean
}

interface TrustedDevice {
  id: string
  userAgent: string | null
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorAction, setTwoFactorAction] = useState<"disable" | "regenerate" | null>(null)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState("")
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([])

  const [notificationPreference, setNotificationPreference] = useState("EMAIL_ONLY")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")

  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

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
        if (data.twoFactorEnabled) fetchTrustedDevices()
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTrustedDevices = async () => {
    try {
      const response = await fetch("/api/user/2fa/trusted-devices")
      if (response.ok) {
        const data = await response.json()
        setTrustedDevices(data.devices)
      }
    } catch (error) {
      console.error("Failed to fetch trusted devices:", error)
    }
  }

  const handleTwoFactorAction = async () => {
    if (!twoFactorAction) return
    setTwoFactorError("")
    setTwoFactorLoading(true)
    try {
      const endpoint =
        twoFactorAction === "disable"
          ? "/api/user/2fa/disable"
          : "/api/user/2fa/regenerate-backup-codes"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorCode }),
      })
      const data = await response.json()
      if (!response.ok) {
        setTwoFactorError(data.error || "Invalid code")
        return
      }

      if (twoFactorAction === "disable") {
        setSettings((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev))
        setTrustedDevices([])
      } else {
        setNewBackupCodes(data.backupCodes)
      }
      setTwoFactorCode("")
      setTwoFactorAction(null)
    } catch {
      setTwoFactorError("Something went wrong. Please try again.")
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleRevokeDevice = async (id: string) => {
    try {
      const response = await fetch(`/api/user/2fa/trusted-devices/${id}`, { method: "DELETE" })
      if (response.ok) {
        setTrustedDevices((prev) => prev.filter((d) => d.id !== id))
      }
    } catch (error) {
      console.error("Failed to revoke device:", error)
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
        body: JSON.stringify({ email, currentPassword: currentPassword || undefined })
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

  const handleChangePassword = async () => {
    setPasswordError("")
    setPasswordSuccess("")
    if (newPw !== confirmPw) {
      setPasswordError("New passwords do not match")
      return
    }
    setSavingPassword(true)
    try {
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      })
      const data = await response.json()
      if (!response.ok) {
        setPasswordError(data.error || "Failed to change password")
        return
      }
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
      setPasswordSuccess("Password changed successfully!")
      setTimeout(() => setPasswordSuccess(""), 3000)
    } catch {
      setPasswordError("An error occurred. Please try again.")
    } finally {
      setSavingPassword(false)
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
    return <LoadingSpinner />
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
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} disabled />
                <p className="text-xs text-gray-400">To change your name, contact the building manager.</p>
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
              {email !== settings?.email && (
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password (required to change email)</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                  />
                </div>
              )}
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

          {/* Change Password — credential accounts only */}
          {settings?.hasPassword && (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPw">Current password</Label>
                  <Input
                    id="currentPw"
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPw">New password</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPw">Confirm new password</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password"
                  />
                </div>
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                    {passwordSuccess}
                  </div>
                )}
                <Button onClick={handleChangePassword} disabled={savingPassword} className="w-full">
                  {savingPassword ? "Saving..." : "Change Password"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                {settings?.twoFactorEnabled
                  ? "Enabled — an authenticator app code is required at login."
                  : "Add an extra layer of security using an authenticator app like Google Authenticator or Authy."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!settings?.twoFactorEnabled && (
                <Button onClick={() => router.push("/setup-2fa")} className="w-full">
                  Enable Two-Factor Authentication
                </Button>
              )}

              {settings?.twoFactorEnabled && (
                <>
                  {newBackupCodes ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        New backup codes — your old ones no longer work. Save these somewhere safe.
                      </p>
                      <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 border rounded-lg p-4">
                        {newBackupCodes.map((c) => (
                          <div key={c}>{c}</div>
                        ))}
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => setNewBackupCodes(null)}>
                        Done
                      </Button>
                    </div>
                  ) : twoFactorAction ? (
                    <div className="space-y-2">
                      <Label htmlFor="twoFactorCode">
                        {twoFactorAction === "disable"
                          ? "Enter a code to confirm disabling 2FA"
                          : "Enter a code to regenerate backup codes"}
                      </Label>
                      <Input
                        id="twoFactorCode"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        autoFocus
                      />
                      {twoFactorError && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                          {twoFactorError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setTwoFactorAction(null)
                            setTwoFactorCode("")
                            setTwoFactorError("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={twoFactorLoading || !twoFactorCode}
                          onClick={handleTwoFactorAction}
                        >
                          {twoFactorLoading ? "Confirming…" : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" onClick={() => setTwoFactorAction("regenerate")}>
                        Regenerate backup codes
                      </Button>
                      {(session?.user as any)?.role === "MANAGER" ? (
                        <p className="text-xs text-gray-400">
                          Required for manager accounts — cannot be disabled.
                        </p>
                      ) : (
                        <Button variant="outline" onClick={() => setTwoFactorAction("disable")}>
                          Disable 2FA
                        </Button>
                      )}
                    </div>
                  )}

                  {trustedDevices.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label>Trusted devices</Label>
                      {trustedDevices.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-sm py-1">
                          <div>
                            <p className="text-gray-700">{d.userAgent || "Unknown device"}</p>
                            <p className="text-xs text-gray-400">
                              Trusted until {new Date(d.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleRevokeDevice(d.id)}>
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you receive booking and queue notifications.{" "}
                <Link href="/settings/notifications" className="underline font-medium text-primary">
                  Manage SMS, email, and push notifications by category →
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notificationPreference">Notification method</Label>
                <Select value={notificationPreference} onValueChange={setNotificationPreference}>
                  <SelectTrigger id="notificationPreference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL_ONLY">Email only</SelectItem>
                    <SelectItem value="SMS_ONLY">SMS only</SelectItem>
                    <SelectItem value="BOTH">Email and SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(notificationPreference === "SMS_ONLY" || notificationPreference === "BOTH") && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Mobile number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+61400000000"
                  />
                  <p className="text-xs text-gray-400">Australian mobile, format +61XXXXXXXXX</p>
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
                {saving ? "Saving..." : "Save Preferences"}
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
