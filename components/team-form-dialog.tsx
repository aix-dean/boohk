"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import type { Team, CreateTeamData } from "@/lib/types/team"
import { useAuth } from "@/contexts/auth-context"

interface TeamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateTeamData) => Promise<void>
  team?: Team | null
  loading?: boolean
}

const TEAM_TYPES = [
  { value: "operations", label: "Operations" },
  { value: "maintenance", label: "Maintenance" },
  { value: "installation", label: "Installation" },
  { value: "delivery", label: "Delivery" },
  { value: "support", label: "Support" },
] as const

const COMMON_SPECIALIZATIONS = [
  "LED Installation",
  "Electrical Work",
  "Structural Installation",
  "Maintenance & Repair",
  "Quality Control",
  "Safety Management",
  "Project Management",
  "Customer Service",
  "Technical Support",
  "Equipment Operation",
]

export function TeamFormDialog({ open, onOpenChange, onSubmit, team, loading }: TeamFormDialogProps) {
  const { userData } = useAuth()

  const [formData, setFormData] = useState<CreateTeamData>({
    name: team?.name || "",
    description: team?.description || "",
    teamType: team?.teamType || "operations",
    leaderName: team?.leaderName || "",
    specializations: team?.specializations || [],
    location: team?.location || "",
    contactNumber: team?.contactNumber || "",
    email: team?.email || "",
    company_id: team?.company_id || userData?.company_id || "",
  })

  const [newSpecialization, setNewSpecialization] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const addSpecialization = (spec: string) => {
    if (spec && !formData.specializations.includes(spec)) {
      setFormData((prev) => ({
        ...prev,
        specializations: [...prev.specializations, spec],
      }))
    }
    setNewSpecialization("")
  }

  const removeSpecialization = (spec: string) => {
    setFormData((prev) => ({
      ...prev,
      specializations: prev.specializations.filter((s) => s !== spec),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team ? "Edit Team" : "Create New Team"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Operations Team Alpha"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamType">Team Type *</Label>
              <Select
                value={formData.teamType}
                onValueChange={(value: any) => setFormData((prev) => ({ ...prev, teamType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the team's responsibilities..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leaderName">Team Leader</Label>
              <Input
                id="leaderName"
                value={formData.leaderName}
                onChange={(e) => setFormData((prev) => ({ ...prev, leaderName: e.target.value }))}
                placeholder="Team leader name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Manila Office, Cebu Branch"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                value={formData.contactNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="+63 XXX XXX XXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="team@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Specializations</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.specializations.map((spec) => (
                <Badge key={spec} variant="secondary" className="flex items-center gap-1">
                  {spec}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeSpecialization(spec)} />
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                placeholder="Add specialization..."
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addSpecialization(newSpecialization)
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addSpecialization(newSpecialization)}>
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              {COMMON_SPECIALIZATIONS.map((spec) => (
                <Button
                  key={spec}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => addSpecialization(spec)}
                  disabled={formData.specializations.includes(spec)}
                >
                  + {spec}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : team ? "Update Team" : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
