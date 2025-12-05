'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Send, MessageCircle, Search, Users } from 'lucide-react'
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
} from '@/lib/messaging-service'

interface CompanyUser {
  id: string
  displayName: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  lastSeen: Date
}

export default function MessagesPage() {
  const { user, userData } = useAuth()
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Real-time conversations and users on mount
  useEffect(() => {
    if (!user?.uid) return

    // Subscribe to real-time conversations
    const unsubscribeConversations = subscribeToConversations(
      user.uid,
      (conversations) => {
        setConversations(conversations)
        setLoadingConversations(false)
      },
      (error) => {
        console.error('Error in conversations listener:', error)
        setLoadingConversations(false)
      }
    )

    // Fetch company users (keep API for now as Firebase users might not be set up)
    fetchCompanyUsers()

    // Cleanup on unmount
    return () => {
      unsubscribeConversations()
    }
  }, [user])

  // Real-time messages and typing indicators when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !user?.uid) return

    setLoadingMessages(true)

    // Subscribe to real-time messages
    const unsubscribeMessages = subscribeToMessages(
      selectedConversation.id,
      (messages) => {
        setMessages(messages)
        setLoadingMessages(false)
      },
      (error) => {
        console.error('Error in messages listener:', error)
        setLoadingMessages(false)
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

    // Mark conversation as read
    markConversationAsRead(selectedConversation.id)

    // Cleanup when conversation changes
    return () => {
      unsubscribeMessages()
      unsubscribeTyping()
    }
  }, [selectedConversation, user?.uid])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const fetchCompanyUsers = async () => {
    try {
      const response = await fetch(`/api/messages/users?userId=${user?.uid}`)
      if (response.ok) {
        const data = await response.json()
        setCompanyUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching company users:', error)
    } finally {
      setLoadingUsers(false)
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
  const markConversationAsRead = async (conversationId: string) => {
    try {
      await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          userId: user?.uid,
        }),
      })
      // Refresh conversations to update unread counts
      fetchConversations()
    } catch (error) {
      console.error('Error marking conversation as read:', error)
    }
  }
      setLoadingMessages(false)
    }
  }

  const createConversation = async (otherUserId: string) => {
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
      const response = await fetch('/api/messages/conversations', {
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
        // Refresh conversations
        fetchConversations()
        // Select the new conversation
        setSelectedConversation(data.conversation)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user?.uid) return

    setSendingMessage(true)
    try {
      const response = await fetch('/api/messages/send', {
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
        // Refresh messages
        fetchMessages(selectedConversation.id)
        // Refresh conversations to update last message
        fetchConversations()
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSendingMessage(false)
    }
  }

  const getConversationDisplayName = (conversation: Conversation) => {
    if (conversation.metadata?.title) return conversation.metadata.title

    // For direct messages, show the other participant's name
    const otherParticipants = conversation.participants.filter(p => p !== user?.uid)
    if (otherParticipants.length > 0) {
      const otherUser = companyUsers.find(u => u.id === otherParticipants[0])
      return otherUser?.displayName || `User ${otherParticipants[0]}`
    }
    return 'Unknown'
  }

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.metadata?.avatar) return conversation.metadata.avatar

    const displayName = getConversationDisplayName(conversation)
    return displayName.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const formatMessageTime = (timestamp: Date) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <MessageCircle className="h-5 w-5 text-gray-500" />
          </div>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Conversations and Users List */}
        <ScrollArea className="flex-1">
          {/* Conversations Section */}
          {conversations.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Conversations</h3>
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
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

          {/* Company Users Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Team Members</h3>
              <Users className="h-4 w-4 text-gray-500" />
            </div>
            {loadingUsers ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                        <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : companyUsers.length === 0 ? (
              <p className="text-sm text-gray-500">No team members found</p>
            ) : (
              <div className="space-y-1">
                {companyUsers.map((user) => (
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
        </ScrollArea>
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
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
            <ScrollArea className="flex-1 p-4">
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
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isOwnMessage = message.senderId === user?.uid
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
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
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

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
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}