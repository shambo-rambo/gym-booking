"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, XCircle, Mail, Phone, Home } from "lucide-react"

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

export default function ManagerUsersPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<UsersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/manager/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
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
        body: JSON.stringify({ status: "VERIFIED" })
      })

      if (response.ok) {
        await fetchUsers()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error("Failed to verify user:", error)
      alert("Failed to verify user")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeactivate = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}? This will cancel all their bookings.`)) {
      return
    }

    setActionLoading(userId)
    try {
      const response = await fetch(`/api/manager/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DEACTIVATED" })
      })

      if (response.ok) {
        await fetchUsers()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error("Failed to deactivate user:", error)
      alert("Failed to deactivate user")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
          <p>Loading users...</p>
        </main>
      </div>
    )
  }

  const renderUserCard = (user: User, showActions: boolean = false) => (
    <Card key={user.id} className="mb-4">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{user.name}</CardTitle>
            <CardDescription className="mt-1">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>
              {user.phoneNumber && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Phone className="h-4 w-4" />
                  {user.phoneNumber}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm mt-1">
                <Home className="h-4 w-4" />
                Apartment {user.apartmentNumber}
              </div>
            </CardDescription>
          </div>
          <Badge variant={user.role === "MANAGER" ? "default" : "secondary"}>
            {user.role}
          </Badge>
        </div>
      </CardHeader>
      {showActions && (
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
                  Verify
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

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28">
        <h1 className="text-3xl font-bold mb-6">User Management</h1>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({users?.pending.length || 0})
            </TabsTrigger>
            <TabsTrigger value="verified">
              Verified ({users?.verified.length || 0})
            </TabsTrigger>
            <TabsTrigger value="deactivated">
              Deactivated ({users?.deactivated.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {users?.pending.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No pending users
                </CardContent>
              </Card>
            ) : (
              <div>
                {users?.pending.map(user => renderUserCard(user, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="verified" className="mt-6">
            {users?.verified.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No verified users
                </CardContent>
              </Card>
            ) : (
              <div>
                {users?.verified.map(user => renderUserCard(user, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deactivated" className="mt-6">
            {users?.deactivated.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No deactivated users
                </CardContent>
              </Card>
            ) : (
              <div>
                {users?.deactivated.map(user => renderUserCard(user, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
