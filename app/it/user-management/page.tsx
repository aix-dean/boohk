"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { UserPlus, Settings, Mail, Shield, Users, Search } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useRouter, useSearchParams } from "next/navigation"
import { CompanyRegistrationDialog } from "@/components/company-registration-dialog"
import { AddUserDialog } from "@/components/add-user-dialog"
import { UserAddedSuccessDialog } from "@/components/user-added-success-dialog"
import { AddTeammateDialog } from "@/components/add-teammate-dialog"
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

export default function ITUserManagementPage() {
  const { userData, refreshUserData, subscriptionData } = useAuth()
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
  const [isAddTeammateDialogOpen, setIsAddTeammateDialogOpen] = useState(false)
  const [selectedDepartmentForTeammate, setSelectedDepartmentForTeammate] = useState<string>("")
  const [isChooseFromTeamListDialogOpen, setIsChooseFromTeamListDialogOpen] = useState(false)
  const [selectedUsersForAssignment, setSelectedUsersForAssignment] = useState<string[]>([])
  const [availableUsersForAssignment, setAvailableUsersForAssignment] = useState<{user: User, roles: RoleType[]}[]>([])
  const [initialRoleForAddUser, setInitialRoleForAddUser] = useState<string>("")
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
        }
      })
      setUsers(usersData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userData?.company_id])

  // Filter users based on debounced search term
  const filteredUsers = useMemo(() => users.filter(
    (user) =>
      user.displayName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
  ), [users, debouncedSearchTerm])

  // Calculate remaining teammate slots
  const calculateRemainingSlots = () => {
    if (!subscriptionData?.maxUsers) return 0
    const maxUsers = subscriptionData.maxUsers === -1 ? Infinity : subscriptionData.maxUsers
    const currentUsers = users.length
    return Math.max(0, maxUsers - currentUsers)
  }

  // Get users not in the selected department
  const getUsersNotInDepartment = async (department: string) => {
    if (!users.length) return []

    const departmentRole = Object.entries(roleToDepartment).find(
      ([roleId, deptName]) => deptName === department
    )?.[0] as RoleType

    if (!departmentRole) return users.map(user => ({ user, roles: [] as RoleType[] }))

    const usersNotInDepartment: {user: User, roles: RoleType[]}[] = []

    for (const user of users) {
      try {
        const userRoles = await getUserRoles(user.id)
        if (!userRoles.includes(departmentRole)) {
          usersNotInDepartment.push({ user, roles: userRoles })
        }
      } catch (error) {
        console.error(`Error getting roles for user ${user.id}:`, error)
        // Still include user but with empty roles
        usersNotInDepartment.push({ user, roles: [] })
      }
    }

    return usersNotInDepartment
  }

  // Handle assigning selected users to department
  const handleAssignUsersToDepartment = async () => {
    if (!selectedUsersForAssignment.length || !selectedDepartmentForTeammate) return

    const departmentRole = Object.entries(roleToDepartment).find(
      ([roleId, deptName]) => deptName === selectedDepartmentForTeammate
    )?.[0] as RoleType

    if (!departmentRole) return

    try {
      for (const userId of selectedUsersForAssignment) {
        await assignRoleToUser(userId, departmentRole, userData?.uid)
      }

      toast({
        title: "Success",
        description: `Assigned ${selectedUsersForAssignment.length} user(s) to ${selectedDepartmentForTeammate}.`,
      })

      setIsChooseFromTeamListDialogOpen(false)
      setSelectedUsersForAssignment([])
    } catch (error) {
      console.error("Error assigning users to department:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign users to department. Please try again.",
      })
    }
  }

  // Role to department mapping
  const roleToDepartment: Record<string, string> = {
    business: "Business Development",
    sales: "Sales Team",
    accounting: "Accounting",
    it: "IT Team",
    admin: "Administrator",
    logistics: "Logistics Team",
    treasury: "Treasury",
    cms: "Content Management",
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

  const handleAddTeammate = (department: string) => {
    handleActionWithCompanyCheck(() => {
      setSelectedDepartmentForTeammate(department)
      setIsAddTeammateDialogOpen(true)
    })
  }

  const handleChooseFromTeamList = async () => {
    setIsAddTeammateDialogOpen(false)
    const availableUsers = await getUsersNotInDepartment(selectedDepartmentForTeammate)
    setAvailableUsersForAssignment(availableUsers)
    setIsChooseFromTeamListDialogOpen(true)
  }

  const handleCreateNewTeammate = () => {
    // Map department to role
    const departmentToRole: Record<string, string> = {
      "Administrator": "admin",
      "Sales Team": "sales",
      "Logistics Team": "logistics",
      "Content Management": "cms",
      "IT Team": "it",
      "Business Development": "business",
      "Treasury": "treasury",
      "Accounting": "accounting",
      "Finance": "finance",
    }

    const role = departmentToRole[selectedDepartmentForTeammate] || "user"
    setInitialRoleForAddUser(role)
    setIsAddTeammateDialogOpen(false)
    setIsAddUserDialogOpen(true)
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

  // Component to display user designation (roles as text)
  function UserDesignation({ roles: userRoles }: { roles: RoleType[] }) {
    if (userRoles.length === 0) {
      return <span className="text-muted-foreground text-sm">No designation</span>
    }

    return (
      <div className="text-sm">
        {userRoles.map((roleId) => (
          <span key={roleId}>
            {roles.find((r) => r.id === roleId)?.name}
          </span>
        )).reduce((prev, curr, index) => (
          index === 0 ? [curr] : [...prev, <span key={`comma-${index}`} className="text-muted-foreground">, </span>, curr]
        ), [] as React.ReactNode[])}
      </div>
    )
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
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {loading || Object.keys(usersByDepartment).length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="p-6 bg-white shadow-sm border border-gray-200 rounded-xl">
              <Skeleton className="h-1 w-full rounded-full mb-4 -mt-2" />
              <div className="mb-6">
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-4 w-12" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-6" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </div>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={`user-skeleton-${j}`} className="flex justify-between py-1">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-6 rounded" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </Card>
          ))
        ) : (
          Object.entries(usersByDepartment).map(([department, departmentUsers]) => {
            const memberCount = departmentUsers.length
            const memberText = memberCount === 1 ? "member" : "members"
            const isDisabled = ['Treasury', 'Administrator', 'Logistics Team', 'Finance', 'Content Management'].includes(department)

            return (
              <Card
                key={department}
                className={`p-6 shadow-sm border border-gray-200 rounded-xl transition-shadow ${
                  isDisabled
                    ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                    : 'bg-white cursor-pointer hover:shadow-md'
                }`}
                onClick={isDisabled ? undefined : () => router.push(`/it/department/${encodeURIComponent(department)}`)}
              >
                <div className={`h-1 ${departmentColors[department] || 'bg-gray-300'} rounded-full mb-4 -mt-2`} />

                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">{department}</h2>
                  <p className="text-gray-600">
                    {memberCount} {memberText}
                  </p>
                </div>

                {departmentUsers.length > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span>Name</span>
                      <div className="flex items-center gap-2">
                        <span></span>
                        <span>Role</span>
                      </div>
                    </div>
                    {departmentUsers.slice(0, 5).map((user) => {
                      // Find the role that corresponds to this department
                      const departmentRole = Object.entries(roleToDepartment).find(
                        ([roleId, deptName]) => deptName === department
                      )?.[0]

                      return (
                        <div key={user.id} className="flex justify-between text-sm text-gray-900 py-1">
                          <span>{user.displayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">
                              {departmentRole ? roles.find(r => r.id === departmentRole)?.name : 'No Role'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {departmentUsers.length > 5 && (
                      <div className="text-center text-sm text-muted-foreground py-2">
                        +{departmentUsers.length - 5} more users
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full text-gray-600 border-gray-300 hover:bg-gray-50 bg-transparent"
                  disabled={isDisabled}
                  onClick={isDisabled ? undefined : (e) => {
                    e.stopPropagation()
                    handleAddTeammate(department)
                  }}
                >
                  +Add Teammates
                </Button>
              </Card>
            )
          })
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
        initialRole={initialRoleForAddUser}
        remainingSlots={calculateRemainingSlots()}
        departmentName={selectedDepartmentForTeammate}
      />

      <Dialog open={isEditRolesDialogOpen} onOpenChange={setIsEditRolesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg">Edit User Roles</DialogTitle>
            <DialogDescription className="text-sm">
              {selectedUser && (
                <span>
                  Select roles for <strong>{selectedUser.displayName || selectedUser.email}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {roleDialogLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm">Loading roles...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={selectedRoles[role.id] || false}
                      onCheckedChange={(checked) =>
                        setSelectedRoles((prev) => ({ ...prev, [role.id]: checked === true }))
                      }
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`role-${role.id}`}
                          className="font-medium text-sm cursor-pointer flex-1"
                        >
                          {role.name}
                        </Label>
                        {getRoleBadge(role.id)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {role.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditRolesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={roleDialogLoading}>
              {roleDialogLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
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

      <AddTeammateDialog
        open={isAddTeammateDialogOpen}
        onOpenChange={setIsAddTeammateDialogOpen}
        departmentName={selectedDepartmentForTeammate}
        remainingSlots={calculateRemainingSlots()}
        onChooseFromTeamList={handleChooseFromTeamList}
        onCreateNewTeammate={handleCreateNewTeammate}
      />

      <Dialog open={isChooseFromTeamListDialogOpen} onOpenChange={setIsChooseFromTeamListDialogOpen}>
        <DialogContent className="sm:max-w-md h-[400px] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Choose from Team List</DialogTitle>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>You can add {calculateRemainingSlots()} more teammates</div>
              <div className="flex items-center gap-2">
                <span>Add to:</span>
                <div className={`w-2 h-2 rounded-full ${departmentColors[selectedDepartmentForTeammate] || 'bg-gray-300'}`} />
                <span>{selectedDepartmentForTeammate}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 min-h-0">
            {availableUsersForAssignment.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="w-12 p-3">
                        <Checkbox
                          checked={selectedUsersForAssignment.length === availableUsersForAssignment.length && availableUsersForAssignment.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUsersForAssignment(availableUsersForAssignment.map(u => u.user.id))
                            } else {
                              setSelectedUsersForAssignment([])
                            }
                          }}
                        />
                      </th>
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Designation</th>
                    </tr>
                  </thead>
                  <tbody className="max-h-60 overflow-y-auto">
                    {availableUsersForAssignment.map(({ user, roles }) => (
                      <tr key={user.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsersForAssignment.includes(user.id)}
                            onCheckedChange={(checked) =>
                              setSelectedUsersForAssignment((prev) =>
                                checked
                                  ? [...prev, user.id]
                                  : prev.filter((id) => id !== user.id)
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Label htmlFor={`user-${user.id}`} className="cursor-pointer font-medium">
                            {user.displayName}
                          </Label>
                        </td>
                        <td className="p-3">
                          <UserDesignation roles={roles} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No users available to assign to this department
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setIsChooseFromTeamListDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignUsersToDepartment}
              disabled={!selectedUsersForAssignment.length}
            >
              Assign to {selectedDepartmentForTeammate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
