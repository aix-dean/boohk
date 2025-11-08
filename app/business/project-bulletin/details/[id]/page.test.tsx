import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import BusinessDetailsPage from './page'
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

const mockUseAuth = useAuth as any
const mockUse = React.use as any
const mockBookingService = vi.mocked(require('@/lib/booking-service').bookingService)
const mockGetProductById = vi.mocked(require('@/lib/firebase-service').getProductById)

describe('BusinessDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { uid: 'user-1' },
    })

    mockUse.mockReturnValue({ id: 'test-booking-id' })
  })

  it('renders loading state initially', () => {
    render(<BusinessDetailsPage params={{ id: 'test-id' }} />)

    expect(screen.getByText('Loading site details...')).toBeInTheDocument()
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

    render(<BusinessDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('RES-123')).toBeInTheDocument()
      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('Business')).toBeInTheDocument()
    })
  })

  it('displays back navigation link to business bulletin', async () => {
    const mockBooking = {
      id: 'booking-1',
      reservation_id: 'RES-123',
    }

    mockBookingService.getBookingById.mockResolvedValue(mockBooking)
    mockGetProductById.mockResolvedValue(null)

    render(<BusinessDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      const backLink = screen.getByText('← View Project Bulletin')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/business/project-bulletin')
    })
  })

  it('shows bulletin table headers', async () => {
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

    render(<BusinessDetailsPage params={{ id: 'test-id' }} />)

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('By')).toBeInTheDocument()
      expect(screen.getByText('Department')).toBeInTheDocument()
      expect(screen.getByText('Campaign Name')).toBeInTheDocument()
      expect(screen.getByText('Item')).toBeInTheDocument()
      expect(screen.getByText('Attachment')).toBeInTheDocument()
    })
  })

  it('uses React.use to unwrap params correctly', () => {
    render(<BusinessDetailsPage params={{ id: 'test-id' }} />)

    expect(mockUse).toHaveBeenCalledWith({ id: 'test-id' })
  })
})