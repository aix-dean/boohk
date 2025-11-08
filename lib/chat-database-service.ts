import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  increment,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ChatConversation, ChatMessage, ChatAnalytics } from "@/lib/types/chat"

export class ChatDatabaseService {
  // Convert collections to getter methods to ensure db is initialized
  private get conversationsCollection() {
    return collection(db, "ai_chat_conversations")
  }

  private get messagesCollection() {
    return collection(db, "ai_chat_messages")
  }

  private get analyticsCollection() {
    return collection(db, "ai_chat_analytics")
  }

  private get sessionsCollection() {
    return collection(db, "ai_chat_sessions")
  }

  // Generate session ID
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Create a new conversation
  async createConversation(
    userId: string,
    userEmail: string,
    currentPage?: string,
    sessionId?: string,
  ): Promise<string> {
    try {
      const conversation: Omit<ChatConversation, "id"> = {
        userId,
        userEmail,
        title: "New Conversation",
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 0,
        status: "active",
        tags: [],
        currentPage,
        sessionId: sessionId || this.generateSessionId(),
        metadata: {
          userAgent: undefined,
          platform: undefined,
        },
      }

      // Create the document
      const docRef = await addDoc(this.conversationsCollection, {
        ...conversation,
        startedAt: Timestamp.fromDate(conversation.startedAt),
        lastMessageAt: Timestamp.fromDate(conversation.lastMessageAt),
      })

      // Update the document to include its ID in the id field
      await updateDoc(docRef, { id: docRef.id })

      return docRef.id
    } catch (error) {
      console.error("Error creating conversation:", error)
      throw error
    }
  }

  // Add a message to a conversation (now using top-level collection)
  async addMessage(
    conversationId: string,
    role: "user" | "model",
    content: string,
    currentPage?: string,
    responseTime?: number,
  ): Promise<string> {
    try {
      // Base message object
      const message: Omit<ChatMessage, "id"> = {
        conversationId, // This links the message to its conversation
        role,
        content,
        timestamp: new Date(),
        metadata: {
          errorOccurred: false,
          retryCount: 0,
        },
      }

      // Only add optional fields if they have values
      if (currentPage) {
        message.currentPage = currentPage
      }

      // Only add responseTime if it's a number (not undefined or null)
      if (typeof responseTime === "number") {
        message.responseTime = responseTime
      }

      // Add the message to the top-level messages collection
      const messageRef = await addDoc(this.messagesCollection, {
        ...message,
        timestamp: Timestamp.fromDate(message.timestamp),
      })

      // Update the message to include its ID in the id field
      await updateDoc(messageRef, { id: messageRef.id })

      // Update conversation metadata
      const conversationRef = doc(this.conversationsCollection, conversationId)

      // Create update object with required fields
      const updateData: any = {
        lastMessageAt: Timestamp.fromDate(new Date()),
        messageCount: increment(1),
      }

      // Only add title if it's a user message with content
      if (role === "user" && content.length > 0) {
        updateData.title = content.substring(0, 50) + (content.length > 50 ? "..." : "")
      }

      await updateDoc(conversationRef, updateData)

      // Update daily analytics
      await this.updateDailyAnalytics(currentPage, role, responseTime)

      return messageRef.id
    } catch (error) {
      console.error("Error adding message:", error)
      throw error
    }
  }

  // Get conversation history
  async getConversation(conversationId: string): Promise<ChatConversation | null> {
    try {
      const docRef = doc(this.conversationsCollection, conversationId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ...data,
          startedAt: data.startedAt.toDate(),
          lastMessageAt: data.lastMessageAt.toDate(),
        } as ChatConversation
      }

      return null
    } catch (error) {
      console.error("Error getting conversation:", error)
      throw error
    }
  }

  // Get messages for a conversation (now querying top-level collection)
  async getMessages(conversationId: string, limitCount = 50): Promise<ChatMessage[]> {
    try {
      // Query the top-level messages collection filtered by conversationId
      const q = query(
        this.messagesCollection,
        where("conversationId", "==", conversationId),
        orderBy("timestamp", "asc"),
        limit(limitCount),
      )

      const querySnapshot = await getDocs(q)
      const messages: ChatMessage[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        messages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as ChatMessage)
      })

      return messages
    } catch (error) {
      console.error("Error getting messages:", error)
      throw error
    }
  }

  // Get user's conversation history
  async getUserConversations(userId: string, limitCount = 20): Promise<ChatConversation[]> {
    try {
      const q = query(
        this.conversationsCollection,
        where("userId", "==", userId),
        where("status", "==", "active"),
        orderBy("lastMessageAt", "desc"),
        limit(limitCount),
      )

      const querySnapshot = await getDocs(q)
      const conversations: ChatConversation[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        conversations.push({
          id: doc.id,
          ...data,
          startedAt: data.startedAt.toDate(),
          lastMessageAt: data.lastMessageAt.toDate(),
        } as ChatConversation)
      })

      return conversations
    } catch (error) {
      console.error("Error getting user conversations:", error)
      throw error
    }
  }

  // Update daily analytics
  private async updateDailyAnalytics(
    currentPage?: string,
    role?: "user" | "model",
    responseTime?: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
      const analyticsRef = doc(this.analyticsCollection, today)
      const analyticsSnap = await getDoc(analyticsRef)

      if (analyticsSnap.exists()) {
        // Update existing analytics
        const updates: any = {
          totalMessages: increment(1),
          updatedAt: Timestamp.fromDate(new Date()),
        }

        if (role === "user") {
          updates.totalConversations = increment(1)
        }

        if (typeof responseTime === "number" && role === "model") {
          // This is simplified - in production, you'd want to calculate running average
          updates.averageResponseTime = responseTime
        }

        if (currentPage) {
          updates[`topPages.${currentPage}`] = increment(1)
        }

        await updateDoc(analyticsRef, updates)
      } else {
        // Create new analytics document
        const analytics: Omit<ChatAnalytics, "id"> = {
          date: today,
          totalConversations: role === "user" ? 1 : 0,
          totalMessages: 1,
          averageMessagesPerConversation: 1,
          averageResponseTime: typeof responseTime === "number" ? responseTime : 0,
          topPages: currentPage ? [{ page: currentPage, count: 1 }] : [],
          topQuestions: [],
          userSatisfactionRating: 0,
          errorRate: 0,
          peakHours: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        // Create the document
        await setDoc(analyticsRef, {
          ...analytics,
          id: today, // Use the date as the ID
          createdAt: Timestamp.fromDate(analytics.createdAt),
          updatedAt: Timestamp.fromDate(analytics.updatedAt),
        })
      }
    } catch (error) {
      console.error("Error updating analytics:", error)
      // Don't throw error for analytics - it shouldn't break the main flow
    }
  }

  // Get analytics for a date range
  async getAnalytics(startDate: string, endDate: string): Promise<ChatAnalytics[]> {
    try {
      const q = query(
        this.analyticsCollection,
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc"),
      )

      const querySnapshot = await getDocs(q)
      const analytics: ChatAnalytics[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        analytics.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as ChatAnalytics)
      })

      return analytics
    } catch (error) {
      console.error("Error getting analytics:", error)
      throw error
    }
  }

  // Rate a conversation
  async rateConversation(conversationId: string, rating: number, feedback?: string): Promise<void> {
    try {
      const conversationRef = doc(this.conversationsCollection, conversationId)
      const updateData: any = { rating }

      if (feedback) {
        updateData.feedback = feedback
      }

      await updateDoc(conversationRef, updateData)
    } catch (error) {
      console.error("Error rating conversation:", error)
      throw error
    }
  }

  // Archive a conversation
  async archiveConversation(conversationId: string): Promise<void> {
    try {
      const conversationRef = doc(this.conversationsCollection, conversationId)
      await updateDoc(conversationRef, {
        status: "archived",
      })
    } catch (error) {
      console.error("Error archiving conversation:", error)
      throw error
    }
  }

  // Search conversations
  async searchConversations(userId: string, searchTerm: string, limitCount = 10): Promise<ChatConversation[]> {
    try {
      // Note: Firestore doesn't support full-text search natively
      // This is a basic implementation - for production, consider using Algolia or similar
      const q = query(
        this.conversationsCollection,
        where("userId", "==", userId),
        where("status", "==", "active"),
        orderBy("lastMessageAt", "desc"),
        limit(limitCount),
      )

      const querySnapshot = await getDocs(q)
      const conversations: ChatConversation[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const conversation = {
          id: doc.id,
          ...data,
          startedAt: data.startedAt.toDate(),
          lastMessageAt: data.lastMessageAt.toDate(),
        } as ChatConversation

        // Simple text search in title
        if (conversation.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          conversations.push(conversation)
        }
      })

      return conversations
    } catch (error) {
      console.error("Error searching conversations:", error)
      throw error
    }
  }

  // Get conversation statistics for admin
  async getConversationStats(): Promise<{
    totalConversations: number
    totalMessages: number
    activeUsers: number
    averageRating: number
  }> {
    try {
      // Get conversation stats
      const conversationsSnapshot = await getDocs(this.conversationsCollection)

      let totalConversations = 0
      let totalRatings = 0
      let ratingCount = 0
      const uniqueUsers = new Set<string>()

      conversationsSnapshot.forEach((doc) => {
        const data = doc.data()
        totalConversations++
        uniqueUsers.add(data.userId)

        if (data.rating) {
          totalRatings += data.rating
          ratingCount++
        }
      })

      // Get message count from messages collection
      const messagesSnapshot = await getDocs(this.messagesCollection)
      const totalMessages = messagesSnapshot.size

      return {
        totalConversations,
        totalMessages,
        activeUsers: uniqueUsers.size,
        averageRating: ratingCount > 0 ? totalRatings / ratingCount : 0,
      }
    } catch (error) {
      console.error("Error getting conversation stats:", error)
      throw error
    }
  }

  // Create a new session
  async createSession(userId: string): Promise<string> {
    try {
      const sessionId = this.generateSessionId()
      const session = {
        id: sessionId,
        userId,
        startedAt: new Date(),
        conversationIds: [],
        totalMessages: 0,
        pages: [],
      }

      // Create the document with the generated ID
      await setDoc(doc(this.sessionsCollection, sessionId), {
        ...session,
        startedAt: Timestamp.fromDate(session.startedAt),
      })

      return sessionId
    } catch (error) {
      console.error("Error creating session:", error)
      throw error
    }
  }
}

// Export singleton instance
export const chatDB = new ChatDatabaseService()

// Add these exports at the end of the file
export const saveChatMessage = (
  conversationId: string,
  role: "user" | "model",
  content: string,
  currentPage?: string,
  responseTime?: number,
) => {
  return chatDB.addMessage(conversationId, role, content, currentPage, responseTime)
}

export const saveConversation = (userId: string, userEmail: string, currentPage?: string, sessionId?: string) => {
  return chatDB.createConversation(userId, userEmail, currentPage, sessionId)
}
