import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// Mock all the dependencies
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-proposal-id' }),
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    userData: {
      uid: 'test-user-id',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone_number: '+1234567890',
      company_id: 'test-company-id'
    }
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
  uploadFileToFirebaseStorage: vi.fn(),
  type: {
    Product: {},
    Booking: {}
  }
}))

vi.mock('@/lib/client-service', () => ({
  getPaginatedClients: vi.fn(),
  type: {
    Client: {}
  }
}))

vi.mock('@/lib/firebase', () => ({
  db: {}
}))

vi.mock('@/lib/google-maps-loader', () => ({
  loadGoogleMaps: vi.fn()
}))

vi.mock('@/lib/static-maps', () => ({
  generateStaticMapUrl: vi.fn()
}))

vi.mock('@/components/send-proposal-share-dialog', () => ({
  SendProposalShareDialog: () => <div data-testid="send-proposal-share-dialog" />
}))

vi.mock('@/components/proposal-history', () => ({
  ProposalHistory: () => <div data-testid="proposal-history" />
}))

vi.mock('@/components/delete-confirmation-dialog', () => ({
  DeleteConfirmationDialog: () => <div data-testid="delete-confirmation-dialog" />
}))

vi.mock('@/components/blank-page-editor', () => ({
  BlankPageEditor: () => <div data-testid="blank-page-editor" />
}))

vi.mock('lucide-react', () => ({
  Grid3X3: () => null,
  Loader2: () => null,
  Edit: () => null,
  Download: () => null,
  Send: () => null,
  CheckCircle2: () => null,
  Plus: () => null,
  X: () => null,
  Upload: () => null,
  ArrowLeft: () => null,
}))

vi.mock('node-vibrant/browser', () => ({
  Vibrant: {
    from: vi.fn(() => ({
      getPalette: vi.fn(() => Promise.resolve({
        Vibrant: { hex: '#ff0000' }
      }))
    }))
  }
}))

// Import the component after all mocks
import ProposalDetailsPage from './page'

describe('Location Visibility Formatting', () => {
  it('should format numbers with commas in edit mode', async () => {
    const mockProposal = {
      id: 'test-proposal-id',
      title: 'Test Proposal',
      proposalTitle: 'Test Proposal',
      companyName: 'Test Company',
      client: {
        id: 'test-client-id',
        contactPerson: 'Test Client',
        company: 'Test Company',
        email: 'client@example.com',
        phone: '+1234567890',
        address: 'Test Address',
        industry: 'Test Industry',
        designation: 'Test Designation',
        targetAudience: '',
        campaignObjective: '',
        company_id: 'test-company-id'
      },
      products: [{
        id: 'test-product-id',
        ID: 'test-product-id',
        name: 'Test Product',
        location: 'Test Location',
        price: 1000,
        categories: ['billboard'],
        category_names: ['Billboard'],
        specs_rental: {
          height: 10,
          width: 20,
          traffic_count: 1500,
          location_visibility: 2500,
          location_visibility_unit: 'm'
        },
        media: [],
        description: 'Test Description',
        health_percentage: 100,
        type: 'rental'
      }],
      fieldVisibility: {
        'test-product-id': {
          location: true,
          dimension: true,
          type: true,
          traffic: true,
          location_visibility: true,
          srp: true,
          additionalMessage: true
        }
      },
      createdAt: new Date(),
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1',
      templateBackground: '',
      preparedByName: 'Test User',
      preparedByCompany: 'Test Company',
      contactInfo: {
        heading: 'contact us:',
        name: 'Test User',
        role: 'Sales',
        phone: '+1234567890',
        email: 'test@example.com'
      },
      proposalMessage: 'Thank You!',
      status: 'draft' as const
    }

    // Mock the API calls
    const { getProposalById } = await import('@/lib/proposal-service')
    vi.mocked(getProposalById).mockResolvedValue(mockProposal)

    const { getPaginatedClients } = await import('@/lib/client-service')
    vi.mocked(getPaginatedClients).mockResolvedValue({
      items: [mockProposal.client],
      totalCount: 1,
      lastDoc: null
    })

    render(<ProposalDetailsPage />)

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Proposal')).toBeInTheDocument()
    })

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Check if the location visibility input shows formatted value
    const locationVisibilityInput = screen.getByDisplayValue('2,500 m')
    expect(locationVisibilityInput).toBeInTheDocument()
  })

  it('should display formatted numbers in view mode', async () => {
    const mockProposal = {
      id: 'test-proposal-id',
      title: 'Test Proposal',
      proposalTitle: 'Test Proposal',
      companyName: 'Test Company',
      client: {
        id: 'test-client-id',
        contactPerson: 'Test Client',
        company: 'Test Company',
        email: 'client@example.com',
        phone: '+1234567890',
        address: 'Test Address',
        industry: 'Test Industry',
        designation: 'Test Designation',
        targetAudience: '',
        campaignObjective: '',
        company_id: 'test-company-id'
      },
      products: [{
        id: 'test-product-id',
        ID: 'test-product-id',
        name: 'Test Product',
        location: 'Test Location',
        price: 1000,
        categories: ['billboard'],
        category_names: ['Billboard'],
        specs_rental: {
          height: 10,
          width: 20,
          traffic_count: 1500,
          location_visibility: 5000,
          location_visibility_unit: 'm'
        },
        media: [],
        description: 'Test Description',
        health_percentage: 100,
        type: 'rental'
      }],
      fieldVisibility: {
        'test-product-id': {
          location: true,
          dimension: true,
          type: true,
          traffic: true,
          location_visibility: true,
          srp: true,
          additionalMessage: true
        }
      },
      createdAt: new Date(),
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1',
      templateBackground: '',
      preparedByName: 'Test User',
      preparedByCompany: 'Test Company',
      contactInfo: {
        heading: 'contact us:',
        name: 'Test User',
        role: 'Sales',
        phone: '+1234567890',
        email: 'test@example.com'
      },
      proposalMessage: 'Thank You!',
      status: 'draft' as const
    }

    // Mock the API calls
    const { getProposalById } = await import('@/lib/proposal-service')
    vi.mocked(getProposalById).mockResolvedValue(mockProposal)

    const { getPaginatedClients } = await import('@/lib/client-service')
    vi.mocked(getPaginatedClients).mockResolvedValue({
      items: [mockProposal.client],
      totalCount: 1,
      lastDoc: null
    })

    render(<ProposalDetailsPage />)

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Proposal')).toBeInTheDocument()
    })

    // Check if location visibility is displayed with commas in view mode
    expect(screen.getByText('5,000 m')).toBeInTheDocument()
  })

  it('should save location visibility with commas correctly', async () => {
    const mockProposal = {
      id: 'test-proposal-id',
      title: 'Test Proposal',
      proposalTitle: 'Test Proposal',
      companyName: 'Test Company',
      client: {
        id: 'test-client-id',
        contactPerson: 'Test Client',
        company: 'Test Company',
        email: 'client@example.com',
        phone: '+1234567890',
        address: 'Test Address',
        industry: 'Test Industry',
        designation: 'Test Designation',
        targetAudience: '',
        campaignObjective: '',
        company_id: 'test-company-id'
      },
      products: [{
        id: 'test-product-id',
        ID: 'test-product-id',
        name: 'Test Product',
        location: 'Test Location',
        price: 1000,
        categories: ['billboard'],
        category_names: ['Billboard'],
        specs_rental: {
          height: 10,
          width: 20,
          traffic_count: 1500,
          location_visibility: 1000,
          location_visibility_unit: 'm'
        },
        media: [],
        description: 'Test Description',
        health_percentage: 100,
        type: 'rental'
      }],
      fieldVisibility: {
        'test-product-id': {
          location: true,
          dimension: true,
          type: true,
          traffic: true,
          location_visibility: true,
          srp: true,
          additionalMessage: true
        }
      },
      createdAt: new Date(),
      templateSize: 'A4',
      templateOrientation: 'Landscape',
      templateLayout: '1',
      templateBackground: '',
      preparedByName: 'Test User',
      preparedByCompany: 'Test Company',
      contactInfo: {
        heading: 'contact us:',
        name: 'Test User',
        role: 'Sales',
        phone: '+1234567890',
        email: 'test@example.com'
      },
      proposalMessage: 'Thank You!',
      status: 'draft' as const
    }

    // Mock the API calls
    const { getProposalById, updateProposal } = await import('@/lib/proposal-service')
    vi.mocked(getProposalById).mockResolvedValue(mockProposal)
    vi.mocked(updateProposal).mockResolvedValue()

    const { getPaginatedClients } = await import('@/lib/client-service')
    vi.mocked(getPaginatedClients).mockResolvedValue({
      items: [mockProposal.client],
      totalCount: 1,
      lastDoc: null
    })

    render(<ProposalDetailsPage />)

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Test Proposal')).toBeInTheDocument()
    })

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Change the location visibility value
    const locationVisibilityInput = screen.getByDisplayValue('1,000 m')
    fireEvent.change(locationVisibilityInput, { target: { value: '2500 km' } })

    // Save the changes
    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    // Wait for save to complete
    await waitFor(() => {
      expect(updateProposal).toHaveBeenCalled()
    })

    // Check that updateProposal was called with the correct data
    const updateCall = vi.mocked(updateProposal).mock.calls[0]
    expect(updateCall[0]).toBe('test-proposal-id') // proposal id

    const updateData = updateCall[1]
    expect(updateData.products[0].specs_rental.location_visibility).toBe(2500)
    expect(updateData.products[0].specs_rental.location_visibility_unit).toBe('km')
  })
})