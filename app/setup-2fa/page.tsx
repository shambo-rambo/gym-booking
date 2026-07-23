"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import QRCode from "react-qr-code"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Check } from "lucide-react"

type Step = "loading" | "scan" | "confirm" | "backup-codes"

export default function Setup2FAPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [step, setStep] = useState<Step>("loading")
  const [otpauthUrl, setOtpauthUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }
    if (status !== "authenticated") return

    // Already enabled and not forced here for a re-setup — nothing to do.
    if ((session?.user as any)?.twoFactorEnabled) {
      router.replace("/")
      return
    }

    fetch("/api/user/2fa/setup", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setOtpauthUrl(data.otpauthUrl)
        setSecret(data.secret)
        setStep("scan")
      })
      .catch(() => setError("Failed to start setup. Please refresh and try again."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/user/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Invalid code")
        setLoading(false)
        return
      }
      setBackupCodes(data.backupCodes)
      setStep("backup-codes")
      setLoading(false)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  const handleContinue = async () => {
    await update({ recheck: true })
    router.replace("/")
  }

  const handleCopyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isManager = (session?.user as any)?.role === "MANAGER"

  if (step === "loading" || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        {error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 max-w-md">
            {error}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading…</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up two-factor authentication</CardTitle>
          <CardDescription>
            {step === "scan" &&
              (isManager
                ? "Required for manager accounts. Scan the QR code with an authenticator app like Google Authenticator or Authy."
                : "Scan the QR code with an authenticator app like Google Authenticator or Authy.")}
            {step === "backup-codes" && "Save these backup codes somewhere safe — each one works once."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "scan" && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-xl border">
                <QRCode value={otpauthUrl} size={180} />
              </div>

              <div className="text-xs text-gray-500 text-center break-all">
                Can&apos;t scan? Enter this key manually: <span className="font-mono">{secret}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Enter the 6-digit code to confirm</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !code}>
                {loading ? "Verifying…" : "Confirm & enable"}
              </Button>
            </form>
          )}

          {step === "backup-codes" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 border rounded-lg p-4">
                {backupCodes.map((c) => (
                  <div key={c}>{c}</div>
                ))}
              </div>

              <Button variant="outline" className="w-full gap-2" onClick={handleCopyBackupCodes}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy codes"}
              </Button>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="savedConfirmed"
                  checked={savedConfirmed}
                  onCheckedChange={(v) => setSavedConfirmed(v === true)}
                />
                <Label htmlFor="savedConfirmed" className="font-normal cursor-pointer">
                  I&apos;ve saved these codes somewhere safe
                </Label>
              </div>

              <Button className="w-full" disabled={!savedConfirmed} onClick={handleContinue}>
                Continue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
