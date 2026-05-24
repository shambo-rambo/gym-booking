"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Navbar from "@/components/Navbar"
import { BookingRules } from "@/components/BookingRules"

export default function RulesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="pt-20 pb-28 px-4 sm:px-6 max-w-2xl mx-auto">
        <div className="mt-6 mb-8">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-1.5 block">
            Reference
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
            Booking Rules
          </h2>
        </div>
        <BookingRules />
      </main>
    </div>
  )
}
