import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE, GET } from '@/app/api/messages/[id]/route'

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
  Timestamp: {
    fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }))
  }
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {}
}))

describe('/api/messages/[id] DELETE and GET', () => {
  let mockGetDoc: any
  let mockUpdateDoc: any
  let mockDoc: any
  let mockGetDocs: any
  let mockQuery: any
  let mockWhere: any
  let mockOrderBy: any
  let mockLimit: any
  let mockStartAfter: any
  let mockCollection: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked functions
    const firestoreModule = await import('firebase/firestore')
    mockGetDoc = vi.mocked(firestoreModule.getDoc)
    mockUpdateDoc = vi.mocked(firestoreModule.updateDoc)
    mockDoc = vi.mocked(firestoreModule.doc)
    mockGetDocs = vi.mocked(firestoreModule.getDocs)
    mockQuery = vi.mocked(firestoreModule.query)
    mockWhere = vi.mocked(firestoreModule.where)
    mockOrderBy = vi.mocked(firestoreModule.orderBy)
    mockLimit = vi.mocked(firestoreModule.limit)
    mockStartAfter = vi.mocked(firestoreModule.startAfter)
    mockCollection = vi.mocked(firestoreModule.collection)

    // Setup default mocks
    mockDoc.mockReturnValue('mock-doc-ref')
    mockCollection.mockReturnValue('mock-collection-ref')
    mockQuery.mockReturnValue('mock-query-ref')
    mockWhere.mockReturnValue('mock-where-ref')
    mockOrderBy.mockReturnValue('mock-order-ref')
    mockLimit.mockReturnValue('mock-limit-ref')
    mockStartAfter.mockReturnValue('mock-start-after-ref')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('DELETE /api/messages/[id]', () => {
    it('should successfully delete a message and set deletedAt with serverTimestamp', async () => {
      // Mock message exists and user is sender
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          senderId: 'user-123',
          conversationId: 'conv-123',
          content: 'Test message'
        })
      } as any)

      mockUpdateDoc.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/messages/msg-123', {
        method: 'DELETE'
      })

      // Add userId to search params
      const url = new URL(request.url)
      url.searchParams.set('userId', 'user-123')
      const requestWithUser = new NextRequest(url.toString(), {
        method: 'DELETE'
      })

      const response = await DELETE(requestWithUser, { params: Promise.resolve({ id: 'msg-123' }) })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.message).toBe('Message marked as deleted successfully')

      // Verify updateDoc was called with serverTimestamp
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', {
        deletedAt: { seconds: expect.any(Number), nanoseconds: 0 }
      })
    })

    it('should return 401 when userId is not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/messages/msg-123', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'msg-123' }) })
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })

    it('should return 404 when message does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => ({})
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/msg-123?userId=user-123', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'msg-123' }) })
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.error).toBe('Message not found')
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })

    it('should return 403 when user is not the sender', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          senderId: 'other-user-456', // Different sender
          conversationId: 'conv-123',
          content: 'Test message'
        })
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/msg-123?userId=user-123', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'msg-123' }) })
      const result = await response.json()

      expect(response.status).toBe(403)
      expect(result.error).toBe('Access denied')
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })

    it('should return 500 on database error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/messages/msg-123?userId=user-123', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: 'msg-123' }) })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Failed to delete message')
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/messages/[id]', () => {
    it('should return messages and filter out deleted ones', async () => {
      // Mock conversation exists and user is participant
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          participants: ['user-123', 'user-456']
        })
      } as any)

      // Mock messages query result with mix of deleted and non-deleted messages
      const mockMessages = [
        {
          id: 'msg-1',
          data: () => ({
            conversationId: 'conv-123',
            senderId: 'user-123',
            content: 'Active message 1',
            timestamp: { seconds: 1000000, nanoseconds: 0, toDate: () => new Date(1000000000) },
            deletedAt: undefined // Not deleted
          })
        },
        {
          id: 'msg-2',
          data: () => ({
            conversationId: 'conv-123',
            senderId: 'user-456',
            content: 'Deleted message',
            timestamp: { seconds: 1000001, nanoseconds: 0, toDate: () => new Date(1000001000) },
            deletedAt: { seconds: 1000002, nanoseconds: 0, toDate: () => new Date(1000002000) } // Deleted
          })
        },
        {
          id: 'msg-3',
          data: () => ({
            conversationId: 'conv-123',
            senderId: 'user-123',
            content: 'Active message 2',
            timestamp: { seconds: 1000003, nanoseconds: 0, toDate: () => new Date(1000003000) },
            deletedAt: undefined // Not deleted
          })
        }
      ]

      mockGetDocs.mockResolvedValue({
        size: 3,
        docs: mockMessages
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/conv-123?userId=user-123', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: 'conv-123' }) })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.messages).toHaveLength(2) // Only non-deleted messages
      expect(result.messages[0].id).toBe('msg-3') // Should be in reverse chronological order
      expect(result.messages[1].id).toBe('msg-1')
      expect(result.hasMore).toBe(false)
    })

    it('should return empty array when all messages are deleted', async () => {
      // Mock conversation exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          participants: ['user-123']
        })
      } as any)

      // Mock all messages are deleted
      const mockMessages = [
        {
          id: 'msg-1',
          data: () => ({
            conversationId: 'conv-123',
            senderId: 'user-123',
            content: 'Deleted message 1',
            timestamp: { seconds: 1000000, nanoseconds: 0, toDate: () => new Date(1000000000) },
            deletedAt: { seconds: 1000001, nanoseconds: 0, toDate: () => new Date(1000001000) }
          })
        },
        {
          id: 'msg-2',
          data: () => ({
            conversationId: 'conv-123',
            senderId: 'user-456',
            content: 'Deleted message 2',
            timestamp: { seconds: 1000002, nanoseconds: 0, toDate: () => new Date(1000002000) },
            deletedAt: { seconds: 1000003, nanoseconds: 0, toDate: () => new Date(1000003000) }
          })
        }
      ]

      mockGetDocs.mockResolvedValue({
        size: 2,
        docs: mockMessages
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/conv-123?userId=user-123', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: 'conv-123' }) })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.messages).toHaveLength(0) // All filtered out
      expect(result.hasMore).toBe(false)
    })

    it('should return 401 when userId is not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/messages/conv-123', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: 'conv-123' }) })
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    })

    it('should return 404 when conversation does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => ({})
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/conv-123?userId=user-123', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: 'conv-123' }) })
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.error).toBe('Conversation not found')
    })

    it('should return 403 when user is not a participant', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          participants: ['user-456', 'user-789'] // User 123 not included
        })
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/conv-123?userId=user-123', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: 'conv-123' }) })
      const result = await response.json()

      expect(response.status).toBe(403)
      expect(result.error).toBe('Access denied')
    })

    it('should handle before parameter for pagination', async () => {
      // Mock conversation exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          participants: ['user-123']
        })
      } as any)

      // Mock before message exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          timestamp: { seconds: 1000000, nanoseconds: 0, toDate: () => new Date(1000000000) }
        })
      } as any)

      // Mock messages after the before message
      const mockMessages = [
        {
          id: 'msg-2',
          data: () => ({
            conversationId: 'conv-123',
            senderId: 'user-123',
            content: 'Message after before',
            timestamp: { seconds: 1000001, nanoseconds: 0, toDate: () => new Date(1000001000) },
            deletedAt: undefined
          })
        }
      ]

      mockGetDocs.mockResolvedValue({
        size: 1,
        docs: mockMessages
      } as any)

      const request = new NextRequest('http://localhost:3000/api/messages/conv-123?userId=user-123&before=msg-1', {
        method: 'GET'
      })

      const response = await GET(request, { params: Promise.resolve({ id: 'conv-123' }) })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].id).toBe('msg-2')
    })
  })
})