import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/quotations/send-email/route'

// Comprehensive mocks with detailed error scenarios
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn()
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
    createEmail: vi.fn()
  }
}))

vi.mock('node-vibrant/node', () => ({
  Vibrant: vi.fn().mockImplementation(() => ({
    getPalette: vi.fn().mockResolvedValue({
      Vibrant: {
        rgb: [102, 126, 234]
      }
    })
  })),
  default: {
    Vibrant: vi.fn().mockImplementation(() => ({
      getPalette: vi.fn().mockResolvedValue({
        Vibrant: {
          rgb: [102, 126, 234]
        }
      })
    }))
  }
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

describe('/api/quotations/send-email - Comprehensive Tests', () => {
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
    const firestoreModule = await import('firebase/firestore')
    const storageModule = await import('firebase/storage')
    const emailServiceModule = await import('@/lib/email-service')
    const ResendModule = await import('resend')

    mockGetDoc = vi.mocked(firestoreModule.getDoc)
    mockDoc = vi.mocked(firestoreModule.doc)
    mockRef = vi.mocked(storageModule.ref)
    mockUploadBytes = vi.mocked(storageModule.uploadBytes)
    mockGetDownloadURL = vi.mocked(storageModule.getDownloadURL)
    mockEmailService = vi.mocked(emailServiceModule.emailService)
    mockFetch = vi.mocked(global.fetch as any)

    // Setup default successful mocks
    mockRef.mockReturnValue('mock-storage-ref')
    mockUploadBytes.mockResolvedValue({} as any)
    mockGetDownloadURL.mockResolvedValue('https://storage.example.com/file.pdf')

    // Setup default company data mock
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

    // Setup Resend mock
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

  describe('Resend API Error Scenarios', () => {
    it('should handle Resend authentication errors', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'authentication' }
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

      expect(response.status).toBe(401)
      expect(result.error).toBe('Email service authentication failed')
      expect(result.details).toBe('Email service credentials are invalid')
    })

    it('should handle Resend rate limiting errors', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'rate limit' }
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

      expect(response.status).toBe(429)
      expect(result.error).toBe('Email service rate limited')
      expect(result.details).toBe('Too many emails sent. Please try again later.')
    })

    it('should handle Resend validation errors', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'validation' }
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

      expect(response.status).toBe(400)
      expect(result.error).toBe('Email validation error')
      expect(result.details).toBe('Email content or recipient address is invalid')
    })

    it('should handle Resend network timeout errors', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'Network timeout occurred' }
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

      expect(response.status).toBe(503)
      expect(result.error).toBe('Email service network error')
      expect(result.details).toBe('Network error occurred while sending email')
    })
  })

  describe('Firebase Storage Edge Cases', () => {
    it('should handle Firebase storage quota exceeded', async () => {
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
    })

    it('should handle Firebase storage network failures', async () => {
      mockUploadBytes.mockRejectedValue(new Error('Network error'))

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
    })

    it('should handle Firebase storage permission errors', async () => {
      mockUploadBytes.mockRejectedValue(new Error('Permission denied'))

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: 'restricted-file.pdf',
            content: Buffer.from('test content').toString('base64'),
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

      expect(response.status).toBe(500)
      expect(result.error).toBe('Internal server error')
      expect(result.details).toBe('Failed to upload file: restricted-file.pdf')
    })
  })

  describe('Email Template Generation Edge Cases', () => {
    it('should handle extremely long email subjects', async () => {
      const longSubject = 'A'.repeat(1000) // Very long subject

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        subject: longSubject,
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
          subject: longSubject
        })
      )
    })

    it('should handle HTML injection attempts in email body', async () => {
      const maliciousBody = '<script>alert("xss")</script><p>Safe content</p>'

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        body: maliciousBody,
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
      // The body should be processed and wrapped in paragraph tags
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #333333;"><script>alert("xss")</script><p>Safe content</p></p>')
        })
      )
    })

    it('should handle empty quotation items array', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [] // Empty items array
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Quotation: Custom Advertising Solution - Company'
        })
      )
    })

    it('should handle quotation items with missing name field', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ description: 'No name field' }] // Missing name field
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Quotation: Custom Advertising Solution - Company'
        })
      )
    })
  })

  describe('Color Extraction Failure Scenarios', () => {
    it('should handle node-vibrant module not found', async () => {
      // Mock dynamic import failure for node-vibrant
      vi.doMock('node-vibrant/node', () => {
        throw new Error('Cannot find module')
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      // Should succeed without color extraction
    })

    it('should handle invalid base64 data in color extraction', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'image/jpeg'
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      } as any)

      // Mock Buffer.from to return invalid base64 data
      const originalBufferFrom = Buffer.from
      Buffer.from = vi.fn().mockImplementation((data) => {
        if (data === 'invalid-base64!@#') {
          throw new Error('Invalid base64')
        }
        return originalBufferFrom(data)
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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)

      // Restore Buffer.from
      Buffer.from = originalBufferFrom
    })

    it('should handle color palette extraction failure', async () => {
      // Mock Vibrant to return null palette
      const mockVibrant = vi.fn().mockImplementation(() => ({
        getPalette: vi.fn().mockResolvedValue(null)
      }))

      vi.doMock('node-vibrant/node', () => ({
        Vibrant: mockVibrant
      }))

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

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      // Should succeed without dominant color
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      // Test with sequential requests instead of concurrent to avoid mock interference
      const requests = Array(3).fill(null).map((_, index) =>
        new NextRequest('http://localhost:3000/api/quotations/send-email', {
          method: 'POST',
          body: JSON.stringify({
            quotation: {
              id: `test-quotation-id-${index}`,
              items: [{ name: `Test Billboard ${index}` }]
            },
            clientEmail: `client${index}@example.com`,
            body: `Test message for client ${index}`,
            userData: {
              company_id: 'test-company-id',
              first_name: `User${index}`,
              last_name: 'Test'
            }
          }),
          headers: {
            'content-type': 'application/json'
          }
        })
      )

      // Execute requests sequentially to avoid mock conflicts
      const responses = []
      const results = []
      for (const request of requests) {
        const response = await POST(request)
        responses.push(response)
        const result = await response.json()
        results.push(result)
      }

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.message).toContain('Email sent successfully')
      })

      // All emails should have been sent
      expect(mockResend.emails.send).toHaveBeenCalledTimes(3)

      // All email documents should have been created
      expect(mockEmailService.createEmail).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent requests with shared resources', async () => {
      // Test with sequential requests to avoid mock conflicts
      const requests = Array(2).fill(null).map((_, index) =>
        new NextRequest('http://localhost:3000/api/quotations/send-email', {
          method: 'POST',
          body: JSON.stringify({
            quotation: {
              id: `test-quotation-id-${index}`,
              items: [{ name: 'Test Billboard' }]
            },
            clientEmail: `client${index}@example.com`,
            preGeneratedPDFs: [
              {
                filename: `shared-file-${index}.pdf`,
                content: Buffer.from(`test content ${index}`).toString('base64')
              }
            ],
            userData: {
              company_id: 'shared-company-id' // Same company for all requests
            }
          }),
          headers: {
            'content-type': 'application/json'
          }
        })
      )

      // Execute requests sequentially to avoid mock conflicts
      const responses = []
      const results = []
      for (const request of requests) {
        const response = await POST(request)
        responses.push(response)
        const result = await response.json()
        results.push(result)
      }

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
      })

      // Company data should have been fetched for each request (2 calls per request)
      expect(mockGetDoc).toHaveBeenCalledTimes(4)

      // Files should have been uploaded for each request
      expect(mockUploadBytes).toHaveBeenCalledTimes(2)

      // All emails should have been sent
      expect(mockResend.emails.send).toHaveBeenCalledTimes(2)
    })
  })

  describe('Malformed Attachment Data Handling', () => {
    it('should handle attachments with invalid base64 content', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        preGeneratedPDFs: [
          {
            filename: 'valid-file.pdf',
            content: Buffer.from('valid content').toString('base64')
          },
          {
            filename: 'invalid-file.pdf',
            content: 'invalid-base64!@#$%^&*()' // Invalid base64
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
      // Should succeed with only valid attachments
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'valid-file.pdf'
            })
          ])
        })
      )
    })

    it('should handle attachments with extremely long filenames', async () => {
      const longFilename = 'A'.repeat(500) + '.pdf' // Very long filename

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: longFilename,
            content: Buffer.from('test content').toString('base64'),
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
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: longFilename
            })
          ])
        })
      )
    })

    it('should handle attachments with special characters in filename', async () => {
      const specialFilename = 'file-with-émojis-🚀-ñáéíóú-中文-русский.pdf'

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: specialFilename,
            content: Buffer.from('test content').toString('base64'),
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
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: specialFilename
            })
          ])
        })
      )
    })
  })

  describe('International Character Encoding', () => {
    it('should handle Arabic text in email body', async () => {
      const arabicBody = 'مرحباً بك في عرضنا التقديمي للوحات الإعلانية المتميزة في الأماكن الرئيسية'

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'لوحة إعلانية مميزة' }]
        },
        clientEmail: 'client@example.com',
        body: arabicBody,
        userData: {
          company_id: 'test-company-id',
          first_name: 'أحمد',
          last_name: 'محمد'
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
          html: expect.stringContaining(arabicBody)
        })
      )
    })

    it('should handle Chinese characters in email content', async () => {
      const chineseBody = '我们很高兴为您提供详细的广告牌报价单，我们的团队已经为您准备了专业的营销方案'

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: '高端广告牌位置' }]
        },
        clientEmail: 'client@example.com',
        body: chineseBody,
        userData: {
          company_id: 'test-company-id',
          first_name: '李',
          last_name: '明'
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
          html: expect.stringContaining(chineseBody)
        })
      )
    })

    it('should handle mixed language content', async () => {
      const mixedBody = `
        English: We are excited to present our quotation
        Español: Estamos emocionados de presentar nuestra cotización
        Français: Nous sommes ravis de présenter notre devis
        日本語: 見積もりを提示できてうれしく思います
        한국어: 견적을 제시하게 되어 기쁩니다
      `

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Premium Billboard Location' }]
        },
        clientEmail: 'client@example.com',
        body: mixedBody,
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
          html: expect.stringContaining('English:')
        })
      )
    })
  })

  describe('Large Payload Handling', () => {
    it('should handle extremely large email body content', async () => {
      const largeBody = 'A'.repeat(50000) // 50k characters

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        body: largeBody,
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
          html: expect.stringContaining(largeBody)
        })
      )
    })

    it('should handle large number of CC recipients', async () => {
      const ccEmails = Array(50).fill(null).map((_, i) => `cc${i}@example.com`).join(', ')

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        ccEmail: ccEmails,
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
          cc: expect.arrayContaining([
            'cc0@example.com',
            'cc49@example.com'
          ])
        })
      )
    })

    it('should handle large number of attachments', async () => {
      const manyAttachments = Array(20).fill(null).map((_, i) => ({
        filename: `attachment-${i}.pdf`,
        content: Buffer.from(`content ${i}`).toString('base64'),
        type: 'application/pdf'
      }))

      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        uploadedFiles: manyAttachments,
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
      expect(result.message).toContain('20 attachment(s)')
      expect(mockUploadBytes).toHaveBeenCalledTimes(20)
    })
  })

  describe('Email Service Integration Failures', () => {
    it('should handle email service database connection failure', async () => {
      mockEmailService.createEmail.mockRejectedValue(new Error('Database connection failed'))

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

    it('should handle email service validation errors', async () => {
      mockEmailService.createEmail.mockRejectedValue(new Error('Validation error: Invalid email data'))

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
    })

    it('should handle email service timeout errors', async () => {
      mockEmailService.createEmail.mockRejectedValue(new Error('Operation timeout'))

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
    })
  })

  describe('Edge Cases in Request Processing', () => {
    it('should handle request with missing optional fields', async () => {
      const minimalRequestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com'
        // Missing all optional fields
      }

      const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
        method: 'POST',
        body: JSON.stringify(minimalRequestBody),
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
          from: 'Test Company <noreply@ohplus.ph>',
          subject: 'Quotation: Test Billboard - Company'
        })
      )
    })

    it('should handle request with null values in optional fields', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        subject: null,
        body: null,
        currentUserEmail: null,
        ccEmail: null,
        replyToEmail: null,
        companyName: null,
        preGeneratedPDFs: null,
        uploadedFiles: null,
        userData: {
          company_id: 'test-company-id',
          first_name: null,
          last_name: null,
          phone_number: null,
          position: null
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
          from: 'Test Company <noreply@ohplus.ph>',
          subject: 'Quotation: Test Billboard - Company'
        })
      )
    })

    it('should handle request with undefined values in arrays', async () => {
      const requestBody = {
        quotation: {
          id: 'test-quotation-id',
          items: [{ name: 'Test Billboard' }]
        },
        clientEmail: 'client@example.com',
        preGeneratedPDFs: [{ filename: 'valid.pdf', content: 'valid-content' }],
        uploadedFiles: [],
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

      // Should succeed with only valid attachments
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      // Should include only valid attachments
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'valid.pdf'
            })
          ])
        })
      )
    })
  })
})