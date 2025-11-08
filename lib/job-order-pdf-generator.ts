import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import type { JobOrder } from "@/lib/types/job-order"

// Helper function to safely convert to Date
function safeToDate(dateValue: any): Date {
  if (dateValue instanceof Date) {
    return dateValue
  }
  if (typeof dateValue === "string" || typeof dateValue === "number") {
    return new Date(dateValue)
  }
  if (dateValue && typeof dateValue.toDate === "function") {
    return dateValue.toDate()
  }
  return new Date() // fallback to current date
}

// Helper function to format currency
function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === "string" ? Number.parseFloat(amount.replace(/[^\d.-]/g, "")) : amount
  const cleanAmount = Math.abs(Number(numAmount) || 0)
  return `PHP ${cleanAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Generate HTML template for job order PDF
function generateJobOrderHTML(jobOrder: JobOrder): string {
  const dateRequested = safeToDate(jobOrder.dateRequested)
  const deadline = safeToDate(jobOrder.deadline)
  const contractStart = jobOrder.contractPeriodStart ? safeToDate(jobOrder.contractPeriodStart) : null
  const contractEnd = jobOrder.contractPeriodEnd ? safeToDate(jobOrder.contractPeriodEnd) : null

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Job Order - ${jobOrder.joNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Helvetica', 'Arial', sans-serif;
          font-size: 10px;
          line-height: 1.3;
          color: #333;
          background: white;
        }

        .container {
          max-width: 750px;
          margin: 0 auto;
          padding: 15px;
        }

        .header {
          background: linear-gradient(to right, #2563eb, #3b82f6);
          color: white;
          padding: 15px;
          margin-bottom: 20px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 750px;
          margin: 0 auto;
        }

        .header-left {
          flex: 1;
        }

        .header-right {
          flex: 0;
        }

        .logo-section {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .logo {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }

        .company-name {
          font-size: 18px;
          font-weight: bold;
          color: #2563eb;
          margin-left: 15px;
        }

        .title {
          font-size: 28px;
          font-weight: bold;
          color: white;
          margin: 10px 0;
        }

        .jo-number {
          font-size: 16px;
          color: #e0e7ff;
          margin-bottom: 10px;
        }

     .status-badge {
      font-size: 12px;
      font-weight: bold;
      color: white;
      }

        .status-completed { background: rgba(34, 197, 94, 0.2); color: #dcfce7; border-color: #16a34a; }
        .status-pending { background: rgba(245, 158, 11, 0.2); color: #fef3c7; border-color: #d97706; }
        .status-approved { background: rgba(59, 130, 246, 0.2); color: #dbeafe; border-color: #2563eb; }
        .status-in-progress { background: rgba(59, 130, 246, 0.2); color: #dbeafe; border-color: #2563eb; }

        .section {
          margin-bottom: 12px;
        }

        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #1f2937;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .info-item {
          margin-bottom: 8px;
        }

        .info-label {
          font-weight: 600;
          color: #6b7280;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 4px;
        }

        .info-value {
          color: #1f2937;
          font-size: 12px;
          font-weight: 500;
        }

        .site-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
          margin-top: 10px;
        }

        .site-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }

        .site-info h4 {
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 2px;
        }

        .site-info p {
          color: #6b7280;
          font-size: 11px;
        }

        .attachments {
          margin-top: 10px;
        }

        .attachment-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f9fafb;
          border-radius: 4px;
          margin-bottom: 5px;
        }

        .attachment-icon {
          width: 16px;
          height: 16px;
          color: #6b7280;
        }

        .financial-summary {
          background: #f0f9ff;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #2563eb;
        }

        .financial-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .financial-label {
          font-weight: bold;
          color: #1f2937;
        }

        .financial-value {
          color: #1f2937;
        }

        .total-row {
          border-top: 1px solid #2563eb;
          padding-top: 8px;
          margin-top: 8px;
        }

        .timeline {
          position: relative;
          padding-left: 30px;
        }

        .timeline-item {
          position: relative;
          margin-bottom: 20px;
        }

        .timeline-marker {
          position: absolute;
          left: -35px;
          top: 5px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #d1d5db;
          border: 2px solid #9ca3af;
        }

        .timeline-marker.completed {
          background: #10b981;
          border-color: #059669;
        }

        .timeline-marker.approved {
          background: #3b82f6;
          border-color: #2563eb;
        }

        .timeline-content h4 {
          font-size: 14px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .timeline-content p {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .footer {
          margin-top: 15px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 9px;
          color: #9ca3af;
        }

        @media print {
          body {
            font-size: 11px;
          }

          .container {
            padding: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="header-content">
            <div class="header-left">
              <h1 class="title">JOB ORDER DETAILS</h1>
              <div class="jo-number">Job Order: ${jobOrder.joNumber}</div>
            </div>
            <div class="header-right">
              <p class="status-badge">
                ${jobOrder.status?.toUpperCase() || 'PENDING'}
              </p>
            </div>
          </div>
        </div>

        <!-- Basic Information -->
        <div class="section">
          <h2 class="section-title">Basic Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Job Order Number</div>
              <div class="info-value">${jobOrder.joNumber}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Job Type</div>
              <div class="info-value">${jobOrder.joType}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Site Name</div>
              <div class="info-value">${jobOrder.siteName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Site Location</div>
              <div class="info-value">${jobOrder.siteLocation || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Requested By</div>
              <div class="info-value">${jobOrder.requestedBy}</div>
            </div>
            <div class="info-item">
            </div>
            <div class="info-item">
              <div class="info-label">Date Requested</div>
              <div class="info-value">${dateRequested.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Deadline</div>
              <div class="info-value">${deadline.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</div>
            </div>
          </div>
        </div>

        <!-- Client Information -->
        <div class="section">
          <h2 class="section-title">Client Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Client Company</div>
              <div class="info-value">${jobOrder.clientCompany || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Client Name</div>
              <div class="info-value">${jobOrder.clientName || 'N/A'}</div>
            </div>
            ${jobOrder.quotationNumber ? `
            <div class="info-item">
              <div class="info-label">Quotation Number</div>
              <div class="info-value">${jobOrder.quotationNumber}</div>
            </div>
            ` : ''}
          </div>
        </div>

        ${jobOrder.jobDescription || jobOrder.remarks || jobOrder.message || (jobOrder.attachments && jobOrder.attachments.length > 0) ? `
        <!-- Additional Information -->
        <div class="section">
          <h2 class="section-title">Additional Information</h2>
          <div class="info-grid">
            ${jobOrder.jobDescription ? `
            <div class="info-item">
              <div class="info-label">Job Description</div>
              <div class="info-value">${jobOrder.jobDescription}</div>
            </div>
            ` : ''}
            ${jobOrder.remarks ? `
            <div class="info-item">
              <div class="info-label">Remarks</div>
              <div class="info-value">${jobOrder.remarks}</div>
            </div>
            ` : ''}
            ${jobOrder.message ? `
            <div class="info-item">
              <div class="info-label">Message</div>
              <div class="info-value">${jobOrder.message}</div>
            </div>
            ` : ''}
            ${jobOrder.attachments && jobOrder.attachments.length > 0 ? `
            <div class="info-item">
              <div class="info-label">Attachments</div>
              <div class="info-value">${jobOrder.attachments.length} file(s)</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Timeline -->
        <div class="section">
          <h2 class="section-title">Timeline</h2>
          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h4>Job Order Created</h4>
                <p>${dateRequested.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-marker ${jobOrder.status?.toLowerCase() === 'completed' ? 'completed' : jobOrder.status?.toLowerCase() === 'approved' ? 'approved' : ''}"></div>
              <div class="timeline-content">
                <h4>Current Status</h4>
                <p>${jobOrder.status || 'Pending'}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Main function to generate PDF from HTML
export async function generateJobOrderPDF(jobOrder: JobOrder, action: 'download' | 'print' = 'print', returnBase64 = false): Promise<string | void> {
  try {
    // Create HTML content
    const htmlContent = generateJobOrderHTML(jobOrder)

    // Create a temporary container for the HTML
    const container = document.createElement('div')
    container.innerHTML = htmlContent
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    container.style.width = '800px'
    document.body.appendChild(container)

    // Use html2canvas to capture the HTML as image
    const canvas = await html2canvas(container, {
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 800,
      height: container.scrollHeight,
    })

    // Remove temporary container
    document.body.removeChild(container)

    // Create PDF from canvas
    const imgData = canvas.toDataURL('image/jpeg', 0.7)
    const pdf = new jsPDF('p', 'mm', 'a4')

    const imgWidth = 210 // A4 width in mm
    const pageHeight = 295 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = 0

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    if (returnBase64) {
      return pdf.output('datauristring').split(',')[1]
    } else if (action === 'download') {
      // Always download
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `job-order-${jobOrder.joNumber.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pdfUrl)
    } else {
      // Print mode
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const printWindow = window.open(pdfUrl, '_blank')
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      } else {
        // Fallback: download if popup is blocked
        const link = document.createElement('a')
        link.href = pdfUrl
        link.download = `job-order-${jobOrder.joNumber.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      URL.revokeObjectURL(pdfUrl)
    }
  } catch (error) {
    console.error('Error generating job order PDF:', error)
    throw new Error('Failed to generate job order PDF')
  }
}

// Legacy function for backward compatibility (can be removed after migration)
export async function generateJobOrderPDFLegacy(jobOrder: JobOrder, returnBase64 = false): Promise<string | void> {
  // This can call the new HTML-based generator
  return generateJobOrderPDF(jobOrder, 'print', returnBase64)
}