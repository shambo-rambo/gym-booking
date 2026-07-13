"use client"

import { useEffect, useRef, useState } from "react"
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
import { ChevronLeft, Home, Wrench, AlertTriangle, Megaphone, Trash2 } from "lucide-react"
import { UNITS_BY_FLOOR, ALL_FLOORS } from "@/lib/apartments"
import { format, formatDistanceToNow } from "date-fns"

const SMS_COST_ESTIMATE = 0.06 // AUD per message, matches lib/notifications.ts ClickSend fallback

type Category = "AMENITY" | "MAINTENANCE" | "URGENT" | "GENERAL"
// Sent history can also include MOVE notices — resident-authored, never composable
// from this wizard (no CATEGORY_OPTIONS entry), so it's kept out of `Category`.
type HistoryCategory = Category | "MOVE"
type TargetMode = "ALL" | "TENANT" | "OWNERS" | "OWNER_OCCUPIER" | "FLOOR" | "APARTMENT"

const CATEGORY_OPTIONS: { value: Category; label: string; icon: any; sms: boolean }[] = [
  { value: "AMENITY", label: "Amenity", icon: Home, sms: false },
  { value: "MAINTENANCE", label: "Maintenance", icon: Wrench, sms: false },
  { value: "URGENT", label: "Urgent", icon: AlertTriangle, sms: true },
  { value: "GENERAL", label: "General", icon: Megaphone, sms: false },
]

interface RecipientDetail {
  id: string
  name: string
  apartmentNumber: number
  smsEligible: boolean
}

interface Preview {
  total: number
  smsEligible: number
  smsForced: boolean
  recipients: RecipientDetail[]
}

interface SentNotice {
  id: string
  title: string
  message: string
  category: HistoryCategory
  targetType: string
  targetValues: string[]
  sentSms: boolean
  createdAt: string
  createdByName: string
  recipientCount: number
}

export default function MessagesPage() {
  const { data: session, status } = useSession()

  const [step, setStep] = useState(1)
  const [category, setCategory] = useState<Category | null>(null)
  const [smsOn, setSmsOn] = useState(false)
  const [targetMode, setTargetMode] = useState<TargetMode>("ALL")
  const [selectedFloors, setSelectedFloors] = useState<number[]>([])
  const [selectedApartments, setSelectedApartments] = useState<number[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")

  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  // React state updates aren't synchronous, so a fast double-click/double-tap on
  // "Yes, send now" can fire two overlapping requests before `disabled={sending}`
  // reaches the DOM — this ref blocks re-entry immediately, before any await.
  const sendingRef = useRef(false)
  const [sendError, setSendError] = useState("")
  const [sentConfirm, setSentConfirm] = useState<{ recipientCount: number } | null>(null)
  const [awaitingFinalConfirm, setAwaitingFinalConfirm] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [confirmCancel, setConfirmCancel] = useState(false)

  const [history, setHistory] = useState<SentNotice[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/manager/messages/${id}`, { method: "DELETE" })
      if (res.ok) setHistory((prev) => prev.filter((n) => n.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

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

  // Reverses targetTypeAndValues() so a past message's audience can be restored into the wizard.
  const targetModeFromHistory = (n: SentNotice): { targetMode: TargetMode; floors: number[]; apartments: number[] } => {
    if (n.targetType === "FLOOR") return { targetMode: "FLOOR", floors: n.targetValues.map(Number), apartments: [] }
    if (n.targetType === "APARTMENT") return { targetMode: "APARTMENT", floors: [], apartments: n.targetValues.map(Number) }
    if (n.targetType === "RESIDENCY") {
      const values = new Set(n.targetValues)
      if (values.size === 1 && values.has("TENANT")) return { targetMode: "TENANT", floors: [], apartments: [] }
      if (values.size === 1 && values.has("OWNER_OCCUPIER")) return { targetMode: "OWNER_OCCUPIER", floors: [], apartments: [] }
      return { targetMode: "OWNERS", floors: [], apartments: [] }
    }
    return { targetMode: "ALL", floors: [], apartments: [] }
  }

  const FLOOR_LABELS = new Map(ALL_FLOORS.map((f) => [f.floor, f.label]))

  // Human-readable audience description for a sent message, e.g. "Level 3" or "Apt 305"
  // instead of just a raw recipient count.
  const describeAudience = (n: SentNotice): string => {
    if (n.targetType === "ALL") return "Everyone"
    if (n.targetType === "RESIDENCY") {
      const values = new Set(n.targetValues)
      if (values.size === 1 && values.has("TENANT")) return "Tenants"
      if (values.size === 1 && values.has("OWNER_OCCUPIER")) return "Owner-occupiers"
      return "Owners"
    }
    if (n.targetType === "FLOOR") {
      const labels = n.targetValues.map((v) => FLOOR_LABELS.get(Number(v)) ?? `Level ${v}`)
      return labels.join(", ")
    }
    if (n.targetType === "APARTMENT") {
      return n.targetValues.length === 1
        ? `Apt ${n.targetValues[0]}`
        : `${n.targetValues.length} apartments`
    }
    return "Custom audience"
  }

  const reuseNotice = (n: SentNotice) => {
    // Move notices aren't composable from this wizard (no CATEGORY_OPTIONS entry) —
    // the "Use as template" button is hidden for them, this is just a backstop.
    if (n.category === "MOVE") return
    const { targetMode: tm, floors, apartments } = targetModeFromHistory(n)
    setCategory(n.category)
    setSmsOn(n.sentSms)
    setTargetMode(tm)
    setSelectedFloors(floors)
    setSelectedApartments(apartments)
    setTitle(n.title)
    setMessage(n.message)
    setPreview(null)
    setExcludedIds(new Set())
    setShowRecipients(false)
    setSendError("")
    setSentConfirm(null)
    setConfirmCancel(false)
    setAwaitingFinalConfirm(false)
    setStep(3)
  }

  const canProceedFromTarget =
    targetMode === "FLOOR" ? selectedFloors.length > 0 :
    targetMode === "APARTMENT" ? selectedApartments.length > 0 :
    true

  const goToReview = async () => {
    setStep(4)
    setPreviewLoading(true)
    setExcludedIds(new Set())
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
    if (sendingRef.current) return
    sendingRef.current = true
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
          sendSms: smsOn,
          excludedUserIds: Array.from(excludedIds),
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
      sendingRef.current = false
      setSending(false)
      setAwaitingFinalConfirm(false)
    }
  }

  const includedRecipients = preview ? preview.recipients.filter((r) => !excludedIds.has(r.id)) : []
  const includedTotal = includedRecipients.length
  const includedSmsEligible = includedRecipients.filter((r) => r.smsEligible).length

  const toggleRecipient = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startNew = () => {
    setStep(1)
    setCategory(null)
    setSmsOn(false)
    setTargetMode("ALL")
    setSelectedFloors([])
    setSelectedApartments([])
    setTitle("")
    setMessage("")
    setPreview(null)
    setSentConfirm(null)
    setSendError("")
    setShowRecipients(false)
    setExcludedIds(new Set())
    setConfirmCancel(false)
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

        <div className="flex items-center justify-between gap-3 mb-6">
          {step > 1 ? (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                style={{ minHeight: "48px" }}
                className="gap-1 px-4 text-sm font-semibold"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                style={{ minHeight: "48px" }}
                className="px-4 text-sm font-semibold text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setConfirmCancel(true)}
              >
                Cancel
              </Button>
            </div>
          ) : <div />}
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide shrink-0">Step {step} of 4</p>
        </div>
        <Progress value={(step / 4) * 100} className="mb-8" />

        {confirmCancel && (
          <Card className="mb-6 border-destructive/30">
            <CardContent className="p-5 space-y-4">
              <p className="font-bold text-primary">Discard this message?</p>
              <p className="text-sm text-on-surface-variant">
                What you've entered so far will be lost and nothing will be sent.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 text-sm font-semibold"
                  style={{ minHeight: "56px" }}
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep editing
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 text-sm font-semibold"
                  style={{ minHeight: "56px" }}
                  onClick={startNew}
                >
                  Discard message
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <div>
            <h2 data-highlight="message-category" className="text-lg font-bold mb-4">What kind of message is this?</h2>
            <div className="grid grid-cols-1 gap-3">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setCategory(opt.value)
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

        {step === 2 && !confirmCancel && (
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

        {step === 3 && !confirmCancel && (
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

        {step === 4 && !confirmCancel && (
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
                  <div className="flex items-center justify-between">
                    <p className="text-base">
                      Goes to <span className="font-bold">{includedTotal}</span> resident{includedTotal === 1 ? "" : "s"}
                      {excludedIds.size > 0 ? ` (${excludedIds.size} removed below)` : ""}.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0 px-3"
                      onClick={() => setShowRecipients((s) => !s)}
                    >
                      {showRecipients ? "Hide list" : "Show all recipients"}
                    </Button>
                  </div>

                  {showRecipients && (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-outline-variant/20 divide-y divide-outline-variant/10">
                      {preview.recipients.map((r) => {
                        const included = !excludedIds.has(r.id)
                        const getsSms = included && smsOn && r.smsEligible
                        return (
                          <label key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                            <Checkbox className="w-4 h-4 shrink-0" checked={included} onCheckedChange={() => toggleRecipient(r.id)} />
                            <span className="flex-1">{r.name} <span className="text-on-surface-variant">· Apt {r.apartmentNumber}</span></span>
                            <span className="text-xs text-on-surface-variant text-right shrink-0">
                              {!included ? "Removed" : getsSms ? "Text" : "Email"}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
                    <div>
                      <p className="font-semibold">Email + in-app</p>
                      <p className="text-xs text-on-surface-variant">
                        Always sent to all {includedTotal} — residents can't opt out of email (it's used for AGM votes etc.)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
                    <div>
                      <p className="font-semibold">Also send as text</p>
                      <p className="text-xs text-on-surface-variant">
                        {preview.smsForced
                          ? `Urgent overrides preference — ${includedSmsEligible} of ${includedTotal} residents have a mobile on file`
                          : `${includedSmsEligible} of ${includedTotal} residents opted into texts`
                        } · est. ${(includedSmsEligible * SMS_COST_ESTIMATE).toFixed(2)}. They get a text instead of an email, not both.
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
                disabled={sending || previewLoading || includedTotal === 0}
                onClick={() => setAwaitingFinalConfirm(true)}
              >
                Send message
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-center">
                  Send this to {includedTotal} resident{includedTotal === 1 ? "" : "s"} now?
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
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">{n.category}</Badge>
                          <button
                            type="button"
                            aria-label="Delete notice"
                            onClick={() => setConfirmDeleteId(n.id)}
                            className="text-on-surface-variant/50 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-on-surface-variant line-clamp-2 mt-1">{n.message}</p>
                      <p className="text-xs text-on-surface-variant/70 mt-2">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })} · {n.createdByName}
                      </p>
                      <p className="text-xs font-semibold text-secondary mt-0.5">
                        {describeAudience(n)} · {n.recipientCount} recipient{n.recipientCount === 1 ? "" : "s"}
                      </p>
                      {confirmDeleteId === n.id ? (
                        <div className="flex items-center gap-2 mt-3">
                          <p className="text-xs text-destructive flex-1">Delete this notice for everyone?</p>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ minHeight: "36px" }}
                            className="text-xs px-3"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            style={{ minHeight: "36px" }}
                            className="text-xs px-3"
                            disabled={deletingId === n.id}
                            onClick={() => handleDelete(n.id)}
                          >
                            {deletingId === n.id ? "Deleting…" : "Delete"}
                          </Button>
                        </div>
                      ) : (
                        n.category !== "MOVE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ minHeight: "44px" }}
                            className="w-full mt-3 text-sm font-semibold"
                            onClick={() => reuseNotice(n)}
                          >
                            Use as template
                          </Button>
                        )
                      )}
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
