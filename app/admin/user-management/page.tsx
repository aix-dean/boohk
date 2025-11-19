"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { UserPlus, Settings, Mail, Shield, Users, Search } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { CompanyRegistrationDialog } from "@/components/company-registration-dialog"
import { AddUserDialog } from "@/components/add-user-dialog"
import { UserAddedSuccessDialog } from "@/components/user-added-success-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import {
  getAllRoles,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
  type RoleType,
  type HardcodedRole,
} from "@/lib/hardcoded-access-service"

interface User {
  id: string
  email: string
  displayName: string
  role: string
  status: string
  lastLogin: Date | null
  created: Date
  department?: string
}

export default function UserManagementPage() {
  const { userData, refreshUserData } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles] = useState<HardcodedRole[]>(getAllRoles())
  const [loading, setLoading] = useState(true)
  const [isCompanyRegistrationDialogOpen, setIsCompanyRegistrationDialogOpen] = useState(false)
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditRolesDialogOpen, setIsEditRolesDialogOpen] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<Record<RoleType, boolean>>({
    admin: false,
    sales: false,
    logistics: false,
    cms: false,
    it: false,
    business: false,
    treasury: false,
    accounting: false,
    finance: false,
  })
  const [roleDialogLoading, setRoleDialogLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [usersByDepartment, setUsersByDepartment] = useState<Record<string, User[]>>({})
  const [isUserAddedSuccessDialogOpen, setIsUserAddedSuccessDialogOpen] = useState(false)
  const [addedUserData, setAddedUserData] = useState<{ email: string; name: string; role: string } | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()

  // Debounce search term
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300) // 300ms delay

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  useEffect(() => {
    if (!userData?.company_id) {
      setLoading(false)
      return
    }

    const q = query(collection(db, "boohk_users"), where("company_id", "==", userData.company_id))

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const usersData = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          email: data.email || "",
          displayName:
            data.first_name && data.last_name
              ? `${data.first_name} ${data.last_name}`
              : data.display_name || data.displayName || "Unknown User",
          role: String(data.role || "user"),
          status: data.active === false ? "inactive" : "active",
          lastLogin: data.lastLogin?.toDate() || null,
          created: data.created?.toDate() || new Date(),
          department: data.department || undefined,
        }
      })
      setUsers(usersData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userData?.company_id])

  // Filter users based on debounced search term
  const filteredUsers = users.filter(
    (user) =>
      user.displayName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
  )

  // Role to department mapping
  const roleToDepartment: Record<string, string> = {
    admin: "Administrator",
    sales: "Sales Team",
    logistics: "Logistics Team",
    cms: "Content Management",
    it: "IT Team",
    business: "Business Development",
    treasury: "Treasury",
    accounting: "Accounting",
    finance: "Finance",
  }

  // Department color mapping for divider lines
  const departmentColors: Record<string, string> = {
    "Administrator": "bg-violet-500",
    "Sales Team": "bg-red-500",
    "Logistics Team": "bg-blue-500",
    "Content Management": "bg-yellow-500",
    "IT Team": "bg-teal-500",
    "Business Development": "bg-purple-500",
    "Treasury": "bg-green-500",
    "Accounting": "bg-blue-600",
    "Finance": "bg-emerald-500",
  }

  // Group users by department (simple implementation)
  const groupUsersByRoles = async (usersToGroup: User[]) => {
    if (usersToGroup.length === 0) {
      setUsersByDepartment({})
      return
    }

    const grouped: Record<string, User[]> = {}

    // Initialize departments
    Object.values(roleToDepartment).forEach((department) => {
      grouped[department] = []
    })

    // Group users by their roles
    for (const user of usersToGroup) {
      try {
        const userRoles = await getUserRoles(user.id)
        userRoles.forEach((roleId) => {
          const departmentName = roleToDepartment[roleId]
          if (departmentName && !grouped[departmentName].find((u) => u.id === user.id)) {
            grouped[departmentName].push(user)
          }
        })
      } catch (error) {
        console.error(`Error getting roles for user ${user.id}:`, error)
      }
    }

    setUsersByDepartment(grouped)
  }

  // Group users by roles when filtered users change
  useEffect(() => {
    if (filteredUsers.length > 0) {
      groupUsersByRoles(filteredUsers)
    } else {
      setUsersByDepartment({})
    }
  }, [filteredUsers])

  const handleActionWithCompanyCheck = (actionCallback: () => void) => {
    if (!userData?.company_id) {
      setIsCompanyRegistrationDialogOpen(true)
    } else {
      actionCallback()
    }
  }

  const getStatusBadge = (status: string) => {
    const statusStr = String(status || "unknown")

    switch (statusStr) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case "inactive":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Inactive</Badge>
      default:
        return <Badge variant="secondary">{statusStr}</Badge>
    }
  }

  const getRoleBadge = (roleId: RoleType) => {
    const role = roles.find((r) => r.id === roleId)
    if (!role) return null

    const colorClasses = {
      admin: "bg-purple-100 text-purple-800 hover:bg-purple-100",
      sales: "bg-green-100 text-green-800 hover:bg-green-100",
      logistics: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      cms: "bg-orange-100 text-orange-800 hover:bg-orange-100",
      it: "bg-teal-100 text-teal-800 hover:bg-teal-100",
      business: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
      treasury: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
      accounting: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
      finance: "bg-lime-100 text-lime-800 hover:bg-lime-100",
    }

    return <Badge className={colorClasses[roleId]}>{role.name}</Badge>
  }

  const handleEditRoles = async (user: User) => {
    handleActionWithCompanyCheck(async () => {
      setSelectedUser(user)
      setRoleDialogLoading(true)

      try {
        // Get user's current roles
        const userRoles = await getUserRoles(user.id)

        // Initialize selected roles based on user's current roles
        const initialSelectedRoles: Record<RoleType, boolean> = {
          admin: userRoles.includes("admin"),
          sales: userRoles.includes("sales"),
          logistics: userRoles.includes("logistics"),
          cms: userRoles.includes("cms"),
          it: userRoles.includes("it"),
          business: userRoles.includes("business"),
          treasury: userRoles.includes("treasury"),
          accounting: userRoles.includes("accounting"),
          finance: userRoles.includes("finance"),
        }

        setSelectedRoles(initialSelectedRoles)
        setIsEditRolesDialogOpen(true)
      } catch (error) {
        console.error("Error loading user roles:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load user roles. Please try again.",
        })
      } finally {
        setRoleDialogLoading(false)
      }
    })
  }

  const handleSaveRoles = async () => {
    if (!selectedUser) return

    setRoleDialogLoading(true)

    try {
      // Get current user roles
      const currentRoles = await getUserRoles(selectedUser.id)

      // Determine roles to add and remove
      const rolesToAdd = (Object.entries(selectedRoles) as [RoleType, boolean][])
        .filter(([roleId, isSelected]) => isSelected && !currentRoles.includes(roleId))
        .map(([roleId]) => roleId)

      const rolesToRemove = (Object.entries(selectedRoles) as [RoleType, boolean][])
        .filter(([roleId, isSelected]) => !isSelected && currentRoles.includes(roleId))
        .map(([roleId]) => roleId)

      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRoleToUser(selectedUser.id, roleId, userData?.uid)
      }

      // Remove roles
      for (const roleId of rolesToRemove) {
        await removeRoleFromUser(selectedUser.id, roleId)
      }

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
      setRoleDialogLoading(false)
    }
  }


  const handleAddUser = () => {
    handleActionWithCompanyCheck(() => {
      setIsAddUserDialogOpen(true)
    })
  }



  // Component to display user roles
  function UserRolesBadges({ userId }: { userId: string }) {
    const [userRoles, setUserRoles] = useState<RoleType[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      async function loadUserRoles() {
        try {
          const roles = await getUserRoles(userId)
          setUserRoles(roles)
        } catch (error) {
          console.error("Error loading user roles:", error)
        } finally {
          setLoading(false)
        }
      }

      loadUserRoles()
    }, [userId])

    if (loading) {
      return <div className="animate-pulse bg-gray-200 h-5 w-16 rounded"></div>
    }

    if (userRoles.length === 0) {
      return <span className="text-muted-foreground text-sm">No roles</span>
    }

    return <div className="flex flex-wrap gap-1">{userRoles.map((roleId) => getRoleBadge(roleId))}</div>
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage users and their permissions.</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management ({users.length})</h1>
          <p className="text-muted-foreground">Manage users and their roles.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => handleActionWithCompanyCheck(() => router.push("/admin/access-management"))}
          >
            <Shield className="h-4 w-4" />
            Roles & Access
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => handleActionWithCompanyCheck(() => router.push("/admin/invitation-codes"))}
          >
            <Mail className="h-4 w-4" />
            Generate Codes
          </Button>
          <Button className="gap-2" onClick={handleAddUser}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
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
                  <div className={`h-1 w-full ${departmentColors[department] || 'bg-gray-300'} mt-2`}></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {departmentUsers.slice(0, 5).map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{user.displayName}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditRoles(user)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {departmentUsers.length > 5 && (
                    <div className="text-center text-sm text-muted-foreground py-2">
                      +{departmentUsers.length - 5} more users
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => router.push(`/admin/department/${encodeURIComponent(department)}`)}
                    >
                      View More Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <CompanyRegistrationDialog
        isOpen={isCompanyRegistrationDialogOpen}
        onClose={() => setIsCompanyRegistrationDialogOpen(false)}
        onSuccess={() => {
          setIsCompanyRegistrationDialogOpen(false)
          refreshUserData()
        }}
      />

      <AddUserDialog
        open={isAddUserDialogOpen}
        onOpenChange={(open) => setIsAddUserDialogOpen(open)}
        onSuccess={(userData) => {
          setAddedUserData(userData)
          setIsUserAddedSuccessDialogOpen(true)
        }}
      />

      <Dialog open={isEditRolesDialogOpen} onOpenChange={(open) => setIsEditRolesDialogOpen(open)}>
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
            {roleDialogLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Loading roles...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selectedRoles[role.id] || false}
                      onCheckedChange={(checked) =>
                        setSelectedRoles((prev) => ({ ...prev, [role.id]: checked === true }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor={`role-${role.id}`} className="flex items-center gap-2 cursor-pointer">
                        <span className="font-medium">{role.name}</span>
                        {getRoleBadge(role.id)}
                      </Label>
                      <div className="text-sm text-muted-foreground mt-1">{role.description}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        <strong>Permissions:</strong> {role.permissions.length} modules
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsEditRolesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={roleDialogLoading}>
              {roleDialogLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {addedUserData && isUserAddedSuccessDialogOpen && (
        <UserAddedSuccessDialog
          isOpen={isUserAddedSuccessDialogOpen}
          onClose={(_?: any) => setIsUserAddedSuccessDialogOpen(false)}
          onAddAnother={() => {
            setIsUserAddedSuccessDialogOpen(false)
            setIsAddUserDialogOpen(true)
          }}
          userEmail={addedUserData.email}
          userName={addedUserData.name}
          userRole={addedUserData.role}
        />
      )}

    </div>
  )
}
