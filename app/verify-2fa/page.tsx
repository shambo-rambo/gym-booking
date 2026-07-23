"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Verify2FAPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [checkingTrustedDevice, setCheckingTrustedDevice] = useState(true)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }
    if (status !== "authenticated") return

    // Already verified this session (e.g. back button) — nothing to do here.
    if ((session?.user as any)?.twoFactorVerified) {
      router.replace("/")
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/auth/2fa/check-trusted-device", { method: "POST" })
        const data = await res.json()
        if (cancelled) return
        if (data.trusted) {
          await update({ recheck: true })
          router.replace("/")
          return
        }
      } catch {
        // fall through to the manual challenge
      }
      if (!cancelled) setCheckingTrustedDevice(false)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/2fa/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useBackupCode
            ? { backupCode: code, trustDevice }
            : { code, trustDevice }
        ),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(
          data.locked
            ? "Too many attempts. Please try again in 15 minutes."
            : data.error || "Invalid code"
        )
        setCode("")
        setLoading(false)
        return
      }

      await update({ recheck: true })
      router.replace("/")
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  if (status === "loading" || checkingTrustedDevice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-factor verification</CardTitle>
          <CardDescription>
            {useBackupCode
              ? "Enter one of your backup codes."
              : "Enter the 6-digit code from your authenticator app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{useBackupCode ? "Backup code" : "Verification code"}</Label>
              <Input
                id="code"
                inputMode={useBackupCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                placeholder={useBackupCode ? "XXXXX-XXXXX" : "123456"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trustDevice"
                checked={trustDevice}
                onCheckedChange={(v) => setTrustDevice(v === true)}
              />
              <Label htmlFor="trustDevice" className="font-normal cursor-pointer">
                Trust this device for 30 days
              </Label>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !code}>
              {loading ? "Verifying…" : "Verify"}
            </Button>

            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-700 underline w-full text-center"
              onClick={() => {
                setUseBackupCode(!useBackupCode)
                setCode("")
                setError("")
              }}
            >
              {useBackupCode ? "Use an authenticator code instead" : "Use a backup code instead"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
