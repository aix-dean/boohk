import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SalesDashboardPage, { ProductCard } from './page'

// Mock all external dependencies
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-user-id' },
    userData: {
      company_id: 'test-company-id',
      first_name: 'John',
      last_name: 'Doe'
    }
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}))

vi.mock('@/hooks/use-responsive', () => ({
  useResponsive: vi.fn(() => ({
    isMobile: false,
    isTablet: false
  }))
}))

vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: vi.fn((value) => value)
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn()
  })),
  useSearchParams: vi.fn(() => new URLSearchParams())
}))

vi.mock('@/lib/firebase-service', () => ({
  getPaginatedUserProducts: vi.fn(() => Promise.resolve({
    items: [
      {
        id: 'product-1',
        name: 'Test Product 1',
        type: 'rental',
        price: 1000,
        media: [{ url: 'test-image.jpg' }],
        specs_rental: { location: 'Test Location' },
        site_code: 'SC001',
        description: 'Test description',
        active: true,
        deleted: false,
        seller_id: 'seller-1',
        company_id: 'company-1',
        created_at: new Date(),
        updated_at: new Date()
      } as any,
      {
        id: 'product-2',
        name: 'Test Product Without Image',
        type: 'rental',
        price: 2000,
        media: [], // No media for testing NO IMAGE fallback
        specs_rental: { location: 'Test Location 2' },
        site_code: 'SC002',
        description: 'Test description 2',
        active: true,
        deleted: false,
        seller_id: 'seller-2',
        company_id: 'company-2',
        created_at: new Date(),
        updated_at: new Date()
      } as any
    ],
    lastDoc: null,
    hasMore: false
  })),
  getUserProductsCount: vi.fn(() => Promise.resolve(2)),
  softDeleteProduct: vi.fn(),
  type: {
    Product: {},
    Booking: {}
  }
}))

vi.mock('@/lib/client-service', () => ({
  getPaginatedClients: vi.fn(() => Promise.resolve({
    items: [],
    lastDoc: null,
    hasMore: false
  })),
  type: {
    Client: {}
  }
}))

vi.mock('@/components/search-box', () => ({
  SearchBox: () => <div data-testid="search-box" />
}))

vi.mock('@/components/responsive-card-grid', () => ({
  ResponsiveCardGrid: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-card-grid">{children}</div>
  )
}))

vi.mock('@/components/sales-chat/sales-chat-widget', () => ({
  SalesChatWidget: () => <div data-testid="sales-chat-widget" />
}))

vi.mock('@/components/route-protection', () => ({
  RouteProtection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, fill, className, onError }: any) => (
    <img
      src={src}
      alt={alt}
      style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : {}}
      className={className}
      onError={onError}
    />
  )
}))

describe('ProductCard - NO IMAGE Fallback', () => {
  const mockProductWithImage = {
    id: 'product-1',
    name: 'Test Product 1',
    type: 'rental' as const,
    price: 1000,
    media: [{ url: 'test-image.jpg' }],
    specs_rental: { location: 'Test Location' },
    site_code: 'SC001',
    description: 'Test description',
    active: true,
    deleted: false,
    seller_id: 'seller-1',
    seller_name: 'Seller 1',
    company_id: 'company-1',
    position: 1,
    created_at: new Date(),
    updated_at: new Date()
  }

  const mockProductWithoutImage = {
    id: 'product-2',
    name: 'Test Product Without Image',
    type: 'rental' as const,
    price: 2000,
    media: [], // No media for testing NO IMAGE fallback
    specs_rental: { location: 'Test Location 2' },
    site_code: 'SC002',
    description: 'Test description 2',
    active: true,
    deleted: false,
    seller_id: 'seller-2',
    seller_name: 'Seller 2',
    company_id: 'company-2',
    position: 2,
    created_at: new Date(),
    updated_at: new Date()
  }

  const mockProps = {
    hasOngoingBooking: false,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCreateReport: vi.fn(),
    isSelected: false,
    onSelect: vi.fn(),
    selectionMode: false
  }

  it('displays "NO IMAGE" text for products without media', () => {
    render(<ProductCard product={mockProductWithoutImage as any} {...mockProps} />)

    expect(screen.getByText('NO IMAGE')).toBeInTheDocument()
  })

  it('renders products with images normally', () => {
    render(<ProductCard product={mockProductWithImage as any} {...mockProps} />)

    const image = screen.getByRole('img')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'test-image.jpg')
  })

  it('displays product information correctly', () => {
    render(<ProductCard product={mockProductWithImage as any} {...mockProps} />)

    expect(screen.getByText('SC001')).toBeInTheDocument()
    expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    expect(screen.getByText('Test Location')).toBeInTheDocument()
    expect(screen.getByText('₱1,000/month')).toBeInTheDocument()
  })
})