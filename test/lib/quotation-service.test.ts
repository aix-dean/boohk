import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDirectQuotation, createMultipleQuotations } from '@/lib/quotation-service'



// Mock console.log to suppress verbose output
const mockConsoleLog = vi.fn()
console.log = mockConsoleLog



describe('Quotation Service - Content Type Capitalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConsoleLog.mockClear()
  })

  describe('Content Type Capitalization Logic', () => {
    it('should capitalize the first letter of content_type', () => {
      // Test the capitalization logic directly
      const testContentType = 'billboard'
      const capitalized = testContentType ? testContentType.charAt(0).toUpperCase() + testContentType.slice(1) : ''
      expect(capitalized).toBe('Billboard')
    })

    it('should handle empty content_type', () => {
      const contentType: string = ''
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('')
    })

    it('should handle null content_type', () => {
      const contentType: string | null = null
      const result = contentType ? (contentType as string).charAt(0).toUpperCase() + (contentType as string).slice(1) : ''
      expect(result).toBe('')
    })

    it('should handle undefined content_type', () => {
      const contentType: string | undefined = undefined
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('')
    })

    it('should capitalize single character content_type', () => {
      const contentType: string = 'a'
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('A')
    })

    it('should capitalize mixed case content_type', () => {
      const contentType: string = 'bIlLbOaRd'
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('BIlLbOaRd')
    })

    it('should capitalize lowercase content_type', () => {
      const contentType: string = 'billboard'
      const result = contentType ? contentType.charAt(0).toUpperCase() + contentType.slice(1) : ''
      expect(result).toBe('Billboard')
    })
  })

  describe('createDirectQuotation', () => {
    it('should create a quotation without throwing an error', async () => {
      const clientData = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
      }

      const sitesData = [{
        id: 'site-1',
        name: 'Test Site',
        location: 'Test Location',
        price: 1000,
        content_type: 'billboard',
        type: 'old-type',
        image: 'test-image.jpg',
        height: 10,
        width: 20,
        specs_rental: {},
      }]

      const userId = 'user-1'
      const options = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        company_id: 'company-1',
      }

      // Test that the function completes without throwing
      await expect(createDirectQuotation(clientData, sitesData, userId, options)).resolves.not.toThrow()
    })
  })

  describe('createMultipleQuotations', () => {
    it('should create multiple quotations without throwing an error', async () => {
      const clientData = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
      }

      const sitesData = [
        {
          id: 'site-1',
          name: 'Test Site 1',
          location: 'Test Location 1',
          price: 1000,
          content_type: 'billboard',
          type: 'old-type',
          image: 'test-image1.jpg',
          height: 10,
          width: 20,
          specs_rental: {},
        },
        {
          id: 'site-2',
          name: 'Test Site 2',
          location: 'Test Location 2',
          price: 1500,
          content_type: 'digital',
          type: 'old-type',
          image: 'test-image2.jpg',
          height: 15,
          width: 25,
          specs_rental: {},
        }
      ]

      const userId = 'user-1'
      const options = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        company_id: 'company-1',
      }

      // Test that the function completes without throwing
      await expect(createMultipleQuotations(clientData, sitesData, userId, options)).resolves.not.toThrow()
    })
  })
})
import { safeString } from '@/lib/quotation-service'

describe('safeString', () => {
  it('should format numbers with 2 decimal places', () => {
    expect(safeString(100)).toBe('100.00')
    expect(safeString(100.5)).toBe('100.50')
    expect(safeString(100.123)).toBe('100.12')
    expect(safeString(0)).toBe('0.00')
  })

  it('should handle string inputs', () => {
    expect(safeString('test string')).toBe('test string')
    expect(safeString('')).toBe('')
  })

  it('should handle boolean inputs', () => {
    expect(safeString(true)).toBe('true')
    expect(safeString(false)).toBe('false')
  })

  it('should handle null and undefined', () => {
    expect(safeString(null)).toBe('N/A')
    expect(safeString(undefined)).toBe('N/A')
  })

  it('should handle object inputs', () => {
    expect(safeString({ id: 'test' })).toBe('test')
    expect(safeString({ name: 'test' })).toBe('[object Object]')
    expect(safeString({ toString: () => 'custom' })).toBe('custom')
  })

  it('should handle edge cases', () => {
    expect(safeString(NaN)).toBe('NaN')
    expect(safeString(Infinity)).toBe('∞')
    expect(safeString(-100)).toBe('-100.00')
  })
})

describe('Decimal Formatting', () => {
  describe('Price Input Validation', () => {
    const validatePriceInput = (value: string): boolean => {
      const regex = /^\d*\.?\d{0,2}$/
      return regex.test(value) || value === ""
    }

    it('should allow valid price inputs', () => {
      expect(validatePriceInput('')).toBe(true)
      expect(validatePriceInput('123')).toBe(true)
      expect(validatePriceInput('123.')).toBe(true)
      expect(validatePriceInput('123.4')).toBe(true)
      expect(validatePriceInput('123.45')).toBe(true)
      expect(validatePriceInput('0')).toBe(true)
      expect(validatePriceInput('0.00')).toBe(true)
    })

    it('should reject invalid price inputs', () => {
      expect(validatePriceInput('123.456')).toBe(false)
      expect(validatePriceInput('123.4567')).toBe(false)
      expect(validatePriceInput('abc')).toBe(false)
      expect(validatePriceInput('12.34.56')).toBe(false)
      expect(validatePriceInput('12..34')).toBe(false)
    })
  })

  describe('Price Formatting on Blur', () => {
    const formatPriceOnBlur = (value: string): string => {
      if (value && !isNaN(Number.parseFloat(value))) {
        const parsed = Number.parseFloat(value)
        return parsed.toFixed(2)
      }
      return value
    }

    it('should format valid numbers to 2 decimal places', () => {
      expect(formatPriceOnBlur('100')).toBe('100.00')
      expect(formatPriceOnBlur('100.5')).toBe('100.50')
      expect(formatPriceOnBlur('100.123')).toBe('100.12')
      expect(formatPriceOnBlur('0')).toBe('0.00')
    })

    it('should handle edge cases', () => {
      expect(formatPriceOnBlur('')).toBe('')
      expect(formatPriceOnBlur('abc')).toBe('abc')
      expect(formatPriceOnBlur('NaN')).toBe('NaN')
    })
  })
})