"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow, differenceInCalendarDays } from "date-fns"
import { AlertTriangle, Bell, ChevronDown, Truck } from "lucide-react"

interface Notice {
  id: string
  title: string
  message: string
  category: "AMENITY" | "MAINTENANCE" | "URGENT" | "GENERAL" | "MOVE"
  createdAt: string
  eventAt: string | null
  createdByName: string
  readAt: string | null
}

const CATEGORY_LABELS: Record<Notice["category"], string> = {
  AMENITY: "Amenity",
  MAINTENANCE: "Maintenance",
  URGENT: "Urgent",
  GENERAL: "General",
  MOVE: "Move",
}

// A notice's "effective" date: the date it's about (eventAt, e.g. a Move In/Out)
// if it has one, otherwise the date it was posted.
const effectiveDate = (notice: Notice) => new Date(notice.eventAt ?? notice.createdAt)

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") fetchNotices()
  }, [status])

  const fetchNotices = async () => {
    try {
      const res = await fetch("/api/notices")
      if (res.ok) {
        const data = await res.json()
        setNotices(data.notices || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const openNotice = async (notice: Notice) => {
    setOpenId(openId === notice.id ? null : notice.id)
    if (!notice.readAt) {
      setNotices((prev) => prev.map((n) => (n.id === notice.id ? { ...n, readAt: new Date().toISOString() } : n)))
      await fetch(`/api/notices/${notice.id}/read`, { method: "POST" })
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const unreadCount = notices.filter((n) => !n.readAt).length

  // Urgent notices get distinct card styling (below) but otherwise bucket by date
  // like everything else — they're not pinned above Past forever. Their Today→Past
  // cutoff is 48 hours since posting rather than a calendar-day boundary, matching
  // how long they stay in the feed at all before auto-expiring (lib/notice-send.ts).
  const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000
  const bucketFor = (n: Notice): "today" | "upcoming" | "past" => {
    const diffDays = differenceInCalendarDays(effectiveDate(n), new Date())
    if (diffDays > 0) return "upcoming"
    if (n.category === "URGENT") {
      return Date.now() - effectiveDate(n).getTime() < URGENT_WINDOW_MS ? "today" : "past"
    }
    return diffDays === 0 ? "today" : "past"
  }

  const today = notices.filter((n) => bucketFor(n) === "today")
  const upcoming = notices
    .filter((n) => bucketFor(n) === "upcoming")
    .sort((a, b) => effectiveDate(a).getTime() - effectiveDate(b).getTime())
  const past = notices
    .filter((n) => bucketFor(n) === "past")
    .sort((a, b) => effectiveDate(b).getTime() - effectiveDate(a).getTime())

  const NoticeCard = ({ notice }: { notice: Notice }) => {
    const isUrgent = notice.category === "URGENT"
    const isMove = notice.category === "MOVE"
    const isUnread = !notice.readAt
    const isOpen = openId === notice.id
    return (
      <button
        onClick={() => openNotice(notice)}
        className={`w-full text-left bg-white rounded-xl shadow-sm border p-4 transition-colors ${
          isUrgent ? "border-red-300 bg-red-50" : "border-outline-variant/20"
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            {isUrgent && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
            {isMove && <Truck className="w-4 h-4 text-secondary shrink-0" />}
            <p className={`font-bold ${isUrgent ? "text-red-700" : "text-primary"}`}>{notice.title}</p>
            {isUnread && <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />}
          </div>
          <Badge variant={isUrgent ? "destructive" : "outline"} className="text-[10px] shrink-0">
            {CATEGORY_LABELS[notice.category]}
          </Badge>
        </div>
        <p className="text-xs text-on-surface-variant mb-2">
          {isMove && notice.eventAt
            ? format(new Date(notice.eventAt), "EEE d MMM · h:mma")
            : `${formatDistanceToNow(new Date(notice.createdAt), { addSuffix: true })} · ${notice.createdByName}`}
        </p>
        <p className={`text-sm text-on-surface-variant ${isOpen ? "" : "line-clamp-2"}`}>{notice.message}</p>
      </button>
    )
  }

  const NoticeSection = ({
    label,
    items,
    collapsible,
    open,
    onToggle,
  }: {
    label: string
    items: Notice[]
    collapsible?: boolean
    open?: boolean
    onToggle?: () => void
  }) => {
    if (items.length === 0) return null

    if (!collapsible) {
      return (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant/70 mt-2">{label}</h2>
          {items.map((n) => <NoticeCard key={n.id} notice={n} />)}
        </div>
      )
    }

    return (
      <div className="mt-2">
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] ${
            open
              ? "bg-primary/5 border-primary/20"
              : "bg-white border-outline-variant/20 shadow-sm"
          }`}
        >
          <span className="text-sm font-bold text-primary">{label}</span>
          <span
            className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none ${
              open ? "bg-primary text-on-primary" : "bg-secondary/15 text-secondary"
            }`}
          >
            {items.length}
          </span>
          <span
            className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              open ? "bg-primary/10" : "bg-surface-container-low"
            }`}
          >
            <ChevronDown
              className={`w-4 h-4 text-primary transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 pt-3">
              {items.map((n) => <NoticeCard key={n.id} notice={n} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <div className="flex items-center gap-2 mt-6 mb-2">
          <Bell className="w-5 h-5 text-secondary" />
          <h1 className="text-lg font-bold text-primary">Notices</h1>
          {unreadCount > 0 && (
            <Badge className="ml-auto bg-secondary text-on-secondary">{unreadCount} new</Badge>
          )}
        </div>

        {notices.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/20 p-8 text-center">
            <p className="text-on-surface-variant font-medium mb-1">No notices yet</p>
            <p className="text-sm text-on-surface-variant/60">Building announcements will show up here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <NoticeSection label="Today" items={today} />
            <NoticeSection label="Upcoming" items={upcoming} />
            <NoticeSection
              label="Past"
              items={past}
              collapsible
              open={pastOpen}
              onToggle={() => setPastOpen((o) => !o)}
            />
          </div>
        )}
      </main>
    </div>
  )
}
