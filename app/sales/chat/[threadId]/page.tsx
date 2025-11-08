"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Send,
  Paperclip,
  MoreVertical,
  Archive,
  AlertTriangle,
  Flag,
  Trash2,
  Phone,
  Video,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { salesChatService } from "@/lib/sales-chat-service"
import type { SalesMessage, SalesThread } from "@/lib/types/sales-chat"
import { formatDistanceToNow, format } from "date-fns"

export default function ChatThreadPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const threadId = params.threadId as string

  const [messages, setMessages] = useState<SalesMessage[]>([])
  const [thread, setThread] = useState<SalesThread | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasMarkedAsRead = useRef(false)

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Listen to messages
  useEffect(() => {
    if (!threadId || !user) return

    console.log("Setting up message listener for thread:", threadId)

    const unsubscribe = salesChatService.listenToMessages(threadId, (updatedMessages) => {
      console.log("Messages updated:", updatedMessages.length)
      setMessages(updatedMessages)
      setIsLoading(false)

      // Mark messages as read when they are loaded and user is viewing the conversation
      if (!hasMarkedAsRead.current && updatedMessages.length > 0) {
        console.log("Marking messages as read for the first time")
        salesChatService.markMessagesAsRead(threadId, user.uid)
        hasMarkedAsRead.current = true
      }
    })

    return unsubscribe
  }, [threadId, user])

  // Get thread info
  useEffect(() => {
    if (!threadId || !user) return

    const unsubscribe = salesChatService.listenToThreads(user.uid, (threads) => {
      const currentThread = threads.find((t) => t.id === threadId)
      if (currentThread) {
        setThread(currentThread)
      }
    })

    return unsubscribe
  }, [threadId, user])

  // Mark messages as read when new messages arrive (from other users)
  useEffect(() => {
    if (!threadId || !user || messages.length === 0) return

    const unreadMessages = messages.filter((msg) => msg.senderId !== user.uid && !msg.read)

    if (unreadMessages.length > 0) {
      console.log("Found new unread messages, marking as read:", unreadMessages.length)
      salesChatService.markMessagesAsRead(threadId, user.uid)
    }
  }, [messages, threadId, user])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || isSending) return

    setIsSending(true)
    try {
      await salesChatService.sendMessage(threadId, user.uid, newMessage.trim())
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsSending(true)
    try {
      await salesChatService.sendMessage(threadId, user.uid, "", file)
    } catch (error) {
      console.error("Error uploading file:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleArchive = async () => {
    try {
      await salesChatService.archiveThread(threadId)
      router.push("/sales/chat")
    } catch (error) {
      console.error("Error archiving thread:", error)
    }
  }

  const handlePriorityChange = async (priority: "low" | "medium" | "high" | "urgent") => {
    try {
      await salesChatService.updateThreadPriority(threadId, priority)
    } catch (error) {
      console.error("Error updating priority:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-medium">Conversation not found</p>
          <Button onClick={() => router.push("/sales/chat")} className="mt-4">
            Back to Chat
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <Card className="flex-1 flex flex-col">
        {/* Header */}
        <CardHeader className="flex flex-row items-center space-y-0 p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales/chat")} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <Avatar className="h-10 w-10 mr-3">
            <AvatarImage src={thread.receiver_photo_url || "/placeholder.svg"} />
            <AvatarFallback>{thread.receiver_name?.charAt(0) || "C"}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold">{thread.receiver_name || "Customer"}</h3>
              {thread.priority && (
                <Badge
                  variant={
                    thread.priority === "urgent"
                      ? "destructive"
                      : thread.priority === "high"
                        ? "destructive"
                        : thread.priority === "medium"
                          ? "default"
                          : "secondary"
                  }
                  className="text-xs"
                >
                  {thread.priority}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {thread.projectName ? `Inquiry: ${thread.projectName}` : "Customer conversation"}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Video className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlePriorityChange("urgent")}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Mark as Urgent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePriorityChange("high")}>
                  <Flag className="h-4 w-4 mr-2" />
                  High Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePriorityChange("medium")}>
                  <Flag className="h-4 w-4 mr-2" />
                  Medium Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePriorityChange("low")}>
                  <Flag className="h-4 w-4 mr-2" />
                  Low Priority
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Conversation
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.senderId === user?.uid
                  const showTimestamp =
                    index === 0 ||
                    (messages[index - 1] &&
                      message.timestamp?.toDate?.() &&
                      messages[index - 1].timestamp?.toDate?.() &&
                      message.timestamp.toDate().getTime() - messages[index - 1].timestamp.toDate().getTime() > 300000) // 5 minutes

                  return (
                    <div key={message.id}>
                      {showTimestamp && message.timestamp?.toDate && (
                        <div className="text-center my-4">
                          <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                            {format(message.timestamp.toDate(), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      )}

                      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] ${isOwn ? "order-2" : "order-1"}`}>
                          {message.senderId !== user?.uid && (
                            <div className="flex items-center space-x-2 mb-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={thread.receiver_photo_url || "/placeholder.svg"} />
                                <AvatarFallback>{thread.receiver_name?.charAt(0) || "C"}</AvatarFallback>
                              </Avatar>
                              <p className="text-xs font-medium">
                                {message.senderId === thread.receiverId ? thread.receiver_name : "Customer"}
                              </p>
                            </div>
                          )}
                          <div
                            className={`rounded-lg px-3 py-2 ${
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            {message.fileUrl ? (
                              <div className="space-y-2">
                                {message.text && <p className="text-sm">{message.text}</p>}

                                {/* Image Preview */}
                                {message.fileType?.startsWith("image/") && (
                                  <div className="relative">
                                    <img
                                      src={message.fileUrl || "/placeholder.svg"}
                                      alt={message.fileName || "Image"}
                                      className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(message.fileUrl, "_blank")}
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none"
                                      }}
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                      {message.fileName}
                                    </div>
                                  </div>
                                )}

                                {/* Video Preview */}
                                {message.fileType?.startsWith("video/") && (
                                  <div className="relative max-w-xs">
                                    <video controls className="w-full rounded-lg" preload="metadata">
                                      <source src={message.fileUrl} type={message.fileType} />
                                      Your browser does not support the video tag.
                                    </video>
                                    <div className="mt-1 text-xs opacity-70">{message.fileName}</div>
                                  </div>
                                )}

                                {/* Audio Preview */}
                                {message.fileType?.startsWith("audio/") && (
                                  <div className="space-y-2">
                                    <audio controls className="w-full max-w-xs">
                                      <source src={message.fileUrl} type={message.fileType} />
                                      Your browser does not support the audio tag.
                                    </audio>
                                    <div className="text-xs opacity-70">{message.fileName}</div>
                                  </div>
                                )}

                                {/* PDF Preview */}
                                {message.fileType === "application/pdf" && (
                                  <div className="border rounded-lg p-3 bg-background/10 max-w-xs">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">PDF</span>
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{message.fileName}</p>
                                        <p className="text-xs opacity-70">
                                          {message.fileSize
                                            ? `${(message.fileSize / 1024).toFixed(1)} KB`
                                            : "PDF Document"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex space-x-2">
                                      <Button size="sm" variant="secondary" asChild>
                                        <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                                          View
                                        </a>
                                      </Button>
                                      <Button size="sm" variant="outline" asChild>
                                        <a href={message.fileUrl} download>
                                          Download
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Other File Types */}
                                {!message.fileType?.startsWith("image/") &&
                                  !message.fileType?.startsWith("video/") &&
                                  !message.fileType?.startsWith("audio/") &&
                                  message.fileType !== "application/pdf" && (
                                    <div className="border rounded-lg p-3 bg-background/10 max-w-xs">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-8 h-8 bg-gray-500 rounded flex items-center justify-center">
                                          <Paperclip className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium">{message.fileName}</p>
                                          <p className="text-xs opacity-70">
                                            {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : "File"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-2">
                                        <Button size="sm" variant="secondary" asChild>
                                          <a href={message.fileUrl} download>
                                            Download
                                          </a>
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <p className="text-sm">{message.text}</p>
                            )}
                          </div>

                          <div
                            className={`flex items-center mt-1 space-x-1 ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            <span className="text-xs text-muted-foreground">
                              {message.timestamp?.toDate &&
                                formatDistanceToNow(message.timestamp.toDate(), { addSuffix: true })}
                            </span>
                            {isOwn && (
                              <span className="text-xs text-muted-foreground">{message.read ? "Read" : "Sent"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex items-center space-x-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="*/*" />

            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
              <Paperclip className="h-4 w-4" />
            </Button>

            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1"
            />

            <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isSending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
