import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServiceAssignmentCard } from '@/components/logistics/assignments/create/ServiceAssignmentCard'

// Mock dependencies
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ ...props }: any) => <textarea {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: any) => <div data-testid="select" data-value={value}>{children}</div>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, ...props }: any) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar">Calendar</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon" />,
  CalendarIcon: () => <div data-testid="calendar-icon" />,
  Search: () => <div data-testid="search-icon" />,
  X: () => <div data-testid="x-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
}))

vi.mock('date-fns', () => ({
  format: vi.fn(() => 'Jan 1, 2024'),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  where: vi.fn(),
  db: {},
  Timestamp: {
    now: () => ({ seconds: Date.now() / 1000 }),
  },
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

vi.mock('./JobOrderSelectionDialog', () => ({
  JobOrderSelectionDialog: () => <div data-testid="job-order-selection-dialog" />,
}))

describe('ServiceAssignmentCard - Change Material Images', () => {
  const mockHandleInputChange = vi.fn()
  const mockOnOpenProductSelection = vi.fn()
  const mockOnClearJobOrder = vi.fn()

  const mockProducts = [
    {
      id: 'test-product-id',
      name: 'Test Site',
      media: [{ url: 'https://example.com/site-image.jpg' }],
      content_type: 'dynamic',
    },
  ]

  const mockTeams = [
    {
      id: 'test-team-id',
      name: 'Test Team',
      status: 'active',
    },
  ]

  const mockJobOrderData = {
    id: 'THtdI83u7FBZmvanDTgO',
    joNumber: 'JO-001',
    joType: 'Change Material',
    siteImageUrl: 'https://example.com/old-material.jpg',
    projectCompliance: {
      finalArtwork: {
        fileUrl: 'https://example.com/new-material.jpg',
      },
    },
    product_id: 'test-product-id',
    remarks: 'Test remarks',
    dateRequested: new Date(),
    deadline: new Date(),
    assignTo: 'test-team-id',
  }

  const defaultProps = {
    companyId: 'test-company-id',
    productId: 'test-product-id',
    formData: {
      projectSite: 'test-product-id',
      serviceType: 'Change Material',
      assignedTo: 'test-team-id',
      serviceDuration: 1,
      priority: 'Medium',
      equipmentRequired: '',
      materialSpecs: '',
      crew: 'test-team-id',
      gondola: '',
      technology: '',
      sales: '',
      remarks: 'Test remarks',
      message: '',
      campaignName: 'Test Campaign',
      startDate: new Date(),
      endDate: new Date(),
      alarmDate: null,
      alarmTime: '',
      attachments: [],
      serviceCost: {
        crewFee: '',
        overtimeFee: '',
        transpo: '',
        tollFee: '',
        mealAllowance: '',
        otherFees: [],
        total: 0,
      },
    },
    handleInputChange: mockHandleInputChange,
    products: mockProducts,
    teams: mockTeams,
    saNumber: '123456',
    jobOrderData: mockJobOrderData,
    onOpenProductSelection: mockOnOpenProductSelection,
    onClearJobOrder: mockOnClearJobOrder,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays "Old" and "New" material images when service type is "Change Material"', () => {
    render(<ServiceAssignmentCard {...defaultProps} />)

    // Check that the "Old" image is displayed with correct src
    const oldImages = screen.getAllByAltText('Old Material')
    expect(oldImages).toHaveLength(1)
    expect(oldImages[0]).toHaveAttribute('src', 'https://example.com/old-material.jpg')

    // Check that the "New" image is displayed with correct src
    const newImages = screen.getAllByAltText('New Material')
    expect(newImages).toHaveLength(1)
    expect(newImages[0]).toHaveAttribute('src', 'https://example.com/new-material.jpg')

    // Check that "Old" label is visible
    expect(screen.getByText('Old')).toBeInTheDocument()

    // Check that "New" label is visible
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('displays fallback image when siteImageUrl is not available', () => {
    const jobOrderWithoutOldImage = {
      ...mockJobOrderData,
      siteImageUrl: undefined,
    }

    render(
      <ServiceAssignmentCard
        {...defaultProps}
        jobOrderData={jobOrderWithoutOldImage}
      />
    )

    // Should show fallback image for old material
    const oldImages = screen.getAllByAltText('Old Material')
    expect(oldImages[0]).toHaveAttribute('src', '/logistics-sa-create-dl.png')
  })

  it('displays fallback image when finalArtwork fileUrl is not available', () => {
    const jobOrderWithoutNewImage = {
      ...mockJobOrderData,
      projectCompliance: {
        finalArtwork: {
          fileUrl: undefined,
        },
      },
    }

    render(
      <ServiceAssignmentCard
        {...defaultProps}
        jobOrderData={jobOrderWithoutNewImage}
      />
    )

    // Should show fallback image for new material
    const newImages = screen.getAllByAltText('New Material')
    expect(newImages[0]).toHaveAttribute('src', '/logistics-sa-create-dl.png')
  })

  it('does not display Change Material images when service type is not "Change Material"', () => {
    render(
      <ServiceAssignmentCard
        {...defaultProps}
        formData={{
          ...defaultProps.formData,
          serviceType: 'Monitoring',
        }}
      />
    )

    // Should not show "Old" and "New" labels
    expect(screen.queryByText('Old')).not.toBeInTheDocument()
    expect(screen.queryByText('New')).not.toBeInTheDocument()

    // Should not show images with those alt texts
    expect(screen.queryByAltText('Old Material')).not.toBeInTheDocument()
    expect(screen.queryByAltText('New Material')).not.toBeInTheDocument()
  })
})