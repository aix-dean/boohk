const puppeteer = require('puppeteer-core');

async function testServiceAssignmentHTMLPDF() {
  let browser;
  try {
    console.log('Starting Service Assignment HTML PDF generation test...');

    // Launch browser for testing
    browser = await puppeteer.launch({
      headless: true, // Run headless for automated testing
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

    // Navigate to a test page that will load our function
    console.log('Setting up test environment...');
    await page.goto('data:text/html,<html><body><div id="test-container"></div></body></html>', {
      waitUntil: 'load'
    });

    // Define realistic sample data for service assignment
    console.log('Preparing sample service assignment data...');
    const sampleServiceAssignment = {
      saNumber: "SA-2025-001",
      projectSiteName: "SM Mall of Asia Billboard Site",
      projectSiteLocation: "Pasay City, Metro Manila",
      serviceType: "Installation",
      assignedTo: "team-alpha",
      assignedToName: "Team Alpha Crew",
      serviceDuration: 8,
      priority: "High",
      equipmentRequired: "Ladder 12ft, Safety Harness, Power Drill, LED Testing Equipment",
      materialSpecs: "LED Panels 6x4ft, Aluminum Frame, Power Supply 220V, Control System",
      crew: "Team Alpha (4 members)",
      illuminationNits: "5000",
      gondola: "Required",
      technology: "Digital LED Display",
      sales: "John Smith",
      remarks: "Please ensure all safety protocols are followed. Site has restricted access hours from 9AM-6PM only.",
      requestedBy: {
        name: "Maria Santos",
        department: "Operations"
      },
      startDate: new Date("2025-11-01"),
      endDate: new Date("2025-11-01"),
      alarmDate: new Date("2025-11-01"),
      alarmTime: "08:00",
      attachments: [
        { name: "site-layout.pdf", type: "application/pdf" },
        { name: "safety-checklist.jpg", type: "image/jpeg" }
      ],
      serviceExpenses: [
        { name: "Equipment Rental", amount: "2500.00" },
        { name: "Transportation", amount: "800.00" },
        { name: "Labor Cost", amount: "3200.00" },
        { name: "Materials", amount: "1500.00" }
      ],
      status: "pending",
      created: new Date()
    };

    // Inject the PDF service code and dependencies
    console.log('Injecting PDF service dependencies...');
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    });

    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    });

    // Wait for scripts to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Inject our PDF service functions
    console.log('Injecting PDF service functions...');
    const pdfServiceCode = `
      // Helper functions
      function loadImageAsBase64(url) {
        return fetch(url)
          .then(response => response.blob())
          .then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          }))
          .catch(() => null);
      }

      function getImageDimensions(base64) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 100, height: 100 });
          img.src = base64;
        });
      }

      function compressImage(base64, quality = 0.8, maxWidth = 800, maxHeight = 600) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              resolve(base64);
              return;
            }

            let { width, height } = img;
            const aspectRatio = width / height;

            if (width > maxWidth) {
              width = maxWidth;
              height = width / aspectRatio;
            }
            if (height > maxHeight) {
              height = maxHeight;
              width = height * aspectRatio;
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

            resolve(compressedBase64);
          };
          img.onerror = () => resolve(base64);
          img.src = base64;
        });
      }

      function generateQRCode(text) {
        const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=\${encodeURIComponent(text)}\`;
        return Promise.resolve(qrUrl);
      }

      function safeToDate(dateValue) {
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === "string" || typeof dateValue === "number") return new Date(dateValue);
        if (dateValue && typeof dateValue.toDate === "function") return dateValue.toDate();
        return new Date();
      }

      function logProposalPDFGenerated(proposalId, userId, userName) {
        console.log(\`PDF generated for proposal \${proposalId} by user \${userId} (\${userName})\`);
        return Promise.resolve();
      }

      async function calculateImageFitDimensions(imageUrl, maxWidth, maxHeight, quality = 0.7, isForEmail = false) {
        const base64 = await loadImageAsBase64(imageUrl);
        if (!base64) return { base64: null, width: 0, height: 0 };

        const dimensions = await getImageDimensions(base64);
        let { width, height } = dimensions;
        const aspectRatio = width / height;

        if (width > maxWidth) {
          width = maxWidth;
          height = width / aspectRatio;
        }
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }

        if (isForEmail) {
          const MAX_EMAIL_DIMENSION = 300;
          if (width > MAX_EMAIL_DIMENSION || height > MAX_EMAIL_DIMENSION) {
            if (width > height) {
              width = MAX_EMAIL_DIMENSION;
              height = width / aspectRatio;
            } else {
              height = MAX_EMAIL_DIMENSION;
              width = height * aspectRatio;
            }
          }
        }

        const compressedBase64 = await compressImage(base64, quality, width, height);
        return { base64: compressedBase64, width, height };
      }

      function formatCurrency(amount) {
        const numAmount = typeof amount === "string" ? Number.parseFloat(amount.replace(/[^\d.-]/g, "")) : amount;
        const cleanAmount = Math.abs(Number(numAmount) || 0);
        return \`PHP\${cleanAmount.toLocaleString()}\`;
      }

      async function resolveCompanyLogo(userData, projectData) {
        return "public/boohk-logo.svg";
      }

      // Main PDF generation function
      async function generateServiceAssignmentHTMLPDF(serviceAssignment, returnBase64 = false) {
        try {
          // Generate HTML template for service assignment
          const htmlTemplate = \`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Service Assignment - \${serviceAssignment.saNumber}</title>
              <style>
                body {
                  font-family: 'Helvetica', 'Arial', sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: #ffffff;
                  color: #000000;
                  line-height: 1.4;
                }

                .header {
                  background: linear-gradient(135deg, #1e3a8a 60%, #34d3eb 100%);
                  color: white;
                  padding: 20px;
                  text-align: center;
                  margin: -20px -20px 20px -20px;
                }

                .header h1 {
                  margin: 0;
                  font-size: 28px;
                  font-weight: bold;
                }

                .header p {
                  margin: 5px 0 0 0;
                  font-size: 14px;
                }

                .sa-number {
                  font-size: 32px;
                  font-weight: bold;
                  color: #1e3a8a;
                  margin: 20px 0;
                  text-align: center;
                }

                .status-badge {
                  display: inline-block;
                  padding: 4px 12px;
                  border-radius: 4px;
                  font-size: 12px;
                  font-weight: bold;
                  color: white;
                  margin: 10px 0;
                }

                .status-completed { background-color: #22c55e; }
                .status-pending { background-color: #eab308; }
                .status-in-progress { background-color: #3b82f6; }
                .status-draft { background-color: #6b7280; }

                .section {
                  margin: 20px 0;
                  padding: 15px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  background-color: #ffffff;
                }

                .section h2 {
                  margin: 0 0 15px 0;
                  font-size: 18px;
                  font-weight: bold;
                  color: #111827;
                  border-bottom: 2px solid #e5e7eb;
                  padding-bottom: 5px;
                }

                .field-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 15px;
                }

                .field {
                  margin-bottom: 10px;
                }

                .field label {
                  display: block;
                  font-weight: bold;
                  color: #374151;
                  margin-bottom: 3px;
                  font-size: 12px;
                }

                .field span {
                  color: #111827;
                  font-size: 14px;
                }

                .expenses-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 10px;
                }

                .expenses-table th,
                .expenses-table td {
                  padding: 8px 12px;
                  text-align: left;
                  border-bottom: 1px solid #e5e7eb;
                }

                .expenses-table th {
                  background-color: #f9fafb;
                  font-weight: bold;
                  color: #374151;
                }

                .total-row {
                  border-top: 2px solid #374151;
                  font-weight: bold;
                }

                .footer {
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  text-align: center;
                  color: #6b7280;
                  font-size: 12px;
                }

                @media print {
                  body { margin: 0; }
                  .header { margin: 0 -20px 20px -20px; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>SERVICE ASSIGNMENT</h1>
                <p>LOGISTICS DEPARTMENT</p>
              </div>

              <div class="sa-number">SA# \${serviceAssignment.saNumber}</div>

              <div class="status-badge status-\${serviceAssignment.status.toLowerCase().replace(' ', '-')}">
                \${serviceAssignment.status.toUpperCase()}
              </div>

              <div class="section">
                <h2>SERVICE ASSIGNMENT INFORMATION</h2>
                <div class="field-grid">
                  <div class="field">
                    <label>SA Number:</label>
                    <span>\${serviceAssignment.saNumber}</span>
                  </div>
                  <div class="field">
                    <label>Project Site:</label>
                    <span>\${serviceAssignment.projectSiteName}</span>
                  </div>
                  <div class="field">
                    <label>Location:</label>
                    <span>\${serviceAssignment.projectSiteLocation || "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Service Type:</label>
                    <span>\${serviceAssignment.serviceType}</span>
                  </div>
                  <div class="field">
                    <label>Assigned To:</label>
                    <span>\${serviceAssignment.assignedToName || serviceAssignment.assignedTo}</span>
                  </div>
                  <div class="field">
                    <label>Duration:</label>
                    <span>\${serviceAssignment.serviceDuration ? \`\${serviceAssignment.serviceDuration} hours\` : "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Priority:</label>
                    <span>\${serviceAssignment.priority}</span>
                  </div>
                  <div class="field">
                    <label>Created:</label>
                    <span>\${serviceAssignment.created.toLocaleDateString()}</span>
                  </div>
                  <div class="field">
                    <label>Start Date:</label>
                    <span>\${serviceAssignment.startDate ? serviceAssignment.startDate.toLocaleDateString() : "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>End Date:</label>
                    <span>\${serviceAssignment.endDate ? serviceAssignment.endDate.toLocaleDateString() : "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Alarm Date:</label>
                    <span>\${serviceAssignment.alarmDate ? serviceAssignment.alarmDate.toLocaleDateString() : "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Alarm Time:</label>
                    <span>\${serviceAssignment.alarmTime || "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Illumination:</label>
                    <span>\${serviceAssignment.illuminationNits ? \`\${serviceAssignment.illuminationNits} nits\` : "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Gondola:</label>
                    <span>\${serviceAssignment.gondola || "N/A"}</span>
                  </div>
                  <div class="field">
                    <label>Technology:</label>
                    <span>\${serviceAssignment.technology || "N/A"}</span>
                  </div>
                </div>
              </div>

              \${serviceAssignment.equipmentRequired || serviceAssignment.materialSpecs ? \`
              <div class="section">
                <h2>EQUIPMENT & MATERIALS</h2>
                \${serviceAssignment.equipmentRequired ? \`
                <div class="field">
                  <label>Equipment Required:</label>
                  <span>\${serviceAssignment.equipmentRequired}</span>
                </div>
                \` : ''}
                \${serviceAssignment.materialSpecs ? \`
                <div class="field">
                  <label>Material Specifications:</label>
                  <span>\${serviceAssignment.materialSpecs}</span>
                </div>
                \` : ''}
              </div>
              \` : ''}

              \${serviceAssignment.serviceExpenses && serviceAssignment.serviceExpenses.length > 0 ? \`
              <div class="section">
                <h2>SERVICE COST BREAKDOWN</h2>
                <table class="expenses-table">
                  <thead>
                    <tr>
                      <th>Expense Name</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${serviceAssignment.serviceExpenses.map(expense => \`
                      <tr>
                        <td>\${expense.name}</td>
                        <td>PHP \${Number.parseFloat(expense.amount).toLocaleString()}</td>
                      </tr>
                    \`).join('')}
                    <tr class="total-row">
                      <td><strong>TOTAL COST</strong></td>
                      <td><strong>PHP \${serviceAssignment.serviceExpenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0).toLocaleString()}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              \` : ''}

              \${serviceAssignment.remarks ? \`
              <div class="section">
                <h2>REMARKS</h2>
                <div class="field">
                  <span>\${serviceAssignment.remarks}</span>
                </div>
              </div>
              \` : ''}

              <div class="section">
                <h2>REQUESTED BY</h2>
                <div class="field">
                  <span>\${serviceAssignment.requestedBy.department} - \${serviceAssignment.requestedBy.name}</span>
                </div>
              </div>

              <div class="footer">
                <p>Generated by Boohk Platform - Logistics Department</p>
                <p>Generated on \${new Date().toLocaleDateString()}</p>
                <p>Smart. Seamless. Scalable. - OH+</p>
              </div>
            </body>
            </html>
          \`;

          // Create a temporary DOM element to render the HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlTemplate;
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.top = '-9999px';
          document.body.appendChild(tempDiv);

          try {
            // Use html2canvas to capture the HTML as canvas
            const canvas = await html2canvas(tempDiv, {
              scale: 2, // Higher quality
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              width: 794, // A4 width in pixels at 96 DPI
              height: 1123, // A4 height in pixels at 96 DPI
            });

            // Remove the temporary element
            document.body.removeChild(tempDiv);

            // Convert canvas to PDF using jsPDF
            const pdf = new jsPDF("p", "mm", "a4");
            const imgData = canvas.toDataURL('image/png');

            // Calculate dimensions to fit A4
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 0;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

            if (returnBase64) {
              return pdf.output("datauristring").split(",")[1];
            } else {
              const fileName = \`service-assignment-\${serviceAssignment.saNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-\${Date.now()}.pdf\`;
              pdf.save(fileName);
            }
          } catch (canvasError) {
            console.error("Error with html2canvas:", canvasError);
            throw new Error("Failed to convert HTML to canvas");
          }
        } catch (error) {
          console.error("Error generating Service Assignment HTML PDF:", error);
          throw new Error("Failed to generate Service Assignment HTML PDF");
        }
      }

      // Make function available globally
      window.generateServiceAssignmentHTMLPDF = generateServiceAssignmentHTMLPDF;
    `;

    await page.evaluate((code) => {
      // Create a script element and inject the code
      const script = document.createElement('script');
      script.textContent = code;
      document.head.appendChild(script);
    }, pdfServiceCode);

    // Wait for functions to be available
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test PDF generation
    console.log('Testing PDF generation...');
    let pdfGenerated = false;
    let pdfBase64 = null;
    let generationError = null;

    try {
      // Call the generateServiceAssignmentHTMLPDF function
      const result = await page.evaluate(async (data) => {
        try {
          // Convert date strings back to Date objects
          data.startDate = new Date(data.startDate);
          data.endDate = new Date(data.endDate);
          data.alarmDate = new Date(data.alarmDate);
          data.created = new Date(data.created);

          const base64Result = await window.generateServiceAssignmentHTMLPDF(data, true);
          return { success: true, base64: base64Result };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, sampleServiceAssignment);

      if (result.success) {
        pdfGenerated = true;
        pdfBase64 = result.base64;
        console.log('PDF generated successfully, base64 length:', pdfBase64 ? pdfBase64.length : 0);
      } else {
        generationError = result.error;
        console.log('PDF generation failed:', generationError);
      }
    } catch (error) {
      generationError = error.message;
      console.log('Error calling PDF generation function:', error.message);
    }

    // Verify PDF content if generated
    let contentVerification = null;
    if (pdfGenerated && pdfBase64) {
      console.log('Verifying PDF content...');
      try {
        contentVerification = await page.evaluate(async (base64) => {
          // Decode base64 to check for expected content
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Convert to string to check for content
          const pdfText = String.fromCharCode.apply(null, bytes);

          const checks = {
            hasSANumber: pdfText.includes('SA-2025-001'),
            hasProjectSite: pdfText.includes('SM Mall of Asia Billboard Site'),
            hasServiceType: pdfText.includes('Installation'),
            hasAssignedTo: pdfText.includes('Team Alpha Crew'),
            hasPriority: pdfText.includes('High'),
            hasEquipment: pdfText.includes('Ladder 12ft'),
            hasMaterials: pdfText.includes('LED Panels'),
            hasRemarks: pdfText.includes('safety protocols'),
            hasRequestedBy: pdfText.includes('Maria Santos'),
            hasExpenses: pdfText.includes('Equipment Rental') && pdfText.includes('2500.00'),
            hasTotalCost: pdfText.includes('7200.00'), // 2500 + 800 + 3200 + 1500
            hasStatus: pdfText.includes('pending'),
            hasPDFStructure: pdfText.includes('%PDF-') && pdfText.includes('%%EOF')
          };

          const passedChecks = Object.values(checks).filter(Boolean).length;
          const totalChecks = Object.keys(checks).length;

          return {
            passed: passedChecks,
            total: totalChecks,
            details: checks,
            success: passedChecks === totalChecks
          };
        }, pdfBase64);
      } catch (error) {
        console.log('Error verifying PDF content:', error.message);
        contentVerification = { error: error.message };
      }
    }

    // === TEST RESULTS ===
    console.log('\n=== SERVICE ASSIGNMENT HTML PDF TEST RESULTS ===');
    console.log('1. PDF Generation:', pdfGenerated ? 'PASS' : 'FAIL');
    if (!pdfGenerated && generationError) {
      console.log('   Error:', generationError);
    }

    if (contentVerification) {
      console.log('2. Content Verification:');
      if (contentVerification.error) {
        console.log('   Error:', contentVerification.error);
      } else {
        console.log(`   Passed: ${contentVerification.passed}/${contentVerification.total} checks`);
        console.log('   Details:');
        Object.entries(contentVerification.details).forEach(([check, passed]) => {
          console.log(`     ${check}: ${passed ? '✓' : '✗'}`);
        });
      }
    }

    console.log('3. Console Errors:', consoleErrors.length === 0 ? 'PASS (none)' : `FAIL (${consoleErrors.length} errors)`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(error => console.log('   -', error));
    }

    console.log('4. Page Errors:', pageErrors.length === 0 ? 'PASS (none)' : `FAIL (${pageErrors.length} errors)`);
    if (pageErrors.length > 0) {
      pageErrors.forEach(error => console.log('   -', error));
    }

    // Determine overall result
    const generationSuccess = pdfGenerated;
    const contentSuccess = contentVerification && contentVerification.success;
    const noErrors = consoleErrors.length === 0 && pageErrors.length === 0;

    let overallResult = 'FAIL';
    if (generationSuccess && contentSuccess && noErrors) {
      overallResult = 'FULL SUCCESS - PDF generated correctly with all expected content';
    } else if (generationSuccess && contentSuccess) {
      overallResult = 'PARTIAL SUCCESS - PDF generated with correct content but has errors';
    } else if (generationSuccess) {
      overallResult = 'PARTIAL SUCCESS - PDF generated but content verification failed';
    } else {
      overallResult = 'FAIL - PDF generation failed';
    }

    console.log('\nOVERALL RESULT:', overallResult);

    return {
      success: generationSuccess && contentSuccess,
      overallResult,
      details: {
        pdfGenerated,
        generationError,
        contentVerification,
        consoleErrors,
        pageErrors,
        sampleData: sampleServiceAssignment
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
if (require.main === module) {
  testServiceAssignmentHTMLPDF().then(result => {
    console.log('\n=== FINAL TEST REPORT ===');
    console.log('Test completed at:', new Date().toISOString());
    console.log('Result:', result.overallResult);

    if (!result.success) {
      console.log('Error:', result.error);
    }

    console.log('\nDetailed Results:');
    Object.entries(result.details).forEach(([key, value]) => {
      if (key === 'sampleData') {
        console.log(`  ${key}: [Object with ${Object.keys(value).length} properties]`);
      } else {
        console.log(`  ${key}: ${JSON.stringify(value, null, 2)}`);
      }
    });

    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testServiceAssignmentHTMLPDF };