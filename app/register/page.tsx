"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import LoadingSpinner from "@/components/LoadingSpinner"
import { UNITS_BY_FLOOR } from "@/lib/apartments"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get("code") ?? ""

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    apartmentNumber: "",
    buildingCode: codeFromUrl,
    residencyType: "",
    hasFob: "" as "" | "yes" | "no",
    fobNumber: "",
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

    if (!formData.residencyType) {
      setError("Please select whether you're a resident or owner")
      setLoading(false)
      return
    }

    if (!formData.hasFob) {
      setError("Please let us know whether you have a building fob")
      setLoading(false)
      return
    }

    if (formData.hasFob === "yes" && !/^\d{3}$/.test(formData.fobNumber)) {
      setError("Enter the last 3 digits of your fob number")
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
          notificationPreference: "EMAIL_ONLY",
          hasFob: formData.hasFob === "yes",
          fobNumber: formData.hasFob === "yes" ? formData.fobNumber : undefined,
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
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">The Watertower</p>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Register to book gym and sauna facilities in your building.</CardDescription>
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
              <Label htmlFor="residencyType">I am a…</Label>
              <select
                id="residencyType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.residencyType}
                onChange={(e) => setFormData({ ...formData, residencyType: e.target.value })}
                required
              >
                <option value="">Select one…</option>
                <option value="TENANT">Resident</option>
                <option value="OWNER_OCCUPIER">Owner-occupier</option>
                <option value="NON_RESIDENT_OWNER">Non-resident owner</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Do you have a building fob?</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasFob: "yes" })}
                  className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${
                    formData.hasFob === "yes"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-input bg-background text-gray-600"
                  }`}
                >
                  Yes, I have one
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, hasFob: "no", fobNumber: "" })}
                  className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${
                    formData.hasFob === "no"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-input bg-background text-gray-600"
                  }`}
                >
                  No fob
                </button>
              </div>
              {formData.hasFob === "yes" && (
                <div className="pt-1">
                  <Input
                    placeholder="e.g. 292"
                    maxLength={3}
                    value={formData.fobNumber}
                    onChange={(e) => setFormData({ ...formData, fobNumber: e.target.value.replace(/\D/g, "") })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter just the <strong>last 3 digits</strong> of your fob number.
                  </p>
                </div>
              )}
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RegisterForm />
    </Suspense>
  )
}
