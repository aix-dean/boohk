"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, X, Minimize2, Maximize2 } from "lucide-react"
import { AssistantMessage } from "./assistant-message"
import type { ChatMessage } from "@/lib/gemini-service"
import { usePathname } from "next/navigation"

interface AssistantChatProps {
  onClose: () => void
  onMinimize: () => void
  isMinimized: boolean
}

export function AssistantChat({ onClose, onMinimize, isMinimized }: AssistantChatProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      parts: "Hello! I'm your OOH Assistant. How can I help you with the OOH Operator platform today?",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Get current page context
  const getCurrentPageContext = () => {
    const pathSegments = pathname.split("/").filter(Boolean)
    if (pathSegments.length === 0) return "Home"

    // Map path to user-friendly names
    const pageMap: Record<string, string> = {
      sales: "Sales",
      logistics: "Logistics",
      cms: "Content Management",
      admin: "Administration",
      settings: "Settings",
      help: "Help & Documentation",
      dashboard: "Dashboard",
      planner: "Planner",
      clients: "Clients",
      bookings: "Bookings",
      products: "Products",
      inventory: "Inventory",
    }

    return pathSegments.map((segment) => pageMap[segment] || segment).join(" > ")
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: "user",
      parts: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          currentPage: getCurrentPageContext(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()
      setMessages((prev) => [...prev, data.response])
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          parts: "I'm sorry, I encountered an error. Please try again later.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between bg-primary text-primary-foreground p-3 rounded-t-lg">
        <span className="font-medium">OOH Assistant</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground hover:bg-primary/90"
            onClick={onMinimize}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground hover:bg-primary/90"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-primary text-primary-foreground p-3 rounded-t-lg">
        <span className="font-medium">OOH Assistant</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground hover:bg-primary/90"
            onClick={onMinimize}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground hover:bg-primary/90"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-background">
        {messages.map((message, index) => (
          <AssistantMessage key={index} message={message} isLoading={isLoading && index === messages.length - 1} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={!input.trim() || isLoading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
