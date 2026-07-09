"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import LoadingSpinner from "@/components/LoadingSpinner"
import { ChevronLeft, Home, Wrench, AlertTriangle, Megaphone } from "lucide-react"
import { UNITS_BY_FLOOR, ALL_FLOORS } from "@/lib/apartments"
import { format, formatDistanceToNow } from "date-fns"

type Category = "AMENITY" | "MAINTENANCE" | "URGENT" | "GENERAL"
type TargetMode = "ALL" | "TENANT" | "OWNERS" | "OWNER_OCCUPIER" | "FLOOR" | "APARTMENT"

const CATEGORY_OPTIONS: { value: Category; label: string; icon: any; email: boolean; sms: boolean }[] = [
  { value: "AMENITY", label: "Amenity", icon: Home, email: false, sms: false },
  { value: "MAINTENANCE", label: "Maintenance", icon: Wrench, email: true, sms: false },
  { value: "URGENT", label: "Urgent", icon: AlertTriangle, email: true, sms: true },
  { value: "GENERAL", label: "General", icon: Megaphone, email: false, sms: false },
]

interface Preview {
  total: number
  emailEligible: number
  smsEligible: number
  smsForced: boolean
  estimatedSmsCost: number
}

interface SentNotice {
  id: string
  title: string
  message: string
  category: Category
  createdAt: string
  createdByName: string
  recipientCount: number
}

export default function MessagesPage() {
  const { data: session, status } = useSession()

  const [step, setStep] = useState(1)
  const [category, setCategory] = useState<Category | null>(null)
  const [emailOn, setEmailOn] = useState(false)
  const [smsOn, setSmsOn] = useState(false)
  const [targetMode, setTargetMode] = useState<TargetMode>("ALL")
  const [selectedFloors, setSelectedFloors] = useState<number[]>([])
  const [selectedApartments, setSelectedApartments] = useState<number[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")

  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [sentConfirm, setSentConfirm] = useState<{ recipientCount: number } | null>(null)
  const [awaitingFinalConfirm, setAwaitingFinalConfirm] = useState(false)

  const [history, setHistory] = useState<SentNotice[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/manager/messages")
      if (res.ok) setHistory((await res.json()).notices)
    } finally {
      setHistoryLoading(false)
    }
  }

  if (status === "loading") return <LoadingSpinner />
  if (!session) redirect("/login")
  const isManager = (session.user as any)?.role === "MANAGER"
  if (!isManager) redirect("/")

  const targetTypeAndValues = (): { targetType: string; targetValues: string[] } => {
    switch (targetMode) {
      case "ALL": return { targetType: "ALL", targetValues: [] }
      case "TENANT": return { targetType: "RESIDENCY", targetValues: ["TENANT"] }
      case "OWNERS": return { targetType: "RESIDENCY", targetValues: ["OWNER_OCCUPIER", "NON_RESIDENT_OWNER"] }
      case "OWNER_OCCUPIER": return { targetType: "RESIDENCY", targetValues: ["OWNER_OCCUPIER"] }
      case "FLOOR": return { targetType: "FLOOR", targetValues: selectedFloors.map(String) }
      case "APARTMENT": return { targetType: "APARTMENT", targetValues: selectedApartments.map(String) }
    }
  }

  const canProceedFromTarget =
    targetMode === "FLOOR" ? selectedFloors.length > 0 :
    targetMode === "APARTMENT" ? selectedApartments.length > 0 :
    true

  const goToReview = async () => {
    setStep(4)
    setPreviewLoading(true)
    try {
      const { targetType, targetValues } = targetTypeAndValues()
      const res = await fetch("/api/manager/messages/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetValues, category }),
      })
      if (res.ok) setPreview(await res.json())
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    setSendError("")
    try {
      const { targetType, targetValues } = targetTypeAndValues()
      const res = await fetch("/api/manager/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          targetType,
          targetValues,
          title,
          message,
          sendEmail: emailOn,
          sendSms: smsOn,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || "Failed to send")
        return
      }
      setSentConfirm({ recipientCount: data.recipientCount })
      await fetchHistory()
    } catch {
      setSendError("Something went wrong sending this message.")
    } finally {
      setSending(false)
      setAwaitingFinalConfirm(false)
    }
  }

  const startNew = () => {
    setStep(1)
    setCategory(null)
    setEmailOn(false)
    setSmsOn(false)
    setTargetMode("ALL")
    setSelectedFloors([])
    setSelectedApartments([])
    setTitle("")
    setMessage("")
    setPreview(null)
    setSentConfirm(null)
    setSendError("")
  }

  if (sentConfirm) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 sm:px-6 pt-20 pb-28">
          <Card className="mt-10">
            <CardContent className="p-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-bold text-lg text-primary mb-1">Message sent</p>
              <p className="text-sm text-on-surface-variant mb-6">
                It went to {sentConfirm.recipientCount} resident{sentConfirm.recipientCount === 1 ? "" : "s"}.
              </p>
              <Button style={{ minHeight: "60px" }} className="w-full text-base" onClick={startNew}>
                Send another message
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 sm:px-6 pt-20 pb-28">
        <div className="flex items-center justify-between mt-6 mb-2">
          <h1 className="text-2xl font-bold text-primary">Send a message</h1>
        </div>

        <div className="flex items-center gap-3 mb-6">
          {step > 1 ? (
            <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => setStep((s) => Math.max(1, s - 1))}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : <div />}
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide ml-auto">Step {step} of 4</p>
        </div>
        <Progress value={(step / 4) * 100} className="mb-8" />

        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold mb-4">What kind of message is this?</h2>
            <div className="grid grid-cols-1 gap-3">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setCategory(opt.value)
                    setEmailOn(opt.email)
                    setSmsOn(opt.sms)
                    setStep(2)
                  }}
                  style={{ minHeight: "60px" }}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-outline-variant/30 bg-white hover:border-secondary transition-colors text-left active:scale-[0.98]"
                >
                  <opt.icon className="w-6 h-6 text-secondary shrink-0" />
                  <span className="text-lg font-bold text-primary">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold mb-4">Who should get this?</h2>
            <RadioGroup value={targetMode} onValueChange={(v) => setTargetMode(v as TargetMode)} className="gap-3">
              {[
                { value: "ALL", label: "Everyone" },
                { value: "TENANT", label: "Tenants" },
                { value: "OWNERS", label: "Owners" },
                { value: "OWNER_OCCUPIER", label: "Owner-occupiers" },
                { value: "FLOOR", label: "By floor" },
                { value: "APARTMENT", label: "By apartment" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{ minHeight: "60px" }}
                  className="flex items-center gap-4 px-5 rounded-xl border-2 border-outline-variant/30 bg-white cursor-pointer has-[[data-state=checked]]:border-secondary"
                >
                  <RadioGroupItem value={opt.value} id={opt.value} className="w-5 h-5" />
                  <span className="text-base font-semibold text-primary">{opt.label}</span>
                </label>
              ))}
            </RadioGroup>

            {targetMode === "FLOOR" && (
              <div className="mt-4 space-y-2">
                {ALL_FLOORS.map((f) => (
                  <label key={f.floor} style={{ minHeight: "60px" }} className="flex items-center gap-4 px-5 rounded-xl border border-outline-variant/20 bg-white cursor-pointer">
                    <Checkbox
                      className="w-5 h-5"
                      checked={selectedFloors.includes(f.floor)}
                      onCheckedChange={(checked) =>
                        setSelectedFloors((prev) => checked ? [...prev, f.floor] : prev.filter((x) => x !== f.floor))
                      }
                    />
                    <span className="text-base font-medium">{f.label}</span>
                  </label>
                ))}
              </div>
            )}

            {targetMode === "APARTMENT" && (
              <div className="mt-4 space-y-4">
                {UNITS_BY_FLOOR.map((f) => (
                  <div key={f.label}>
                    <p className="text-xs font-bold uppercase tracking-wide text-secondary mb-2">{f.label}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {f.units.map((unit) => (
                        <label key={unit} style={{ minHeight: "60px" }} className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-white cursor-pointer">
                          <Checkbox
                            checked={selectedApartments.includes(unit)}
                            onCheckedChange={(checked) =>
                              setSelectedApartments((prev) => checked ? [...prev, unit] : prev.filter((x) => x !== unit))
                            }
                          />
                          <span className="text-sm font-medium">{unit}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full mt-6 text-base"
              style={{ minHeight: "60px" }}
              disabled={!canProceedFromTarget}
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">What's the message?</h2>
            <div className="space-y-2">
              <Label className="text-base">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-base"
                style={{ minHeight: "60px" }}
                placeholder="e.g. Sauna closed for maintenance"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="text-base min-h-[160px]"
                placeholder="Details residents need to know…"
              />
            </div>
            <Button
              className="w-full text-base"
              style={{ minHeight: "60px" }}
              disabled={!title.trim() || !message.trim()}
              onClick={goToReview}
            >
              Continue to review
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Review and send</h2>

            <Card>
              <CardContent className="p-5 space-y-1">
                <p className="font-bold text-primary">{title}</p>
                <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{message}</p>
              </CardContent>
            </Card>

            {previewLoading ? (
              <p className="text-sm text-on-surface-variant">Calculating recipients…</p>
            ) : preview ? (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="text-base">
                    Goes to <span className="font-bold">{preview.total}</span> resident{preview.total === 1 ? "" : "s"}. In-app: all {preview.total}.
                  </p>

                  <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
                    <div>
                      <p className="font-semibold">Email</p>
                      <p className="text-xs text-on-surface-variant">{preview.emailEligible} residents allow email</p>
                    </div>
                    <Switch checked={emailOn} onCheckedChange={setEmailOn} />
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
                    <div>
                      <p className="font-semibold">Text</p>
                      <p className="text-xs text-on-surface-variant">
                        {preview.smsForced
                          ? `Urgent overrides preference — ${preview.smsEligible} residents have a mobile on file`
                          : `${preview.smsEligible} residents allow texts`
                        } · est. ${preview.estimatedSmsCost.toFixed(2)}
                      </p>
                    </div>
                    <Switch checked={smsOn} onCheckedChange={setSmsOn} />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {sendError && <p className="text-sm text-red-600">{sendError}</p>}

            {!awaitingFinalConfirm ? (
              <Button
                className="w-full text-base"
                style={{ minHeight: "60px" }}
                disabled={sending || previewLoading}
                onClick={() => setAwaitingFinalConfirm(true)}
              >
                Send message
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-center">
                  Send this to {preview?.total ?? 0} resident{(preview?.total ?? 0) === 1 ? "" : "s"} now?
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" style={{ minHeight: "60px" }} onClick={() => setAwaitingFinalConfirm(false)}>
                    Go back
                  </Button>
                  <Button className="flex-1 text-base" style={{ minHeight: "60px" }} disabled={sending} onClick={handleSend}>
                    {sending ? "Sending…" : "Yes, send now"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="mt-10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-secondary mb-3">Sent history</h2>
            {historyLoading ? (
              <p className="text-sm text-on-surface-variant">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No messages sent yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-primary">{n.title}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{n.category}</Badge>
                      </div>
                      <p className="text-sm text-on-surface-variant line-clamp-2 mt-1">{n.message}</p>
                      <p className="text-xs text-on-surface-variant/70 mt-2">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })} · {n.createdByName} · {n.recipientCount} recipient{n.recipientCount === 1 ? "" : "s"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
