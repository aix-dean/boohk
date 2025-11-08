"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface CongratulationsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CongratulationsDialog({ isOpen, onClose }: CongratulationsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-white rounded-lg shadow-xl border-0 p-0">
        <div className="text-center p-8 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Congratulations!</h2>

          <div className="flex justify-center">
            <div className="relative">
              {/* Party horn/megaphone */}
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-lg transform rotate-12 flex items-center justify-center shadow-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-sm transform -rotate-12"></div>
              </div>

              {/* Confetti elements */}
              <div className="absolute -top-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
              <div
                className="absolute -top-1 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="absolute top-1 -left-3 w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="absolute -bottom-1 right-1 w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.3s" }}
              ></div>
              <div
                className="absolute bottom-2 -right-3 w-3 h-3 bg-pink-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.4s" }}
              ></div>

              {/* Additional confetti */}
              <div className="absolute -top-3 left-6 w-1 h-4 bg-green-500 rounded-full transform rotate-45 animate-pulse"></div>
              <div
                className="absolute top-6 -left-2 w-1 h-3 bg-yellow-500 rounded-full transform -rotate-12 animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="absolute -bottom-2 left-8 w-1 h-3 bg-blue-500 rounded-full transform rotate-45 animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          </div>

          <p className="text-gray-700 text-lg font-medium">
            You have successfully
            <br />
            sent a report!
          </p>

          <Button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-medium transition-colors"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
