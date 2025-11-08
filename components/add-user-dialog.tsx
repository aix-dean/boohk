"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Loader2, UserPlus, Send } from "lucide-react"
import { getAllRoles, type HardcodedRole } from "@/lib/hardcoded-access-service"

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (userData: { email: string; name: string; role: string }) => void
  initialRole?: string
  remainingSlots?: number
  departmentName?: string
}

export function AddUserDialog({ open, onOpenChange, onSuccess, initialRole, remainingSlots, departmentName }: AddUserDialogProps) {
  const { userData, projectData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [roles] = useState<HardcodedRole[]>(getAllRoles().filter(role => !['accounting', 'finance'].includes(role.id)))

  // Department color mapping for bullet points
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

  const getDepartmentColor = (dept?: string) => {
    return departmentColors[dept || ''] || 'bg-blue-500'
  }
  const [formData, setFormData] = useState({
    recipientEmail: "",
    firstName: "",
    lastName: "",
    role: initialRole || "admin", // Use initialRole if provided
    subject: `Invitation to join ${projectData?.company_name || "our organization"}`,
    message: `You've been invited to join our organization. Use the invitation code below to register your account and start collaborating with our team.`,
    validityDays: 30,
  })

  // Update role when initialRole changes
  useEffect(() => {
    if (initialRole) {
      setFormData((prev) => ({ ...prev, role: initialRole }))
    }
  }, [initialRole])

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

    if (!formData.recipientEmail) {
      toast.error("Please enter an email address")
      return
    }

    setLoading(true)

    try {
      // Generate invitation code
      const invitationCode = generateRandomCode()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + formData.validityDays)

      const codeData = {
        code: invitationCode,
        created_at: serverTimestamp(),
        expires_at: expiresAt,
        max_usage: 1, // Single use for direct invitations
        usage_count: 0,
        role: formData.role,
        permissions: [], // Can be extended based on role
        status: "active",
        created_by: userData.uid,
        company_id: userData.company_id,
        description: `Direct invitation for ${formData.recipientEmail}`,
        used_by: [],
        invited_email: formData.recipientEmail, // Track who this was sent to
      }

      // Save invitation code to Firestore
      await addDoc(collection(db, "invitation_codes"), codeData)

      // Send invitation email
      const registrationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register?orgCode=${invitationCode}`

      const response = await fetch("/api/invitations/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: formData.recipientEmail,
          recipientName: `${formData.firstName} ${formData.lastName}`.trim(),
          subject: formData.subject,
          message: formData.message,
          invitationCode: invitationCode,
          registrationUrl,
          senderName: userData?.displayName || userData?.email,
          companyName: projectData?.company_name || "Boohk",
          role: formData.role,
          expiresAt: expiresAt.toLocaleDateString(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send email")
      }

      toast.success(`Invitation sent successfully to ${formData.recipientEmail}`)

      // Reset form
      setFormData({
        recipientEmail: "",
        firstName: "",
        lastName: "",
        role: "admin",
        subject: `Invitation to join ${projectData?.company_name || "our organization"}`,
        message: `You've been invited to join our organization. Use the invitation code below to register your account and start collaborating with our team.`,
        validityDays: 30,
      })

      onSuccess?.({
        email: formData.recipientEmail,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        role: formData.role,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error sending invitation:", error)
      toast.error("Failed to send invitation. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const selectedRoleData = roles.find((r) => r.id === formData.role)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Add New User</span>
          </DialogTitle>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>You can add {remainingSlots || 0} more teammates</div>
            <div className="flex items-center gap-2">
              <span>Add to:</span>
              <div className={`w-2 h-2 rounded-full ${getDepartmentColor(departmentName)}`} />
              <span>{departmentName || 'New User'}</span>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="recipientEmail" className="text-sm font-medium">Email *</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                placeholder="user@example.com"
                required
                className="col-span-2"
              />
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="role" className="text-sm font-medium">Role</Label>
              {initialRole ? (
                <div className="col-span-2 px-3 py-2 bg-muted rounded-md text-sm">
                  {roles.find((r) => r.id === formData.role)?.name || formData.role}
                </div>
              ) : (
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger className="col-span-2">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="John"
                className="col-span-2"
              />
            </div>

            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Doe"
                className="col-span-2"
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
