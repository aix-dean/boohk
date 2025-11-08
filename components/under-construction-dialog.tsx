"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"

interface UnderConstructionDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function UnderConstructionDialog({ isOpen, onClose }: UnderConstructionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-8 text-center">
        <div className="flex flex-col items-center justify-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Bridge Under Construction</h2>
          <div className="w-32 h-32 flex items-center justify-center">
            <svg viewBox="0 0 200 150" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Bridge towers */}
              <rect x="40" y="60" width="20" height="60" fill="#8B5CF6" />
              <rect x="140" y="60" width="20" height="60" fill="#8B5CF6" />

              {/* Bridge tower tops */}
              <rect x="35" y="50" width="30" height="15" fill="#7C3AED" />
              <rect x="135" y="50" width="30" height="15" fill="#7C3AED" />

              {/* Bridge deck */}
              <rect x="20" y="100" width="160" height="8" fill="#A855F7" />

              {/* Cables */}
              <line x1="50" y1="60" x2="75" y2="100" stroke="#8B5CF6" strokeWidth="2" />
              <line x1="50" y1="60" x2="100" y2="100" stroke="#8B5CF6" strokeWidth="2" />
              <line x1="50" y1="60" x2="125" y2="100" stroke="#8B5CF6" strokeWidth="2" />
              <line x1="150" y1="60" x2="125" y2="100" stroke="#8B5CF6" strokeWidth="2" />
              <line x1="150" y1="60" x2="100" y2="100" stroke="#8B5CF6" strokeWidth="2" />
              <line x1="150" y1="60" x2="75" y2="100" stroke="#8B5CF6" strokeWidth="2" />

              {/* Bridge supports */}
              <rect x="48" y="108" width="4" height="12" fill="#7C3AED" />
              <rect x="148" y="108" width="4" height="12" fill="#7C3AED" />

              {/* 3D effect shadows */}
              <rect x="42" y="62" width="20" height="60" fill="#6D28D9" opacity="0.3" />
              <rect x="142" y="62" width="20" height="60" fill="#6D28D9" opacity="0.3" />
            </svg>
          </div>
          <p className="text-lg text-gray-600">We are creating something exciting for you!</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
