"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { CalendarDays, BookOpen, Clock, User, Shield, LogOut, Home, BookText, Settings, Bell, Users, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAppMode } from "@/lib/use-app-mode"
import ModeBanner from "@/components/ModeBanner"

const PAGE_TITLES: Record<string, string> = {
  "/":                       "Notices",
  "/book":                   "Reserve Your Space",
  "/my-bookings":            "My Bookings",
  "/queue":                  "My Bookings",
  "/settings":               "Profile",
  "/manager":                "Dashboard",
  "/manager/users":          "Residents",
  "/manager/bookings":       "All Bookings",
  "/manager/blocked-slots":  "Blocked Slots",
  "/manager/messages":       "Messages",
  "/manager/qr-code":        "Registration QR Code",
}

export default function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [showSignOut, setShowSignOut] = useState(false)
  const [mode] = useAppMode()

  if (status === "loading") return null

  const isManager = (session?.user as any)?.role === "MANAGER"
  const isAdminView = isManager && mode === "ADMIN"
  const pageTitle = PAGE_TITLES[pathname] ?? "The Watertower"

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  const residentNavItems = [
    { href: "/",            label: "Home",        icon: Bell },
    { href: "/book",        label: "Book",        icon: CalendarDays },
    { href: "/my-bookings", label: "My Bookings", icon: Clock },
    { href: "/settings",    label: "Profile",     icon: User },
  ]

  const adminNavItems = [
    { href: "/manager",           label: "Home",      icon: Home },
    { href: "/manager/users",     label: "Residents", icon: Users },
    { href: "/manager/messages",  label: "Messages",  icon: MessageSquare },
    { href: "/settings",          label: "Profile",   icon: User },
  ]

  const navItems = isAdminView ? adminNavItems : residentNavItems

  if (!session) {
    return (
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-outline-variant/30 px-6 flex items-center justify-between shadow-bottom"
        style={{ height: "64px" }}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary">
            The Watertower
          </p>
          <h1 className="text-base font-bold tracking-tight text-primary leading-tight">
            Amenity Booking
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors">
            Sign In
          </Link>
          <Link href="/register"
            className="text-sm font-bold bg-primary text-on-primary px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            Register
          </Link>
        </div>
      </header>
    )
  }

  return (
    <>
      {/* Glass Top Bar */}
      <header
        className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-outline-variant/20 px-5 sm:px-6 flex items-center justify-between shadow-bottom"
        style={{ height: "64px" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary leading-none mb-0.5">
            The Watertower
          </p>
          <h1 className="text-base font-bold tracking-tight text-primary leading-tight">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isManager && <ModeBanner />}
          <div className="relative">
          <button
            onClick={() => setShowSignOut((v) => !v)}
            className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors active:scale-95"
          >
            {initials}
          </button>

          {showSignOut && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSignOut(false)} />
              <div className="absolute right-0 top-11 z-50 bg-white rounded-xl shadow-card-lg border border-outline-variant/30 overflow-hidden min-w-[160px]">
                <div className="px-4 py-3 border-b border-outline-variant/20">
                  <p className="text-xs font-bold text-primary truncate">{session.user?.name}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{session.user?.email}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setShowSignOut(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <Link
                  href="/rules"
                  onClick={() => setShowSignOut(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  <BookText className="w-4 h-4" />
                  Booking Rules
                </Link>
                <button
                  onClick={() => { setShowSignOut(false); signOut() }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-destructive hover:bg-surface-container-low transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </header>

      {/* Glass Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 bg-white/85 backdrop-blur-xl border-t border-outline-variant/20 shadow-top"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-around items-center px-2 py-2 max-w-lg mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-xl transition-all active:scale-90",
                  isActive
                    ? "text-secondary"
                    : "text-outline hover:text-on-surface-variant"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-all",
                    isActive ? "stroke-[2.5px]" : "stroke-[1.5px]"
                  )}
                />
                <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
