"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, UserPlus } from "lucide-react"

interface UserAddedSuccessDialogProps {
  isOpen: boolean
  onClose: () => void
  onAddAnother: () => void
  userEmail: string
  userName: string
  userRole: string
}

export function UserAddedSuccessDialog({
  isOpen,
  onClose,
  onAddAnother,
  userEmail,
  userName,
  userRole,
}: UserAddedSuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold text-gray-900">
            Success!
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            You have successfully added and invited a new user!
          </p>
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Name:</span> {userName || "Not specified"}
            </div>
            <div className="text-sm">
              <span className="font-medium">Email:</span> {userEmail}
            </div>
            <div className="text-sm">
              <span className="font-medium">Role:</span>{" "}
              <Badge variant="outline" className="ml-1">
                {userRole}
              </Badge>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onAddAnother} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Another User
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}