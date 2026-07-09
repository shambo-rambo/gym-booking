"use client"

import { useAppMode } from "@/lib/use-app-mode"
import { cn } from "@/lib/utils"
import { Shield, Home } from "lucide-react"

// Persistent, colour-coded, single-tap mode switch for managers. Lives inside
// the fixed header (not a separate full-width bar) so switching modes never
// shifts every page's content padding.
export default function ModeBanner() {
  const [mode, setMode] = useAppMode()
  const isAdmin = mode === "ADMIN"

  return (
    <button
      onClick={() => setMode(isAdmin ? "RESIDENT" : "ADMIN")}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors active:scale-95",
        isAdmin ? "bg-amber-500 text-amber-950" : "bg-secondary text-on-secondary"
      )}
      style={{ minHeight: "44px", minWidth: "44px" }}
    >
      {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
      {isAdmin ? "Admin" : "Resident"}
    </button>
  )
}
