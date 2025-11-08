import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'test-doc-id' })),
  serverTimestamp: vi.fn(() => new Date()),
  getDoc: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => date),
  },
}))

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {},
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-user-id', displayName: 'Test User' },
    userData: {
      first_name: 'Test',
      last_name: 'User',
      company_id: 'test-company-id',
      license_key: 'test-license-key'
    }
  }))
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}))

vi.mock('@/lib/teams-service', () => ({
  teamsService: {
    getAllTeams: vi.fn(() => Promise.resolve([]))
  }
}))

vi.mock('@/lib/company-service', () => ({
  CompanyService: {
    getCompanyData: vi.fn(() => Promise.resolve(null))
  }
}))

vi.mock('@/lib/pdf-service', () => ({
  generateServiceAssignmentPDF: vi.fn(() => Promise.resolve('mock-pdf-base64'))
}))

vi.mock('@/lib/job-order-service', () => ({
  getJobOrderById: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn()
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'jobOrderId') return 'test-job-order-id'
      if (key === 'booking_id') return 'test-booking-id-123'
      return null
    })
  })),
  useParams: vi.fn(() => ({
    id: 'preview'
  }))
}))

// Mock the components
vi.mock('@/components/service-assignment-success-dialog', () => ({
  ServiceAssignmentSuccessDialog: ({ open, onOpenChange, saNumber, onViewAssignments, onCreateAnother }: any) =>
    open ? (
      <div data-testid="success-dialog">
        <p>Success! SA Number: {saNumber}</p>
        <button onClick={onViewAssignments} data-testid="view-assignments-btn">View Assignments</button>
        <button onClick={onCreateAnother} data-testid="create-another-btn">Create Another</button>
      </div>
    ) : null
}))

vi.mock('@/components/team-form-dialog', () => ({
  TeamFormDialog: ({ open }: any) => open ? <div data-testid="team-form-dialog">Team Form</div> : null
}))

vi.mock('@/components/logistics/assignments/create/JobOrderSelectionDialog', () => ({
  JobOrderSelectionDialog: ({ open, onSelectJobOrder }: any) =>
    open ? (
      <div data-testid="job-order-dialog">
        <button
          onClick={() => onSelectJobOrder({
            id: 'test-job-order-id',
            booking_id: 'test-booking-id-123',
            joType: 'Installation',
            remarks: 'Test job order',
            product_id: 'test-product-id'
          })}
          data-testid="select-job-order-btn"
        >
          Select Job Order
        </button>
      </div>
    ) : null
}))

vi.mock('@/components/logistics/assignments/create/ProductSelectionDialog', () => ({
  ProductSelectionDialog: ({ open, onSelectProduct }: any) =>
    open ? (
      <div data-testid="product-dialog">
        <button
          onClick={() => onSelectProduct({
            id: 'test-product-id',
            name: 'Test Product',
            light: { location: 'Test Location' }
          })}
          data-testid="select-product-btn"
        >
          Select Product
        </button>
      </div>
    ) : null
}))

vi.mock('@/components/logistics/assignments/create/CreateServiceAssignmentForm', () => ({
  CreateServiceAssignmentForm: ({ onSubmit, loading, formData, handleInputChange, products, teams, saNumber, jobOrderData, addExpense, removeExpense, updateExpense, calculateTotal, onOpenProductSelection, onIdentifyJO, onChangeJobOrder, onOpenJobOrderDialog, onClearJobOrder }: any) => (
    <div data-testid="create-form">
      <p>SA Number: {saNumber}</p>
      <p>Project Site: {formData.projectSite}</p>
      <p>Service Type: {formData.serviceType}</p>
      <p>Job Order ID: {jobOrderData?.id}</p>
      <p>Booking ID: {jobOrderData?.booking_id}</p>

      <button onClick={onOpenProductSelection} data-testid="open-product-selection">Select Site</button>
      <button onClick={onIdentifyJO} data-testid="identify-jo">Identify JO</button>
      <button onClick={onOpenJobOrderDialog} data-testid="open-jo-dialog">Change Job Order</button>

      <button
        onClick={() => {
          handleInputChange('projectSite', 'test-product-id')
          handleInputChange('serviceType', 'Roll Up')
          handleInputChange('campaignName', 'Test Campaign')
          handleInputChange('crew', 'test-team-id')
          onSubmit()
        }}
        disabled={loading}
        data-testid="submit-form"
      >
        {loading ? 'Generating PDF...' : 'Generate SA'}
      </button>
    </div>
  )
}))

// Mock fetch for PDF generation
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
  } as any)
)

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Import the components after mocking
import CreateServiceAssignmentPage from '@/app/logistics/assignments/create/page'
import ViewPDFPage from '@/app/logistics/assignments/view-pdf/[id]/page'

describe('Service Assignment Booking ID Flow', () => {
  let mockRouter: any
  let mockSearchParams: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup localStorage mocks
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'serviceAssignmentData') {
        return JSON.stringify({
          saNumber: '123456',
          projectSiteId: 'test-product-id',
          projectSiteName: 'Test Product',
          serviceType: 'Roll Up',
          assignedTo: 'test-team-id',
          crew: 'test-team-id',
          campaignName: 'Test Campaign',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          alarmDate: new Date().toISOString(),
          attachments: [],
          serviceExpenses: [],
          jobOrderId: 'test-job-order-id',
          booking_id: 'test-booking-id-123',
          userData: {
            uid: 'test-user-id',
            first_name: 'Test',
            last_name: 'User',
            company_id: 'test-company-id',
            license_key: 'test-license-key'
          }
        })
      }
      if (key === 'serviceAssignmentPDF') {
        return 'mock-pdf-base64-data'
      }
      return null
    })

    // Setup router mock
    mockRouter = {
      push: vi.fn(),
      back: vi.fn()
    }

    // Setup search params mock
    mockSearchParams = {
      get: vi.fn((key: string) => {
        if (key === 'jobOrderId') return 'test-job-order-id'
        if (key === 'booking_id') return 'test-booking-id-123'
        return null
      })
    }

    // Update the navigation mocks
    const { useRouter, useSearchParams } = await import('next/navigation')
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Create Page - Booking ID URL Inclusion', () => {
    it('should include booking_id in URL when navigating to preview page with job order', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateServiceAssignmentPage />
        </BrowserRouter>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('create-form')).toBeInTheDocument()
      })

      // Click submit button
      const submitButton = screen.getByTestId('submit-form')
      await user.click(submitButton)

      // Wait for navigation
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled()
      })

      // Verify the URL includes booking_id
      const pushCall = mockRouter.push.mock.calls[0][0]
      expect(pushCall).toContain('/logistics/assignments/view-pdf/preview')
      expect(pushCall).toContain('jobOrderId=test-job-order-id')
      expect(pushCall).toContain('booking_id=test-booking-id-123')
    })

    it('should handle job order selection and include booking_id in navigation', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateServiceAssignmentPage />
        </BrowserRouter>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('create-form')).toBeInTheDocument()
      })

      // Open job order dialog
      const identifyJOButton = screen.getByTestId('identify-jo')
      await user.click(identifyJOButton)

      // Select job order
      const selectJobOrderButton = screen.getByTestId('select-job-order-btn')
      await user.click(selectJobOrderButton)

      // Submit form
      const submitButton = screen.getByTestId('submit-form')
      await user.click(submitButton)

      // Verify navigation includes booking_id
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled()
      })

      const pushCall = mockRouter.push.mock.calls[0][0]
      expect(pushCall).toContain('booking_id=test-booking-id-123')
    })
  })

  describe('View PDF Page - Booking ID Service Assignment Creation', () => {
    it('should extract booking_id from URL parameters', async () => {
      render(
        <BrowserRouter>
          <ViewPDFPage />
        </BrowserRouter>
      )

      // Verify that search params get method was called for booking_id
      await waitFor(() => {
        expect(mockSearchParams.get).toHaveBeenCalledWith('booking_id')
      })
    })

    it('should include booking_id in service assignment creation', async () => {
      const { addDoc } = await import('firebase/firestore')
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <ViewPDFPage />
        </BrowserRouter>
      )

      // Wait for component to load and PDF to be ready
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('serviceAssignmentData')
      })

      // Find and click the "Send SA" button
      const sendSAButton = screen.getByText('Send SA')
      await user.click(sendSAButton)

      // Wait for the assignment creation
      await waitFor(() => {
        expect(addDoc).toHaveBeenCalled()
      })

      // Verify the service assignment data includes booking_id
      const addDocCall = (addDoc as any).mock.calls[0]
      const assignmentData = addDocCall[1] // Second argument is the data

      expect(assignmentData.booking_id).toBe('test-booking-id-123')
      expect(assignmentData.jobOrderId).toBe('test-job-order-id')
    })

    it('should handle missing booking_id gracefully', async () => {
      // Mock search params to return null for booking_id
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'jobOrderId') return 'test-job-order-id'
        if (key === 'booking_id') return null
        return null
      })

      const { addDoc } = await import('firebase/firestore')
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <ViewPDFPage />
        </BrowserRouter>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('serviceAssignmentData')
      })

      // Click send SA button
      const sendSAButton = screen.getByText('Send SA')
      await user.click(sendSAButton)

      // Wait for assignment creation
      await waitFor(() => {
        expect(addDoc).toHaveBeenCalled()
      })

      // Verify booking_id is null when not provided
      const addDocCall = (addDoc as any).mock.calls[0]
      const assignmentData = addDocCall[1]

      expect(assignmentData.booking_id).toBeNull()
    })

    it('should save booking_id in draft creation', async () => {
      const { addDoc } = await import('firebase/firestore')
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <ViewPDFPage />
        </BrowserRouter>
      )

      // Wait for component to load
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('serviceAssignmentData')
      })

      // Click save as draft button
      const saveDraftButton = screen.getByText('Save as Draft')
      await user.click(saveDraftButton)

      // Wait for draft creation
      await waitFor(() => {
        expect(addDoc).toHaveBeenCalled()
      })

      // Verify the draft data includes booking_id
      const addDocCall = (addDoc as any).mock.calls[0]
      const draftData = addDocCall[1]

      expect(draftData.booking_id).toBe('test-booking-id-123')
      expect(draftData.status).toBe('Draft')
    })
  })

  describe('End-to-End Booking ID Flow', () => {
    it('should maintain booking_id consistency from job order selection to service assignment creation', async () => {
      const { addDoc } = await import('firebase/firestore')
      const user = userEvent.setup()

      // Step 1: Create page - select job order and submit
      const { rerender } = render(
        <BrowserRouter>
          <CreateServiceAssignmentPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('create-form')).toBeInTheDocument()
      })

      // Select job order
      const identifyJOButton = screen.getByTestId('identify-jo')
      await user.click(identifyJOButton)

      const selectJobOrderButton = screen.getByTestId('select-job-order-btn')
      await user.click(selectJobOrderButton)

      // Submit form
      const submitButton = screen.getByTestId('submit-form')
      await user.click(submitButton)

      // Verify navigation includes booking_id
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled()
      })

      const navigationUrl = mockRouter.push.mock.calls[0][0]
      expect(navigationUrl).toContain('booking_id=test-booking-id-123')

      // Step 2: View PDF page - create assignment
      rerender(
        <BrowserRouter>
          <ViewPDFPage />
        </BrowserRouter>
      )

      // Wait for PDF page to load
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('serviceAssignmentData')
      })

      // Create service assignment
      const sendSAButton = screen.getByText('Send SA')
      await user.click(sendSAButton)

      // Verify booking_id is preserved in final assignment
      await waitFor(() => {
        expect(addDoc).toHaveBeenCalled()
      })

      const addDocCall = (addDoc as any).mock.calls[0]
      const finalAssignmentData = addDocCall[1]

      expect(finalAssignmentData.booking_id).toBe('test-booking-id-123')
      expect(finalAssignmentData.jobOrderId).toBe('test-job-order-id')
      expect(finalAssignmentData.status).toBe('Sent')
    })

    it('should handle edge cases with missing or invalid booking_id', async () => {
      const { addDoc } = await import('firebase/firestore')

      // Test with empty booking_id
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'jobOrderId') return 'test-job-order-id'
        if (key === 'booking_id') return ''
        return null
      })

      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <ViewPDFPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('serviceAssignmentData')
      })

      const sendSAButton = screen.getByText('Send SA')
      await user.click(sendSAButton)

      await waitFor(() => {
        expect(addDoc).toHaveBeenCalled()
      })

      const addDocCall = (addDoc as any).mock.calls[0]
      const assignmentData = addDocCall[1]

      expect(assignmentData.booking_id).toBe('')
    })
  })
})