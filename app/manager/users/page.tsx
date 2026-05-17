"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Mail, Phone, Home, Search, Pencil } from "lucide-react"

type User = {
  id: string
  name: string
  email: string
  apartmentNumber: number
  phoneNumber: string | null
  role: string
  status: string
  notificationPreference: string
  createdAt: string
}

type UsersData = {
  pending: User[]
  verified: User[]
  deactivated: User[]
}

function matchesSearch(user: User, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    user.name.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    String(user.apartmentNumber).includes(q)
  )
}

export default function ManagerUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UsersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", email: "", apartmentNumber: "", phoneNumber: "" })
  const [editError, setEditError] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") {
      const isManager = (session?.user as any)?.role === "MANAGER"
      if (!isManager) router.replace("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === "authenticated") fetchUsers()
  }, [status])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/manager/users")
      if (response.ok) setUsers(await response.json())
    } catch (error) {
      console.error("Failed to fetch users:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (userId: string) => {
    setActionLoading(userId)
    try {
      const response = await fetch(`/api/manager/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      })
      if (response.ok) {
        await fetchUsers()
      } else {
        alert(`Error: ${(await response.json()).error}`)
      }
    } catch {
      alert("Failed to verify user")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeactivate = async (userId: string, userName: string) => {
    if (!confirm(`Deactivate ${userName}? This will cancel all their bookings.`)) return
    setActionLoading(userId)
    try {
      const response = await fetch(`/api/manager/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DEACTIVATED" }),
      })
      if (response.ok) {
        await fetchUsers()
      } else {
        alert(`Error: ${(await response.json()).error}`)
      }
    } catch {
      alert("Failed to deactivate user")
    } finally {
      setActionLoading(null)
    }
  }

  const startEdit = (user: User) => {
    setEditingId(user.id)
    setEditError("")
    setEditForm({
      name: user.name,
      email: user.email,
      apartmentNumber: String(user.apartmentNumber),
      phoneNumber: user.phoneNumber ?? "",
    })
  }

  const handleSaveEdit = async (userId: string) => {
    setEditError("")
    setActionLoading(userId)
    try {
      const response = await fetch(`/api/manager/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          apartmentNumber: parseInt(editForm.apartmentNumber, 10),
          phoneNumber: editForm.phoneNumber || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setEditError(data.error || "Failed to save")
        return
      }
      setEditingId(null)
      await fetchUsers()
    } catch {
      setEditError("An error occurred")
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = useMemo(() => {
    if (!users) return null
    return {
      pending:     users.pending.filter((u) => matchesSearch(u, search)),
      verified:    users.verified.filter((u) => matchesSearch(u, search)),
      deactivated: users.deactivated.filter((u) => matchesSearch(u, search)),
    }
  }, [users, search])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
          <p className="text-on-surface-variant mt-8">Loading…</p>
        </main>
      </div>
    )
  }

  const renderUserCard = (user: User, showActions = false) => {
    const isEditing = editingId === user.id
    return (
      <Card key={user.id} className="mb-4">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{user.name}</CardTitle>
              <CardDescription className="mt-1 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0" />
                  {user.email}
                </div>
                {user.phoneNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0" />
                    {user.phoneNumber}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Home className="h-4 w-4 shrink-0" />
                  Unit {user.apartmentNumber}
                </div>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <Badge variant={user.role === "MANAGER" ? "default" : "secondary"}>
                {user.role}
              </Badge>
              {!isEditing && (
                <Button size="sm" variant="ghost" onClick={() => startEdit(user)} className="h-8 w-8 p-0">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isEditing && (
          <CardContent className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Unit Number</Label>
                <Input type="number" value={editForm.apartmentNumber} onChange={(e) => setEditForm((f) => ({ ...f, apartmentNumber: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone (optional)</Label>
              <Input type="tel" placeholder="+61..." value={editForm.phoneNumber} onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveEdit(user.id)} disabled={actionLoading === user.id}>
                {actionLoading === user.id ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditError("") }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        )}

        {!isEditing && showActions && (
          <CardContent>
            <div className="flex gap-2">
              {user.status === "PENDING" && (
                <>
                  <Button
                    onClick={() => handleVerify(user.id)}
                    disabled={actionLoading === user.id}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleDeactivate(user.id, user.name)}
                    disabled={actionLoading === user.id}
                    size="sm"
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              {user.status === "VERIFIED" && user.role !== "MANAGER" && (
                <Button
                  onClick={() => handleDeactivate(user.id, user.name)}
                  disabled={actionLoading === user.id}
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Deactivate
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-6">Residents</h1>

        {/* Search — filters all tabs by name, email, or unit number */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({filtered?.pending.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="verified">
              Verified ({filtered?.verified.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="deactivated">
              Deactivated ({filtered?.deactivated.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {filtered?.pending.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  {search ? "No results" : "No pending registrations"}
                </CardContent>
              </Card>
            ) : (
              filtered?.pending.map((user) => renderUserCard(user, true))
            )}
          </TabsContent>

          <TabsContent value="verified" className="mt-6">
            {filtered?.verified.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  {search ? "No results" : "No verified residents"}
                </CardContent>
              </Card>
            ) : (
              filtered?.verified.map((user) => renderUserCard(user, true))
            )}
          </TabsContent>

          <TabsContent value="deactivated" className="mt-6">
            {filtered?.deactivated.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  {search ? "No results" : "No deactivated accounts"}
                </CardContent>
              </Card>
            ) : (
              filtered?.deactivated.map((user) => renderUserCard(user, false))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
