import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TopNavigation } from '@/components/top-navigation'

// Mock dependencies
const mockPush = vi.fn()
const mockUsePathname = vi.fn()
const mockFormat = vi.fn()
const mockToast = vi.fn()
const mockOnSnapshot = vi.fn()
const mockGetDoc = vi.fn()
const mockCollection = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockDoc = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
  }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('date-fns', () => ({
  format: (...args: any[]) => mockFormat(...args),
}))

const mockUseAuth = vi.fn()

vi.mock('@/contexts/auth-context', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
}))

vi.mock('@/lib/firebase', () => ({
  db: 'mock-db',
}))
vi.mock('lucide-react', () => ({
  Menu: () => <div data-testid="menu-icon" />,
  X: () => <div data-testid="x-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  LogOut: () => <div data-testid="logout-icon" />,
  User: () => <div data-testid="user-icon" />,
  Bell: () => <div data-testid="bell-icon" />,
  ChevronLeft: () => <div data-testid="chevron-left-icon" />,
}))

describe('TopNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      userData: { uid: 'test-user-id' },
    })
    mockUsePathname.mockReturnValue('/')
    mockFormat.mockReturnValue('12:00 PM | Dec 1, 2023')
    mockOnSnapshot.mockImplementation((query, callback) => {
      // Mock unsubscribe function
      return () => {}
    })
  })

  describe('Time Display', () => {
    it('displays formatted current time', () => {
      render(<TopNavigation />)
      expect(screen.getByText('12:00 PM | Dec 1, 2023')).toBeInTheDocument()
    })

    it('calls format with correct pattern', () => {
      render(<TopNavigation />)
      expect(mockFormat).toHaveBeenCalledWith(expect.any(Date), 'h:mm a | MMM d, yyyy')
    })
  })

  describe('Section-based Styling', () => {
    it('applies sales background color for sales section', () => {
      mockUsePathname.mockReturnValue('/sales/dashboard')
      render(<TopNavigation />)
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('bg-department-sales-red')
    })

    it('applies logistics background color for logistics section', () => {
      mockUsePathname.mockReturnValue('/logistics/dashboard')
      render(<TopNavigation />)
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('bg-[#48a7fa]')
    })

    it('applies default background color for other sections', () => {
      mockUsePathname.mockReturnValue('/unknown')
      render(<TopNavigation />)
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('bg-[#A1A1A1]')
    })
  })

  describe('Firestore Booking Listener', () => {
    it('sets up Firestore query listener when userData.uid exists', () => {
      render(<TopNavigation />)

      expect(mockCollection).toHaveBeenCalledWith('mock-db', 'booking')
      expect(mockWhere).toHaveBeenCalledWith('seller_id', '==', 'test-user-id')
      expect(mockWhere).toHaveBeenCalledWith('for_censorship', '==', 1)
      expect(mockWhere).toHaveBeenCalledWith('for_screening', '==', 0)
      expect(mockQuery).toHaveBeenCalled()
      expect(mockOnSnapshot).toHaveBeenCalled()
    })

    it('does not set up listener when userData.uid is undefined', () => {
      mockUseAuth.mockReturnValue({
        userData: {},
      })

      render(<TopNavigation />)

      expect(mockOnSnapshot).not.toHaveBeenCalled()
    })

    it('triggers toast notification for new booking documents', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        // Simulate initial snapshot with no changes
        callback({
          docChanges: () => []
        })
        // Simulate new document added
        setTimeout(() => {
          callback({
            docChanges: () => [{
              type: 'added',
              doc: {
                data: () => ({ product_id: 'product-123' })
              }
            }]
          })
        }, 0)
        return mockUnsubscribe
      })

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'Test Product' })
      })

      render(<TopNavigation />)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'New Booking Request',
          description: 'New request for Test Product',
          onClick: expect.any(Function),
          action: expect.any(Object),
        })
      })
    })

    it('includes product name in toast description', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          docChanges: () => []
        })
        setTimeout(() => {
          callback({
            docChanges: () => [{
              type: 'added',
              doc: {
                data: () => ({ product_id: 'product-123' })
              }
            }]
          })
        }, 0)
        return mockUnsubscribe
      })

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'Amazing Product' })
      })

      render(<TopNavigation />)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'New request for Amazing Product'
          })
        )
      })
    })

    it('uses "Unknown Product" when product document does not exist', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          docChanges: () => []
        })
        setTimeout(() => {
          callback({
            docChanges: () => [{
              type: 'added',
              doc: {
                data: () => ({ product_id: 'product-123' })
              }
            }]
          })
        }, 0)
        return mockUnsubscribe
      })

      mockGetDoc.mockResolvedValue({
        exists: () => false,
      })

      render(<TopNavigation />)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'New request for Unknown Product'
          })
        )
      })
    })

    it('navigates to product page when toast onClick is triggered', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          docChanges: () => []
        })
        setTimeout(() => {
          callback({
            docChanges: () => [{
              type: 'added',
              doc: {
                data: () => ({ product_id: 'product-123' })
              }
            }]
          })
        }, 0)
        return mockUnsubscribe
      })

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'Test Product' })
      })

      render(<TopNavigation />)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      const toastCall = mockToast.mock.calls[0][0]
      toastCall.onClick()

      expect(mockPush).toHaveBeenCalledWith('/sales/products/84JebQAP1NCTAPXx8xYN')
    })

    it('navigates to product page when ToastAction onClick is triggered', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          docChanges: () => []
        })
        setTimeout(() => {
          callback({
            docChanges: () => [{
              type: 'added',
              doc: {
                data: () => ({ product_id: 'product-123' })
              }
            }]
          })
        }, 0)
        return mockUnsubscribe
      })

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'Test Product' })
      })

      render(<TopNavigation />)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled()
      })

      const toastCall = mockToast.mock.calls[0][0]
      const actionElement = toastCall.action
      // Simulate clicking the ToastAction
      actionElement.props.onClick()

      expect(mockPush).toHaveBeenCalledWith('/sales/products/84JebQAP1NCTAPXx8xYN')
    })

    it('does not trigger toast for initial load documents', () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        // Initial load with existing documents
        callback({
          docChanges: () => [{
            type: 'added',
            doc: {
              data: () => ({ product_id: 'product-123' })
            }
          }]
        })
        return mockUnsubscribe
      })

      render(<TopNavigation />)

      expect(mockToast).not.toHaveBeenCalled()
    })

    it('ignores non-added changes', () => {
      const mockUnsubscribe = vi.fn()
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({
          docChanges: () => []
        })
        setTimeout(() => {
          callback({
            docChanges: () => [{
              type: 'modified',
              doc: {
                data: () => ({ product_id: 'product-123' })
              }
            }]
          })
        }, 0)
        return mockUnsubscribe
      })

      render(<TopNavigation />)

      // Wait a bit to ensure no toast is called
      setTimeout(() => {
        expect(mockToast).not.toHaveBeenCalled()
      }, 10)
    })
  })
})