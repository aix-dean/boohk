"use client"

import { useState, useEffect } from "react"
import { AssistantChatOptimized } from "./assistant-chat-optimized"
import { usePathname } from "next/navigation"

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const pathname = usePathname()

  // Close the chat when navigating to a different page
  useEffect(() => {
    setIsOpen(false)
    setIsMinimized(false)
  }, [pathname])

  // Listen for custom event to open the assistant
  useEffect(() => {
    const handleOpenAssistant = () => {
      setIsOpen(true)
      setIsMinimized(false)
    }

    window.addEventListener("openOhliverAssistant", handleOpenAssistant)

    return () => {
      window.removeEventListener("openOhliverAssistant", handleOpenAssistant)
    }
  }, [])

  // The floating button is removed. The chat will only appear if `isOpen` is true,
  // which can be triggered by the `openOhliverAssistant` event.
  if (!isOpen) {
    return null // Render nothing if the chat is not open
  }

  return (
    <div
      className={`fixed bottom-4 right-4 w-80 ${
        isMinimized ? "h-auto" : "h-96"
      } bg-background border rounded-lg shadow-xl overflow-hidden flex flex-col z-50`}
    >
      <AssistantChatOptimized
        onClose={() => setIsOpen(false)}
        onMinimize={() => setIsMinimized(!isMinimized)}
        isMinimized={isMinimized}
      />
    </div>
  )
}
