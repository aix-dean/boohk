const puppeteer = require('puppeteer-core');

async function testServiceAssignmentPDFFlow() {
  let browser;
  try {
    console.log('Launching browser for service assignment PDF flow test...');
    browser = await puppeteer.launch({
      headless: false, // Set to false to see the test in action
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    console.log('Navigating to the login page first...');
    await page.goto('http://localhost:3000/login', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Waiting for login page to load...');
    await page.waitForSelector('h1', { timeout: 30000 });

    // Step 1: Login with test credentials
    console.log('Step 1: Attempting login...');

    const testEmail = process.env.TEST_USER_EMAIL || 'admin@test.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'password123';

    console.log('Attempting login with test credentials...');

    // Fill in email and password
    await page.waitForSelector('input[id="username"]', { timeout: 10000 });
    await page.type('input[id="username"]', testEmail);

    await page.waitForSelector('input[id="password"]', { timeout: 10000 });
    await page.type('input[id="password"]', testPassword);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for either successful login or error
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if login was successful
    const currentUrl = page.url();
    console.log('Current URL after login attempt:', currentUrl);

    let loginSuccessful = false;
    if (!currentUrl.includes('/login')) {
      loginSuccessful = true;
      console.log('Login successful, proceeding to test page...');
    } else {
      console.log('Login failed or requires additional setup, continuing test anyway...');
    }

    // Step 2: Navigate to Create Service Assignment page
    console.log('Step 2: Navigating to the Create Service Assignment page...');
    await page.goto('http://localhost:3000/logistics/assignments/create', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Check if redirected back to login
    const currentUrlAfterNavigation = page.url();
    if (currentUrlAfterNavigation.includes('/login')) {
      console.log('Authentication required - redirected back to login page');
      console.log('This indicates the page requires authentication to access');

      // For testing purposes, we'll continue and note this in the report
      console.log('Continuing test to assess the flow structure...');
    }

    // Step 3: Verify page loaded
    console.log('Step 3: Verifying page load...');
    let pageTitle = null;
    try {
      pageTitle = await page.$eval('h1', el => el.textContent);
      console.log('Page title:', pageTitle);
    } catch (error) {
      console.log('Could not find page title, page may not have loaded properly');
    }

    // Step 4: Fill out required form fields
    console.log('Step 4: Attempting to fill required form fields...');

    let formFilled = false;
    try {
      // Select a site (required field)
      const selectSiteButton = await page.$('button:has-text("Select Site")');
      if (selectSiteButton) {
        await selectSiteButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

        // Wait for products to load and select first one
        await new Promise(resolve => setTimeout(resolve, 2000));
        const productCards = await page.$$('[role="dialog"] [class*="cursor-pointer"]');
        if (productCards.length > 0) {
          await productCards[0].click();
          await page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 10000 });
          console.log('Site selected successfully');
        }
      }

      // Fill service type (required)
      const serviceTypeSelect = await page.$('select[name="serviceType"]') ||
                                await page.$('select') ||
                                await page.$('[role="combobox"]');
      if (serviceTypeSelect) {
        await page.select('select', 'Roll Up'); // Select first option
        console.log('Service type selected');
      }

      // Fill campaign name (required for most service types)
      const campaignInput = await page.$('input[placeholder*="campaign"]') ||
                           await page.$('input[name="campaignName"]');
      if (campaignInput) {
        await campaignInput.type('Test Campaign');
        console.log('Campaign name filled');
      }

      // Select crew (required)
      const crewSelect = await page.$('select[name="crew"]') ||
                        await page.$('select');
      if (crewSelect) {
        // Try to select first available option
        const options = await page.$$eval('select option', options =>
          options.map(option => option.value).filter(value => value && value !== '')
        );
        if (options.length > 0) {
          await page.select('select', options[0]);
          console.log('Crew selected');
        }
      }

      formFilled = true;
      console.log('Form fields filled successfully');

    } catch (error) {
      console.log('Error filling form fields:', error.message);
      console.log('Continuing with test to check Generate SA button behavior...');
    }

    // Step 5: Click "Generate SA" button
    console.log('Step 5: Attempting to click Generate SA button...');

    let generateSAButtonClicked = false;
    let navigationStarted = false;
    let navigatedUrl = null;

    try {
      // Look for the Generate SA button
      const generateSAButton = await page.$('button:has-text("Generate SA")') ||
                              await page.$('button:has-text("Creating SA")') ||
                              await page.$('button:contains("Generate SA")');

      if (generateSAButton) {
        console.log('Found Generate SA button, clicking...');

        // Listen for navigation
        page.on('framenavigated', frame => {
          if (frame === page.mainFrame()) {
            navigationStarted = true;
            navigatedUrl = frame.url();
            console.log('Navigation detected to:', navigatedUrl);
          }
        });

        await generateSAButton.click();
        generateSAButtonClicked = true;

        // Wait for navigation or loading to complete
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Generate SA button clicked successfully');
      } else {
        console.log('Generate SA button not found');
        // Try to find any button that might be the submit button
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const buttonText = await page.evaluate(btn => btn.textContent, button);
          if (buttonText && buttonText.includes('Generate') && buttonText.includes('SA')) {
            console.log('Found button with text:', buttonText);
            await button.click();
            generateSAButtonClicked = true;
            await new Promise(resolve => setTimeout(resolve, 5000));
            break;
          }
        }
      }
    } catch (error) {
      console.log('Error clicking Generate SA button:', error.message);
    }

    // Step 6: Verify navigation to PDF viewer page
    console.log('Step 6: Verifying navigation to PDF viewer page...');

    const currentUrlAfterSubmit = page.url();
    console.log('Current URL after submit attempt:', currentUrlAfterSubmit);

    const navigatedToPDFViewer = currentUrlAfterSubmit.includes('/logistics/assignments/view-pdf/') &&
                                currentUrlAfterSubmit.includes('[id]') || currentUrlAfterSubmit.match(/\/logistics\/assignments\/view-pdf\/[^/]+/);

    console.log('Navigated to PDF viewer page:', navigatedToPDFViewer);

    // Step 7: Verify PDF displays correctly
    console.log('Step 7: Verifying PDF display...');

    let pdfDisplayed = false;
    let backButtonPresent = false;
    let backButtonText = null;

    if (navigatedToPDFViewer) {
      try {
        // Check for back button
        const backButton = await page.$('button:has-text("← Create Service Assignment")') ||
                          await page.$('button:contains("Create Service Assignment")');
        if (backButton) {
          backButtonPresent = true;
          backButtonText = await page.evaluate(btn => btn.textContent, backButton);
          console.log('Back button found with text:', backButtonText);
        }

        // Check for PDF iframe
        const pdfIframe = await page.$('iframe[title*="PDF"]') ||
                         await page.$('iframe[src*="pdf"]') ||
                         await page.$('iframe');
        if (pdfIframe) {
          pdfDisplayed = true;
          console.log('PDF iframe found and should be displaying');
        }

        // Wait a bit for PDF to load
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.log('Error checking PDF display:', error.message);
      }
    }

    // Step 8: Check for errors
    console.log('Step 8: Checking for errors...');

    const hasErrors = consoleErrors.length > 0 || pageErrors.length > 0;

    // === TEST RESULTS ===
    console.log('\n=== SERVICE ASSIGNMENT PDF FLOW TEST RESULTS ===');
    console.log('1. Login attempted:', loginSuccessful ? 'PASS' : 'INFO (may require setup)');
    console.log('2. Page loaded successfully:', pageTitle ? 'PASS' : 'FAIL');
    console.log('3. Form fields filled:', formFilled ? 'PASS' : 'PARTIAL (some fields may be missing)');
    console.log('4. Generate SA button found and clicked:', generateSAButtonClicked ? 'PASS' : 'FAIL');
    console.log('5. Navigation to PDF viewer started:', navigationStarted ? 'PASS' : 'FAIL');
    console.log('6. Navigated to correct PDF viewer URL:', navigatedToPDFViewer ? 'PASS' : 'FAIL');
    console.log('7. PDF iframe present:', pdfDisplayed ? 'PASS' : 'FAIL');
    console.log('8. Back button present with correct text:', backButtonPresent && backButtonText && backButtonText.includes('Create Service Assignment') ? 'PASS' : 'FAIL');
    console.log('9. Console errors during flow:', consoleErrors.length === 0 ? 'PASS (no errors)' : `FAIL (${consoleErrors.length} errors)`);
    console.log('10. Page errors during flow:', pageErrors.length === 0 ? 'PASS (no errors)' : `FAIL (${pageErrors.length} errors)`);

    if (consoleErrors.length > 0) {
      console.log('Console errors:');
      consoleErrors.forEach(error => console.log('  -', error));
    }

    if (pageErrors.length > 0) {
      console.log('Page errors:');
      pageErrors.forEach(error => console.log('  -', error));
    }

    // Determine overall test result
    const criticalTestsPass = pageTitle && generateSAButtonClicked && navigatedToPDFViewer;
    const optionalTestsPass = pdfDisplayed && backButtonPresent && !hasErrors;

    let overallResult = 'PARTIAL SUCCESS';
    if (criticalTestsPass && optionalTestsPass) {
      overallResult = 'FULL SUCCESS - Complete flow working correctly';
    } else if (criticalTestsPass) {
      overallResult = 'PARTIAL SUCCESS - Core flow works but some issues with PDF display or errors';
    } else {
      overallResult = 'FAIL - Critical flow issues detected';
    }

    console.log('\nOVERALL RESULT:', overallResult);

    return {
      success: criticalTestsPass,
      overallResult,
      details: {
        loginSuccessful,
        pageLoaded: !!pageTitle,
        formFilled,
        generateSAButtonClicked,
        navigationStarted,
        navigatedToPDFViewer,
        navigatedUrl: currentUrlAfterSubmit,
        pdfDisplayed,
        backButtonPresent,
        backButtonText,
        consoleErrors,
        pageErrors,
        hasErrors
      }
    };

  } catch (error) {
    console.error('Test failed with exception:', error.message);
    return {
      success: false,
      overallResult: 'FAIL - Test execution failed',
      error: error.message,
      details: {}
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testServiceAssignmentPDFFlow().then(result => {
  console.log('\n=== FINAL TEST REPORT ===');
  console.log('Test completed at:', new Date().toISOString());
  console.log('Result:', result.overallResult);

  if (!result.success) {
    console.log('Error:', result.error);
  }

  console.log('\nDetailed Results:');
  Object.entries(result.details).forEach(([key, value]) => {
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  });

  process.exit(result.success ? 0 : 1);
});