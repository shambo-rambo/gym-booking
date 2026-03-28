"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    apartmentNumber: "",
    phoneNumber: "",
    notificationPreference: "EMAIL_ONLY" as const
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Validate apartment number
    const aptNum = parseInt(formData.apartmentNumber)
    if (isNaN(aptNum) || aptNum < 1 || aptNum > 65) {
      setError("Apartment number must be between 1 and 65")
      setLoading(false)
      return
    }

    // Validate password
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    // Validate phone number if SMS is enabled
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
          apartmentNumber: aptNum
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Registration failed")
        setLoading(false)
        return
      }

      // Success - redirect to login with success message
      router.push("/login?registered=true")
    } catch (error) {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>
            Create an account to book gym and sauna facilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
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
              <Label htmlFor="password">Password (min 8 characters)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apartmentNumber">Apartment Number (1-65)</Label>
              <Input
                id="apartmentNumber"
                type="number"
                min="1"
                max="65"
                value={formData.apartmentNumber}
                onChange={(e) => setFormData({ ...formData, apartmentNumber: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (Optional - for SMS)</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+61..."
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Australian mobile format: +61XXXXXXXXX
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notificationPreference">Notification Preference</Label>
              <select
                id="notificationPreference"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.notificationPreference}
                onChange={(e) => setFormData({
                  ...formData,
                  notificationPreference: e.target.value as any
                })}
              >
                <option value="EMAIL_ONLY">Email Only</option>
                <option value="SMS_ONLY">SMS Only</option>
                <option value="BOTH">Both Email and SMS</option>
              </select>
            </div>

            {error && (
              <div className="text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <p className="text-gray-600 mb-2">
              Your account will be reviewed by a manager before you can book facilities.
            </p>
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
