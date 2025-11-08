"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface DisplayIndexCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateSA?: () => void
}

export function DisplayIndexCardDialog({ open, onOpenChange, onCreateSA }: DisplayIndexCardDialogProps) {
  const handleCreateSA = () => {
    if (onCreateSA) {
      onCreateSA()
    }
    onOpenChange(false)
  }

  // Generate cabinet data (C1 to C30)
  const cabinets = Array.from({ length: 30 }, (_, i) => {
    const cabinetNumber = i + 1
    const isHealthy = cabinetNumber !== 9 // C9 has an issue
    return {
      id: `C${cabinetNumber}`,
      healthy: isHealthy,
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="relative">
          <DialogTitle className="text-lg font-semibold">Index Card</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Cabinet Information */}
          <div className="mb-4 space-y-1">
            <div className="text-sm">
              <span className="font-medium">Cabinets:</span> 30 cabinets
            </div>
            <div className="text-sm">
              <span className="font-medium">Status:</span> 93% Healthy
            </div>
          </div>

          {/* Cabinet Grid */}
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-5 gap-2">
              {cabinets.map((cabinet) => (
                <div
                  key={cabinet.id}
                  className={`
                    h-10 rounded border flex items-center justify-center text-xs font-medium
                    ${
                      cabinet.healthy
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-red-200 border-red-300 text-red-700"
                    }
                  `}
                >
                  {cabinet.id}
                </div>
              ))}
            </div>
          </div>

          {/* View Latest Photo Link */}
          <div className="text-center mb-4">
            <a
              href="#"
              className="text-blue-600 hover:text-blue-800 underline text-sm"
              onClick={(e) => e.preventDefault()}
            >
              View Latest Photo (Jun 5, 2025)
            </a>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateSA} className="bg-blue-600 hover:bg-blue-700">
            Create SA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
