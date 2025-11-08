const puppeteer = require('puppeteer-core');

async function testServiceAssignmentPage() {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    console.log('Navigating to the URL...');
    await page.goto('http://localhost:3000/logistics/assignments/create?jobOrderId=THtdI83u7FBZmvanDTgO', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Waiting for page to load...');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check 1: Job order data loaded and displayed
    console.log('Checking job order data...');
    const jobOrderElements = await page.$$('[data-testid="job-order"]');
    const hasJobOrderData = jobOrderElements.length > 0;

    // Check 2: Products data selected
    console.log('Checking product selection...');
    const productImage = await page.$('img[alt*="Site Image"]');
    const productName = await page.$('span[style*="font-weight: 700"]');
    const productLocation = await page.$('span.text-sm.text-gray-500');

    // Check 3: ServiceAssignmentCard displays
    const saNumberElement = await page.$('p[style*="font-weight: 700"]');
    let saNumber = null;
    if (saNumberElement) {
      saNumber = await page.evaluate(el => el.textContent, saNumberElement);
      console.log('SA Number:', saNumber);
    } else {
      console.log('SA Number element not found');
    }

    // Check 4: Console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('=== VERIFICATION RESULTS ===');
    console.log('1. Job order data loaded:', hasJobOrderData ? 'PASS' : 'FAIL');
    console.log('2. Product image displayed:', productImage ? 'PASS' : 'FAIL');
    console.log('3. Product name displayed:', productName ? 'PASS' : 'FAIL');
    console.log('4. Product location displayed:', productLocation ? 'PASS' : 'FAIL');
    console.log('5. SA Number:', saNumber ? 'PASS' : 'FAIL');
    console.log('6. Console errors:', errors.length === 0 ? 'PASS (no errors)' : `FAIL (${errors.length} errors: ${errors.join(', ')})`);

    if (errors.length > 0) {
      console.log('Console errors:');
      errors.forEach(error => console.log('  -', error));
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testServiceAssignmentPage();