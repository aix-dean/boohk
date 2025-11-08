"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ComingSoonModalProps {
  onClose?: () => void
  onNotify?: () => void
}

export function ComingSoonModal({ onClose, onNotify }: ComingSoonModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-[346px] h-[196px] flex-shrink-0 rounded-2xl bg-white p-8 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-[#333] font-inter text-[16px] font-normal leading-[16px]" />
        </button>

        {/* Content */}
        <div className="flex gap-6">
          {/* Illustration */}
          <div className="flex-shrink-0">
            <img
              src="/coming-soon-oscar.png"
              alt="Coming soon illustration"
              className="h-24 w-24 object-contain"
            />
          </div>

          {/* Text content */}
          <div className="flex flex-col justify-center">
            <h2 className="mb-2 text-[#333] font-inter text-[16px] font-bold leading-none">Coming soon!</h2>
            <p className="text-[#333] font-inter text-[12px] font-light leading-none">
              We are working hard to make this feature available to you as soon as possible!
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 w-[149.172px] h-[23px] flex-shrink-0 text-[#333] text-center font-inter text-xs font-bold leading-[12px]"
          >
            OK
          </Button>
          <Button onClick={onNotify} className="flex-1 w-[149.172px] h-[23px] flex-shrink-0 rounded-[6.024px] bg-[#1D0BEB] text-white text-center font-inter text-xs font-bold leading-[12px] hover:bg-[#1D0BEB]">
            Notify me for updates
          </Button>
        </div>
      </div>
    </div>
  )
}
