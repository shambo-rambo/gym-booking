"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { UNITS_BY_FLOOR } from "@/lib/apartments"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get("code") ?? ""

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    apartmentNumber: "",
    buildingCode: codeFromUrl,
    phoneNumber: "",
    notificationPreference: "EMAIL_ONLY" as "EMAIL_ONLY" | "SMS_ONLY" | "BOTH",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const aptNum = parseInt(formData.apartmentNumber)
    if (isNaN(aptNum)) {
      setError("Please select your unit number")
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    if (formData.notificationPreference !== "EMAIL_ONLY" && !formData.phoneNumber) {
      setError("Phone number is required for SMS notifications")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          apartmentNumber: aptNum,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Registration failed")
        setLoading(false)
        return
      }

      router.push(
        data.verified
          ? "/login?registered=verified"
          : "/login?registered=pending"
      )
    } catch {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Book the gym and sauna for your building
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apartmentNumber">Unit number</Label>
              <select
                id="apartmentNumber"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.apartmentNumber}
                onChange={(e) => setFormData({ ...formData, apartmentNumber: e.target.value })}
                required
              >
                <option value="">Select your unit…</option>
                {UNITS_BY_FLOOR.map(({ label, units }) => (
                  <optgroup key={label} label={label}>
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildingCode">Building access code</Label>
              {codeFromUrl ? (
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-green-300 bg-green-50 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Code applied from QR scan
                </div>
              ) : (
                <>
                  <Input
                    id="buildingCode"
                    type="text"
                    placeholder="Get this from your building manager"
                    value={formData.buildingCode}
                    onChange={(e) => setFormData({ ...formData, buildingCode: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Posted in the lobby or shared via the building group chat.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+61400000000"
                value={formData.phoneNumber}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d+]/g, "")
                  if (val.startsWith("0")) val = "+61" + val.slice(1)
                  else if (val.length > 0 && !val.startsWith("+")) val = "+61" + val
                  setFormData({ ...formData, phoneNumber: val })
                }}
              />
              <p className="text-xs text-gray-500">Australian mobile (+61XXXXXXXXX), for SMS reminders only.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notificationPreference">Notifications</Label>
              <select
                id="notificationPreference"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.notificationPreference}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notificationPreference: e.target.value as "EMAIL_ONLY" | "SMS_ONLY" | "BOTH",
                  })
                }
              >
                <option value="EMAIL_ONLY">Email only</option>
                <option value="SMS_ONLY">SMS only</option>
                <option value="BOTH">Email and SMS</option>
              </select>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
