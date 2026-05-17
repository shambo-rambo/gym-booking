"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import QRCode from "react-qr-code"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Check, Printer } from "lucide-react"

export default function QrCodePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
    if (status === "authenticated" && (session?.user as any)?.role !== "MANAGER") router.replace("/")
  }, [status, session, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/manager/registration-link")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setUrl(data.url)
      })
      .catch(() => setError("Failed to load registration link"))
  }, [status])

  const handleCopy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === "loading" || !url) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
          {error ? (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          ) : (
            <p className="mt-8 text-on-surface-variant">Loading…</p>
          )}
        </main>
      </div>
    )
  }

  return (
    <>
      {/* ── Manager view (screen only) ── */}
      <div className="min-h-screen bg-surface print:hidden">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
          <h1 className="text-3xl font-bold mb-2">Registration QR code</h1>
          <p className="text-on-surface-variant mb-8">
            Display this in the lobby or gym. Residents scan it to register — the building code is pre-filled automatically.
          </p>

          <Card>
            <CardContent className="flex flex-col items-center gap-6 py-10">
              <div className="p-4 bg-white rounded-xl shadow-sm border border-outline-variant/20">
                <QRCode value={url} size={200} />
              </div>

              <p className="text-xs text-on-surface-variant text-center break-all max-w-sm">
                {url}
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button onClick={() => window.print()} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print sign
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-sm text-on-surface-variant">
            If you change the building code in <code className="font-mono bg-surface-container px-1 rounded">.env</code>, this QR code will stop working — generate a new one after any change.
          </p>
        </main>
      </div>

      {/* ── Printable sign (print only) ── */}
      <div className="hidden print:flex print:min-h-screen print:items-center print:justify-center print:p-12">
        <div className="text-center max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400 mb-4">
            Building amenities
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
            Book the Gym
            <br />& Sauna
          </h1>
          <p className="text-lg text-gray-500 mb-10">
            Scan to create your account
          </p>

          <div className="flex justify-center mb-10">
            <div className="p-5 border-2 border-gray-900 rounded-2xl inline-block">
              <QRCode value={url} size={220} />
            </div>
          </div>

          <p className="text-sm text-gray-400 break-all">
            {url}
          </p>
        </div>
      </div>
    </>
  )
}
