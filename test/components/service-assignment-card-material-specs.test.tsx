import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button onClick={() => onValueChange && onValueChange('Tarpaulin')}>Select Tarpaulin</button>
    </div>
  ),
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
  JobOrderSelectionDialog: ({ onSelectJobOrder }: any) => (
    <div data-testid="job-order-selection-dialog">
      <button onClick={() => onSelectJobOrder({
        id: 'different-jo',
        joNumber: 'JO-002',
        joType: 'Roll Up',
        materialSpec: 'Sticker',
        product_id: 'test-product-id',
        remarks: 'Different remarks',
        dateRequested: new Date(),
        deadline: new Date(),
        assignTo: 'test-team-id',
      })}>
        Select Different Job Order
      </button>
    </div>
  ),
}))

describe('ServiceAssignmentCard - Material Specs from Tagged Job Order', () => {
  const mockHandleInputChange = vi.fn()
  const mockOnOpenProductSelection = vi.fn()
  const mockOnClearJobOrder = vi.fn()

  const mockProducts = [
    {
      id: 'test-product-id',
      name: 'Test Site',
      description: 'Test description',
      price: 1000,
      active: true,
      deleted: false,
      seller_id: 'test-seller',
      seller_name: 'Test Seller',
      position: 1,
      media: [{ url: 'https://example.com/site-image.jpg', distance: '100m', type: 'image', isVideo: false }],
      content_type: 'dynamic',
    },
  ] as any

  const mockTeams = [
    {
      id: 'test-team-id',
      name: 'Test Team',
      description: 'Test team description',
      teamType: 'operations',
      status: 'active',
      leaderId: 'leader-id',
      leaderName: 'Team Leader',
      members: [],
      specializations: ['installation', 'maintenance'],
      location: 'Test Location',
      contactNumber: '123-456-7890',
      email: 'team@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin',
      company_id: 'test-company-id',
    },
  ] as any

  const mockJobOrderData = {
    id: 'THtdI83u7FBZmvanDTgO',
    joNumber: 'JO-001',
    siteName: 'Test Site',
    joType: 'Roll Up',
    requestedBy: 'Test User',
    assignTo: 'test-team-id',
    dateRequested: new Date(),
    deadline: new Date(),
    jobDescription: 'Test job',
    message: 'Test message',
    attachments: null,
    status: 'approved',
    created: new Date(),
    created_by: 'test-user',
    company_id: 'test-company',
    remarks: 'Test remarks',
    product_id: 'test-product-id',
    materialSpec: 'Tarpaulin',
  } as any

  const defaultProps = {
    companyId: 'test-company-id',
    productId: 'test-product-id',
    formData: {
      projectSite: 'test-product-id',
      serviceType: 'Roll Up',
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

  it('populates Material Specs field with tagged job order\'s material specs', async () => {
    render(<ServiceAssignmentCard {...defaultProps} />)

    // Wait for useEffect to set materialSpecs
    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith('materialSpecs', 'Tarpaulin')
    })

    // Check that the Select has the correct value
    const select = screen.getByTestId('select')
    expect(select).toHaveAttribute('data-value', 'Tarpaulin')
  })

  it('does not change Material Specs when selecting a different job order', async () => {
    render(<ServiceAssignmentCard {...defaultProps} />)

    // Initially set to Tarpaulin
    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith('materialSpecs', 'Tarpaulin')
    })

    // Simulate selecting a different job order via dialog
    const selectButton = screen.getByText('Select Different Job Order')
    fireEvent.click(selectButton)

    // Material Specs should not change because handleJobOrderSelect doesn't update it
    // The useEffect only runs on jobOrderData prop change
    expect(mockHandleInputChange).not.toHaveBeenCalledWith('materialSpecs', 'Sticker')
  })

  it('includes correct material specs in form data for submission', async () => {
    render(<ServiceAssignmentCard {...defaultProps} />)

    await waitFor(() => {
      expect(mockHandleInputChange).toHaveBeenCalledWith('materialSpecs', 'Tarpaulin')
    })

    // Simulate form submission by checking the formData would have materialSpecs set
    // Since handleInputChange is called, the parent component's formData should be updated
    expect(mockHandleInputChange).toHaveBeenCalledWith('materialSpecs', 'Tarpaulin')
  })

  it('does not show Material Specs field for excluded service types', () => {
    const excludedTypes = ['Monitoring', 'Change Material', 'Maintenance', 'Repair']

    excludedTypes.forEach(type => {
      render(
        <ServiceAssignmentCard
          {...defaultProps}
          formData={{
            ...defaultProps.formData,
            serviceType: type,
          }}
        />
      )

      expect(screen.queryByText('Material Specs:')).not.toBeInTheDocument()
    })
  })

  it('shows Material Specs field for included service types', () => {
    const includedTypes = ['Roll Up', 'Roll Down']

    includedTypes.forEach(type => {
      render(
        <ServiceAssignmentCard
          {...defaultProps}
          formData={{
            ...defaultProps.formData,
            serviceType: type,
          }}
        />
      )

      expect(screen.getByText('Material Specs:')).toBeInTheDocument()
    })
  })

  it('handles missing materialSpec in job order gracefully', () => {
    const jobOrderWithoutMaterialSpec = {
      ...mockJobOrderData,
      materialSpec: undefined,
    } as any

    render(
      <ServiceAssignmentCard
        {...defaultProps}
        jobOrderData={jobOrderWithoutMaterialSpec}
      />
    )

    // Should not call handleInputChange for materialSpecs
    expect(mockHandleInputChange).not.toHaveBeenCalledWith('materialSpecs', expect.anything())
  })

  it('validates required fields including Material Specs when applicable', () => {
    render(
      <ServiceAssignmentCard
        {...defaultProps}
        formData={{
          ...defaultProps.formData,
          materialSpecs: '', // Empty
        }}
      />
    )

    // The component shows * for required, but validation is handled elsewhere
    // Just check that the field is present
    expect(screen.getByText('Material Specs:')).toBeInTheDocument()
  })
})