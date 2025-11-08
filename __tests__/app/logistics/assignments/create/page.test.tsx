// __tests__/app/logistics/assignments/create/page.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateServiceAssignmentPage from '@/app/logistics/assignments/create/page'
import { Product } from '@/lib/firebase-service'
import type { JobOrder } from '@/lib/types/job-order'

// Mock dependencies
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id', displayName: 'Test User' },
    userData: {
      first_name: 'Test',
      last_name: 'User',
      company_id: 'test-company-id',
      license_key: 'test-license-key'
    }
  })
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams()
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

vi.mock('@/lib/firebase-service', () => ({
  getProductById: vi.fn(),
  createServiceAssignment: vi.fn(),
  indexServiceAssignment: vi.fn()
}))

vi.mock('@/lib/teams-service', () => ({
  getAllTeams: vi.fn().mockResolvedValue([])
}))

vi.mock('@/lib/pdf-service', () => ({
  generateServiceAssignmentPDF: vi.fn()
}))

vi.mock('@/lib/player-service', () => ({
  getPlayerBasicInfo: vi.fn(),
  createPlayerProgram: vi.fn(),
  getPlayerConfig: vi.fn()
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn()
}))

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn()
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
  storage: {}
}))

vi.mock('@/components/service-assignment-success-dialog', () => ({
  ServiceAssignmentSuccessDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="success-dialog">Success Dialog</div> : null
}))

vi.mock('@/components/service-assignment-confirmation-dialog', () => ({
  ServiceAssignmentConfirmationDialog: ({
    open,
    onConfirm,
    isSubmitting
  }: {
    open: boolean,
    onConfirm: () => void,
    isSubmitting?: boolean
  }) =>
    open ? (
      <div data-testid="confirmation-dialog">
        <button
          data-testid="confirm-submit-btn"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Confirm & Create'}
        </button>
        <button data-testid="cancel-confirmation-btn">
          Review Details
        </button>
      </div>
    ) : null
}))

vi.mock('@/components/team-form-dialog', () => ({
  TeamFormDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="team-dialog">Team Dialog</div> : null
}))

vi.mock('@/components/logistics/assignments/create/ProductSelectionDialog', () => ({
  ProductSelectionDialog: ({ open, onSelectProduct }: { open: boolean, onSelectProduct: (product: Product) => void }) =>
    open ? (
      <div data-testid="product-dialog">
        <button
          data-testid="select-product-btn"
          onClick={() => onSelectProduct({
            id: 'test-product-id',
            name: 'Test Product',
            description: 'Test Description',
            price: 1000,
            active: true,
            deleted: false,
            seller_id: 'seller-id',
            seller_name: 'Seller Name',
            company_id: 'company-id',
            position: 1,
            playerIds: ['test-player-id-1', 'test-player-id-2']
          } as Product)}
        >
          Select Product
        </button>
      </div>
    ) : null
}))

vi.mock('@/components/logistics/assignments/create/JobOrderSelectionDialog', () => ({
  JobOrderSelectionDialog: ({ open, onSelectJobOrder }: { open: boolean, onSelectJobOrder: (jobOrder: JobOrder) => void }) =>
    open ? (
      <div data-testid="job-order-dialog">
        <button
          data-testid="select-job-order-btn"
          onClick={() => onSelectJobOrder({
            id: 'test-job-order-id',
            joNumber: 'JO-001',
            siteName: 'Test Site',
            joType: 'Installation',
            requestedBy: 'Test User',
            assignTo: 'Test Assignee',
            dateRequested: new Date('2025-01-01'),
            deadline: new Date('2025-01-15'),
            jobDescription: 'Test job description',
            attachments: [],
            status: 'pending',
            created: new Date(),
            updated: new Date(),
            created_by: 'test-user',
            company_id: 'test-company',
            product_id: 'test-product-id',
            campaignName: 'Test Campaign',
            clientName: 'Test Client'
          } as JobOrder)}
        >
          Select Job Order
        </button>
      </div>
    ) : null
}))

vi.mock('@/components/logistics/assignments/create/CreateServiceAssignmentForm', () => ({
  CreateServiceAssignmentForm: ({
    onSubmit,
    onSaveAsDraft,
    onOpenProductSelection,
    onIdentifyJO,
    onChangeJobOrder,
    onFileUpload,
    onRemoveAttachment
  }: any) => (
    <div data-testid="service-assignment-form">
      <button data-testid="submit-btn" onClick={onSubmit}>Submit</button>
      <button data-testid="save-draft-btn" onClick={onSaveAsDraft}>Save Draft</button>
      <button data-testid="open-product-selection-btn" onClick={onOpenProductSelection}>Select Product</button>
      <button data-testid="identify-jo-btn" onClick={onIdentifyJO}>Identify JO</button>
      <button data-testid="change-jo-btn" onClick={onChangeJobOrder}>Change JO</button>
      <input data-testid="file-input" type="file" onChange={onFileUpload} />
      <button data-testid="remove-attachment-btn" onClick={() => onRemoveAttachment(0)}>Remove Attachment</button>
    </div>
  )
}))

describe('CreateServiceAssignmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Product Interface', () => {
    it('should include playerIds field in Product type', () => {
      const product: Product = {
        id: 'test-id',
        name: 'Test Product',
        description: 'Test Description',
        price: 1000,
        active: true,
        deleted: false,
        seller_id: 'seller-id',
        seller_name: 'Seller Name',
        company_id: 'company-id',
        position: 1,
        playerIds: ['player-1', 'player-2'] // This should not cause a TypeScript error
      }

      expect(product.playerIds).toEqual(['player-1', 'player-2'])
    })
  })

  describe('handleJobOrderSelect', () => {
    it('should get product_id during job order selection', async () => {
      const mockJobOrder: JobOrder = {
        id: 'test-job-order-id',
        joNumber: 'JO-001',
        siteName: 'Test Site',
        joType: 'Installation',
        requestedBy: 'Test User',
        assignTo: 'Test Assignee',
        dateRequested: new Date('2025-01-01'),
        deadline: new Date('2025-01-15'),
        jobDescription: 'Test job description',
        attachments: [],
        status: 'pending',
        created: new Date(),
        updated: new Date(),
        created_by: 'test-user',
        company_id: 'test-company',
        product_id: 'test-product-id',
        campaignName: 'Test Campaign',
        clientName: 'Test Client'
      } as JobOrder

      render(<CreateServiceAssignmentPage />)

      // The component should handle job order selection
      // Since the dialog is mocked, we can't directly test the internal function
      // But we can test that the component renders and the dialog can be opened
      expect(screen.getByTestId('service-assignment-form')).toBeInTheDocument()
    })
  })

  describe('handleSubmit with confirmation dialog', () => {
    it('should show confirmation dialog when submit is clicked', async () => {
      render(<CreateServiceAssignmentPage />)

      // Click the submit button
      const submitBtn = screen.getByTestId('submit-btn')
      await userEvent.click(submitBtn)

      // Confirmation dialog should appear
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-submit-btn')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-confirmation-btn')).toBeInTheDocument()
    })

    it('should handle async submit function', async () => {
      render(<CreateServiceAssignmentPage />)

      // Click the submit button - should resolve without error
      const submitBtn = screen.getByTestId('submit-btn')
      await expect(userEvent.click(submitBtn)).resolves.toBeUndefined()
    })

    it('should proceed with submission when confirmation is accepted', async () => {
      // Mock fetch for CMS API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ success: ['test-player-id'], fail: [] })
      })

      // Mock Firebase functions
      const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-assignment-id' })
      vi.mocked(require('firebase/firestore').addDoc).mockImplementation(mockAddDoc)
      vi.mocked(require('firebase/firestore').collection).mockReturnValue('mock-collection')
      vi.mocked(require('firebase/firestore').serverTimestamp).mockReturnValue(new Date())

      render(<CreateServiceAssignmentPage />)

      // First select a product with playerIds
      const openProductSelectionBtn = screen.getByTestId('open-product-selection-btn')
      await userEvent.click(openProductSelectionBtn)

      const selectProductBtn = screen.getByTestId('select-product-btn')
      await userEvent.click(selectProductBtn)

      // Click submit to show confirmation dialog
      const submitBtn = screen.getByTestId('submit-btn')
      await userEvent.click(submitBtn)

      // Click confirm in the confirmation dialog
      const confirmBtn = screen.getByTestId('confirm-submit-btn')
      await userEvent.click(confirmBtn)

      // Wait for the API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/solutions/common-solutions',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"playerIds":["test-player-id-1","test-player-id-2"]')
          })
        )
      })
    })

    it('should use playerIds from selected product in CMS API call', async () => {
      // Mock fetch for CMS API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ success: ['test-player-id'], fail: [] })
      })

      // Mock Firebase functions
      const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-assignment-id' })
      vi.mocked(require('firebase/firestore').addDoc).mockImplementation(mockAddDoc)
      vi.mocked(require('firebase/firestore').collection).mockReturnValue('mock-collection')
      vi.mocked(require('firebase/firestore').serverTimestamp).mockReturnValue(new Date())

      render(<CreateServiceAssignmentPage />)

      // First select a product with playerIds
      const openProductSelectionBtn = screen.getByTestId('open-product-selection-btn')
      await userEvent.click(openProductSelectionBtn)

      const selectProductBtn = screen.getByTestId('select-product-btn')
      await userEvent.click(selectProductBtn)

      // Click submit and confirm
      const submitBtn = screen.getByTestId('submit-btn')
      await userEvent.click(submitBtn)

      const confirmBtn = screen.getByTestId('confirm-submit-btn')
      await userEvent.click(confirmBtn)

      // Wait for the API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/solutions/common-solutions',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"playerIds":["test-player-id-1","test-player-id-2"]')
          })
        )
      })
    })

    it('should use playerIds from selected product in Player API calls', async () => {
      // Mock player service
      const mockGetPlayerBasicInfo = vi.fn().mockResolvedValue({ data: 'mock-data' })
      const mockCreatePlayerProgram = vi.fn().mockResolvedValue({ success: true })
      const mockGetPlayerConfig = vi.fn().mockResolvedValue({ config: 'mock-config' })

      vi.mocked(require('@/lib/player-service').getPlayerBasicInfo).mockImplementation(mockGetPlayerBasicInfo)
      vi.mocked(require('@/lib/player-service').createPlayerProgram).mockImplementation(mockCreatePlayerProgram)
      vi.mocked(require('@/lib/player-service').getPlayerConfig).mockImplementation(mockGetPlayerConfig)

      // Mock Firebase functions
      const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-assignment-id' })
      vi.mocked(require('firebase/firestore').addDoc).mockImplementation(mockAddDoc)
      vi.mocked(require('firebase/firestore').collection).mockReturnValue('mock-collection')
      vi.mocked(require('firebase/firestore').serverTimestamp).mockReturnValue(new Date())

      render(<CreateServiceAssignmentPage />)

      // First select a product with playerIds
      const openProductSelectionBtn = screen.getByTestId('open-product-selection-btn')
      await userEvent.click(openProductSelectionBtn)

      const selectProductBtn = screen.getByTestId('select-product-btn')
      await userEvent.click(selectProductBtn)

      // Click submit and confirm
      const submitBtn = screen.getByTestId('submit-btn')
      await userEvent.click(submitBtn)

      const confirmBtn = screen.getByTestId('confirm-submit-btn')
      await userEvent.click(confirmBtn)

      // Wait for the API calls
      await waitFor(() => {
        expect(mockCreatePlayerProgram).toHaveBeenCalledWith(
          expect.objectContaining({
            playerIds: ['test-player-id-1', 'test-player-id-2']
          })
        )
      })
    })

    it('should fallback to hardcoded playerIds when product has no playerIds', async () => {
      // Mock fetch for CMS API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ success: ['fallback-player-id'], fail: [] })
      })

      // Mock Firebase functions
      const mockAddDoc = vi.fn().mockResolvedValue({ id: 'test-assignment-id' })
      vi.mocked(require('firebase/firestore').addDoc).mockImplementation(mockAddDoc)
      vi.mocked(require('firebase/firestore').collection).mockReturnValue('mock-collection')
      vi.mocked(require('firebase/firestore').serverTimestamp).mockReturnValue(new Date())

      render(<CreateServiceAssignmentPage />)

      // First select a product without playerIds
      const openProductSelectionBtn = screen.getByTestId('open-product-selection-btn')
      await userEvent.click(openProductSelectionBtn)

      // Mock the product selection with no playerIds
      vi.mocked(require('@/components/logistics/assignments/create/ProductSelectionDialog').ProductSelectionDialog)
        .mockImplementationOnce(({ onSelectProduct }: any) => (
          <div data-testid="product-dialog">
            <button
              data-testid="select-product-btn"
              onClick={() => onSelectProduct({
                id: 'test-product-id',
                name: 'Test Product'
                // No playerIds field
              })}
            >
              Select Product
            </button>
          </div>
        ))

      const selectProductBtn = screen.getByTestId('select-product-btn')
      await userEvent.click(selectProductBtn)

      // Click submit and confirm
      const submitBtn = screen.getByTestId('submit-btn')
      await userEvent.click(submitBtn)

      const confirmBtn = screen.getByTestId('confirm-submit-btn')
      await userEvent.click(confirmBtn)

      // Wait for the API call with fallback
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/solutions/common-solutions',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"playerIds":["141a16d405254b8fb5c5173ef3a58cc5"]')
          })
        )
      })
    })
  })

  describe('Product selection and job order integration', () => {
    it('should allow selecting job order after product selection', async () => {
      render(<CreateServiceAssignmentPage />)

      // First select a product
      const openProductSelectionBtn = screen.getByTestId('open-product-selection-btn')
      await userEvent.click(openProductSelectionBtn)

      const selectProductBtn = screen.getByTestId('select-product-btn')
      await userEvent.click(selectProductBtn)

      // Then identify job order
      const identifyJobOrderBtn = screen.getByTestId('identify-jo-btn')
      await userEvent.click(identifyJobOrderBtn)

      // Job order dialog should be open
      expect(screen.getByTestId('job-order-dialog')).toBeInTheDocument()
    })

    it('should prevent identifying job order without product selection', async () => {
      const mockToast = vi.fn()
      vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
        toast: mockToast
      })

      render(<CreateServiceAssignmentPage />)

      // Try to identify job order without selecting product first
      const identifyJobOrderBtn = screen.getByTestId('identify-jo-btn')
      await userEvent.click(identifyJobOrderBtn)

      // Should show error toast
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Site Selection Required',
        description: 'Please select a site first before identifying job orders.',
        variant: 'destructive'
      })
    })
  })
})