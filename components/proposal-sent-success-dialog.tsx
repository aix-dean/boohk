"use client"

import { useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import Image from "next/image"

interface ProposalSentSuccessDialogProps {
  isOpen: boolean
  onDismissAndNavigate: () => void
}

export function ProposalSentSuccessDialog({ isOpen, onDismissAndNavigate }: ProposalSentSuccessDialogProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onDismissAndNavigate()
      }, 3000) // Auto-dismiss after 3 seconds
      return () => clearTimeout(timer)
    }
  }, [isOpen, onDismissAndNavigate])

  return (
    <Dialog open={isOpen} onOpenChange={onDismissAndNavigate}>
      <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-3xl font-bold mb-4">Congratulations!</h2>
        <Image src="/party-popper.png" alt="Party Popper" width={120} height={120} className="mb-6" />
        <p className="text-lg text-gray-700">You have successfully sent!</p>
      </DialogContent>
    </Dialog>
  )
}
