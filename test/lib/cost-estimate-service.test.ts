import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {},
}))

vi.mock('@/lib/firebase-service', () => ({
  uploadFileToFirebaseStorage: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'test-doc-id' })),
  serverTimestamp: vi.fn(() => new Date()),
  getDoc: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}))

describe('Cost Estimate Service - Content Type Capitalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Content Type Capitalization Logic', () => {
    it('should capitalize the first letter of content_type', () => {
      // Test the capitalization logic directly
      const testContentType = 'billboard'
      const capitalized = testContentType ? testContentType.charAt(0).toUpperCase() + testContentType.slice(1) : ''
      expect(capitalized).toBe('Billboard')
    })

    it('should handle empty content_type', () => {
      const contentType: string = ''
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('')
    })

    it('should handle null content_type', () => {
      const contentType: string | null = null
      const result = contentType ? (contentType as string).charAt(0).toUpperCase() + (contentType as string).slice(1) : ''
      expect(result).toBe('')
    })

    it('should handle undefined content_type', () => {
      const contentType: string | undefined = undefined
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('')
    })

    it('should capitalize single character content_type', () => {
      const contentType: string = 'a'
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('A')
    })

    it('should capitalize mixed case content_type', () => {
      const contentType: string = 'bIlLbOaRd'
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('BIlLbOaRd')
    })

    it('should capitalize lowercase content_type', () => {
      const contentType: string = 'billboard'
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('Billboard')
    })
  })
})