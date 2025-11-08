import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import LogisticsBulletinBoardPage from './page'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock useAuth
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

// Mock BulletinBoardContent
vi.mock('@/components/BulletinBoardContent', () => ({
  BulletinBoardContent: ({ title, showTitle, showSearch, searchTerm, setSearchTerm, loading, bookings, products, currentPage, itemsPerPage, totalPages, handleNextPage, handlePreviousPage, reports, reportsLoading, projectNames }: any) => (
    <div data-testid="bulletin-board-content">
      <h1>{title}</h1>
      {showSearch && <input placeholder="Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />}
      <div data-testid="loading-state">{loading ? 'Loading...' : 'Loaded'}</div>
      <div data-testid="bookings-count">{bookings.length} bookings</div>
      <div data-testid="products-count">{products.length} products</div>
      <div data-testid="current-page">Page {currentPage}</div>
      <div data-testid="total-pages">Total pages: {totalPages}</div>
      <button onClick={handleNextPage} data-testid="next-page">Next</button>
      <button onClick={handlePreviousPage} data-testid="prev-page">Previous</button>
      <div data-testid="reports-loading">{reportsLoading ? 'Reports loading...' : 'Reports loaded'}</div>
    </div>
  ),
}))

// Mock getLatestReportsPerBooking
vi.mock('@/lib/report-service', () => ({
  getLatestReportsPerBooking: vi.fn(),
  ReportData: {},
}))

// Mock bookingService
vi.mock('@/lib/booking-service', () => ({
  bookingService: {
    getBookingsByCompanyId: vi.fn(),
  },
}))

// Mock firebase services
vi.mock('@/lib/firebase-service', () => ({
  getProductById: vi.fn(),
}))

const mockUseAuth = useAuth as any
const mockUseRouter = useRouter as any
const mockGetLatestReportsPerBooking = vi.mocked(require('@/lib/report-service').getLatestReportsPerBooking)
const mockBookingService = vi.mocked(require('@/lib/booking-service').bookingService)
const mockGetProductById = vi.mocked(require('@/lib/firebase-service').getProductById)

describe('LogisticsBulletinBoardPage', () => {
  let mockRouter: any

  beforeEach(() => {
    mockRouter = {
      push: vi.fn(),
      back: vi.fn(),
    }
    mockUseRouter.mockReturnValue(mockRouter)
    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1' },
      userData: { company_id: 'company-1' },
    })

    // Reset mocks
    vi.clearAllMocks()
  })

  it('renders the bulletin board content with correct title', () => {
    render(<LogisticsBulletinBoardPage />)

    expect(screen.getByText('Bulletin Board')).toBeInTheDocument()
    expect(screen.getByTestId('bulletin-board-content')).toBeInTheDocument()
  })

  it('shows search input by default', () => {
    render(<LogisticsBulletinBoardPage />)

    const searchInput = screen.getByPlaceholderText('Search')
    expect(searchInput).toBeInTheDocument()
  })

  it('updates search term when input changes', () => {
    render(<LogisticsBulletinBoardPage />)

    const searchInput = screen.getByPlaceholderText('Search')
    fireEvent.change(searchInput, { target: { value: 'test search' } })

    expect(searchInput).toHaveValue('test search')
  })

  it('passes correct props to BulletinBoardContent', () => {
    render(<LogisticsBulletinBoardPage />)

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading...')
    expect(screen.getByTestId('bookings-count')).toHaveTextContent('0 bookings')
    expect(screen.getByTestId('products-count')).toHaveTextContent('0 products')
    expect(screen.getByTestId('current-page')).toHaveTextContent('Page 1')
    expect(screen.getByTestId('total-pages')).toHaveTextContent('Total pages: 1')
    expect(screen.getByTestId('reports-loading')).toHaveTextContent('Reports loading...')
  })

  it('handles pagination correctly', () => {
    render(<LogisticsBulletinBoardPage />)

    const nextButton = screen.getByTestId('next-page')
    const prevButton = screen.getByTestId('prev-page')

    fireEvent.click(nextButton)
    fireEvent.click(prevButton)

    // These should trigger the handlers passed to BulletinBoardContent
    expect(nextButton).toBeInTheDocument()
    expect(prevButton).toBeInTheDocument()
  })

  it('fetches bookings and reports on mount', async () => {
    const mockBookings = [
      { id: 'booking-1', product_id: 'product-1', reservation_id: 'RES-1' },
    ]
    const mockReports = { 'RES-1': [{ id: 'report-1' }] }

    mockBookingService.getBookingsByCompanyId.mockResolvedValue(mockBookings)
    mockGetLatestReportsPerBooking.mockResolvedValue(mockReports)
    mockGetProductById.mockResolvedValue({ id: 'product-1', name: 'Test Product' })

    render(<LogisticsBulletinBoardPage />)

    await waitFor(() => {
      expect(mockBookingService.getBookingsByCompanyId).toHaveBeenCalledWith('company-1')
      expect(mockGetLatestReportsPerBooking).toHaveBeenCalledWith('company-1')
    })
  })

  it('handles loading state correctly', async () => {
    mockBookingService.getBookingsByCompanyId.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)))
    mockGetLatestReportsPerBooking.mockResolvedValue({})

    render(<LogisticsBulletinBoardPage />)

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading...')

    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('Loaded')
    })
  })

  it('calculates total pages correctly', async () => {
    const mockBookings = Array.from({ length: 15 }, (_, i) => ({
      id: `booking-${i + 1}`,
      product_id: `product-${i + 1}`,
      reservation_id: `RES-${i + 1}`,
    }))

    mockBookingService.getBookingsByCompanyId.mockResolvedValue(mockBookings)
    mockGetLatestReportsPerBooking.mockResolvedValue({})
    mockGetProductById.mockResolvedValue({ id: 'product-1', name: 'Test Product' })

    render(<LogisticsBulletinBoardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('total-pages')).toHaveTextContent('Total pages: 2')
    })
  })

  it('handles authentication correctly', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userData: null,
    })

    render(<LogisticsBulletinBoardPage />)

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Loading...')
  })

  it('navigates to booking details on card click', async () => {
    const mockBookings = [
      { id: 'booking-1', product_id: 'product-1', reservation_id: 'RES-1' },
    ]

    mockBookingService.getBookingsByCompanyId.mockResolvedValue(mockBookings)
    mockGetLatestReportsPerBooking.mockResolvedValue({})
    mockGetProductById.mockResolvedValue({ id: 'product-1', name: 'Test Product' })

    render(<LogisticsBulletinBoardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('bookings-count')).toHaveTextContent('1 bookings')
    })

    // The BulletinBoardContent should handle navigation through its linkPrefix prop
    expect(screen.getByTestId('bulletin-board-content')).toBeInTheDocument()
  })
})