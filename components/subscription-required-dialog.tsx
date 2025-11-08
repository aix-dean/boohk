"use client"

import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface SubscriptionRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpgrade: () => void
}

export function SubscriptionRequiredDialog({ open, onOpenChange, onUpgrade }: SubscriptionRequiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Subscription Required</DialogTitle>
          </div>
          <DialogDescription>Grab your first free site - choose a plan now!</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onUpgrade}>Choose Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
