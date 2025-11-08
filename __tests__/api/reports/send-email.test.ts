import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/reports/send-email/route'

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

// Additional mock for the static from method
vi.mock('node-vibrant', () => ({
  Vibrant: class MockVibrant {
    static from = vi.fn().mockImplementation((buffer) => ({
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

describe('/api/reports/send-email - Comprehensive Tests', () => {
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
        logo: 'https://example.com/logo.jpg'
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

  describe('Successful Email Sending Scenarios', () => {
    it('should send basic email with required fields', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Monthly Sales Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id',
          first_name: 'John',
          last_name: 'Doe'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      expect(result.message).toBe('Email sent successfully')
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test Company <noreply@ohplus.ph>',
          to: ['client@example.com'],
          subject: 'Report: Monthly Sales Report - Company'
        })
      )
    })

    it('should send email with custom subject and body', async () => {
      const customSubject = 'Urgent: Q4 Performance Analysis'
      const customBody = 'Please review the attached performance analysis for Q4. Key findings are highlighted in the summary section.'

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Q4 Performance Report'
        },
        clientEmail: 'client@example.com',
        subject: customSubject,
        body: customBody,
        userData: {
          company_id: 'test-company-id',
          first_name: 'Jane',
          last_name: 'Smith'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          subject: customSubject,
          html: expect.stringContaining(customBody)
        })
      )
    })

    it('should send email with PDF attachments', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Monthly Report'
        },
        clientEmail: 'client@example.com',
        preGeneratedPDFs: [
          {
            filename: 'report-summary.pdf',
            content: Buffer.from('PDF content here').toString('base64')
          }
        ],
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      expect(result.message).toContain('1 attachment(s)')
      expect(mockUploadBytes).toHaveBeenCalledTimes(1)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'report-summary.pdf'
            })
          ])
        })
      )
    })

    it('should send email with multiple file attachments', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Comprehensive Report'
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: 'document1.pdf',
            content: Buffer.from('PDF content 1').toString('base64'),
            type: 'application/pdf'
          },
          {
            filename: 'document2.docx',
            content: Buffer.from('DOCX content 2').toString('base64'),
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          }
        ],
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      expect(result.message).toContain('2 attachment(s)')
      expect(mockUploadBytes).toHaveBeenCalledTimes(2)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'document1.pdf'
            }),
            expect.objectContaining({
              filename: 'document2.docx'
            })
          ])
        })
      )
    })

    it('should send email with CC recipients', async () => {
      const ccEmails = 'cc1@example.com, cc2@example.com, cc3@example.com'

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Team Report'
        },
        clientEmail: 'client@example.com',
        ccEmail: ccEmails,
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          cc: ['cc1@example.com', 'cc2@example.com', 'cc3@example.com']
        })
      )
    })

    it('should send email with company branding and logo color extraction', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Branded Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id',
          first_name: 'Alice',
          last_name: 'Johnson',
          position: 'Marketing Manager'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          html: expect.stringContaining('Test Company')
        })
      )
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/logo.jpg')
    })
  })

  describe('Error Scenarios', () => {
    it('should handle missing required fields', async () => {
      const requestBody = {
        // Missing report and clientEmail
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Missing report or client email address')
    })

    it('should handle invalid email format', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'invalid-email',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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

    it('should handle invalid CC email format', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        ccEmail: 'valid@example.com, invalid-email, another@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toContain("Invalid 'CC' email address format: invalid-email")
    })

    it('should handle missing API key configuration', async () => {
      // Temporarily remove API key
      const originalApiKey = process.env.RESEND_API_KEY
      delete (process.env as any).RESEND_API_KEY

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      ;(process.env as any).RESEND_API_KEY = originalApiKey
    })

    it('should handle Resend API failures', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'API rate limit exceeded' }
      })

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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

    it('should handle Firebase storage upload failures', async () => {
      mockUploadBytes.mockRejectedValue(new Error('Storage quota exceeded'))

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: 'large-file.pdf',
            content: Buffer.from('x'.repeat(100 * 1024 * 1024)).toString('base64'),
            type: 'application/pdf'
          }
        ],
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      expect(result.details).toBe('Failed to upload file: large-file.pdf')
    })

    it('should handle file upload failures', async () => {
      mockUploadBytes.mockRejectedValue(new Error('Network error'))

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
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

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
  })

  describe('Edge Cases', () => {
    it('should handle large attachments', async () => {
      const largeFileContent = Buffer.from('x'.repeat(50 * 1024 * 1024)).toString('base64') // 50MB

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Large Report'
        },
        clientEmail: 'client@example.com',
        uploadedFiles: [
          {
            filename: 'large-document.pdf',
            content: largeFileContent,
            type: 'application/pdf'
          }
        ],
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      expect(result.message).toContain('1 attachment(s)')
    })

    it('should handle multiple recipients', async () => {
      const multipleRecipients = 'recipient1@example.com, recipient2@example.com, recipient3@example.com, recipient4@example.com, recipient5@example.com'

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Multi-Recipient Report'
        },
        clientEmail: 'main@example.com',
        ccEmail: multipleRecipients,
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          to: ['main@example.com'],
          cc: expect.arrayContaining([
            'recipient1@example.com',
            'recipient2@example.com',
            'recipient3@example.com',
            'recipient4@example.com',
            'recipient5@example.com'
          ])
        })
      )
    })

    it('should handle network timeouts', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'Network timeout occurred' }
      })

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Timeout Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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

    it('should handle malformed request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
    })

    it('should handle company data fetch failures gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Database connection failed'))

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      // Should still succeed with default company data
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'OH Plus <noreply@ohplus.ph>'
        })
      )
    })

    it('should handle logo color extraction failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Image fetch failed'))

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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

    it('should handle node-vibrant module failures gracefully', async () => {
      // Mock dynamic import failure for node-vibrant
      vi.doMock('node-vibrant', () => {
        throw new Error('Cannot find module')
      })

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      // Should succeed without color extraction
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  })

  describe('Email Template Generation', () => {
    it('should generate proper HTML template with company branding', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Branded Report'
        },
        clientEmail: 'client@example.com',
        body: 'This is a test report with custom content.',
        userData: {
          company_id: 'test-company-id',
          first_name: 'Sarah',
          last_name: 'Wilson',
          position: 'Sales Director',
          phone_number: '+639123456789'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          html: expect.stringContaining('Test Company')
        })
      )
    })

    it('should handle HTML content in email body properly', async () => {
      const htmlBody = '<h1>Report Summary</h1><p>This is a <strong>formatted</strong> report.</p><ul><li>Point 1</li><li>Point 2</li></ul>'

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'HTML Report'
        },
        clientEmail: 'client@example.com',
        body: htmlBody,
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          html: expect.stringContaining('<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #333333;">')
        })
      )
    })

    it('should handle very long email content', async () => {
      const longBody = 'A'.repeat(10000) // 10k character body

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Long Content Report'
        },
        clientEmail: 'client@example.com',
        body: longBody,
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
          html: expect.stringContaining(longBody)
        })
      )
    })
  })

  describe('Email Document Creation', () => {
    it('should create email document in database', async () => {
      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Document Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id',
          email: 'user@company.com'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      expect(mockEmailService.createEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email_type: 'report',
          reportId: 'test-report-id',
          status: 'sent'
        })
      )
    })

    it('should handle email document creation failures gracefully', async () => {
      mockEmailService.createEmail.mockRejectedValue(new Error('Database error'))

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'Failure Test Report'
        },
        clientEmail: 'client@example.com',
        userData: {
          company_id: 'test-company-id'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json'
        }
      })

      const response = await POST(request)
      const result = await response.json()

      // Should still succeed even if document creation fails
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalledTimes(1)
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array(3).fill(null).map((_, index) =>
        new NextRequest('http://localhost:3000/api/reports/send-email', {
          method: 'POST',
          body: JSON.stringify({
            report: {
              id: `test-report-id-${index}`,
              title: `Test Report ${index}`
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

      const responses = []
      const results = []
      for (const request of requests) {
        const response = await POST(request)
        responses.push(response)
        const result = await response.json()
        results.push(result)
      }

      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.message).toContain('Email sent successfully')
      })

      expect(mockResend.emails.send).toHaveBeenCalledTimes(3)
      expect(mockEmailService.createEmail).toHaveBeenCalledTimes(3)
    })
  })

  describe('International Character Support', () => {
    it('should handle Arabic text in email content', async () => {
      const arabicBody = 'تقرير المبيعات الشهري - يرجى مراجعة التفاصيل المرفقة'

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: 'التقرير الشهري'
        },
        clientEmail: 'client@example.com',
        body: arabicBody,
        userData: {
          company_id: 'test-company-id',
          first_name: 'أحمد',
          last_name: 'محمد'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
      const chineseBody = '月度销售报告请查收附件中的详细分析数据'

      const requestBody = {
        report: {
          id: 'test-report-id',
          title: '月度报告'
        },
        clientEmail: 'client@example.com',
        body: chineseBody,
        userData: {
          company_id: 'test-company-id',
          first_name: '李',
          last_name: '明'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/reports/send-email', {
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
  })
})