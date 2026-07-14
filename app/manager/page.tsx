"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import LoadingSpinner from "@/components/LoadingSpinner"
import { MessageSquare, Users, CalendarDays, Ban, ShieldAlert } from "lucide-react"

const CARDS = [
  {
    href: "/manager/messages",
    title: "Send a message",
    description: "Notify residents by app, email, or text",
    icon: MessageSquare,
  },
  {
    href: "/manager/users",
    title: "Residents",
    description: "Verify accounts, edit details, import residents",
    icon: Users,
  },
  {
    href: "/manager/bookings",
    title: "Manage bookings",
    description: "View or cancel any resident's booking",
    icon: CalendarDays,
  },
  {
    href: "/manager/blocked-slots",
    title: "Block a facility",
    description: "Close a slot for maintenance or cleaning",
    icon: Ban,
  },
  {
    href: "/manager/amenity-audit",
    title: "Amenity audit",
    description: "Un-booked access and no-show exceptions",
    icon: ShieldAlert,
  },
]

export default function ManagerPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <LoadingSpinner />
  }

  if (!session) {
    redirect("/login")
  }

  const isManager = (session.user as any)?.role === "MANAGER"

  if (!isManager) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-2xl font-bold text-primary mt-6 mb-6">Dashboard</h1>

        <div data-highlight="manager-dashboard-cards" className="flex flex-col gap-4">
          {CARDS.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer active:scale-[0.98]" style={{ minHeight: "60px" }}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
