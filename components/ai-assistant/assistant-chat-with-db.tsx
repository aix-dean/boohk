"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, X, Minimize2, Maximize2, Star } from "lucide-react"
import { AssistantMessage } from "./assistant-message"
import type { ChatMessage } from "@/lib/gemini-service"
import { usePathname } from "next/navigation"
import { chatDB } from "@/lib/chat-database-service"

interface AssistantChatProps {
  onClose: () => void
  onMinimize: () => void
  isMinimized: boolean
}

export function AssistantChatWithDB({ onClose, onMinimize, isMinimized }: AssistantChatProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      parts: "Hello! I'm your OOH Assistant. How can I help you with the OOH Operator platform today?",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sessionId] = useState(() => chatDB.generateSessionId())
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Mock user data - in production, get from auth context
  const userId = "user_123" // Replace with actual user ID
  const userEmail = "user@example.com" // Replace with actual user email

  // Get current page context
  const getCurrentPageContext = () => {
    const pathSegments = pathname.split("/").filter(Boolean)
    if (pathSegments.length === 0) return "Home"

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

  // Initialize conversation when first message is sent
  const initializeConversation = async () => {
    if (!conversationId) {
      try {
        console.log("🔄 Creating new conversation...")
        const response = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            userEmail,
            currentPage: getCurrentPageContext(),
            sessionId,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log("✅ Conversation created:", data.conversationId)
          setConversationId(data.conversationId)
          return data.conversationId
        } else {
          console.error("❌ Failed to create conversation:", await response.text())
        }
      } catch (error) {
        console.error("❌ Error initializing conversation:", error)
      }
    }
    return conversationId
  }

  // Save message to database
  const saveMessage = async (convId: string, role: "user" | "model", content: string, responseTime?: number) => {
    try {
      console.log(`💾 Saving ${role} message to conversation ${convId}...`)
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          role,
          content,
          currentPage: getCurrentPageContext(),
          responseTime,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ ${role} message saved with ID:`, data.messageId)
        return data.messageId
      } else {
        console.error(`❌ Failed to save ${role} message:`, await response.text())
      }
    } catch (error) {
      console.error(`❌ Error saving ${role} message:`, error)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: "user",
      parts: input,
    }

    console.log("👤 User message:", input)
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Initialize conversation if needed
    const convId = await initializeConversation()

    // 🔥 SAVE USER MESSAGE FIRST
    if (convId) {
      console.log("💾 Saving user message to database...")
      await saveMessage(convId, "user", input)
    } else {
      console.error("❌ No conversation ID available to save user message")
    }

    const startTime = Date.now()

    try {
      console.log("🤖 Sending request to AI assistant...")
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          currentPage: getCurrentPageContext(),
          conversationId: convId, // Pass the conversation ID to the API
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()
      const responseTime = Date.now() - startTime

      console.log("✅ AI response received:", data.response.parts.substring(0, 100) + "...")
      setMessages((prev) => [...prev, data.response])

      // 🔥 SAVE AI RESPONSE (handled in API route, but backup here)
      if (convId && !data.savedToDatabase) {
        console.log("💾 Backup: Saving AI response to database...")
        await saveMessage(convId, "model", data.response.parts, responseTime)
      } else if (data.savedToDatabase) {
        console.log("✅ AI response already saved by API route")
      }
    } catch (error) {
      console.error("❌ Error sending message:", error)
      const errorMessage = {
        role: "model" as const,
        parts: "I'm sorry, I encountered an error. Please try again later.",
      }
      setMessages((prev) => [...prev, errorMessage])

      // Save error message
      if (convId) {
        await saveMessage(convId, "model", errorMessage.parts)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle conversation rating
  const handleRating = async (stars: number) => {
    setRating(stars)
    if (conversationId) {
      try {
        console.log(`⭐ Rating conversation ${stars} stars...`)
        await chatDB.rateConversation(conversationId, stars)
        console.log("✅ Conversation rated successfully")
      } catch (error) {
        console.error("❌ Error rating conversation:", error)
      }
    }
    setShowRating(false)
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

  // Show rating after 3+ messages
  useEffect(() => {
    if (messages.length >= 6 && !showRating && rating === 0) {
      setShowRating(true)
    }
  }, [messages.length, showRating, rating])

  // Save welcome message when component mounts
  useEffect(() => {
    const saveWelcomeMessage = async () => {
      const convId = await initializeConversation()
      if (convId && messages.length > 0 && messages[0].role === "model") {
        console.log("💾 Saving welcome message...")
        await saveMessage(convId, "model", messages[0].parts)
      }
    }

    saveWelcomeMessage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

        {showRating && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm mb-2">How was this conversation?</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((stars) => (
                <Button key={stars} variant="ghost" size="sm" onClick={() => handleRating(stars)} className="p-1">
                  <Star
                    className={`h-4 w-4 ${stars <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                  />
                </Button>
              ))}
            </div>
          </div>
        )}

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
