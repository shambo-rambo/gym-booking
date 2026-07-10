"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import LoadingSpinner from "@/components/LoadingSpinner"
import { ChevronLeft, Home, Wrench, AlertTriangle, Megaphone, CalendarCheck, BellRing } from "lucide-react"

type Category = "BOOKINGS" | "AMENITY" | "MAINTENANCE" | "URGENT" | "GENERAL"

interface CategorySetting {
  category: Category
  email: boolean
  sms: boolean
  push: boolean
}

const CATEGORY_ROWS: { value: Category; label: string; description: string; icon: any; locked?: boolean }[] = [
  { value: "BOOKINGS", label: "Bookings", description: "Confirmations, reminders, and queue alerts", icon: CalendarCheck },
  { value: "AMENITY", label: "Amenity", description: "Gym, sauna, and other facility updates", icon: Home },
  { value: "MAINTENANCE", label: "Maintenance", description: "Scheduled works and outages", icon: Wrench },
  { value: "URGENT", label: "Urgent", description: "Serious or safety-related communications only", icon: AlertTriangle, locked: true },
  { value: "GENERAL", label: "General", description: "Everything else from building management", icon: Megaphone },
]

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true
}

export default function NotificationSettingsPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<Category, CategorySetting>>({} as any)
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState("")

  useEffect(() => {
    if (status === "authenticated") {
      fetchSettings()
      checkPushStatus()
    }
  }, [status])

  const fetchSettings = async () => {
    try {
      const [settingsRes, profileRes] = await Promise.all([
        fetch("/api/user/notification-settings"),
        fetch("/api/user/settings"),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        const map: Record<Category, CategorySetting> = {} as any
        for (const s of data.settings as CategorySetting[]) map[s.category] = s
        setSettings(map)
      }
      if (profileRes.ok) {
        const data = await profileRes.json()
        setPhoneNumber(data.phoneNumber || null)
      }
    } catch (err) {
      console.error("Failed to fetch notification settings:", err)
    } finally {
      setLoading(false)
    }
  }

  const checkPushStatus = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return
    }
    setPushSupported(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setPushEnabled(!!subscription)
    } catch (err) {
      console.error("Failed to check push subscription:", err)
    }
  }

  const enablePush = async () => {
    setPushError("")
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setPushError("Notification permission was not granted.")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        setPushError("Push notifications aren't configured yet.")
        return
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!res.ok) throw new Error("Failed to save subscription")
      setPushEnabled(true)
    } catch (err) {
      console.error("Failed to enable push:", err)
      setPushError("Couldn't enable push notifications. Please try again.")
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    setPushError("")
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        })
      }
      setPushEnabled(false)
    } catch (err) {
      console.error("Failed to disable push:", err)
      setPushError("Couldn't disable push notifications. Please try again.")
    } finally {
      setPushBusy(false)
    }
  }

  const updateSetting = (category: Category, channel: "email" | "sms" | "push", value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [category]: { ...prev[category], [channel]: value },
    }))
  }

  const handleSave = async () => {
    setError("")
    setSuccess("")
    setSaving(true)
    try {
      const res = await fetch("/api/user/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: Object.values(settings) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save settings")
        return
      }
      setSuccess("Notification settings saved!")
      setTimeout(() => setSuccess(""), 3000)
    } catch {
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

  const anyTextOn = Object.values(settings).some((s) => s?.sms)
  const showPhoneWarning = anyTextOn && !phoneNumber

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <ChevronLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="text-3xl font-bold mb-6">Notifications</h1>

        <div className="space-y-6">
          {/* Push permission */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-secondary" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Get a real-time alert on this device, even when the app isn't open.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!pushSupported ? (
                <p className="text-sm text-on-surface-variant">
                  Push notifications aren't supported in this browser.
                </p>
              ) : (
                <>
                  {isIos() && !isStandalone() && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                      On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then come back here to enable push notifications.
                    </div>
                  )}
                  {pushError && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{pushError}</div>
                  )}
                  <Button
                    onClick={pushEnabled ? disablePush : enablePush}
                    disabled={pushBusy}
                    variant={pushEnabled ? "outline" : "default"}
                    className="w-full"
                  >
                    {pushBusy ? "Please wait..." : pushEnabled ? "Disable push notifications" : "Enable push notifications"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Category rows */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Categories</CardTitle>
              <CardDescription>Choose how you're notified for each type of message.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CATEGORY_ROWS.map((row) => {
                const s = settings[row.value]
                if (!s) return null
                const isUrgent = row.locked
                return (
                  <div
                    key={row.value}
                    className={`rounded-xl border-2 p-4 ${
                      isUrgent ? "border-red-300 bg-red-50" : "border-outline-variant/30 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <row.icon className={`w-6 h-6 shrink-0 ${isUrgent ? "text-red-600" : "text-secondary"}`} />
                      <div>
                        <p className={`font-bold ${isUrgent ? "text-red-700" : "text-primary"}`}>{row.label}</p>
                        <p className="text-xs text-on-surface-variant">{row.description}</p>
                      </div>
                    </div>

                    {isUrgent && (
                      <p className="text-xs text-red-700 mb-3">
                        Urgent alerts are reserved for serious or safety-related building communications and are always sent by text and email.
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex flex-col items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                        Text
                        <Switch
                          checked={s.sms}
                          disabled={isUrgent}
                          onCheckedChange={(v) => updateSetting(row.value, "sms", v)}
                        />
                      </label>
                      <label className="flex flex-col items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                        Email
                        <Switch
                          checked={s.email}
                          disabled={isUrgent}
                          onCheckedChange={(v) => updateSetting(row.value, "email", v)}
                        />
                      </label>
                      <label className="flex flex-col items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                        In-app
                        <Switch
                          checked={s.push}
                          onCheckedChange={(v) => updateSetting(row.value, "push", v)}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}

              {showPhoneWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  Add a phone number in <Link href="/settings" className="underline font-medium">Settings</Link> to receive text messages.
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{success}</div>
              )}
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Notification Settings"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
