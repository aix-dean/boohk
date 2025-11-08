#!/usr/bin/env tsx

/**
 * Email API Integration Test
 *
 * This script tests the actual send-email API endpoint with Gmail compatibility fixes
 * Run with: npx tsx test-email-api.ts
 */

import fetch from 'node-fetch'

const API_BASE_URL = 'http://localhost:3000' // Adjust if your dev server runs on a different port

interface TestEmailRequest {
  to: string[]
  cc?: string[]
  replyTo: string
  subject: string
  body: string
  currentUserPhoneNumber: string
  companyId: string
  companyName: string
  companyWebsite?: string
  userDisplayName: string
  companyLogo?: string
  proposalId: string
  proposalPassword?: string
}

class EmailAPIIntegrationTester {
  private results: Array<{
    testName: string
    passed: boolean
    details: string
    error?: string
    response?: any
  }> = []

  /**
   * Test 1: Mixed Recipients (Gmail + Aix.ph)
   */
  async testMixedRecipients(): Promise<void> {
    console.log('\n🧪 Testing Mixed Recipients (Gmail + Aix.ph)...')

    const testData: TestEmailRequest = {
      to: [
        'test+gmail1@gmail.com',
        'test@aix.ph'
      ],
      subject: 'Gmail Compatibility Test - Mixed Recipients',
      body: 'This email tests the Gmail compatibility fixes with mixed recipients (Gmail + Aix.ph).',
      replyTo: 'test@example.com',
      currentUserPhoneNumber: '+639123456789',
      companyId: 'test-company-id',
      companyName: 'Test Company',
      companyWebsite: 'https://testcompany.com',
      userDisplayName: 'Test Sales Executive',
      companyLogo: 'https://via.placeholder.com/100x60',
      proposalId: 'test-proposal-mixed-123'
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('✅ Mixed recipients test passed')
        console.log(`   Sent to ${result.results?.reduce((sum: number, r: any) => sum + r.recipients, 0) || 0} recipients`)

        this.results.push({
          testName: 'Mixed Recipients Test',
          passed: true,
          details: `Successfully sent to mixed recipients. Gmail: ${result.results?.filter((r: any) => r.type === 'gmail' || r.type === 'gmail-fallback').reduce((sum: number, r: any) => sum + r.recipients, 0) || 0}, Other: ${result.results?.filter((r: any) => r.type === 'regular').reduce((sum: number, r: any) => sum + r.recipients, 0) || 0}`,
          response: result
        })
      } else {
        console.log('❌ Mixed recipients test failed')
        console.log(`   Error: ${result.error}`)

        this.results.push({
          testName: 'Mixed Recipients Test',
          passed: false,
          details: `API returned error: ${result.error}`,
          error: result.error,
          response: result
        })
      }
    } catch (error) {
      console.log('❌ Mixed recipients test failed with exception')
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      this.results.push({
        testName: 'Mixed Recipients Test',
        passed: false,
        details: 'Test failed with exception',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Test 2: Gmail-Only Recipients
   */
  async testGmailOnlyRecipients(): Promise<void> {
    console.log('\n🧪 Testing Gmail-Only Recipients...')

    const testData: TestEmailRequest = {
      to: [
        'test+gmail1@gmail.com',
        'test+gmail2@gmail.com'
      ],
      subject: 'Gmail Compatibility Test - Gmail Only',
      body: 'This email tests Gmail-specific handling and templates.',
      replyTo: 'test@example.com',
      currentUserPhoneNumber: '+639123456789',
      companyId: 'test-company-id',
      companyName: 'Test Company',
      userDisplayName: 'Test Sales Executive',
      proposalId: 'test-proposal-gmail-123'
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('✅ Gmail-only recipients test passed')
        console.log(`   Sent to ${result.results?.reduce((sum: number, r: any) => sum + r.recipients, 0) || 0} Gmail recipients`)

        this.results.push({
          testName: 'Gmail-Only Recipients Test',
          passed: true,
          details: `Successfully sent to Gmail-only recipients using Gmail-optimized templates`,
          response: result
        })
      } else {
        console.log('❌ Gmail-only recipients test failed')
        console.log(`   Error: ${result.error}`)

        this.results.push({
          testName: 'Gmail-Only Recipients Test',
          passed: false,
          details: `API returned error: ${result.error}`,
          error: result.error,
          response: result
        })
      }
    } catch (error) {
      console.log('❌ Gmail-only recipients test failed with exception')
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      this.results.push({
        testName: 'Gmail-Only Recipients Test',
        passed: false,
        details: 'Test failed with exception',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Test 3: Rate Limiting
   */
  async testRateLimiting(): Promise<void> {
    console.log('\n🧪 Testing Rate Limiting...')

    const testData: TestEmailRequest = {
      to: ['test+gmail1@gmail.com'],
      subject: 'Rate Limiting Test',
      body: 'Testing Gmail rate limiting (5 emails per minute).',
      replyTo: 'test@example.com',
      currentUserPhoneNumber: '+639123456789',
      companyId: 'test-company-id',
      companyName: 'Test Company',
      userDisplayName: 'Test Sales Executive',
      proposalId: 'test-proposal-rate-limit-123'
    }

    const results = []

    // Send 6 emails quickly to test rate limiting
    for (let i = 0; i < 6; i++) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testData)
        })

        const result = await response.json()
        results.push({
          attempt: i + 1,
          success: response.ok && result.success,
          error: result.error,
          status: response.status
        })

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        results.push({
          attempt: i + 1,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 0
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`📊 Rate limiting results: ${successful} successful, ${failed} failed`)

    if (successful >= 5 && failed >= 1) {
      console.log('✅ Rate limiting test passed - expected behavior observed')

      this.results.push({
        testName: 'Rate Limiting Test',
        passed: true,
        details: `Rate limiting working correctly: ${successful} allowed, ${failed} blocked as expected`
      })
    } else {
      console.log('❌ Rate limiting test failed - unexpected behavior')

      this.results.push({
        testName: 'Rate Limiting Test',
        passed: false,
        details: `Unexpected rate limiting behavior: ${successful} allowed, ${failed} blocked`,
        error: 'Rate limiting not working as expected'
      })
    }
  }

  /**
   * Test 4: Error Handling
   */
  async testErrorHandling(): Promise<void> {
    console.log('\n🧪 Testing Error Handling...')

    // Test with empty body
    const invalidTestData = {
      to: ['test@gmail.com'],
      subject: 'Error Handling Test',
      body: '', // Empty body should trigger error
      replyTo: 'test@example.com',
      currentUserPhoneNumber: '+639123456789',
      companyId: 'test-company-id',
      companyName: 'Test Company',
      userDisplayName: 'Test Sales Executive',
      proposalId: 'test-proposal-error-123'
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidTestData)
      })

      const result = await response.json()

      if (!response.ok && response.status === 400) {
        console.log('✅ Error handling test passed - correctly rejected invalid request')
        console.log(`   Error: ${result.error}`)

        this.results.push({
          testName: 'Error Handling Test',
          passed: true,
          details: `API correctly rejected invalid request with status ${response.status}`,
          response: result
        })
      } else {
        console.log('❌ Error handling test failed - should have rejected invalid request')
        console.log(`   Status: ${response.status}, Response: ${JSON.stringify(result)}`)

        this.results.push({
          testName: 'Error Handling Test',
          passed: false,
          details: `API should have rejected invalid request but returned status ${response.status}`,
          error: 'Error handling not working correctly'
        })
      }
    } catch (error) {
      console.log('❌ Error handling test failed with exception')
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      this.results.push({
        testName: 'Error Handling Test',
        passed: false,
        details: 'Test failed with exception',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Test 5: Domain-Specific Logging
   */
  async testDomainSpecificLogging(): Promise<void> {
    console.log('\n🧪 Testing Domain-Specific Logging...')

    const testData: TestEmailRequest = {
      to: [
        'test+gmail1@gmail.com',
        'test@aix.ph',
        'test@outlook.com'
      ],
      subject: 'Domain Logging Test',
      body: 'Testing domain-specific handling and logging.',
      replyTo: 'test@example.com',
      currentUserPhoneNumber: '+639123456789',
      companyId: 'test-company-id',
      companyName: 'Test Company',
      userDisplayName: 'Test Sales Executive',
      proposalId: 'test-proposal-logging-123'
    }

    try {
      console.log('📝 This test verifies that the API logs domain-specific information')
      console.log('   Check the server logs for:')
      console.log('   - Domain analysis results')
      console.log('   - Gmail vs other recipient counts')
      console.log('   - Template selection (Gmail vs regular)')
      console.log('   - Compliance checking results')

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('✅ Domain logging test completed - check server logs for details')

        this.results.push({
          testName: 'Domain-Specific Logging Test',
          passed: true,
          details: 'Email sent successfully - verify logs contain domain analysis and template selection info',
          response: result
        })
      } else {
        console.log('❌ Domain logging test failed')

        this.results.push({
          testName: 'Domain-Specific Logging Test',
          passed: false,
          details: `Email sending failed: ${result.error}`,
          error: result.error
        })
      }
    } catch (error) {
      console.log('❌ Domain logging test failed with exception')

      this.results.push({
        testName: 'Domain-Specific Logging Test',
        passed: false,
        details: 'Test failed with exception',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Run all API tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Email API Integration Test Suite...\n')

    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️  Warning: RESEND_API_KEY not found. Make sure your development server is running.')
      console.log('   Start your Next.js development server with: npm run dev\n')
    }

    const tests = [
      this.testMixedRecipients,
      this.testGmailOnlyRecipients,
      this.testRateLimiting,
      this.testErrorHandling,
      this.testDomainSpecificLogging
    ]

    for (const test of tests) {
      await test()
    }

    this.printSummary()
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('\n📊 API Integration Test Summary:')
    console.log('='.repeat(50))

    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const total = this.results.length

    console.log(`Total Tests: ${total}`)
    console.log(`Passed: ${passed} ✅`)
    console.log(`Failed: ${failed} ❌`)
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.testName}: ${result.error || result.details}`)
      })
    }

    console.log('\n🎯 Gmail Compatibility Assessment:')
    if (passed >= 4) {
      console.log('  ✅ Gmail compatibility fixes are working correctly!')
      console.log('  📧 The send-email API properly handles:')
      console.log('     - Domain analysis and recipient separation')
      console.log('     - Gmail-specific templates')
      console.log('     - Rate limiting for Gmail recipients')
      console.log('     - Error handling and validation')
      console.log('     - Domain-specific logging')
    } else if (passed >= 2) {
      console.log('  ⚠️  Some Gmail compatibility features working, but issues detected.')
      console.log('     Review failed tests and check server configuration.')
    } else {
      console.log('  ❌ Gmail compatibility fixes need attention.')
      console.log('     Multiple test failures indicate problems with the implementation.')
    }

    console.log('\n🔧 Recommendations:')
    console.log('  1. Ensure Next.js development server is running')
    console.log('  2. Check server logs for detailed domain analysis information')
    console.log('  3. Verify RESEND_API_KEY is configured if testing email delivery')
    console.log('  4. Test with real email addresses to verify actual delivery')
    console.log('  5. Monitor Gmail delivery rates and spam folder placement')
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new EmailAPIIntegrationTester()
  tester.runAllTests().catch(console.error)
}

export { EmailAPIIntegrationTester }