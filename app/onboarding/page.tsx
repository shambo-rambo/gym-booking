"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UNITS_BY_FLOOR } from "@/lib/apartments"

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [apartmentNumber, setApartmentNumber] = useState("")
  const [buildingCode, setBuildingCode] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Already onboarded — send them home
  if (session && !(session.user as any)?.needsOnboarding) {
    router.replace("/")
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const aptNum = parseInt(apartmentNumber)
    if (isNaN(aptNum)) {
      setError("Please select your unit number")
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apartmentNumber: aptNum,
          buildingCode,
          phoneNumber: phoneNumber || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        setLoading(false)
        return
      }

      // Account is created but PENDING until a manager verifies it — sign out
      // rather than letting the still-active session into the app.
      await signOut({ redirect: false })
      router.replace("/login?registered=pending")
    } catch {
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>One more step</CardTitle>
          <CardDescription>
            Welcome{session?.user?.name ? `, ${session.user.name}` : ""}! We just need a couple of
            details to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apartmentNumber">Unit number</Label>
              <select
                id="apartmentNumber"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={apartmentNumber}
                onChange={(e) => setApartmentNumber(e.target.value)}
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
              <Input
                id="buildingCode"
                type="text"
                placeholder="Get this from your building manager"
                value={buildingCode}
                onChange={(e) => setBuildingCode(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                Posted in the lobby or shared via the building group chat.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">
                Phone number{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+61400000000"
                value={phoneNumber}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d+]/g, "")
                  if (val.startsWith("0")) val = "+61" + val.slice(1)
                  else if (val.length > 0 && !val.startsWith("+")) val = "+61" + val
                  setPhoneNumber(val)
                }}
              />
              <p className="text-xs text-gray-500">Australian mobile (+61XXXXXXXXX).</p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up your account…" : "Complete setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
