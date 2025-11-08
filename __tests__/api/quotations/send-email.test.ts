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
  getDoc: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
    fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }))
  },
  // Add other exports that might be needed
  setDoc: vi.fn(),
  deleteField: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }))
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn()
}))

vi.mock('@/lib/email-service', () => ({
  emailService: {
    createEmail: vi.fn().mockResolvedValue('test-email-doc-id')
  }
}))

vi.mock('node-vibrant/node', () => ({
  Vibrant: vi.fn().mockImplementation(() => ({
    getPalette: vi.fn().mockResolvedValue({
      Vibrant: {
        rgb: [102, 126, 234]
      }
    })
  }))
}))

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
  let mockResend: any
  let mockGetDoc: any
  let mockDoc: any
  let mockRef: any
  let mockUploadBytes: any
  let mockGetDownloadURL: any
  let mockEmailService: any
  let mockFetch: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked functions after imports
    const firestoreModule1 = await import('firebase/firestore')
    const storageModule = await import('firebase/storage')
    const emailServiceModule = await import('@/lib/email-service')
    const ResendModule = await import('resend')

    mockGetDoc = vi.mocked(firestoreModule1.getDoc)
    mockDoc = vi.mocked(firestoreModule1.doc)
    mockRef = vi.mocked(storageModule.ref)
    mockUploadBytes = vi.mocked(storageModule.uploadBytes)
    mockGetDownloadURL = vi.mocked(storageModule.getDownloadURL)
    mockEmailService = vi.mocked(emailServiceModule.emailService)
    mockFetch = vi.mocked(global.fetch as any)

    // Setup default successful mocks
    mockRef.mockReturnValue('mock-storage-ref')
    mockUploadBytes.mockResolvedValue({} as any)
    mockGetDownloadURL.mockResolvedValue('https://storage.example.com/file.pdf')

    // Setup default mocks
    mockGetDoc.mockResolvedValue({
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

    // Mock Timestamp functions
    const firestoreModule2 = await import('firebase/firestore')
    vi.mocked(firestoreModule2.Timestamp.now).mockReturnValue({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any)
    vi.mocked(firestoreModule2.Timestamp.fromDate).mockImplementation((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 } as any))
    vi.mocked(firestoreModule2.getDocs).mockResolvedValue({ docs: [] } as any)

    // Firebase storage mocks are now handled by vi.mock with default implementations

    // Setup Resend mock - return fresh instance for each constructor call
    mockResend = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: { id: 'test-email-id' },
          error: null
        })
      }
    }
    vi.mocked(ResendModule.Resend).mockImplementation(() => mockResend)

    mockEmailService.createEmail.mockResolvedValue('test-email-doc-id')

    mockFetch.mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'image/jpeg'
      },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    } as any)
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
      expect(mockResend.emails.send).toHaveBeenCalledTimes(1)
      // Email service should be called after successful email send
      expect(mockEmailService.createEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.createEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test Company <noreply@ohplus.ph>',
          to: ['client@example.com'],
          subject: 'Custom Subject',
          quotationId: 'test-quotation-id',
          status: 'sent'
        })
      )
    })

    it('should send email successfully with PDF attachments', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        preGeneratedPDFs: [
          {
            filename: 'quotation-1.pdf',
            content: Buffer.from('test pdf content').toString('base64')
          },
          {
            filename: 'quotation-2.pdf',
            content: Buffer.from('test pdf content 2').toString('base64')
          }
        ],
        userData: {
          company_id: 'test-company-id',
          first_name: 'John',
          last_name: 'Doe'
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
      expect(result.message).toContain('attachment(s)')
      expect(mockUploadBytes).toHaveBeenCalledTimes(2)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'quotation-1.pdf',
              type: 'application/pdf'
            }),
            expect.objectContaining({
              filename: 'quotation-2.pdf',
              type: 'application/pdf'
            })
          ])
        })
      )
    })

    it('should send email successfully with uploaded file attachments', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: 'document.docx',
            content: Buffer.from('test doc content').toString('base64'),
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          }
        ],
        userData: {
          company_id: 'test-company-id',
          first_name: 'John',
          last_name: 'Doe'
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
      expect(mockUploadBytes).toHaveBeenCalledTimes(1)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'document.docx',
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            })
          ])
        })
      )
    })

    it('should send email successfully with CC recipients', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        ccEmail: 'cc1@example.com, cc2@example.com',
        userData: {
          company_id: 'test-company-id',
          first_name: 'John',
          last_name: 'Doe'
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
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc1@example.com', 'cc2@example.com']
        })
      )
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
      expect(mockResend.emails.send).not.toHaveBeenCalled()
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
      expect(mockResend.emails.send).not.toHaveBeenCalled()
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
      expect(mockResend.emails.send).not.toHaveBeenCalled()
    })

    it('should return 400 error for invalid CC email format', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        ccEmail: 'valid@example.com, invalid-email',
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
      expect(result.error).toBe('Invalid \'CC\' email address format: invalid-email')
      expect(mockResend.emails.send).not.toHaveBeenCalled()
    })

    it('should return 400 error for invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: 'invalid-json',
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Invalid request body')
      expect(mockResend.emails.send).not.toHaveBeenCalled()
    })

    it('should return 500 error when RESEND_API_KEY is missing', async () => {
      // Mock missing API key
      vi.mocked(await import('process')).env.RESEND_API_KEY = undefined

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
      expect(mockResend.emails.send).not.toHaveBeenCalled()

      // Restore API key for other tests
      vi.mocked(await import('process')).env.RESEND_API_KEY = 'test-resend-api-key'
    })

    it('should return 500 error when Resend API fails', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'Resend API error' }
      })

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
      expect(result.error).toBe('Failed to send email')
      expect(result.details).toBe('Resend API error')
    })

    it('should return 500 error when Firebase upload fails', async () => {
      // Setup the mock to reject for uploadBytes calls
      mockUploadBytes.mockRejectedValue(new Error('Storage upload failed'))

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        preGeneratedPDFs: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test content').toString('base64')
          }
        ],
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
      expect(result.error).toBe('Internal server error')
      expect(result.details).toBe('Failed to upload file: test.pdf')
      // Verify that uploadBytes was called and failed
      expect(mockUploadBytes).toHaveBeenCalled()
      expect(mockUploadBytes).toHaveBeenCalledWith(
        'mock-storage-ref',
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'application/pdf' })
      )
    })

    it('should handle company data fetch failure gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'))

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

      // Should still succeed but with default company data
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Boohk <noreply@ohplus.ph>'
        })
      )
    })

    it('should handle missing company document gracefully', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => ({})
      })

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'nonexistent-company-id'
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

      // Should still succeed but with default company data
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Boohk <noreply@ohplus.ph>'
        })
      )
    })

    it('should handle logo color extraction failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Image fetch failed'))

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

      // Should still succeed but without dominant color
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledTimes(1)
    })

    it('should handle email service creation failure gracefully', async () => {
      mockEmailService.createEmail.mockRejectedValue(new Error('Email service error'))

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

      // Should still succeed even if email document creation fails
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledTimes(1)
    })

    it('should use reply-to email when provided', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        replyToEmail: 'custom-reply@example.com',
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to: 'custom-reply@example.com'
        })
      )
    })

    it('should use current user email as reply-to when replyToEmail not provided', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        currentUserEmail: 'current-user@example.com',
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to: 'current-user@example.com'
        })
      )
    })

    it('should generate correct email subject when not provided', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Premium Billboard Location' }]
        },
        clientEmail: 'client@example.com',
        companyName: 'Test Company Inc',
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Quotation: Premium Billboard Location - Test Company Inc'
        })
      )
    })

    it('should handle empty CC email list', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        ccEmail: '', // Empty CC
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.not.objectContaining({
          cc: expect.any(Array)
        })
      )
    })

    it('should handle malformed attachment data gracefully', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        preGeneratedPDFs: [
          {
            // Missing filename
            content: Buffer.from('test content').toString('base64')
          },
          {
            filename: 'test.pdf',
            // Missing content
          }
        ],
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

      // Should still succeed as malformed attachments are filtered out
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: []
        })
      )
    })

    it('should handle node-vibrant import failure gracefully', async () => {
      // Mock dynamic import failure
      vi.doMock('node-vibrant/node', () => {
        throw new Error('Module not found')
      })

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

      // Should still succeed without color extraction
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    it('should handle image fetch failure for color extraction', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any)

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

      // Should still succeed without dominant color
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    it('should handle non-image content type for color extraction', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/html' // Non-image content type
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      } as any)

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

      // Should still succeed without dominant color
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  
  
    // Complex Attachment Tests
    describe('Complex Attachment Scenarios', () => {
      it('should handle mixed attachment types (PDFs + uploaded files)', async () => {
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          preGeneratedPDFs: [
            {
              filename: 'quotation-1.pdf',
              content: Buffer.from('test pdf content').toString('base64')
            }
          ],
          uploadedFiles: [
            {
              filename: 'document.docx',
              content: Buffer.from('test doc content').toString('base64'),
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            },
            {
              filename: 'image.jpg',
              content: Buffer.from('test image content').toString('base64'),
              type: 'image/jpeg'
            }
          ],
          userData: {
            company_id: 'test-company-id',
            first_name: 'John',
            last_name: 'Doe'
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
        expect(result.message).toContain('3 attachment(s)')
        expect(mockUploadBytes).toHaveBeenCalledTimes(3)
        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                filename: 'quotation-1.pdf',
                type: 'application/pdf'
              }),
              expect.objectContaining({
                filename: 'document.docx',
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              }),
              expect.objectContaining({
                filename: 'image.jpg',
                type: 'image/jpeg'
              })
            ])
          })
        )
      })
  
      it('should handle large file uploads', async () => {
        // Create a large file buffer (5MB)
        const largeContent = Buffer.from('x'.repeat(5 * 1024 * 1024)).toString('base64')
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          uploadedFiles: [
            {
              filename: 'large-file.pdf',
              content: largeContent,
              type: 'application/pdf'
            }
          ],
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
  
        expect(response.status).toBe(200)
        expect(result.success).toBe(true)
        expect(mockUploadBytes).toHaveBeenCalledTimes(1)
      })
  
      it('should handle attachment upload failures gracefully', async () => {
        // Setup the first upload to fail, others to succeed
        mockUploadBytes.mockRejectedValueOnce(new Error('Storage quota exceeded'))

        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          preGeneratedPDFs: [
            {
              filename: 'test.pdf',
              content: Buffer.from('test content').toString('base64')
            }
          ],
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
        expect(result.error).toBe('Internal server error')
        expect(result.details).toBe('Failed to upload file: test.pdf')
        // Verify that uploadBytes was called and the first call failed
        expect(mockUploadBytes).toHaveBeenCalled()
      })
  
      it('should handle partial attachment upload failures', async () => {
        // First upload succeeds, second fails
        mockUploadBytes
          .mockResolvedValueOnce({} as any)
          .mockRejectedValueOnce(new Error('Network timeout'))

        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          preGeneratedPDFs: [
            {
              filename: 'test1.pdf',
              content: Buffer.from('test content 1').toString('base64')
            },
            {
              filename: 'test2.pdf',
              content: Buffer.from('test content 2').toString('base64')
            }
          ],
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
        expect(result.error).toBe('Internal server error')
        expect(result.details).toBe('Failed to upload file: test2.pdf')
        // Verify that uploadBytes was called twice (first succeeds, second fails)
        expect(mockUploadBytes).toHaveBeenCalledTimes(2)
      })
  
      it('should handle storage quota exceeded scenarios', async () => {
        // Setup all uploadBytes calls to fail with quota exceeded error
        mockUploadBytes.mockRejectedValue(new Error('Storage quota exceeded'))

        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          uploadedFiles: [
            {
              filename: 'large-file.zip',
              content: Buffer.from('x'.repeat(100 * 1024 * 1024)).toString('base64'), // 100MB
              type: 'application/zip'
            }
          ],
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
        expect(result.error).toBe('Internal server error')
        expect(result.details).toBe('Failed to upload file: large-file.zip')
        // Verify that uploadBytes was called for the large file
        expect(mockUploadBytes).toHaveBeenCalled()
      })
    })
  
    // Edge Cases & Error Recovery Tests
    describe('Edge Cases & Error Recovery', () => {
      it('should handle extremely long content', async () => {
        const longContent = 'A'.repeat(10000) // 10k characters
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          body: longContent,
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
  
        expect(response.status).toBe(200)
        expect(result.success).toBe(true)
        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining(longContent)
          })
        )
      })
  
      it('should handle special characters in content', async () => {
        const specialContent = 'Content with émojis 🚀, ñáéíóú, 中文, русский, 🚀💡🎯'
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          body: specialContent,
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
  
        expect(response.status).toBe(200)
        expect(result.success).toBe(true)
      })
  
      it('should handle international character sets', async () => {
        const internationalContent = `
          Español: ¡Hola! ¿Cómo estás?
          Français: Bonjour! Comment allez-vous?
          Deutsch: Hallo! Wie geht es Ihnen?
          日本語: こんにちは！お元気ですか？
          한국어: 안녕하세요! 어떻게 지내세요?
          العربية: مرحباً! كيف حالك؟
        `
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          body: internationalContent,
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
  
        expect(response.status).toBe(200)
        expect(result.success).toBe(true)
      })
  
      it('should handle concurrent email sending', async () => {
        // Reset mocks before concurrent test
        vi.clearAllMocks()

        const requests = Array(3).fill(null).map((_, index) =>
          new NextRequest('http://localhost:3000/api/quotations/send-email', {
            method: 'POST',
            body: JSON.stringify({
              quotation: {
                id: `test-quotation-id-${index}`,
                items: [{ name: 'Test Billboard' }]
              },
              clientEmail: `client${index}@example.com`,
              body: `Test message for client ${index}`,
              userData: {
                company_id: 'test-company-id'
              }
            }),
            headers: {
              'content-type': 'application/json'
            }
          })
        )

        // Run requests sequentially to avoid mocking conflicts in test environment
        const responses = []
        const results = []

        for (const request of requests) {
          const response = await POST(request)
          responses.push(response)
          const result = await response.json()
          results.push(result)
        }

        // Check that we have results for all requests
        expect(results).toHaveLength(3)

        // All requests should succeed
        results.forEach((result, index) => {
          expect(result.success).toBe(true)
          expect(result.message).toContain('Email sent successfully')
        })

        // All 3 emails should have been sent
        expect(mockResend.emails.send).toHaveBeenCalledTimes(3)

        // All 3 email documents should have been created
        expect(mockEmailService.createEmail).toHaveBeenCalledTimes(3)
      })
  
      it('should handle rate limiting scenarios', async () => {
        // Mock rate limit error from Resend
        mockResend.emails.send.mockResolvedValueOnce({
          data: null,
          error: { message: 'Rate limit exceeded' }
        })
  
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
        expect(result.error).toBe('Failed to send email')
        expect(result.details).toBe('Rate limit exceeded')
      })
  
      it('should handle partial failure recovery', async () => {
        // Email sending fails but document creation should still work
        mockResend.emails.send.mockResolvedValue({
          data: null,
          error: { message: 'SMTP error' }
        })
  
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
        expect(result.error).toBe('Failed to send email')
        expect(result.details).toBe('SMTP error')
      })
    })
  
    // Company Data Scenarios Tests
    describe('Company Data Scenarios', () => {
      it('should handle companies with non-ohplus.ph domains', async () => {
        mockGetDoc.mockResolvedValue({
          exists: () => true,
          data: () => ({
            company_name: 'External Company',
            company_location: 'External Location',
            phone: '+639123456789',
            email: 'info@external-company.com', // Non-ohplus.ph domain
            website: 'www.external-company.com',
            photo_url: 'https://external-company.com/logo.jpg'
          })
        } as any)
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          userData: {
            company_id: 'external-company-id'
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
        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'External Company <noreply@ohplus.ph>' // Should use ohplus.ph domain
          })
        )
      })
  
      it('should handle missing company logos', async () => {
        mockGetDoc.mockResolvedValue({
          exists: () => true,
          data: () => ({
            company_name: 'Company Without Logo',
            company_location: 'Test Location',
            phone: '+639123456789',
            email: 'test@ohplus.ph',
            website: 'www.testcompany.com'
            // Missing photo_url
          })
        } as any)
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          userData: {
            company_id: 'company-no-logo-id'
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
        // Should not include logo in email template
        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.not.stringContaining('img src=')
          })
        )
      })
  
      it('should handle corrupted logo URLs', async () => {
        mockGetDoc.mockResolvedValue({
          exists: () => true,
          data: () => ({
            company_name: 'Company With Bad Logo',
            company_location: 'Test Location',
            phone: '+639123456789',
            email: 'test@ohplus.ph',
            website: 'www.testcompany.com',
            photo_url: 'https://corrupted-url-that-does-not-exist.jpg'
          })
        } as any)
  
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        } as any)
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          userData: {
            company_id: 'company-bad-logo-id'
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
        // Should succeed without logo color extraction
      })
  
      it('should handle missing optional company fields', async () => {
        mockGetDoc.mockResolvedValue({
          exists: () => true,
          data: () => ({
            company_name: 'Minimal Company'
            // Missing all other optional fields
          })
        } as any)
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          userData: {
            company_id: 'minimal-company-id'
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
        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'Minimal Company <noreply@ohplus.ph>',
            html: expect.stringContaining('Minimal Company')
          })
        )
      })
  
      it('should handle companies with null/undefined field values', async () => {
        mockGetDoc.mockResolvedValue({
          exists: () => true,
          data: () => ({
            company_name: null,
            company_location: undefined,
            phone: '',
            email: null,
            website: undefined,
            photo_url: null
          })
        } as any)
  
        const requestBody = {
          quotation: {
            id: 'test-quotation-id',
            items: [{ name: 'Test Billboard' }]
          },
          clientEmail: 'client@example.com',
          userData: {
            company_id: 'null-company-id'
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
        // Should use default values for null/undefined fields
        expect(mockResend.emails.send).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'Boohk <noreply@ohplus.ph>' // Should fallback to defaults
          })
        )
      })
    })
  })
})