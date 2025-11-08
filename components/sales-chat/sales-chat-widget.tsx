"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCircle, X, Send, Paperclip, Search, MoreHorizontal, Archive, Flag } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { salesChatService } from "@/lib/sales-chat-service"
import type { SalesThread, SalesMessage, ChatUser } from "@/lib/types/sales-chat"
import { formatDistanceToNow } from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface SalesChatWidgetProps {
  autoOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  hideToggleButton?: boolean // This prop is now effectively unused as the button is removed
}

export function SalesChatWidget({
  autoOpen = false,
  onOpenChange,
  hideToggleButton = false, // This prop is now effectively unused as the button is removed
}: SalesChatWidgetProps = {}) {
  const { user, userData } = useAuth()
  const [isOpen, setIsOpen] = useState(autoOpen)
  const [threads, setThreads] = useState<SalesThread[]>([])
  const [activeThread, setActiveThread] = useState<SalesThread | null>(null)
  const [messages, setMessages] = useState<SalesMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [customers, setCustomers] = useState<ChatUser[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [view, setView] = useState<"threads" | "customers" | "chat">("threads")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true)
    }
  }, [autoOpen, isOpen])

  // Load threads when component mounts
  useEffect(() => {
    if (!user || !isOpen) return

    const unsubscribe = salesChatService.listenToThreads(user.uid, (updatedThreads) => {
      setThreads(updatedThreads)
    })

    return unsubscribe
  }, [user, isOpen])

  // Load messages when active thread changes
  useEffect(() => {
    if (!activeThread) return

    const unsubscribe = salesChatService.listenToMessages(activeThread.id, (updatedMessages) => {
      setMessages(updatedMessages)
      // Mark messages as read
      if (user) {
        salesChatService.markMessagesAsRead(activeThread.id, user.uid)
      }
    })

    return unsubscribe
  }, [activeThread, user])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load customers
  useEffect(() => {
    if (!isOpen) return

    const loadCustomers = async () => {
      const customerList = await salesChatService.getSalesTeamMembers()
      setCustomers(customerList.filter((member) => member.id !== user?.uid))
    }

    loadCustomers()
  }, [isOpen, user])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeThread || !user) return

    setIsLoading(true)
    try {
      await salesChatService.sendMessage(activeThread.id, user.uid, newMessage.trim())
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !activeThread || !user) return

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      alert("File size must be less than 5MB")
      return
    }

    setIsLoading(true)
    try {
      await salesChatService.sendMessage(activeThread.id, user.uid, "", file)
    } catch (error) {
      console.error("Error uploading file:", error)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleStartChat = async (customer: ChatUser) => {
    if (!user) return

    try {
      const threadId = await salesChatService.createThread(user.uid, customer.id)
      const newThread = threads.find((t) => t.id === threadId)
      if (newThread) {
        setActiveThread(newThread)
        setView("chat")
      }
    } catch (error) {
      console.error("Error starting chat:", error)
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "destructive"
      case "high":
        return "orange"
      case "medium":
        return "blue"
      case "low":
        return "gray"
      default:
        return "gray"
    }
  }

  const getUnreadCount = () => {
    return threads.reduce((count, thread) => {
      // This is a simplified count - in real implementation, you'd track unread messages per thread
      return count
    }, 0)
  }

  const filteredThreads = threads.filter((thread) => {
    // Get the other participant (not the current user)
    const otherParticipant = thread.participants.find((p) => p !== user?.uid)
    const displayName = thread.receiver_name || "Customer"

    // Safely access thread.lastMessage.text if it's an object, otherwise use the string directly
    const lastMessageText =
      typeof thread.lastMessage === "object" && thread.lastMessage !== null && "text" in thread.lastMessage
        ? thread.lastMessage.text
        : String(thread.lastMessage || "")

    return (
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lastMessageText.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleToggle = () => {
    setIsOpen(!isOpen)
    onOpenChange?.(!isOpen)
  }

  return (
    <>
      {/* The floating button div has been completely removed from here. */}
      {/* Chat Dialog */}
      {isOpen && (
        <div className="fixed bottom-20 right-20 z-40 w-80 h-[28rem]">
          <Card className="h-full flex flex-col shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Customer Messages</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleToggle}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex space-x-2">
                <Button variant={view === "threads" ? "default" : "ghost"} size="sm" onClick={() => setView("threads")}>
                  Conversations
                </Button>
                <Button
                  variant={view === "customers" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("customers")}
                >
                  Customers
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden">
              {view === "threads" && (
                <ScrollArea className="h-full">
                  {filteredThreads.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No customer conversations yet</p>
                      <p className="text-sm">Start chatting with your customers</p>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {filteredThreads.map((thread) => (
                        <div
                          key={thread.id}
                          className={`p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                            activeThread?.id === thread.id ? "bg-accent" : ""
                          }`}
                          onClick={() => {
                            setActiveThread(thread)
                            setView("chat")
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={thread.receiver_photo_url || "/placeholder.svg"} />
                              <AvatarFallback>{thread.receiver_name?.charAt(0) || "C"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium truncate">{thread.receiver_name}</p>
                                <div className="flex items-center space-x-1">
                                  {thread.priority && (
                                    <Badge variant={getPriorityColor(thread.priority) as any} className="text-xs">
                                      {thread.priority}
                                    </Badge>
                                  )}
                                  {thread.lastMessageTimestamp && thread.lastMessageTimestamp.toDate && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(thread.lastMessageTimestamp.toDate(), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {typeof thread.lastMessage === "object" &&
                                thread.lastMessage !== null &&
                                "text" in thread.lastMessage
                                  ? thread.lastMessage.text
                                  : String(thread.lastMessage || "")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}

              {view === "customers" && (
                <ScrollArea className="h-full">
                  <div className="space-y-1 p-2">
                    {filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleStartChat(customer)}
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={customer.photoUrl || "/placeholder.svg"} />
                            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.role || "Customer"}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-green-400 rounded-full" />
                            <span className="text-xs text-muted-foreground">Online</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {view === "chat" && activeThread && (
                <div className="h-full flex flex-col">
                  {/* Chat Header */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => setView("threads")}>
                        ←
                      </Button>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={activeThread.receiver_photo_url || "/placeholder.svg"} />
                        <AvatarFallback>{activeThread.receiver_name?.charAt(0) || "C"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{activeThread.receiver_name}</p>
                        <p className="text-xs text-muted-foreground">Customer</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => salesChatService.archiveThread(activeThread.id)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Flag className="h-4 w-4 mr-2" />
                          Set Priority
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.senderId === user?.uid ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.senderId === user?.uid ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            {message.senderId !== user?.uid && (
                              <p className="text-xs font-medium mb-1">
                                {message.senderId === activeThread.receiverId
                                  ? activeThread.receiver_name
                                  : threads.find((t) => t.id === message.threadId)?.receiver_name || "Customer"}
                              </p>
                            )}

                            {message.fileUrl && message.fileType?.startsWith("image/") && (
                              <img
                                src={message.fileUrl || "/placeholder.svg"}
                                alt={message.fileName || "Image"}
                                className="max-w-48 h-auto rounded mb-2 cursor-pointer"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
                              />
                            )}

                            {message.fileUrl && !message.fileType?.startsWith("image/") && (
                              <div className="flex items-center space-x-2 mb-2 p-2 bg-background/20 rounded">
                                <Paperclip className="h-4 w-4" />
                                <div className="flex-1">
                                  <p className="text-sm">{message.fileName}</p>
                                  <p className="text-xs opacity-70">
                                    {message.fileSize ? (message.fileSize / 1024).toFixed(1) + " KB" : ""}
                                  </p>
                                </div>
                                <Button size="sm" variant="secondary" asChild>
                                  <a href={message.fileUrl} download>
                                    Download
                                  </a>
                                </Button>
                              </div>
                            )}

                            {message.text && (
                              <p className="text-sm">
                                {typeof message.text === "object" && message.text !== null && "text" in message.text
                                  ? String(message.text.text)
                                  : String(message.text)}
                              </p>
                            )}

                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs opacity-70">
                                {message.timestamp && message.timestamp.toDate
                                  ? formatDistanceToNow(message.timestamp.toDate(), { addSuffix: true })
                                  : "Just now"}
                              </span>
                              {message.senderId === user?.uid && (
                                <span className="text-xs opacity-70">{message.read ? "✓✓" : "✓"}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-3 border-t">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message to customer..."
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        disabled={isLoading}
                      />
                      <Button onClick={handleSendMessage} disabled={isLoading || !newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xlsx,.ppt,.pptx"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
