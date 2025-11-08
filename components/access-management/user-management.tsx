"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { getUsers, getRoles, getUserRoles, assignRoleToUser, removeRoleFromUser } from "@/lib/access-management-service"
import type { User, Role } from "@/lib/access-management-service"
import { Search, Shield, Users } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"

export function UserManagement() {
  const { userData } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditRolesDialogOpen, setIsEditRolesDialogOpen] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<Record<string, boolean>>({})

  // Load users and roles
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Get users with the same license key as the current user
        const licenseKey = userData?.license_key
        if (!licenseKey) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Unable to determine your license key. Please try again later.",
          })
          setLoading(false)
          return
        }

        // Get users and roles
        const [fetchedUsers, fetchedRoles] = await Promise.all([getUsers(licenseKey), getRoles()])

        setUsers(fetchedUsers)
        setRoles(fetchedRoles)

        // Get roles for each user
        const userRoles: Record<string, string[]> = {}
        for (const user of fetchedUsers) {
          const roles = await getUserRoles(user.id)
          userRoles[user.id] = roles
        }
        setUserRolesMap(userRoles)
      } catch (error) {
        console.error("Error loading user data:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load users and roles. Please try again.",
        })
      } finally {
        setLoading(false)
      }
    }

    if (userData) {
      loadData()
    }
  }, [userData])

  // Filter users based on search term
  const filteredUsers = users.filter(
    (user) =>
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Group users by department
  const usersByDepartment = useMemo(() => {
    const grouped: Record<string, User[]> = {}

    filteredUsers.forEach((user) => {
      const department = user.department || "No Department"
      if (!grouped[department]) {
        grouped[department] = []
      }
      grouped[department].push(user)
    })

    return grouped
  }, [filteredUsers])

  // Handle editing user roles
  const handleEditRoles = (user: User) => {
    setSelectedUser(user)

    // Initialize selected roles based on user's current roles
    const initialSelectedRoles: Record<string, boolean> = {}
    roles.forEach((role) => {
      initialSelectedRoles[role.id] = userRolesMap[user.id]?.includes(role.id) || false
    })

    setSelectedRoles(initialSelectedRoles)
    setIsEditRolesDialogOpen(true)
  }

  // Save user roles
  const handleSaveRoles = async () => {
    if (!selectedUser) return

    try {
      setLoading(true)

      // Get current user roles
      const currentRoles = userRolesMap[selectedUser.id] || []

      // Determine roles to add and remove
      const rolesToAdd = Object.entries(selectedRoles)
        .filter(([roleId, isSelected]) => isSelected && !currentRoles.includes(roleId))
        .map(([roleId]) => roleId)

      const rolesToRemove = Object.entries(selectedRoles)
        .filter(([roleId, isSelected]) => !isSelected && currentRoles.includes(roleId))
        .map(([roleId]) => roleId)

      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRoleToUser(selectedUser.id, roleId)
      }

      // Remove roles
      for (const roleId of rolesToRemove) {
        await removeRoleFromUser(selectedUser.id, roleId)
      }

      // Update local state
      setUserRolesMap((prev) => ({
        ...prev,
        [selectedUser.id]: Object.entries(selectedRoles)
          .filter(([_, isSelected]) => isSelected)
          .map(([roleId]) => roleId),
      }))

      toast({
        title: "Success",
        description: "User roles updated successfully.",
      })

      setIsEditRolesDialogOpen(false)
    } catch (error) {
      console.error("Error saving user roles:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user roles. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div className="flex justify-center p-8">
          <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2">Loading users...</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.keys(usersByDepartment).length === 0 ? (
            <div className="col-span-full text-center py-6">
              No users found
            </div>
          ) : (
            Object.entries(usersByDepartment).map(([department, departmentUsers]) => (
              <Card key={department} className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {department}
                    <Badge variant="secondary" className="ml-auto">
                      {departmentUsers.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {departmentUsers.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{user.displayName || "No name"}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleEditRoles(user)}>
                          Edit Roles
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {userRolesMap[user.id]?.length > 0 ? (
                          userRolesMap[user.id].map((roleId) => {
                            const role = roles.find((r) => r.id === roleId)
                            return role ? (
                              <Badge key={roleId} variant="outline" className="flex items-center gap-1 text-xs">
                                <Shield className="h-3 w-3" />
                                {role.name}
                              </Badge>
                            ) : null
                          })
                        ) : (
                          <span className="text-muted-foreground text-sm">No roles assigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Edit User Roles Dialog */}
      <Dialog open={isEditRolesDialogOpen} onOpenChange={setIsEditRolesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <span>
                  Manage roles for <strong>{selectedUser.displayName || selectedUser.email}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoles[role.id] || false}
                    onCheckedChange={(checked) => {
                      setSelectedRoles((prev) => ({
                        ...prev,
                        [role.id]: checked === true,
                      }))
                    }}
                  />
                  <Label htmlFor={`role-${role.id}`} className="flex-1">
                    <div>{role.name}</div>
                    <div className="text-sm text-muted-foreground">{role.description}</div>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsEditRolesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
