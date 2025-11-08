"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Send,
  Star,
  Sparkles,
  MessageCircle,
  Zap,
  BookOpen,
  HelpCircle,
  ArrowRight,
  Bot,
  User,
  Mic,
  ImageIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { chatDB } from "@/lib/chat-database-service"
import type { ChatMessage } from "@/lib/gemini-service"
import { useAuth } from "@/contexts/auth-context"
import Image from "next/image"

const suggestedQuestions = [
  "How do I create a new proposal?",
  "How do I send quotations via email?",
  "How do I generate a quotation from a proposal?",
  "How do I manage client information?",
  "How do I track quotation responses?",
  "How do I create service assignments?",
  "How do I schedule content with weather data?",
  "How do I use the sales chat system?",
  "How do I configure user permissions?",
  "How do I monitor site performance?",
  "How do I share proposals with clients?",
  "How do I download quotations as PDF?",
]

const quickActions = [
  {
    title: "Sales Dashboard",
    description: "View sales metrics and performance analytics",
    href: "/sales/dashboard",
    icon: "📊",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Create Proposal",
    description: "Generate comprehensive business proposals",
    href: "/sales/proposals",
    icon: "📋",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    title: "Send Quotation",
    description: "Email professional quotations to clients",
    href: "/sales/quotation-requests",
    icon: "📧",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    title: "Service Assignments",
    description: "Manage logistics and maintenance tasks",
    href: "/logistics/assignments",
    icon: "🚚",
    gradient: "from-orange-500 to-red-500",
  },
]

const recentUpdates = [
  {
    title: "Enhanced Proposal System",
    description: "Create detailed proposals and generate quotations with email delivery",
    badge: "New",
    badgeColor: "bg-gradient-to-r from-green-500 to-emerald-500",
  },
  {
    title: "Full-Screen Chat Interface",
    description: "Dedicated chat page for seamless OHLIVER AI interactions",
    badge: "Enhanced",
    badgeColor: "bg-gradient-to-r from-blue-500 to-cyan-500",
  },
  {
    title: "Weather-Integrated Planning",
    description: "Content and logistics planning with real-time weather data",
    badge: "Enhanced",
    badgeColor: "bg-gradient-to-r from-purple-500 to-pink-500",
  },
]

const helpCategories = [
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: "Sales & Proposals",
    description: "Proposals, quotations, client management, and team chat",
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Logistics Operations",
    description: "Service assignments, site monitoring, and weather integration",
    color: "text-orange-500",
    bgColor: "bg-orange-50",
  },
  {
    icon: <BookOpen className="h-6 w-6" />,
    title: "Content Management",
    description: "Publishing schedules, content orders, and weather-based planning",
    color: "text-green-500",
    bgColor: "bg-green-50",
  },
  {
    icon: <HelpCircle className="h-6 w-6" />,
    title: "System Administration",
    description: "User management, access control, and system configuration",
    color: "text-purple-500",
    bgColor: "bg-purple-50",
  },
]

export default function AIAssistantPage() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      parts:
        "Hello! I'm OHLIVER, your Boohk AI Assistant. I'm here to help you navigate the platform, answer questions, and guide you through any tasks. What would you like to know?",
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
        setConversationId(data.conversationId)
        setIsInitialized(true)
        return data.conversationId
      }
    } catch (error) {
      console.error("Error initializing conversation:", error)
    }
    return null
  }, [conversationId, isInitialized, getCurrentPageContext, sessionId, userId, userEmail])

  // Background save function (non-blocking)
  const saveMessageInBackground = useCallback(
    async (convId: string, role: "user" | "model", content: string, responseTime?: number) => {
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
        console.error("Background save failed:", error)
      })
    },
    [getCurrentPageContext],
  )

  const handleSendMessage = useCallback(
    async (messageText?: string) => {
      const userInput = messageText || input.trim()
      if (!userInput || isAiThinking) return

      // Clear input if using the input field
      if (!messageText) setInput("")
      setIsAiThinking(true)

      // Add user message and loading message
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
              messages: [...messages, { role: "user", parts: userInput }],
              currentPage: getCurrentPageContext(),
              userId,
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

        // Replace loading message with actual AI response
        setMessages((prev) => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            role: "model",
            parts: data.response.parts,
            isLoading: false,
          }
          return newMessages
        })

        // Background save
        if (convId) {
          saveMessageInBackground(convId, "user", userInput)
          saveMessageInBackground(convId, "model", data.response.parts, responseTime)
        }
      } catch (error) {
        console.error("Error sending message:", error)

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
      } finally {
        setIsAiThinking(false)
      }
    },
    [
      input,
      isAiThinking,
      messages,
      initializeConversation,
      getCurrentPageContext,
      saveMessageInBackground,
      userId,
      userEmail,
      userName,
    ],
  )

  // Handle conversation rating
  const handleRating = useCallback(
    async (stars: number) => {
      setRating(stars)
      setShowRating(false)

      if (conversationId) {
        chatDB.rateConversation(conversationId, stars).catch((error) => {
          console.error("Error rating conversation:", error)
        })
      }
    },
    [conversationId],
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

  // Show rating after multiple messages
  useEffect(() => {
    if (messages.length >= 6 && !showRating && rating === 0) {
      setShowRating(true)
    }
  }, [messages.length, showRating, rating])

  // Initialize conversation in background when component mounts
  useEffect(() => {
    if (userId && userEmail) {
      initializeConversation().then((convId) => {
        if (convId && messages.length > 0 && messages[0].role === "model") {
          saveMessageInBackground(convId, "model", messages[0].parts)
        }
      })
    }
  }, [userId, userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header with Glassmorphism */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 border-b border-white/20 shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-0.5">
                  <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center">
                    <Image src="/ohliver-mascot.png" alt="OHLIVER" width={40} height={40} className="rounded-xl" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent flex items-center gap-2">
                  OHLIVER AI Assistant
                  <Sparkles className="h-6 w-6 text-blue-500 animate-pulse" />
                </h1>
                <p className="text-gray-600 font-medium">Your intelligent Boohk companion</p>
              </div>
            </div>
            {userName !== "Anonymous User" && (
              <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/30">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Welcome back,</p>
                  <p className="text-sm font-semibold text-gray-900">{userName.split(" ")[0]}!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Recent Updates */}
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/30 shadow-xl">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Latest Updates
              </h3>
              <div className="space-y-3">
                {recentUpdates.map((update, index) => (
                  <div key={index} className="group">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-white text-xs px-2 py-1 ${update.badgeColor}`}>{update.badge}</Badge>
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                      {update.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">{update.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/30 shadow-xl">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Quick Actions
              </h3>
              <div className="space-y-3">
                {quickActions.map((action, index) => (
                  <a key={index} href={action.href} className="block group">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-r ${action.gradient} text-white transform group-hover:scale-105 transition-all duration-200 shadow-lg`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{action.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{action.title}</h4>
                          <p className="text-xs opacity-90">{action.description}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-12rem)] bg-white/70 backdrop-blur-sm border-white/30 shadow-xl flex flex-col overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 1 && (
                  <div className="space-y-8">
                    {/* Welcome Message */}
                    <div className="flex justify-start">
                      <div className="flex items-start gap-4 max-w-4xl">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl px-6 py-4 shadow-sm border border-blue-100">
                          <p className="text-gray-800 leading-relaxed">{messages[0].parts}</p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Suggestions */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-blue-500" />
                        Popular Questions
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {suggestedQuestions.slice(0, 8).map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSendMessage(suggestion)}
                            className="text-left p-4 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md transition-all duration-200 text-sm group"
                            disabled={isAiThinking}
                          >
                            <div className="flex items-center justify-between">
                              <span className="group-hover:text-blue-700 transition-colors">{suggestion}</span>
                              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Help Categories */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-purple-500" />I can help you with
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {helpCategories.map((category, index) => (
                          <div key={index} className="group">
                            <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                              <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${category.bgColor}`}>
                                  <div className={category.color}>{category.icon}</div>
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                                    {category.title}
                                  </h4>
                                  <p className="text-sm text-gray-600 leading-relaxed">{category.description}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Chat Messages */}
                {messages.slice(1).map((message, index) => (
                  <div
                    key={`message-${index}-${message.role}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex items-start gap-4 max-w-4xl ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      {message.role === "model" && (
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                      )}
                      {message.role === "user" && (
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-6 py-4 shadow-sm max-w-2xl ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                            : "bg-white/80 backdrop-blur-sm border border-gray-200"
                        }`}
                      >
                        {message.isLoading ? (
                          <div className="flex items-center gap-2 py-2">
                            <div className="flex gap-1">
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
                            <span className="text-sm opacity-70">OHLIVER is thinking...</span>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {message.parts.split("\n").map((part, i) => (
                              <p key={i} className={i > 0 ? "mt-3" : ""}>
                                {part}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Rating */}
                {showRating && (
                  <div className="flex justify-start">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200 max-w-md">
                      <p className="text-gray-700 mb-4 font-medium">How was this conversation?</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((stars) => (
                          <Button
                            key={stars}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRating(stars)}
                            className="p-2 hover:bg-yellow-50"
                          >
                            <Star
                              className={`h-5 w-5 transition-colors ${
                                stars <= rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300 hover:text-yellow-300"
                              }`}
                            />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Modern Input Area */}
              <div className="border-t border-gray-200/50 bg-white/50 backdrop-blur-sm p-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Ask OHLIVER anything about Boohk..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={isAiThinking}
                      className="h-12 pl-4 pr-12 text-base bg-white/80 backdrop-blur-sm border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                        <Mic className="h-4 w-4 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || isAiThinking}
                    className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  OHLIVER can help with platform navigation, feature explanations, and step-by-step guidance
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
