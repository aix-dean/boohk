"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"

interface ServiceAssignmentSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saNumber: string
  onViewAssignments?: () => void
  onCreateAnother?: () => void
}

export function ServiceAssignmentSuccessDialog({
  open,
  onOpenChange,
  saNumber,
  onViewAssignments,
  onCreateAnother,
}: ServiceAssignmentSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center p-6">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <Image src="/party-popper.png" alt="Party Popper" width={120} height={120} className="object-contain" />
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900 text-center">Congratulations!</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-gray-600 text-lg">You have successfully created a service assignment!</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
