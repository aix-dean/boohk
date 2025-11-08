import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createReport,
  postReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
  getReportsByCompany,
  getReportsBySeller,
  getRecentReports,
  getReportsByStatus,
  getReportsByType,
  getReportsByProductId
} from '@/lib/report-service'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp
} from 'firebase/firestore'
import type { ReportData } from '@/lib/report-service'

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {}
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() }))
  }
}))

const mockCollection = collection as any
const mockAddDoc = addDoc as any
const mockGetDocs = getDocs as any
const mockDoc = doc as any
const mockGetDoc = getDoc as any
const mockUpdateDoc = updateDoc as any
const mockDeleteDoc = deleteDoc as any
const mockQuery = query as any
const mockWhere = where as any
const mockOrderBy = orderBy as any
const mockLimit = limit as any
const mockStartAfter = startAfter as any
const mockTimestamp = Timestamp as any

// Mock data
const mockReportData: ReportData = {
  siteId: 'site-1',
  siteName: 'Test Site',
  companyId: 'company-1',
  sellerId: 'seller-1',
  client: 'Test Client',
  clientId: 'client-1',
  joNumber: 'JO-001',
  joType: 'Installation',
  bookingDates: {
    start: { toDate: () => new Date() } as any,
    end: { toDate: () => new Date() } as any
  },
  breakdate: { toDate: () => new Date() } as any,
  sales: 'Test Sales',
  reportType: 'completion-report',
  date: '2024-01-01',
  attachments: [
    {
      note: 'Test attachment',
      fileName: 'test.jpg',
      fileType: 'image/jpeg',
      fileUrl: 'https://example.com/test.jpg'
    }
  ],
  status: 'draft',
  createdBy: 'user-1',
  createdByName: 'Test User',
  category: 'logistics',
  subcategory: 'installation',
  priority: 'medium',
  completionPercentage: 100,
  tags: ['completion-report'],
  reservation_number: 'RN-12345',
  booking_id: 'BK-67890'
}

describe('Report Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    mockCollection.mockReturnValue('mock-collection-ref')
    mockDoc.mockReturnValue('mock-doc-ref')
    mockAddDoc.mockResolvedValue({ id: 'new-report-id' })
    mockGetDocs.mockResolvedValue({
      docs: [{
        id: 'report-1',
        data: () => mockReportData
      }],
      empty: false
    })
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'report-1',
      data: () => mockReportData
    })
    mockUpdateDoc.mockResolvedValue(undefined)
    mockDeleteDoc.mockResolvedValue(undefined)
  })

  describe('createReport', () => {
    it('creates report with all required fields including new reservation_number and booking_id', async () => {
      const result = await createReport(mockReportData)

      expect(mockAddDoc).toHaveBeenCalledWith('mock-collection-ref', expect.objectContaining({
        report_id: expect.stringMatching(/^RP-\d+$/),
        siteId: 'site-1',
        siteName: 'Test Site',
        companyId: 'company-1',
        sellerId: 'seller-1',
        client: 'Test Client',
        clientId: 'client-1',
        joNumber: 'JO-001',
        joType: 'Installation',
        sales: 'Test Sales',
        reportType: 'completion-report',
        date: '2024-01-01',
        attachments: expect.any(Array),
        status: 'draft',
        createdBy: 'user-1',
        createdByName: 'Test User',
        category: 'logistics',
        subcategory: 'installation',
        priority: 'medium',
        completionPercentage: 100,
        tags: ['completion-report'],
        reservation_number: 'RN-12345',
        booking_id: 'BK-67890'
      }))

      expect(result).toBe('new-report-id')
    })

    it('generates unique report_id with RP- prefix', async () => {
      await createReport(mockReportData)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.report_id).toMatch(/^RP-\d+$/)
    })

    it('includes reservation_number when provided', async () => {
      await createReport(mockReportData)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.reservation_number).toBe('RN-12345')
    })

    it('includes booking_id when provided', async () => {
      await createReport(mockReportData)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.booking_id).toBe('BK-67890')
    })

    it('handles missing reservation_number gracefully', async () => {
      const reportWithoutReservation = { ...mockReportData, reservation_number: undefined }

      await createReport(reportWithoutReservation)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.reservation_number).toBeUndefined()
    })

    it('handles missing booking_id gracefully', async () => {
      const reportWithoutBookingId = { ...mockReportData, booking_id: undefined }

      await createReport(reportWithoutBookingId)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.booking_id).toBeUndefined()
    })

    it('processes attachments correctly', async () => {
      await createReport(mockReportData)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.attachments).toHaveLength(1)
      expect(callArgs.attachments[0]).toEqual({
        note: 'Test attachment',
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
        fileUrl: 'https://example.com/test.jpg'
      })
    })

    it('includes optional fields when provided', async () => {
      const reportWithOptionals = {
        ...mockReportData,
        siteCode: 'SITE-001',
        location: 'Test Location',
        assignedTo: 'Tech 1'
      }

      await createReport(reportWithOptionals)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.siteCode).toBe('SITE-001')
      expect(callArgs.location).toBe('Test Location')
      expect(callArgs.assignedTo).toBe('Tech 1')
    })

    it('includes installation-specific fields when provided', async () => {
      const installationReport = {
        ...mockReportData,
        reportType: 'installation-report',
        installationStatus: '50',
        installationTimeline: 'on-time',
        delayReason: 'Weather delay',
        delayDays: '2'
      }

      await createReport(installationReport)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.installationStatus).toBe('50')
      expect(callArgs.installationTimeline).toBe('on-time')
      expect(callArgs.delayReason).toBe('Weather delay')
      expect(callArgs.delayDays).toBe('2')
    })

    it('includes description of work for completion reports', async () => {
      const completionReport = {
        ...mockReportData,
        reportType: 'completion-report',
        descriptionOfWork: 'Completed installation successfully'
      }

      await createReport(completionReport)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.descriptionOfWork).toBe('Completed installation successfully')
    })
  })

  describe('postReport', () => {
    it('posts report with status set to posted', async () => {
      const result = await postReport(mockReportData)

      expect(mockAddDoc).toHaveBeenCalledWith('mock-collection-ref', expect.objectContaining({
        status: 'posted',
        reservation_number: 'RN-12345',
        booking_id: 'BK-67890'
      }))

      expect(result).toBe('new-report-id')
    })

    it('preserves reservation_number and booking_id when posting', async () => {
      await postReport(mockReportData)

      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.reservation_number).toBe('RN-12345')
      expect(callArgs.booking_id).toBe('BK-67890')
    })
  })

  describe('getReports', () => {
    it('fetches reports with default options', async () => {
      const result = await getReports({})

      expect(result.reports).toHaveLength(1)
      expect(result.reports[0]).toEqual({
        id: 'report-1',
        ...mockReportData
      })
    })

    it('applies company filter', async () => {
      await getReports({ companyId: 'company-1' })

      expect(mockWhere).toHaveBeenCalledWith('companyId', '==', 'company-1')
    })

    it('applies status filter', async () => {
      await getReports({ status: 'posted' })

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'posted')
    })

    it('applies report type filter', async () => {
      await getReports({ reportType: 'completion-report' })

      expect(mockWhere).toHaveBeenCalledWith('reportType', '==', 'completion-report')
    })

    it('handles search queries', async () => {
      const mockSearchResults = {
        docs: [{
          id: 'report-1',
          data: () => ({ ...mockReportData, siteName: 'Search Site' })
        }]
      }

      mockGetDocs.mockResolvedValue(mockSearchResults)

      const result = await getReports({ searchQuery: 'Search Site' })

      expect(result.reports).toHaveLength(1)
      expect(result.reports[0].siteName).toBe('Search Site')
    })

    it('returns reports with reservation_number and booking_id', async () => {
      const result = await getReports({})

      expect(result.reports[0].reservation_number).toBe('RN-12345')
      expect(result.reports[0].booking_id).toBe('BK-67890')
    })
  })

  describe('getReportById', () => {
    it('returns report when found', async () => {
      const result = await getReportById('report-1')

      expect(result).toEqual({
        id: 'report-1',
        ...mockReportData
      })
    })

    it('returns null when report not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
        data: () => null
      })

      const result = await getReportById('non-existent-report')

      expect(result).toBeNull()
    })

    it('includes reservation_number and booking_id in result', async () => {
      const result = await getReportById('report-1')

      expect(result?.reservation_number).toBe('RN-12345')
      expect(result?.booking_id).toBe('BK-67890')
    })
  })

  describe('updateReport', () => {
    it('updates report with new data', async () => {
      const updateData = {
        status: 'posted',
        reservation_number: 'RN-99999',
        booking_id: 'BK-88888'
      }

      await updateReport('report-1', updateData)

      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
        status: 'posted',
        reservation_number: 'RN-99999',
        booking_id: 'BK-88888',
        updated: expect.any(Object)
      }))
    })

    it('handles attachment updates', async () => {
      const updateData = {
        attachments: [
          {
            note: 'Updated attachment',
            fileName: 'updated.jpg',
            fileType: 'image/jpeg',
            fileUrl: 'https://example.com/updated.jpg'
          }
        ]
      }

      await updateReport('report-1', updateData)

      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
        attachments: expect.any(Array)
      }))
    })

    it('includes description of work updates', async () => {
      const updateData = {
        descriptionOfWork: 'Updated work description'
      }

      await updateReport('report-1', updateData)

      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
        descriptionOfWork: 'Updated work description'
      }))
    })
  })

  describe('deleteReport', () => {
    it('deletes report successfully', async () => {
      await deleteReport('report-1')

      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref')
    })
  })

  describe('getReportsByCompany', () => {
    it('fetches reports by company ID', async () => {
      const result = await getReportsByCompany('company-1')

      expect(result).toHaveLength(1)
      expect(result[0].companyId).toBe('company-1')
    })

    it('includes reservation_number and booking_id in results', async () => {
      const result = await getReportsByCompany('company-1')

      expect(result[0].reservation_number).toBe('RN-12345')
      expect(result[0].booking_id).toBe('BK-67890')
    })
  })

  describe('getReportsBySeller', () => {
    it('fetches reports by seller ID', async () => {
      const result = await getReportsBySeller('seller-1')

      expect(result).toHaveLength(1)
      expect(result[0].sellerId).toBe('seller-1')
    })
  })

  describe('getRecentReports', () => {
    it('fetches recent reports with default limit', async () => {
      const result = await getRecentReports()

      expect(result).toHaveLength(1)
      expect(mockLimit).toHaveBeenCalledWith(10)
    })

    it('fetches recent reports with custom limit', async () => {
      await getRecentReports(5)

      expect(mockLimit).toHaveBeenCalledWith(5)
    })
  })

  describe('getReportsByStatus', () => {
    it('fetches reports by status', async () => {
      const result = await getReportsByStatus('posted')

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('draft') // Mock data has draft status
    })
  })

  describe('getReportsByType', () => {
    it('fetches reports by type', async () => {
      const result = await getReportsByType('completion-report')

      expect(result).toHaveLength(1)
      expect(result[0].reportType).toBe('completion-report')
    })
  })

  describe('getReportsByProductId', () => {
    it('fetches reports by product ID', async () => {
      const result = await getReportsByProductId('product-1')

      expect(result.reports).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('Data Field Validation', () => {
    it('preserves reservation_number through all operations', async () => {
      // Test create
      await createReport(mockReportData)
      let callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.reservation_number).toBe('RN-12345')

      // Test get
      const result = await getReportById('report-1')
      expect(result?.reservation_number).toBe('RN-12345')

      // Test update
      await updateReport('report-1', { reservation_number: 'RN-UPDATED' })
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
        reservation_number: 'RN-UPDATED'
      }))
    })

    it('preserves booking_id through all operations', async () => {
      // Test create
      await createReport(mockReportData)
      let callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.booking_id).toBe('BK-67890')

      // Test get
      const result = await getReportById('report-1')
      expect(result?.booking_id).toBe('BK-67890')

      // Test update
      await updateReport('report-1', { booking_id: 'BK-UPDATED' })
      expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
        booking_id: 'BK-UPDATED'
      }))
    })

    it('handles reports without reservation_number', async () => {
      const reportWithoutReservation = { ...mockReportData, reservation_number: undefined }

      await createReport(reportWithoutReservation)
      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.reservation_number).toBeUndefined()
    })

    it('handles reports without booking_id', async () => {
      const reportWithoutBookingId = { ...mockReportData, booking_id: undefined }

      await createReport(reportWithoutBookingId)
      const callArgs = mockAddDoc.mock.calls[0][1]
      expect(callArgs.booking_id).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('throws error when createReport fails', async () => {
      mockAddDoc.mockRejectedValue(new Error('Firestore error'))

      await expect(createReport(mockReportData)).rejects.toThrow('Firestore error')
    })

    it('throws error when getReportById fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Document fetch failed'))

      await expect(getReportById('report-1')).rejects.toThrow('Document fetch failed')
    })

    it('throws error when updateReport fails', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Update failed'))

      await expect(updateReport('report-1', { status: 'posted' })).rejects.toThrow('Update failed')
    })

    it('throws error when deleteReport fails', async () => {
      mockDeleteDoc.mockRejectedValue(new Error('Delete failed'))

      await expect(deleteReport('report-1')).rejects.toThrow('Delete failed')
    })
  })
})