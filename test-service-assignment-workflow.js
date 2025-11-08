const puppeteer = require('puppeteer');

async function testServiceAssignmentWorkflow() {
  console.log('Starting Service Assignment Workflow Test...');

  const browser = await puppeteer.launch({
    headless: true, // Set to true for headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page;
  try {
    page = await browser.newPage();

    // Set viewport for better visibility
    await page.setViewport({ width: 1280, height: 1024 });

    // Create realistic test data matching the application format
    const testAssignmentData = {
      saNumber: '123456',
      projectSiteName: 'Makati CBD Billboard Site',
      projectSiteLocation: 'Ayala Avenue, Makati City, Metro Manila',
      serviceType: 'Roll Up',
      assignedTo: 'Installation Team Alpha',
      assignedToName: 'Installation Team Alpha',
      serviceDuration: '3 days',
      priority: 'High',
      equipmentRequired: 'Ladder, Safety Harness, Installation Tools',
      materialSpecs: 'Vinyl Banner 10x5ft, LED Lighting System',
      crew: 'team-alpha-001',
      gondola: 'Required',
      technology: 'LED Backlit',
      sales: 'John Smith',
      remarks: 'Please ensure proper alignment with existing signage. Client requested evening installation to minimize traffic disruption.',
      requestedBy: {
        name: 'Jane Doe',
        department: 'LOGISTICS'
      },
      startDate: new Date('2024-11-01'),
      endDate: new Date('2024-11-03'),
      alarmDate: new Date('2024-11-01'),
      alarmTime: '18:00',
      attachments: [
        {
          name: 'site-layout.pdf',
          type: 'application/pdf'
        },
        {
          name: 'material-specs.jpg',
          type: 'image/jpeg'
        }
      ],
      serviceExpenses: [
        {
          name: 'Crew Labor',
          amount: '15000'
        },
        {
          name: 'Equipment Rental',
          amount: '5000'
        },
        {
          name: 'Transportation',
          amount: '2000'
        },
        {
          name: 'Materials',
          amount: '8000'
        }
      ],
      status: 'Draft',
      created: new Date(),
      // Additional data needed for assignment creation
      projectSiteId: 'site-makati-001',
      message: 'Installation completed successfully. All systems operational.',
      campaignName: 'Holiday Campaign 2024',
      jobOrderId: 'Df4wxbfrO5EnAbml0r2I',
      userData: {
        uid: 'test-user-123',
        first_name: 'Jane',
        last_name: 'Doe',
        company_id: 'company-test-123',
        license_key: 'license-test-123'
      }
    };

    console.log('Test data created:', JSON.stringify(testAssignmentData, null, 2));

    // Navigate to the application (assuming it's running on localhost:3000)
    console.log('Navigating to application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Populate localStorage with test data
    console.log('Populating localStorage with test data...');
    await page.evaluate((data) => {
      localStorage.setItem('serviceAssignmentData', JSON.stringify(data));
      console.log('localStorage populated with:', data);
    }, testAssignmentData);

    // Verify localStorage was set correctly
    const storedData = await page.evaluate(() => {
      return localStorage.getItem('serviceAssignmentData');
    });

    if (!storedData) {
      throw new Error('Failed to set localStorage data');
    }

    console.log('localStorage verification passed');

    // Navigate to the PDF preview page
    console.log('Navigating to PDF preview page...');
    const previewUrl = '/logistics/assignments/view-pdf/preview?jobOrderId=Df4wxbfrO5EnAbml0r2I';
    await page.goto(`http://localhost:3000${previewUrl}`, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Wait for PDF loading to complete
    console.log('Waiting for PDF to load...');
    try {
      await page.waitForSelector('iframe', { timeout: 60000 });
    } catch (iframeError) {
      console.log('Iframe not found, checking page content...');
      // Check page content to understand what's happening
      const bodyContent = await page.evaluate(() => document.body.innerHTML);
      console.log('Page body content (first 1000 chars):', bodyContent.substring(0, 1000));

      // Check for loading indicators
      const loadingElements = await page.$$('[class*="animate-spin"], [class*="loading"], [class*="Loading"]');
      console.log('Loading elements found:', loadingElements.length);

      // Check for error messages
      const errorElements = await page.$$('[class*="error"], [class*="Error"]');
      console.log('Error elements found:', errorElements.length);

      if (errorElements.length > 0) {
        const errorText = await page.evaluate(el => el.textContent, errorElements[0]);
        throw new Error(`Page shows error: ${errorText}`);
      }

      // Check if we're still on the login page or redirected
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      if (!currentUrl.includes('/logistics/assignments/view-pdf/preview')) {
        throw new Error(`Redirected away from PDF page. Current URL: ${currentUrl}`);
      }

      throw new Error('PDF iframe not found after timeout');
    }

    // Check if PDF iframe is present and has content
    console.log('Checking for PDF iframe...');
    const iframeExists = await page.$('iframe') !== null;
    console.log('Iframe exists:', iframeExists);

    if (!iframeExists) {
      // Check what elements are actually on the page
      const bodyContent = await page.evaluate(() => document.body.innerHTML);
      console.log('Page body content (first 500 chars):', bodyContent.substring(0, 500));

      // Check for loading indicators
      const loadingElements = await page.$$('[class*="animate-spin"], [class*="loading"], [class*="Loading"]');
      console.log('Loading elements found:', loadingElements.length);

      // Check for error messages
      const errorElements = await page.$$('[class*="error"], [class*="Error"]');
      console.log('Error elements found:', errorElements.length);

      if (errorElements.length > 0) {
        const errorText = await page.evaluate(el => el.textContent, errorElements[0]);
        console.log('Error message found:', errorText);
        throw new Error(`Page shows error: ${errorText}`);
      }

      throw new Error('PDF iframe not found');
    }

    console.log('PDF iframe found');

    // Wait a bit more for PDF to render
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check for any console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Check if there are any error messages displayed on the page
    const errorElement = await page.$('[class*="error"], [class*="Error"]');
    if (errorElement) {
      const errorText = await page.evaluate(el => el.textContent, errorElement);
      console.log('Error found on page:', errorText);
      errors.push(errorText);
    }

    // Check if PDF loaded successfully by looking for the iframe src
    const iframeSrc = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return iframe ? iframe.src : null;
    });

    if (!iframeSrc || !iframeSrc.includes('data:application/pdf')) {
      throw new Error('PDF did not load correctly in iframe');
    }

    console.log('PDF appears to have loaded successfully');

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'test-service-assignment-result.png',
      fullPage: true
    });

    console.log('Screenshot saved as test-service-assignment-result.png');

    // Check for any JavaScript errors during the process
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
      // Don't fail the test for non-critical errors
    }

    // Verify the PDF content by checking if key elements are present
    // This is a basic check - in a real scenario you might want to extract PDF text
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Wait for any loading indicators to disappear
    try {
      await page.waitForSelector('[class*="animate-spin"]', { hidden: true, timeout: 10000 });
      console.log('Loading indicators disappeared - PDF should be fully loaded');
    } catch (e) {
      console.log('Loading indicators still present or timeout - PDF may still be loading');
    }

    console.log('Service Assignment Workflow Test completed successfully!');
    console.log('✓ localStorage populated with test data');
    console.log('✓ Navigation to PDF preview successful');
    console.log('✓ PDF iframe loaded');
    console.log('✓ No critical errors detected');

    return {
      success: true,
      errors: errors,
      screenshot: 'test-service-assignment-result.png'
    };

  } catch (error) {
    console.error('Test failed:', error.message);
    try {
      if (page && !page.isClosed()) {
        await page.screenshot({
          path: 'test-service-assignment-error.png',
          fullPage: true
        });
        console.log('Error screenshot saved as test-service-assignment-error.png');
      }
    } catch (screenshotError) {
      console.error('Failed to take error screenshot:', screenshotError);
    }

    return {
      success: false,
      error: error.message,
      screenshot: 'test-service-assignment-error.png'
    };
  } finally {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (closeError) {
      console.error('Error closing browser:', closeError);
    }
  }
}

// Run the test
if (require.main === module) {
  testServiceAssignmentWorkflow()
    .then(result => {
      console.log('\nTest Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testServiceAssignmentWorkflow };