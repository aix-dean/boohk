"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, X, Minimize2, Maximize2, Star } from "lucide-react"
import { usePathname } from "next/navigation"
import { chatDB } from "@/lib/chat-database-service"
import type { ChatMessage } from "@/lib/gemini-service"
import { useAuth } from "@/contexts/auth-context"
import Image from "next/image"

interface AssistantChatProps {
  onClose: () => void
  onMinimize: () => void
  isMinimized: boolean
}

export function AssistantChatOptimized({ onClose, onMinimize, isMinimized }: AssistantChatProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      parts: "Hello! I'm your OH Plus Assistant. How can I help you with the OH Plus platform today?",
    },
  ])
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sessionId] = useState(() => chatDB.generateSessionId())
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const [isInitialized, setIsInitialized] = useState(false)

  // Get authenticated user data from auth context
  const { user, userData } = useAuth()

  // Use actual user data or fallback for unauthenticated users
  const userId = user?.uid || userData?.uid || "anonymous"
  const userEmail = user?.email || userData?.email || "anonymous@example.com"
  const userName = userData?.display_name || userData?.first_name || "Anonymous User"

  console.log("🔐 Using authenticated user:", { userId, userEmail, userName })

  // Get current page context
  const getCurrentPageContext = useCallback(() => {
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
  }, [pathname])

  // Initialize conversation once and cache it
  const initializeConversation = useCallback(async () => {
    if (conversationId || isInitialized) return conversationId

    try {
      console.log("🔄 Creating conversation for user:", { userId, userEmail })

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
        setIsInitialized(true)
        return data.conversationId
      } else {
        console.error("❌ Failed to create conversation:", response.status)
      }
    } catch (error) {
      console.error("❌ Error initializing conversation:", error)
    }
    return null
  }, [conversationId, isInitialized, getCurrentPageContext, sessionId, userId, userEmail])

  // Background save function (non-blocking)
  const saveMessageInBackground = useCallback(
    async (convId: string, role: "user" | "model", content: string, responseTime?: number) => {
      console.log("💾 Saving message for user:", { userId, userEmail, role, content: content.substring(0, 50) + "..." })

      // Fire and forget - don't await this
      fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          role,
          content,
          currentPage: getCurrentPageContext(),
          responseTime,
        }),
      }).catch((error) => {
        console.error("❌ Background save failed:", error)
      })
    },
    [getCurrentPageContext, userId, userEmail],
  )

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isAiThinking) return

    const userInput = input.trim()
    console.log("🚀 Sending message from user:", { userId, userEmail, message: userInput })

    // STEP 1: IMMEDIATELY clear input
    setInput("")
    setIsAiThinking(true)

    // STEP 2: Add both user message AND loading message in a single state update
    // This prevents React batching from delaying the loading indicator
    setMessages((prev) => {
      const userMessage: ChatMessage = {
        role: "user",
        parts: userInput,
      }

      const loadingMessage: ChatMessage = {
        role: "model",
        parts: "",
        isLoading: true,
      }

      console.log("✅ Adding user message AND loading indicator simultaneously")
      return [...prev, userMessage, loadingMessage]
    })

    const startTime = Date.now()

    try {
      // Start conversation initialization and AI request in parallel
      const [convId, aiResponse] = await Promise.all([
        initializeConversation(),
        fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Use messages without the loading message
            messages: [...messages, { role: "user", parts: userInput }],
            currentPage: getCurrentPageContext(),
            userId, // Include user context for AI
            userEmail,
            userName,
          }),
        }),
      ])

      if (!aiResponse.ok) {
        throw new Error("Failed to get AI response")
      }

      const data = await aiResponse.json()
      const responseTime = Date.now() - startTime

      console.log("🤖 Got AI response:", data.response.parts.substring(0, 50) + "...")

      // STEP 3: Replace loading message with actual AI response
      setMessages((prev) => {
        const newMessages = [...prev]
        // Replace the last message (loading) with the actual response
        newMessages[newMessages.length - 1] = {
          role: "model",
          parts: data.response.parts,
          isLoading: false,
        }
        console.log("✅ Replaced loading with AI response")
        return newMessages
      })

      // STEP 4: Background save - Don't wait for database operations
      if (convId) {
        console.log("💾 Saving conversation messages for user:", { userId, userEmail, convId })
        // Save both messages in background (fire and forget)
        saveMessageInBackground(convId, "user", userInput)
        saveMessageInBackground(convId, "model", data.response.parts, responseTime)
      }
    } catch (error) {
      console.error("❌ Error sending message:", error)

      // Replace loading message with error message
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          role: "model",
          parts: "I'm sorry, I encountered an error. Please try again later.",
          isLoading: false,
        }
        return newMessages
      })

      // Save error message in background
      const convId = await initializeConversation()
      if (convId) {
        saveMessageInBackground(convId, "model", "I'm sorry, I encountered an error. Please try again later.")
      }
    } finally {
      setIsAiThinking(false)
    }
  }, [
    input,
    isAiThinking,
    messages,
    initializeConversation,
    getCurrentPageContext,
    saveMessageInBackground,
    userId,
    userEmail,
    userName,
  ])

  // Handle conversation rating (also non-blocking)
  const handleRating = useCallback(
    async (stars: number) => {
      setRating(stars)
      setShowRating(false)

      console.log("⭐ Rating conversation:", { userId, userEmail, conversationId, rating: stars })

      // Background save - don't wait
      if (conversationId) {
        chatDB.rateConversation(conversationId, stars).catch((error) => {
          console.error("❌ Error rating conversation:", error)
        })
      }
    },
    [conversationId, userId, userEmail],
  )

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle Enter key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    },
    [handleSendMessage],
  )

  // Show rating after 3+ messages
  useEffect(() => {
    if (messages.length >= 6 && !showRating && rating === 0) {
      setShowRating(true)
    }
  }, [messages.length, showRating, rating])

  // Initialize conversation in background when component mounts
  useEffect(() => {
    // Only initialize if we have user data
    if (userId && userEmail) {
      console.log("🔄 Initializing conversation for authenticated user:", { userId, userEmail })
      // Don't wait for this - just start it in background
      initializeConversation().then((convId) => {
        if (convId && messages.length > 0 && messages[0].role === "model") {
          // Save welcome message in background
          saveMessageInBackground(convId, "model", messages[0].parts)
        }
      })
    }
  }, [userId, userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between bg-primary text-primary-foreground p-3 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Image src="/ohliver-mascot.png" alt="OHLIVER" width={24} height={24} className="rounded-full" />
          <span className="font-medium">OH Plus AI Assistant</span>
        </div>
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
        <div className="flex items-center gap-2">
          <Image src="/ohliver-mascot.png" alt="OHLIVER" width={24} height={24} className="rounded-full" />
          <span className="font-medium">OH Plus AI Assistant</span>
        </div>
        {/* Show user info if authenticated */}
        {userName !== "Anonymous User" && <span className="text-xs opacity-75">Hi, {userName.split(" ")[0]}!</span>}
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
          <div
            key={`message-${index}-${message.role}`}
            className={`flex w-full items-start gap-2 py-2 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`flex max-w-[80%] flex-col gap-1 rounded-lg px-4 py-2 ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-1 py-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-current"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-current"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-current"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">
                  {message.parts.split("\n").map((part, i) => (
                    <p key={i} className={i > 0 ? "mt-2" : ""}>
                      {part}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
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
            disabled={isAiThinking}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={!input.trim() || isAiThinking} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
