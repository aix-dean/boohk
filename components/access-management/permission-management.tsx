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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPermissions, createPermission, updatePermission, deletePermission } from "@/lib/access-management-service"
import type { Permission } from "@/lib/access-management-service"
import { Search, Plus, Edit, Trash } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

export function PermissionManagement() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    module: "sales" as "sales" | "logistics" | "cms" | "admin",
    action: "view" as "view" | "create" | "edit" | "delete",
  })

  // Load permissions
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const fetchedPermissions = await getPermissions()
        setPermissions(fetchedPermissions)
      } catch (error) {
        console.error("Error loading permissions:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load permissions. Please try again.",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter permissions based on search term
  const filteredPermissions = permissions.filter(
    (permission) =>
      permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.action.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Group permissions by department/module
  const groupedPermissions = filteredPermissions.reduce(
    (groups, permission) => {
      const module = permission.module
      if (!groups[module]) {
        groups[module] = []
      }
      groups[module].push(permission)
      return groups
    },
    {} as Record<string, Permission[]>,
  )

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Create a new permission
  const handleCreatePermission = async () => {
    if (!formData.name.trim()) return

    try {
      setLoading(true)

      const permissionId = await createPermission({
        name: formData.name.trim(),
        description: formData.description.trim(),
        module: formData.module,
        action: formData.action,
      })

      // Add the new permission to the local state
      setPermissions((prev) => [
        ...prev,
        {
          id: permissionId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          module: formData.module,
          action: formData.action,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ])

      toast({
        title: "Success",
        description: "Permission created successfully.",
      })

      // Reset form and close dialog
      setFormData({
        name: "",
        description: "",
        module: "sales",
        action: "view",
      })
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Error creating permission:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create permission. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Update an existing permission
  const handleUpdatePermission = async () => {
    if (!selectedPermission || !formData.name.trim()) return

    try {
      setLoading(true)

      await updatePermission(selectedPermission.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        module: formData.module,
        action: formData.action,
      })

      // Update the permission in the local state
      setPermissions((prev) =>
        prev.map((permission) =>
          permission.id === selectedPermission.id
            ? {
                ...permission,
                name: formData.name.trim(),
                description: formData.description.trim(),
                module: formData.module,
                action: formData.action,
                updatedAt: Date.now(),
              }
            : permission,
        ),
      )

      toast({
        title: "Success",
        description: "Permission updated successfully.",
      })

      setIsEditDialogOpen(false)
    } catch (error) {
      console.error("Error updating permission:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update permission. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Delete a permission
  const handleDeletePermission = async () => {
    if (!selectedPermission) return

    try {
      setLoading(true)

      await deletePermission(selectedPermission.id)

      // Remove the permission from the local state
      setPermissions((prev) => prev.filter((permission) => permission.id !== selectedPermission.id))

      toast({
        title: "Success",
        description: "Permission deleted successfully.",
      })

      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting permission:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete permission. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // Get badge color based on action
  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "view":
        return "default"
      case "create":
        return "outline"
      case "edit":
        return "secondary"
      case "delete":
        return "destructive"
      default:
        return "outline"
    }
  }

  // Get department display name
  const getDepartmentDisplayName = (module: string) => {
    switch (module) {
      case "admin":
        return "Administration"
      case "sales":
        return "Sales"
      case "logistics":
        return "Logistics"
      case "cms":
        return "Content Management"
      default:
        return module.charAt(0).toUpperCase() + module.slice(1)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search permissions..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setFormData({
              name: "",
              description: "",
              module: "sales",
              action: "view",
            })
            setIsCreateDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Permission
        </Button>
      </div>

      {loading && permissions.length === 0 ? (
        <div className="flex justify-center p-8">
          <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2">Loading permissions...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedPermissions).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No permissions found</p>
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <Card key={module}>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{getDepartmentDisplayName(module)} Department</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {modulePermissions.map((permission) => (
                          <TableRow key={permission.id}>
                            <TableCell className="font-medium">{permission.name}</TableCell>
                            <TableCell>{permission.description}</TableCell>
                            <TableCell>
                              <Badge variant={getActionBadgeVariant(permission.action)} className="capitalize">
                                {permission.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPermission(permission)
                                    setFormData({
                                      name: permission.name,
                                      description: permission.description,
                                      module: permission.module,
                                      action: permission.action,
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
                                    setSelectedPermission(permission)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Create Permission Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Permission</DialogTitle>
            <DialogDescription>Add a new permission to the system.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Permission Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., View Sales Dashboard"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what this permission allows"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select value={formData.module} onValueChange={(value) => handleSelectChange("module", value)}>
                <SelectTrigger id="module">
                  <SelectValue placeholder="Select a module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="cms">CMS</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select value={formData.action} onValueChange={(value) => handleSelectChange("action", value)}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePermission} disabled={loading || !formData.name.trim()}>
              {loading ? "Creating..." : "Create Permission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permission Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>Update permission details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Permission Name</Label>
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
            <div className="space-y-2">
              <Label htmlFor="edit-module">Module</Label>
              <Select value={formData.module} onValueChange={(value) => handleSelectChange("module", value)}>
                <SelectTrigger id="edit-module">
                  <SelectValue placeholder="Select a module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="cms">CMS</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-action">Action</Label>
              <Select value={formData.action} onValueChange={(value) => handleSelectChange("action", value)}>
                <SelectTrigger id="edit-action">
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePermission} disabled={loading || !formData.name.trim()}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Permission Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Permission</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the permission "{selectedPermission?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePermission} disabled={loading}>
              {loading ? "Deleting..." : "Delete Permission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
