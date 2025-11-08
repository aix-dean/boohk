"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Image from "next/image"
import { useEffect } from "react"

interface CostEstimateSentSuccessDialogProps {
  isOpen: boolean
  onDismissAndNavigate: () => void
}

export function CostEstimateSentSuccessDialog({ isOpen, onDismissAndNavigate }: CostEstimateSentSuccessDialogProps) {
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isOpen) {
      timer = setTimeout(() => {
        onDismissAndNavigate()
      }, 3000) // Auto-dismiss after 3 seconds
    }
    return () => clearTimeout(timer)
  }, [isOpen, onDismissAndNavigate])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismissAndNavigate()}>
      <DialogContent className="sm:max-w-[425px] text-center">
        {" "}
        {/* This class ensures consistent width */}
        <DialogHeader className="items-center">
          <Image src="/party-popper.png" alt="Success" width={80} height={80} className="mb-4" />
          <DialogTitle className="text-2xl font-bold text-green-600">Congratulations!</DialogTitle>
          <DialogDescription className="text-gray-600">
            Your cost estimate has been successfully sent.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
