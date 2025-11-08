import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/quotations/send-email/route'

// Simplified mocks
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: 'test-email-id' },
        error: null
      })
    }
  }))
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {}
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({
      company_name: 'Test Company',
      company_location: 'Test Location',
      phone: '+639123456789',
      email: 'test@ohplus.ph',
      website: 'www.testcompany.com',
      photo_url: 'https://example.com/logo.jpg'
    })
  } as any)
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn().mockReturnValue('mock-storage-ref' as any),
  uploadBytes: vi.fn().mockResolvedValue({} as any),
  getDownloadURL: vi.fn().mockResolvedValue('https://storage.example.com/file.pdf')
}))

vi.mock('@/lib/email-service', () => ({
  emailService: {
    createEmail: vi.fn().mockResolvedValue('test-email-doc-id')
  }
}))

vi.mock('node-vibrant/node', () => {
  throw new Error('Module not found')
})

// Mock fetch for image URL to data URI conversion
Object.defineProperty(global, 'fetch', {
  writable: true,
  value: vi.fn().mockResolvedValue({
    ok: true,
    headers: {
      get: () => 'image/jpeg'
    },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
  } as any)
})

// Mock environment variables
Object.defineProperty(process, 'env', {
  value: {
    RESEND_API_KEY: 'test-resend-api-key',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000'
  }
})

describe('/api/quotations/send-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should send email successfully with basic quotation data', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        subject: 'Custom Subject',
        body: 'Custom body message',
        currentUserEmail: 'sales@testcompany.com',
        userData: {
          company_id: 'test-company-id',
          first_name: 'John',
          last_name: 'Doe',
          phone_number: '+639123456789',
          position: 'Sales Executive'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.message).toContain('Email sent successfully')
    })

    it('should return 400 error for missing quotation', async () => {
      const requestBody = {
        clientEmail: 'client@example.com',
        // Missing quotation
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Missing quotation or client email address')
    })

    it('should return 400 error for missing client email', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        // Missing clientEmail
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Missing quotation or client email address')
    })

    it('should return 400 error for invalid email format', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'invalid-email',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe("Invalid 'To' email address format")
    })

    it('should return 500 error when RESEND_API_KEY is missing', async () => {
      // Temporarily remove API key
      const originalApiKey = process.env.RESEND_API_KEY
      process.env.RESEND_API_KEY = undefined

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Email service not configured')

      // Restore API key
      process.env.RESEND_API_KEY = originalApiKey
    })
  })
})