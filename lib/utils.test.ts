import { describe, it, expect } from 'vitest'
import { cn, formatDate, generateLicenseKey, getProjectCompliance } from './utils'

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
    expect(cn('class1', undefined, 'class2')).toBe('class1 class2')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500') // tailwind merge
  })
})

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2023-10-14')
    expect(formatDate(date)).toBe('Oct 14, 2023')
  })
})

describe('generateLicenseKey', () => {
  it('should generate a license key with correct format', () => {
    const key = generateLicenseKey()
    expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })
})

describe('getProjectCompliance', () => {
  it('should return correct compliance structure', () => {
    const quotation = {
      projectCompliance: {
        signedContract: { fileUrl: 'url1', fileName: 'contract.pdf' },
        irrevocablePo: { fileUrl: 'url2', fileName: 'po.pdf' },
        paymentAsDeposit: { fileUrl: 'url3', fileName: 'deposit.pdf' },
        finalArtwork: { fileUrl: 'url4', fileName: 'artwork.pdf' },
        signedQuotation: { fileUrl: 'url5', fileName: 'quote.pdf' },
      },
    }

    const result = getProjectCompliance(quotation)

    expect(result.completed).toBe(5)
    expect(result.total).toBe(5)
    expect(result.toReserve).toHaveLength(3)
    expect(result.otherRequirements).toHaveLength(2)
  })

  it('should handle missing compliance data', () => {
    const quotation = {}
    const result = getProjectCompliance(quotation)

    expect(result.completed).toBe(0)
    expect(result.total).toBe(5)
  })
})