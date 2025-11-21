"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ComingSoonModalProps {
  onClose: () => void
  onNotify?: () => void
}

export function ComingSoonModal({ onClose, onNotify }: ComingSoonModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Coming Soon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <p className="text-muted-foreground">
            This feature is currently under development and will be available soon.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            {onNotify && (
              <Button className="flex-1" onClick={onNotify}>
                Notify Me
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ComingSoonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComingSoonDialog({ open, onOpenChange }: ComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Coming Soon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <p className="text-muted-foreground">
            This feature is currently under development and will be available soon.
          </p>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
