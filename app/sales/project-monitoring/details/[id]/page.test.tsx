import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SalesDetailsPage from './page'
import { useAuth } from '@/contexts/auth-context'
import React from 'react'

// Mock React
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    use: vi.fn(),
  }
})

// Mock useAuth
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

// Mock bookingService
vi.mock('@/lib/booking-service', () => ({
  bookingService: {
    getBookingById: vi.fn(),
  },
}))

// Mock firebase services
vi.mock('@/lib/firebase-service', () => ({
  getProductById: vi.fn(),
}))

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  getFirestore: vi.fn(),
}))

// Mock CreateReportDialog
vi.mock('@/components/create-report-dialog', () => ({
  CreateReportDialog: ({ open }: { open: boolean }) => open ? <div>Create Report Dialog</div> : null,
}))

// Mock Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant }: any) => (
    <button data-variant={variant}>{children}</button>
  ),
}))

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}))

// Mock Badge
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}))

// Mock icons
vi.mock('lucide-react', () => ({
  ArrowLeft: () => <div>ArrowLeft</div>,
  Calendar: () => <div>Calendar</div>,
  User: () => <div>User</div>,
  Building: () => <div>Building</div>,
  Loader2: () => <div>Loader2</div>,
  AlertCircle: () => <div>AlertCircle</div>,
  FileText: () => <div>FileText</div>,
}))

const mockUseAuth = useAuth as any
const mockUse = React.use as any
const mockBookingService = vi.mocked(require('@/lib/booking-service').bookingService)
const mockGetProductById = vi.mocked(require('@/lib/firebase-service').getProductById)

describe('SalesDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1' },
    })

    mockUse.mockReturnValue({ id: 'test-booking-id' })
  })

  it('renders loading state initially', () => {
    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    expect(screen.getByText('Loading site details...')).toBeInTheDocument()
  })

  it('renders error state when booking not found', async () => {
    mockBookingService.getBookingById.mockResolvedValue(null)

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('Booking not found')).toBeInTheDocument()
    })
  })

  it('renders booking details when data is loaded', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
      project_name: 'Test Project',
      client: { name: 'Test Client' },
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
    }

    const mockProduct = {
      id: 'product-1',
      name: 'Test Site',
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(mockProduct)

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('RES-123')).toBeInTheDocument()
      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('Test Client')).toBeInTheDocument()
    })
  })

  it('displays back navigation link', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
      project_name: 'Test Project',
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      const backLink = screen.getByText('← View Project Bulletin')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/sales/project-monitoring')
    })
  })

  it('shows Actions button', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  it('renders bulletin table with reports', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
      project_name: 'Test Project',
    }

    const mockReports = [
      {
        id: 'report-1',
        created: { toDate: () => new Date('2024-01-15') },
        createdByName: 'Test User',
        reportType: 'completion-report',
        attachments: [{ fileUrl: 'test.pdf', fileType: 'pdf' }],
      },
    ]

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    // Mock the firestore functions
    const mockQuery = vi.fn()
    const mockWhere = vi.fn()
    const mockOrderBy = vi.fn()
    const mockGetDocs = vi.fn()
    const mockOnSnapshot = vi.fn()

    vi.mocked(require('firebase/firestore')).collection.mockReturnValue('collection-ref')
    vi.mocked(require('firebase/firestore')).query.mockReturnValue('query-ref')
    vi.mocked(require('firebase/firestore')).where.mockReturnValue('where-ref')
    vi.mocked(require('firebase/firestore')).orderBy.mockReturnValue('orderBy-ref')
    vi.mocked(require('firebase/firestore')).getDocs.mockResolvedValue({
      docs: mockReports.map(report => ({
        id: report.id,
        data: () => ({ ...report, attachments: [] }),
      })),
    })
    vi.mocked(require('firebase/firestore')).onSnapshot.mockImplementation((query, callback) => {
      callback({
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => ({ ...report, attachments: [] }),
        })),
      })
      return vi.fn() // unsubscribe function
    })

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('By')).toBeInTheDocument()
      expect(screen.getByText('Department')).toBeInTheDocument()
      expect(screen.getByText('Campaign Name')).toBeInTheDocument()
      expect(screen.getByText('Item')).toBeInTheDocument()
      expect(screen.getByText('Attachment')).toBeInTheDocument()
    })
  })

  it('shows "No reports found" when no reports available', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    vi.mocked(require('firebase/firestore')).getDocs.mockResolvedValue({ docs: [] })
    vi.mocked(require('firebase/firestore')).onSnapshot.mockImplementation((query, callback) => {
      callback({ docs: [] })
      return vi.fn()
    })

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('No reports found for this booking')).toBeInTheDocument()
    })
  })

  it('handles booking with missing product gracefully', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
      project_name: 'Test Project',
      client: { name: 'Test Client' },
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('Unknown Site')).toBeInTheDocument()
    })
  })

  it('formats dates correctly in booking details', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('Jan 1 - Jan 31')).toBeInTheDocument()
    })
  })

  it('uses React.use to unwrap params correctly', () => {
    render(<SalesDetailsPage params={{ id: 'test-id' }} />)

    expect(mockUse).toHaveBeenCalledWith({ id: 'test-id' })
  })
})