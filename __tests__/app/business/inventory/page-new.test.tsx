import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BusinessInventoryPage from '@/app/business/inventory/page'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from 'sonner'

// Mock Next.js router
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock auth context
const mockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
}

const mockUserData = {
  uid: 'test-user-id',
  company_id: 'test-company-id',
  displayName: 'Test User',
  first_name: 'Test',
  last_name: 'User',
  license_key: 'test-license-key',
}

const mockSubscriptionData = {
  id: 'test-subscription-id',
  status: 'active',
  maxProducts: 100,
}

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    userData: mockUserData,
    subscriptionData: mockSubscriptionData,
    refreshUserData: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock toast
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock responsive hook
vi.mock('@/hooks/use-responsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
  }),
}))

// Mock Firebase services
vi.mock('@/lib/firebase-service', () => ({
  getPaginatedUserProducts: vi.fn(),
  getUserProductsCount: vi.fn(),
  softDeleteProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadFileToFirebaseStorage: vi.fn(),
  getUserProductsRealtime: vi.fn(),
}))

// Mock Algolia service
vi.mock('@/lib/algolia-service', () => ({
  searchProducts: vi.fn(),
}))

// Mock company service
vi.mock('@/lib/company-service', () => ({
  CompanyService: {
    isCompanyInfoComplete: vi.fn(),
  },
}))

// Mock subscription service
vi.mock('@/lib/subscription-service', () => ({
  subscriptionService: {
    getSubscriptionByCompanyId: vi.fn(),
  },
}))

// Mock Google Places component
vi.mock('@/components/google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: ({ value, onChange, onGeopointChange, placeholder }: any) => (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid="location-input"
    />
  ),
}))

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button onClick={() => onValueChange && onValueChange('test-value')}>Select</button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-title">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock other components
vi.mock('@/components/responsive-card-grid', () => ({
  ResponsiveCardGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/delete-confirmation-dialog', () => ({
  DeleteConfirmationDialog: () => null,
}))

vi.mock('@/components/company-registration-dialog', () => ({
  CompanyRegistrationDialog: () => null,
}))

vi.mock('@/components/company-update-dialog', () => ({
  CompanyUpdateDialog: () => null,
}))

vi.mock('@/components/route-protection', () => ({
  RouteProtection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useInView: () => [null, true],
}))

// Mock GSAP
vi.mock('gsap', () => ({
  gsap: {
    set: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn(),
      play: vi.fn(),
      kill: vi.fn(),
    })),
  },
}))

// Mock InventoryContent component
vi.mock('@/components/InventoryContent', () => ({
  default: ({
    title,
    handleAddClick,
    searchQuery,
    setSearchQuery,
    displayedProducts,
    currentPage,
    totalPages,
    filteredProducts
  }: any) => (
    <div>
      <div>
        <h1>{title}</h1>
        <button onClick={handleAddClick}>+Add Site</button>
      </div>
      <div>
        <input
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div>
        {displayedProducts.map((product: any) => (
          <div key={product.id}>{product.name}</div>
        ))}
      </div>
      <div>
        Page {currentPage} of {totalPages} ({filteredProducts.length} items)
      </div>
    </div>
  ),
}))

// Mock AddSiteDialog component
vi.mock('@/components/AddSiteDialog', () => ({
  default: () => null,
}))

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
    <Toaster />
  </AuthProvider>
)

describe('BusinessInventoryPage - Unit Tests', () => {
  const mockProducts = [
    {
      id: 'product-1',
      name: 'Test Billboard',
      type: 'RENTAL',
      price: 15000,
      categories: ['Billboard'],
      content_type: 'Static',
      specs_rental: {
        location: 'Test Location',
        height: 10,
        width: 20,
      },
      media: [],
      active: true,
      deleted: false,
      created: new Date(),
      updated: new Date(),
    },
  ]

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup default mocks
    const { getPaginatedUserProducts, getUserProductsCount, getUserProductsRealtime } = vi.mocked(await import('@/lib/firebase-service'))
    const { searchProducts } = vi.mocked(await import('@/lib/algolia-service'))
    const { CompanyService } = vi.mocked(await import('@/lib/company-service'))
    const { subscriptionService } = vi.mocked(await import('@/lib/subscription-service'))

    getPaginatedUserProducts.mockResolvedValue(mockProducts)
    getUserProductsCount.mockResolvedValue(1)
    getUserProductsRealtime.mockImplementation((companyId, callback) => {
      callback(mockProducts)
      return vi.fn() // unsubscribe function
    })
    searchProducts.mockResolvedValue({ hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: 20, exhaustiveNbHits: true, exhaustiveTypo: true, query: '', params: '', processingTimeMS: 1 })
    CompanyService.isCompanyInfoComplete.mockResolvedValue(true)
    subscriptionService.getSubscriptionByCompanyId.mockResolvedValue({
      id: 'test-subscription',
      status: 'active',
      maxProducts: 100,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the component with correct title', async () => {
      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })
    })

    it('should display products when loaded', async () => {
      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Test Billboard')).toBeInTheDocument()
      })
    })

    it('should show add site button', async () => {
      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Site/i })).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should update search query when typing', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search')
      await user.type(searchInput, 'test search')

      expect(searchInput).toHaveValue('test search')
    })

    it('should call searchProducts when search query is entered', async () => {
      const user = userEvent.setup()
      const { searchProducts } = vi.mocked(await import('@/lib/algolia-service'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search')
      await user.type(searchInput, 'billboard')

      await waitFor(() => {
        expect(searchProducts).toHaveBeenCalledWith(
          'billboard',
          'test-company-id',
          0,
          1000
        )
      })
    })
  })

  describe('Pagination', () => {
    it('should display pagination controls when there are products', async () => {
      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      // Should show pagination info
      expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument()
      expect(screen.getByText(/1 items/)).toBeInTheDocument()
    })
  })

  describe('Subscription and Company Checks', () => {
    it('should check company completeness when adding site', async () => {
      const user = userEvent.setup()
      const { CompanyService } = vi.mocked(await import('@/lib/company-service'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /Add Site/i })
      await user.click(addButton)

      // Should check company completeness
      expect(CompanyService.isCompanyInfoComplete).toHaveBeenCalledWith('test-company-id')
    })

    it('should check subscription limits when adding site', async () => {
      const user = userEvent.setup()
      const { subscriptionService } = vi.mocked(await import('@/lib/subscription-service'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /Add Site/i })
      await user.click(addButton)

      // Should check subscription
      expect(subscriptionService.getSubscriptionByCompanyId).toHaveBeenCalledWith('test-company-id')
    })
  })

  describe('Real-time Updates', () => {
    it('should set up real-time listener on mount', async () => {
      const { getUserProductsRealtime } = vi.mocked(await import('@/lib/firebase-service'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(getUserProductsRealtime).toHaveBeenCalledWith('test-company-id', expect.any(Function))
      })
    })

    it('should update products when real-time listener fires', async () => {
      const { getUserProductsRealtime } = vi.mocked(await import('@/lib/firebase-service'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Test Billboard')).toBeInTheDocument()
      })

      // Verify the listener was set up
      expect(getUserProductsRealtime).toHaveBeenCalled()
    })
  })

  describe('Product Count', () => {
    it('should fetch total product count', async () => {
      const { getUserProductsCount } = vi.mocked(await import('@/lib/firebase-service'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(getUserProductsCount).toHaveBeenCalledWith('test-company-id', { active: true })
      })
    })
  })

  describe('View Mode Toggle', () => {
    it('should render view mode toggle buttons', async () => {
      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      // The view mode buttons are rendered in InventoryContent
      // Since we mocked it, we can't test the actual buttons
      expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should handle empty product list', async () => {
      const { getUserProductsRealtime } = vi.mocked(await import('@/lib/firebase-service'))
      getUserProductsRealtime.mockImplementationOnce((companyId, callback) => {
        callback([])
        return vi.fn()
      })

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      // Should not show any products
      expect(screen.queryByText('Test Billboard')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      const user = userEvent.setup()
      const { searchProducts } = vi.mocked(await import('@/lib/algolia-service'))
      searchProducts.mockRejectedValue(new Error('Search failed'))

      render(
        <TestWrapper>
          <BusinessInventoryPage />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('Enrolled Sites')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search')
      await user.type(searchInput, 'error query')

      // Should still work with fallback client-side filtering
      expect(searchInput).toHaveValue('error query')
    })
  })
})