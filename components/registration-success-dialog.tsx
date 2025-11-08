"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Image from "next/image"
// Removed useRouter as redirection is handled by parent component

interface RegistrationSuccessDialogProps {
  isOpen: boolean
  firstName: string
  onClose: () => void
}

export function RegistrationSuccessDialog({ isOpen, firstName, onClose }: RegistrationSuccessDialogProps) {
  // handleStart now just closes the dialog, as redirection happens before this dialog is shown
  const handleStart = () => {
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] text-center p-8">
        <DialogHeader>
          <DialogTitle className="text-4xl font-bold mb-4">Welcome {firstName}!</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center space-y-4">
          <Image
            src="/celebration.png" // Updated image source
            alt="Celebration"
            width={150}
            height={150}
            className="mb-4"
          />
          <DialogDescription className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Congratulations!
          </DialogDescription>
          <p className="text-gray-600 dark:text-gray-400">You have successfully registered in OH!PLUS.</p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-6" onClick={handleStart}>
            START
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
