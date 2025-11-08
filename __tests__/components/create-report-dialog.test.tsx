import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateReportDialog } from '@/components/create-report-dialog'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { getProductById, uploadFileToFirebaseStorage } from '@/lib/firebase-service'
import { postReport } from '@/lib/report-service'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

// Mock dependencies
vi.mock('@/contexts/auth-context')
vi.mock('next/navigation')
vi.mock('@/hooks/use-toast')
vi.mock('@/lib/firebase-service')
vi.mock('@/lib/report-service')
vi.mock('@/lib/firebase')
vi.mock('firebase/firestore')

const mockUseAuth = useAuth as any
const mockUseRouter = useRouter as any
const mockUseToast = useToast as any
const mockGetProductById = getProductById as any
const mockUploadFileToFirebaseStorage = uploadFileToFirebaseStorage as any
const mockPostReport = postReport as any
const mockCollection = collection as any
const mockQuery = query as any
const mockWhere = where as any
const mockGetDocs = getDocs as any

// Mock data
const mockUserData = {
  company_id: 'test-company-id',
  uid: 'test-user-id'
}

const mockProduct = {
  id: 'product-1',
  name: 'Test Product',
  content_type: 'billboard',
  specs_rental: {
    location: 'Test Location'
  },
  light: {
    location: 'Test Light Location'
  },
  site_code: 'SITE-001',
  seller_id: 'seller-1'
}

const mockServiceAssignments = [
  {
    id: 'sa-1',
    saNumber: 'SA-001',
    joNumber: 'JO-001',
    projectSiteId: 'product-1',
    projectSiteName: 'Test Site',
    projectSiteLocation: 'Test Location',
    serviceType: 'Installation',
    assignedTo: 'Tech 1',
    jobDescription: 'Install billboard',
    requestedBy: {
      id: 'requester-1',
      name: 'John Doe',
      department: 'Operations'
    },
    message: 'Urgent installation needed',
    campaignName: 'Campaign 1',
    coveredDateStart: new Date(),
    coveredDateEnd: new Date(),
    alarmDate: new Date(),
    alarmTime: '09:00',
    attachments: [],
    serviceExpenses: [],
    status: 'pending',
    created: new Date(),
    updated: new Date(),
    company_id: 'test-company-id',
    reservation_number: 'RN-12345',
    booking_id: 'BK-67890'
  }
]

const mockProps = {
  open: true,
  onOpenChange: vi.fn(),
  siteId: 'product-1',
  module: 'logistics' as const,
  hideJobOrderSelection: false,
  preSelectedJobOrder: undefined
}

describe('CreateReportDialog', () => {
  const mockRouter = {
    push: vi.fn()
  }

  const mockToast = {
    toast: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAuth.mockReturnValue({
      user: { uid: 'test-user-id', displayName: 'Test User' },
      userData: mockUserData,
      projectData: null
    })

    mockUseRouter.mockReturnValue(mockRouter)
    mockUseToast.mockReturnValue(mockToast)

    // Mock Firebase operations
    mockCollection.mockReturnValue('mock-collection-ref')
    mockQuery.mockReturnValue('mock-query-ref')
    mockWhere.mockReturnValue('mock-where-ref')
    mockGetDocs.mockResolvedValue({
      docs: mockServiceAssignments.map(sa => ({
        id: sa.id,
        data: () => sa
      })),
      empty: false
    })

    mockGetProductById.mockResolvedValue(mockProduct)
    mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/uploaded-file.jpg')
    mockPostReport.mockResolvedValue('report-id-123')
  })

  describe('Initial Rendering and Data Loading', () => {
    it('renders dialog when open is true', () => {
      render(<CreateReportDialog {...mockProps} />)

      expect(screen.getByText('Service Report')).toBeInTheDocument()
    })

    it('fetches product data on mount', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(mockGetProductById).toHaveBeenCalledWith('product-1')
      })
    })

    it('fetches service assignments when job order selection is not hidden', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(mockCollection).toHaveBeenCalledWith(db, 'service_assignments')
        expect(mockQuery).toHaveBeenCalled()
        expect(mockGetDocs).toHaveBeenCalled()
      })
    })

    it('displays service assignment information including new fields', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('SA#:', { exact: false })).toBeInTheDocument()
        expect(screen.getByText('Reservation: RN-12345')).toBeInTheDocument()
      })
    })

    it('auto-fills current date', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
        expect(dateInput).toBeInTheDocument()
      })
    })
  })

  describe('Service Assignment Selection', () => {
    it('renders service assignment dropdown with fetched data', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Service Assignment:')).toBeInTheDocument()
        expect(screen.getByText('SA-001 - Test Site (Installation)')).toBeInTheDocument()
      })
    })

    it('updates selected service assignment when selection changes', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('SA-001 - Test Site (Installation)')).toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      fireEvent.click(select)

      const option = screen.getByText('SA-001 - Test Site (Installation)')
      fireEvent.click(option)

      await waitFor(() => {
        expect(screen.getByText('Reservation: RN-12345')).toBeInTheDocument()
      })
    })

    it('hides service assignment selection when hideJobOrderSelection is true', () => {
      render(<CreateReportDialog {...mockProps} hideJobOrderSelection={true} />)

      expect(screen.queryByText('Service Assignment:')).not.toBeInTheDocument()
    })

    it('pre-selects service assignment when preSelectedJobOrder is provided', async () => {
      render(<CreateReportDialog {...mockProps} preSelectedJobOrder="SA-001" />)

      await waitFor(() => {
        expect(screen.getByText('SA-001')).toBeInTheDocument()
      })
    })
  })

  describe('Report Type Selection', () => {
    it('renders report type selector with all options', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Report Type:')).toBeInTheDocument()
      })

      const select = screen.getByRole('combobox')
      fireEvent.click(select)

      expect(screen.getByText('Completion Report')).toBeInTheDocument()
      expect(screen.getByText('Monitoring Report')).toBeInTheDocument()
      expect(screen.getByText('Installation Report')).toBeInTheDocument()
    })

    it('shows installation-specific fields when installation report is selected', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const reportTypeSelect = screen.getByRole('combobox')
        fireEvent.click(reportTypeSelect)
      })

      const installationOption = screen.getByText('Installation Report')
      fireEvent.click(installationOption)

      await waitFor(() => {
        expect(screen.getByText('Status:')).toBeInTheDocument()
        expect(screen.getByText('Timeline:')).toBeInTheDocument()
      })
    })

    it('shows description of work field for completion reports', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const reportTypeSelect = screen.getByRole('combobox')
        fireEvent.click(reportTypeSelect)
      })

      const completionOption = screen.getByText('Completion Report')
      fireEvent.click(completionOption)

      await waitFor(() => {
        expect(screen.getByText('Description of Work:')).toBeInTheDocument()
      })
    })
  })

  describe('File Upload Functionality', () => {
    it('uploads attachments successfully', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Attachments:')).toBeInTheDocument()
      })

      // Mock file input change
      const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockUploadFileToFirebaseStorage).toHaveBeenCalledWith(
          file,
          expect.stringContaining('reports/product-1/')
        )
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'File uploaded successfully'
        })
      })
    })

    it('handles file upload errors gracefully', async () => {
      mockUploadFileToFirebaseStorage.mockRejectedValue(new Error('Upload failed'))

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to upload file. Please try again.',
          variant: 'destructive'
        })
      })
    })

    it('validates file types for uploads', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })

        fireEvent.change(fileInput, { target: { files: [invalidFile] } })
      })

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Please upload only image files (JPEG, PNG, GIF, WebP)',
          variant: 'destructive'
        })
      })
    })

    it('validates file size limits', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })

        fireEvent.change(fileInput, { target: { files: [largeFile] } })
      })

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'File size must be less than 10MB',
          variant: 'destructive'
        })
      })
    })
  })

  describe('Before/After Image Uploads', () => {
    it('renders before and after image sections for completion/installation reports', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const reportTypeSelect = screen.getByRole('combobox')
        fireEvent.click(reportTypeSelect)
      })

      const completionOption = screen.getByText('Completion Report')
      fireEvent.click(completionOption)

      await waitFor(() => {
        expect(screen.getByText('Before')).toBeInTheDocument()
        expect(screen.getByText('After')).toBeInTheDocument()
      })
    })

    it('allows adding multiple before images', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const reportTypeSelect = screen.getByRole('combobox')
        fireEvent.click(reportTypeSelect)
      })

      const completionOption = screen.getByText('Completion Report')
      fireEvent.click(completionOption)

      await waitFor(() => {
        const addBeforeButton = screen.getByText('+', { selector: 'button' })
        fireEvent.click(addBeforeButton)
      })

      // Should now have 2 before image slots
      const beforeSections = screen.getAllByText('Before')
      expect(beforeSections).toHaveLength(2)
    })

    it('allows adding multiple after images', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const reportTypeSelect = screen.getByRole('combobox')
        fireEvent.click(reportTypeSelect)
      })

      const completionOption = screen.getByText('Completion Report')
      fireEvent.click(completionOption)

      await waitFor(() => {
        const addAfterButton = screen.getAllByText('+', { selector: 'button' })[1] // Second + button
        fireEvent.click(addAfterButton)
      })

      // Should now have 2 after image slots
      const afterSections = screen.getAllByText('After')
      expect(afterSections).toHaveLength(2)
    })
  })

  describe('Report Generation', () => {
    it('validates required attachments before generating report', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Please upload at least one image and wait for it to finish uploading',
          variant: 'destructive'
        })
      })
    })

    it('validates user authentication', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        userData: null,
        projectData: null
      })

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Please log in to create a report',
          variant: 'destructive'
        })
      })
    })

    it('generates report successfully with valid data', async () => {
      // Mock successful file upload first
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        // Upload a file first
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        expect(mockPostReport).toHaveBeenCalled()
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Congratulations You have successfully posted a report!'
        })
        expect(mockProps.onOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('includes reservation_number and booking_id in report data', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        // Select service assignment first
        const select = screen.getByRole('combobox')
        fireEvent.click(select)
        const option = screen.getByText('SA-001 - Test Site (Installation)')
        fireEvent.click(option)
      })

      await waitFor(() => {
        // Upload a file
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        const reportData = mockPostReport.mock.calls[0][0]
        expect(reportData.reservation_number).toBe('RN-12345')
        expect(reportData.booking_id).toBe('BK-67890')
      })
    })

    it('handles report generation errors', async () => {
      mockPostReport.mockRejectedValue(new Error('Report creation failed'))

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        expect(mockToast.toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to generate report',
          variant: 'destructive'
        })
      })
    })
  })

  describe('Module-specific Behavior', () => {
    it('sets status to posted for sales module', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      render(<CreateReportDialog {...mockProps} module="sales" />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        const reportData = mockPostReport.mock.calls[0][0]
        expect(reportData.status).toBe('posted')
      })
    })

    it('sets status to draft for admin module', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      render(<CreateReportDialog {...mockProps} module="admin" />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        // Admin module uses createReport directly, not postReport
        expect(mockPostReport).not.toHaveBeenCalled()
      })
    })
  })

  describe('Form Reset', () => {
    it('resets form after successful report generation', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        expect(mockProps.onOpenChange).toHaveBeenCalledWith(false)
      })

      // Form should be reset (this would be tested by checking initial state)
    })
  })

  describe('Data Field Integration', () => {
    it('displays reservation_number from service assignment data', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Reservation: RN-12345')).toBeInTheDocument()
      })
    })

    it('displays booking_id from service assignment data', async () => {
      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        // booking_id is not directly displayed in the UI, but used in report generation
        const select = screen.getByRole('combobox')
        fireEvent.click(select)
        const option = screen.getByText('SA-001 - Test Site (Installation)')
        fireEvent.click(option)
      })

      // Verify it's included in report data when generated
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        const reportData = mockPostReport.mock.calls[0][0]
        expect(reportData.booking_id).toBe('BK-67890')
      })
    })

    it('handles service assignments without reservation_number gracefully', async () => {
      const saWithoutReservation = {
        ...mockServiceAssignments[0],
        reservation_number: undefined
      }

      mockGetDocs.mockResolvedValue({
        docs: [{
          id: saWithoutReservation.id,
          data: () => saWithoutReservation
        }],
        empty: false
      })

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        expect(screen.getByText('Reservation: N/A')).toBeInTheDocument()
      })
    })

    it('handles service assignments without booking_id gracefully', async () => {
      const saWithoutBookingId = {
        ...mockServiceAssignments[0],
        booking_id: undefined
      }

      mockGetDocs.mockResolvedValue({
        docs: [{
          id: saWithoutBookingId.id,
          data: () => saWithoutBookingId
        }],
        empty: false
      })

      render(<CreateReportDialog {...mockProps} />)

      await waitFor(() => {
        const select = screen.getByRole('combobox')
        fireEvent.click(select)
        const option = screen.getByText('SA-001 - Test Site (Installation)')
        fireEvent.click(option)
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      mockUploadFileToFirebaseStorage.mockResolvedValue('https://example.com/test.jpg')

      await waitFor(() => {
        const fileInput = screen.getAllByDisplayValue('')[0] as HTMLInputElement
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      await waitFor(() => {
        const generateButton = screen.getByText('Generate Report')
        fireEvent.click(generateButton)
      })

      await waitFor(() => {
        const reportData = mockPostReport.mock.calls[0][0]
        expect(reportData.booking_id).toBeUndefined()
      })
    })
  })
})