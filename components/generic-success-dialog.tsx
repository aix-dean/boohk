"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, Upload, Save } from "lucide-react"

interface GenericSuccessDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message: string
  type?: "upload" | "save" | "general"
}

export function GenericSuccessDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Success!",
  message,
  type = "general"
}: GenericSuccessDialogProps) {
  const getIcon = () => {
    switch (type) {
      case "upload":
        return <Upload className="w-8 h-8 text-green-600" />
      case "save":
        return <Save className="w-8 h-8 text-green-600" />
      default:
        return <CheckCircle className="w-8 h-8 text-green-600" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold text-gray-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
          {getIcon()}
        </div>
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            {message}
          </p>
          <div className="flex justify-center">
            <Button onClick={onConfirm || onClose} className="px-8">
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}