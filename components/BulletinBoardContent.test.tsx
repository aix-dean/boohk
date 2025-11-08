import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { BulletinBoardContent } from './BulletinBoardContent'

// Mock Pagination component
vi.mock('@/components/ui/pagination', () => ({
  Pagination: ({ currentPage, itemsPerPage, totalItems, onNextPage, onPreviousPage, hasMore, className }: any) => (
    <div data-testid="pagination" className={className}>
      <button onClick={onPreviousPage} disabled={currentPage === 1}>Previous</button>
      <span>Page {currentPage}</span>
      <button onClick={onNextPage} disabled={!hasMore}>Next</button>
    </div>
  ),
}))

// Mock BookingCard component
vi.mock('./BookingCard', () => ({
  BookingCard: ({ booking, product }: any) => (
    <div data-testid={`booking-card-${booking.id}`}>
      <h3>{booking.reservation_id || booking.id}</h3>
      <p>{product?.name || 'No product'}</p>
    </div>
  ),
}))

describe('BulletinBoardContent', () => {
  const mockBookings = [
    {
      id: 'booking-1',
      product_id: 'product-1',
      reservation_id: 'RES-123',
      project_name: 'Project A',
    },
    {
      id: 'booking-2',
      product_id: 'product-2',
      reservation_id: 'RES-456',
      project_name: 'Project B',
    },
  ]

  const mockProducts = [
    { id: 'product-1', name: 'Site A', description: '', price: 0, active: true, deleted: false, seller_id: 'seller-1', seller_name: 'Seller 1', position: 0 },
    { id: 'product-2', name: 'Site B', description: '', price: 0, active: true, deleted: false, seller_id: 'seller-2', seller_name: 'Seller 2', position: 1 },
  ]

  const mockReports = {
    'RES-123': [{
      id: 'report-1',
      siteId: 'site-1',
      siteName: 'Site A',
      companyId: 'company-1',
      sellerId: 'seller-1',
      client: 'Client A',
      clientId: 'client-1',
      bookingDates: { start: Timestamp.now(), end: Timestamp.now() },
      breakdate: Timestamp.now(),
      sales: 'sales-1',
      reportType: 'completion',
      date: '2023-01-01',
      attachments: [],
      status: 'draft',
      createdBy: 'user-1',
      createdByName: 'User One',
      category: 'maintenance',
      subcategory: 'repair',
      priority: 'high',
      completionPercentage: 100,
      tags: [],
      descriptionOfWork: 'Work done'
    }],
  }

  const defaultProps = {
    title: 'Test Bulletin Board',
    showTitle: true,
    showSearch: true,
    containerClassName: 'test-container',
    paginationClassName: 'test-pagination',
    linkPrefix: '/test',
    latestJoIds: {},
    searchTerm: '',
    setSearchTerm: vi.fn(),
    loading: false,
    bookings: mockBookings,
    products: mockProducts,
    currentPage: 1,
    itemsPerPage: 9,
    totalPages: 1,
    handleNextPage: vi.fn(),
    handlePreviousPage: vi.fn(),
    reports: mockReports,
    reportsLoading: false,
    serviceAssignments: {},
    serviceAssignmentsLoading: false,
  }

  it('renders title when showTitle is true', () => {
    render(<BulletinBoardContent {...defaultProps} />)

    expect(screen.getByText('Test Bulletin Board')).toBeInTheDocument()
  })

  it('does not render title when showTitle is false', () => {
    const propsWithoutTitle = { ...defaultProps, showTitle: false }
    render(<BulletinBoardContent {...propsWithoutTitle} />)

    expect(screen.queryByText('Test Bulletin Board')).not.toBeInTheDocument()
  })

  it('renders search input when showSearch is true', () => {
    render(<BulletinBoardContent {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText('Search')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveValue('')
  })

  it('does not render search input when showSearch is false', () => {
    const propsWithoutSearch = { ...defaultProps, showSearch: false }
    render(<BulletinBoardContent {...propsWithoutSearch} />)

    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument()
  })

  it('updates search term when input changes', () => {
    const mockSetSearchTerm = vi.fn()
    const propsWithSearch = { ...defaultProps, setSearchTerm: mockSetSearchTerm }

    render(<BulletinBoardContent {...propsWithSearch} />)

    const searchInput = screen.getByPlaceholderText('Search')
    fireEvent.change(searchInput, { target: { value: 'test search' } })

    expect(mockSetSearchTerm).toHaveBeenCalledWith('test search')
  })

  it('renders loading skeleton when loading is true', () => {
    const propsWithLoading = { ...defaultProps, loading: true }
    render(<BulletinBoardContent {...propsWithLoading} />)

    // Should render skeleton elements
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('renders "No Activities yet" when no bookings', () => {
    const propsWithoutBookings = { ...defaultProps, bookings: [] }
    render(<BulletinBoardContent {...propsWithoutBookings} />)

    expect(screen.getByText('No Activities yet')).toBeInTheDocument()
  })

  it('renders booking cards when bookings are available', () => {
    render(<BulletinBoardContent {...defaultProps} />)

    expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument()
    expect(screen.getByTestId('booking-card-booking-2')).toBeInTheDocument()
  })

  it('passes correct props to BookingCard components', () => {
    render(<BulletinBoardContent {...defaultProps} />)

    expect(screen.getByText('RES-123')).toBeInTheDocument()
    expect(screen.getByText('RES-456')).toBeInTheDocument()
    expect(screen.getByText('Site A')).toBeInTheDocument()
    expect(screen.getByText('Site B')).toBeInTheDocument()
  })

  it('renders pagination when totalPages > 1', () => {
    const propsWithPagination = { ...defaultProps, totalPages: 2 }
    render(<BulletinBoardContent {...propsWithPagination} />)

    expect(screen.getByTestId('pagination')).toBeInTheDocument()
  })

  it('does not render pagination when totalPages = 1', () => {
    render(<BulletinBoardContent {...defaultProps} />)

    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
  })

  it('applies container className correctly', () => {
    const { container } = render(<BulletinBoardContent {...defaultProps} />)

    const mainContainer = container.firstChild
    expect(mainContainer).toHaveClass('test-container')
  })

  it('applies pagination className correctly', () => {
    const propsWithPagination = { ...defaultProps, totalPages: 2 }
    render(<BulletinBoardContent {...propsWithPagination} />)

    const paginationWrapper = screen.getByTestId('pagination').parentElement
    expect(paginationWrapper).toHaveClass('test-pagination')
  })

  it('slices bookings based on current page and items per page', () => {
    const manyBookings = Array.from({ length: 15 }, (_, i) => ({
      id: `booking-${i + 1}`,
      product_id: `product-${i + 1}`,
      reservation_id: `RES-${i + 1}`,
      project_name: `Project ${i + 1}`,
    }))

    const propsWithManyBookings = {
      ...defaultProps,
      bookings: manyBookings,
      itemsPerPage: 9,
      currentPage: 1,
    }

    render(<BulletinBoardContent {...propsWithManyBookings} />)

    // Should show first 9 bookings
    expect(screen.getByTestId('booking-card-booking-1')).toBeInTheDocument()
    expect(screen.getByTestId('booking-card-booking-9')).toBeInTheDocument()
    expect(screen.queryByTestId('booking-card-booking-10')).not.toBeInTheDocument()
  })

  it('calls pagination handlers correctly', () => {
    const mockNextPage = vi.fn()
    const mockPrevPage = vi.fn()
    const propsWithPagination = {
      ...defaultProps,
      totalPages: 3,
      currentPage: 2,
      handleNextPage: mockNextPage,
      handlePreviousPage: mockPrevPage,
    }

    render(<BulletinBoardContent {...propsWithPagination} />)

    const nextButton = screen.getByText('Next')
    const prevButton = screen.getByText('Previous')

    fireEvent.click(nextButton)
    expect(mockNextPage).toHaveBeenCalled()

    fireEvent.click(prevButton)
    expect(mockPrevPage).toHaveBeenCalled()
  })

  it('renders search icons correctly', () => {
    render(<BulletinBoardContent {...defaultProps} />)

    // Check for SVG icons (calendar and grid icons)
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })
})