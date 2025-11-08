import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelectBookingPage from '@/app/sales/job-orders/select-booking/page'
import { bookingService } from '@/lib/booking-service'
import { searchBookings } from '@/lib/algolia-service'
import type { Booking } from '@/lib/booking-service'

// Mock dependencies
vi.mock('@/lib/booking-service', () => ({
  bookingService: {
    getTotalBookingsCount: vi.fn(),
    getCollectiblesBookings: vi.fn()
  }
}))

vi.mock('@/lib/algolia-service', () => ({
  searchBookings: vi.fn()
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    userData: {
      company_id: 'test-company',
      id: 'user-1'
    }
  })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn()
  }),
  useSearchParams: () => ({
    get: vi.fn()
  })
}))

vi.mock('lucide-react', () => ({
  Loader2: () => 'Loader2',
  Search: () => 'Search',
  FileText: () => 'FileText',
  CheckCircle: () => 'CheckCircle',
  ArrowLeft: () => 'ArrowLeft',
  Package: () => 'Package',
  ChevronLeft: () => 'ChevronLeft',
  ChevronRight: () => 'ChevronRight',
  ChevronDown: () => 'ChevronDown'
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className }: any) => (
    <input
      value={value}
      onChange={(e) => onChange(e)}
      placeholder={placeholder}
      className={className}
      data-testid="search-input"
    />
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children, onClick }: any) => <tr onClick={onClick}>{children}</tr>
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>
}))

describe('SelectBookingPage', () => {
  const mockBookings: Booking[] = [
    {
      id: 'booking-1',
      reservation_id: 'RV-12345',
      client: {
        company_id: 'comp-1',
        id: 'client-1',
        name: 'Test Client',
        company_name: 'Test Company'
      },
      company_id: 'comp-1',
      product_name: 'LED Billboard',
      project_name: 'Test Project',
      start_date: { toDate: vi.fn(() => new Date('2024-01-01')) },
      end_date: { toDate: vi.fn(() => new Date('2024-01-31')) },
      status: 'RESERVED',
      created: { toDate: vi.fn(() => new Date()) },
      items: [
        {
          id: 'item-1',
          name: 'LED Billboard',
          quantity: 1,
          price: 1000,
          specs: { width: 10, height: 5 }
        }
      ],
      cancel_reason: '',
      category_id: 'cat-1',
      cost: 1000,
      costDetails: {
        basePrice: 1000,
        days: 30,
        discount: 0,
        months: 1,
        otherFees: 0,
        pricePerMonth: 1000,
        total: 1000,
        vatAmount: 120,
        vatRate: 12
      },
      payment_method: 'Manual Payment',
      product_id: 'prod-1',
      product_owner: 'Test Owner',
      promos: {},
      requirements: [],
      seller_id: 'seller-1',
      total_cost: 1000,
      type: 'RENTAL',
      updated: { toDate: vi.fn(() => new Date()) },
      user_id: 'user-1',
      quotation_id: 'quote-1',
      quotation_number: 'Q-001'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(bookingService.getTotalBookingsCount as any).mockResolvedValue(10)
    ;(bookingService.getCollectiblesBookings as any).mockResolvedValue({
      bookings: mockBookings,
      lastDoc: null
    })
    ;(searchBookings as any).mockResolvedValue({
      hits: [],
      error: null
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial Rendering and Data Loading', () => {
    it('renders the page with title and search input', async () => {
      render(<SelectBookingPage />)

      expect(screen.getByText('Select a Reservation')).toBeInTheDocument()
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search bookings...')).toBeInTheDocument()
    })

    it('fetches bookings on mount', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(bookingService.getTotalBookingsCount).toHaveBeenCalledWith('test-company')
        expect(bookingService.getCollectiblesBookings).toHaveBeenCalledWith('test-company', {
          page: 1,
          pageSize: 10,
          lastDoc: undefined
        }, undefined)
      })
    })

    it('displays loading state initially', () => {
      render(<SelectBookingPage />)

      expect(screen.getByText('Loader2')).toBeInTheDocument()
    })

    it('displays bookings in table after loading', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('RV-12345')).toBeInTheDocument()
        expect(screen.getByText('Test Client')).toBeInTheDocument()
        expect(screen.getByText('LED Billboard')).toBeInTheDocument()
        expect(screen.getByText('Test Project')).toBeInTheDocument()
        expect(screen.getByText('RESERVED')).toBeInTheDocument()
      })
    })

    it('displays total bookings count', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('Total Reservations: 10')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('performs search when user types', async () => {
      const user = userEvent.setup()
      render(<SelectBookingPage />)

      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'test search')

      await waitFor(() => {
        expect(searchBookings).toHaveBeenCalledWith('test search', 'test-company')
      }, { timeout: 1000 })
    })

    it('displays search results when available', async () => {
      const mockSearchResults = [
        {
          objectID: 'booking-1',
          reservation_id: 'RV-99999',
          client_name: 'Search Client',
          product_name: 'Search Product',
          project_name: 'Search Project',
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31'),
          status: 'COMPLETED',
          created: new Date()
        }
      ]

      ;(searchBookings as any).mockResolvedValue({
        hits: mockSearchResults,
        error: null
      })

      const user = userEvent.setup()
      render(<SelectBookingPage />)

      const searchInput = screen.getByTestId('search-input')
      await user.type(searchInput, 'search query')

      await waitFor(() => {
        expect(screen.getByText('RV-99999')).toBeInTheDocument()
        expect(screen.getByText('Search Client')).toBeInTheDocument()
      })
    })
  })

  describe('Pagination', () => {
    it('disables previous button on first page', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        const prevButton = screen.getAllByRole('button').find(btn =>
          btn.textContent?.includes('Previous') || btn.querySelector('ChevronLeft')
        )
        expect(prevButton).toBeDisabled()
      })
    })

    it('enables next button when there are more pages', async () => {
      ;(bookingService.getCollectiblesBookings as any).mockResolvedValue({
        bookings: Array(10).fill(mockBookings[0]), // 10 bookings = full page
        lastDoc: {}
      })

      render(<SelectBookingPage />)

      await waitFor(() => {
        const nextButton = screen.getAllByRole('button').find(btn =>
          btn.textContent?.includes('Next') || btn.querySelector('ChevronRight')
        )
        expect(nextButton).not.toBeDisabled()
      })
    })
  })

  describe('Data Field Integration', () => {
    it('displays reservation_id from booking data', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('RV-12345')).toBeInTheDocument()
      })
    })

    it('displays client name from booking data', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Client')).toBeInTheDocument()
      })
    })

    it('displays product name from booking data', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('LED Billboard')).toBeInTheDocument()
      })
    })

    it('displays project name from booking data', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })
    })

    it('displays status as badge', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        const statusBadge = screen.getByText('RESERVED')
        expect(statusBadge).toBeInTheDocument()
        expect(statusBadge.closest('span')).toHaveAttribute('data-variant', 'default')
      })
    })

    it('handles bookings without client name gracefully', async () => {
      const bookingWithoutClient = {
        ...mockBookings[0],
        client: {
          ...mockBookings[0].client,
          name: undefined
        }
      }

      ;(bookingService.getCollectiblesBookings as any).mockResolvedValue({
        bookings: [bookingWithoutClient],
        lastDoc: null
      })

      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument()
      })
    })

    it('handles bookings without product name gracefully', async () => {
      const bookingWithoutProduct = {
        ...mockBookings[0],
        product_name: undefined
      }

      ;(bookingService.getCollectiblesBookings as any).mockResolvedValue({
        bookings: [bookingWithoutProduct],
        lastDoc: null
      })

      render(<SelectBookingPage />)

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A')
        expect(naElements.length).toBeGreaterThan(0)
      })
    })

    it('displays items data correctly', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        // The items field is used internally but displayed through product_name
        expect(screen.getByText('LED Billboard')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays no bookings found message when empty', async () => {
      ;(bookingService.getCollectiblesBookings as any).mockResolvedValue({
        bookings: [],
        lastDoc: null
      })

      render(<SelectBookingPage />)

      await waitFor(() => {
        expect(screen.getByText('No bookings found.')).toBeInTheDocument()
      })
    })
  })

  describe('Date Formatting', () => {
    it('formats dates correctly in table', async () => {
      render(<SelectBookingPage />)

      await waitFor(() => {
        // Should display formatted dates
        const dateCells = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/)
        expect(dateCells.length).toBeGreaterThan(0)
      })
    })

    it('displays N/A for missing dates', async () => {
      const bookingWithoutDates = {
        ...mockBookings[0],
        start_date: null,
        end_date: null,
        created: null
      }

      ;(bookingService.getCollectiblesBookings as any).mockResolvedValue({
        bookings: [bookingWithoutDates],
        lastDoc: null
      })

      render(<SelectBookingPage />)

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A')
        expect(naElements.length).toBeGreaterThan(0)
      })
    })
  })
})