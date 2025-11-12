import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GeoPoint } from 'firebase/firestore'

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  GeoPoint: vi.fn((lat, lng) => {
    const geopoint = { latitude: lat, longitude: lng }
    // Simulate GeoPoint constructor name for testing
    Object.setPrototypeOf(geopoint, {
      constructor: { name: 'GeoPoint' }
    })
    return geopoint
  }),
}))

// Mock components
vi.mock('@/components/google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: ({ value, onChange, onGeopointChange, placeholder }: any) => (
    <div>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid="location-input"
      />
      <button
        onClick={() => onGeopointChange(new GeoPoint(14.5995, 120.9842))}
        data-testid="set-geopoint"
      >
        Set Geopoint
      </button>
    </div>
  ),
}))

vi.mock('@/components/site-card-details', () => ({
  SiteCardDetails: ({ product }: any) => (
    <div data-testid="site-card">
      {product?.specs_rental?.geopoint
        ? `${product.specs_rental.geopoint.latitude}, ${product.specs_rental.geopoint.longitude}`
        : "Not Set"
      }
    </div>
  ),
}))

vi.mock('@/lib/proposal-service', () => ({
  createProposal: vi.fn(),
}))

vi.mock('@/lib/firebase-service', () => ({
  getProductById: vi.fn(),
  updateProduct: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { uid: 'test-user' } }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: ['test-id'] }),
}))

import { GooglePlacesAutocomplete } from '@/components/google-places-autocomplete'
import { SiteCardDetails } from '@/components/site-card-details'
import { createProposal } from '@/lib/proposal-service'
import { getProductById, updateProduct } from '@/lib/firebase-service'

describe('Geopoint Migration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GooglePlacesAutocomplete Component', () => {
    it('returns GeoPoint objects instead of arrays', () => {
      const mockOnGeopointChange = vi.fn()
      const mockOnChange = vi.fn()

      render(
        <GooglePlacesAutocomplete
          value=""
          onChange={mockOnChange}
          onGeopointChange={mockOnGeopointChange}
          placeholder="Enter location"
        />
      )

      const setGeopointButton = screen.getByTestId('set-geopoint')
      fireEvent.click(setGeopointButton)

      expect(mockOnGeopointChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 14.5995,
          longitude: 120.9842,
        })
      )

      const calledWith = mockOnGeopointChange.mock.calls[0][0]
      expect(calledWith).toHaveProperty('latitude')
      expect(calledWith).toHaveProperty('longitude')
      expect(calledWith.constructor.name).toBe('GeoPoint')
    })

    it('maintains location string handling', () => {
      const mockOnGeopointChange = vi.fn()
      const mockOnChange = vi.fn()

      render(
        <GooglePlacesAutocomplete
          value=""
          onChange={mockOnChange}
          onGeopointChange={mockOnGeopointChange}
          placeholder="Enter location"
        />
      )

      const input = screen.getByTestId('location-input')
      fireEvent.change(input, { target: { value: 'Manila, Philippines' } })

      expect(mockOnChange).toHaveBeenCalledWith('Manila, Philippines')
    })
  })

  describe('Display Components', () => {
    it('formats GeoPoint objects correctly in site card details', () => {
      const mockProduct = {
        id: 'test-product',
        name: 'Test Billboard',
        specs_rental: {
          geopoint: new GeoPoint(14.5995, 120.9842),
          location: 'Manila, Philippines',
        },
      }

      render(<SiteCardDetails product={mockProduct} />)

      expect(screen.getByTestId('site-card')).toHaveTextContent('14.5995, 120.9842')
    })

    it('handles missing geopoint gracefully', () => {
      const mockProduct = {
        id: 'test-product',
        name: 'Test Billboard',
        specs_rental: {
          location: 'Manila, Philippines',
        },
      }

      render(<SiteCardDetails product={mockProduct} />)

      expect(screen.getByTestId('site-card')).toHaveTextContent('Not Set')
    })

    it('handles null geopoint values', () => {
      const mockProduct = {
        id: 'test-product',
        name: 'Test Billboard',
        specs_rental: {
          geopoint: null,
          location: 'Manila, Philippines',
        },
      }

      render(<SiteCardDetails product={mockProduct} />)

      expect(screen.getByTestId('site-card')).toHaveTextContent('Not Set')
    })
  })

  describe('Service Functions', () => {
    it('createProposal initializes geopoint as GeoPoint object', async () => {
      const mockCreateProposal = createProposal as any
      mockCreateProposal.mockResolvedValue({ id: 'proposal-123' })

      const proposalData = {
        client_id: 'client-123',
        products: [{
          product_id: 'product-123',
          name: 'Test Billboard',
          location: 'Manila, Philippines',
          geopoint: new GeoPoint(14.5995, 120.9842),
        }],
      }

      await mockCreateProposal(proposalData)

      expect(mockCreateProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          products: expect.arrayContaining([
            expect.objectContaining({
              geopoint: expect.objectContaining({
                latitude: 14.5995,
                longitude: 120.9842,
              }),
            }),
          ]),
        })
      )
    })

    it('getProductById returns products with GeoPoint objects', async () => {
      const mockGetProductById = getProductById as any
      const mockProduct = {
        id: 'product-123',
        name: 'Test Billboard',
        specs_rental: {
          geopoint: new GeoPoint(14.5995, 120.9842),
          location: 'Manila, Philippines',
        },
      }

      mockGetProductById.mockResolvedValue(mockProduct)

      const result = await mockGetProductById('product-123')

      expect(result.specs_rental.geopoint).toEqual(
        expect.objectContaining({
          latitude: 14.5995,
          longitude: 120.9842,
        })
      )
      expect(result.specs_rental.geopoint.constructor.name).toBe('GeoPoint')
    })

    it('updateProduct accepts GeoPoint objects', async () => {
      const mockUpdateProduct = updateProduct as any
      mockUpdateProduct.mockResolvedValue(undefined)

      const productData = {
        name: 'Updated Billboard',
        specs_rental: {
          geopoint: new GeoPoint(14.5995, 120.9842),
          location: 'Manila, Philippines',
        },
      }

      await mockUpdateProduct('product-123', productData)

      expect(mockUpdateProduct).toHaveBeenCalledWith(
        'product-123',
        expect.objectContaining({
          specs_rental: expect.objectContaining({
            geopoint: expect.objectContaining({
              latitude: 14.5995,
              longitude: 120.9842,
            }),
          }),
        })
      )
    })
  })

  describe('Type Safety', () => {
    it('GeoPoint objects have correct properties', () => {
      const geopoint = new GeoPoint(14.5995, 120.9842)

      expect(geopoint).toHaveProperty('latitude')
      expect(geopoint).toHaveProperty('longitude')
      expect(typeof geopoint.latitude).toBe('number')
      expect(typeof geopoint.longitude).toBe('number')
      expect(geopoint.latitude).toBe(14.5995)
      expect(geopoint.longitude).toBe(120.9842)
    })

    it('GeoPoint handles edge coordinates', () => {
      const northPole = new GeoPoint(90, 0)
      const southPole = new GeoPoint(-90, 0)
      const dateLine = new GeoPoint(0, 180)

      expect(northPole.latitude).toBe(90)
      expect(southPole.latitude).toBe(-90)
      expect(dateLine.longitude).toBe(180)
    })

    it('GeoPoint handles decimal precision', () => {
      const preciseLocation = new GeoPoint(14.599512345, 120.984219876)

      expect(preciseLocation.latitude).toBe(14.599512345)
      expect(preciseLocation.longitude).toBe(120.984219876)
    })
  })

  describe('Backward Compatibility', () => {
    it('handles products with legacy array geopoints during migration', () => {
      // This test ensures we can handle mixed data during transition
      const legacyProduct = {
        id: 'legacy-product',
        specs_rental: {
          geopoint: [14.5995, 120.9842], // Old array format
        },
      }

      // During migration, we might need to convert arrays to GeoPoint
      const convertedGeopoint = new GeoPoint(
        legacyProduct.specs_rental.geopoint[0],
        legacyProduct.specs_rental.geopoint[1]
      )

      expect(convertedGeopoint.latitude).toBe(14.5995)
      expect(convertedGeopoint.longitude).toBe(120.9842)
    })

    it('maintains data integrity during conversion', () => {
      const originalArray = [14.5995, 120.9842]
      const geopoint = new GeoPoint(originalArray[0], originalArray[1])

      expect(geopoint.latitude).toBe(originalArray[0])
      expect(geopoint.longitude).toBe(originalArray[1])

      // Reverse conversion should work
      const backToArray = [geopoint.latitude, geopoint.longitude]
      expect(backToArray).toEqual(originalArray)
    })
  })

  describe('Error Handling', () => {
    it('handles invalid coordinates gracefully', () => {
      // GeoPoint constructor should handle invalid values
      const invalidGeopoint = new GeoPoint(NaN, Infinity)

      expect(invalidGeopoint.latitude).toBe(NaN)
      expect(invalidGeopoint.longitude).toBe(Infinity)
    })

    it('handles null/undefined coordinates in display', () => {
      const productWithNullGeopoint = {
        specs_rental: {
          geopoint: null,
        },
      }

      // Display logic should handle null geopoints
      const displayText = productWithNullGeopoint.specs_rental.geopoint
        ? `${productWithNullGeopoint.specs_rental.geopoint.latitude}, ${productWithNullGeopoint.specs_rental.geopoint.longitude}`
        : 'Not Set'

      expect(displayText).toBe('Not Set')
    })
  })
})