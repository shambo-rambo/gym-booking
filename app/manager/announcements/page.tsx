"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, User, Plus, Mail } from "lucide-react"
import { format } from "date-fns"

type Announcement = {
  id: string
  title: string
  message: string
  expiresAt: string | null
  createdAt: string
  creator: {
    name: string
  }
}

export default function ManagerAnnouncementsPage() {
  const { data: session, status } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [sendEmail, setSendEmail] = useState(false)

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  const isManager = (session.user as any)?.role === "MANAGER"

  if (!isManager) {
    redirect("/")
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch("/api/manager/announcements")
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data.announcements)
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClick = () => {
    setTitle("")
    setMessage("")
    setExpiresAt("")
    setSendEmail(false)
    setCreateDialogOpen(true)
  }

  const handleCreateSubmit = async () => {
    if (!title || !message) {
      alert("Please fill in title and message")
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch("/api/manager/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          expiresAt: expiresAt || undefined,
          sendEmail
        })
      })

      if (response.ok) {
        setCreateDialogOpen(false)
        await fetchAnnouncements()
        if (sendEmail) {
          alert("Announcement created! Email notifications will be sent to all verified users.")
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error("Failed to create announcement:", error)
      alert("Failed to create announcement")
    } finally {
      setActionLoading(false)
    }
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
          <p>Loading announcements...</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Announcements</h1>
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No announcements. Click "New Announcement" to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map(announcement => (
              <Card key={announcement.id} className={isExpired(announcement.expiresAt) ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">
                          {announcement.title}
                        </CardTitle>
                        {isExpired(announcement.expiresAt) && (
                          <Badge variant="secondary">Expired</Badge>
                        )}
                        {!isExpired(announcement.expiresAt) && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>

                      <CardDescription>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Posted by {announcement.creator.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(announcement.createdAt), 'MMMM d, yyyy')}
                          </div>
                          {announcement.expiresAt && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Expires: {format(new Date(announcement.expiresAt), 'MMMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700">{announcement.message}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
              <DialogDescription>
                Post an announcement to all building residents
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Gym Maintenance Schedule"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your announcement message here..."
                  className="mt-1 min-h-[120px]"
                />
              </div>

              <div>
                <Label htmlFor="expiresAt">Expires On (optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for permanent announcement
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="sendEmail" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Send email to all verified users
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    This will send an email notification to every verified resident
                  </p>
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? "Creating..." : "Create Announcement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
