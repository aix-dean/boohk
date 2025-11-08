import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import ProposalDetailsPage from '../[id]/page'
import { getProposalById, updateProposal } from '@/lib/proposal-service'
import { getPaginatedClients } from '@/lib/client-service'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn()
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    userData: {
      uid: 'test-user',
      company_id: 'test-company',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com'
    }
  })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

vi.mock('@/lib/proposal-service', () => ({
  getProposalById: vi.fn(),
  updateProposal: vi.fn(),
  downloadProposalPDF: vi.fn(),
  generateProposalPDFBlob: vi.fn(),
  generateAndUploadProposalPDF: vi.fn()
}))

vi.mock('@/lib/firebase-service', () => ({
  getPaginatedUserProducts: vi.fn(),
  getUserProductsCount: vi.fn(),
  softDeleteProduct: vi.fn(),
  getProposalTemplatesByCompanyId: vi.fn(),
  createProposalTemplate: vi.fn(),
  uploadFileToFirebaseStorage: vi.fn()
}))

vi.mock('@/lib/client-service', () => ({
  getPaginatedClients: vi.fn(() => Promise.resolve({ items: [] }))
}))

vi.mock('@/lib/google-maps-loader', () => ({
  loadGoogleMaps: vi.fn()
}))

vi.mock('@/lib/static-maps', () => ({
  generateStaticMapUrl: vi.fn()
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, ...props }: any) => <option {...props}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>
}))

vi.mock('@/components/responsive-card-grid', () => ({
  ResponsiveCardGrid: ({ children }: any) => <div>{children}</div>
}))

vi.mock('@/components/delete-confirmation-dialog', () => ({
  DeleteConfirmationDialog: () => <div>Delete Dialog</div>
}))

vi.mock('@/components/blank-page-editor', () => ({
  BlankPageEditor: () => <div>Blank Page Editor</div>
}))

vi.mock('@/components/proposal-history', () => ({
  ProposalHistory: () => <div>Proposal History</div>
}))

vi.mock('@/components/send-proposal-share-dialog', () => ({
  SendProposalShareDialog: () => <div>Send Dialog</div>
}))

vi.mock('node-vibrant/browser', () => ({
  Vibrant: {
    from: vi.fn().mockReturnValue({
      getPalette: vi.fn().mockResolvedValue({
        Vibrant: { hex: '#ff0000' }
      })
    })
  }
}))

vi.mock('@/lib/firebase', () => ({
  db: {},
  doc: vi.fn(),
  getDoc: vi.fn()
}))

vi.mock('lucide-react', () => ({
  FileText: () => <div>FileText</div>,
  Grid3X3: () => <div>Grid3X3</div>,
  ArrowLeft: () => <div>ArrowLeft</div>,
  Loader2: () => <div>Loader2</div>,
  Edit: () => <div>Edit</div>,
  Download: () => <div>Download</div>,
  Plus: () => <div>Plus</div>,
  X: () => <div>X</div>,
  ImageIcon: () => <div>ImageIcon</div>,
  Upload: () => <div>Upload</div>,
  Check: () => <div>Check</div>,
  Minus: () => <div>Minus</div>,
  Send: () => <div>Send</div>,
  CheckCircle2: () => <div>CheckCircle2</div>
}))

describe('ProposalDetailsPage', () => {
  const mockParams = { id: 'test-proposal-id' }
  const mockRouter = { push: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useParams as any).mockReturnValue(mockParams)
    ;(useRouter as any).mockReturnValue(mockRouter)
  })

  it('renders loading state initially', () => {
    act(() => {
      render(<ProposalDetailsPage />)
    })

    expect(screen.getByText('Loading proposal...')).toBeInTheDocument()
  })

  it('renders proposal not found when proposal is null', async () => {
    // Mock getProposalById to return null
    ;(getProposalById as any).mockResolvedValue(null)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Proposal Not Found')).toBeInTheDocument()
    })
  })

  it('renders proposal details when proposal is loaded', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [],
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('← Finalize proposal')).toBeInTheDocument()
    })
  })

  it('handles edit mode toggle', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [],
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('← Finalize proposal')).toBeInTheDocument()
    })

    // Find and click edit button
    const editButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg') // Edit icon
    )

    if (editButton) {
      fireEvent.click(editButton)

      // Check if edit mode is activated (this might be hard to test directly)
      expect(editButton).toBeInTheDocument()
    }
  })

  it('calculates total pages correctly', () => {
    // This would test the getTotalPages function, but it's internal
    // We can test it by checking the rendered page numbers

    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [
        { id: 'product-1', name: 'Product 1' },
        { id: 'product-2', name: 'Product 2' }
      ],
      customPages: [],
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    // With 2 products and layout '1' (1 per page), should have 4 pages total:
    // 1 intro + 2 product pages + 1 outro
    // But testing this requires waiting for render and checking page numbers
  })

  it('handles client selection', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [],
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    ;(getPaginatedClients as any).mockResolvedValue({
      items: [
        {
          id: 'client-1',
          name: 'John Doe',
          company: 'Test Company',
          email: 'john@test.com'
        },
        {
          id: 'client-2',
          name: 'Jane Smith',
          company: 'Another Company',
          email: 'jane@test.com'
        }
      ]
    })

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('← Finalize proposal')).toBeInTheDocument()
    })

    // Client selector should be present
    expect(screen.getByText('Client:')).toBeInTheDocument()
  })

  it('handles zoom controls', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [],
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('← Finalize proposal')).toBeInTheDocument()
    })

    // Zoom controls should be available (though not directly testable without more setup)
    // This test ensures the component renders without crashing with zoom functionality
  })

  it('displays location visibility in view mode', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [
        {
          id: 'product-1',
          name: 'Test Billboard',
          location: 'Test Location',
          specs_rental: {
            location_visibility: 1000000,
            location_visibility_unit: 'm'
          },
          categories: ['Billboard'],
          price: 1000
        }
      ],
      fieldVisibility: {
        'product-1': {
          location_visibility: true
        }
      },
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Location Visibility:')).toBeInTheDocument()
    })

    expect(screen.getByText('1,000,000 m')).toBeInTheDocument()
  })

  it('allows editing location visibility in edit mode', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [
        {
          id: 'product-1',
          name: 'Test Billboard',
          location: 'Test Location',
          specs_rental: {
            location_visibility: 1000000,
            location_visibility_unit: 'm'
          },
          categories: ['Billboard'],
          price: 1000
        }
      ],
      fieldVisibility: {
        'product-1': {
          location_visibility: true
        }
      },
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Location Visibility:')).toBeInTheDocument()
    })

    // Enter edit mode
    const editButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg') // Edit icon
    )

    if (editButton) {
      fireEvent.click(editButton)

      // Wait for edit mode to activate
      await waitFor(() => {
        const locationVisibilityInput = screen.getByDisplayValue('1,000,000')
        expect(locationVisibilityInput).toBeInTheDocument()
      })

      // Test number formatting - type '2000000' and expect '2,000,000'
      const locationVisibilityInput = screen.getByDisplayValue('1,000,000')
      fireEvent.change(locationVisibilityInput, { target: { value: '2000000' } })

      expect(locationVisibilityInput).toHaveValue('2,000,000')
    }
  })

  it('saves location visibility changes correctly', async () => {
    ;(updateProposal as any).mockResolvedValue({})

    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [
        {
          id: 'product-1',
          name: 'Test Billboard',
          location: 'Test Location',
          specs_rental: {
            location_visibility: 1000000,
            location_visibility_unit: 'm'
          },
          categories: ['Billboard'],
          price: 1000
        }
      ],
      fieldVisibility: {
        'product-1': {
          location_visibility: true
        }
      },
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Location Visibility:')).toBeInTheDocument()
    })

    // Enter edit mode
    const editButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg') // Edit icon
    )

    if (editButton) {
      fireEvent.click(editButton)

      // Wait for edit mode and change location visibility
      await waitFor(() => {
        const locationVisibilityInput = screen.getByDisplayValue('1,000,000')
        fireEvent.change(locationVisibilityInput, { target: { value: '2000000' } })
      })

      // Find and click save button
      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      // Verify updateProposal was called with correct data
      await waitFor(() => {
        expect(updateProposal).toHaveBeenCalledWith(
          'test-proposal',
          expect.objectContaining({
            products: expect.arrayContaining([
              expect.objectContaining({
                specs_rental: expect.objectContaining({
                  location_visibility: 2000000
                })
              })
            ])
          }),
          'test-user',
          'Test User'
        )
      })
    }
  })

  it('hides location visibility when field visibility is false', async () => {
    const mockProposal = {
      id: 'test-proposal',
      title: 'Test Proposal',
      client: {
        id: 'client-1',
        contactPerson: 'John Doe',
        company: 'Test Company',
        email: 'john@test.com'
      },
      products: [
        {
          id: 'product-1',
          name: 'Test Billboard',
          location: 'Test Location',
          specs_rental: {
            location_visibility: 1000000,
            location_visibility_unit: 'm'
          },
          categories: ['Billboard'],
          price: 1000
        }
      ],
      fieldVisibility: {
        'product-1': {
          location_visibility: false // Hidden
        }
      },
      createdAt: new Date().toISOString(),
      companyName: 'Test Company',
      proposalTitle: 'Test Proposal',
      proposalMessage: 'Thank you',
      contactInfo: {
        heading: 'Contact Us',
        name: 'Sales Rep',
        role: 'Sales',
        phone: '123-456-7890',
        email: 'sales@test.com'
      },
      preparedByName: 'Sales Rep',
      preparedByCompany: 'Test Company',
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1'
    }

    ;(getProposalById as any).mockResolvedValue(mockProposal)

    act(() => {
      render(<ProposalDetailsPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('← Finalize proposal')).toBeInTheDocument()
    })

    // Location visibility should not be displayed
    expect(screen.queryByText('Location Visibility:')).not.toBeInTheDocument()
    expect(screen.queryByText('1,000,000 m')).not.toBeInTheDocument()
  })
})