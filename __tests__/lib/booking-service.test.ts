import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bookingService, getAllBookings } from '../../lib/booking-service'
import { db } from '../../lib/firebase'
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore'

// Mock Firebase
vi.mock('../../lib/firebase', () => ({
  db: {}
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => ({ toDate: vi.fn(() => new Date()) })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: vi.fn(() => new Date()) })),
    fromDate: vi.fn((date) => ({ toDate: vi.fn(() => date) }))
  }
}))

describe('Booking Service', () => {
  const mockBookingData = {
    cancel_reason: '',
    category_id: 'cat-1',
    client: {
      company_id: 'comp-1',
      id: 'client-1',
      name: 'Test Client',
      company_name: 'Test Company'
    },
    company_id: 'comp-1',
    cost: 1000,
    costDetails: {
      basePrice: 1000,
      days: 30,
      discount: 0,
      months: 1,
      otherFees: 0,
      pricePerMonth: 1000,
      total: 1000,
      vatAmount: 120,
      vatRate: 12
    },
    created: { toDate: vi.fn(() => new Date()) },
    end_date: { toDate: vi.fn(() => new Date('2024-01-31')) },
    payment_method: 'Manual Payment',
    product_id: 'prod-1',
    product_owner: 'Test Owner',
    project_name: 'Test Project',
    reservation_id: 'RV-12345',
    seller_id: 'seller-1',
    start_date: { toDate: vi.fn(() => new Date('2024-01-01')) },
    status: 'RESERVED',
    total_cost: 1000,
    type: 'RENTAL',
    updated: { toDate: vi.fn(() => new Date()) },
    user_id: 'user-1',
    quotation_id: 'quote-1',
    quotation_number: 'Q-001',
    items: [
      {
        id: 'item-1',
        name: 'LED Billboard',
        quantity: 1,
        price: 1000,
        specs: { width: 10, height: 5 }
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getAllBookings', () => {
    it('should fetch all bookings successfully', async () => {
      const mockQuerySnapshot = {
        size: 1,
        docs: [
          {
            id: 'booking-1',
            data: () => mockBookingData
          }
        ],
        forEach: function(callback: (doc: any) => void) {
          this.docs.forEach(callback)
        }
      }

      ;(getDocs as any).mockResolvedValue(mockQuerySnapshot)

      const result = await getAllBookings()

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'booking-1',
        ...mockBookingData
      })
    })

    it('should handle empty bookings list', async () => {
      const mockQuerySnapshot = {
        size: 0,
        docs: [],
        forEach: function(callback: (doc: any) => void) {
          this.docs.forEach(callback)
        }
      }

      ;(getDocs as any).mockResolvedValue(mockQuerySnapshot)

      const result = await getAllBookings()

      expect(result).toHaveLength(0)
    })
  })

  describe('bookingService.getBookingById', () => {
    it('should return booking when found', async () => {
      const mockDocSnapshot = {
        exists: () => true,
        id: 'booking-1',
        data: () => mockBookingData
      }

      ;(getDoc as any).mockResolvedValue(mockDocSnapshot)

      const result = await bookingService.getBookingById('booking-1')

      expect(result).toEqual({
        id: 'booking-1',
        ...mockBookingData
      })
    })

    it('should return null when booking not found', async () => {
      const mockDocSnapshot = {
        exists: () => false
      }

      ;(getDoc as any).mockResolvedValue(mockDocSnapshot)

      const result = await bookingService.getBookingById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('bookingService.createBooking', () => {
    it('should create booking with items field', async () => {
      const quotationData = {
        id: 'quote-1',
        category_id: 'cat-1',
        client_company_id: 'comp-1',
        client_id: 'client-1',
        client_name: 'Test Client',
        client_company_name: 'Test Company',
        contract: 'contract-1',
        discount: 0,
        end_date: new Date('2024-01-31'),
        items: {
          product_id: 'prod-1',
          name: 'LED Billboard',
          price: 1000,
          duration_days: 30,
          item_total_amount: 1000
        },
        media_order: [],
        months: 1,
        other_fees: 0,
        payment_method: 'Manual Payment',
        product_owner: 'Test Owner',
        promos: {},
        projectCompliance: undefined,
        requirements: [],
        seller_id: 'seller-1',
        start_date: new Date('2024-01-01'),
        total_cost: 1000,
        type: 'RENTAL',
        vat_amount: 120,
        vat_rate: 12,
        quotation_number: 'Q-001'
      }

      ;(addDoc as any).mockResolvedValue({ id: 'new-booking-id' })

      const result = await bookingService.createBooking(quotationData, 'user-1', 'comp-1', 'Test Project')

      expect(result).toBe('new-booking-id')
      expect(addDoc).toHaveBeenCalledWith(collection(db, 'booking'), expect.objectContaining({
        items: quotationData.items,
        quotation_id: quotationData.id,
        user_id: 'user-1',
        company_id: 'comp-1',
        project_name: 'Test Project'
      }))
    })

    it('should handle quotation without items', async () => {
      const quotationData = {
        id: 'quote-2',
        category_id: 'cat-1',
        client_company_id: 'comp-1',
        client_id: 'client-1',
        client_name: 'Test Client',
        client_company_name: 'Test Company',
        contract: 'contract-1',
        discount: 0,
        end_date: new Date('2024-01-31'),
        items: undefined,
        media_order: [],
        months: 1,
        other_fees: 0,
        payment_method: 'Manual Payment',
        product_owner: 'Test Owner',
        promos: {},
        requirements: [],
        seller_id: 'seller-1',
        start_date: new Date('2024-01-01'),
        total_cost: 0,
        type: 'RENTAL',
        vat_amount: 0,
        vat_rate: 12,
        quotation_number: 'Q-002'
      }

      ;(addDoc as any).mockResolvedValue({ id: 'booking-no-items' })

      const result = await bookingService.createBooking(quotationData, 'user-1', 'comp-1')

      expect(result).toBe('booking-no-items')
      expect(addDoc).toHaveBeenCalledWith(collection(db, 'booking'), expect.objectContaining({
        items: undefined,
        total_cost: 0
      }))
    })
  })

  describe('Data Field Validation', () => {
    it('should preserve items field through booking creation', async () => {
      const quotationData = {
        id: 'quote-test',
        category_id: 'cat-1',
        client_company_id: 'comp-1',
        client_id: 'client-1',
        client_name: 'Test Client',
        client_company_name: 'Test Company',
        contract: 'contract-1',
        discount: 0,
        end_date: new Date('2024-01-31'),
        items: [
          {
            id: 'item-1',
            name: 'LED Billboard',
            quantity: 2,
            price: 500,
            specs: { width: 10, height: 5 }
          },
          {
            id: 'item-2',
            name: 'Digital Signage',
            quantity: 1,
            price: 800,
            specs: { width: 5, height: 3 }
          }
        ],
        media_order: [],
        months: 1,
        other_fees: 0,
        payment_method: 'Manual Payment',
        product_owner: 'Test Owner',
        promos: {},
        requirements: [],
        seller_id: 'seller-1',
        start_date: new Date('2024-01-01'),
        total_cost: 1800,
        type: 'RENTAL',
        vat_amount: 216,
        vat_rate: 12,
        quotation_number: 'Q-TEST'
      }

      ;(addDoc as any).mockResolvedValue({ id: 'test-booking-id' })

      await bookingService.createBooking(quotationData, 'user-1', 'comp-1')

      expect(addDoc).toHaveBeenCalledWith(collection(db, 'booking'), expect.objectContaining({
        items: quotationData.items,
        total_cost: 1800
      }))
    })

    it('should handle bookings with empty items array', async () => {
      const quotationData = {
        id: 'quote-empty',
        category_id: 'cat-1',
        client_company_id: 'comp-1',
        client_id: 'client-1',
        client_name: 'Test Client',
        client_company_name: 'Test Company',
        contract: 'contract-1',
        discount: 0,
        end_date: new Date('2024-01-31'),
        items: [],
        media_order: [],
        months: 1,
        other_fees: 0,
        payment_method: 'Manual Payment',
        product_owner: 'Test Owner',
        promos: {},
        requirements: [],
        seller_id: 'seller-1',
        start_date: new Date('2024-01-01'),
        total_cost: 0,
        type: 'RENTAL',
        vat_amount: 0,
        vat_rate: 12,
        quotation_number: 'Q-EMPTY'
      }

      ;(addDoc as any).mockResolvedValue({ id: 'empty-booking-id' })

      await bookingService.createBooking(quotationData, 'user-1', 'comp-1')

      expect(addDoc).toHaveBeenCalledWith(collection(db, 'booking'), expect.objectContaining({
        items: [],
        total_cost: 0
      }))
    })

    it('should calculate total cost from items when available', async () => {
      const quotationData = {
        id: 'quote-calc',
        category_id: 'cat-1',
        client_company_id: 'comp-1',
        client_id: 'client-1',
        client_name: 'Test Client',
        client_company_name: 'Test Company',
        contract: 'contract-1',
        discount: 0,
        end_date: new Date('2024-01-31'),
        items: {
          product_id: 'prod-1',
          name: 'LED Billboard',
          price: 1200,
          duration_days: 30,
          item_total_amount: 1200
        },
        media_order: [],
        months: 1,
        other_fees: 0,
        payment_method: 'Manual Payment',
        product_owner: 'Test Owner',
        promos: {},
        requirements: [],
        seller_id: 'seller-1',
        start_date: new Date('2024-01-01'),
        total_cost: 1200,
        type: 'RENTAL',
        vat_amount: 144,
        vat_rate: 12,
        quotation_number: 'Q-CALC'
      }

      ;(addDoc as any).mockResolvedValue({ id: 'calc-booking-id' })

      await bookingService.createBooking(quotationData, 'user-1', 'comp-1')

      expect(addDoc).toHaveBeenCalledWith(collection(db, 'booking'), expect.objectContaining({
        items: quotationData.items,
        total_cost: 1200,
        costDetails: expect.objectContaining({
          total: 1200
        })
      }))
    })
  })

  describe('Error Handling', () => {
    it('should throw error when createBooking fails', async () => {
      const quotationData = {
        id: 'quote-error',
        category_id: 'cat-1',
        client_company_id: 'comp-1',
        client_id: 'client-1',
        client_name: 'Test Client',
        client_company_name: 'Test Company',
        items: []
      }

      ;(addDoc as any).mockRejectedValue(new Error('Firestore error'))

      await expect(bookingService.createBooking(quotationData, 'user-1', 'comp-1')).rejects.toThrow('Firestore error')
    })

    it('should throw error when getAllBookings fails', async () => {
      ;(getDocs as any).mockRejectedValue(new Error('Query failed'))

      await expect(getAllBookings()).rejects.toThrow('Query failed')
    })

    it('should throw error when getBookingById fails', async () => {
      ;(getDoc as any).mockRejectedValue(new Error('Document fetch failed'))

      await expect(bookingService.getBookingById('booking-1')).rejects.toThrow('Document fetch failed')
    })
  })
})