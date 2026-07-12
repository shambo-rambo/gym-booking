"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"

const STORAGE_KEY = "pending-highlight"
const SEARCH_TIMEOUT_MS = 4000
const VISIBLE_MS = 3000
const PADDING = 6

type Rect = { top: number; left: number; width: number; height: number }

export default function SpotlightOnce() {
  const pathname = usePathname()
  const [rect, setRect] = useState<Rect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const targetId = window.sessionStorage.getItem(STORAGE_KEY)
    if (!targetId) return
    window.sessionStorage.removeItem(STORAGE_KEY) // single-use

    let cancelled = false
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const measure = () => {
      const el = document.querySelector(`[data-highlight="${targetId}"]`) as HTMLElement | null
      if (!el) return false
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      const r = el.getBoundingClientRect()
      if (cancelled) return true
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      })
      return true
    }

    const onRecalc = () => measure()
    window.addEventListener("scroll", onRecalc, true)
    window.addEventListener("resize", onRecalc)

    const startVisibleTimer = () => {
      hideTimer = setTimeout(() => {
        if (!cancelled) setRect(null)
      }, VISIBLE_MS)
    }

    let observer: MutationObserver | null = null

    if (measure()) {
      startVisibleTimer()
    } else {
      const startedAt = Date.now()
      observer = new MutationObserver(() => {
        if (measure()) {
          observer?.disconnect()
          observer = null
          startVisibleTimer()
        } else if (Date.now() - startedAt > SEARCH_TIMEOUT_MS) {
          observer?.disconnect()
          observer = null
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => {
        observer?.disconnect()
        observer = null
      }, SEARCH_TIMEOUT_MS)
    }

    return () => {
      cancelled = true
      window.removeEventListener("scroll", onRecalc, true)
      window.removeEventListener("resize", onRecalc)
      observer?.disconnect()
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [pathname])

  if (!mounted || !rect) return null

  return createPortal(
    <div
      className="fixed pointer-events-none rounded-xl transition-opacity duration-500"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: 80,
        boxShadow: "0 0 0 3px rgba(217, 119, 6, 0.9), 0 0 24px 6px rgba(217, 119, 6, 0.5)",
        animation: "spotlight-pulse 1.4s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes spotlight-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.9), 0 0 24px 6px rgba(217, 119, 6, 0.5); }
          50% { box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.6), 0 0 12px 3px rgba(217, 119, 6, 0.3); }
        }
      `}</style>
    </div>,
    document.body
  )
}
