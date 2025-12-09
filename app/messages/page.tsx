'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Send, MessageCircle, Search, Users, ChevronDown, ChevronUp, ArrowLeft, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Conversation, Message } from '@/lib/types/messaging'
import { formatDistanceToNow } from 'date-fns'
import {
  subscribeToConversations,
  subscribeToMessages,
  subscribeToTypingIndicators,
  sendMessage as sendMessageFirebase,
  markMessagesAsRead as markMessagesAsReadFirebase,
  sendTypingIndicator,
  createConversation as createConversationFirebase,
  getMessagingUsers,
  getMessagesPaginated,
  subscribeToNewMessages,
} from '@/lib/messaging-service'
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface CompanyUser {
  id: string
  displayName: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  lastSeen: Date
}

const MessageComponent = React.memo(({ message, isOwnMessage, formatMessageTime }: {
  message: Message
  isOwnMessage: boolean
  formatMessageTime: (timestamp: Date) => string
}) => (
  <div
    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
  >
    <div
      className={`max-w-[280px] sm:max-w-xs lg:max-w-md px-2 sm:px-4 py-2 rounded-lg ${
        isOwnMessage
          ? 'bg-blue-500 text-white'
          : 'bg-white border border-gray-200 text-gray-900'
      }`}
    >
      <p className="text-sm">{message.content}</p>
      <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
        {formatMessageTime(message.timestamp)}
      </p>
    </div>
  </div>
))

export default function MessagesPage() {
  const { user, userData } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showTeamMembers, setShowTeamMembers] = useState(true)
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousMessagesRef = useRef<string>('')
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const justLoadedMoreRef = useRef(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastLoadedMessageId, setLastLoadedMessageId] = useState<string | null>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [isScrolledUp, setIsScrolledUp] = useState(false)

  // Real-time conversations and users on mount
  useEffect(() => {
    console.log('MessagesPage useEffect - user:', user)
    console.log('MessagesPage useEffect - userData:', userData)
    if (!user?.uid) return

    console.log('Subscribing to conversations for userId:', user.uid)

    // Subscribe to real-time conversations
    const unsubscribeConversations = subscribeToConversations(
      user.uid,
      (conversations) => {
        console.log('MessagesPage callback - received conversations:', conversations.length)
        console.log('Conversation IDs and participants:', conversations.map(c => ({ id: c.id, participants: c.participants })))
        setConversations(conversations)
        console.log('subscribeToConversations callback received:', conversations.length, 'conversations')
        console.log('Conversations data:', conversations)
        setLoadingConversations(false)

        // Auto-select first conversation if none is selected
        if (conversations.length > 0 && !selectedConversation) {
          console.log('Auto-selecting first conversation:', conversations[0].id)
          setSelectedConversation(conversations[0])
          if (user?.uid && conversations[0].unreadCount[user.uid] > 0) {
            markConversationAsRead(conversations[0].id)
          }
        }
      },
      (error) => {
        console.error('Error in conversations listener:', error)
        setLoadingConversations(false)
      }
    )

    // Subscribe to real-time company users
    let unsubscribeUsers: (() => void) | null = null
    if (userData?.company_id) {
      const usersQuery = query(
        collection(db, 'boohk_users'),
        where('company_id', '==', userData.company_id)
      )

      unsubscribeUsers = onSnapshot(
        usersQuery,
        (snapshot) => {
          console.log('Company users snapshot received, docs count:', snapshot.docs.length)
          const users = snapshot.docs
            .filter(doc => doc.data().uid !== user.uid) // Exclude current user
            .map(doc => {
              const data = doc.data()
              return {
                id: data.uid,
                displayName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Unknown User',
                email: data.email,
                avatar: data.avatar,
                status: 'offline' as const, // TODO: Implement real-time status
                lastSeen: data.updated?.toDate() || new Date(),
              }
            })
          console.log('Loaded company users:', users.map(u => ({ id: u.id, displayName: u.displayName })))
          setCompanyUsers(users)
          setLoadingUsers(false)
        },
        (error) => {
          console.error('Error in users listener:', error)
          setLoadingUsers(false)
        }
      )
    } else {
      setLoadingUsers(false)
    }

    // Cleanup on unmount
    return () => {
      unsubscribeConversations()
      if (unsubscribeUsers) {
        unsubscribeUsers()
      }
    }
  }, [user])

  // Load initial messages and subscribe to new messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !user?.uid) return

    // Reset pagination state for new conversation
    setHasMore(true)
    setLoadingMore(false)
    setLastLoadedMessageId(null)
    setInitialLoadDone(false)
    setMessages([])
    setLoadingMessages(true)

    // Load initial messages
    const loadInitialMessages = async () => {
      try {
        const { messages: initialMessages, hasMore: hasMoreInitial } = await getMessagesPaginated(
          user.uid,
          selectedConversation.id,
          9 // Load 9 messages initially
        )
        setMessages(initialMessages)
        setHasMore(hasMoreInitial)
        if (initialMessages.length > 0) {
          setLastLoadedMessageId(initialMessages[0].id) // Oldest message ID for pagination
        }
        setInitialLoadDone(true)
      } catch (error) {
        console.error('Error loading initial messages:', error)
      } finally {
        setLoadingMessages(false)
      }
    }

    loadInitialMessages()

    // Subscribe to new messages (after the initial load)
    const unsubscribeNewMessages = subscribeToNewMessages(
      selectedConversation.id,
      new Date(), // Subscribe to messages from now onwards
      (newMessages) => {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id))
          return [...prev, ...uniqueNewMessages]
        })
      },
      (error) => {
        console.error('Error in new messages listener:', error)
      }
    )

    // Subscribe to typing indicators
    const unsubscribeTyping = subscribeToTypingIndicators(
      selectedConversation.id,
      user.uid,
      (typingUsers) => {
        setTypingUsers(typingUsers)
      },
      (error) => {
        console.error('Error in typing indicators listener:', error)
      }
    )

    // Cleanup when conversation changes
    return () => {
      unsubscribeNewMessages()
      unsubscribeTyping()
    }
  }, [selectedConversation?.id, user?.uid])

  // Scroll to bottom when new messages arrive (debounced)
  useEffect(() => {
    if (justLoadedMoreRef.current) {
      justLoadedMoreRef.current = false
      return
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [messages])

  const fetchConversations = async () => {
    try {
      const response = await fetch(`/api/messages/conversations?userId=${user?.uid}`)
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }


  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const response = await fetch(`/api/messages/${conversationId}?userId=${user?.uid}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const markConversationAsRead = async (conversationId: string) => {
    try {
      await fetch(`/api/messages/mark-read?userId=${user?.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          userId: user?.uid,
        }),
      })
      // Real-time subscription will update unread counts automatically
    } catch (error) {
      console.error('Error marking conversation as read:', error)
    }
  }

  const createConversation = async (otherUserId: string) => {
    console.log('createConversation called with otherUserId:', otherUserId)
    try {
      // Check if conversation already exists
      const existingConversation = conversations.find(conv =>
        conv.participants.length === 2 &&
        conv.participants.includes(user!.uid) &&
        conv.participants.includes(otherUserId)
      )

      if (existingConversation) {
        setSelectedConversation(existingConversation)
        return
      }

      // Create new conversation
      const response = await fetch(`/api/messages/conversations?userId=${user?.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: [user!.uid, otherUserId],
          type: 'direct',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Real-time subscription will update conversations list automatically
        // Select the new conversation
        setSelectedConversation(data.conversation)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    const isNearTop = scrollTop < 50 // Load more when within 50px of top
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 500 // Within 50px of bottom

    // Update scroll position state
    setIsScrolledUp(!isNearBottom)

    if (!hasMore || loadingMore || !initialLoadDone) return

    if (isNearTop && hasMore && !loadingMore && lastLoadedMessageId) {
      loadMoreMessages()
    }
  }, [hasMore, loadingMore, initialLoadDone, lastLoadedMessageId])

  const loadMoreMessages = async () => {
    if (!selectedConversation || !user?.uid || !lastLoadedMessageId || loadingMore || !hasMore) return

    setLoadingMore(true)
    const scrollElement = scrollAreaRef.current
    const oldScrollHeight = scrollElement?.scrollHeight || 0

    try {
      const { messages: olderMessages, hasMore: hasMoreOlder } = await getMessagesPaginated(
        user.uid,
        selectedConversation.id,
        9,
        lastLoadedMessageId
      )

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev])
        setLastLoadedMessageId(olderMessages[0].id)
        setHasMore(hasMoreOlder)
        justLoadedMoreRef.current = true

        // Maintain scroll position after prepending messages
        setTimeout(() => {
          if (scrollElement) {
            const newScrollHeight = scrollElement.scrollHeight
            scrollElement.scrollTop += newScrollHeight - oldScrollHeight
          }
        }, 0)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more messages:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.uid) return

    setSendingMessage(true)
    try {
      const response = await fetch(`/api/messages/send?userId=${user?.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          type: 'text',
          content: newMessage.trim(),
          userId: user.uid,
        }),
      })

      if (response.ok) {
        setNewMessage('')
        // Real-time subscriptions will update messages and conversations automatically
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSendingMessage(false)
    }
  }
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsScrolledUp(false)
  }

  const getConversationDisplayName = useCallback((conversation: Conversation) => {
    if (conversation.metadata?.title) return conversation.metadata.title

    // For direct messages, show the other participant's name
    const otherParticipants = conversation.participants.filter(p => p !== user?.uid)
    console.log('getConversationDisplayName for conversation:', conversation.id, 'participants:', conversation.participants, 'user.uid:', user?.uid, 'otherParticipants:', otherParticipants)
    if (otherParticipants.length > 0) {
      const otherUser = companyUsers.find(u => u.id === otherParticipants[0])
      console.log('Found otherUser:', otherUser, 'for id:', otherParticipants[0])
      return otherUser?.displayName || `User ${otherParticipants[0]}`
    }
    return 'Unknown'
  }, [companyUsers, user?.uid])

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.metadata?.avatar) return conversation.metadata.avatar

    const displayName = getConversationDisplayName(conversation)
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const formatMessageTime = (timestamp: Date) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  }
  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter(conversation => {
      const displayName = getConversationDisplayName(conversation)
      const matches = displayName.toLowerCase().includes(searchQuery.toLowerCase())
      console.log('Filtering conversation:', conversation.id, 'displayName:', displayName, 'matches:', matches, 'searchQuery:', searchQuery)
      return matches
    })
    console.log('filteredConversations result:', filtered.length, 'filtered from', conversations.length, 'total')
    console.log('Filtered conversation IDs:', filtered.map(c => c.id))
    return filtered
  }, [conversations, searchQuery, getConversationDisplayName])


  const filteredUsers = useMemo(() => {
    return companyUsers.filter(user =>
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [companyUsers, searchQuery])

  return (
    <div className="container mx-auto p-2 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              Messages
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Chat with your team members</p>
          </div>
        </div>
      </div>

      <div className="h-[calc(100vh-180px)] sm:h-[calc(100vh-250px)] min-h-[500px] sm:min-h-[600px] flex bg-white rounded-lg border overflow-hidden relative">
      {/* Conversations Sidebar */}
      <div className={`w-80 bg-gray-50 border-r border-gray-200 flex flex-col fixed md:relative top-0 left-0 h-full z-40 ${sidebarOpen ? 'block' : 'hidden'} md:block`}>
        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations and Users List */}
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            {/* Conversations Section */}
            {filteredConversations.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Conversations</h3>
                <div className="space-y-1">
                  {filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => {
                        setSelectedConversation(conversation)
                        if (user?.uid && conversation.unreadCount[user.uid] > 0) {
                          markConversationAsRead(conversation.id)
                        }
                      }}
                      className={`p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedConversation?.id === conversation.id ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={conversation.metadata?.avatar} />
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {getConversationAvatar(conversation)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {getConversationDisplayName(conversation)}
                            </p>
                            {conversation.lastMessage && (
                              <p className="text-xs text-gray-500">
                                {formatMessageTime(conversation.lastMessage.timestamp)}
                              </p>
                            )}
                          </div>
                          {conversation.lastMessage && (
                            <p className="text-sm text-gray-500 truncate mt-1">
                              {conversation.lastMessage.content}
                            </p>
                          )}
                          {conversation.unreadCount[user?.uid || ''] > 0 && (
                            <Badge variant="destructive" className="mt-1 text-xs">
                              {conversation.unreadCount[user?.uid || '']}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
{/* Add Conversation Button */}
<Button
  onClick={() => setIsContactDialogOpen(true)}
  className="absolute bottom-4 right-4 h-8 w-8 rounded-full shadow-lg z-10"
  size="sm"
>
  <Plus className="h-6 w-6" />
</Button>
      </div>

    {/* Chat View */}
     <div className="flex-1 flex flex-col bg-gray-50 relative">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden mr-2"
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedConversation.metadata?.avatar} />
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                    {getConversationAvatar(selectedConversation)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {getConversationDisplayName(selectedConversation)}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.participants.length} participants
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollAreaRef} className="flex-1 relative px-5 overflow-y-auto" onScroll={handleScroll}>
              {loadingMessages ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                          <div className="h-16 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  {loadingMore && (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                    </div>
                  )}
                  {messages.map((message) => (
                    <MessageComponent
                      key={message.id}
                      message={message}
                      isOwnMessage={message.senderId === user?.uid}
                      formatMessageTime={formatMessageTime}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Scroll to Bottom Button - Fixed Position */}
            {isScrolledUp && (
              <Button
                onClick={scrollToBottom}
                className="absolute bottom-20 left-1/2 transform -translate-x-1/2 h-8 w-8 rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 text-white z-10"
                size="sm"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && !sendingMessage && sendMessage()}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  size="sm"
                >
                  {sendingMessage ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>


      {/* Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {loadingUsers ? (
              <div className="space-y-3 py-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {searchQuery ? 'No team members found matching your search' : 'No team members found'}
              </p>
            ) : (
              <div className="space-y-2 py-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      createConversation(user.id)
                      setIsContactDialogOpen(false)
                    }}
                    className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                          {user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
