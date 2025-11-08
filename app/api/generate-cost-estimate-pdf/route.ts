import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb } from 'pdf-lib'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import type { CostEstimate } from '@/lib/types/cost-estimate'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'


// Helper functions from quotation PDF
const formatDate = (date: any) => {
  const dateObj = getDateObject(date)
  if (!dateObj) return "N/A"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj)
}

const formatDuration = (days: number, startDate?: any, endDate?: any): string => {
  // If we have actual dates, calculate based on calendar months
  if (startDate && endDate) {
    const start = getDateObject(startDate)
    const end = getDateObject(endDate)

    if (start && end) {
      let years = end.getFullYear() - start.getFullYear()
      let months = end.getMonth() - start.getMonth()
      let dayDiff = end.getDate() - start.getDate()

      // Adjust for negative months/days
      if (dayDiff < 0) {
        months--
        // Get days in previous month
        const prevMonth = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())
        const daysInPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate()
        dayDiff += daysInPrevMonth
      }

      if (months < 0) {
        years--
        months += 12
      }

      const parts = []
      if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`)
      if (months > 0) parts.push(`${months} ${months === 1 ? "month" : "months"}`)
      if (dayDiff > 0) parts.push(`${dayDiff} ${dayDiff === 1 ? "day" : "days"}`)

      return parts.join(" and ") || "0 days"
    }
  }

  // Fallback to the old method if no dates provided
  if (days <= 0) return "1 month"

  const months = Math.floor(days / 30)
  const remainingDays = days % 30

  if (months === 0) {
    return `${days} day${days !== 1 ? "s" : ""}`
  } else if (remainingDays === 0) {
    return `${months} month${months !== 1 ? "s" : ""}`
  } else {
    return `${months} month${months !== 1 ? "s" : ""} and ${remainingDays} day${remainingDays !== 1 ? "s" : ""}`
  }
}

const formatCompanyAddress = (companyData: any): string => {
const parts: string[] = [];

const location = companyData.company_location && (
  companyData.company_location.street ||
  companyData.company_location.city ||
  companyData.company_location.province
) ? companyData.company_location : companyData.address;

if (location?.street) parts.push(location.street);
if (location?.city) parts.push(location.city);
if (location?.province) parts.push(location.province);

const fullAddress = parts.join(", ");
  return fullAddress
}

const calculateProratedPrice = (price: number, startDate: Date | undefined, endDate: Date | undefined): number => {
  if (!startDate || !endDate) return price;

  let total = 0;
  let currentDate = new Date(startDate);

  console.log('Calculating prorated price from', startDate, 'to', endDate, 'for price', price);
  if (endDate.getTime() === startDate.getTime()) return price;

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Daily price for this month
    const dailyRate = price / daysInMonth;

    // Determine start and end days for this month
    let startDay = (currentDate.getMonth() === startDate.getMonth() && currentDate.getFullYear() === startDate.getFullYear())
      ? startDate.getDate()
      : 1;

    let endDay = (currentDate.getMonth() === endDate.getMonth() && currentDate.getFullYear() === endDate.getFullYear())
      ? endDate.getDate()
      : daysInMonth;

    // Days counted in this month
    const daysCounted = (endDay - startDay + 1);

    // Add to total
    total += dailyRate * daysCounted;

    // Move to next month
    currentDate = new Date(year, month + 1, 1);
  }

  return total;
}

const getDateObject = (date: any): Date | undefined => {
  if (date === null || date === undefined) return undefined
  if (date instanceof Date) return date
  if (typeof date === "object" && date.toDate && typeof date.toDate === "function") {
    return date.toDate()
  }
  // Handle Firebase timestamp objects { seconds, nanoseconds }
  if (typeof date === "object" && date.seconds && typeof date.seconds === "number") {
    return new Date(date.seconds * 1000)
  }
  if (typeof date === "string") {
    const parsedDate = new Date(date)
    if (!isNaN(parsedDate.getTime())) return parsedDate
  }
  return undefined
}

export async function POST(request: NextRequest) {
  console.log('[API_PDF] Received PDF generation request')
  const { costEstimate, companyData, logoDataUrl, userSignatureDataUrl, format = 'pdf', userData }: { costEstimate: CostEstimate; companyData: any; logoDataUrl: string | null; userSignatureDataUrl?: string | null; format?: 'pdf' | 'image'; userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string } } = await request.json()
  console.log('[API_PDF] Cost estimate ID:', costEstimate?.id)
  console.log('[API_PDF] Company data:', companyData?.name)
  console.log('[API_PDF] Logo data URL provided:', !!logoDataUrl)
  console.log('[API_PDF] User signature data URL provided:', !!userSignatureDataUrl)
  console.log('[API_PDF] User data:', userData?.first_name)
  console.log('[API_PDF] Format:', format)

  try {
    // Generate HTML content
    console.log('[API_PDF] Generating HTML content...')
    const htmlContent = generateCostEstimateHTML(costEstimate, companyData, userData, userSignatureDataUrl)
    console.log('[API_PDF] HTML content generated, length:', htmlContent.length)

    // Launch puppeteer with @sparticuz/chromium for serverless or local chromium for development
    console.log('[API_PDF] Launching Puppeteer browser...')
    let browser
    try {
      browser = await puppeteer.launch(
        process.env.NODE_ENV === 'production' || process.env.VERCEL
          ? {
              headless: true,
              args: chromium.args,
              executablePath: await chromium.executablePath()
            }
          : {
              headless: true,
              executablePath: process.platform === 'win32'
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : process.platform === 'darwin'
                  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                  : '/usr/bin/google-chrome' // Linux fallback
            }
      )
    } catch (browserError) {
      console.error('[API_PDF] Failed to launch browser with executable path:', browserError)
      // Try launching without executable path (let Puppeteer find it automatically)
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        })
        console.log('[API_PDF] Browser launched successfully with auto-detection')
      } catch (fallbackError) {
        console.error('[API_PDF] Fallback browser launch also failed:', fallbackError)
        throw new Error('PDF generation failed: Unable to launch browser. Please ensure Chrome or Chromium is installed.')
      }
    }
    console.log('[API_PDF] Browser launched successfully')

    const page = await browser.newPage()
    console.log('[API_PDF] New page created')

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
    console.log('[API_PDF] HTML content set on page')

    // Generate PDF
    console.log('[API_PDF] Generating PDF...')
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div class="header" style="text-align: left; width: 100%; padding: 5px; margin-left: 15mm;">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="height: 55px;">` : ''}
        </div>
      `,
      footerTemplate: `<div> </div>
      `,
      margin: {
        top: '25mm',
        right: '10mm',
        bottom: '30mm',
        left: '10mm'
      }
    })
    console.log('[API_PDF] PDF buffer generated, size:', buffer.length, 'bytes')

    await browser.close()
    console.log('[API_PDF] Browser closed')

    const contentType = 'application/pdf'
    const filename = `${costEstimate.costEstimateNumber || costEstimate.id || 'cost-estimate'}.pdf`
    console.log('[API_PDF] Generated filename:', filename)


    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error(`[API_PDF] Error generating ${format}:`, error)

    // Check for specific Puppeteer/Chrome errors
    if (error instanceof Error && error.message.includes('Could not find Chrome')) {
      return NextResponse.json({
        error: 'PDF generation failed: Chrome browser not found. Please ensure Chrome is installed or run: npx puppeteer browsers install chrome'
      }, { status: 500 })
    }

    return NextResponse.json({ error: `Failed to generate ${format}` }, { status: 500 })
  }
}

function generateCostEstimateHTML(
  costEstimate: CostEstimate,
  companyData: any,
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
  userSignatureDataUrl?: string | null
): string {
  // Group line items by site
  const groupLineItemsBySite = (lineItems: any[]) => {
    const siteGroups: { [key: string]: any[] } = {}

    lineItems.forEach((item) => {
      if (item.category.includes("Billboard Rental")) {
        const siteName = item.description
        if (!siteGroups[siteName]) {
          siteGroups[siteName] = []
        }
        siteGroups[siteName].push(item)

        const siteId = item.id
        const relatedItems = lineItems.filter(
          (relatedItem) => relatedItem.id.includes(siteId) && relatedItem.id !== siteId,
        )
        siteGroups[siteName].push(...relatedItems)
      }
    })

    if (Object.keys(siteGroups).length === 0) {
      siteGroups["Single Site"] = lineItems
    }

    return siteGroups
  }

  const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
  const sites = Object.keys(siteGroups)
  const isMultipleSites = sites.length > 1

  // Get the first site for main details
  const primarySite = sites[0]
  const siteLineItems = siteGroups[primarySite] || []
  const primaryRentalItem = siteLineItems.find((item) => item.category.includes("Billboard Rental"))

  const startDate = costEstimate.startDate || (costEstimate as any).contract_period?.start_date
  const endDate = costEstimate.endDate || (costEstimate as any).contract_period?.end_date

  // Calculate totals
  const subtotal = costEstimate.lineItems.reduce((sum, item) => sum + item.total, 0)
  const vatRate = 0.12
  const vatAmount = subtotal * vatRate
  const totalWithVat = subtotal + vatAmount

  const monthlyRate = primaryRentalItem ? primaryRentalItem.unitPrice : 0

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${costEstimate.costEstimateNumber}</title>
    <style>
  @page {
  margin: 25mm 15mm 30mm 15mm; /* extra bottom space */
}
    *{
      border-size: border-box;
      margin: 0;
      padding:0;
    }
      .page-footer {
        position: fixed;
          bottom: 0mm;
          left: 5mm;             /* match @page left margin */
          right: 15mm;            /* match @page right margin */
          text-align: center;
          font-size: 10px;
          color: #555;
          box-sizing: border-box;
    }
      body {
        font-family: Arial, sans-serif;
        background: #fff;
        color: #333;
        line-height: 1.5;
      }
      .date-ref {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px;
        font-size: 14px;
      }
      .client-info {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 15px;
      }
      .client-left p {
        margin: 2px 0;
        font-size: 14px;
        text-align: left;
      }
      .client-right p {
        font-size: 14px;
        text-align: right;
      }
        .closing-message{
        font-size: 14px;
          margin-top: 10px;
        }
      .title {
        text-align: center;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
      }
      .salutation {
        margin-bottom: 10px;
        font-size: 14px;
      }
      .greeting {
        margin-bottom: 15px;
        font-size: 14px;
      }
      .details-header {
        font-weight: bold;
        margin-bottom: 5px;
        font-size: 14px;
      }
      .details-list {
        margin-bottom: 15px;
        font-size: 14px;
      }
      .details-list .detail-item {
        margin-bottom: 4px;
      }
      .details-list .label {
        font-weight: bold;
      }
      .price-breakdown-title {
        font-weight: bold;
        margin-bottom: 5px;
        font-size: 14px;
      }
      .price-breakdown {
        margin-bottom: 15px;
        page-break-inside: avoid;
      }
      .price-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        margin-bottom: 3px;
        margin-left: 20px;
        margin-right: 10px;
      }
      .price-total {
        font-weight: bold;
        border-top: 1px solid #858080ff;
        margin-top: 5px;
        padding-top: 4px;
      }
      .price-notes {
        margin-top: 10px;
        margin-bottom: 15px;
        font-size: 12px;
        color: gray;
        font-style: italic;
      }
      .price-notes p {
        font-style: italic;
      }
        .site-details {
  margin-bottom: 15px;
  font-size: 14px;
  page-break-inside: avoid;
}

.details-row {
  display: flex;
  margin-bottom: 4px;
}

.details-label {
  width: 180px; /* fixed width so values align neatly */
}

.details-value {
  flex: 1;
}
  .site-details ul {
  list-style-type: disc;  /* or circle/square */
  padding-left: 20px;     /* space for bullets */
}

.site-details li {
  margin-bottom: 6px;
}
      .terms {
        margin-top: 15px;
        font-size: 13px;
        page-break-inside: avoid;
      }
      .terms-title {
        font-weight: bold;
        margin-bottom: 5px;
        font-size: 14px;
      }
      .term-item {
        margin-bottom: 3px;
      }
      .signatures {
        margin-top: 25px;
        page-break-inside: avoid;
      }
      .signature-section {
        font-size: 13px;
        margin-bottom: 20px;
      }
      .signature-line {
        font-weight: bold;
        border-bottom: 1px solid #000;
        max-width: 100px; /* 👈 shorten the line */
        margin-right: 0; 
      }
    </style>
  </head>
  <body>
    <div class="date-ref">
      <div>${formatDate(new Date())}</div>
    </div>

    <div class="client-info">
      <div class="client-left">
        <p>${costEstimate.client?.name || "Client Name"}</p>
        <p>${costEstimate.client?.designation || "Position"}</p>
        <p><strong>${costEstimate.client?.company || "COMPANY NAME"}</strong></p>
      </div>
      <div class="client-right">
        <p>CE. No. ${costEstimate.costEstimateNumber}</p>
      </div>
    </div>

    <div class="title">${isMultipleSites ? `${primarySite}` : `${costEstimate.lineItems[0].description} Cost Estimate` || "Cost Estimate"}</div>

    <div class="salutation">
      Dear ${costEstimate?.template?.salutation ||  "Mr."} ${costEstimate.client?.name?.split(" ").pop() || "Client"},
    </div>

    <div class="greeting">
      ${costEstimate.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`}
    </div>

    <div class="details-header">Site details:</div>
    <div class="site-details">
      <ul>
        <li>
          <div class="details-row">
            <div class="details-label">Type:</div>
            <div class="details-value">${primaryRentalItem?.content_type || "Rental"}</div>
          </div>
        </li>
        <li>
          <div class="details-row">
            <div class="details-label">Size:</div>
            <div class="details-value">${primaryRentalItem?.specs?.height ? `${primaryRentalItem.specs.height}ft (H)` : "N/A"} x ${primaryRentalItem?.specs?.width ? `${primaryRentalItem.specs.width}ft (W)` : "N/A"}</div>
          </div>
        </li>
        <li>
          <div class="details-row">
            <div class="details-label">Contract Duration:</div>
            <div class="details-value">${ costEstimate.durationDays ? `${costEstimate.durationDays} days` : "—"} </div>
          </div>
        </li>
        <li>
          <div class="details-row">
            <div class="details-label">Contract Period:</div>
            <div class="details-value">${startDate ? formatDate(startDate) : ""}${startDate && endDate ? " - " : ""}${endDate ? formatDate(endDate) : "—"}</div>
          </div>
        </li>
        <li>
          <div class="details-row">
            <div class="details-label">Proposal to:</div>
            <div class="details-value">${costEstimate.client?.company || "CLIENT COMPANY NAME"}</div>
          </div>
        </li>
        <li>
          <div class="details-row">
            <div class="details-label">Lease rate per month:</div>
            <div class="details-value">PHP ${monthlyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Exclusive of VAT)</div>
          </div>
        </li>
      </ul>
    </div>

    ${costEstimate.items?.site_notes ? `
    <div class="price-notes">
      <p><strong>Notes:</strong> ${costEstimate.items.site_notes}</p>
    </div>
    ` : ''}
    <div class="price-breakdown-title">Price breakdown:</div>
    <div class="price-breakdown">
      <div class="price-row">
        <span>Lease rate per month</span>
        <span>PHP ${(costEstimate.lineItems[0].unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div class="price-row">
        <span>Contract duration</span>
        <span>x ${costEstimate.durationDays ? `${costEstimate.durationDays} days` : "1 month"}</span>
      </div>
      <div class="price-row">
        <span>Total lease</span>
        <span>PHP ${calculateProratedPrice(monthlyRate, getDateObject(startDate), getDateObject(endDate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div class="price-row">
        <span>Add: VAT</span>
        <span>PHP ${(calculateProratedPrice(monthlyRate, getDateObject(startDate), getDateObject(endDate)) * 0.12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div class="price-row price-total">
        <span>Total</span>
        <span>PHP ${(
          calculateProratedPrice(monthlyRate, getDateObject(startDate), getDateObject(endDate)) * 1.12
        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    </div>

    ${costEstimate.items?.price_notes ? `
    <div class="price-notes">
      <p><strong>Notes:</strong> ${costEstimate.items.price_notes}</p>
    </div>
    ` : ''}

    <div class="terms">
      <div class="terms-title">Terms and Conditions:</div>
      ${(costEstimate.template?.terms_and_conditions || [
        "Quotation validity: 5 working days.",
      "Site availability: First-come-first-served basis. Official documents required.",
      "Payment terms: One month advance and two months security deposit.",
      "Payment deadline: 7 days before rental start."
      ])
    .map((term, index) => `<div class="term-item">${index + 1}. ${term}</div>`).join('')}
    </div>

    ${costEstimate.template?.closing_message ? `
    <div class="closing-message" style="page-break-inside: avoid;">
      <p>${costEstimate.template.closing_message}</p>
    </div>
    ` : ''}

    <div class="signatures">
      <div class="signature-section">
        <div>Very truly yours,</div>
       ${userSignatureDataUrl ? `<img src="${userSignatureDataUrl}" alt="Signature" style="max-width: 200px; max-height: 60px; margin: 10px 0;" /><div class="signature-line"></div>` : '<div class="signature-line"></div>'}
        <div>${userData?.first_name && userData?.last_name ? `${userData.first_name} ${userData.last_name}` : companyData?.company_name || "Golden Touch Imaging Specialist"}</div>
        <div>${costEstimate.signature_position || "Sales"}</div>
      </div>
    </div>
        <div class="page-footer" style="font-size:8px; width:100%; text-align:center; padding:2px 0; color: #444;">
          <div>${companyData?.company_name || companyData?.name}</div>
          <div>${formatCompanyAddress(companyData)}</div>
          <div>Tel: ${companyData?.phone || 'N/A'} | Email: ${companyData?.email || 'N/A'}</div>
        </div>
  </body>
  </html>
  `
}