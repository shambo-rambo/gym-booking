"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { AlertTriangle, Bell } from "lucide-react"

interface Notice {
  id: string
  title: string
  message: string
  category: "AMENITY" | "MAINTENANCE" | "URGENT" | "GENERAL"
  createdAt: string
  createdByName: string
  readAt: string | null
}

const CATEGORY_LABELS: Record<Notice["category"], string> = {
  AMENITY: "Amenity",
  MAINTENANCE: "Maintenance",
  URGENT: "Urgent",
  GENERAL: "General",
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

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
  const urgent = notices.filter((n) => n.category === "URGENT")
  const rest = notices.filter((n) => n.category !== "URGENT")

  const NoticeCard = ({ notice }: { notice: Notice }) => {
    const isUrgent = notice.category === "URGENT"
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
            <p className={`font-bold ${isUrgent ? "text-red-700" : "text-primary"}`}>{notice.title}</p>
            {isUnread && <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />}
          </div>
          <Badge variant={isUrgent ? "destructive" : "outline"} className="text-[10px] shrink-0">
            {CATEGORY_LABELS[notice.category]}
          </Badge>
        </div>
        <p className="text-xs text-on-surface-variant mb-2">
          {formatDistanceToNow(new Date(notice.createdAt), { addSuffix: true })} · {notice.createdByName}
        </p>
        <p className={`text-sm text-on-surface-variant ${isOpen ? "" : "line-clamp-2"}`}>{notice.message}</p>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <div className="flex items-center gap-2 mt-6 mb-6">
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
          <div className="space-y-3">
            {urgent.map((n) => <NoticeCard key={n.id} notice={n} />)}
            {rest.map((n) => <NoticeCard key={n.id} notice={n} />)}
          </div>
        )}
      </main>
    </div>
  )
}
