'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Send, MessageCircle, Search, Users, ChevronDown, ChevronUp, ArrowLeft, Plus, Paperclip, Image, Video, X, Download, Upload, Info, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast'

interface CompanyUser {
  id: string
  displayName: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  lastSeen: Date
}

const MessageComponent = React.memo(({ message, isOwnMessage, formatMessageTime, openMediaDialog, isGroup, senderName, senderAvatar }: {
  message: Message
  isOwnMessage: boolean
  formatMessageTime: (timestamp: Date) => string
  openMediaDialog: (url: string, type: 'image' | 'video', fileName?: string) => void
  isGroup: boolean
  senderName?: string
  senderAvatar?: string
}) => (
  <div
    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
  >
    {isGroup && !isOwnMessage && senderName && (
      <div className="flex items-center space-x-2 mb-1">
        <Avatar className="h-6 w-6">
          <AvatarImage src={senderAvatar} />
          <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
            {senderName.split(' ').map(n => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-gray-900">{senderName}</span>
      </div>
    )}
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
   const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingParticipants, setLoadingParticipants] = useState(false)

  const allParticipants = useMemo(() => {
    const participants: CompanyUser[] = [...companyUsers]
    if (selectedConversation) {
      selectedConversation.participants.forEach((participantId, index) => {
        if (!participants.find(p => p.id === participantId)) {
          const name = selectedConversation.metadata?.participantNames?.[index]
          if (name) {
            participants.push({
              id: participantId,
              displayName: name,
              email: '',
              avatar: undefined,
              status: 'offline' as const,
              lastSeen: new Date(),
            })
          }
        }
      })
    }
    return participants
  }, [companyUsers, selectedConversation])
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
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([])
   const [avatarFile, setAvatarFile] = useState<File | null>(null)
   const avatarFileRef = useRef<HTMLInputElement>(null)
  const [groupName, setGroupName] = useState('')
  const [groupInfoOpen, setGroupInfoOpen] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [hoveredMember, setHoveredMember] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [isEditingGroup, setIsEditingGroup] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState('')
   const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
   const [dialogMode, setDialogMode] = useState<'info' | 'addMember'>('info')


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
        setConversations(conversations)
        setLoadingConversations(false)

        // Update selectedConversation if it exists and has been updated
        if (selectedConversation) {
          const updatedSelected = conversations.find(c => c.id === selectedConversation.id)
          if (updatedSelected) {
            console.log('DEBUG: Updated selected conversation metadata:', updatedSelected.metadata)
            setSelectedConversation(updatedSelected)
          }
        }


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

    // Subscribe to real-time company users only if userData is available
    let unsubscribeUsers: (() => void) | null = null
    console.log('userData check for boohk_users subscription:', !!userData)
    if (userData) {
      console.log('Setting up boohk_users subscription for company_id:', userData.company_id)
      const usersQuery = userData.company_id
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
                avatar: data.photo_url,
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
      console.log('Skipping boohk_users subscription because userData is null')
    }

    // Cleanup on unmount
    return () => {
      unsubscribeConversations()
      if (unsubscribeUsers) {
        unsubscribeUsers()
      }
    }
  }, [user, userData])

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

  const createConversation = async (participants: string[], type: 'direct' | 'group' = 'direct', metadata?: any) => {
    console.log('createConversation called with participants:', participants, 'type:', type)
    try {
      if (type === 'direct') {
        // Check if conversation already exists
        const existingConversation = conversations.find(conv =>
          conv.participants.length === 2 &&
          conv.participants.includes(user!.uid) &&
          conv.participants.includes(participants[1])
        )

        if (existingConversation) {
          setSelectedConversation(existingConversation)
          return existingConversation
        }
      }

      // Create new conversation
      const response = await fetch(`/api/messages/conversations?userId=${user?.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants,
          type,
          metadata,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Real-time subscription will update conversations list automatically
        // Select the new conversation
        setSelectedConversation(data.conversation)
        return data.conversation
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
    return null
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    const participants = [user!.uid, ...selectedGroupMembers]
    if (selectedGroupMembers.length < 2) {
      alert('A group must have at least 3 participants.')
      return
    }

    // Build participantNames array corresponding to participants by index
    const currentUserDisplayName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email || 'Unknown User' : 'Unknown User'
    const selectedUsersDisplayNames = selectedGroupMembers.map(id => {
      const user = companyUsers.find(u => u.id === id)
      return user ? user.displayName : 'Unknown User'
    })
    const participantNames = [currentUserDisplayName, ...selectedUsersDisplayNames]

    setCreatingGroup(true)
    try {
      console.log('DEBUG: Creating group conversation with participants:', participants)
      toast({
        title: "Creating Group",
        description: "Setting up your group chat...",
      })

      const conversation = await createConversation(participants, 'group', { title: groupName.trim(), admins: [user!.uid], participantNames })
      console.log('DEBUG: Group conversation created:', conversation?.id)

      // Upload avatar if selected
      if (avatarFile && conversation?.id) {
        console.log('DEBUG: Avatar file selected, starting upload for conversation:', conversation.id)
        try {
          toast({
            title: "Uploading Avatar",
            description: "Please wait while we upload your group avatar...",
          })

          // Upload to Firebase Storage
          const fileRef = ref(storage, `conversations/${conversation.id}/avatar_${Date.now()}_${avatarFile.name}`)
          console.log('DEBUG: Uploading to Firebase Storage path:', fileRef.fullPath)
          await uploadBytes(fileRef, avatarFile)
          console.log('DEBUG: Upload to Firebase Storage successful')
          const downloadURL = await getDownloadURL(fileRef)
          console.log('DEBUG: Download URL obtained:', downloadURL)

          // Validate download URL
          if (!downloadURL || typeof downloadURL !== 'string' || !downloadURL.startsWith('https://')) {
            throw new Error('Invalid download URL received from Firebase Storage')
          }

          // Update conversation metadata with retry mechanism
          let metadataUpdateSuccess = false
          let retryCount = 0
          const maxRetries = 3

          while (!metadataUpdateSuccess && retryCount < maxRetries) {
            try {
              console.log(`DEBUG: Updating conversation metadata with avatar URL (attempt ${retryCount + 1})`)
              const response = await fetch(`/api/messages/conversations/${conversation.id}?userId=${user!.uid}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  metadata: { avatar: downloadURL }
                }),
              })

              if (response.ok) {
                console.log('DEBUG: Metadata update successful')
                metadataUpdateSuccess = true
                toast({
                  title: "Avatar Uploaded",
                  description: "Group avatar has been set successfully.",
                })
              } else {
                const errorText = await response.text()
                console.error('DEBUG: Failed to update avatar metadata, response status:', response.status, 'error:', errorText)
                throw new Error(`Metadata update failed: ${response.status} ${errorText}`)
              }
            } catch (error) {
              retryCount++
              console.error(`DEBUG: Metadata update attempt ${retryCount} failed:`, error)
              if (retryCount >= maxRetries) {
                throw error
              }
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
            }
          }

          if (!metadataUpdateSuccess) {
            throw new Error('Failed to update metadata after all retries')
          }
        } catch (error) {
          console.error('DEBUG: Error uploading avatar:', error)
          toast({
            title: "Avatar Upload Failed",
            description: "The group was created but avatar upload failed. You can try uploading it later.",
            variant: "destructive",
          })
        }
      } else {
        console.log('DEBUG: No avatar file selected or conversation ID missing')
      }

      toast({
        title: "Group Created",
        description: `Successfully created "${groupName.trim()}" with ${selectedGroupMembers.length + 1} members.`,
      })

      setIsContactDialogOpen(false)
      setIsGroupMode(false)
      setSelectedGroupMembers([])
      setGroupName('')
      setAvatarFile(null)
      if (avatarFileRef.current) {
        avatarFileRef.current.value = ''
      }
    } catch (error) {
      console.error('Error creating group:', error)
      toast({
        title: "Group Creation Failed",
        description: "There was an error creating your group. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCreatingGroup(false)
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

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate image type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.')
        return
      }
      // Validate size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.')
        return
      }
      setAvatarFile(file)
    }
  }

  const removeAvatar = () => {
    setAvatarFile(null)
    if (avatarFileRef.current) {
      avatarFileRef.current.value = ''
    }
  }

  const saveAvatar = async () => {
    if (!avatarFile || !selectedConversation || !user?.uid) return

    setSavingAvatar(true)
    try {
      // Upload to Firebase Storage
      const fileRef = ref(storage, `conversations/${selectedConversation.id}/avatar_${Date.now()}_${avatarFile.name}`)
      await uploadBytes(fileRef, avatarFile)
      const downloadURL = await getDownloadURL(fileRef)

      // Update conversation metadata
      const response = await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: { avatar: downloadURL }
        }),
      })

      if (response.ok) {
        // Clear the file and reset input
        setAvatarFile(null)
        if (avatarFileRef.current) {
          avatarFileRef.current.value = ''
        }
        // The real-time subscription will update the conversation automatically
      } else {
        console.error('Failed to update avatar')
        alert('Failed to save avatar. Please try again.')
      }
    } catch (error) {
      console.error('Error saving avatar:', error)
      alert('Error saving avatar. Please try again.')
    } finally {
      setSavingAvatar(false)
    }
  }

  const addMember = async (memberId: string) => {
    if (!selectedConversation || !user?.uid) return

    try {
      const response = await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId }),
      })

      if (response.ok) {
        setDialogMode('info')
        // Rebuild participantNames
        const newParticipants = [...selectedConversation.participants, memberId]
        const newParticipantNames = newParticipants.map(id => {
          const user = allParticipants.find(u => u.id === id) || companyUsers.find(u => u.id === id)
          return user ? user.displayName : 'Unknown User'
        })
        // Update metadata
        try {
          await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ metadata: { participantNames: newParticipantNames } }),
          })
        } catch (error) {
          console.error('Error updating participantNames:', error)
        }
        // The real-time subscription will update the conversation automatically
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add member')
      }
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Error adding member. Please try again.')
    }
  }

  const removeMember = async (memberId: string) => {
    if (!selectedConversation || !user?.uid) return

    try {
      const response = await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}&memberId=${memberId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setMemberToRemove(null)
        // Rebuild participantNames
        const newParticipants = selectedConversation.participants.filter(id => id !== memberId)
        const newParticipantNames = newParticipants.map(id => {
          const user = allParticipants.find(u => u.id === id) || companyUsers.find(u => u.id === id)
          return user ? user.displayName : 'Unknown User'
        })
        // Update metadata
        try {
          await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ metadata: { participantNames: newParticipantNames } }),
          })
        } catch (error) {
          console.error('Error updating participantNames:', error)
        }
        // The real-time subscription will update the conversation automatically
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove member')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Error removing member. Please try again.')
    }
  }

  const assignAdmin = async (memberId: string) => {
    if (!selectedConversation || !user?.uid) return

    try {
      const currentAdmins = (selectedConversation.metadata as any)?.admins || []
      const isCurrentlyAdmin = currentAdmins.includes(memberId)
      let newAdmins: string[]

      if (isCurrentlyAdmin) {
        // Remove admin
        newAdmins = currentAdmins.filter((id: string) => id !== memberId)
      } else {
        // Add admin
        newAdmins = [...currentAdmins, memberId]
      }

      const response = await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: { admins: newAdmins }
        }),
      })

      if (response.ok) {
        // success
      } else {
        alert(`Failed to ${isCurrentlyAdmin ? 'remove' : 'assign'} admin`)
      }
    } catch (error) {
      console.error('Error updating admin:', error)
      alert('Error updating admin')
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
    if (!conversation) return ''
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
      if (conversation.metadata?.participantNames?.[participantIndex]) {
        console.log('Using saved participant name for id:', otherUserId, 'name:', conversation.metadata.participantNames[participantIndex])
        return conversation.metadata.participantNames[participantIndex]
      }
      console.log('No user found for id:', otherUserId, 'showing ID fallback')
      return `User ${otherUserId}`
    }
    return 'Unknown'
  }, [allParticipants, companyUsers, user?.uid, loadingParticipants])

  const getConversationAvatarUrl = (conversation: Conversation) => {
    if (!conversation) return undefined
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
                          <AvatarImage src={getConversationAvatarUrl(conversation)} className="object-cover" />
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {conversation.type === 'group' ? <Users className="h-4 w-4" /> : getConversationAvatar(conversation)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate flex items-center">
                              {conversation.type === 'group' && <Users className="h-3 w-3 mr-1" />}
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
                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => createConversation([user!.uid, u.id])}
                      className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {u.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {truncateName(u.displayName)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {u.email}
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
              <div className="flex items-center justify-between">
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
                    <AvatarImage src={getConversationAvatarUrl(selectedConversation)} className="object-cover" />
                    <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                      {selectedConversation.type === 'group' ? <Users className="h-4 w-4" /> : getConversationAvatar(selectedConversation)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                      {selectedConversation.type === 'group' && <Users className="h-4 w-4 mr-2" />}
                      {truncateName(getConversationDisplayName(selectedConversation))}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.type === 'group' ? 'Group' : 'Direct'} • {selectedConversation.participants.length} participants
                    </p>
                  </div>
                </div>
                {selectedConversation.type === 'group' && (
                  <Button variant="ghost" size="sm" onClick={() => setGroupInfoOpen(true)}>
                    <Info className="h-4 w-4" />
                  </Button>
                )}
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
                  {messages.map((message) => {
                    const sender = allParticipants.find(u => u.id === message.senderId) || companyUsers.find(u => u.id === message.senderId)
                    return (
                      <MessageComponent
                        key={message.id}
                        message={message}
                        isOwnMessage={message.senderId === user?.uid}
                        formatMessageTime={formatMessageTime}
                        openMediaDialog={openMediaDialog}
                        isGroup={selectedConversation.type === 'group'}
                        senderName={sender?.displayName}
                        senderAvatar={sender?.avatar}
                      />
                    )
                  })}
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
      <Dialog open={isContactDialogOpen} onOpenChange={(open) => { setIsContactDialogOpen(open); if (!open) { setIsGroupMode(false); setSelectedGroupMembers([]); setGroupName(''); setAvatarFile(null); if (avatarFileRef.current) avatarFileRef.current.value = ''; } }}>
        <DialogContent className="sm:max-w-md h-auto max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isGroupMode ? 'Create Group Chat' : 'Start New Conversation'}</DialogTitle>
          </DialogHeader>
          <div className="flex space-x-2 mb-4">
            <Button variant={isGroupMode ? "outline" : "default"} onClick={() => setIsGroupMode(false)}>Direct Message</Button>
            <Button variant={isGroupMode ? "default" : "outline"} onClick={() => setIsGroupMode(true)}>Create Group</Button>
          </div>
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
            ) : !isGroupMode ? (
              <div className="space-y-2 py-2">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      createConversation([user!.uid, u.id])
                      setIsContactDialogOpen(false)
                    }}
                    className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                          {u.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {truncateName(u.displayName)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                 <Input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mb-4" />
                 <div className="mb-4">
                   <Label htmlFor="group-avatar" className="text-sm font-medium">Group Avatar (optional)</Label>
                   <div className="mt-2 flex items-center space-x-4">
                     <div className="relative">
                       <Avatar className="h-16 w-16">
                         <AvatarImage src={avatarFile ? URL.createObjectURL(avatarFile) : undefined} />
                         <AvatarFallback className="bg-gray-200 text-gray-600 text-lg">
                           <Users className="h-8 w-8" />
                         </AvatarFallback>
                       </Avatar>
                       {avatarFile && (
                         <Button
                           variant="destructive"
                           size="sm"
                           onClick={removeAvatar}
                           className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                         >
                           <X className="h-3 w-3" />
                         </Button>
                       )}
                     </div>
                     <div>
                       <input
                         ref={avatarFileRef}
                         type="file"
                         accept="image/*"
                         onChange={handleAvatarSelect}
                         className="hidden"
                       />
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => avatarFileRef.current?.click()}
                       >
                         <Upload className="h-4 w-4 mr-2" />
                         {avatarFile ? 'Change Avatar' : 'Upload Avatar'}
                       </Button>
                       <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG</p>
                     </div>
                   </div>
                 </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Checkbox
                        checked={selectedGroupMembers.includes(u.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGroupMembers(prev => [...prev, u.id])
                          } else {
                            setSelectedGroupMembers(prev => prev.filter(id => id !== u.id))
                          }
                        }}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback>{u.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{truncateName(u.displayName)}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-gray-500">{selectedGroupMembers.length} members selected</p>
                  <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedGroupMembers.length < 2 || creatingGroup}>
                    {creatingGroup ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Create Group'
                    )}
                  </Button>
                </div>
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

      {/* Group Info Dialog */}
      <Dialog open={groupInfoOpen} onOpenChange={(open) => {
        setGroupInfoOpen(open)
        if (!open) {
          setDialogMode('info')
          setIsEditingGroup(false)
          setShowUpload(false)
          setEditingGroupName('')
          setAvatarFile(null)
          if (avatarFileRef.current) {
            avatarFileRef.current.value = ''
          }
        }
      }}>
        <DialogContent className="sm:max-w-md p-0 max-h-[80vh] flex flex-col">
          {dialogMode === 'info' && (
            <Card className="w-full max-w-md overflow-hidden shadow-2xl border-0 bg-card flex flex-col flex-1">
              <div className="flex-1 flex flex-col">
                {/* Header Section */}
                <div
                  className="relative bg-cover bg-center p-8 text-center flex flex-col items-center justify-end h-full"
                  style={{ backgroundImage: `url('${avatarFile ? URL.createObjectURL(avatarFile) : getConversationAvatarUrl(selectedConversation!) || '/images/image.png'}')` }}
                >
                  {/* Dark overlay for better text contrast */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />

                  {/* Edit Button */}
                  <button
                    onClick={() => {
                      if (!isEditingGroup) {
                        setEditingGroupName(getConversationDisplayName(selectedConversation!))
                        setShowUpload(true)
                      } else {
                        setShowUpload(false)
                      }
                      setIsEditingGroup(!isEditingGroup)
                    }}
                    className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 transition-all duration-200 group shadow-lg"
                    aria-label="Edit Group"
                  >
                    <Pencil className="h-4 w-4 text-white" />
                  </button>

                  <div className="relative">
                    <Avatar className="h-16 w-16 mb-4 mx-auto">
                      <AvatarImage src={getConversationAvatarUrl(selectedConversation!)} className="object-cover" />
                      <AvatarFallback className="bg-white/20 text-white">
                        <Users className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    {/* Group Name */}
                    {isEditingGroup ? (
                      <Input
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        className="text-3xl font-bold tracking-tight text-white mb-1 drop-shadow-lg bg-transparent border-white/30 text-center h-auto p-0 focus:border-white"
                        placeholder="Group name"
                      />
                    ) : (
                      <h2 className="text-3xl font-bold tracking-tight text-white mb-1 drop-shadow-lg">{getConversationDisplayName(selectedConversation!)}</h2>
                    )}

                    {/* Member Count */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm shadow-sm border border-white/30">
                      <Users className="h-3.5 w-3.5 text-white" />
                      <span className="text-sm font-medium text-white">{selectedConversation?.participants?.length || 0} members</span>
                    </div>
                  </div>
                </div>

                {isEditingGroup && (
                  <div className="px-6 py-5 bg-accent/30">
                    <Button
                      variant="outline"
                      className="w-full h-auto py-3 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-200 group bg-transparent"
                      onClick={() => avatarFileRef.current?.click()}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Upload className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-foreground">Upload Avatar</div>
                          <div className="text-xs text-muted-foreground">Max 5MB, JPG/PNG</div>
                        </div>
                      </div>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                      ref={avatarFileRef}
                    />
                  </div>
                )}

                {isEditingGroup && (
                  <div className="px-6 py-4 bg-accent/30">
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          if (!selectedConversation || !user?.uid) return

                          setSavingAvatar(true)
                          try {
                            const metadata: any = {}

                            // Update group name if changed
                            if (editingGroupName.trim() !== getConversationDisplayName(selectedConversation)) {
                              metadata.title = editingGroupName.trim()
                            }

                            // Update avatar if file selected
                            if (avatarFile) {
                              const fileRef = ref(storage, `conversations/${selectedConversation.id}/avatar_${Date.now()}_${avatarFile.name}`)
                              await uploadBytes(fileRef, avatarFile)
                              const downloadURL = await getDownloadURL(fileRef)
                              metadata.avatar = downloadURL
                            }

                            if (Object.keys(metadata).length > 0) {
                              const response = await fetch(`/api/messages/conversations/${selectedConversation.id}?userId=${user.uid}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ metadata }),
                              })

                              if (!response.ok) {
                                throw new Error('Failed to update group')
                              }
                            }

                            // Reset states
                            setIsEditingGroup(false)
                            setShowUpload(false)
                            setAvatarFile(null)
                            if (avatarFileRef.current) {
                              avatarFileRef.current.value = ''
                            }
                          } catch (error) {
                            console.error('Error saving group changes:', error)
                            alert('Failed to save changes. Please try again.')
                          } finally {
                            setSavingAvatar(false)
                          }
                        }}
                        disabled={savingAvatar || !editingGroupName.trim()}
                        size="sm"
                        className="flex-1"
                      >
                        {savingAvatar ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingGroup(false)
                          setShowUpload(false)
                          setEditingGroupName('')
                          setAvatarFile(null)
                          if (avatarFileRef.current) {
                            avatarFileRef.current.value = ''
                          }
                        }}
                        size="sm"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Members Section */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Members</h3>
                  {(selectedConversation?.metadata as any)?.admins?.includes(user?.uid) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialogMode('addMember')}
                      className="ml-auto"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedConversation?.participants.map(id => {
                    const userData = allParticipants.find(u => u.id === id) || companyUsers.find(u => u.id === id)
                    const isAdmin = (selectedConversation?.metadata as any)?.admins?.includes(id) || false
                    const isCurrentUserAdmin = selectedConversation?.metadata?.admin === user?.uid
                    return (
                      <div
                        key={id}
                        onMouseEnter={() => setHoveredMember(id)}
                        onMouseLeave={() => setHoveredMember(null)}
                        className="group relative flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer"
                      >
                        {/* Avatar */}
                        <Avatar className="h-10 w-10 border-2 border-border transition-colors shadow-sm">
                          <AvatarImage src={userData?.avatar} className="object-cover" />
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-sm group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {userData?.displayName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        {/* Member Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2" title={userData?.displayName || `User ${id}`}>
                            <span className="truncate">{truncateName(userData?.displayName || `User ${id}`)}</span>
                                  {isAdmin && <Badge variant="secondary" className="text-xs group-hover:opacity-0">Admin</Badge>}
                                  {id === user?.uid && <Badge variant="outline" className="text-xs group-hover:opacity-0">You</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">Member</div>
                          {/* Admin controls - shown below on smaller screens or when needed */}
                          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 md:hidden">
                            {isCurrentUserAdmin && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  assignAdmin(id)
                                }}
                                className="h-7 px-2 text-xs text-white bg-destructive hover:bg-destructive/80 outline-none focus:outline-none focus-visible:ring-0 ring-0"
                              >
                                {isAdmin ? 'Remove Admin' : 'Make Admin'}
                              </Button>
                            )}
                            {id !== user?.uid && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMemberToRemove(id)
                                }}
                                className="h-7 px-2 text-xs text-white bg-destructive hover:bg-destructive/80 outline-none focus:outline-none focus-visible:ring-0 ring-0"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Admin controls - desktop version */}
                        <div className="absolute top-1/2 -translate-y-1/2 right-2 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {isCurrentUserAdmin && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                assignAdmin(id)
                              }}
                              className="h-7 px-2 text-xs text-white bg-destructive hover:bg-destructive/80 whitespace-nowrap outline-none focus:outline-none focus-visible:ring-0 ring-0"
                            >
                              {isAdmin ? 'Remove Admin' : 'Make Admin'}
                            </Button>
                          )}
                          {id !== user?.uid && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMemberToRemove(id)
                              }}
                              className="h-7 px-2 text-xs text-white bg-destructive hover:bg-destructive/80 whitespace-nowrap outline-none focus:outline-none focus-visible:ring-0 ring-0"
                            >
                              Remove
                            </Button>
                          )}
                        </div>

                        {/* Hover indicator */}
                        {hoveredMember === id && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Remove Member Confirmation Dialog */}
              <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Remove Member</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to remove this member from the group? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setMemberToRemove(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => memberToRemove && removeMember(memberToRemove)}
                    >
                      Remove
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          )}
          {dialogMode === 'addMember' && (
            <div className="p-6">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialogMode('info')}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle>Add Member</DialogTitle>
                </div>
                <DialogDescription>
                  Select a team member to add to this group.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                {companyUsers
                  .filter(u => !selectedConversation?.participants.includes(u.id))
                  .sort((a, b) => a.displayName.localeCompare(b.displayName))
                  .map((u) => (
                    <div
                      key={u.id}
                      onClick={() => addMember(u.id)}
                      className="p-3 rounded-lg hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors mb-2"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {u.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {u.displayName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                {companyUsers.filter(u => !selectedConversation?.participants.includes(u.id)).length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No available members to add.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}