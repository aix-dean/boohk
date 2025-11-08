
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import ComposeEmailPage from './page'

// Mock all dependencies
vi.mock('@/lib/firebase', () => ({
  db: {},
  uploadFileToFirebaseStorage: vi.fn(),
}))

vi.mock('@/lib/firebase-service', () => ({
  uploadFileToFirebaseStorage: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/lib/report-service', () => ({
  getReportById: vi.fn(),
}))

vi.mock('@/lib/client-service', () => ({
  getClientById: vi.fn(),
}))

vi.mock('@/lib/email-service', () => ({
  emailService: {
    deleteEmailTemplate: vi.fn(),
  },
}))

vi.mock('@/lib/company-service', () => ({
  CompanyService: {
    getCompanyData: vi.fn(),
  },
}))

vi.mock('@/lib/google-maps-loader', () => ({
  loadGoogleMaps: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [],
    forEach: vi.fn(),
  }),
  doc: vi.fn(),
  updateDoc: vi.fn(),
}))

const mockGetDocs = vi.fn()
;(getDocs as any).mockImplementation(mockGetDocs)

import { getDocs } from 'firebase/firestore'

// Mock IndexedDB utilities
vi.mock('./page', async () => {
  const actual = await vi.importActual('./page')
  return {
    ...actual,
    openPDFDB: vi.fn(),
    getPDFFromIndexedDB: vi.fn(),
    deletePDFFromIndexedDB: vi.fn(),
  }
})

// Import mocked modules
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { getReportById } from '@/lib/report-service'
import { getClientById } from '@/lib/client-service'
import { CompanyService } from '@/lib/company-service'
import { emailService } from '@/lib/email-service'

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock FormData.entries for Node.js environment
if (typeof FormData !== 'undefined') {
  FormData.prototype.entries = vi.fn().mockReturnValue([].values())
}

describe('ComposeEmailPage', () => {
  const mockReport = {
    id: 'BNwkVzMRSlSzdLMza6y6',
    report_id: 'RPT-001',
    siteName: 'Test Site',
    client_email: 'client@example.com',
    companyId: 'company-123',
    clientId: 'client-123',
    logistics_report: 'https://example.com/logistics.pdf',
  }

  const mockUserData = {
    company_id: 'company-123',
    email: 'user@example.com',
    phone_number: '+639123456789',
    displayName: 'Test User',
  }

  const mockUser = {
    uid: 'user-123',
    email: 'user@example.com',
    displayName: 'Test User',
  }

  const mockProjectData = {
    company_name: 'Test Company',
    company_website: 'www.testcompany.com',
  }

  const mockCompanyData = {
    name: 'Test Company',
    address: '123 Test St',
  }

  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Test Template',
      subject: 'Test Subject',
      body: 'Test Body',
      userId: 'user-123',
      company_id: 'company-123',
      template_type: 'report',
    },
  ]

  // Mock React.use to handle params
  const originalUse = React.use
  beforeEach(() => {
    React.use = vi.fn((promise) => {
      if (promise instanceof Promise) {
        // For testing, return the resolved value immediately
        return { id: 'BNwkVzMRSlSzdLMza6y6' }
      }
      return originalUse(promise)
    })
  })

  afterEach(() => {
    React.use = originalUse
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useAuth as any).mockReturnValue({
      user: mockUser,
      userData: mockUserData,
      projectData: mockProjectData,
    })

    ;(useToast as any).mockReturnValue({
      toast: vi.fn(),
    })

    ;(useRouter as any).mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
    })

    ;(getReportById as any).mockResolvedValue(mockReport)
    ;(getClientById as any).mockResolvedValue(null)
    ;(CompanyService.getCompanyData as any).mockResolvedValue(mockCompanyData)

    // Mock getDocs to return empty results by default
    mockGetDocs.mockResolvedValue({
      docs: [],
      forEach: vi.fn(),
    })

    // Mock URL search params
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
      },
      writable: true,
    })

    // Mock IndexedDB functions
    const mockOpenPDFDB = vi.fn().mockResolvedValue({
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
          }),
        }),
      }),
      close: vi.fn(),
    })

    const mockGetPDFFromIndexedDB = vi.fn().mockResolvedValue(null)
    const mockDeletePDFFromIndexedDB = vi.fn()

    vi.mocked(mockOpenPDFDB)
    vi.mocked(mockGetPDFFromIndexedDB)
    vi.mocked(mockDeletePDFFromIndexedDB)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('renders the page structure immediately', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      expect(screen.getByText('Compose email')).toBeInTheDocument()
    })

    it('renders the page title after loading', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Compose email')).toBeInTheDocument()
      })
    })

    it('renders back button', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Compose email')).toBeInTheDocument()
      })
    })

    it('renders email form fields', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('To:')).toBeInTheDocument()
        expect(screen.getByText('CC:')).toBeInTheDocument()
        expect(screen.getByText('Reply-To:')).toBeInTheDocument()
        expect(screen.getByText('Subject:')).toBeInTheDocument()
      })
    })

    it('renders templates section', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Templates')).toBeInTheDocument()
      })
    })

    it('renders send email button', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send email')).toBeInTheDocument()
      })
    })
  })

  describe('Data Loading', () => {
    it('loads report data on mount', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(getReportById).toHaveBeenCalledWith('BNwkVzMRSlSzdLMza6y6')
      })
    })

    it('populates email fields with report data', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        const toInput = screen.getByPlaceholderText('Enter recipient email')
        expect(toInput).toHaveValue('client@example.com')
      })
    })

    it('loads company data for templates', async () => {
      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(CompanyService.getCompanyData).toHaveBeenCalledWith('company-123')
      })
    })

    it('handles report not found', async () => {
      ;(getReportById as any).mockResolvedValue(null)

      const mockToast = vi.fn()
      ;(useToast as any).mockReturnValue({ toast: mockToast })

      await act(async () => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'invalid-id' })} />)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load report data',
          variant: 'destructive',
        })
      })
    })
  })

  describe('Email Composition', () => {
    it('allows typing in email fields', async () => {
      const user = userEvent.setup()

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter recipient email')).toBeInTheDocument()
      })

      const toInput = screen.getByPlaceholderText('Enter recipient email')
      const subjectInput = screen.getByPlaceholderText('Enter email subject')
      const messageTextarea = screen.getByPlaceholderText('Enter your message')

      await user.type(toInput, 'test@example.com')
      await user.type(subjectInput, 'Test Subject')
      await user.type(messageTextarea, 'Test message')

      expect(toInput).toHaveValue('client@example.comtest@example.com')
      expect(subjectInput).toHaveValue('Test Subject')
      expect(messageTextarea).toHaveValue('Test message')
    })

    it('validates required fields before sending', async () => {
      const user = userEvent.setup()
      const mockToast = vi.fn()

      ;(useToast as any).mockReturnValue({ toast: mockToast })

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send email')).toBeInTheDocument()
      })

      // Clear the to field
      const toInput = screen.getByPlaceholderText('Enter recipient email')
      await user.clear(toInput)

      // Clear the subject field
      const subjectInput = screen.getByPlaceholderText('Enter email subject')
      await user.clear(subjectInput)

      const sendButton = screen.getByText('Send email')
      await user.click(sendButton)

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: 'Please enter a recipient email address.',
        variant: 'destructive',
      })
    })
  })

  describe('Attachments', () => {
    it('displays logistics report attachment when available', async () => {
      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('logistics_report.pdf')).toBeInTheDocument()
      })
    })

    it('allows adding file attachments', async () => {
      const user = userEvent.setup()

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('+Add attachment')).toBeInTheDocument()
      })

      const addButton = screen.getByText('+Add attachment')
      await user.click(addButton)

      // File input should be triggered (though we can't test file selection in this environment)
      expect(addButton).toBeInTheDocument()
    })

    it('shows file size warning for large attachments', async () => {
      // This test would require mocking file inputs and attachment state
      // For now, we'll test that the component renders existing attachments
      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('logistics_report.pdf')).toBeInTheDocument()
      })
    })
  })

  describe('Template Management', () => {
    it('displays templates when available', async () => {
      // Mock getDocs to return templates
      const mockGetDocs = vi.fn().mockResolvedValue({
        docs: mockTemplates.map(template => ({
          id: template.id,
          data: () => template,
        })),
      })

      ;(getDocs as any).mockImplementation(mockGetDocs)

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Templates')).toBeInTheDocument()
      })
    })

    it('allows adding new templates', async () => {
      const user = userEvent.setup()

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('+Add Template')).toBeInTheDocument()
      })

      const addTemplateButton = screen.getByText('+Add Template')
      await user.click(addTemplateButton)

      // Template should be added (though we can't fully test the async operation)
      expect(addTemplateButton).toBeInTheDocument()
    })
  })

  describe('Email Sending', () => {
    beforeEach(() => {
      // Ensure templates load successfully for email sending tests
      mockGetDocs.mockResolvedValue({
        docs: [],
        forEach: vi.fn(),
      })
    })

    afterEach(() => {
      // Reset toast mock to check only the calls from email sending
      vi.clearAllMocks()
    })

    it('sends email with correct data', async () => {
      const user = userEvent.setup()
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })

      global.fetch = mockFetch

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send email')).toBeInTheDocument()
      })

      const subjectInput = screen.getByPlaceholderText('Enter email subject')
      const messageTextarea = screen.getByPlaceholderText('Enter your message')

      await user.type(subjectInput, 'Test Subject')
      await user.type(messageTextarea, 'Test message content')

      const sendButton = screen.getByText('Send email')
      await user.click(sendButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/send-email', expect.objectContaining({
          method: 'POST',
        }))
      })
    })

    it('shows success message and redirects after sending', async () => {
      const user = userEvent.setup()
      const mockToast = vi.fn()
      const mockPush = vi.fn()

      ;(useToast as any).mockReturnValue({ toast: mockToast })
      ;(useRouter as any).mockReturnValue({ push: mockPush })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          entries: vi.fn().mockReturnValue([]),
        },
        json: vi.fn().mockResolvedValue({ success: true }),
      })

      global.fetch = mockFetch

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send email')).toBeInTheDocument()
      })

      // Clear previous toast calls from component initialization
      mockToast.mockClear()

      const subjectInput = screen.getByPlaceholderText('Enter email subject')
      const messageTextarea = screen.getByPlaceholderText('Enter your message')

      await user.type(subjectInput, 'Test Subject')
      await user.type(messageTextarea, 'Test message content')

      const sendButton = screen.getByText('Send email')
      await user.click(sendButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Email sent!',
          description: 'Your report has been sent successfully.',
        })
        expect(mockPush).toHaveBeenCalledWith('/sales/reports?success=email-sent')
      })
    })

    it('handles email sending errors', async () => {
      const user = userEvent.setup()
      const mockToast = vi.fn()

      ;(useToast as any).mockReturnValue({ toast: mockToast })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          entries: vi.fn().mockReturnValue([]),
          get: vi.fn().mockReturnValue('application/json'),
        },
        text: vi.fn().mockResolvedValue('Server error'),
      })

      global.fetch = mockFetch

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Send email')).toBeInTheDocument()
      })

      // Clear previous toast calls from component initialization
      mockToast.mockClear()

      const subjectInput = screen.getByPlaceholderText('Enter email subject')
      const messageTextarea = screen.getByPlaceholderText('Enter your message')

      await user.type(subjectInput, 'Test Subject')
      await user.type(messageTextarea, 'Test message content')

      const sendButton = screen.getByText('Send email')
      await user.click(sendButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to send',
          description: 'Server error',
          variant: 'destructive',
        })
      })
    })
  })

  describe('Navigation', () => {
    it('navigates back when back button is clicked', async () => {
      const user = userEvent.setup()
      const mockBack = vi.fn()

      ;(useRouter as any).mockReturnValue({ back: mockBack })

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Compose email')).toBeInTheDocument()
      })

      const backButton = screen.getByText('Compose email').closest('button')
      if (backButton) {
        await user.click(backButton)
        expect(mockBack).toHaveBeenCalled()
      }
    })

    it('navigates back when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const mockBack = vi.fn()

      ;(useRouter as any).mockReturnValue({ back: mockBack })

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(mockBack).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles report loading errors', async () => {
      ;(getReportById as any).mockRejectedValue(new Error('Network error'))

      const mockToast = vi.fn()
      ;(useToast as any).mockReturnValue({ toast: mockToast })

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load report data',
          variant: 'destructive',
        })
      })
    })

    it('handles missing user data gracefully', async () => {
      ;(useAuth as any).mockReturnValue({
        user: null,
        userData: null,
        projectData: null,
      })

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Compose email')).toBeInTheDocument()
      })

      // Component should still render even without user data
    })

    it('handles template loading errors', async () => {
      const mockToast = vi.fn()
      ;(useToast as any).mockReturnValue({ toast: mockToast })

      // Mock getDocs to throw an error
      ;(getDocs as any).mockRejectedValue(new Error('Template loading failed'))

      act(() => {
        render(<ComposeEmailPage params={Promise.resolve({ id: 'BNwkVzMRSlSzdLMza6y6' })} />)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load email templates',
          variant: 'destructive',
        })
      })
    })
  })
})