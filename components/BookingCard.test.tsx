import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { BookingCard } from './BookingCard'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className, onError }: any) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={onError}
    />
  ),
}))

// Mock Skeleton component
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} data-testid="skeleton" />
  ),
}))

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, onClick, className }: any) => (
    <button
      className={className}
      onClick={onClick}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}))

// Mock formatDateShort utility
vi.mock('@/lib/utils', () => ({
  formatDateShort: (date: any) => {
    if (date?.toDate) return 'Jan 15'
    if (date instanceof Date) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return 'N/A'
  },
}))

describe('BookingCard', () => {
  const mockBooking = {
    id: 'booking-1',
    product_id: 'product-1',
    reservation_id: 'RES-123',
    project_name: 'Test Project',
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-01-31'),
  }

  const mockProduct = {
    id: 'product-1',
    name: 'Test Site',
    description: 'Test description',
    price: 1000,
    active: true,
    deleted: false,
    seller_id: 'seller-1',
    seller_name: 'Seller 1',
    position: 0,
    media: [{ url: 'test-image.jpg', distance: '0', type: 'image', isVideo: false }],
  }

  const mockReports = {
    'RES-123': [
      {
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
        date: '2024-01-15',
        attachments: [],
        status: 'completed',
        createdBy: 'user-1',
        createdByName: 'User One',
        category: 'maintenance',
        subcategory: 'repair',
        priority: 'high',
        completionPercentage: 100,
        tags: [],
        descriptionOfWork: 'Installation completed',
        created: Timestamp.now(),
      },
    ],
  }

  const defaultProps = {
    booking: mockBooking,
    product: mockProduct,
    reports: mockReports,
    reportsLoading: false,
    serviceAssignments: {},
    serviceAssignmentsLoading: false,
    linkPrefix: '/test',
    latestJoIds: {},
  }

  it('renders booking card with basic information', () => {
    render(<BookingCard {...defaultProps} />)

    expect(screen.getByText('RES-123')).toBeInTheDocument()
    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('Site:')).toBeInTheDocument()
    expect(screen.getByText('Test Site')).toBeInTheDocument()
  })

  it('displays reservation ID correctly', () => {
    render(<BookingCard {...defaultProps} />)

    expect(screen.getByText('RES-123')).toBeInTheDocument()
  })

  it('shows project name from booking', () => {
    render(<BookingCard {...defaultProps} />)

    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('displays product image when available', () => {
    render(<BookingCard {...defaultProps} />)

    const image = screen.getByAltText('Site Photo')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'test-image.jpg')
  })

  it('shows placeholder when no product image', () => {
    const propsWithoutImage = {
      ...defaultProps,
      product: { ...mockProduct, media: [] },
    }

    render(<BookingCard {...propsWithoutImage} />)

    // Check that the placeholder span exists
    const placeholderSpan = document.querySelector('span.text-center')
    expect(placeholderSpan).toBeInTheDocument()
    expect(placeholderSpan?.textContent).toContain('No')
  })

  it('displays latest activities when reports are available', () => {
    render(<BookingCard {...defaultProps} />)

    expect(screen.getByText('Latest Activities:')).toBeInTheDocument()
    expect(screen.getByText('Jan 15 - Installation completed')).toBeInTheDocument()
  })

  it('shows loading skeleton when reports are loading', () => {
    const propsWithLoading = {
      ...defaultProps,
      reportsLoading: true,
    }

    render(<BookingCard {...propsWithLoading} />)

    expect(screen.getAllByTestId('skeleton')).toHaveLength(2)
  })

  it('shows "No Activities yet" when no reports available', () => {
    const propsWithoutReports = {
      ...defaultProps,
      reports: {},
    }

    render(<BookingCard {...propsWithoutReports} />)

    expect(screen.getByText('No Activities yet')).toBeInTheDocument()
  })

  it('renders as clickable when onClick prop is provided', () => {
    const mockOnClick = vi.fn()
    const propsWithOnClick = {
      ...defaultProps,
      onClick: mockOnClick,
    }

    render(<BookingCard {...propsWithOnClick} />)

    const card = screen.getByRole('button')
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('tabIndex', '0')
  })

  it('renders as link when no onClick prop and linkPrefix provided', () => {
    render(<BookingCard {...defaultProps} />)

    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test/booking-1')
  })

  it('displays correct reservation ID fallback', () => {
    const propsWithoutReservationId = {
      ...defaultProps,
      booking: { ...mockBooking, reservation_id: undefined },
    }

    render(<BookingCard {...propsWithoutReservationId} />)

    expect(screen.getByText('booking-1')).toBeInTheDocument()
  })
})