import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SiteDetailsPage from '@/app/logistics/sites/[id]/page'
import * as firebaseService from '@/lib/firebase-service'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { useRouter } from 'next/navigation'

// Mock dependencies
vi.mock('@/lib/firebase-service', () => ({
  getProductById: vi.fn(),
  getServiceAssignmentsByProductId: vi.fn(),
  updateProduct: vi.fn(),
  uploadFileToFirebaseStorage: vi.fn(),
}))

vi.mock('@/lib/google-maps-loader', () => ({
  loadGoogleMaps: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('react-pdf', () => ({
  Document: ({ children }: any) => <div data-testid="pdf-document">{children}</div>,
  Page: () => <div data-testid="pdf-page" />,
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
  },
}))

vi.mock('@/components/logistics/assignments/SiteServiceAssignmentsTable', () => ({
  SiteServiceAssignmentsTable: () => <div data-testid="site-service-assignments-table" />,
}))

vi.mock('@/components/logistics/reports/SiteReportsTable', () => ({
  SiteReportsTable: () => <div data-testid="site-reports-table" />,
}))

vi.mock('@/components/service-assignment-details-dialog', () => ({
  ServiceAssignmentDetailsDialog: () => <div data-testid="service-assignment-details-dialog" />,
}))

vi.mock('@/components/create-report-dialog', () => ({
  CreateReportDialog: () => <div data-testid="create-report-dialog" />,
}))

vi.mock('lucide-react', () => ({
  CalendarIcon: () => React.createElement('div', { 'data-testid': 'calendar-icon' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader-icon' }),
  ArrowLeft: () => React.createElement('div', { 'data-testid': 'arrow-left-icon' }),
  MapPin: () => React.createElement('div', { 'data-testid': 'map-pin-icon' }),
  AlertTriangle: () => React.createElement('div', { 'data-testid': 'alert-triangle-icon' }),
  Shield: () => React.createElement('div', { 'data-testid': 'shield-icon' }),
  Zap: () => React.createElement('div', { 'data-testid': 'zap-icon' }),
  Users: () => React.createElement('div', { 'data-testid': 'users-icon' }),
  Settings: () => React.createElement('div', { 'data-testid': 'settings-icon' }),
  Eye: () => React.createElement('div', { 'data-testid': 'eye-icon' }),
  History: () => React.createElement('div', { 'data-testid': 'history-icon' }),
  FileCheck: () => React.createElement('div', { 'data-testid': 'file-check-icon' }),
  MoreVertical: () => React.createElement('div', { 'data-testid': 'more-vertical-icon' }),
  Edit: () => React.createElement('div', { 'data-testid': 'edit-icon' }),
  Sun: () => React.createElement('div', { 'data-testid': 'sun-icon' }),
  Play: () => React.createElement('div', { 'data-testid': 'play-icon' }),
  ChevronDown: () => React.createElement('div', { 'data-testid': 'chevron-down-icon' }),
}))

vi.mock('@/components/alarm-setting-dialog', () => ({
  AlarmSettingDialog: () => <div data-testid="alarm-setting-dialog" />,
}))

vi.mock('@/components/illumination-index-card-dialog', () => ({
  IlluminationIndexCardDialog: () => <div data-testid="illumination-index-card-dialog" />,
}))

vi.mock('@/components/display-index-card-dialog', () => ({
  DisplayIndexCardDialog: () => <div data-testid="display-index-card-dialog" />,
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    forEach: vi.fn(),
  }),
  getFirestore: vi.fn(),
  db: {},
  serverTimestamp: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
  notFound: vi.fn(),
}))

describe('SiteDetailsPage', () => {
  const mockProduct = {
    id: 'test-site-id',
    name: 'Test Site',
    description: 'Test site description',
    price: 1000,
    active: true,
    deleted: false,
    company_id: 'test-company-id',
    categories: ['billboard'],
    content_type: 'static',
    specs_rental: {
      width: 10,
      height: 5,
      location: 'Test Location',
      geopoint: [14.5995, 120.9842],
      illumination_upper_lighting_specs: 'LED',
      illumination_bottom_lighting_specs: 'LED',
      illumination_left_lighting_specs: 'LED',
      illumination_right_lighting_specs: 'LED',
      power_consumption_monthly: 100,
    },
    media: [{ url: '/test-image.jpg' }],
    compliance: {
      lease_agreement: true,
      mayors_permit: false,
      bir_registration: true,
      structural_approval: false,
    },
    structure: {
      color: 'White',
      contractor: 'Test Contractor',
      last_maintenance: new Date(),
    },
    illumination: {
      on: true,
    },
    personnel: [
      {
        name: 'John Doe',
        position: 'Manager',
        contact: '123-456-7890',
      },
    ],
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(firebaseService.getProductById).mockResolvedValue(mockProduct)
    vi.mocked(firebaseService.getServiceAssignmentsByProductId).mockResolvedValue([])
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
    } as any)
  })

  it('renders without errors', async () => {
    const params = { id: 'test-site-id' }

    render(<SiteDetailsPage params={params} />)

    // Wait for the component to load
    await screen.findByText('Site Information')

    // Check that the main heading is rendered
    expect(screen.getByText('Site Information')).toBeInTheDocument()

    // Check that site name is rendered
    expect(screen.getByText('Test Site')).toBeInTheDocument()

    // Check that location is rendered
    expect(screen.getByText('Test Location')).toBeInTheDocument()
  })

  it('displays loading state initially', () => {
    const params = { id: 'test-site-id' }

    // Mock getProductById to never resolve to keep loading state
    vi.mocked(firebaseService.getProductById).mockImplementation(() => new Promise(() => {}))

    render(<SiteDetailsPage params={params} />)

    // Check for loading skeleton elements (animate-pulse class)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('displays error state when product fetch fails', async () => {
    const params = { id: 'test-site-id' }
    const errorMessage = 'Failed to fetch product'

    vi.mocked(firebaseService.getProductById).mockRejectedValue(new Error(errorMessage))

    render(<SiteDetailsPage params={params} />)

    // Wait for error to be displayed
    await screen.findByText('Error Loading Site')

    expect(screen.getByText('Error Loading Site')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('renders static billboard image when content type is static', async () => {
    const staticProduct = { ...mockProduct, content_type: 'static', media: [] }
    vi.mocked(firebaseService.getProductById).mockResolvedValue(staticProduct)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    // Check that the static billboard image is used as fallback
    const image = screen.getByAltText('Test Site') as HTMLImageElement
    expect(image.src).toContain('/roadside-billboard.png')
  })

  it('renders LED billboard image when content type is dynamic', async () => {
    const dynamicProduct = { ...mockProduct, content_type: 'dynamic', media: [] }
    vi.mocked(firebaseService.getProductById).mockResolvedValue(dynamicProduct)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    const image = screen.getByAltText('Test Site') as HTMLImageElement
    expect(image.src).toContain('/led-billboard-1.png')
  })

  it('displays job orders when available', async () => {
    const jobOrder = {
      id: 'jo-1',
      joNumber: 'JO001',
      requestedBy: 'SALES-001',
      created: new Date(),
      product_id: 'test-site-id'
    }
    vi.mocked(firebaseService.getServiceAssignmentsByProductId).mockResolvedValue([])

    // Mock the job orders query
    const mockQuery = vi.fn()
    const mockWhere = vi.fn()
    const mockOrderBy = vi.fn()
    const mockGetDocs = vi.fn().mockResolvedValue({
      forEach: vi.fn((callback) => callback({ id: 'jo-1', data: () => jobOrder }))
    })

    vi.mocked(collection).mockReturnValue('mock-collection' as any)
    vi.mocked(query).mockReturnValue('mock-query' as any)
    vi.mocked(where).mockReturnValue('mock-where' as any)
    vi.mocked(orderBy).mockReturnValue('mock-orderby' as any)
    vi.mocked(getDocs).mockResolvedValue({
      forEach: (callback: any) => callback({ id: 'jo-1', data: () => jobOrder })
    } as any)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Job Orders (1)')).toBeInTheDocument()
    expect(screen.getByText('JO#JO001')).toBeInTheDocument()
  })

  it('displays no job orders message when empty', async () => {
    vi.mocked(collection).mockReturnValue('mock-collection' as any)
    vi.mocked(query).mockReturnValue('mock-query' as any)
    vi.mocked(where).mockReturnValue('mock-where' as any)
    vi.mocked(orderBy).mockReturnValue('mock-orderby' as any)
    vi.mocked(getDocs).mockResolvedValue({
      forEach: vi.fn()
    } as any)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Job Orders 0')).toBeInTheDocument()
    expect(screen.getByText('No job orders found for this site.')).toBeInTheDocument()
  })

  it('switches between tabs correctly', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    // Check default tab (Gen. Info)
    expect(screen.getByText('General Information')).toBeInTheDocument()

    // Click on Service Assignments tab
    const serviceTabs = screen.getAllByText('Service Assignments')
    const serviceTab = serviceTabs.find(tab => tab.tagName === 'BUTTON')
    if (serviceTab) {
      await userEvent.click(serviceTab)
    }

    // Check that the Service Assignments table component is rendered
    expect(screen.getByTestId('site-service-assignments-table')).toBeInTheDocument()

    // Click on Reports tab
    const reportsTab = screen.getByText('Reports')
    await userEvent.click(reportsTab)

    // Check that the Reports table component is rendered
    expect(screen.getByTestId('site-reports-table')).toBeInTheDocument()
  })

  it('opens create service assignment dialog when button is clicked', async () => {
    const mockRouter = { push: vi.fn(), back: vi.fn() }
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    const createButton = screen.getByText('Service Assignment')
    await userEvent.click(createButton)

    // Check that router.push was called with correct path
    expect(mockRouter.push).toHaveBeenCalledWith('/logistics/assignments/create?projectSite=test-site-id')
  })

  it('opens create report dialog when button is clicked', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    const createButton = screen.getByText('Report')
    await userEvent.click(createButton)

    // The component sets createReportDialogOpen to true
    // We can check that the dialog state would be true by checking the component behavior
    expect(screen.getByText('Report..')).toBeInTheDocument()
  })

  it('displays compliance checkboxes correctly', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Lease Agreement')).toBeInTheDocument()
    expect(screen.getByText('Mayor\'s Permit')).toBeInTheDocument()
    expect(screen.getByText('BIR Registration')).toBeInTheDocument()
    expect(screen.getByText('Structural Approval')).toBeInTheDocument()
  })

  it('displays personnel table when personnel data exists', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Position')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
    expect(screen.getByText('123-456-7890')).toBeInTheDocument()
  })

  it('displays no personnel message when personnel array is empty', async () => {
    const productWithoutPersonnel = { ...mockProduct, personnel: [] }
    vi.mocked(firebaseService.getProductById).mockResolvedValue(productWithoutPersonnel)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('No personnel information available')).toBeInTheDocument()
  })

  it('displays structure information correctly', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Color:')).toBeInTheDocument()
    expect(screen.getByText('White')).toBeInTheDocument()
    expect(screen.getByText('Contractor:')).toBeInTheDocument()
    expect(screen.getByText('Test Contractor')).toBeInTheDocument()
  })

  it('displays illumination specs correctly', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Upper:')).toBeInTheDocument()
    expect(screen.getByText('Bottom:')).toBeInTheDocument()
    expect(screen.getByText('Side (Left):')).toBeInTheDocument()
    expect(screen.getByText('Side (Right):')).toBeInTheDocument()

    // Check that LED values are displayed (there are multiple LED texts, so check they exist)
    const ledElements = screen.getAllByText('LED')
    expect(ledElements.length).toBeGreaterThan(0)
  })

  it('displays power consumption information', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Average Monthly Electrical Consumption:')).toBeInTheDocument()
    expect(screen.getByText('100 kWh/month')).toBeInTheDocument()
  })

  it('opens coming soon dialog when trying to turn off illumination', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    // Find the illumination switch and click it to turn off
    const switchElement = screen.getByRole('switch')
    await userEvent.click(switchElement)

    // Check that coming soon dialog opens
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    expect(screen.getByText('This feature is coming soon!')).toBeInTheDocument()
  })

  it('displays correct dimensions format', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('10ft x 5ft')).toBeInTheDocument()
  })

  it('displays geopoint correctly', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('14.5995,120.9842')).toBeInTheDocument()
  })

  it('handles missing specs_rental data gracefully', async () => {
    const productWithoutSpecs = { ...mockProduct, specs_rental: null }
    vi.mocked(firebaseService.getProductById).mockResolvedValue(productWithoutSpecs)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Not specified')).toBeInTheDocument()
  })

  it('displays content history placeholder', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    // Switch to Content History tab
    const contentTab = screen.getByText('Content History')
    await userEvent.click(contentTab)

    expect(screen.getByText('Content history will be displayed here')).toBeInTheDocument()
  })

  it('renders site calendar button', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('Site Calendar')).toBeInTheDocument()
  })

  it('displays back navigation link', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    const backLink = screen.getByRole('link')
    expect(backLink).toHaveAttribute('href', '/logistics/dashboard')
  })

  it('handles product with no media array', async () => {
    const productWithoutMedia = { ...mockProduct, media: null }
    vi.mocked(firebaseService.getProductById).mockResolvedValue(productWithoutMedia)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    // Should still render without errors
    expect(screen.getByText('Site Information')).toBeInTheDocument()
  })

  it('displays category correctly', async () => {
    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    expect(screen.getByText('billboard')).toBeInTheDocument()
  })

  it('handles Firebase timestamp formatting', async () => {
    const productWithTimestamp = {
      ...mockProduct,
      structure: {
        ...mockProduct.structure,
        last_maintenance: { seconds: Date.now() / 1000, nanoseconds: 0 }
      }
    }
    vi.mocked(firebaseService.getProductById).mockResolvedValue(productWithTimestamp)

    const params = { id: 'test-site-id' }
    render(<SiteDetailsPage params={params} />)

    await screen.findByText('Site Information')

    // Should format the timestamp without errors
    expect(screen.getByText('Last Maintenance:')).toBeInTheDocument()
  })
})