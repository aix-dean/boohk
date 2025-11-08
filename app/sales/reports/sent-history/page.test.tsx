import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SentHistoryPage from './page'

// Mock the dependencies
vi.mock('@/lib/algolia-service', () => ({
  searchEmails: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/components/sent-history-dialog', () => ({
  SentHistoryDialog: ({ open, onOpenChange, emailToShow }: any) => (
    <div data-testid="sent-history-dialog" data-open={open} data-email-to-show={emailToShow ? 'provided' : 'none'}>
      Sent History Dialog
    </div>
  ),
}))

// Import mocked modules
import { searchEmails } from '@/lib/algolia-service'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

describe('SentHistoryPage', () => {
  const mockEmails = [
    {
      id: '1',
      sentAt: '2024-01-01T10:00:00Z',
      subject: 'Test Report Email',
      to: ['recipient1@example.com', 'recipient2@example.com'],
      cc: ['cc@example.com'],
      body: 'This is a test email body',
      attachments: [],
    },
    {
      id: '2',
      sentAt: '2024-01-02T14:30:00Z',
      subject: 'Another Report',
      to: ['another@example.com'],
      body: 'Another email content',
      attachments: [],
    },
  ]

  const mockUserData = {
    company_id: 'company-123',
  }

  const mockUser = {
    uid: 'user-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useAuth as any).mockReturnValue({
      user: mockUser,
      userData: mockUserData,
    })

    ;(useRouter as any).mockReturnValue({
      back: vi.fn(),
    })

    ;(searchEmails as any).mockImplementation((query: string, companyId?: string, page?: number, hitsPerPage?: number, filters?: string) => {
      let filteredEmails = mockEmails
      if (query) {
        const lowerQuery = query.toLowerCase()
        filteredEmails = mockEmails.filter(email =>
          email.subject.toLowerCase().includes(lowerQuery) ||
          email.to.some(recipient => recipient.toLowerCase().includes(lowerQuery)) ||
          email.body.toLowerCase().includes(lowerQuery)
        )
      }
      return Promise.resolve({
        hits: filteredEmails,
        nbHits: filteredEmails.length,
        page: page || 0,
        nbPages: 1,
        hitsPerPage: hitsPerPage || 10,
        processingTimeMS: 10,
        query: query || "",
      })
    })
  })

  describe('Rendering', () => {
    it('renders the page title', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Sent History')).toBeInTheDocument()
      })
    })

    it('renders the back button', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sent history/i })).toBeInTheDocument()
      })
    })

    it('renders search input', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search emails...')).toBeInTheDocument()
      })
    })

    it('renders table headers on larger screens', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Date Sent')).toBeInTheDocument()
        expect(screen.getByText('Time')).toBeInTheDocument()
        expect(screen.getByText('Subject')).toBeInTheDocument()
        expect(screen.getByText('To')).toBeInTheDocument()
      })
    })

    it('renders sent history dialog', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByTestId('sent-history-dialog')).toBeInTheDocument()
      })
    })
  })

  describe('Data Loading', () => {
    it('loads emails on mount when company_id is available', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(searchEmails).toHaveBeenCalledWith('', 'company-123', 0, 10, 'company_id:company-123 AND email_type:report')
      })
    })

    it('does not load emails when company_id is not available', async () => {
      ;(useAuth as any).mockReturnValue({
        user: mockUser,
        userData: null,
      })

      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(searchEmails).not.toHaveBeenCalled()
      })
    })

    it('shows loading state initially', () => {
      render(<SentHistoryPage />)

      expect(screen.getByText('Loading sent history...')).toBeInTheDocument()
    })

    it('displays emails after loading', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
        expect(screen.getByText('Another Report')).toBeInTheDocument()
        expect(screen.getByText('recipient1@example.com, recipient2@example.com')).toBeInTheDocument()
        expect(screen.getByText('another@example.com')).toBeInTheDocument()
      })
    })

    it('shows no emails message when empty', async () => {
      ;(searchEmails as any).mockResolvedValue({
        hits: [],
        nbHits: 0,
        page: 0,
        nbPages: 0,
        hitsPerPage: 10,
        processingTimeMS: 10,
        query: "",
      })

      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('No sent emails found')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('filters emails by subject', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search emails...')
      await user.type(searchInput, 'Another')

      await waitFor(() => {
        expect(screen.queryByText('Test Report Email')).not.toBeInTheDocument()
        expect(screen.getByText('Another Report')).toBeInTheDocument()
      })
    })

    it('filters emails by recipient', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search emails...')
      await user.type(searchInput, 'recipient1')

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
        expect(screen.queryByText('Another Report')).not.toBeInTheDocument()
      })
    })

    it('filters emails by body content', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search emails...')
      await user.type(searchInput, 'test email body')

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
        expect(screen.queryByText('Another Report')).not.toBeInTheDocument()
      })
    })

    it('shows no results message when search yields no matches', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search emails...')
      await user.type(searchInput, 'nonexistent')

      await waitFor(() => {
        expect(screen.getByText('No emails found matching your search')).toBeInTheDocument()
      })
    })

    it('shows all emails when search is cleared', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search emails...')
      await user.type(searchInput, 'Another')
      await user.clear(searchInput)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
        expect(screen.getByText('Another Report')).toBeInTheDocument()
      })
    })
  })

  describe('Date Formatting', () => {
    it('formats dates correctly', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument()
        expect(screen.getByText('6:00 PM')).toBeInTheDocument()
        expect(screen.getByText('Jan 2, 2024')).toBeInTheDocument()
        expect(screen.getByText('10:30 PM')).toBeInTheDocument()
      })
    })
  })

  describe('Interactions', () => {
    it('calls router.back when back button is clicked', async () => {
      const mockBack = vi.fn()
      ;(useRouter as any).mockReturnValue({
        back: mockBack,
      })

      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sent history/i })).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: /sent history/i })
      await user.click(backButton)

      expect(mockBack).toHaveBeenCalledTimes(1)
    })

    it('opens dialog when email is clicked', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const emailCard = screen.getByText('Test Report Email').closest('div')
      if (emailCard) {
        await user.click(emailCard)
      }

      expect(screen.getByTestId('sent-history-dialog')).toHaveAttribute('data-open', 'true')
    })

    it('passes correct props to SentHistoryDialog', async () => {
      render(<SentHistoryPage />)

      await waitFor(() => {
        const dialog = screen.getByTestId('sent-history-dialog')
        expect(dialog).toHaveAttribute('data-email-to-show', 'none')
      })
    })
  })

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(searchEmails as any).mockRejectedValue(new Error('Fetch failed'))

      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error searching emails:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('shows loading state during error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(searchEmails as any).mockRejectedValue(new Error('Fetch failed'))

      render(<SentHistoryPage />)

      // Should still show loading initially
      expect(screen.getByText('Loading sent history...')).toBeInTheDocument()

      // After error, loading should be false but no emails shown
      await waitFor(() => {
        expect(screen.queryByText('Loading sent history...')).not.toBeInTheDocument()
      }, { timeout: 2000 })

      consoleSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('handles emails with no cc field', async () => {
      const emailsWithoutCc = [
        {
          id: '1',
          sentAt: new Date().toISOString(),
          subject: 'Test Email',
          to: ['test@example.com'],
          body: 'Test body',
          attachments: [],
        },
      ]
      ;(searchEmails as any).mockResolvedValue({
        hits: emailsWithoutCc,
        nbHits: emailsWithoutCc.length,
        page: 0,
        nbPages: 1,
        hitsPerPage: 10,
        processingTimeMS: 10,
        query: "",
      })

      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Email')).toBeInTheDocument()
      })
    })

    it('handles emails with empty to array', async () => {
      const emailsWithEmptyTo = [
        {
          id: '1',
          sentAt: new Date().toISOString(),
          subject: 'Test Email',
          to: [],
          body: 'Test body',
          attachments: [],
        },
      ]
      ;(searchEmails as any).mockResolvedValue({
        hits: emailsWithEmptyTo,
        nbHits: emailsWithEmptyTo.length,
        page: 0,
        nbPages: 1,
        hitsPerPage: 10,
        processingTimeMS: 10,
        query: "",
      })

      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Email')).toBeInTheDocument()
        // Check that the to field div has empty content and empty title
        const toField = screen.getByTitle('')
        expect(toField).toBeInTheDocument()
        expect(toField).toHaveTextContent('')
      })
    })

    it('handles case insensitive search', async () => {
      const user = userEvent.setup()
      render(<SentHistoryPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search emails...')
      await user.type(searchInput, 'test report')

      await waitFor(() => {
        expect(screen.getByText('Test Report Email')).toBeInTheDocument()
        expect(screen.queryByText('Another Report')).not.toBeInTheDocument()
      })
    })
  })
})