"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import {
  getRoles,
  getPermissions,
  getRolePermissions,
  createRole,
  updateRole,
  deleteRole,
  assignPermissionToRole,
  removePermissionFromRole,
} from "@/lib/access-management-service"
import type { Role, Permission } from "@/lib/access-management-service"
import { Search, Plus, Edit, Trash } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false)

  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", isAdmin: false })
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({})

  // Load roles and permissions
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Get roles and permissions
        const [fetchedRoles, fetchedPermissions] = await Promise.all([getRoles(), getPermissions()])
        setRoles(fetchedRoles)
        setPermissions(fetchedPermissions)

        // Get permissions for each role
        const rolePermissions: Record<string, string[]> = {}
        for (const role of fetchedRoles) {
          const permissions = await getRolePermissions(role.id)
          rolePermissions[role.id] = permissions
        }
        setRolePermissionsMap(rolePermissions)
      } catch (error) {
        console.error("Error loading role data:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load roles and permissions. Please try again.",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter roles based on search term
  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  // Create a new role
  const handleCreateRole = async () => {
    if (!formData.name.trim()) return

    try {
      setLoading(true)

      const roleId = await createRole({
        name: formData.name.trim(),
        description: formData.description.trim(),
        isAdmin: formData.isAdmin,
      })

      // Add the new role to the local state
      setRoles((prev) => [
        ...prev,
        {
          id: roleId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          isAdmin: formData.isAdmin,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ])

      // Initialize empty permissions for this role
      setRolePermissionsMap((prev) => ({
        ...prev,
        [roleId]: [],
      }))

      toast({
        title: "Success",
        description: "Role created successfully.",
      })

      // Reset form and close dialog
      setFormData({ name: "", description: "", isAdmin: false })
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Error creating role:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create role. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Update an existing role
  const handleUpdateRole = async () => {
    if (!selectedRole || !formData.name.trim()) return

    try {
      setLoading(true)

      await updateRole(selectedRole.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isAdmin: formData.isAdmin,
      })

      // Update the role in the local state
      setRoles((prev) =>
        prev.map((role) =>
          role.id === selectedRole.id
            ? {
                ...role,
                name: formData.name.trim(),
                description: formData.description.trim(),
                isAdmin: formData.isAdmin,
                updatedAt: Date.now(),
              }
            : role,
        ),
      )

      toast({
        title: "Success",
        description: "Role updated successfully.",
      })

      setIsEditDialogOpen(false)
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update role. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Delete a role
  const handleDeleteRole = async () => {
    if (!selectedRole) return

    try {
      setLoading(true)

      await deleteRole(selectedRole.id)

      // Remove the role from the local state
      setRoles((prev) => prev.filter((role) => role.id !== selectedRole.id))

      // Remove the role's permissions from the local state
      setRolePermissionsMap((prev) => {
        const { [selectedRole.id]: _, ...rest } = prev
        return rest
      })

      toast({
        title: "Success",
        description: "Role deleted successfully.",
      })

      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting role:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete role. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle editing role permissions
  const handleEditPermissions = (role: Role) => {
    setSelectedRole(role)

    // Initialize selected permissions based on role's current permissions
    const initialSelectedPermissions: Record<string, boolean> = {}
    permissions.forEach((permission) => {
      initialSelectedPermissions[permission.id] = rolePermissionsMap[role.id]?.includes(permission.id) || false
    })

    setSelectedPermissions(initialSelectedPermissions)
    setIsPermissionsDialogOpen(true)
  }

  // Save role permissions
  const handleSavePermissions = async () => {
    if (!selectedRole) return

    try {
      setLoading(true)

      // Get current role permissions
      const currentPermissions = rolePermissionsMap[selectedRole.id] || []

      // Determine permissions to add and remove
      const permissionsToAdd = Object.entries(selectedPermissions)
        .filter(([permId, isSelected]) => isSelected && !currentPermissions.includes(permId))
        .map(([permId]) => permId)

      const permissionsToRemove = Object.entries(selectedPermissions)
        .filter(([permId, isSelected]) => !isSelected && currentPermissions.includes(permId))
        .map(([permId]) => permId)

      // Add new permissions
      for (const permId of permissionsToAdd) {
        await assignPermissionToRole(selectedRole.id, permId)
      }

      // Remove permissions
      for (const permId of permissionsToRemove) {
        await removePermissionFromRole(selectedRole.id, permId)
      }

      // Update local state
      setRolePermissionsMap((prev) => ({
        ...prev,
        [selectedRole.id]: Object.entries(selectedPermissions)
          .filter(([_, isSelected]) => isSelected)
          .map(([permId]) => permId),
      }))

      toast({
        title: "Success",
        description: "Role permissions updated successfully.",
      })

      setIsPermissionsDialogOpen(false)
    } catch (error) {
      console.error("Error saving role permissions:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update role permissions. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Group permissions by module for the dialog
  const permissionsByModule: Record<string, Permission[]> = {}
  permissions.forEach((permission) => {
    if (!permissionsByModule[permission.module]) {
      permissionsByModule[permission.module] = []
    }
    permissionsByModule[permission.module].push(permission)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search roles..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setFormData({ name: "", description: "", isAdmin: false })
            setIsCreateDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {loading && roles.length === 0 ? (
        <div className="flex justify-center p-8">
          <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2">Loading roles...</span>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      {role.isAdmin ? <Badge>Administrator</Badge> : <Badge variant="outline">Standard</Badge>}
                    </TableCell>
                    <TableCell>
                      {rolePermissionsMap[role.id]?.length > 0 ? (
                        <span className="text-sm">{rolePermissionsMap[role.id].length} permission(s)</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">No permissions</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditPermissions(role)}>
                          Permissions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRole(role)
                            setFormData({
                              name: role.name,
                              description: role.description,
                              isAdmin: role.isAdmin || false,
                            })
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRole(role)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Add a new role to the system.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Sales Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe the role's responsibilities"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAdmin"
                name="isAdmin"
                checked={formData.isAdmin}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({ ...prev, isAdmin: checked === true }))
                }}
              />
              <Label htmlFor="isAdmin">Administrator Role (has all permissions)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} disabled={loading || !formData.name.trim()}>
              {loading ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Role Name</Label>
              <Input id="edit-name" name="name" value={formData.name} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-isAdmin"
                name="isAdmin"
                checked={formData.isAdmin}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({ ...prev, isAdmin: checked === true }))
                }}
              />
              <Label htmlFor="edit-isAdmin">Administrator Role (has all permissions)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={loading || !formData.name.trim()}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={loading}>
              {loading ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Role Permissions</DialogTitle>
            <DialogDescription>
              {selectedRole?.name} - {selectedRole?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
              <div key={module} className="space-y-4">
                <h3 className="text-lg font-medium capitalize">{module}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modulePermissions.map((permission) => (
                    <div key={permission.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${permission.id}`}
                        checked={selectedPermissions[permission.id] || false}
                        onCheckedChange={(checked) => {
                          setSelectedPermissions((prev) => ({
                            ...prev,
                            [permission.id]: checked === true,
                          }))
                        }}
                      />
                      <Label htmlFor={`perm-${permission.id}`} className="flex-1">
                        <div>{permission.name}</div>
                        <div className="text-sm text-muted-foreground">{permission.description}</div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={loading}>
              {loading ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
