"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface AddTeammateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  departmentName: string
  remainingSlots: number
  onChooseFromTeamList: () => void
  onCreateNewTeammate: () => void
}

export function AddTeammateDialog({
  open,
  onOpenChange,
  departmentName,
  remainingSlots,
  onChooseFromTeamList,
  onCreateNewTeammate,
}: AddTeammateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">+ Add a Teammate</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>You can add {remainingSlots} more teammates</span>
            <Badge variant="secondary" className="text-xs">
              Add
            </Badge>
          </div>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          <Button variant="outline" className="w-full h-12 text-base bg-transparent" onClick={onChooseFromTeamList}>
            Choose from Team List
          </Button>
          <Button className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700" onClick={onCreateNewTeammate}>
            Create New Teammate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}