export interface ChatConversation {
  id: string
  userId: string
  userEmail?: string
  title: string
  startedAt: Date
  lastMessageAt: Date
  messageCount: number
  status: "active" | "archived" | "deleted"
  tags: string[]
  rating?: number // 1-5 star rating from user
  feedback?: string
  currentPage?: string
  sessionId: string
  metadata: {
    userAgent?: string
    platform?: string
    location?: string
  }
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: "user" | "model"
  content: string
  timestamp: Date
  currentPage?: string
  responseTime?: number // milliseconds for AI responses
  tokenCount?: number
  metadata: {
    userAgent?: string
    platform?: string
    errorOccurred?: boolean
    retryCount?: number
  }
}

export interface ChatAnalytics {
  id: string
  date: string // YYYY-MM-DD format
  totalConversations: number
  totalMessages: number
  averageMessagesPerConversation: number
  averageResponseTime: number
  topPages: Array<{ page: string; count: number }>
  topQuestions: Array<{ question: string; count: number }>
  userSatisfactionRating: number
  errorRate: number
  peakHours: Array<{ hour: number; count: number }>
  createdAt: Date
  updatedAt: Date
}

export interface ChatSession {
  id: string
  userId: string
  startedAt: Date
  endedAt?: Date
  conversationIds: string[]
  totalMessages: number
  duration?: number // in minutes
  pages: string[] // pages visited during session
}
