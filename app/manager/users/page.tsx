"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, XCircle, Mail, Phone, Home, Search, Pencil, QrCode, UserPlus, RotateCcw } from "lucide-react"
import { getFloorFromApartmentNumber, VALID_UNITS } from "@/lib/apartments"

type User = {
  id: string
  name: string
  email: string
  apartmentNumber: number
  phoneNumber: string | null
  role: string
  status: string
  notificationPreference: string
  residencyType: string | null
  createdAt: string
}

type Fob = { id: string; apartmentNumber: number; fobNumber: string }

const RESIDENCY_LABELS: Record<string, string> = {
  TENANT: "Resident",
  OWNER_OCCUPIER: "Owner-occupier",
  NON_RESIDENT_OWNER: "Non-resident owner",
}

function parseImportCsv(text: string): { name: string; email: string; apartmentNumber: number; mobile?: string; residencyType: string; fobNumber?: string }[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  // Skip a header row if present
  const dataLines = /email/i.test(lines[0]) ? lines.slice(1) : lines
  return dataLines.map((line) => {
    const [name, email, apartmentNumber, mobile, residencyType, fobNumber] = line.split(",").map((c) => c.trim())
    return {
      name,
      email,
      apartmentNumber: parseInt(apartmentNumber, 10),
      mobile: mobile || undefined,
      residencyType: (residencyType || "").toUpperCase(),
      fobNumber: fobNumber || undefined,
    }
  })
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
  const [editForm, setEditForm] = useState({ name: "", email: "", apartmentNumber: "", phoneNumber: "", residencyType: "", notificationPreference: "EMAIL_ONLY", newPassword: "" })
  const [editError, setEditError] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")
  const [singleForm, setSingleForm] = useState({ name: "", email: "", apartmentNumber: "", phoneNumber: "", residencyType: "", fobNumber: "" })

  // Fobs belong to the apartment being edited, not the specific resident — fetched
  // fresh whenever the edit card opens, managed via their own immediate API calls.
  const [editFobs, setEditFobs] = useState<Fob[]>([])
  const [editFobsLoading, setEditFobsLoading] = useState(false)
  const [newFobNumber, setNewFobNumber] = useState("")
  const [fobError, setFobError] = useState("")
  const [fobActionLoading, setFobActionLoading] = useState(false)

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
      residencyType: user.residencyType ?? "",
      notificationPreference: user.notificationPreference ?? "EMAIL_ONLY",
      newPassword: "",
    })
    fetchFobsForApartment(user.apartmentNumber)
  }

  const fetchFobsForApartment = async (apartmentNumber: number) => {
    setEditFobsLoading(true)
    setFobError("")
    setNewFobNumber("")
    try {
      const res = await fetch(`/api/manager/fobs?apartmentNumber=${apartmentNumber}`)
      if (res.ok) setEditFobs((await res.json()).fobs)
    } catch {
      console.error("Failed to fetch fobs")
    } finally {
      setEditFobsLoading(false)
    }
  }

  const handleAddFob = async (apartmentNumber: number) => {
    setFobError("")
    if (!/^\d{3}$/.test(newFobNumber)) {
      setFobError("Enter the last 3 digits of the fob number")
      return
    }
    setFobActionLoading(true)
    try {
      const res = await fetch("/api/manager/fobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apartmentNumber, fobNumber: newFobNumber }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFobError(data.error || "Failed to add fob")
        return
      }
      setNewFobNumber("")
      await fetchFobsForApartment(apartmentNumber)
    } catch {
      setFobError("Failed to add fob")
    } finally {
      setFobActionLoading(false)
    }
  }

  const handleRemoveFob = async (fobId: string, apartmentNumber: number) => {
    setFobActionLoading(true)
    try {
      await fetch(`/api/manager/fobs/${fobId}`, { method: "DELETE" })
      await fetchFobsForApartment(apartmentNumber)
    } catch {
      setFobError("Failed to remove fob")
    } finally {
      setFobActionLoading(false)
    }
  }

  const handleSaveEdit = async (userId: string) => {
    setEditError("")
    if (editForm.newPassword && editForm.newPassword.length < 8) {
      setEditError("New password must be at least 8 characters")
      return
    }
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
          residencyType: editForm.residencyType || null,
          notificationPreference: editForm.notificationPreference,
          newPassword: editForm.newPassword || undefined,
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

  const submitImportRows = async (rows: ReturnType<typeof parseImportCsv>) => {
    const response = await fetch("/api/manager/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    })
    const data = await response.json()
    if (!response.ok) {
      const detail = Array.isArray(data.details)
        ? data.details.map((d: any) => (d.row ? `Row ${d.row}: ${d.message}` : d)).join("; ")
        : ""
      setImportError(`${data.error}${detail ? " — " + detail : ""}`)
      return false
    }
    setImportSuccess(`Added ${data.created.length} resident(s). They can log in now with the temporary password "watertower" and will be asked to set their own on first login.`)
    await fetchUsers()
    return true
  }

  const handleAddSingle = async () => {
    setImportError("")
    setImportSuccess("")
    if (!singleForm.name.trim() || !singleForm.email.trim() || !singleForm.apartmentNumber || !singleForm.residencyType) {
      setImportError("Name, email, unit, and residency type are required.")
      return
    }
    setImporting(true)
    try {
      const ok = await submitImportRows([
        {
          name: singleForm.name.trim(),
          email: singleForm.email.trim(),
          apartmentNumber: parseInt(singleForm.apartmentNumber, 10),
          mobile: singleForm.phoneNumber || undefined,
          residencyType: singleForm.residencyType,
          fobNumber: singleForm.fobNumber || undefined,
        },
      ])
      if (ok) setSingleForm({ name: "", email: "", apartmentNumber: "", phoneNumber: "", residencyType: "", fobNumber: "" })
    } catch {
      setImportError("Could not add that resident.")
    } finally {
      setImporting(false)
    }
  }

  const handleImport = async () => {
    setImportError("")
    setImportSuccess("")
    setImporting(true)
    try {
      const rows = parseImportCsv(importText)
      if (rows.length === 0) {
        setImportError("Paste at least one row.")
        return
      }
      const ok = await submitImportRows(rows)
      if (ok) setImportText("")
    } catch {
      setImportError("Could not parse or import that data.")
    } finally {
      setImporting(false)
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
                  Unit {user.apartmentNumber} · {getFloorFromApartmentNumber(user.apartmentNumber).label}
                </div>
              </CardDescription>
              {user.residencyType && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {RESIDENCY_LABELS[user.residencyType] ?? user.residencyType}
                </Badge>
              )}
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
              <Label>New password (optional)</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep current password"
                value={editForm.newPassword}
                onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Resident will be asked to set their own password on next login.</p>
            </div>
            <div className="space-y-1">
              <Label>Phone (optional)</Label>
              <Input type="tel" placeholder="+61..." value={editForm.phoneNumber} onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notification method</Label>
              <Select value={editForm.notificationPreference} onValueChange={(v) => setEditForm((f) => ({ ...f, notificationPreference: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL_ONLY">Email only</SelectItem>
                  <SelectItem value="SMS_ONLY">SMS only</SelectItem>
                  <SelectItem value="BOTH">Email and SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Residency type</Label>
              <Select value={editForm.residencyType} onValueChange={(v) => setEditForm((f) => ({ ...f, residencyType: v }))}>
                <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT">Resident</SelectItem>
                  <SelectItem value="OWNER_OCCUPIER">Owner-occupier</SelectItem>
                  <SelectItem value="NON_RESIDENT_OWNER">Non-resident owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Apartment {user.apartmentNumber}'s fobs</Label>
              <p className="text-xs text-gray-500 mb-1">Fobs belong to the apartment, not this resident — every unit needs at least one on file.</p>
              {editFobsLoading ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-2">
                  {editFobs.length === 0 && <p className="text-xs text-amber-600">No fobs on file for this apartment yet.</p>}
                  {editFobs.map((fob) => (
                    <Badge key={fob.id} variant="secondary" className="gap-1.5 pr-1">
                      {fob.fobNumber}
                      <button
                        type="button"
                        onClick={() => handleRemoveFob(fob.id, user.apartmentNumber)}
                        disabled={fobActionLoading}
                        className="ml-1 text-gray-500 hover:text-red-600"
                        aria-label={`Remove fob ${fob.fobNumber}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Last 3 digits"
                  maxLength={3}
                  value={newFobNumber}
                  onChange={(e) => setNewFobNumber(e.target.value.replace(/\D/g, ""))}
                  className="max-w-[140px]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={fobActionLoading}
                  onClick={() => handleAddFob(user.apartmentNumber)}
                >
                  Add Fob
                </Button>
              </div>
              {fobError && <p className="text-xs text-red-600 mt-1">{fobError}</p>}
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
              {user.status === "DEACTIVATED" && (
                <Button
                  onClick={() => handleVerify(user.id)}
                  disabled={actionLoading === user.id}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reactivate
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
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <h1 className="text-3xl font-bold">Residents</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
            <Link href="/manager/qr-code">
              <Button variant="outline" size="sm" className="gap-2">
                <QrCode className="h-4 w-4" />
                Registration QR
              </Button>
            </Link>
          </div>
        </div>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add residents</DialogTitle>
            </DialogHeader>

            <Tabs
              defaultValue="single"
              className="w-full"
              onValueChange={() => { setImportError(""); setImportSuccess("") }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Add User</TabsTrigger>
                <TabsTrigger value="csv">Paste CSV</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={singleForm.name} onChange={(e) => setSingleForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit Number</Label>
                    <Input type="number" value={singleForm.apartmentNumber} onChange={(e) => setSingleForm((f) => ({ ...f, apartmentNumber: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={singleForm.email} onChange={(e) => setSingleForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Phone (optional)</Label>
                  <Input type="tel" placeholder="+61..." value={singleForm.phoneNumber} onChange={(e) => setSingleForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Residency type</Label>
                    <Select value={singleForm.residencyType} onValueChange={(v) => setSingleForm((f) => ({ ...f, residencyType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TENANT">Resident</SelectItem>
                        <SelectItem value="OWNER_OCCUPIER">Owner-occupier</SelectItem>
                        <SelectItem value="NON_RESIDENT_OWNER">Non-resident owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Fob — last 3 digits (optional here, add later if unset)</Label>
                    <Input
                      maxLength={3}
                      placeholder="e.g. 292"
                      value={singleForm.fobNumber}
                      onChange={(e) => setSingleForm((f) => ({ ...f, fobNumber: e.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                </div>
                {importError && <p className="text-sm text-red-600">{importError}</p>}
                {importSuccess && <p className="text-sm text-green-600">{importSuccess}</p>}
                <Button onClick={handleAddSingle} disabled={importing} className="w-full">
                  {importing ? "Adding…" : "Add User"}
                </Button>
              </TabsContent>

              <TabsContent value="csv" className="mt-4 space-y-3">
                <p className="text-sm text-on-surface-variant">
                  Paste one resident per line: <code className="text-xs">name, email, unit, mobile, residencyType, fobNumber</code>
                  <br />
                  residencyType is one of TENANT, OWNER_OCCUPIER, NON_RESIDENT_OWNER. Mobile is optional. Fob number is the last 3 digits, optional here (add it to the unit's fob list later if unset).
                </p>
                <textarea
                  className="w-full h-40 border rounded-md p-2 text-sm font-mono"
                  placeholder={"Jane Smith, jane@example.com, 304, +61400000000, OWNER_OCCUPIER,\nJohn Doe, john@example.com, 105, , TENANT,"}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {importError && <p className="text-sm text-red-600">{importError}</p>}
                {importSuccess && <p className="text-sm text-green-600">{importSuccess}</p>}
                <Button onClick={handleImport} disabled={importing || !importText.trim()} className="w-full">
                  {importing ? "Importing…" : "Import residents"}
                </Button>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setImportOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

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

        <Tabs defaultValue="verified" className="w-full">
          <TabsList data-highlight="residents-tabs" className="grid w-full grid-cols-3">
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
              filtered?.deactivated.map((user) => renderUserCard(user, true))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
