"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "./ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"

export default function Navbar() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return null
  }

  if (!session) {
    return (
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold">
              Gym & Sauna Booking
            </Link>
            <div className="space-x-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Register</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  const isManager = (session.user as any)?.role === "MANAGER"

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile Layout */}
        <div className="md:hidden flex items-center justify-between h-16">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle className="text-left">{session.user?.name}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-4 mt-8">
                <Link href="/" className="text-lg p-3 rounded-lg hover:bg-accent transition-colors">
                  Calendar
                </Link>
                <Link href="/my-bookings" className="text-lg p-3 rounded-lg hover:bg-accent transition-colors">
                  My Bookings
                </Link>
                <Link href="/queue" className="text-lg p-3 rounded-lg hover:bg-accent transition-colors">
                  Queue
                </Link>
                {isManager && (
                  <Link href="/manager" className="text-lg p-3 rounded-lg hover:bg-accent transition-colors">
                    Manager
                  </Link>
                )}
                <Link href="/settings" className="text-lg p-3 rounded-lg hover:bg-accent transition-colors">
                  Settings
                </Link>
                <Button variant="outline" onClick={() => signOut()} className="mt-4 justify-start">
                  Sign Out
                </Button>
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" className="text-lg font-bold">
            Gym Booking
          </Link>

          <div className="w-11" /> {/* Spacer for balance */}
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex justify-between h-16 items-center">
          <Link href="/" className="text-xl font-bold">
            Gym & Sauna Booking
          </Link>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {session.user?.name}
            </span>
            <Link href="/">
              <Button variant="ghost">Calendar</Button>
            </Link>
            <Link href="/my-bookings">
              <Button variant="ghost">My Bookings</Button>
            </Link>
            <Link href="/queue">
              <Button variant="ghost">Queue</Button>
            </Link>
            {isManager && (
              <Link href="/manager">
                <Button variant="ghost">Manager</Button>
              </Link>
            )}
            <Link href="/settings">
              <Button variant="ghost">Settings</Button>
            </Link>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
