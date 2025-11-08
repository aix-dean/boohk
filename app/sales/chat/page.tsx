"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCircle, Search } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { salesChatService } from "@/lib/sales-chat-service"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import type { SalesThread } from "@/lib/types/sales-chat"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

export default function SalesChatPage() {
  const { user } = useAuth()
  const [threads, setThreads] = useState<SalesThread[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active")
  const router = useRouter()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const { unreadCount, unreadByThread } = useUnreadMessages()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    console.log("=== CHAT PAGE: Starting to listen to threads for user ===", user.uid)
    setIsLoading(true)

    const unsubscribe = salesChatService.listenToThreads(user.uid, (updatedThreads) => {
      console.log("=== CHAT PAGE: Received updated threads ===", updatedThreads)

      // Log each thread's receiver info
      updatedThreads.forEach((thread, index) => {
        console.log(`=== CHAT PAGE: Thread ${index + 1} ===`, {
          id: thread.id,
          receiver_name: thread.receiver_name,
          receiverId: thread.receiverId,
          participants: thread.participants,
        })
      })

      setThreads(updatedThreads)
      setIsLoading(false)
    })

    return unsubscribe
  }, [user])

  const filteredThreads = threads.filter((thread) => {
    const matchesSearch =
      thread.receiver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (thread.lastMessage?.text && thread.lastMessage.text.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesTab = activeTab === "active" ? thread.status !== "archived" : thread.status === "archived"
    return matchesSearch && matchesTab
  })

  const getStats = () => {
    const activeThreads = threads.filter((t) => t.status !== "archived").length
    const totalMessages = threads.reduce((sum, thread) => sum + (thread.lastMessage?.text ? 1 : 0), 0)
    const urgentThreads = threads.filter((t) => t.priority === "urgent" && t.status !== "archived").length

    return { activeThreads, totalMessages, urgentThreads }
  }

  const { activeThreads, totalMessages, urgentThreads } = getStats()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Communications</h1>
          <p className="text-muted-foreground">Manage conversations with your customers in real-time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Conversations List */}
        <div>
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-4 space-y-2">
                        <div className="flex items-start space-x-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-4 w-16" />
                            </div>
                            <Skeleton className="h-3 w-48" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="font-medium mb-2">No customer conversations found</h3>
                    <p className="text-sm">
                      {activeTab === "active" ? "Start a conversation with a customer" : "No archived conversations"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-4">
                    {filteredThreads.map((thread) => {
                      const threadUnreadCount = unreadByThread[thread.id] || 0

                      // Safely handle lastMessage display
                      const displayMessage = (() => {
                        if (!thread.lastMessage?.text) return "No messages yet"
                        return thread.lastMessage.text.trim() || "No messages yet"
                      })()

                      // Log what we're displaying for each thread
                      console.log(`=== CHAT PAGE: Displaying thread ${thread.id} ===`, {
                        receiver_name: thread.receiver_name,
                        receiverId: thread.receiverId,
                        participants: thread.participants,
                      })

                      return (
                        <div
                          key={thread.id}
                          className={`p-4 rounded-lg hover:bg-accent transition-colors cursor-pointer ${
                            navigatingTo === thread.id ? "opacity-50" : ""
                          } ${threadUnreadCount > 0 ? "bg-accent/50" : ""}`}
                          onClick={() => {
                            setNavigatingTo(thread.id)
                            router.push(`/sales/chat/${thread.id}`)
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={thread.receiver_photo_url || "/placeholder.svg"} />
                              <AvatarFallback>{thread.receiver_name?.charAt(0) || "C"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium truncate">
                                    {thread.receiver_name || "Unknown User"}
                                  </p>
                                  {threadUnreadCount > 0 && (
                                    <Badge variant="destructive" className="text-xs px-1.5 py-0.5 h-5">
                                      {threadUnreadCount > 99 ? "99+" : threadUnreadCount}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
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
                                  {thread.lastMessage?.timestamp && thread.lastMessage.timestamp.toDate && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(thread.lastMessage.timestamp.toDate(), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p
                                className={`text-sm text-muted-foreground truncate ${threadUnreadCount > 0 ? "font-medium" : ""}`}
                              >
                                {displayMessage}
                              </p>
                              {thread.projectName && typeof thread.projectName === "string" && (
                                <p className="text-xs text-muted-foreground mt-1">Inquiry: {thread.projectName}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
