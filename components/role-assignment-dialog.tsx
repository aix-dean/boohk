"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import {
  getAllRoles,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
  type RoleType,
  type HardcodedRole,
} from "@/lib/hardcoded-access-service"

interface RoleAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  onSuccess?: () => void
}

export function RoleAssignmentDialog({ open, onOpenChange, userId, userName, onSuccess }: RoleAssignmentDialogProps) {
  const [roles] = useState<HardcodedRole[]>(getAllRoles())
  const [selectedRoles, setSelectedRoles] = useState<Record<RoleType, boolean>>({
    admin: false,
    sales: false,
    logistics: false,
    cms: false,
  })
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Load user's current roles when dialog opens
  useEffect(() => {
    if (open && userId) {
      loadUserRoles()
    }
  }, [open, userId])

  const loadUserRoles = async () => {
    setInitialLoading(true)
    try {
      const userRoles = await getUserRoles(userId)
      const roleState: Record<RoleType, boolean> = {
        admin: userRoles.includes("admin"),
        sales: userRoles.includes("sales"),
        logistics: userRoles.includes("logistics"),
        cms: userRoles.includes("cms"),
      }
      setSelectedRoles(roleState)
    } catch (error) {
      console.error("Error loading user roles:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load user roles.",
      })
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Get current roles
      const currentRoles = await getUserRoles(userId)

      // Determine changes
      const rolesToAdd = (Object.entries(selectedRoles) as [RoleType, boolean][])
        .filter(([roleId, isSelected]) => isSelected && !currentRoles.includes(roleId))
        .map(([roleId]) => roleId)

      const rolesToRemove = (Object.entries(selectedRoles) as [RoleType, boolean][])
        .filter(([roleId, isSelected]) => !isSelected && currentRoles.includes(roleId))
        .map(([roleId]) => roleId)

      // Apply changes
      for (const roleId of rolesToAdd) {
        await assignRoleToUser(userId, roleId)
      }

      for (const roleId of rolesToRemove) {
        await removeRoleFromUser(userId, roleId)
      }

      toast({
        title: "Success",
        description: "User roles updated successfully.",
      })

      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating user roles:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user roles.",
      })
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeClass = (roleId: RoleType) => {
    const badgeClasses = {
      admin: "bg-purple-100 text-purple-800 hover:bg-purple-100",
      sales: "bg-green-100 text-green-800 hover:bg-green-100",
      logistics: "bg-blue-100 text-blue-800 hover:bg-blue-100",
      cms: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    }
    return badgeClasses[roleId]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Roles</DialogTitle>
          <DialogDescription>
            Manage roles for <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {initialLoading ? (
            <div className="flex items-center justify-center py-8">
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
                      <Badge className={getRoleBadgeClass(role.id)}>{role.id.toUpperCase()}</Badge>
                    </Label>
                    <div className="text-sm text-muted-foreground mt-1">{role.description}</div>
                    <div className="text-xs text-muted-foreground mt-2">
                      <strong>Access:</strong> {role.permissions.length} modules
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || initialLoading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
