"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"
import { useState } from "react"

interface AddTeammateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: {
    name: string
    color: string
  } | null
}

export function AddTeammateDialog({ open, onOpenChange, department }: AddTeammateDialogProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  })

  const handleSendInvite = () => {
    console.log("[v0] Sending invite:", {
      department: department?.name,
      ...formData,
    })
    onOpenChange(false)
    setFormData({ firstName: "", lastName: "", email: "" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900">+ Add a Teammate</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5 text-gray-900" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department" className="text-sm font-normal text-gray-900">
              Department:
            </Label>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${department?.color}`} />
              <span className="text-sm text-gray-900">{department?.name}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-normal text-gray-900">
              First Name:
            </Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="border-gray-300"
              placeholder="John"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-normal text-gray-900">
              Last Name:
            </Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="border-gray-300"
              placeholder="Fernandez"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-normal text-gray-900">
              Email:
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="border-gray-300"
              placeholder="J.fernandez10@gmail.com"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSendInvite}>
              Send Invite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}