import { type NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import { getReportById, type ReportData } from "@/lib/report-service"
import { getProductById, type Product } from "@/lib/firebase-service"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Helper function to safely convert dates
function safeToDate(dateValue: any): Date {
  if (!dateValue) return new Date()
  if (dateValue instanceof Date) return dateValue
  if (dateValue.toDate && typeof dateValue.toDate === "function") return dateValue.toDate()
  return new Date(dateValue)
}

// Helper function to format date exactly like the preview page
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
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

const calculateInstallationDuration = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
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

  // Helper function to load image and convert to base64
  async function loadImageAsBase64(url: string): Promise<string | null> {
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

  try {
    console.log("Starting jsPDF generation for report:", reportId)

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
        const userDocRef = doc(db, "boohk_users", report.createdBy)
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

    // Create PDF using jsPDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin

    // Set font
    pdf.setFont('helvetica')

    // Header
    pdf.setFillColor(30, 58, 138) // Blue background
    pdf.rect(0, 0, pageWidth, 25, 'F')

    // Cyan accent on the right
    pdf.setFillColor(6, 182, 212) // Cyan
    pdf.rect(pageWidth * 0.6, 0, pageWidth * 0.4, 25, 'F')

    // Header text
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.text('Sales', margin, 17)

    yPosition = 40

    // Report type badge
    pdf.setFillColor(6, 182, 212) // Cyan
    pdf.roundedRect(margin, yPosition, 60, 12, 2, 2, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.text(getReportTypeDisplay(report.reportType), margin + 5, yPosition + 8)

    // Date
    pdf.setTextColor(100, 116, 139)
    pdf.setFontSize(9)
    pdf.text(`as of ${formatDate(report.date)}`, margin, yPosition + 20)

    // Company logo placeholder (right side)
    if (companyData?.photo_url) {
      try {
        const logoBase64 = await loadImageAsBase64(companyData.photo_url)
        if (logoBase64) {
          // Add logo image (simplified - would need proper sizing)
          pdf.addImage(logoBase64, 'JPEG', pageWidth - 60, yPosition - 10, 40, 40)
        }
      } catch (error) {
        console.error('Error loading company logo:', error)
      }
    }

    yPosition += 35

    // Project Information section
    pdf.setTextColor(17, 24, 39)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Project Information', margin, yPosition)
    yPosition += 10

    // Draw border
    pdf.setDrawColor(229, 231, 235)
    pdf.setLineWidth(0.5)
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 80)

    yPosition += 5

    // Left column
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Site ID:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getSiteLocation(product), margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Job Order:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(report.joNumber || report.id?.slice(-4).toUpperCase() || "N/A", margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Job Order Date:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(formatDate(report.date), margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Site:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getSiteName(report), margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Size:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getSiteSize(product), margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Start Date:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    const startDate = report.bookingDates?.start ?
      (typeof report.bookingDates.start === 'string' ? report.bookingDates.start : report.bookingDates.start.toDate().toISOString()) : null
    pdf.text(startDate ? formatDate(startDate) : "N/A", margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('End Date:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    const endDate = report.bookingDates?.end ?
      (typeof report.bookingDates.end === 'string' ? report.bookingDates.end : report.bookingDates.end.toDate().toISOString()) : null
    pdf.text(endDate ? formatDate(endDate) : "N/A", margin + 25, yPosition)

    yPosition += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Installation Duration:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    const duration = startDate && endDate ? `${calculateInstallationDuration(startDate, endDate)} days` : "N/A"
    pdf.text(duration, margin + 25, yPosition)

    // Right column
    let rightY = yPosition - 32 // Reset to same starting position
    const rightX = pageWidth / 2 + 10

    pdf.setFont('helvetica', 'bold')
    pdf.text('Content:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(product?.content_type || "Static", rightX + 20, rightY)

    rightY += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Material Specs:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getMaterialSpecs(product), rightX + 20, rightY)

    rightY += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Crew:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Team ${report.assignedTo || "Sales"}`, rightX + 20, rightY)

    rightY += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Illumination:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getIllumination(product), rightX + 20, rightY)

    rightY += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Gondola:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getGondola(product), rightX + 20, rightY)

    rightY += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Technology:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(getTechnology(product), rightX + 20, rightY)

    rightY += 8
    pdf.setFont('helvetica', 'bold')
    pdf.text('Sales:', rightX, rightY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(report.sales || "N/A", rightX + 20, rightY)

    // Project Status section
    yPosition += 25
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Project Status', margin, yPosition)

    // Status badge
    const percentage = getCompletionPercentage(report)
    let statusColor = [239, 68, 68] // Red
    if (percentage >= 90) statusColor = [16, 185, 129] // Green
    else if (percentage >= 70) statusColor = [245, 158, 11] // Yellow
    else if (percentage >= 50) statusColor = [249, 115, 22] // Orange

    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.roundedRect(margin + 50, yPosition - 5, 25, 8, 2, 2, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.text(`${percentage}%`, margin + 55, yPosition)

    // Footer
    const footerY = pageHeight - 30
    pdf.setFillColor(6, 182, 212) // Cyan background
    pdf.rect(0, footerY, pageWidth, 30, 'F')

    pdf.setFillColor(30, 58, 138) // Blue accent
    pdf.rect(pageWidth * 0.75, footerY, pageWidth * 0.25, 30, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.text('Smart. Seamless. Scalable', pageWidth - margin - 80, footerY + 12)
    pdf.setFontSize(16)
    pdf.text('OH!', pageWidth - margin - 20, footerY + 20)

    // Prepared by section
    pdf.setTextColor(17, 24, 39)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Prepared by:', margin, footerY - 15)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(companyData?.company_name || "Boohk", margin, footerY - 5)
    pdf.text('SALES', margin, footerY + 2)
    pdf.text(formatDate(report.date), margin, footerY + 9)

    const pdfBuffer = pdf.output('arraybuffer')

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
  }
}