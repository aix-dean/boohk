'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Send, MessageCircle, Search, Users, ChevronDown, ChevronUp, ArrowLeft, Plus, Paperclip, Image, Video, X, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Conversation, Message } from '@/lib/types/messaging'
import { formatDistanceToNow, format } from 'date-fns'
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
import { db, storage } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

interface CompanyUser {
  id: string
  displayName: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  lastSeen: Date
}

const MessageComponent = React.memo(({ message, isOwnMessage, formatMessageTime, openMediaDialog }: {
  message: Message
  isOwnMessage: boolean
  formatMessageTime: (timestamp: Date) => string
  openMediaDialog: (url: string, type: 'image' | 'video', fileName?: string) => void
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
      {message.type === 'image' ? (
        <img
          src={message.content}
          alt={message.metadata?.fileName || 'Image'}
          className="max-w-full rounded cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => openMediaDialog(message.content, 'image', message.metadata?.fileName)}
        />
      ) : message.type === 'video' ? (
        <video
          src={message.content}
          controls
          className="max-w-full rounded cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => openMediaDialog(message.content, 'video', message.metadata?.fileName)}
        />
      ) : message.type === 'file' ? (
        <a
          href={message.content}
          target="_blank"
          rel="noopener noreferrer"
          className={isOwnMessage ? 'text-white underline hover:text-blue-200' : 'text-blue-500 underline hover:text-blue-600'}
          download={message.metadata?.fileName}
        >
          {message.metadata?.fileName || 'File'}
        </a>
      ) : (
        <p className="text-sm">{message.content}</p>
      )}
      <p className={`text-[10px] mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
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
  const [allParticipants, setAllParticipants] = useState<CompanyUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
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
  const [attachment, setAttachment] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video'; fileName?: string } | null>(null)

  // Load user profiles for all unique participants
  const loadAllParticipants = useCallback(async (conversations: Conversation[]) => {
    if (!user?.uid) return

    const uniqueParticipantIds = new Set<string>()
    conversations.forEach(conv => {
      conv.participants.forEach(participantId => {
        if (participantId !== user.uid) {
          uniqueParticipantIds.add(participantId)
        }
      })
    })

    const participantIds = Array.from(uniqueParticipantIds)
    if (participantIds.length === 0) {
      setAllParticipants([])
      setLoadingParticipants(false)
      return
    }

    setLoadingParticipants(true)
    try {
      const response = await fetch(`/api/messages/users?userIds=${participantIds.join(',')}&userId=${user.uid}`)
      if (response.ok) {
        const data = await response.json()
        setAllParticipants(data.users)
      } else {
        console.error('Failed to load participant profiles')
        setAllParticipants([])
      }
    } catch (error) {
      console.error('Error loading participant profiles:', error)
      setAllParticipants([])
    } finally {
      setLoadingParticipants(false)
    }
  }, [user?.uid])

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

        // Load participant profiles for all conversations
        loadAllParticipants(conversations)

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
    const usersQuery = userData?.company_id
      ? query(
          collection(db, 'boohk_users'),
          where('company_id', '==', userData.company_id)
        )
      : query(collection(db, 'boohk_users'))

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

    // Cleanup on unmount
    return () => {
      unsubscribeConversations()
      if (unsubscribeUsers) {
        unsubscribeUsers()
      }
    }
  }, [user, loadAllParticipants])

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
    if ((!newMessage.trim() && !attachment) || !selectedConversation || !user?.uid) return

    setSendingMessage(true)
    try {
      let type = 'text'
      let content = newMessage.trim()
      let metadata = {}

      if (attachment) {
        // Upload file to Firebase Storage
        const fileRef = ref(storage, `messages/${user.uid}/${Date.now()}_${attachment.name}`)
        await uploadBytes(fileRef, attachment)
        const downloadURL = await getDownloadURL(fileRef)

        if (attachment.type.startsWith('image/')) {
          type = 'image'
        } else if (attachment.type.startsWith('video/')) {
          type = 'video'
        } else {
          type = 'file'
        }

        content = downloadURL
        metadata = {
          fileName: attachment.name,
          fileSize: attachment.size,
          fileType: attachment.type
        }
      }

      const response = await fetch(`/api/messages/send?userId=${user?.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          type,
          content,
          metadata,
          userId: user.uid,
        }),
      })

      if (response.ok) {
        setNewMessage('')
        setAttachment(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
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

  const removeAttachment = () => {
    setAttachment(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAttachment(file)
    }
  }

  const openMediaDialog = (url: string, type: 'image' | 'video', fileName?: string) => {
    setSelectedMedia({ url, type, fileName })
    setMediaDialogOpen(true)
  }

  const handleDownload = () => {
    if (!selectedMedia) return;
    const link = document.createElement('a');
    link.href = selectedMedia.url;
    link.download = selectedMedia.fileName || 'download';
    link.click();
  }

  const truncateName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength) + '..'
  }

  const getConversationDisplayName = useCallback((conversation: Conversation) => {
    if (conversation.metadata?.title) return conversation.metadata.title

    // For direct messages, show the other participant's name
    const otherParticipants = conversation.participants.filter(p => p !== user?.uid)
    console.log('getConversationDisplayName for conversation:', conversation.id, 'participants:', conversation.participants, 'user.uid:', user?.uid, 'otherParticipants:', otherParticipants)
    if (otherParticipants.length > 0) {
      // First try to find in allParticipants (includes users from different companies)
      const otherUser = allParticipants.find(u => u.id === otherParticipants[0])
      if (otherUser) {
        console.log('Found otherUser in allParticipants:', otherUser, 'for id:', otherParticipants[0])
        return otherUser.displayName
      }
      // Fallback to companyUsers
      const companyUser = companyUsers.find(u => u.id === otherParticipants[0])
      if (companyUser) {
        console.log('Found otherUser in companyUsers:', companyUser, 'for id:', otherParticipants[0])
        return companyUser.displayName
      }
      // If still not found and loading, show loading indicator
      if (loadingParticipants) {
        return 'Loading...'
      }
      // Final fallback: use saved participant name from metadata
      const otherUserId = otherParticipants[0]
      const participantIndex = conversation.participants.indexOf(otherUserId)
      if (conversation.metadata?.participantNames && conversation.metadata.participantNames[participantIndex]) {
        console.log('Using saved participant name for id:', otherUserId, 'name:', conversation.metadata.participantNames[participantIndex])
        return conversation.metadata.participantNames[participantIndex]
      }
      console.log('No user found for id:', otherUserId, 'showing ID fallback')
      return `User ${otherUserId}`
    }
    return 'Unknown'
  }, [allParticipants, companyUsers, user?.uid, loadingParticipants])

  const getConversationAvatarUrl = (conversation: Conversation) => {
    if (conversation.metadata?.avatar) return conversation.metadata.avatar

    // For direct messages, use the other participant's avatar
    const otherParticipants = conversation.participants.filter(p => p !== user?.uid)
    if (otherParticipants.length > 0) {
      const otherUser = allParticipants.find(u => u.id === otherParticipants[0])
      if (otherUser?.avatar) return otherUser.avatar
    }

    return undefined
  }

  const getConversationAvatar = (conversation: Conversation) => {
    const url = getConversationAvatarUrl(conversation)
    if (url) return url

    // Fallback to initials
    const displayName = getConversationDisplayName(conversation)
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const formatMessageTime = (timestamp: Date) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      // Today: show time like "11:30AM"
      return format(date, 'h:mm a')
    } else if (diffInDays === 1) {
      // Yesterday
      return 'Yesterday'
    } else if (diffInDays < 7) {
      // This week: show day name like "Monday"
      return format(date, 'EEEE')
    } else if (date.getFullYear() === now.getFullYear()) {
      // This year: show date like "11/20"
      return format(date, 'M/d')
    } else {
      // Older: show date with year like "11/20/25"
      return format(date, 'M/d/yy')
    }
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
              placeholder="Search conversations and team members..."
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
                          <AvatarImage src={getConversationAvatarUrl(conversation)} />
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {getConversationAvatar(conversation)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {truncateName(getConversationDisplayName(conversation))}
                            </p>
                            {conversation.lastMessage && (
                              <div className="flex flex-col items-end">
                                <p className="text-[11px] text-gray-500">
                                  {formatMessageTime(conversation.lastMessage.timestamp)}
                                </p>
                                {conversation.unreadCount[user?.uid || ''] > 0 && (
                                  <Badge variant="destructive" className="mt-1 text-xs">
                                    {conversation.unreadCount[user?.uid || '']}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {conversation.lastMessage && (
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {conversation.lastMessage.type === 'image' ? (
                                conversation.lastMessage.senderId === user?.uid ? 'Image sent' : 'Image received'
                              ) : conversation.lastMessage.type === 'video' ? (
                                conversation.lastMessage.senderId === user?.uid ? 'Video sent' : 'Video received'
                              ) : conversation.lastMessage.type === 'file' ? (
                                conversation.lastMessage.senderId === user?.uid ? 'File sent' : 'File received'
                              ) : (
                                conversation.lastMessage.content
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Members Section */}
            {showTeamMembers && searchQuery.trim() && filteredUsers.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Team Members</h3>
                <div className="space-y-1">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => createConversation(user.id)}
                      className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
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
                            {truncateName(user.displayName)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.email}
                          </p>
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
                  <AvatarImage src={getConversationAvatarUrl(selectedConversation)} />
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                    {getConversationAvatar(selectedConversation)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {truncateName(getConversationDisplayName(selectedConversation))}
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
                      openMediaDialog={openMediaDialog}
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
              {/* Attachment Preview */}
              {attachment && (
                <div className="mb-2 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {attachment.type.startsWith('image/') ? (
                      <Image className="h-4 w-4 text-gray-500" />
                    ) : attachment.type.startsWith('video/') ? (
                      <Video className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Paperclip className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="text-sm text-gray-700 truncate">{attachment.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeAttachment}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex space-x-2">
                {/* Attachment Buttons */}
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = '*/*'
                        fileInputRef.current.click()
                      }
                    }}
                    className="h-8 w-8 p-0"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*,video/*'
                        fileInputRef.current.click()
                      }
                    }}
                    className="h-8 w-8 p-0"
                    title="Attach image or video"
                  >
                    <div className="relative">
                      <Image className="h-4 w-4" />
                    </div>
                  </Button>
                </div>

                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && !sendingMessage && sendMessage()}
                  className="flex-1"
                />

                <Button
                  onClick={sendMessage}
                  disabled={(!newMessage.trim() && !attachment) || sendingMessage}
                  size="sm"
                >
                  {sendingMessage ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                onChange={handleFileSelect}
                className="hidden"
              />
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
                          {truncateName(user.displayName)}
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

      {/* Media Dialog */}
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle>{selectedMedia?.fileName || (selectedMedia?.type === 'image' ? 'Image' : 'Video')}</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={handleDownload} className="h-6 w-6 p-0">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMediaDialogOpen(false)} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex justify-center items-center min-h-[400px]">
            {selectedMedia?.type === 'image' ? (
              <img
                src={selectedMedia.url}
                alt={selectedMedia.fileName || 'Image'}
                className="max-w-full max-h-full object-contain"
              />
            ) : selectedMedia?.type === 'video' ? (
              <video
                src={selectedMedia.url}
                controls
                className="max-w-full max-h-full"
                autoPlay
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}