"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Loader2, Info } from "lucide-react"
import { getAllRoles, type RoleType } from "@/lib/hardcoded-access-service"

interface GenerateInvitationCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Remove the old PREDEFINED_ROLES constant and replace with:
const PREDEFINED_ROLES = getAllRoles().map((role) => ({
  value: role.id,
  label: role.name,
  description: role.description,
  color: role.color,
}))

const AVAILABLE_PERMISSIONS = []

export function GenerateInvitationCodeDialog({ open, onOpenChange }: GenerateInvitationCodeDialogProps) {
  const { userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    validityDays: 30,
    maxUsage: 0,
    role: "" as RoleType | "custom" | "",
    customRole: "",
    description: "",
  })

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      if (i === 4) result += "-"
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userData?.company_id) {
      toast.error("Company information not found")
      return
    }

    setLoading(true)

    try {
      const finalRole = formData.role === "custom" ? formData.customRole : formData.role

      if (!finalRole) {
        toast.error("Please select or enter a role")
        setLoading(false)
        return
      }

      // Validate that the role exists in our hardcoded roles (unless it's custom)
      if (formData.role !== "custom" && !PREDEFINED_ROLES.find((r) => r.value === formData.role)) {
        toast.error("Invalid role selected")
        setLoading(false)
        return
      }

      if (formData.validityDays < 1 || formData.validityDays > 365) {
        toast.error("Validity period must be between 1 and 365 days")
        setLoading(false)
        return
      }

      if (formData.maxUsage < 0 || formData.maxUsage > 1000) {
        toast.error("Usage limit must be between 0 and 1000 (0 = unlimited)")
        setLoading(false)
        return
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + formData.validityDays)

      const codeData = {
        code: generateRandomCode(),
        created_at: serverTimestamp(),
        expires_at: expiresAt,
        max_usage: formData.maxUsage,
        usage_count: 0,
        role: finalRole,
        status: "active",
        created_by: userData.uid,
        company_id: userData.company_id,
        description: formData.description || null,
        used_by: [],
      }

      // Add code to Firestore
      await addDoc(collection(db, "invitation_codes"), codeData)

      toast.success("Successfully generated invitation code")

      // Reset form
      setFormData({
        validityDays: 30,
        maxUsage: 0,
        role: "",
        customRole: "",
        description: "",
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error generating code:", error)
      toast.error("Failed to generate invitation code")
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: checked ? [...prev.permissions, permissionId] : prev.permissions.filter((p) => p !== permissionId),
    }))
  }

  const selectedRoleData = PREDEFINED_ROLES.find((r) => r.value === formData.role)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Invitation Code</DialogTitle>
          <DialogDescription>
            Create an invitation code for user registration with specific role and permissions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validity">Validity (Days)</Label>
                  <Input
                    id="validity"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.validityDays}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, validityDays: Number.parseInt(e.target.value) || 30 }))
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">How long the code remains valid</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUsage">Usage Limit</Label>
                  <Input
                    id="maxUsage"
                    type="number"
                    min="0"
                    max="1000"
                    value={formData.maxUsage}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, maxUsage: Number.parseInt(e.target.value) || 0 }))
                    }
                    placeholder="0 for unlimited"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of times the code can be used (0 = unlimited)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Role Assignment</CardTitle>
              <CardDescription>Select the role for users who register with this code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <div>
                        <div className="font-medium">Custom Role</div>
                        <div className="text-xs text-muted-foreground">Define a custom role</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customRole">Custom Role Name</Label>
                  <Input
                    id="customRole"
                    value={formData.customRole}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customRole: e.target.value }))}
                    placeholder="Enter custom role name"
                    required
                  />
                </div>
              )}

              {selectedRoleData && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Selected Role: {selectedRoleData.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{selectedRoleData.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add a description for this code..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Valid for:</span>
                  <Badge variant="secondary" className="ml-2">
                    {formData.validityDays} days
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Usage limit:</span>
                  <Badge variant="secondary" className="ml-2">
                    {formData.maxUsage === 0 ? "Unlimited" : formData.maxUsage}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Role:</span>
                  <Badge variant="outline" className="ml-2">
                    {formData.role === "custom" ? formData.customRole || "Custom" : formData.role || "Not selected"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
