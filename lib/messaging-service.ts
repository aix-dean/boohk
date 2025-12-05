import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Conversation, Message, User, TypingIndicator } from "@/lib/types/messaging"

// Real-time listeners for conversations
export function subscribeToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): () => void {
  const conversationsRef = collection(db, "conversations")
  const q = query(
    conversationsRef,
    where("participants", "array-contains", userId),
    orderBy("updatedAt", "desc")
  )

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      try {
        const conversations: Conversation[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            participants: data.participants || [],
            type: data.type || "direct",
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastMessage: data.lastMessage ? {
              id: data.lastMessage.id,
              conversationId: doc.id,
              senderId: data.lastMessage.senderId,
              type: data.lastMessage.type || "text",
              content: data.lastMessage.content || "",
              timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
              editedAt: data.lastMessage.editedAt?.toDate(),
              deletedAt: data.lastMessage.deletedAt?.toDate(),
              metadata: data.lastMessage.metadata,
              status: data.lastMessage.status || { delivered: {}, read: {} },
              reactions: data.lastMessage.reactions || {},
            } : undefined,
            unreadCount: data.unreadCount || {},
            metadata: data.metadata,
            settings: data.settings || {
              isArchived: false,
              isMuted: false,
              muteUntil: undefined,
              pinned: false,
            },
          } as Conversation
        })
        callback(conversations)
      } catch (error) {
        console.error("Error processing conversations snapshot:", error)
        onError?.(error as Error)
      }
    },
    (error) => {
      console.error("Error in conversations listener:", error)
      onError?.(error)
    }
  )

  return unsubscribe
}

// Real-time listeners for messages in a conversation
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void
): () => void {
  const messagesRef = collection(db, "messages")
  const q = query(
    messagesRef,
    where("conversationId", "==", conversationId),
    orderBy("timestamp", "asc")
  )

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      try {
        const messages: Message[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            conversationId: data.conversationId,
            senderId: data.senderId,
            type: data.type || "text",
            content: data.content || "",
            timestamp: data.timestamp?.toDate() || new Date(),
            editedAt: data.editedAt?.toDate(),
            deletedAt: data.deletedAt?.toDate(),
            metadata: data.metadata,
            status: data.status || { delivered: {}, read: {} },
            reactions: data.reactions || {},
          } as Message
        })
        callback(messages)
      } catch (error) {
        console.error("Error processing messages snapshot:", error)
        onError?.(error as Error)
      }
    },
    (error) => {
      console.error("Error in messages listener:", error)
      onError?.(error)
    }
  )

  return unsubscribe
}

// Real-time listeners for typing indicators
export function subscribeToTypingIndicators(
  conversationId: string,
  currentUserId: string,
  callback: (typingUsers: string[]) => void,
  onError?: (error: Error) => void
): () => void {
  const typingRef = collection(db, "typing_indicators")
  const q = query(
    typingRef,
    where("conversationId", "==", conversationId)
  )

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      try {
        const typingUsers = snapshot.docs
          .filter((doc) => {
            const data = doc.data()
            // Filter out current user and check if indicator is recent (within 30 seconds)
            const timestamp = data.timestamp?.toDate() || new Date()
            const thirtySecondsAgo = new Date(Date.now() - 30000)
            return data.userId !== currentUserId && timestamp > thirtySecondsAgo
          })
          .map((doc) => doc.data().userId)
        callback(typingUsers)
      } catch (error) {
        console.error("Error processing typing indicators snapshot:", error)
        onError?.(error as Error)
      }
    },
    (error) => {
      console.error("Error in typing indicators listener:", error)
      onError?.(error)
    }
  )

  return unsubscribe
}

// Send typing indicator
export async function sendTypingIndicator(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const indicatorId = `${conversationId}_${userId}`
    const typingRef = doc(db, "typing_indicators", indicatorId)

    await updateDoc(typingRef, {
      conversationId,
      userId,
      timestamp: serverTimestamp(),
    })
  } catch (error) {
    // If document doesn't exist, create it
    try {
      const typingRef = collection(db, "typing_indicators")
      await addDoc(typingRef, {
        conversationId,
        userId,
        timestamp: serverTimestamp(),
      })
    } catch (createError) {
      console.error("Error sending typing indicator:", createError)
    }
  }
}

// Send message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: "text" | "image" | "file" = "text",
  metadata?: any
): Promise<string> {
  try {
    const messageData = {
      conversationId,
      senderId,
      type,
      content,
      timestamp: serverTimestamp(),
      metadata,
      status: {
        delivered: {},
        read: {},
      },
      reactions: {},
    }

    const docRef = await addDoc(collection(db, "messages"), messageData)

    // Update conversation's last message and updatedAt
    const conversationRef = doc(db, "conversations", conversationId)
    await updateDoc(conversationRef, {
      lastMessage: {
        id: docRef.id,
        senderId,
        content,
        timestamp: serverTimestamp(),
        type,
      },
      updatedAt: serverTimestamp(),
    })

    return docRef.id
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

// Mark messages as read
export async function markMessagesAsRead(
  conversationId: string,
  userId: string,
  messageIds: string[]
): Promise<void> {
  try {
    const updates = messageIds.map(async (messageId) => {
      const messageRef = doc(db, "messages", messageId)
      const updateData: any = {}
      updateData[`status.read.${userId}`] = serverTimestamp()
      await updateDoc(messageRef, updateData)
    })

    await Promise.all(updates)

    // Update conversation unread count
    const conversationRef = doc(db, "conversations", conversationId)
    const updateData: any = {}
    updateData[`unreadCount.${userId}`] = 0
    await updateDoc(conversationRef, updateData)
  } catch (error) {
    console.error("Error marking messages as read:", error)
    throw error
  }
}

// Create new conversation
export async function createConversation(
  participants: string[],
  type: "direct" | "group" = "direct",
  metadata?: any
): Promise<string> {
  try {
    const conversationData = {
      participants,
      type,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadCount: participants.reduce((acc, participant) => {
        acc[participant] = 0
        return acc
      }, {} as Record<string, number>),
      metadata,
      settings: {
        isArchived: false,
        isMuted: false,
        pinned: false,
      },
    }

    const docRef = await addDoc(collection(db, "conversations"), conversationData)
    return docRef.id
  } catch (error) {
    console.error("Error creating conversation:", error)
    throw error
  }
}

// Get users for messaging (company users)
export async function getMessagingUsers(userId: string): Promise<User[]> {
  try {
    // This would typically fetch from a users collection
    // For now, return empty array as this might be handled by API
    const usersRef = collection(db, "users")
    const q = query(usersRef, where("id", "!=", userId), limit(50))
    const snapshot = await getDocs(q)

    const users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        displayName: data.displayName || data.name || "",
        email: data.email || "",
        avatar: data.avatar,
        status: data.status || "offline",
        lastSeen: data.lastSeen?.toDate() || new Date(),
        phoneNumber: data.phoneNumber,
        bio: data.bio,
        preferences: data.preferences || {
          notifications: true,
          readReceipts: true,
          typingIndicators: true,
        },
        contacts: data.contacts || [],
        blockedUsers: data.blockedUsers || [],
      } as User
    })

    return users
  } catch (error) {
    console.error("Error fetching messaging users:", error)
    return []
  }
}

// Get conversations (fallback static method)
export async function getConversations(userId: string): Promise<Conversation[]> {
  try {
    const conversationsRef = collection(db, "conversations")
    const q = query(
      conversationsRef,
      where("participants", "array-contains", userId),
      orderBy("updatedAt", "desc")
    )

    const snapshot = await getDocs(q)
    const conversations: Conversation[] = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        participants: data.participants || [],
        type: data.type || "direct",
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastMessage: data.lastMessage ? {
          id: data.lastMessage.id,
          conversationId: doc.id,
          senderId: data.lastMessage.senderId,
          type: data.lastMessage.type || "text",
          content: data.lastMessage.content || "",
          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
          editedAt: data.lastMessage.editedAt?.toDate(),
          deletedAt: data.lastMessage.deletedAt?.toDate(),
          metadata: data.lastMessage.metadata,
          status: data.lastMessage.status || { delivered: {}, read: {} },
          reactions: data.lastMessage.reactions || {},
        } : undefined,
        unreadCount: data.unreadCount || {},
        metadata: data.metadata,
        settings: data.settings || {
          isArchived: false,
          isMuted: false,
          muteUntil: undefined,
          pinned: false,
        },
      } as Conversation
    })

    return conversations
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return []
  }
}

// Get messages for a conversation (fallback static method)
export async function getMessages(
  conversationId: string,
  limitCount: number = 50
): Promise<Message[]> {
  try {
    const messagesRef = collection(db, "messages")
    const q = query(
      messagesRef,
      where("conversationId", "==", conversationId),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    )

    const snapshot = await getDocs(q)
    const messages: Message[] = snapshot.docs
      .map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          type: data.type || "text",
          content: data.content || "",
          timestamp: data.timestamp?.toDate() || new Date(),
          editedAt: data.editedAt?.toDate(),
          deletedAt: data.deletedAt?.toDate(),
          metadata: data.metadata,
          status: data.status || { delivered: {}, read: {} },
          reactions: data.reactions || {},
        } as Message
      })
      .reverse() // Reverse to get chronological order

    return messages
  } catch (error) {
    console.error("Error fetching messages:", error)
    return []
  }
}