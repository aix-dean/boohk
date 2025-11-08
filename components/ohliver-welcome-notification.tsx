"use client"

import { useState } from "react"
import { X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

interface OhliverWelcomeNotificationProps {
  onDismiss?: () => void
  onOpenAssistant?: () => void
  delay?: number
}

export function OhliverWelcomeNotification({
  onDismiss,
  onOpenAssistant,
  delay = 1000,
}: OhliverWelcomeNotificationProps) {
  const [isVisible, setIsVisible] = useState(false) // Set to false by default
  const [isExiting, setIsExiting] = useState(false)

  // The useEffect that controlled visibility and auto-dismissal was removed in the previous turn.
  // This component will now only be visible if `isVisible` is explicitly set to true elsewhere,
  // or if it's rendered with a prop that forces visibility.
  // As `showWelcome` in SalesDashboard is now always false, this component will not render.

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      if (onDismiss) onDismiss()
    }, 300) // Animation duration
  }

  const handleOpenAssistant = () => {
    handleDismiss()
    if (onOpenAssistant) onOpenAssistant()
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed bottom-20 right-4 max-w-xs bg-white rounded-lg shadow-lg p-4 border border-blue-100 z-40 transition-all duration-300 ${
        isExiting ? "opacity-0 transform translate-y-4" : "opacity-100 transform translate-y-0"
      }`}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Image src="/ohliver-mascot.png" alt="OHLIVER" width={48} height={48} className="rounded-full" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">OHLIVER is here to help!</h4>
          <p className="text-sm text-gray-600 mt-1">
            Need assistance with Boohk? I'm your AI assistant, ready to answer questions and help you navigate the
            platform.
          </p>
          <Button onClick={handleOpenAssistant} size="sm" className="mt-3 bg-blue-500 hover:bg-blue-600">
            Ask OHLIVER
          </Button>
        </div>
      </div>

      <div className="absolute -left-2 bottom-4 w-4 h-4 bg-white border-l border-b border-blue-100 transform rotate-45"></div>
    </div>
  )
}
