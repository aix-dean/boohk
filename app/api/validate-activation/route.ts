import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const response = await fetch('https://ohplus-activation-key-validator-272363630855.asia-southeast2.run.app/validate-activation-key', {
      method: 'POST',
      body: formData
    })

    const result = await response.json()

    // Log the full Success Response (200 OK) of file validation API
    console.log('OHPlus Activation Key Validator API Full Success Response (200 OK):', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data: result
    })

    console.log('Validation result:', result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error validating activation key:', error)
    return NextResponse.json({ success: false, error: 'Failed to validate activation key' }, { status: 500 })
  }
}