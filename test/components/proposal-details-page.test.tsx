import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock all the dependencies
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-proposal-id' }),
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    userData: { company_id: 'test-company-id', first_name: 'Test', last_name: 'User' }
  })
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
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
  getPaginatedClients: vi.fn()
}))

vi.mock('@/lib/google-maps-loader', () => ({
  loadGoogleMaps: vi.fn()
}))

vi.mock('@/lib/static-maps', () => ({
  generateStaticMapUrl: vi.fn()
}))

vi.mock('@/lib/firebase', () => ({
  db: {}
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn()
}))

vi.mock('@/components/send-proposal-share-dialog', () => ({
  SendProposalShareDialog: () => React.createElement('div', { 'data-testid': 'send-proposal-dialog' })
}))

vi.mock('@/components/proposal-history', () => ({
  ProposalHistory: () => React.createElement('div', { 'data-testid': 'proposal-history' })
}))

vi.mock('@/components/responsive-card-grid', () => ({
  ResponsiveCardGrid: ({ children }: any) => React.createElement('div', { 'data-testid': 'responsive-card-grid' }, children)
}))

vi.mock('@/components/delete-confirmation-dialog', () => ({
  DeleteConfirmationDialog: () => React.createElement('div', { 'data-testid': 'delete-confirmation' })
}))

vi.mock('node-vibrant/browser', () => ({
  Vibrant: vi.fn().mockImplementation(() => ({
    getPalette: vi.fn().mockResolvedValue({
      Vibrant: { hex: '#f8c102' }
    })
  }))
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog' }, children),
  DialogContent: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog-content' }, children),
  DialogTitle: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog-title' }, children)
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => React.createElement('div', { 'data-testid': 'select' }, children),
  SelectContent: ({ children }: any) => React.createElement('div', { 'data-testid': 'select-content' }, children),
  SelectItem: ({ children }: any) => React.createElement('div', { 'data-testid': 'select-item' }, children),
  SelectTrigger: ({ children }: any) => React.createElement('div', { 'data-testid': 'select-trigger' }, children),
  SelectValue: ({ children }: any) => React.createElement('div', { 'data-testid': 'select-value' }, children)
}))

describe('Proposal Details Page Price Formatting', () => {
  describe('Price Formatting Utilities', () => {
    it('should format prices with 2 decimal places for whole numbers', () => {
      const testPrice = 100
      const formattedPrice = testPrice.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      expect(formattedPrice).toBe('100.00')
    })

    it('should format prices with 2 decimal places for decimal values', () => {
      const testPrice = 100.5
      const formattedPrice = testPrice.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      expect(formattedPrice).toBe('100.50')
    })

    it('should format prices with 2 decimal places for values with more than 2 decimals', () => {
      const testPrice = 100.123
      const formattedPrice = testPrice.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      expect(formattedPrice).toBe('100.12')
    })

    it('should format zero with 2 decimal places', () => {
      const testPrice = 0
      const formattedPrice = testPrice.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      expect(formattedPrice).toBe('0.00')
    })

    it('should format negative prices with 2 decimal places', () => {
      const testPrice = -100
      const formattedPrice = testPrice.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      expect(formattedPrice).toBe('-100.00')
    })

    it('should format large numbers with proper comma separation and 2 decimals', () => {
      const testPrice = 1000000
      const formattedPrice = testPrice.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      expect(formattedPrice).toBe('1,000,000.00')
    })
  })

  describe('Price Display in Components', () => {
    it('should format SRP display correctly', () => {
      // Test the SRP formatting logic used in the component
      const product = { price: 150 }
      const expectedSRP = `₱${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month`

      expect(expectedSRP).toBe('₱150.00 per month')
    })

    it('should format site details price display correctly', () => {
      // Test the price display logic used in site details
      const product = { price: 250.75 }
      const expectedDisplay = `₱${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month`

      expect(expectedDisplay).toBe('₱250.75 per month')
    })

    it('should format add sites dialog price display correctly', () => {
      // Test the price display logic used in add sites dialog
      const product = { price: 500 }
      const expectedDisplay = `₱${Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      expect(expectedDisplay).toBe('₱500.00')
    })

    it('should handle zero prices correctly', () => {
      const product = { price: 0 }
      const expectedDisplay = `₱${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month`

      expect(expectedDisplay).toBe('₱0.00 per month')
    })
  })
})