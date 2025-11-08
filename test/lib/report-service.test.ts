import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { collection, query, where, orderBy, getDocs, addDoc } from 'firebase/firestore'
import { getReportsPerBooking, createReport, type ReportData } from '@/lib/report-service'
import { db } from '@/lib/firebase'

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({
      toDate: () => new Date(),
      seconds: 0,
      nanoseconds: 0,
    })),
    fromDate: vi.fn(),
  },
}))

describe('Report Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getReportsPerBooking', () => {
    it('should return all reports grouped by booking_id', async () => {
      const mockCompanyId = 'company123'

      // Mock reports data
      const mockReports = [
        {
          id: 'report1',
          booking_id: 'booking1',
          category: 'Installation',
          created: { toDate: () => new Date('2025-01-01'), seconds: 0, nanoseconds: 0 },
          attachments: [],
        },
        {
          id: 'report2',
          booking_id: 'booking1',
          category: 'Maintenance',
          created: { toDate: () => new Date('2025-01-02'), seconds: 0, nanoseconds: 0 },
          attachments: [],
        },
        {
          id: 'report3',
          booking_id: 'booking2',
          category: 'Installation',
          created: { toDate: () => new Date('2025-01-03'), seconds: 0, nanoseconds: 0 },
          attachments: [],
        },
      ]

      const mockQuerySnapshot = {
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
      }

      // Mock the Firebase calls
      const mockQuery = {}
      vi.mocked(collection).mockReturnValue('reports-collection' as any)
      vi.mocked(query).mockReturnValue(mockQuery as any)
      vi.mocked(where).mockReturnValue('where-clause' as any)
      vi.mocked(orderBy).mockReturnValue('order-clause' as any)
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any)

      const result = await getReportsPerBooking(mockCompanyId)

      // Verify the query was constructed correctly
      expect(collection).toHaveBeenCalledWith(db, 'reports')
      expect(where).toHaveBeenCalledWith('companyId', '==', mockCompanyId)
      expect(orderBy).toHaveBeenCalledWith('created', 'desc')

      // Verify the result structure
      expect(result).toHaveProperty('booking1')
      expect(result).toHaveProperty('booking2')
      expect(result.booking1).toHaveLength(2)
      expect(result.booking2).toHaveLength(1)

      // Verify reports are grouped correctly
      expect(result.booking1[0].id).toBe('report1')
      expect(result.booking1[1].id).toBe('report2')
      expect(result.booking2[0].id).toBe('report3')
    })

    it('should handle reports without booking_id', async () => {
      const mockCompanyId = 'company123'

      const mockReports = [
        {
          id: 'report1',
          booking_id: 'booking1',
          category: 'Installation',
          created: { toDate: () => new Date(), seconds: 0, nanoseconds: 0 },
          attachments: [],
        },
        {
          id: 'report2',
          // No booking_id
          category: 'Maintenance',
          created: { toDate: () => new Date(), seconds: 0, nanoseconds: 0 },
          attachments: [],
        },
      ]

      const mockQuerySnapshot = {
        docs: mockReports.map(report => ({
          id: report.id,
          data: () => report,
        })),
      }

      vi.mocked(collection).mockReturnValue('reports-collection' as any)
      vi.mocked(query).mockReturnValue({} as any)
      vi.mocked(where).mockReturnValue('where-clause' as any)
      vi.mocked(orderBy).mockReturnValue('order-clause' as any)
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any)

      const result = await getReportsPerBooking(mockCompanyId)

      // Should only include reports with booking_id
      expect(result).toHaveProperty('booking1')
      expect(Object.keys(result)).toHaveLength(1)
      expect(result.booking1).toHaveLength(1)
      expect(result.booking1[0].id).toBe('report1')
    })

    it('should handle empty results', async () => {
      const mockCompanyId = 'company123'

      const mockQuerySnapshot = {
        docs: [],
      }

      vi.mocked(collection).mockReturnValue('reports-collection' as any)
      vi.mocked(query).mockReturnValue({} as any)
      vi.mocked(where).mockReturnValue('where-clause' as any)
      vi.mocked(orderBy).mockReturnValue('order-clause' as any)
      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot as any)

      const result = await getReportsPerBooking(mockCompanyId)

      expect(result).toEqual({})
    })
  })

})