"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { MoreHorizontal, User, Shield, LogOut } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ActiveUser {
  id: string
  uid: string
  email: string
  displayName: string
  firstName?: string
  lastName?: string
  department?: string
  roles: string[]
  lastActivity: string
  photoURL?: string
  phoneNumber?: string
  status?: 'online' | 'idle' | 'offline'
}

interface ActiveUsersTableProps {
  companyId: string
}

export function ActiveUsersGrid({ companyId }: ActiveUsersTableProps) {
  const { userData } = useAuth()
  const { toast } = useToast()

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ActiveUser | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isForceLogoutLoading, setIsForceLogoutLoading] = useState(false)

  // Fetch active users with real-time updates
  useEffect(() => {
    if (!companyId || !userData?.uid) return

    setLoading(true)
    setError(null)

    const fetchActiveUsers = async () => {
      try {
        const response = await fetch(
          `/api/admin/active-users?companyId=${companyId}&userId=${userData.uid}`
        )

        if (!response.ok) {
          throw new Error("Failed to fetch active users")
        }

        const data = await response.json()
        setActiveUsers(data.activeUsers || [])
      } catch (err) {
        console.error("Error fetching active users:", err)
        setError("Failed to load active users")
      } finally {
        setLoading(false)
      }
    }

    fetchActiveUsers()

    // Set up polling for real-time updates (fallback for environments without WebSocket)
    const interval = setInterval(fetchActiveUsers, 60000) // Poll every 60 seconds

    return () => clearInterval(interval)
  }, [companyId, userData?.uid])

  // Calculate user status based on last activity
  const getUserStatus = useCallback((lastActivity: string): 'online' | 'idle' | 'offline' => {
    const lastActivityDate = new Date(lastActivity)
    const now = new Date()
    const diffMinutes = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60)

    if (diffMinutes < 5) return 'online'
    if (diffMinutes < 30) return 'idle'
    return 'offline'
  }, [])

  // Enhanced users with status
  const usersWithStatus = useMemo(() => {
    return activeUsers.map(user => ({
      ...user,
      status: getUserStatus(user.lastActivity)
    }))
  }, [activeUsers, getUserStatus])

  // Use all users (no filtering since search was removed)
  const filteredUsers = usersWithStatus

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = filteredUsers.length
    const online = filteredUsers.filter(user => user.status === 'online').length
    return { total, online }
  }, [filteredUsers])

  // Handle viewing user details
  const handleViewDetails = useCallback((user: ActiveUser) => {
    setSelectedUser(user)
    setIsDetailsModalOpen(true)
  }, [])

  // Handle force logout
  const handleForceLogout = useCallback(async (user: ActiveUser) => {
    if (!userData?.uid) return

    setIsForceLogoutLoading(true)
    try {
      const response = await fetch(
        `/api/admin/force-logout?companyId=${companyId}&userId=${userData.uid}&targetUserId=${user.uid}`,
        { method: "POST" }
      )

      if (!response.ok) {
        throw new Error("Failed to force logout")
      }

      toast({
        title: "Success",
        description: `${user.displayName} has been logged out`,
      })

      // Remove user from active users list
      setActiveUsers(prev => prev.filter(u => u.uid !== user.uid))
    } catch (err) {
      console.error("Error forcing logout:", err)
      toast({
        title: "Error",
        description: "Failed to force logout user",
        variant: "destructive",
      })
    } finally {
      setIsForceLogoutLoading(false)
    }
  }, [companyId, userData?.uid, toast])

  // Calculate online percentage
  const onlinePercentage = summaryStats.total > 0 ? Math.round((summaryStats.online / summaryStats.total) * 100) : 0

  // User List Item Component
  const UserListItem = ({ user }: { user: ActiveUser }) => {
    const statusColor = {
      online: 'bg-[#18da69]',
      idle: 'bg-yellow-500',
      offline: 'bg-[#c4c4c4]'
    }[user.status || 'offline']

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-sm font-medium uppercase">
              {user.department || 'NO DEPT'}
            </span>
            <span className="text-sm">{user.displayName}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleViewDetails(user)}>
            <User className="w-4 h-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleForceLogout(user)}
            disabled={isForceLogoutLoading}
            className="text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Force Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Empty state component
  const emptyState = (
    <div className="text-center py-8">
      <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">No Active Users</h3>
      <p className="text-muted-foreground">
        There are currently no users active in the system.
      </p>
    </div>
  )

  return (
    <>
      {error ? (
        <div className="text-center py-8">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      ) : (
        <div className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
          <div className="flex justify-between items-center">
            {/* Users List - Left Side */}
            <div className="flex-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Users</h3>
                  <p className="text-muted-foreground">
                    There are currently no users active in the system.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {filteredUsers.slice(0, 5).map(user => (
                    <UserListItem key={user.uid} user={user} />
                  ))}
                  {filteredUsers.length > 5 && (
                    <div className="text-center text-[#a1a1a1]">...</div>
                  )}
                </div>
              )}
            </div>

            {/* Circular Progress - Right Side */}
            <div className="flex-1 flex justify-center">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="relative w-20 h-20">
                    <svg
                      className="w-20 h-20 transform -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e0e0e0"
                        strokeWidth="2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#18da69"
                        strokeWidth="2"
                        strokeDasharray={`${onlinePercentage}, 100`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">{onlinePercentage}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#18da69]"></div>
                    <span>Online</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#c4c4c4]"></div>
                    <span>Offline</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed information about {selectedUser?.displayName}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-medium">{selectedUser.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="font-medium">Department</label>
                  <p className="text-muted-foreground">
                    {selectedUser.department || "Not assigned"}
                  </p>
                </div>
                <div>
                  <label className="font-medium">Phone</label>
                  <p className="text-muted-foreground">
                    {selectedUser.phoneNumber || "Not provided"}
                  </p>
                </div>
              </div>

              <div>
                <label className="font-medium">Roles</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedUser.roles?.length > 0 ? (
                    selectedUser.roles.map(role => (
                      <Badge key={role} variant="secondary">
                        <Shield className="w-3 h-3 mr-1" />
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No roles assigned</span>
                  )}
                </div>
              </div>

              <div>
                <label className="font-medium">Last Activity</label>
                <p className="text-muted-foreground">
                  {new Date(selectedUser.lastActivity).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUser) {
                  handleForceLogout(selectedUser)
                  setIsDetailsModalOpen(false)
                }
              }}
              disabled={isForceLogoutLoading}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Force Logout
            </Button>
            <Button onClick={() => setIsDetailsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}