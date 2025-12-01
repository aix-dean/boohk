"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { ArrowLeft, UserPlus, Settings, Shield, Users, Search } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
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

export default function ITDepartmentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { userData, refreshUserData } = useAuth()
  const departmentName = decodeURIComponent(params.name as string)

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
  const [departmentUsers, setDepartmentUsers] = useState<User[]>([])
  const [isUserAddedSuccessDialogOpen, setIsUserAddedSuccessDialogOpen] = useState(false)
  const [addedUserData, setAddedUserData] = useState<{ email: string; name: string; role: string } | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Role to department mapping
  const roleToDepartment: Record<string, string> = {
    admin: "Administrator",
    sales: "Sales Team",
    logistics: "Logistics Team",
    cms: "Content Management",
    it: "IT Team",
    business: "Business Dev",
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
    "Business Dev": "bg-purple-500",
    "Treasury": "bg-green-500",
    "Accounting": "bg-blue-600",
    "Finance": "bg-emerald-500",
  }

  // Disabled roles in the edit dialog
  const disabledRoles: RoleType[] = ['admin', 'cms', 'treasury', 'finance']

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

  // Get users for this department - using same logic as user management page
  useEffect(() => {
    const loadDepartmentUsers = async () => {
      if (users.length === 0) {
        setDepartmentUsers([])
        return
      }

      const departmentUserList: User[] = []

      // Use same logic as user management page
      for (const user of users) {
        try {
          const userRoles = await getUserRoles(user.id)
          userRoles.forEach((roleId) => {
            const userDepartmentName = roleToDepartment[roleId]
            if (userDepartmentName === departmentName && !departmentUserList.find((u) => u.id === user.id)) {
              departmentUserList.push(user)
            }
          })
        } catch (error) {
          console.error(`Error getting roles for user ${user.id}:`, error)
        }
      }

      // Apply search filter to department users
      const filteredDepartmentUsers = departmentUserList.filter(
        (user) =>
          user.displayName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
      )

      setDepartmentUsers(filteredDepartmentUsers)
    }

    loadDepartmentUsers()
  }, [users, departmentName, debouncedSearchTerm])

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
            <h1 className="text-2xl font-bold">Department Details</h1>
            <p className="text-muted-foreground">Loading department information...</p>
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              {departmentName}
            </h1>
            <p className="text-muted-foreground">Manage users in the {departmentName} department</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={handleAddUser}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Department Color Line */}
      <div className={`h-1 w-full ${departmentColors[departmentName] || 'bg-gray-300'} mb-6 rounded`}></div>

      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users in this department..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="text-sm">
          {departmentUsers.length} member{departmentUsers.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-4">
        {departmentUsers.length > 0 ? (
          departmentUsers.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium text-lg">{user.displayName}</h4>
                      <p className="text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(user.status)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <UserRolesBadges userId={user.id} />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEditRoles(user)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Roles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No users found</h3>
              <p className="text-muted-foreground mb-4">
                There are no users currently assigned to the {departmentName} department.
              </p>
              <Button onClick={handleAddUser}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add First User
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

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
        onOpenChange={setIsAddUserDialogOpen}
        onSuccess={(userData) => {
          setAddedUserData(userData)
          setIsUserAddedSuccessDialogOpen(true)
        }}
      />

      <Dialog open={isEditRolesDialogOpen} onOpenChange={setIsEditRolesDialogOpen}>
        <DialogContent className="sm:max-w-md h-[400px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit User Roles</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <span>
                  Manage roles for <strong>{selectedUser.displayName || selectedUser.email}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 min-h-0">
            {roleDialogLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Loading roles...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className={`flex items-start space-x-3 p-3 border rounded-lg ${disabledRoles.includes(role.id) ? 'opacity-50' : ''}`}>
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selectedRoles[role.id] || false}
                      disabled={disabledRoles.includes(role.id)}
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
                      {/*
                      <div className="text-xs text-muted-foreground mt-2">
                        <strong>Permissions:</strong> {role.permissions.length} modules
                      </div>
                      */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-end flex-shrink-0">
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