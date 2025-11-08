import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/quotations/send-email/route'

// Test with the actual import
describe('Quotation Email API - With Import', () => {
  it('should have basic test structure', () => {
    expect(true).toBe(true)
  })

  it('should be able to create NextRequest', () => {
    const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' }),
      headers: {
        'content-type': 'application/json'
      }
    })
    expect(request).toBeDefined()
  })

  it('should be able to call POST function', async () => {
    const request = new NextRequest('http://localhost:3000/api/quotations/send-email', {
      method: 'POST',
      body: JSON.stringify({
        quotation: { id: 'test-id', items: [{ name: 'Test' }] },
        clientEmail: 'test@example.com',
        userData: { company_id: 'test-company' }
      }),
      headers: {
        'content-type': 'application/json'
      }
    })

    // This should at least not throw an error during the call
    const response = await POST(request)
    expect(response).toBeDefined()
  })
})