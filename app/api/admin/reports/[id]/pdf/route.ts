import { type NextRequest, NextResponse } from "next/server"
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import { getReportById, type ReportData } from "@/lib/report-service"
import { getProductById, type Product } from "@/lib/firebase-service"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Helper function to load image and convert to base64
export async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PDF-Generator/1.0)",
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const blob = await response.blob()

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => {
        console.error("FileReader error:", reader.error)
        resolve(null)
      }
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error("Error loading image:", url, error)
    return null
  }
}

// Helper function to get image dimensions
export function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      resolve({ width: 100, height: 100 }) // Default dimensions
    }
    img.src = base64
  })
}

// Helper function to safely convert dates
function safeToDate(dateValue: any): Date {
  if (!dateValue) return new Date()
  if (dateValue instanceof Date) return dateValue
  if (dateValue.toDate && typeof dateValue.toDate === "function") return dateValue.toDate()
  return new Date(dateValue)
}

// Helper function to format date exactly like the preview page
const formatDate = (dateValue: any) => {
  if (!dateValue) return "N/A"
  if (dateValue instanceof Date) return dateValue.toLocaleDateString("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
  if (dateValue.toDate && typeof dateValue.toDate === "function") return dateValue.toDate().toLocaleDateString("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
  return new Date(dateValue).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
}

// Helper function to get report type display
const getReportTypeDisplay = (type: string) => {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Helper functions matching the preview page exactly
const getSiteLocation = (product: any) => {
  if (!product) return "N/A"
  return product.specs_rental?.location || product.light?.location || "N/A"
}

const getSiteName = (report: any) => {
  return report.siteName || "N/A"
}

const getSiteSize = (product: any) => {
  if (!product) return "N/A"
  const specs = product.specs_rental
  if (specs?.height && specs?.width) {
    const panels = specs || "N/A"
    return `${specs.height} (H) x ${specs.width} x ${panels} Panels`
  }
  return product.specs_rental?.size || product.light?.size || "N/A"
}

const getMaterialSpecs = (product: any) => {
  if (!product) return "N/A"
  return product.specs_rental?.material || "Stickers"
}

const getIllumination = (product: any) => {
  if (!product) return "N/A"
  return product.specs_rental?.illumination || "LR 2097 (200 Watts x 40)"
}

const getGondola = (product: any) => {
  if (!product) return "N/A"
  return product.specs_rental?.gondola ? "YES" : "NO"
}

const getTechnology = (product: any) => {
  if (!product) return "N/A"
  return product.specs_rental?.technology || "Clear Tapes"
}

const calculateInstallationDuration = (startDate: any, endDate: any) => {
  const start = safeToDate(startDate)
  const end = safeToDate(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Helper function to get completion percentage from report data
const getCompletionPercentage = (report: any) => {
  if (!report) return 100

  // Check for installationStatus first (this is the actual field name in the database)
  if (report.installationStatus !== undefined) {
    const percentage = Number.parseInt(report.installationStatus.toString(), 10)
    return isNaN(percentage) ? 0 : percentage
  }

  // Fallback to completionPercentage if it exists
  if (report.completionPercentage !== undefined) {
    return report.completionPercentage
  }

  // Default based on report type
  return report.reportType === "installation-report" ? 0 : 100
}

async function fetchCompanyData(companyId: string) {
  // Provide immediate fallback data to prevent hanging
  const fallbackData = {
    company_name: "Boohk",
    company_location: "Manila, Philippines",
    phone: "Contact: (02) 123 4567",
    photo_url: null,
  }

  try {
    // Attempt to fetch company data with a very short timeout
    const companyDoc = await getDoc(doc(db, "companies", companyId))

    if (companyDoc.exists()) {
      const data = companyDoc.data()
      // Return fetched data merged with fallback for missing fields
      return {
        company_name: data.name || data.company_name || fallbackData.company_name,
        company_location: data.company_location || data.address || fallbackData.company_location,
        phone: data.phone || data.telephone || data.contact_number || fallbackData.phone,
        photo_url: data.photo_url || data.logo_url || null,
      }
    }

    return fallbackData
  } catch (error) {
    console.error("Error fetching company data:", error)
    // Always return fallback data instead of throwing
    return fallbackData
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params

  if (!reportId) {
    return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
  }

  let browser
  try {
    console.log("Starting Puppeteer PDF generation for report:", reportId)

    // Fetch the report data
    const report = await getReportById(reportId)

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    console.log("Fetched report data:", report.id)

    // Fetch the associated product data
    let product: Product | null = null
    if (report.siteId) {
      try {
        product = await getProductById(report.siteId)
        console.log("Fetched product data:", product?.id)
      } catch (productError) {
        console.error("Error fetching product data:", productError)
        // Continue without product data - it's not critical
      }
    }

    // Fetch user data for company information
    let companyData = null
    if (report.createdBy) {
      try {
        const userDocRef = doc(db, "iboard_users", report.createdBy)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          if (userData.company_id) {
            companyData = await fetchCompanyData(userData.company_id)
          }
        }
      } catch (error) {
        console.error("Error fetching user/company data:", error)
      }
    }

    // Launch Puppeteer browser with @sparticuz/chromium for serverless or local chromium for development
    browser = await puppeteer.launch(
      process.env.NODE_ENV === 'production' || process.env.VERCEL
        ? {
            headless: true,
            args: chromium.args,
            executablePath: await chromium.executablePath()
          }
        : {
            headless: true,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          }
    )

    const page = await browser.newPage()

    // Generate HTML content that replicates the report page
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report - ${reportId}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
          }
          .clip-path-custom { clip-path: polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%); }
          @page {
            size: A4;
            margin: 0;
          }
          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body class="bg-white m-0 p-0" style="margin: 0; padding: 0; min-height: 297mm; display: flex; flex-direction: column;">
        <!-- Header Section -->
        <div style="width: 100%; position: relative; margin-bottom: 16px;">
          <div style="position: relative; height: 64px; overflow: hidden;">
            <div style="position: absolute; inset: 0; background-color: #1e3a8a;"></div>
            <div style="position: absolute; top: 0; right: 0; height: 100%; background-color: #06b6d4; clip-path: polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%); width: 40%;"></div>
            <div style="position: relative; z-index: 10; height: 100%; display: flex; align-items: center; padding-left: 24px; padding-right: 24px;">
              <div style="color: white; font-size: 18px; font-weight: 600;">Admin</div>
            </div>
          </div>
        </div>

        <div style="flex: 1; width: 100%; background: white; display: flex; flex-direction: column;">
          <div class="max-w-6xl mx-auto p-3 space-y-3" style="padding: 12px;">
            <!-- Report Header -->
            <div class="flex justify-between items-center">
              <div class="flex flex-col">
                <div class="bg-cyan-400 text-white px-6 py-3 rounded-lg text-base font-medium inline-block">
                  ${getReportTypeDisplay(report.reportType)}
                </div>
                <p class="text-gray-600 text-sm mt-2">as of ${formatDate(report.date)}</p>
              </div>
              <div class="flex-shrink-0">
                <div class="bg-white rounded-lg px-4 py-2 flex items-center justify-center shadow-sm" style="width: 160px; height: 160px;">
                  ${companyData?.photo_url ? `<img src="${companyData.photo_url}" alt="Company Logo" class="max-h-full max-w-full object-contain" />` : '<img src="/ohplus-new-logo.png" alt="Company Logo" class="max-h-full max-w-full object-contain" />'}
                </div>
              </div>
            </div>

            <!-- Project Information Card -->
            <div style="border: 1px solid #e5e7eb; border-radius: 6px;">
              <div style="padding: 12px;">
                <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #111827;">Project Information</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; font-size: 12px; line-height: 1.2;">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Site ID:</span>
                      <span style="color: #111827;">${getSiteLocation(product)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Job Order:</span>
                      <span style="color: #111827;">${report.joNumber || report.id?.slice(-4).toUpperCase() || "N/A"}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Job Order Date:</span>
                      <span style="color: #111827;">${formatDate(report.date)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Site:</span>
                      <span style="color: #111827;">${getSiteName(report)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Size:</span>
                      <span style="color: #111827;">${getSiteSize(product)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Start Date:</span>
                      <span style="color: #111827;">${report.bookingDates?.start ? formatDate(report.bookingDates.start) : "N/A"}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">End Date:</span>
                      <span style="color: #111827;">${report.bookingDates?.end ? formatDate(report.bookingDates.end) : "N/A"}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Installation Duration:</span>
                      <span style="color: #111827;">${report.bookingDates?.start && report.bookingDates?.end ? `${calculateInstallationDuration(report.bookingDates.start, report.bookingDates.end)} days` : "N/A"}</span>
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Content:</span>
                      <span style="color: #111827;">${product?.content_type || "Static"}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Material Specs:</span>
                      <span style="color: #111827;">${getMaterialSpecs(product)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Crew:</span>
                      <span style="color: #111827;">Team ${report.assignedTo || "Admin"}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Illumination:</span>
                      <span style="color: #111827;">${getIllumination(product)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Gondola:</span>
                      <span style="color: #111827;">${getGondola(product)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Technology:</span>
                      <span style="color: #111827;">${getTechnology(product)}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start;">
                      <span style="font-weight: bold; color: #374151; white-space: nowrap;">Sales:</span>
                      <span style="color: #111827;">${report.sales || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Project Status -->
            <div style="margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <h2 style="font-size: 16px; font-weight: bold; color: #111827; margin: 0;">Project Status</h2>
                <div style="color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; ${(() => {
                  const percentage = getCompletionPercentage(report)
                  if (percentage >= 90) return "background-color: #10b981;"
                  if (percentage >= 70) return "background-color: #f59e0b;"
                  if (percentage >= 50) return "background-color: #f97316;"
                  return "background-color: #ef4444;"
                })()}">
                  ${getCompletionPercentage(report)}%
                </div>
              </div>

              <!-- Attachments -->
              ${report.attachments && report.attachments.length > 0 ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px;">
                  ${report.attachments.slice(0, 2).map((attachment, index) => `
                    <div style="background: #f3f4f6; border-radius: 8px; height: 256px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; position: relative; cursor: pointer;">
                      ${attachment.fileUrl && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(attachment.fileName?.toLowerCase().split('.').pop() || '') ?
                        `<img src="${attachment.fileUrl}" alt="${attachment.fileName}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px;" />` :
                        `<div style="text-align: center; font-size: 14px; color: #374151; word-break: break-all;">${attachment.fileName}</div>`
                      }
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Prepared by section - positioned right above footer -->
        <div style="width: 100%; background: white; padding: 12px; border-top: 1px solid #e5e7eb;">
          <div class="max-w-6xl mx-auto">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h3 style="font-weight: 600; margin-bottom: 2px; font-size: 12px;">Prepared by:</h3>
                <div style="font-size: 12px; color: #6b7280;">
                  <div>${companyData?.company_name || "Boohk"}</div>
                  <div>ADMIN</div>
                  <div>${formatDate(report.date)}</div>
                </div>
              </div>
              <div style="text-align: right; font-size: 10px; color: #9ca3af; font-style: italic; max-width: 180px;">
                "All data are based on the latest available records as of ${formatDate(new Date().toISOString().split("T")[0])}."
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Footer - fixed at bottom of page -->
        <div style="height: 64px; width: 100%; position: relative;">
          <div style="position: relative; height: 100%; overflow: hidden;">
            <div style="position: absolute; inset: 0; background-color: #06b6d4;"></div>
            <div style="position: absolute; top: 0; right: 0; height: 100%; background-color: #1e3a8a; clip-path: polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%); width: 75%;"></div>
            <div style="position: relative; z-index: 10; height: 100%; display: flex; align-items: center; justify-between; padding-left: 32px; padding-right: 32px;">
              <div style="display: flex; align-items: center; gap: 24px;">
                <div style="color: white; font-size: 18px; font-weight: 600;"></div>
              </div>
              <div style="color: white; text-align: right; display: flex; align-items: center; gap: 8px; margin-left: auto;">
                <div style="font-size: 14px; font-weight: 500;">Smart. Seamless. Scalable</div>
                <div style="font-size: 24px; font-weight: bold; display: flex; align-items: center;">
                  OH!
                  <div style="margin-left: 4px; color: #06b6d4;">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2v16M2 10h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    // Set the HTML content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    // Generate PDF with full page coverage
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      },
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      width: '210mm',
      height: '297mm'
    })

    console.log("PDF generated successfully for report:", reportId)

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${reportId}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating report PDF:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}