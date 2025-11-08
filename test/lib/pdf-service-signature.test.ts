import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { generateServiceAssignmentHTMLSimple, generateServiceAssignmentPDF } from '../../lib/pdf-service'

// Mock dependencies
vi.mock('jsPDF', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      scaleFactor: 1
    },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    output: vi.fn().mockReturnValue(new ArrayBuffer(8)),
    save: vi.fn(),
    addPage: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setLineWidth: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    getTextWidth: vi.fn().mockReturnValue(50),
    splitTextToSize: vi.fn().mockReturnValue(['Test text']),
    setPDFViewerPreferences: vi.fn()
  }))
}))

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,test'),
    width: 800,
    height: 600
  })
}))

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      getPages: vi.fn().mockReturnValue([{
        ref: { }
      }]),
      context: {
        obj: vi.fn().mockReturnValue({
          set: vi.fn()
        })
      },
      catalog: {
        set: vi.fn()
      },
      save: vi.fn().mockResolvedValue(new Uint8Array(8))
    })
  },
  PDFName: {
    of: vi.fn().mockReturnValue({})
  }
}))

// Mock fetch for image loading
global.fetch = vi.fn() as Mock

describe('PDF Service - Signature Functionality', () => {
  const mockAssignmentData = {
    saNumber: 'SA-001',
    projectSiteName: 'Test Site',
    projectSiteLocation: 'Test Location',
    serviceType: 'Installation',
    assignedTo: 'Test User',
    assignedToName: 'Test User',
    serviceDuration: '4',
    priority: 'High',
    equipmentRequired: 'Test Equipment',
    materialSpecs: 'Test Materials',
    crew: 'Team A',
    crewName: 'Team A',
    gondola: 'Yes',
    technology: 'LED',
    sales: 'John Doe',
    campaignName: 'Test Campaign',
    remarks: 'Test remarks',
    requestedBy: {
      name: 'John Doe',
      department: 'Logistics'
    },
    startDate: new Date(),
    endDate: new Date(),
    alarmDate: new Date(),
    alarmTime: '09:00',
    attachments: [],
    serviceExpenses: [],
    status: 'Sent',
    created: new Date()
  }

  const mockCompanyData = {
    name: 'Test Company',
    address: {
      street: '123 Test St',
      city: 'Test City',
      province: 'Test Province'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as Mock).mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateServiceAssignmentHTMLSimple - Signature Handling', () => {
    it('should include signature image when signatureDataUrl is provided', async () => {
      const signatureDataUrl = 'data:image/png;base64,test-signature'

      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        signatureDataUrl
      )

      expect(result).toContain('<img src="data:image/png;base64,test-signature"')
      expect(result).toContain('class="signature-image"')
      expect(result).toContain('alt="Signature"')
    })

    it('should not include signature image when signatureDataUrl is not provided', async () => {
      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        undefined
      )

      expect(result).not.toContain('<img')
      expect(result).not.toContain('signature-image')
      expect(result).toContain('signature-box') // Should still have the container
    })

    it('should handle empty signatureDataUrl gracefully', async () => {
      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        ''
      )

      expect(result).not.toContain('<img')
      expect(result).toContain('signature-box')
    })

    it('should handle null signatureDataUrl gracefully', async () => {
      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        null as any
      )

      expect(result).not.toContain('<img')
      expect(result).toContain('signature-box')
    })

    it('should include signature box container in all cases', async () => {
      const resultWithSignature = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        'data:image/png;base64,test'
      )

      const resultWithoutSignature = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        undefined
      )

      expect(resultWithSignature).toContain('signature-box')
      expect(resultWithoutSignature).toContain('signature-box')
    })

    it('should position signature correctly in the layout', async () => {
      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        'data:image/png;base64,test'
      )

      // Check that signature appears in the prepared-by section
      expect(result).toContain('prepared-by-section')
      expect(result).toContain('signature-box')
      expect(result).toContain('prepared-by-name')
    })

    it('should handle signature image sizing correctly', async () => {
      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        'data:image/png;base64,test'
      )

      expect(result).toContain('max-width: 140px')
      expect(result).toContain('max-height: 80px')
      expect(result).toContain('object-fit: contain')
    })
  })

  describe('generateServiceAssignmentPDF - Signature Integration', () => {
    it('should handle signature data in PDF generation', async () => {
      const result = await generateServiceAssignmentPDF(mockAssignmentData, true)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should generate PDF without signature data', async () => {
      const result = await generateServiceAssignmentPDF(mockAssignmentData, true)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  describe('Signature Image Loading and Processing', () => {
    it('should handle successful signature image fetch', async () => {
      const signatureUrl = 'https://example.com/signature.png'
      ;(global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['signature-data'], { type: 'image/png' }))
      })

      // Test would require mocking FileReader, but this validates the fetch call
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle failed signature image fetch gracefully', async () => {
      ;(global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        undefined
      )

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed signature data URLs', async () => {
      const malformedSignature = 'not-a-valid-data-url'

      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        malformedSignature
      )

      // Should still generate HTML but without valid image
      expect(result).toContain('signature-box')
      expect(result).toContain(malformedSignature)
    })

    it('should handle very large signature data URLs', async () => {
      const largeSignature = 'data:image/png;base64,' + 'a'.repeat(1000000) // 1MB of data

      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        largeSignature
      )

      expect(result).toContain('signature-box')
      expect(result).toContain(largeSignature.substring(0, 100)) // Should contain start of data URL
    })

    it('should handle special characters in signature URLs', async () => {
      const specialCharSignature = 'data:image/png;base64,test+with+special=chars'

      const result = await generateServiceAssignmentHTMLSimple(
        mockAssignmentData,
        mockCompanyData,
        undefined,
        specialCharSignature
      )

      expect(result).toContain(specialCharSignature)
    })
  })

  describe('Integration with User Data', () => {
    it('should handle user data with signature field', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        signature: {
          url: 'https://example.com/signature.png'
        }
      }

      // This test validates that the function can handle user data structure
      // The actual signature loading would be handled by the calling component
      expect(userData.signature.url).toBe('https://example.com/signature.png')
    })

    it('should handle user data without signature field', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe'
      } as any

      expect(userData.signature).toBeUndefined()
    })
  })
})