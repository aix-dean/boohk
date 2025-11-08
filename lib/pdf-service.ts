import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import type { Proposal } from "@/lib/types/proposal"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import type { ReportData } from "@/lib/report-service"
import type { JobOrder } from "@/lib/types/job-order"
import { doc, getDoc } from "firebase/firestore"
import { getStorage, ref, getDownloadURL } from "firebase/storage"
import { db } from "@/lib/firebase"
import { PDFDocument, PDFName } from 'pdf-lib'

// Helper function to load image and convert to base64
export async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    let fetchUrl = url

    // Check if this is a Firebase Storage URL
    if (url.includes('firebasestorage.googleapis.com')) {
      try {
        // Extract the path from Firebase Storage URL
        const urlObj = new URL(url)
        const pathMatch = urlObj.pathname.match(/\/v0\/b\/[^\/]+\/o\/(.+)/)
        if (pathMatch) {
          const encodedPath = pathMatch[1]
          const decodedPath = decodeURIComponent(encodedPath)

          // Get Firebase Storage reference and download URL
          const storage = getStorage()
          const storageRef = ref(storage, decodedPath)
          fetchUrl = await getDownloadURL(storageRef)
        }
      } catch (firebaseError) {
        console.warn("Failed to get Firebase download URL, falling back to original URL:", firebaseError)
        // Fall back to original URL if Firebase auth fails
      }
    }

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(fetchUrl, {
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
    // Return null for failed image loads instead of throwing
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

// Helper function to compress image using canvas
export async function compressImage(base64: string, quality: number = 0.8, maxWidth: number = 800, maxHeight: number = 600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(base64) // Fallback to original if canvas not available
        return
      }

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img
      const aspectRatio = width / height

      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }
      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality)

      resolve(compressedBase64)
    }
    img.onerror = () => resolve(base64) // Fallback to original on error
    img.src = base64
  })
}

// Helper function to generate QR code using online service
export async function generateQRCode(text: string): Promise<string> {
  try {
    // Using QR Server API for basic QR code generation
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
    return qrUrl
  } catch (error) {
    console.error("Error generating QR code:", error)
    throw error
  }
}

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

// Helper function to set PDF viewer preferences including initial zoom
async function setPDFViewerPreferences(pdfBytes: Uint8Array, zoom: number = 1.25): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)

  // Get the first page
  const pages = pdfDoc.getPages()
  if (pages.length > 0) {
    const firstPage = pages[0]

    // Create a GoTo action with zoom
    const action = pdfDoc.context.obj({
      Type: PDFName.of('Action'),
      S: PDFName.of('GoTo'),
      D: [firstPage.ref, PDFName.of('XYZ'), null, null, zoom]
    })

    // Set OpenAction on catalog
    pdfDoc.catalog.set(PDFName.of('OpenAction'), action)
  }

  return await pdfDoc.save()
}

async function logProposalPDFGenerated(proposalId: string, userId: string, userName: string): Promise<void> {
  // Placeholder for the actual logging implementation
  console.log(`PDF generated for proposal ${proposalId} by user ${userId} (${userName})`)
  return Promise.resolve()
}

// New helper function to calculate image dimensions for fitting with compression
async function calculateImageFitDimensions(
  imageUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.7, // Default quality for PDF compression
  isForEmail: boolean = false,
): Promise<{ base64: string | null; width: number; height: number }> {
  const base64 = await loadImageAsBase64(imageUrl)
  if (!base64) return { base64: null, width: 0, height: 0 }

  const dimensions = await getImageDimensions(base64)
  let { width, height } = dimensions
  const aspectRatio = width / height

  // Scale to fit within max bounds
  if (width > maxWidth) {
    width = maxWidth
    height = width / aspectRatio
  }
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }

  // For email optimization, further reduce dimensions
  if (isForEmail) {
    const MAX_EMAIL_DIMENSION = 300 // Max 300px for email attachments
    if (width > MAX_EMAIL_DIMENSION || height > MAX_EMAIL_DIMENSION) {
      if (width > height) {
        width = MAX_EMAIL_DIMENSION
        height = width / aspectRatio
      } else {
        height = MAX_EMAIL_DIMENSION
        width = height * aspectRatio
      }
    }
  }

  // Compress the image using canvas
  const compressedBase64 = await compressImage(base64, quality, width, height)

  return { base64: compressedBase64, width, height }
}

// Helper function to format currency without +/- signs
function formatCurrency(amount: number | string): string {
  // Convert to number and ensure it's positive
  const numAmount = typeof amount === "string" ? Number.parseFloat(amount.replace(/[^\d.-]/g, "")) : amount
  const cleanAmount = Math.abs(Number(numAmount) || 0)
  return `PHP${cleanAmount.toLocaleString()}`
}

// Helper function to resolve company logo based on user/company data
async function resolveCompanyLogo(userData?: any, projectData?: any): Promise<string> {
  // Priority order: project logo -> user company logo -> company name mapping -> default OH+ logo

  console.log("resolveCompanyLogo - userData:", userData)
  console.log("resolveCompanyLogo - projectData:", projectData)

  // Check if project has a custom logo URL (photo_url is commonly used)
  if (projectData?.photo_url && typeof projectData.photo_url === "string" && projectData.photo_url.trim() !== "") {
    try {
      const testResponse = await fetch(projectData.photo_url, { method: "HEAD" })
      if (testResponse.ok) {
        console.log("Using projectData.photo_url:", projectData.photo_url)
        return projectData.photo_url
      }
    } catch (error) {
      console.log("Project photo_url not accessible:", projectData.photo_url)
    }
  }

  // Check if user's company has a logo URL
  if (userData?.photo_url && typeof userData.photo_url === "string" && userData.photo_url.trim() !== "") {
    try {
      const testResponse = await fetch(userData.photo_url, { method: "HEAD" })
      if (testResponse.ok) {
        console.log("Using userData.photo_url:", userData.photo_url)
        return userData.photo_url
      }
    } catch (error) {
      console.log("User photo_url not accessible:", userData.photo_url)
    }
  }

  // Check alternative company logo fields
  if (
    userData?.company?.photo_url &&
    typeof userData.company.photo_url === "string" &&
    userData.company.photo_url.trim() !== ""
  ) {
    try {
      const testResponse = await fetch(userData.company.photo_url, { method: "HEAD" })
      if (testResponse.ok) {
        console.log("Using userData.company.photo_url:", userData.company.photo_url)
        return userData.company.photo_url
      }
    } catch (error) {
      console.log("User company photo_url not accessible:", userData.company.photo_url)
    }
  }

  // Check for company-specific logos based on company name
  const companyName = (
    projectData?.company_name ||
    projectData?.name ||
    userData?.company_name ||
    userData?.displayName ||
    userData?.display_name ||
    ""
  )
    .toLowerCase()
    .trim()

  if (companyName) {
    // Map company names to their logo files
    const companyLogos: Record<string, string> = {
      dedos: "/company-logos/dedos-logo.png",
      gts: "/company-logos/gts-logo.png",
      "global tronics": "/company-logos/gts-logo.png",
      globaltronics: "/globaltronics-logo.png",
      "summit media": "/summit-media-logo.png",
      "vistar media": "/vistar-media-logo.png",
      "moving walls": "/moving-walls-logo.png",
      "hdi admix": "/hdi-admix-logo.png",
      broadsign: "/broadsign-logo.png",
      dooh: "/dooh-logo.png",
      "ooh shop": "/ooh-shop-logo.png",
    }

    // Check for exact match first
    if (companyLogos[companyName]) {
      console.log("Using company name mapping:", companyName, "->", companyLogos[companyName])
      return companyLogos[companyName]
    }

    // Check for partial matches
    for (const [key, logoPath] of Object.entries(companyLogos)) {
      if (companyName.includes(key) || key.includes(companyName)) {
        console.log("Using partial company name mapping:", companyName, "contains", key, "->", logoPath)
        return logoPath
      }
    }
  }

  // Default fallback to OH+ logo
  console.log("Using default OH+ logo")
  return "/ohplus-new-logo.png"
}

// Service Assignment interface for PDF generation
interface ServiceAssignmentPDFData {
  saNumber: string
  projectSiteName: string
  projectSiteLocation: string
  serviceType: string
  assignedTo: string
  assignedToName?: string
  serviceDuration: string
  priority: string
  equipmentRequired: string
  materialSpecs: string
  crew: string
  crewName?: string
  illuminationNits?: string
  gondola: string
  technology: string
  sales: string
  campaignName?: string
  remarks: string
  requestedBy?: {
    name: string
    department: string
  }
  requestBy?: string // User ID field
  startDate: Date | null
  endDate: Date | null
  alarmDate: Date | null
  alarmTime: string
  attachments: { name: string; type: string; url?: string; fileUrl?: string }[]
  serviceExpenses: { name: string; amount: string }[]
  status: string
  created: Date
}

export async function generateServiceAssignmentDetailsPDF(
  assignmentData: any,
  jobOrderData: any,
  products: any[],
  teams: any[],
  returnBase64 = false,
): Promise<string | void> {
  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
      pdf.setFontSize(fontSize)
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return y + lines.length * fontSize * 0.3
    }

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 20) {
        pdf.addPage()
        yPosition = margin
      }
    }

    // Page 1: Service Assignment Card
    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT", margin, yPosition)
    yPosition += 15

    // SA Number
    pdf.setFontSize(18)
    pdf.text(`SA# ${assignmentData.saNumber}`, margin, yPosition)
    yPosition += 10

    // Status badge
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed":
          return [34, 197, 94] // green
        case "pending":
          return [234, 179, 8] // yellow
        case "in progress":
          return [59, 130, 246] // blue
        default:
          return [107, 114, 128] // gray
      }
    }

    const statusColor = getStatusColor(assignmentData.status)
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.rect(margin, yPosition, 25, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text(assignmentData.status.toUpperCase(), margin + 2, yPosition + 5)
    pdf.setTextColor(0, 0, 0)
    yPosition += 20

    // Service Assignment Information Section
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT INFORMATION", margin, yPosition)
    yPosition += 8

    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Two column layout
    const leftColumn = margin
    const rightColumn = margin + contentWidth / 2

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")

    // Left column
    let leftY = yPosition
    const leftColumnData = [
      { label: "SA Number:", value: assignmentData.saNumber },
      { label: "Project Site:", value: assignmentData.projectSiteName },
      { label: "Location:", value: assignmentData.projectSiteLocation || "N/A" },
      { label: "Service Type:", value: assignmentData.serviceType },
      { label: "Assigned To:", value: assignmentData.assignedToName || assignmentData.assignedTo },
      { label: "Duration:", value: assignmentData.serviceDuration ? `${assignmentData.serviceDuration} hours` : "N/A" },
      { label: "Priority:", value: assignmentData.priority },
    ]

    // Display all fields in a single column layout, one row per field
    const allFields = [
      { label: "SA Number:", value: assignmentData.saNumber },
      { label: "Project Site:", value: assignmentData.projectSiteName },
      { label: "Location:", value: assignmentData.projectSiteLocation || "N/A" },
      { label: "Service Type:", value: assignmentData.serviceType },
      { label: "Assigned To:", value: assignmentData.assignedToName || assignmentData.assignedTo },
      { label: "Duration:", value: assignmentData.serviceDuration ? `${assignmentData.serviceDuration} hours` : "N/A" },
      { label: "Priority:", value: assignmentData.priority },
      { label: "Created:", value: assignmentData.created?.toDate?.()?.toLocaleDateString() || "N/A" },
      { label: "Start Date:", value: assignmentData.coveredDateStart?.toDate?.()?.toLocaleDateString() || "N/A" },
      { label: "End Date:", value: assignmentData.coveredDateEnd?.toDate?.()?.toLocaleDateString() || "N/A" },
      { label: "Alarm Date:", value: assignmentData.alarmDate?.toDate?.()?.toLocaleDateString() || "N/A" },
      { label: "Alarm Time:", value: assignmentData.alarmTime || "N/A" },
      { label: "Illumination:", value: assignmentData.illuminationNits ? `${assignmentData.illuminationNits} nits` : "N/A" },
      { label: "Gondola:", value: assignmentData.gondola || "N/A" },
      { label: "Technology:", value: assignmentData.technology || "N/A" },
    ]

    allFields.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, margin, yPosition)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, margin + 40, yPosition)
      yPosition += 8
    })

    yPosition += 10

    // Equipment and Materials Section
    if (assignmentData.equipmentRequired || assignmentData.materialSpecs) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("EQUIPMENT & MATERIALS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      if (assignmentData.equipmentRequired) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Equipment Required:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(assignmentData.equipmentRequired, margin, yPosition, contentWidth)
        yPosition += 5
      }

      if (assignmentData.materialSpecs) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Material Specifications:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(assignmentData.materialSpecs, margin, yPosition, contentWidth)
      }

      yPosition += 10
    }

    // Remarks Section
    if (assignmentData.message || assignmentData.jobDescription) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("REMARKS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      const remarks = assignmentData.message || assignmentData.jobDescription || "N/A"
      yPosition = addText(remarks, margin, yPosition, contentWidth)
      yPosition += 10
    }

    // Requested By Section
    checkNewPage(20)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("REQUESTED BY", margin, yPosition)
    yPosition += 8

    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")
    const requestedBy = assignmentData.requestedBy
    if (requestedBy) {
      pdf.text(`${requestedBy.department} - ${requestedBy.name}`, margin, yPosition)
    } else {
      pdf.text("N/A", margin, yPosition)
    }

    // Page 2: Job Order Card (if exists)
    if (jobOrderData) {
      pdf.addPage()
      yPosition = margin

      pdf.setFontSize(24)
      pdf.setFont("helvetica", "bold")
      pdf.text("JOB ORDER", margin, yPosition)
      yPosition += 15

      // JO Number
      pdf.setFontSize(18)
      pdf.text(`JO# ${jobOrderData.joNumber}`, margin, yPosition)
      yPosition += 10

      // Status badge
      const joStatusColor = getStatusColor(jobOrderData.status)
      pdf.setFillColor(joStatusColor[0], joStatusColor[1], joStatusColor[2])
      pdf.rect(margin, yPosition, 25, 8, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text(jobOrderData.status.toUpperCase(), margin + 2, yPosition + 5)
      pdf.setTextColor(0, 0, 0)

      // Type badge
      const getTypeColor = (type: string) => {
        switch (type?.toLowerCase()) {
          case "installation":
            return [59, 130, 246] // blue
          case "maintenance":
            return [234, 179, 8] // yellow
          case "repair":
            return [239, 68, 68] // red
          case "dismantling":
            return [107, 114, 128] // gray
          default:
            return [147, 51, 234] // purple
        }
      }

      const typeColor = getTypeColor(jobOrderData.joType)
      pdf.setFillColor(typeColor[0], typeColor[1], typeColor[2])
      pdf.rect(margin + 30, yPosition, 30, 8, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.text(jobOrderData.joType.toUpperCase(), margin + 32, yPosition + 5)
      pdf.setTextColor(0, 0, 0)

      yPosition += 20

      // Job Order Information Section
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("JOB ORDER INFORMATION", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.setDrawColor(200, 200, 200)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      // Two column layout for job information
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      // Display all job order fields in a single column layout, one row per field
      const joAllFields = [
        { label: "JO Number:", value: jobOrderData.joNumber },
        { label: "Site Name:", value: jobOrderData.siteName },
        { label: "Site Code:", value: jobOrderData.siteCode || "N/A" },
        { label: "Site Location:", value: jobOrderData.siteLocation || "N/A" },
        { label: "Site Type:", value: jobOrderData.siteType || "N/A" },
        { label: "Site Size:", value: jobOrderData.siteSize || "N/A" },
        { label: "Requested By:", value: jobOrderData.requestedBy },
        { label: "Assigned To:", value: jobOrderData.assignTo },
        { label: "Date Requested:", value: jobOrderData.dateRequested?.toDate?.()?.toLocaleDateString() || "N/A" },
        { label: "Deadline:", value: jobOrderData.deadline?.toDate?.()?.toLocaleDateString() || "N/A" },
        { label: "Client Company:", value: jobOrderData.clientCompany || "N/A" },
        { label: "Client Name:", value: jobOrderData.clientName || "N/A" },
        { label: "Quotation No.:", value: jobOrderData.quotationNumber || "N/A" },
        { label: "Total Amount:", value: jobOrderData.totalAmount ? formatCurrency(jobOrderData.totalAmount) : "N/A" },
        { label: "VAT Amount:", value: jobOrderData.vatAmount ? formatCurrency(jobOrderData.vatAmount) : "N/A" },
        { label: "Contract Duration:", value: jobOrderData.contractDuration || "N/A" },
      ]

      joAllFields.forEach((item) => {
        pdf.setFont("helvetica", "bold")
        pdf.text(item.label, margin, yPosition)
        pdf.setFont("helvetica", "normal")
        pdf.text(item.value, margin + 40, yPosition)
        yPosition += 8
      })

      yPosition += 10

      // Job Description Section
      if (jobOrderData.jobDescription || jobOrderData.remarks) {
        checkNewPage(40)
        pdf.setFontSize(16)
        pdf.setFont("helvetica", "bold")
        pdf.text("JOB DESCRIPTION", margin, yPosition)
        yPosition += 8

        pdf.setLineWidth(0.5)
        pdf.line(margin, yPosition, pageWidth - margin, yPosition)
        yPosition += 10

        pdf.setFontSize(11)
        pdf.setFont("helvetica", "normal")

        if (jobOrderData.jobDescription) {
          yPosition = addText(jobOrderData.jobDescription, margin, yPosition, contentWidth)
          yPosition += 5
        }

        if (jobOrderData.remarks) {
          pdf.setFont("helvetica", "bold")
          pdf.text("Remarks:", margin, yPosition)
          pdf.setFont("helvetica", "normal")
          yPosition += 5
          yPosition = addText(jobOrderData.remarks, margin, yPosition, contentWidth)
        }

        yPosition += 10
      }

      // Site Image Section (if available)
      if (jobOrderData.siteImageUrl) {
        checkNewPage(80)
        pdf.setFontSize(16)
        pdf.setFont("helvetica", "bold")
        pdf.text("SITE IMAGE", margin, yPosition)
        yPosition += 8

        pdf.setLineWidth(0.5)
        pdf.line(margin, yPosition, pageWidth - margin, yPosition)
        yPosition += 10

        try {
          const { base64, width, height } = await calculateImageFitDimensions(
            jobOrderData.siteImageUrl,
            contentWidth * 0.8,
            60,
          )

          if (base64) {
            const imageX = margin + (contentWidth - width) / 2
            pdf.addImage(base64, "JPEG", imageX, yPosition, width, height)
            yPosition += height + 10
          }
        } catch (error) {
          console.error("Error adding site image:", error)
          pdf.setFontSize(10)
          pdf.setTextColor(100, 100, 100)
          pdf.text("Site image could not be loaded", margin, yPosition)
          pdf.setTextColor(0, 0, 0)
          yPosition += 15
        }
      }
    }

    // Page 3: Service Expense Card
    pdf.addPage()
    yPosition = margin

    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE EXPENSE", margin, yPosition)
    yPosition += 15

    // Service Cost Breakdown Section
    const expenses = assignmentData.serviceExpenses || []
    const hasExpenses = expenses.some((expense: any) => expense.name && expense.amount && Number.parseFloat(expense.amount) > 0)

    if (hasExpenses) {
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("SERVICE COST BREAKDOWN", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.setDrawColor(200, 200, 200)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      // All expenses in single column
      expenses.forEach((expense: any) => {
        if (expense.name && expense.amount && Number.parseFloat(expense.amount) > 0) {
          pdf.setFont("helvetica", "bold")
          pdf.text("Expense Name:", margin, yPosition)
          pdf.setFont("helvetica", "normal")
          pdf.text(expense.name, margin + 40, yPosition)
          yPosition += 8

          pdf.setFont("helvetica", "bold")
          pdf.text("Amount:", margin, yPosition)
          pdf.setFont("helvetica", "normal")
          pdf.text(formatCurrency(Number.parseFloat(expense.amount)), margin + 40, yPosition)
          yPosition += 8
        }
      })

      // Total
      yPosition += 5
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      const totalCost = expenses.reduce((sum: number, expense: any) => sum + (Number.parseFloat(expense.amount) || 0), 0)
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("TOTAL COST:", margin, yPosition)
      pdf.text(formatCurrency(totalCost), rightColumn, yPosition)
      yPosition += 15
    } else {
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "normal")
      pdf.text("No service expenses recorded", margin, yPosition)
    }

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `service-assignment-${assignmentData.saNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating Service Assignment Details PDF:", error)
    throw new Error("Unable to create service assignment PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateServiceAssignmentPDF(
  serviceAssignment: ServiceAssignmentPDFData,
  returnBase64 = false,
): Promise<string | void> {
  try {
    // Create new PDF document
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
      pdf.setFontSize(fontSize)
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return y + lines.length * fontSize * 0.3
    }

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 20) {
        pdf.addPage()
        yPosition = margin
      }
    }

    // Header with company branding
    pdf.setFillColor(30, 58, 138) // blue-900
    pdf.rect(0, 0, pageWidth, 25, "F")

    // Add white text for header
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT", margin, 15)

    // Add logistics badge
    pdf.setFontSize(8)
    pdf.text("LOGISTICS DEPARTMENT", pageWidth - margin - 50, 15)

    yPosition = 35
    pdf.setTextColor(0, 0, 0)

    // Service Assignment Title and Number
    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.text(`SA# ${serviceAssignment.saNumber}`, margin, yPosition)
    yPosition += 10

    // Status badge
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed":
          return [34, 197, 94] // green
        case "pending":
          return [234, 179, 8] // yellow
        case "approved":
          return [59, 130, 246] // blue
        case "draft":
          return [107, 114, 128] // gray
        default:
          return [107, 114, 128] // gray
      }
    }

    const statusColor = getStatusColor(serviceAssignment.status)
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.rect(margin, yPosition, 25, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text(serviceAssignment.status.toUpperCase(), margin + 2, yPosition + 5)
    pdf.setTextColor(0, 0, 0)

    yPosition += 20

    // Service Assignment Information Section
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT INFORMATION", margin, yPosition)
    yPosition += 8

    // Draw section separator
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Two column layout for service information
    const leftColumn = margin
    const rightColumn = margin + contentWidth / 2

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")

    // Left column
    let leftY = yPosition
    const leftColumnData = [
      { label: "SA Number:", value: serviceAssignment.saNumber },
      { label: "Project Site:", value: serviceAssignment.projectSiteName },
      { label: "Location:", value: serviceAssignment.projectSiteLocation || "N/A" },
      { label: "Service Type:", value: serviceAssignment.serviceType },
      { label: "Assigned To:", value: (serviceAssignment as any).assignedToName || serviceAssignment.assignedTo },
      {
        label: "Duration:",
        value: serviceAssignment.serviceDuration ? `${serviceAssignment.serviceDuration} hours` : "N/A",
      },
      { label: "Priority:", value: serviceAssignment.priority },
    ]

    leftColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, leftColumn, leftY)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, leftColumn + 35, leftY)
      leftY += 6
    })

    // Right column
    let rightY = yPosition
    const rightColumnData = [
      { label: "Created:", value: serviceAssignment.created.toLocaleDateString() },
      {
        label: "Start Date:",
        value: serviceAssignment.startDate ? serviceAssignment.startDate.toLocaleDateString() : "N/A",
      },
      { label: "End Date:", value: serviceAssignment.endDate ? serviceAssignment.endDate.toLocaleDateString() : "N/A" },
      {
        label: "Alarm Date:",
        value: serviceAssignment.alarmDate ? serviceAssignment.alarmDate.toLocaleDateString() : "N/A",
      },
      { label: "Alarm Time:", value: serviceAssignment.alarmTime || "N/A" },
      {
        label: "Illumination:",
        value: serviceAssignment.illuminationNits ? `${serviceAssignment.illuminationNits} nits` : "N/A",
      },
      { label: "Gondola:", value: serviceAssignment.gondola || "N/A" },
      { label: "Technology:", value: serviceAssignment.technology || "N/A" },
    ]

    rightColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, rightColumn, rightY)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, rightColumn + 35, rightY)
      rightY += 6
    })

    yPosition += 10

    // Equipment and Materials Section
    if (serviceAssignment.equipmentRequired || serviceAssignment.materialSpecs) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("EQUIPMENT & MATERIALS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      if (serviceAssignment.equipmentRequired) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Equipment Required:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(serviceAssignment.equipmentRequired, margin, yPosition, contentWidth)
        yPosition += 5
      }

      if (serviceAssignment.materialSpecs) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Material Specifications:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(serviceAssignment.materialSpecs, margin, yPosition, contentWidth)
      }

      yPosition += 10
    }

    // Service Cost Section
    const totalCost = serviceAssignment.serviceExpenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0)
    if (totalCost > 0) {
      checkNewPage(40)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("SERVICE COST BREAKDOWN", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      // All expenses
      serviceAssignment.serviceExpenses.forEach((expense) => {
        if (expense.name && expense.amount && Number.parseFloat(expense.amount) > 0) {
          pdf.setFont("helvetica", "bold")
          pdf.text(`${expense.name}:`, margin, yPosition)
          pdf.setFont("helvetica", "normal")
          pdf.text(formatCurrency(Number.parseFloat(expense.amount)), rightColumn, yPosition)
          yPosition += 6
        }
      })

      // Total
      yPosition += 5
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("TOTAL COST:", margin, yPosition)
      pdf.text(formatCurrency(totalCost), margin + 40, yPosition)
      yPosition += 15
    }

    // Remarks Section
    if (serviceAssignment.remarks) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("REMARKS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      yPosition = addText(serviceAssignment.remarks, margin, yPosition, contentWidth)
      yPosition += 10
    }

    // Requested By Section
    checkNewPage(20)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("REQUESTED BY", margin, yPosition)
    yPosition += 8

    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")
    pdf.text(`${serviceAssignment.requestedBy?.department || "LOGISTICS"} - ${serviceAssignment.requestedBy?.name || "Unknown User"}`, margin, yPosition)
    yPosition += 15

    // Footer
    checkNewPage(30)
    yPosition = pageHeight - 40

    // Footer separator
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Footer content
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)

    pdf.text("Generated by Boohk Platform - Logistics Department", margin, yPosition)
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition + 5)

    // Company info on the right
    pdf.text("Smart. Seamless. Scalable.", pageWidth - margin - 50, yPosition)
    pdf.setFont("helvetica", "bold")
    pdf.text("OH+", pageWidth - margin - 15, yPosition + 5)

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      // Return base64 string for email attachment
      const base64 = Buffer.from(modifiedPdfBytes).toString('base64')
      return base64
    } else {
      // Save the PDF for download
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `service-assignment-${serviceAssignment.saNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating Service Assignment PDF:", error)
    throw new Error("Unable to create service assignment PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateJobOrderPDF(jobOrder: JobOrder, returnBase64 = false): Promise<string | void> {
  try {
    // Create new PDF document
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    // Safely convert dates
    const dateRequested = safeToDate(jobOrder.dateRequested)
    const deadline = safeToDate(jobOrder.deadline)
    const contractStart = jobOrder.contractPeriodStart ? safeToDate(jobOrder.contractPeriodStart) : null
    const contractEnd = jobOrder.contractPeriodEnd ? safeToDate(jobOrder.contractPeriodEnd) : null

    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
      pdf.setFontSize(fontSize)
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return y + lines.length * fontSize * 0.3
    }

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 20) {
        pdf.addPage()
        yPosition = margin
      }
    }

    // Header with company branding
    pdf.setFillColor(30, 58, 138) // blue-900
    pdf.rect(0, 0, pageWidth, 25, "F")

    // Add white text for header
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    pdf.text("JOB ORDER", margin, 15)

    // Add department badge from props
    pdf.setFontSize(10)
    pdf.text("LOGISTICS DEPARTMENT", pageWidth - margin - 50, 15)

    yPosition = 35
    pdf.setTextColor(0, 0, 0)

    // Job Order Title and Number
    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.text(jobOrder.joNumber, margin, yPosition)
    yPosition += 10

    // Status badge
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed":
          return [34, 197, 94] // green
        case "pending":
          return [234, 179, 8] // yellow
        case "approved":
          return [59, 130, 246] // blue
        case "rejected":
          return [239, 68, 68] // red
        default:
          return [107, 114, 128] // gray
      }
    }

    const statusColor = getStatusColor(jobOrder.status)
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.rect(margin, yPosition, 25, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text(jobOrder.status.toUpperCase(), margin + 2, yPosition + 5)
    pdf.setTextColor(0, 0, 0)

    // Type badge
    const getTypeColor = (type: string) => {
      switch (type?.toLowerCase()) {
        case "installation":
          return [59, 130, 246] // blue
        case "maintenance":
          return [234, 179, 8] // yellow
        case "repair":
          return [239, 68, 68] // red
        case "dismantling":
          return [107, 114, 128] // gray
        default:
          return [147, 51, 234] // purple
      }
    }

    const typeColor = getTypeColor(jobOrder.joType)
    pdf.setFillColor(typeColor[0], typeColor[1], typeColor[2])
    pdf.rect(margin + 30, yPosition, 30, 8, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.text(jobOrder.joType.toUpperCase(), margin + 32, yPosition + 5)
    pdf.setTextColor(0, 0, 0)

    yPosition += 20

    // Job Order Information Section
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("JOB ORDER INFORMATION", margin, yPosition)
    yPosition += 8

    // Draw section separator
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Two column layout for job information
    const leftColumn = margin
    const rightColumn = margin + contentWidth / 2

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")

    // Left column
    let leftY = yPosition
    const leftColumnData = [
      { label: "JO Number:", value: jobOrder.joNumber },
      { label: "Site Name:", value: jobOrder.siteName },
      { label: "Site Code:", value: jobOrder.siteCode || "N/A" },
      { label: "Site Location:", value: jobOrder.siteLocation || "N/A" },
      { label: "Site Type:", value: jobOrder.siteType || "N/A" },
      { label: "Site Size:", value: jobOrder.siteSize || "N/A" },
      { label: "Requested By:", value: jobOrder.requestedBy },
      { label: "Assigned To:", value: jobOrder.assignTo },
    ]

    leftColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, leftColumn, leftY)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, leftColumn + 35, leftY)
      leftY += 6
    })

    // Right column
    let rightY = yPosition
    const rightColumnData = [
      { label: "Date Requested:", value: dateRequested.toLocaleDateString() },
      { label: "Deadline:", value: deadline.toLocaleDateString() },
      { label: "Client Company:", value: jobOrder.clientCompany || "N/A" },
      { label: "Client Name:", value: jobOrder.clientName || "N/A" },
      { label: "Quotation No.:", value: jobOrder.quotationNumber || "N/A" },
      { label: "Total Amount:", value: jobOrder.totalAmount ? formatCurrency(jobOrder.totalAmount) : "N/A" },
      { label: "VAT Amount:", value: jobOrder.vatAmount ? formatCurrency(jobOrder.vatAmount) : "N/A" },
      { label: "Contract Duration:", value: jobOrder.contractDuration || "N/A" },
    ]

    rightColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, rightColumn, rightY)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, rightColumn + 40, rightY)
      rightY += 6
    })

    yPosition += 10

    // Contract Period Section (if available)
    if (contractStart && contractEnd) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("CONTRACT PERIOD", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Start Date: ${contractStart.toLocaleDateString()}`, margin, yPosition)
      pdf.text(`End Date: ${contractEnd.toLocaleDateString()}`, rightColumn, yPosition)
      yPosition += 15
    }

    // Job Description Section
    if (jobOrder.jobDescription || jobOrder.remarks) {
      checkNewPage(40)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("JOB DESCRIPTION", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      if (jobOrder.jobDescription) {
        yPosition = addText(jobOrder.jobDescription, margin, yPosition, contentWidth)
        yPosition += 5
      }

      if (jobOrder.remarks) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Remarks:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(jobOrder.remarks, margin, yPosition, contentWidth)
      }

      yPosition += 10
    }

    // Site Image Section (if available)
    if (jobOrder.siteImageUrl) {
      checkNewPage(80)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("SITE IMAGE", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      try {
        const { base64, width, height } = await calculateImageFitDimensions(
          jobOrder.siteImageUrl,
          contentWidth * 0.8,
          60,
        )

        if (base64) {
          const imageX = margin + (contentWidth - width) / 2
          pdf.addImage(base64, "JPEG", imageX, yPosition, width, height)
          yPosition += height + 10
        }
      } catch (error) {
        console.error("Error adding site image:", error)
        pdf.setFontSize(10)
        pdf.setTextColor(100, 100, 100)
        pdf.text("Site image could not be loaded", margin, yPosition)
        pdf.setTextColor(0, 0, 0)
        yPosition += 15
      }
    }

    // Compliance Status Section
    if (jobOrder.poMo !== undefined || jobOrder.projectFa !== undefined || jobOrder.signedQuotation !== undefined) {
      checkNewPage(40)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("COMPLIANCE STATUS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      const complianceItems = [
        { label: "Purchase Order/MO:", status: jobOrder.poMo },
        { label: "Project FA:", status: jobOrder.projectFa },
        { label: "Signed Quotation:", status: jobOrder.signedQuotation },
      ]

      complianceItems.forEach((item, index) => {
        if (item.status !== undefined) {
          pdf.setFont("helvetica", "bold")
          pdf.text(item.label, margin, yPosition)

          // Status indicator
          const statusColor = item.status ? [34, 197, 94] : [239, 68, 68] // green or red
          pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
          pdf.rect(margin + 50, yPosition - 3, 20, 6, "F")
          pdf.setTextColor(255, 255, 255)
          pdf.setFont("helvetica", "bold")
          pdf.text(item.status ? "YES" : "NO", margin + 55, yPosition)
          pdf.setTextColor(0, 0, 0)

          yPosition += 8
        }
      })

      yPosition += 5
    }

    // Footer
    checkNewPage(30)
    yPosition = pageHeight - 40

    // Footer separator
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Footer content
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)

    pdf.text("Generated by Boohk Platform - Logistics Department", margin, yPosition)
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition + 5)

    // Company info on the right
    pdf.text("Smart. Seamless. Scalable.", pageWidth - margin - 50, yPosition)
    pdf.setFont("helvetica", "bold")
    pdf.text("OH+", pageWidth - margin - 15, yPosition + 5)

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      // Return base64 string for email attachment
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      // Save the PDF for download
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `job-order-${jobOrder.joNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating Job Order PDF:", error)
    throw new Error("Unable to create job order PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateProposalPDF(proposal: Proposal, returnBase64 = false, selectedSize = "A4", selectedOrientation = "Portrait", selectedLayout = "1", selectedTemplateBackground?: string): Promise<string | void> {
  try {
    // Create new PDF document with compression enabled
    const pdf = new jsPDF({
      orientation: selectedOrientation === "Landscape" ? "landscape" : "portrait",
      unit: "mm",
      format: selectedSize === "A4" ? "a4" : selectedSize === "Letter size" ? "letter" : "legal",
      compress: true, // Enable compression to reduce file size
      putOnlyUsedFonts: true, // Only embed used fonts
      floatPrecision: 16 // Reduce precision for smaller file size
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2

    // Helper functions
    const getSitesPerPage = (layout: string) => Number.parseInt(layout)
    const getTotalPages = (layout: string) => {
      const numberOfSites = proposal?.products?.length || 1
      const sitesPerPage = getSitesPerPage(layout)
      return Math.ceil(numberOfSites / sitesPerPage)
    }
    const getPageContent = (pageNumber: number, layout: string) => {
      if (!proposal?.products) return []
      const sitesPerPage = getSitesPerPage(layout)
      const startIndex = (pageNumber - 1) * sitesPerPage
      const endIndex = startIndex + sitesPerPage
      return proposal.products.slice(startIndex, endIndex)
    }
    const getPageTitle = (pageContent: any[]): string => {
      if (!pageContent || pageContent.length === 0) {
        return "Company Name"
      }
      const siteCodes = pageContent.map((product) => product.site_code).filter(Boolean)
      if (siteCodes.length === 0) {
        return "Company Name"
      }
      if (siteCodes.length === 1) {
        return siteCodes[0]
      }
      if (siteCodes.length === 2) {
        return `${siteCodes[0]} & ${siteCodes[1]}`
      }
      return `${siteCodes[0]} & ${siteCodes.length - 1} more sites`
    }
    const getPagePrice = (pageContent: any[]) => {
      return pageContent.reduce((total, product) => {
        return total + (product.price || 0)
      }, 0)
    }

    // Generate pages
    for (let pageIndex = 0; pageIndex < getTotalPages(selectedLayout); pageIndex++) {
      if (pageIndex > 0) {
        pdf.addPage()
      }

      let yPosition = margin
      const pageNumber = pageIndex + 1
      const pageContent = getPageContent(pageNumber, selectedLayout)

      // Background image if provided with compression
      if (selectedTemplateBackground) {
        try {
          const { base64: bgBase64 } = await calculateImageFitDimensions(
            selectedTemplateBackground,
            pageWidth,
            pageHeight,
            0.6, // Lower quality for backgrounds to save space
            false
          )

          if (bgBase64) {
            pdf.addImage(bgBase64, "JPEG", 0, 0, pageWidth, pageHeight)
          }
        } catch (error) {
          console.error("Error adding background:", error)
        }
      }

      // Header section - Company Logo and Title/Price
      const logoSize = 20 // 20mm x 20mm logo
      const logoX = margin
      const logoY = yPosition
// Load and add company logo with compression
try {
  const logoUrl = await resolveCompanyLogo()
  if (logoUrl) {
    const { base64: logoBase64, width: finalWidth, height: finalHeight } = await calculateImageFitDimensions(
      logoUrl,
      logoSize,
      logoSize,
      0.8, // High quality for logos
      false
    )

    if (logoBase64) {
      pdf.addImage(logoBase64, "JPEG", logoX, logoY, finalWidth, finalHeight)
    }
  }
} catch (error) {
  console.error("Error loading company logo:", error)
}

      // Title and Price on the right
      const titleX = pageWidth - margin
      const titleY = yPosition

      pdf.setFontSize(24)
      pdf.setFont("helvetica", "bold")
      const pageTitle = getPageTitle(pageContent)
      const titleWidth = pdf.getTextWidth(pageTitle)
      pdf.text(pageTitle, titleX - titleWidth, titleY + 7)

      // Price for single product pages
      if (getSitesPerPage(selectedLayout) === 1 && pageContent.length > 0) {
        const pagePrice = getPagePrice(pageContent)
        pdf.setFontSize(14)
        pdf.setFillColor(34, 197, 94) // green-500
        pdf.setTextColor(255, 255, 255)
        const priceText = `₱${pagePrice.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const priceWidth = pdf.getTextWidth(priceText) + 8
        const priceHeight = 8
        const priceX = titleX - priceWidth
        const priceY = titleY + 12

        pdf.roundedRect(priceX, priceY, priceWidth, priceHeight, 2, 2, "F")
        pdf.text(priceText, priceX + 4, priceY + 5.5)
        pdf.setTextColor(0, 0, 0)
      }

      yPosition += 40

      // Product grid
      const gridClass = getSitesPerPage(selectedLayout) === 1
        ? "grid-cols-1"
        : getSitesPerPage(selectedLayout) === 2
        ? "grid-cols-2"
        : "grid-cols-2" // 4 per page still uses 2x2 grid

      const productsPerRow = getSitesPerPage(selectedLayout) === 1 ? 1 : 2
      const productWidth = (contentWidth - (productsPerRow - 1) * 10) / productsPerRow // 10mm gap
      const productHeight = 80 // Approximate height per product

      for (let i = 0; i < pageContent.length; i++) {
        const product = pageContent[i]
        const row = Math.floor(i / productsPerRow)
        const col = i % productsPerRow

        const productX = margin + col * (productWidth + 10)
        const productY = yPosition + row * (productHeight + 10)

        // Product image - Reduced sizes for email optimization
        const imageSize = getSitesPerPage(selectedLayout) === 1 ? 32 : getSitesPerPage(selectedLayout) === 2 ? 28 : 24
        const imageX = productX
        const imageY = productY

        if (product.media && product.media.length > 0) {
          try {
            const { base64: imageBase64, width: finalImageWidth, height: finalImageHeight } = await calculateImageFitDimensions(
              product.media[0].url,
              imageSize,
              imageSize,
              0.7, // Balanced quality for product images
              false
            )

            if (imageBase64) {
              pdf.addImage(imageBase64, "JPEG", imageX, imageY, finalImageWidth, finalImageHeight)
            } else {
              // Draw placeholder
              pdf.setFillColor(229, 231, 235) // gray-200
              pdf.rect(imageX, imageY, imageSize, imageSize, "F")
            }
          } catch (error) {
            console.error("Error loading product image:", error)
            // Draw placeholder
            pdf.setFillColor(229, 231, 235) // gray-200
            pdf.rect(imageX, imageY, imageSize, imageSize, "F")
          }
        } else {
          // Draw placeholder
          pdf.setFillColor(229, 231, 235) // gray-200
          pdf.rect(imageX, imageY, imageSize, imageSize, "F")
        }

        // Map placeholder (since we can't generate real maps server-side)
        const mapSize = getSitesPerPage(selectedLayout) === 1 ? 32 : getSitesPerPage(selectedLayout) === 2 ? 24 : 20
        const mapX = productX + imageSize + 5
        const mapY = productY

        pdf.setFillColor(229, 231, 235) // gray-200
        pdf.rect(mapX, mapY, mapSize, mapSize, "F")
        pdf.setFontSize(6)
        pdf.setTextColor(107, 114, 128) // gray-500
        pdf.text("Map", mapX + mapSize/2 - 3, mapY + mapSize/2 + 1)
        pdf.setTextColor(0, 0, 0)

        // Product details
        let detailY = productY
        const detailX = mapX + mapSize + 5
        const detailWidth = productWidth - imageSize - mapSize - 10

        pdf.setFontSize(getSitesPerPage(selectedLayout) === 1 ? 12 : 10)
        pdf.setFont("helvetica", "bold")
        pdf.text("Location Map:", detailX, detailY + 4)
        detailY += 6

        pdf.setFontSize(getSitesPerPage(selectedLayout) === 1 ? 9 : 8)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(75, 85, 99) // gray-600

        if (product.specs_rental?.location) {
          pdf.text(`Location: ${product.specs_rental.location}`, detailX, detailY)
          detailY += 4
        }

        if (product.specs_rental?.traffic_count) {
          pdf.text(`Traffic Count: ${product.specs_rental.traffic_count.toLocaleString()} vehicles`, detailX, detailY)
          detailY += 4
        }

        if (product.specs_rental?.elevation !== undefined) {
          pdf.text(`Visibility: ${product.specs_rental.elevation} meters`, detailX, detailY)
          detailY += 4
        }

        if (product.specs_rental?.height && product.specs_rental?.width) {
          pdf.text(`Dimension: ${product.specs_rental.height}ft x ${product.specs_rental.width}ft`, detailX, detailY)
          detailY += 4
        }

        pdf.text(`Type: ${product.type || "Advertising Space"}`, detailX, detailY)

        // Price for multi-product pages
        if (getSitesPerPage(selectedLayout) > 1) {
          const priceY = productY + imageSize - 8
          pdf.setFillColor(34, 197, 94) // green-500
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(8)
          const priceText = `₱${(product.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          const priceWidth = pdf.getTextWidth(priceText) + 6
          const priceHeight = 6
          const priceX = productX + productWidth - priceWidth

          pdf.roundedRect(priceX, priceY, priceWidth, priceHeight, 1, 1, "F")
          pdf.text(priceText, priceX + 3, priceY + 4.5)
          pdf.setTextColor(0, 0, 0)
        }
      }
    }

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `proposal-${(proposal.title || "proposal").replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw new Error("Unable to create proposal PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateSeparateCostEstimatePDFs(
  costEstimate: CostEstimate,
  selectedPages?: string[],
): Promise<void> {
  try {
    // Use the exact same grouping logic as the page
    const groupLineItemsBySite = (lineItems: any[]) => {
      console.log("[v0] All line items:", lineItems)

      const siteGroups: { [siteName: string]: any[] } = {}

      // Group line items by site based on the site rental items
      lineItems.forEach((item) => {
        if (item.category.includes("Billboard Rental")) {
          // This is a site rental item - use its description as the site name
          const siteName = item.description
          if (!siteGroups[siteName]) {
            siteGroups[siteName] = []
          }
          siteGroups[siteName].push(item)

          // Find related production, installation, and maintenance items for this site
          const siteId = item.id
          const relatedItems = lineItems.filter(
            (relatedItem) => relatedItem.id.includes(siteId) && relatedItem.id !== siteId,
          )
          siteGroups[siteName].push(...relatedItems)
        }
      })

      if (Object.keys(siteGroups).length === 0) {
        console.log("[v0] No billboard rental items found, treating as single site with all items")
        siteGroups["Single Site"] = lineItems
      } else {
        // Check for orphaned items (items not associated with any site)
        const groupedItemIds = new Set()
        Object.values(siteGroups).forEach((items) => {
          items.forEach((item) => groupedItemIds.add(item.id))
        })

        const orphanedItems = lineItems.filter((item) => !groupedItemIds.has(item.id))
        if (orphanedItems.length > 0) {
          console.log("[v0] Found orphaned items:", orphanedItems)
          const siteNames = Object.keys(siteGroups)
          siteNames.forEach((siteName) => {
            // Create copies of orphaned items for each site to avoid reference issues
            const orphanedCopies = orphanedItems.map((item) => ({ ...item }))
            siteGroups[siteName].push(...orphanedCopies)
          })
        }
      }

      console.log("[v0] Final site groups:", siteGroups)
      return siteGroups
    }

    const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
    const sites = Object.keys(siteGroups)

    const sitesToProcess =
      selectedPages && selectedPages.length > 0 ? sites.filter((site) => selectedPages.includes(site)) : sites

    if (sitesToProcess.length === 0) {
      throw new Error("No sites selected for PDF generation")
    }

    // Generate separate PDF for each site
    for (let i = 0; i < sitesToProcess.length; i++) {
      const siteName = sitesToProcess[i]
      const siteLineItems = siteGroups[siteName] || []

      // Create a modified cost estimate for this specific site with proper CE number
      const baseCENumber = costEstimate.costEstimateNumber || costEstimate.id
      const uniqueCENumber =
        sites.length > 1
          ? `${baseCENumber}-${String.fromCharCode(64 + (sites.indexOf(siteName) + 1))}` // Appends -A, -B, -C, etc.
          : baseCENumber

      const singleSiteCostEstimate = {
        ...costEstimate,
        lineItems: siteLineItems,
        title: sites.length > 1 ? siteName : costEstimate.title,
        costEstimateNumber: uniqueCENumber,
      }

      // Generate PDF for this single site
      await generateCostEstimatePDF(singleSiteCostEstimate, undefined, false)

      // Add a small delay between downloads to ensure proper file naming
      if (i < sitesToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  } catch (error) {
    console.error("Error generating separate PDFs:", error)
    throw new Error("Unable to create separate cost estimate PDFs. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateCostEstimatePDF(
  costEstimate: CostEstimate,
  selectedPages?: string[],
  returnBase64 = false,
): Promise<string | void> {
  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    const createdAt = safeToDate(costEstimate.createdAt)
    const validUntil = safeToDate(costEstimate.validUntil)
    const startDate = costEstimate.startDate ? safeToDate(costEstimate.startDate) : null
    const endDate = costEstimate.endDate ? safeToDate(costEstimate.endDate) : null

    const costEstimateViewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cost-estimates/view/${costEstimate.id}`
    const qrCodeUrl = await generateQRCode(costEstimateViewUrl)

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
      } else {
        // Handle orphaned items
        const groupedItemIds = new Set()
        Object.values(siteGroups).forEach((items) => {
          items.forEach((item) => groupedItemIds.add(item.id))
        })

        const orphanedItems = lineItems.filter((item) => !groupedItemIds.has(item.id))
        if (orphanedItems.length > 0) {
          const siteNames = Object.keys(siteGroups)
          siteNames.forEach((siteName) => {
            const orphanedCopies = orphanedItems.map((item) => ({ ...item }))
            siteGroups[siteName].push(...orphanedCopies)
          })
        }
      }

      return siteGroups
    }

    const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
    const sites = Object.keys(siteGroups)
    const isMultipleSites = sites.length > 1

    const sitesToProcess =
      selectedPages && selectedPages.length > 0 ? sites.filter((site) => selectedPages.includes(site)) : sites

    if (sitesToProcess.length === 0) {
      throw new Error("No sites selected for PDF generation")
    }

    for (const siteName of sitesToProcess) {
      const siteIndex = sitesToProcess.indexOf(siteName)
      if (siteIndex > 0) {
        pdf.addPage()
        yPosition = margin
      }

      const siteLineItems = siteGroups[siteName] || []
      const siteTotal = siteLineItems.reduce((sum, item) => sum + item.total, 0)

      const originalSiteIndex = sites.indexOf(siteName)
      const ceNumber = isMultipleSites
        ? `${costEstimate.costEstimateNumber || costEstimate.id}-${String.fromCharCode(65 + originalSiteIndex)}`
        : costEstimate.costEstimateNumber || costEstimate.id

      // Header section matching page format
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(
        createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        margin,
        yPosition,
      )
      yPosition += 8

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      pdf.text(costEstimate.client?.name || "Client Name", margin, yPosition)
      yPosition += 4
      pdf.setFont("helvetica", "normal")
      pdf.text(costEstimate.client?.company || "Client Company", margin, yPosition)
      yPosition += 8

      // RFQ Number (right aligned)
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text("RFQ No.", pageWidth - margin - 30, yPosition - 12)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(0, 0, 0)
      pdf.text(ceNumber, pageWidth - margin - 30, yPosition - 8)

      // Title section
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      const adjustedTitle = isMultipleSites ? siteName : costEstimate?.title
      const titleText = `${adjustedTitle} COST ESTIMATE`
      const titleWidth = pdf.getTextWidth(titleText)
      pdf.text(titleText, (pageWidth - titleWidth) / 2, yPosition)

      // Underline the title
      pdf.setLineWidth(0.5)
      pdf.line((pageWidth - titleWidth) / 2, yPosition + 2, (pageWidth + titleWidth) / 2, yPosition + 2)
      yPosition += 12

      // "Details as follows:" section
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "bold")
      pdf.text("Details as follows:", margin, yPosition)
      yPosition += 8

      // Bullet points section matching page format
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "normal")

      const bulletPoints = [
        { label: "Site Location", value: siteName },
        { label: "Type", value: siteLineItems[0]?.description || "Billboard" },
        { label: "Size", value: siteLineItems[0]?.notes || "Standard Size" },
        { label: "Contract Duration", value: `${costEstimate?.durationDays || 30} DAYS` },
        {
          label: "Contract Period",
          value: `${startDate ? startDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"} - ${endDate ? endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}`,
        },
        { label: "Proposal to", value: costEstimate?.client?.company || "Client Company" },
        { label: "Illumination", value: `${siteLineItems[0]?.quantity || 1} units of lighting system` },
        {
          label: "Lease Rate/Month",
          value: `PHP ${(siteTotal / (costEstimate?.durationDays ? Math.ceil(costEstimate.durationDays / 30) : 1)).toLocaleString("en-US", { minimumFractionDigits: 2 })} (Exclusive of VAT)`,
        },
        {
          label: "Total Lease",
          value: `PHP ${siteTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} (Exclusive of VAT)`,
        },
      ]

      bulletPoints.forEach((point) => {
        pdf.text("•", margin, yPosition)
        pdf.setFont("helvetica", "bold")
        pdf.text(point.label, margin + 5, yPosition)
        pdf.setFont("helvetica", "normal")
        pdf.text(`: ${point.value}`, margin + 35, yPosition)
        yPosition += 5
      })

      yPosition += 3

      // Calculation breakdown section
      // pdf.setFillColor(245, 245, 245)
      // pdf.rect(margin, yPosition, contentWidth, 28, "F")

      pdf.setFontSize(9)

      const monthlyRate = siteTotal / (costEstimate?.durationDays ? Math.ceil(costEstimate.durationDays / 30) : 1)
      const months = costEstimate?.durationDays ? Math.ceil(costEstimate.durationDays / 30) : 1
      const vatAmount = siteTotal * 0.12
      const totalWithVat = siteTotal + vatAmount

      pdf.text("Lease rate per month", margin + 5, yPosition + 6)
      pdf.text(
        `PHP ${monthlyRate.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        pageWidth - margin - 5,
        yPosition + 6,
        { align: "right" },
      )

      pdf.text(`x ${months} months`, margin + 5, yPosition + 12)
      pdf.text(
        `PHP ${siteTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        pageWidth - margin - 5,
        yPosition + 12,
        { align: "right" },
      )

      pdf.text("12% VAT", margin + 5, yPosition + 18)
      pdf.text(
        `PHP ${vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        pageWidth - margin - 5,
        yPosition + 18,
        { align: "right" },
      )

      // Total line
      pdf.setLineWidth(0.5)
      pdf.line(margin + 5, yPosition + 22, pageWidth - margin - 5, yPosition + 22)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("TOTAL", margin + 5, yPosition + 28)
      pdf.text(
        `PHP ${totalWithVat.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        pageWidth - margin - 5,
        yPosition + 28,
        { align: "right" },
      )

      yPosition += 35

      // Terms and Conditions section
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Terms and Conditions:", margin, yPosition)
      yPosition += 6

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      const terms = [
        "1. Quotation validity: 5 working days.",
        "2. Availability of the site is on first-come-first-served basis only. Only official documents such as",
        "   P.O.'s, Media Orders, signed quotation, & contracts are accepted in order to be booked the site.",
        "3. To book the site, one (1) month advance and one (2) months security deposit.",
        "   payment dated 7 days before the start of rental is required.",
        "4. Final artwork should be approved ten (10) days before the contract period",
        "5. Print is exclusively for Company Name Only.",
      ]

      terms.forEach((term) => {
        pdf.text(term, margin, yPosition)
        yPosition += 5
      })

      yPosition += 6

      let representativeName = "Representative Name"
      let companyData: any = null
      let companyName = "Company Name"
      let companyLocation = "Company Location"
      let companyPhone = "Company Phone"

      if (costEstimate.createdBy) {
        try {
          const userDocRef = doc(db, "iboard_users", costEstimate.createdBy)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            representativeName =
              `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
              userData.display_name ||
              "Representative Name"

            // Fetch company data using user's company_id
            if (userData.company_id) {
              const companyDocRef = doc(db, "companies", userData.company_id)
              const companyDoc = await getDoc(companyDocRef)

              if (companyDoc.exists()) {
                companyData = companyDoc.data()
                companyName = companyData.name || "Company Name"

                // Build company location from address object
                if (companyData.address) {
                  const addressParts = []
                  if (companyData.address.street) addressParts.push(companyData.address.street)
                  if (companyData.address.city) addressParts.push(companyData.address.city)
                  if (companyData.address.province) addressParts.push(companyData.address.province)
                  companyLocation = addressParts.join(", ") || "Company Location"
                } else if (companyData.company_location) {
                  companyLocation = companyData.company_location
                }

                companyPhone = companyData.phone || companyData.contact_phone || "Company Phone"
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user and company data for signature:", error)
        }
      }

      console.log("[v0] yPosition before signature section:", yPosition)
      console.log("[v0] pageHeight:", pageHeight)

      if (yPosition > pageHeight - 60) {
        yPosition = pageHeight - 60
        console.log("[v0] Adjusted yPosition for signature section:", yPosition)
      }

      // Signature section
      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      console.log("[v0] Adding 'Very truly yours' text at:", margin, yPosition)
      pdf.text("Very truly yours,", margin, yPosition)
      console.log("[v0] Adding 'Conforme' text at:", margin + contentWidth / 2, yPosition)
      pdf.text("Conforme:", margin + contentWidth / 2, yPosition)
      yPosition += 20
      console.log("[v0] yPosition after signature headers:", yPosition)

      pdf.setLineWidth(0.8)
      console.log("[v0] Drawing left signature line from", margin, "to", margin + 80, "at y:", yPosition)
      pdf.line(margin, yPosition, margin + 80, yPosition)
      console.log(
        "[v0] Drawing right signature line from",
        margin + contentWidth / 2,
        "to",
        margin + contentWidth / 2 + 80,
        "at y:",
        yPosition,
      )
      pdf.line(margin + contentWidth / 2, yPosition, margin + contentWidth / 2 + 80, yPosition)
      yPosition += 8
      console.log("[v0] yPosition after signature lines:", yPosition)

      // Names
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(9)
      console.log("[v0] Adding representative name:", representativeName, "at:", margin, yPosition)
      pdf.text(representativeName, margin, yPosition)
      console.log(
        "[v0] Adding client name:",
        costEstimate?.client?.name || "Client Name",
        "at:",
        margin + contentWidth / 2,
        yPosition,
      )
      pdf.text(costEstimate?.client?.name || "Client Name", margin + contentWidth / 2, yPosition)
      yPosition += 5

      pdf.setFont("helvetica", "normal")
      console.log(
        "[v0] Adding client company:",
        costEstimate?.client?.company || "Client Company",
        "at:",
        margin + contentWidth / 2,
        yPosition,
      )
      pdf.text(costEstimate?.client?.company || "Client Company", margin + contentWidth / 2, yPosition)
      yPosition += 8

      pdf.setFontSize(7)
      pdf.setFont("helvetica", "italic")
      console.log("[v0] Adding billing purpose text at:", margin + contentWidth / 2, yPosition)
      pdf.text("This signed quotation serves as an", margin + contentWidth / 2, yPosition)
      yPosition += 3
      pdf.text("official document for billing purposes", margin + contentWidth / 2, yPosition)
      yPosition += 8

      console.log("[v0] Final yPosition after signature section:", yPosition)
      console.log("[v0] Page dimensions - width:", pageWidth, "height:", pageHeight)
    }

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      const baseFileName = (costEstimate.title || "cost-estimate").replace(/[^a-z0-9]/gi, "_").toLowerCase()
      const sitesSuffix =
        selectedPages && selectedPages.length > 0 && selectedPages.length < sites.length
          ? `_selected-${selectedPages.length}-sites`
          : isMultipleSites && sitesToProcess.length === 1
            ? `_${sitesToProcess[0].replace(/[^a-z0-9]/gi, "_").toLowerCase()}`
            : isMultipleSites
              ? `_all-${sites.length}-sites`
              : ""
      const fileName = `cost-estimate-${baseFileName}${sitesSuffix}-${Date.now()}.pdf`

      console.log("[v0] Attempting to download PDF:", fileName)
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      console.log("[v0] PDF download triggered successfully")
    }
  } catch (error) {
    console.error("Error generating Cost Estimate PDF:", error)
    throw new Error("Unable to create cost estimate PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateReportPDF(
  report: ReportData,
  product: any,
  userData?: any,
  projectData?: any,
  returnBase64 = false,
  module = "logistics", // Added module parameter with default value
): Promise<string | void> {
  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let yPosition = 0

    const moduleDisplayName = module === "sales" ? "Sales" : "Logistics"
    const moduleDepartmentName = module === "sales" ? "SALES" : "LOGISTICS"

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

    // ANGULAR BLUE HEADER - Exact replica from preview page
    const headerHeight = 16

    // Main blue section (blue-900)
    pdf.setFillColor(30, 58, 138)
    pdf.rect(0, yPosition, pageWidth, headerHeight, "F")

    // Angular cyan section (cyan-400) with clip-path effect
    const cyanStartX = pageWidth * 0.6 // Start at 60% from left
    const cyanPoints = [
      [cyanStartX, yPosition], // Top left of cyan section
      [pageWidth, yPosition], // Top right
      [pageWidth, yPosition + headerHeight], // Bottom right
      [cyanStartX - pageWidth * 0.15, yPosition + headerHeight], // Bottom left with angle
    ]

    pdf.setFillColor(52, 211, 235) // cyan-400
    // Draw the angular cyan section using lines
    pdf.lines(
      cyanPoints.map((point, index) => {
        if (index === 0) return [point[0], point[1]]
        return [point[0] - cyanPoints[0][0], point[1] - cyanPoints[0][1]]
      }),
      cyanPoints[0][0],
      cyanPoints[0][1],
      [1, 1],
      "F",
    )

    // Add module text in header
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text(moduleDisplayName, margin, yPosition + 10) // Use dynamic module name instead of hardcoded "Logistics"

    yPosition += headerHeight + 8
    pdf.setTextColor(0, 0, 0)

    // REPORT HEADER SECTION - Exact replica
    // Report type badge (cyan-400)
    const badgeText = getReportTypeDisplay(report.reportType)
    const badgeWidth = Math.max(50, pdf.getTextWidth(badgeText) + 12)
    const badgeHeight = 8

    pdf.setFillColor(52, 211, 235) // cyan-400
    pdf.roundedRect(margin, yPosition, badgeWidth, badgeHeight, 2, 2, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text(badgeText, margin + 6, yPosition + 5.5)
    pdf.setTextColor(0, 0, 0)

    // Company logo container (160x160px equivalent in mm)
    const logoSize = 35
    const logoX = pageWidth - margin - logoSize
    const logoY = yPosition - 5

    // Resolve company logo and prepared by name
    let companyLogoUrl = "/ohplus-new-logo.png"
    let preparedByName = "User"

    // Query companies collection for logo and name
    if (userData?.uid || report?.createdBy) {
      try {
        const userId = userData?.uid || report?.createdBy
        let companyData = null

        console.log("PDF: Fetching user data for uid:", userId)

        // First, get the user document from iboard_users collection to access company_id
        const userDocRef = doc(db, "iboard_users", userId)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const fullUserData = userDoc.data()
          console.log("PDF: User data found:", fullUserData)

          // Try to get company using user's company_id as the document ID
          if (fullUserData.company_id) {
            console.log("PDF: Fetching company data for company_id:", fullUserData.company_id)

            const companyDocRef = doc(db, "companies", fullUserData.company_id)
            const companyDoc = await getDoc(companyDocRef)

            if (companyDoc.exists()) {
              companyData = companyDoc.data()
              console.log("PDF: Company data found:", companyData)

              preparedByName =
                companyData.name ||
                companyData.company_name ||
                fullUserData.display_name ||
                fullUserData.first_name + " " + fullUserData.last_name ||
                userData?.displayName ||
                userData?.email?.split("@")[0] ||
                "User"

              if (companyData.photo_url && companyData.photo_url.trim() !== "") {
                console.log("PDF: Setting company logo to:", companyData.photo_url)
                companyLogoUrl = companyData.photo_url
              } else {
                console.log("PDF: No company photo_url found, using default OH+ logo")
                companyLogoUrl = "/ohplus-new-logo.png"
              }
            } else {
              console.log("PDF: Company document not found for company_id:", fullUserData.company_id)
              // Use user data as fallback
              preparedByName =
                fullUserData.display_name ||
                fullUserData.first_name + " " + fullUserData.last_name ||
                userData?.displayName ||
                userData?.email?.split("@")[0] ||
                "User"
              companyLogoUrl = "/ohplus-new-logo.png"
            }
          } else {
            console.log("PDF: No company_id found in user data")
            // Use user data as fallback
            preparedByName =
              fullUserData.display_name ||
              fullUserData.first_name + " " + fullUserData.last_name ||
              userData?.displayName ||
              userData?.email?.split("@")[0] ||
              "User"
            companyLogoUrl = "/ohplus-new-logo.png"
          }
        } else {
          console.log("PDF: User document not found for uid:", userId)
          // Final fallback to provided userData or default
          preparedByName = userData?.displayName || userData?.email?.split("@")[0] || "User"
          companyLogoUrl = "/ohplus-new-logo.png"
        }
      } catch (error) {
        console.error("PDF: Error fetching company data:", error)
        preparedByName = userData?.displayName || userData?.email?.split("@")[0] || "User"
        companyLogoUrl = "/ohplus-new-logo.png"
      }
    }

    // Add logo container with white background and shadow
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(logoX - 2, logoY, logoSize + 4, logoSize, 2, 2, "F")
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(255, 255, 255)
    pdf.roundedRect(logoX - 2, logoY, logoSize + 4, logoSize, 2, 2, "S")

    // Load and add logo
    try {
      console.log("PDF: Loading logo from:", companyLogoUrl)
      const logoBase64 = await loadImageAsBase64(companyLogoUrl)
      if (logoBase64) {
        const { width: actualLogoWidth, height: actualLogoHeight } = await getImageDimensions(logoBase64)
        const logoAspectRatio = actualLogoWidth / actualLogoHeight

        let finalLogoWidth = logoSize - 6
        let finalLogoHeight = logoSize - 6

        if (logoAspectRatio > 1) {
          finalLogoHeight = finalLogoWidth / logoAspectRatio
        } else if (logoAspectRatio < 1) {
          finalLogoWidth = finalLogoHeight * logoAspectRatio
        }

        const logoOffsetX = (logoSize - finalLogoWidth) / 2
        const logoOffsetY = (logoSize - finalLogoHeight) / 2

        pdf.addImage(logoBase64, "PNG", logoX + logoOffsetX, logoY + logoOffsetY, finalLogoWidth, finalLogoHeight)
        console.log("PDF: Logo added successfully")
      } else {
        console.log("PDF: Failed to load logo, using text fallback")
      }
    } catch (error) {
      console.error("PDF: Error loading logo:", error)
      // Text fallback
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(100, 100, 100)
      const fallbackText = preparedByName.split(" ")[0] || "Logo"
      const textWidth = pdf.getTextWidth(fallbackText)
      pdf.text(fallbackText, logoX + (logoSize - textWidth) / 2, logoY + logoSize / 2)
      pdf.setTextColor(0, 0, 0)
    }

    yPosition += badgeHeight + 5

    // "as of" date text
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    pdf.text(`as of ${formatDate(report.date)}`, margin, yPosition)
    pdf.setTextColor(0, 0, 0)
    yPosition += 12

    // PROJECT INFORMATION SECTION - Fixed layout with proper spacing
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(17, 24, 39) // gray-900
    pdf.text("Project Information", margin, yPosition)
    yPosition += 8

    // Card container with shadow effect
    const cardY = yPosition
    const cardHeight = 60 // Increased height to prevent overlapping

    // Shadow effect
    pdf.setFillColor(240, 240, 240)
    pdf.roundedRect(margin + 1, cardY + 1, contentWidth, cardHeight, 2, 2, "F")

    // Main card
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, "F")
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(230, 230, 230)
    pdf.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, "S")

    yPosition += 8

    // Fixed two-column layout with proper spacing to prevent overlapping
    const leftCol = margin + 5
    const rightCol = margin + contentWidth / 2 + 10 // Increased spacing between columns
    const columnWidth = contentWidth / 2 - 15 // Available width for each column
    let leftY = yPosition
    let rightY = yPosition

    pdf.setFontSize(10) // Changed from pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")

    // Left column data with fixed label widths
    const leftColumnData = [
      { label: "Site ID:", value: getSiteLocation(product), labelWidth: 25 },
      { label: "Job Order:", value: report.id?.slice(-4).toUpperCase() || "7733", labelWidth: 25 },
      { label: "Job Order Date:", value: formatDate(report.date), labelWidth: 35 },
      { label: "Site:", value: getSiteName(report), labelWidth: 25 },
      { label: "Size:", value: getSiteSize(product), labelWidth: 25 },
      { label: "Start Date:", value: formatDate(report.bookingDates.start), labelWidth: 25 },
      { label: "End Date:", value: formatDate(report.bookingDates.end), labelWidth: 25 },
      {
        label: "Installation Duration:",
        value: `${calculateInstallationDuration(report.bookingDates.start, report.bookingDates.end)} days`,
        labelWidth: 45,
      },
    ]

    // Right column data with fixed label widths
    const rightColumnData = [
      { label: "Content:", value: product?.content_type || "Static", labelWidth: 25 },
      { label: "Material Specs:", value: getMaterialSpecs(product), labelWidth: 35 },
      { label: "Crew:", value: `Team ${report.assignedTo || "4"}`, labelWidth: 25 },
      { label: "Illumination:", value: getIllumination(product), labelWidth: 30 },
      { label: "Gondola:", value: getGondola(product), labelWidth: 25 },
      { label: "Technology:", value: getTechnology(product), labelWidth: 30 },
      { label: "Sales:", value: report.sales || "N/A", labelWidth: 25 },
    ]

    // Render left column with left alignment and no excess spacing
    leftColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(75, 85, 99) // gray-700
      pdf.text(item.label, leftCol, leftY)

      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(17, 24, 39) // gray-900

      // Left-align value text immediately after label with minimal spacing
      const valueX = leftCol + pdf.getTextWidth(item.label) + 3 // 3mm spacing after label

      // Handle long text with wrapping within available column width
      const availableWidth = rightCol - valueX - 5 // Leave 5mm margin before right column
      const valueLines = pdf.splitTextToSize(item.value, availableWidth)

      if (valueLines.length > 1) {
        // Multi-line text
        valueLines.forEach((line: string, index: number) => {
          pdf.text(line, valueX, leftY + index * 3)
        })
        leftY += (valueLines.length - 1) * 3 + 5
      } else {
        // Single line text
        pdf.text(item.value, valueX, leftY)
        leftY += 5
      }
    })

    // Render right column with left alignment and no excess spacing
    rightColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(75, 85, 99) // gray-700
      pdf.text(item.label, rightCol, rightY)

      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(17, 24, 39) // gray-900

      // Left-align value text immediately after label with minimal spacing
      const valueX = rightCol + pdf.getTextWidth(item.label) + 3 // 3mm spacing after label

      // Handle long text with wrapping within available column width
      const availableWidth = pageWidth - margin - valueX - 5 // Leave 5mm margin from page edge
      const valueLines = pdf.splitTextToSize(item.value, availableWidth)

      if (valueLines.length > 1) {
        // Multi-line text
        valueLines.forEach((line: string, index: number) => {
          pdf.text(line, valueX, rightY + index * 3)
        })
        rightY += (valueLines.length - 1) * 3 + 5
      } else {
        // Single line text
        pdf.text(item.value, valueX, rightY)
        rightY += 5
      }
    })

    yPosition = cardY + cardHeight + 10

    // PROJECT STATUS SECTION - Badge positioned right next to text
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(17, 24, 39) // gray-900
    const statusText = "Project Status"
    pdf.text(statusText, margin, yPosition)

    // Calculate position for badge right next to the text
    const statusTextWidth = pdf.getTextWidth(statusText)
    const badgeX = margin + statusTextWidth + 8 // 8mm spacing after text

    // Status percentage badge with dynamic color
    const statusPercentage = getCompletionPercentage(report)

    // Dynamic color based on percentage
    let badgeColor
    if (statusPercentage >= 90) {
      badgeColor = [34, 197, 94] // green-500
    } else if (statusPercentage >= 70) {
      badgeColor = [234, 179, 8] // yellow-500
    } else if (statusPercentage >= 50) {
      badgeColor = [249, 115, 22] // orange-500
    } else {
      badgeColor = [239, 68, 68] // red-500
    }

    pdf.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2])
    pdf.roundedRect(badgeX, yPosition - 4, 20, 8, 2, 2, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.text(`${statusPercentage}%`, badgeX + 5, yPosition + 1)
    pdf.setTextColor(0, 0, 0)

    yPosition += 12

    // ATTACHMENTS SECTION - Two side-by-side images exactly like preview
    if (report.attachments && report.attachments.length > 0) {
      const attachmentsToShow = report.attachments.slice(0, 2)
      const imageContainerWidth = (contentWidth - 10) / 2
      const imageContainerHeight = 45

      for (let i = 0; i < Math.min(2, attachmentsToShow.length); i++) {
        const attachment = attachmentsToShow[i]
        const containerX = i === 0 ? margin : margin + imageContainerWidth + 10

        // Image container with gray background
        pdf.setFillColor(229, 231, 235) // gray-200
        pdf.roundedRect(containerX, yPosition, imageContainerWidth, imageContainerHeight, 2, 2, "F")

        // Try to load and display actual image
        if (attachment.fileUrl && attachment.fileName) {
          const extension = attachment.fileName.toLowerCase().split(".").pop()
          if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "")) {
            try {
              const { base64, width, height } = await calculateImageFitDimensions(
                attachment.fileUrl,
                imageContainerWidth - 4,
                imageContainerHeight - 4,
              )

              if (base64) {
                const centeredX = containerX + (imageContainerWidth - width) / 2
                const centeredY = yPosition + (imageContainerHeight - height) / 2
                pdf.addImage(base64, "JPEG", centeredX, centeredY, width, height)
              }
            } catch (error) {
              console.error("Error adding attachment image:", error)
              // Fallback to placeholder
              pdf.setFontSize(8)
              pdf.setTextColor(107, 114, 128)
              pdf.text("Image not available", containerX + 5, yPosition + imageContainerHeight / 2)
            }
          }
        }
      }

      yPosition += imageContainerHeight + 8

      // Image metadata below each image
      for (let i = 0; i < Math.min(2, attachmentsToShow.length); i++) {
        const attachment = attachmentsToShow[i]
        const metaX = i === 0 ? margin : margin + imageContainerWidth + 10

        // Change font size from 7 to 9
        pdf.setFontSize(9) // CHANGED FROM 7 TO 9
        pdf.setTextColor(75, 85, 99) // gray-600

        // Calculate the y-position separately for each column to prevent overlap
        let metaY = yPosition + (i === 0 ? 0 : 0) // Same starting position for both columns

        // Date
        pdf.setFont("helvetica", "bold")
        pdf.text("Date:", metaX, metaY)
        pdf.setFont("helvetica", "normal")
        pdf.text(formatDate(report.date), metaX + 15, metaY)
        metaY += 4 // Increase spacing from 3 to 4

        // Time
        pdf.setFont("helvetica", "bold")
        pdf.text("Time:", metaX, metaY)
        pdf.setFont("helvetica", "normal")
        pdf.text(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), metaX + 15, metaY)
        metaY += 4 // Increase spacing from 3 to 4

        // Location
        pdf.setFont("helvetica", "bold")
        pdf.text("Location:", metaX, metaY)
        pdf.setFont("helvetica", "normal")

        // Handle long location text with wrapping
        const locationText = getSiteLocation(product)
        const availableWidth = imageContainerWidth - 30 // Subtract label width and some margin
        const locationLines = pdf.splitTextToSize(locationText, availableWidth)

        // Add each line of the wrapped location text
        locationLines.forEach((line: string, index: number) => {
          pdf.text(line, metaX + 25, metaY + index * 4)
        })

        // Adjust y position based on number of location lines
        metaY += 4 * (locationLines.length > 1 ? locationLines.length : 1)

        // Note (if available)
        if (attachment.note) {
          pdf.setFont("helvetica", "bold")
          pdf.text("Note:", metaX, metaY)
          pdf.setFont("helvetica", "normal")
          const note = attachment.note.length > 25 ? attachment.note.substring(0, 22) + "..." : attachment.note
          pdf.text(note, metaX + 15, metaY)
        }
      }

      // Also increase the spacing after the metadata section
      yPosition += 18 // Increase from 15 to 18 to accommodate larger text
    }

    // FOOTER SECTION - Fixed layout and positioning
    const footerStartY = pageHeight - 50 // Increased space for footer

    // Footer separator line
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(229, 231, 235) // gray-200
    pdf.line(margin, footerStartY, pageWidth - margin, footerStartY)

    let footerY = footerStartY + 8

    // Prepared by section (left side)
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(17, 24, 39) // gray-900
    pdf.text("Prepared by:", margin, footerY)
    footerY += 5

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(75, 85, 99) // gray-600
    pdf.text(preparedByName, margin, footerY)
    footerY += 4

    pdf.text(moduleDepartmentName, margin, footerY) // Use dynamic department name instead of hardcoded "LOGISTICS"
    footerY += 4

    pdf.text(formatDate(report.date), margin, footerY)

    // Disclaimer on the right side - Fixed positioning
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(107, 114, 128) // gray-500
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    })
    pdf.text(`This report was automatically generated on ${currentDate}.`, pageWidth - margin - 70, footerY)

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `report-${report.id}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating report PDF:", error)
    throw new Error("Unable to create report PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateServiceAssignmentHTMLPDF(
  serviceAssignment: ServiceAssignmentPDFData,
  returnBase64 = false,
): Promise<string | void> {
  try {
    console.log("[DEBUG] Starting generateServiceAssignmentHTMLPDF for SA:", serviceAssignment.saNumber)
    console.log("[DEBUG] Service assignment data keys:", Object.keys(serviceAssignment))
    console.log("[DEBUG] Service expenses count:", serviceAssignment.serviceExpenses?.length || 0)
    console.log("[DEBUG] Attachments count:", serviceAssignment.attachments?.length || 0)

    // Test with minimal HTML first to isolate issues
    console.log("[DEBUG] Testing with minimal HTML template...")
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body><h1>Test PDF - ${serviceAssignment.saNumber}</h1></body>
      </html>
    `

    const testIframe = document.createElement('iframe')
    testIframe.style.position = 'absolute'
    testIframe.style.left = '-9999px'
    testIframe.style.top = '-9999px'
    testIframe.style.width = '200px'
    testIframe.style.height = '200px'
    testIframe.style.border = 'none'
    testIframe.style.opacity = '0'
    testIframe.style.pointerEvents = 'none'
    document.body.appendChild(testIframe)

    try {
      await new Promise((resolve, reject) => {
        testIframe.onload = resolve
        testIframe.src = 'about:blank'
        setTimeout(() => reject(new Error('Test iframe timeout')), 5000)
      })

      const testDoc = testIframe.contentDocument || testIframe.contentWindow?.document
      if (!testDoc) throw new Error('Test iframe document not accessible')

      testDoc.open()
      testDoc.write(testHtml)
      testDoc.close()

      await new Promise(resolve => setTimeout(resolve, 500))

      const testCanvas = await html2canvas(testIframe, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 200,
        height: 200,
      })

      console.log("[DEBUG] Test canvas successful, dimensions:", testCanvas.width, "x", testCanvas.height)
      document.body.removeChild(testIframe)

    } catch (testError) {
      console.error("[DEBUG] Test HTML generation failed:", testError)
      document.body.removeChild(testIframe)
      throw new Error(`Basic HTML rendering test failed: ${testError}`)
    }

    // Generate HTML template for service assignment
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Service Assignment - ${serviceAssignment.saNumber}</title>
      </head>
      <body style="margin:0; padding:0;">
        <div style="width: 794px; height: 1123px; position: relative">
          <div style="width: 507px; height: 31px; left: 138px; top: 1023px; position: absolute; text-align: center; color: var(--LIGHTER-BLACK, #333333); font-size: 13px; font-family: Inter; font-weight: 400; line-height: 13px; word-wrap: break-word">Golden Touch Imaging Specialist<br/>721 Gen Solano St., San Miguel, Manila City, Metro Manila, Philippines</div>
          <div style="width: 78px; height: 18px; left: 55px; top: 170px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Recipient</div>
          <div style="width: 254px; height: 27px; left: 55px; top: 197px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 26px; font-family: Inter; font-weight: 700; line-height: 26px; word-wrap: break-word">${serviceAssignment.assignedToName || serviceAssignment.assignedTo}</div>
          <div style="width: 190px; height: 18px; left: 534px; top: 239px; position: absolute; text-align: right; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Issued on ${serviceAssignment.created ? new Date(serviceAssignment.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
          <div style="width: 190px; height: 18px; left: 55px; top: 228px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Production</div>
          <div style="width: 115px; height: 18px; left: 67px; top: 327px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Site Name</div>
          <div style="width: 153px; height: 18px; left: 269px; top: 327px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.projectSiteName}</div>
          <div style="width: 115px; height: 18px; left: 67px; top: 358px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Site Address</div>
          <div style="width: 307px; height: 18px; left: 269px; top: 358px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.projectSiteLocation}</div>
          <div style="width: 132px; height: 18px; left: 67px; top: 389px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Campaign Name</div>
          <div style="width: 241px; height: 18px; left: 269px; top: 389px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.campaignName || "N/A"}</div>
          <div style="width: 115px; height: 18px; left: 67px; top: 420px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Service Type</div>
          <div style="width: 210px; height: 18px; left: 269px; top: 420px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 700; line-height: 15px; word-wrap: break-word">${serviceAssignment.serviceType}</div>
          <div style="width: 115px; height: 18px; left: 67px; top: 451px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Material Specs</div>
          <div style="width: 210px; height: 18px; left: 269px; top: 451px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.materialSpecs}</div>
          <div style="width: 148px; height: 18px; left: 67px; top: 482px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Service Start Date</div>
          <div style="width: 210px; height: 18px; left: 269px; top: 482px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.startDate ? new Date(serviceAssignment.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
          <div style="width: 138px; height: 18px; left: 67px; top: 513px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Service End Date</div>
          <div style="width: 210px; height: 18px; left: 269px; top: 513px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.endDate ? new Date(serviceAssignment.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
          <div style="width: 138px; height: 18px; left: 67px; top: 544px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Crew</div>
          <div style="width: 210px; height: 18px; left: 269px; top: 544px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.crew}</div>
          <div style="width: 138px; height: 18px; left: 67px; top: 575px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Remarks</div>
          <div style="width: 353px; height: 18px; left: 269px; top: 575px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">${serviceAssignment.remarks}</div>
          <div style="width: 115px; height: 18px; left: 55px; top: 621px; position: absolute; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 700; line-height: 15px; word-wrap: break-word">Attachments:</div>
          <img style="width: 105px; height: 41px; left: 48px; top: 49px; position: absolute" src="https://placehold.co/105x41" />
          <div style="width: 166px; height: 42px; left: 556px; top: 190px; position: absolute; background: #32A7FA"></div>
          <div style="width: 668px; height: 35px; left: 55px; top: 283px; position: absolute; background: #32A7FA"></div>
          <div style="width: 151px; height: 31px; left: 561px; top: 200px; position: absolute; text-align: right; color: white; font-size: 26px; font-family: Inter; font-weight: 700; line-height: 26px; word-wrap: break-word">SA#${serviceAssignment.saNumber}</div>
          <div style="width: 355px; height: 19px; left: 67px; top: 291px; position: absolute; color: white; font-size: 21px; font-family: Inter; font-weight: 700; line-height: 21px; word-wrap: break-word">Service Assignment Information</div>
          <div style="width: 668px; height: 33px; left: 55px; top: 318px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 351px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 384px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 417px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 450px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 483px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 549px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 582px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 668px; height: 33px; left: 55px; top: 516px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 194px; height: 290px; left: 55px; top: 318px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 255px; height: 255px; left: 55px; top: 649px; position: absolute; border: 1px #D9D9D9 solid"></div>
          <div style="width: 109px; height: 18px; left: 634px; top: 669px; position: absolute; text-align: right; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Prepared By</div>
          <div style="width: 220px; height: 27px; left: 519px; top: 749px; position: absolute; text-align: right; color: var(--LIGHTER-BLACK, #333333); font-size: 26px; font-family: Inter; font-weight: 700; line-height: 26px; word-wrap: break-word">${serviceAssignment.requestedBy?.name || "Unknown User"}</div>
          <div style="width: 190px; height: 18px; left: 549px; top: 779px; position: absolute; text-align: right; color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Logistics Team</div>
          <div style="width: 125px; height: 42px; left: 605px; top: 55px; position: absolute; text-align: right"><span style="color: var(--LIGHTER-BLACK, #333333); font-size: 15px; font-family: Inter; font-weight: 400; line-height: 15px; word-wrap: break-word">Tagged JO<br/></span><span style="color: var(--LIGHTER-BLACK, #333333); font-size: 21px; font-family: Inter; font-weight: 700; line-height: 24.57px; word-wrap: break-word">JO#${serviceAssignment.saNumber.slice(-4)} </span></div>
        </div>
      </body>
      </html>
    `

    console.log("[DEBUG] HTML template generated, length:", htmlTemplate.length)

    // Create an iframe for isolated DOM manipulation to prevent layout shifts
    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.left = '-9999px'
    iframe.style.top = '-9999px'
    iframe.style.width = '794px' // A4 width
    iframe.style.height = '1123px' // A4 height
    iframe.style.border = 'none'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'

    // Append iframe to body
    document.body.appendChild(iframe)
    console.log("[DEBUG] Iframe created and appended to DOM")

    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas library is not loaded')
    }
    console.log("[DEBUG] html2canvas is available")

    try {
      // Wait for iframe to load
      await new Promise((resolve) => {
        iframe.onload = resolve
        iframe.src = 'about:blank'
      })
      console.log("[DEBUG] Iframe loaded with about:blank")

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) {
        throw new Error('Unable to access iframe document')
      }
      console.log("[DEBUG] Iframe document accessed successfully")

      // Write HTML content to iframe
      iframeDoc.open()
      iframeDoc.write(htmlTemplate)
      iframeDoc.close()
      console.log("[DEBUG] HTML content written to iframe")

      // Wait for iframe content to load
      await new Promise((resolve) => {
        if (iframeDoc.readyState === 'complete') {
          console.log("[DEBUG] Iframe readyState is complete")
          resolve(void 0)
        } else {
          console.log("[DEBUG] Waiting for DOMContentLoaded event")
          iframeDoc.addEventListener('DOMContentLoaded', () => {
            console.log("[DEBUG] DOMContentLoaded event fired")
            resolve(void 0)
          })
        }
      })

      // Additional wait for CSS and images to load
      console.log("[DEBUG] Waiting additional time for CSS/images to load")
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log("[DEBUG] Starting html2canvas conversion")

      // Check if iframe content is visible/rendered
      const iframeBody = iframeDoc.body
      console.log("[DEBUG] Iframe body dimensions:", iframeBody?.offsetWidth, "x", iframeBody?.offsetHeight)
      console.log("[DEBUG] Iframe body content:", iframeBody?.innerHTML?.substring(0, 200) + "...")

      // Check if iframe body has content
      if (!iframeBody || !iframeBody.innerHTML || iframeBody.innerHTML.trim().length === 0) {
        throw new Error('Iframe body is empty or not rendered')
      }

      // Use html2canvas to capture the iframe content
      console.log("[DEBUG] Starting html2canvas with options...")
      const canvas = await html2canvas(iframe, {
        scale: 2, // Higher resolution capture for better PDF quality
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123,
        // Optimize for absolute positioning capture
        imageTimeout: 0,
        removeContainer: true,
        foreignObjectRendering: false,
        // Additional optimizations for absolute positioning
        logging: false,
        // proxy: undefined,
        ignoreElements: (element) => {
          // Skip elements that might cause layout shifts
          return element.tagName === 'SCRIPT' || element.tagName === 'STYLE'
        },
      })

      console.log("[DEBUG] html2canvas completed, canvas dimensions:", canvas.width, "x", canvas.height)

      // Check if canvas has content
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas is empty or has zero dimensions')
      }

      // Remove the iframe
      document.body.removeChild(iframe)
      console.log("[DEBUG] Iframe removed from DOM")

      // Convert canvas to PDF using jsPDF
      console.log("[DEBUG] Converting canvas to PDF...")
      const pdf = new jsPDF("p", "mm", "a4")
      const imgData = canvas.toDataURL('image/jpeg', 0.95) // Use JPEG format with high quality (0.95)
      console.log("[DEBUG] Canvas converted to data URL, length:", imgData.length)

      // Validate data URL
      if (!imgData || !imgData.startsWith('data:image/png;base64,')) {
        throw new Error('Invalid canvas data URL generated')
      }

      // Calculate dimensions to fit A4
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 0

      console.log("[DEBUG] PDF dimensions - pdf:", pdfWidth, "x", pdfHeight, "img:", imgWidth, "x", imgHeight, "ratio:", ratio)

      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      console.log("[DEBUG] Image added to PDF successfully")

      // Apply PDF viewer preferences for initial zoom
      const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
      const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

      if (returnBase64) {
        console.log("[DEBUG] Returning base64 string")
        return Buffer.from(modifiedPdfBytes).toString('base64')
      } else {
        const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const fileName = `service-assignment-${serviceAssignment.saNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (canvasError) {
      console.error("[DEBUG] Error with html2canvas:", canvasError)
      // Clean up iframe if it still exists
      if (document.body.contains(iframe)) {
        console.log("[DEBUG] Cleaning up iframe after error")
        document.body.removeChild(iframe)
      }
      throw new Error("Failed to convert HTML to canvas")
    }
  } catch (error) {
    console.error("Error generating Service Assignment HTML PDF:", error)
    // Fallback to native jsPDF method when html2canvas fails
    console.log("Falling back to native jsPDF method for PDF generation")
    return generateServiceAssignmentFallbackPDF(serviceAssignment, returnBase64)
  }
}

// Fallback PDF generation function using jsPDF native API
// Form data interface for create page PDF generation
interface ServiceAssignmentCreateFormData {
  projectSite: string;
  serviceType: string;
  assignedTo: string;
  serviceDuration: number;
  priority: string;
  equipmentRequired: string;
  materialSpecs: string;
  crew: string;
  gondola: string;
  technology: string;
  sales: string;
  remarks: string;
  message: string;
  startDate: Date | null;
  endDate: Date | null;
  alarmDate: Date | null;
  alarmTime: string;
  attachments: { name: string; type: string; file?: File }[];
  serviceExpenses: { name: string; amount: string }[];
  serviceCost: {
    crewFee: string;
    overtimeFee: string;
    transpo: string;
    tollFee: string;
    mealAllowance: string;
    otherFees: { name: string; amount: string }[];
    total: number;
  };
}

export async function generateServiceAssignmentCreatePDF(
  formData: ServiceAssignmentCreateFormData,
  saNumber: string,
  returnBase64 = false,
): Promise<string | void> {
  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
      pdf.setFontSize(fontSize)
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return y + lines.length * fontSize * 0.3
    }

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 20) {
        pdf.addPage()
        yPosition = margin
      }
    }

    // Header
    pdf.setFillColor(30, 58, 138) // blue-900
    pdf.rect(0, 0, pageWidth, 25, "F")

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT CREATE", margin, 15)

    pdf.setFontSize(10)
    pdf.text("LOGISTICS DEPARTMENT", pageWidth - margin - 50, 15)

    yPosition = 35
    pdf.setTextColor(0, 0, 0)

    // SA Number
    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.text(`SA# ${saNumber}`, margin, yPosition)
    yPosition += 15

    // Service Assignment Information Section
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT INFORMATION", margin, yPosition)
    yPosition += 8

    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Display key fields in a simple format
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")

    const fields = [
      { label: "Project Site:", value: formData.projectSite || "N/A" },
      { label: "Service Type:", value: formData.serviceType || "N/A" },
      { label: "Assigned To:", value: formData.assignedTo || "N/A" },
      { label: "Service Duration:", value: formData.serviceDuration ? `${formData.serviceDuration} hours` : "N/A" },
      { label: "Priority:", value: formData.priority || "N/A" },
      { label: "Crew:", value: formData.crew || "N/A" },
      { label: "Gondola:", value: formData.gondola || "N/A" },
      { label: "Technology:", value: formData.technology || "N/A" },
      { label: "Sales:", value: formData.sales || "N/A" },
      { label: "Start Date:", value: formData.startDate ? formData.startDate.toLocaleDateString() : "N/A" },
      { label: "End Date:", value: formData.endDate ? formData.endDate.toLocaleDateString() : "N/A" },
      { label: "Alarm Date:", value: formData.alarmDate ? formData.alarmDate.toLocaleDateString() : "N/A" },
      { label: "Alarm Time:", value: formData.alarmTime || "N/A" },
    ]

    fields.forEach((field) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(field.label, margin, yPosition)
      pdf.setFont("helvetica", "normal")
      pdf.text(field.value, margin + 40, yPosition)
      yPosition += 8
    })

    yPosition += 10

    // Equipment and Materials Section
    if (formData.equipmentRequired || formData.materialSpecs) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("EQUIPMENT & MATERIALS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      if (formData.equipmentRequired) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Equipment Required:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(formData.equipmentRequired, margin, yPosition, contentWidth)
        yPosition += 5
      }

      if (formData.materialSpecs) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Material Specifications:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(formData.materialSpecs, margin, yPosition, contentWidth)
      }

      yPosition += 10
    }

    // Service Expenses Section
    if (formData.serviceExpenses && formData.serviceExpenses.length > 0) {
      checkNewPage(40)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("SERVICE EXPENSES", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      formData.serviceExpenses.forEach((expense) => {
        if (expense.name && expense.amount) {
          pdf.setFont("helvetica", "bold")
          pdf.text("Expense:", margin, yPosition)
          pdf.setFont("helvetica", "normal")
          pdf.text(expense.name, margin + 25, yPosition)
          pdf.setFont("helvetica", "bold")
          pdf.text("Amount:", margin + contentWidth / 2, yPosition)
          pdf.setFont("helvetica", "normal")
          pdf.text(`PHP ${expense.amount}`, margin + contentWidth / 2 + 25, yPosition)
          yPosition += 8
        }
      })

      // Total
      const total = formData.serviceExpenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0)
      yPosition += 5
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("TOTAL EXPENSES:", margin, yPosition)
      pdf.text(`PHP ${total.toLocaleString()}`, margin + 50, yPosition)
      yPosition += 15
    }

    // Remarks Section
    if (formData.remarks || formData.message) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("REMARKS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      const remarks = formData.remarks || formData.message || "N/A"
      yPosition = addText(remarks, margin, yPosition, contentWidth)
      yPosition += 10
    }

    // Attachments Section
    if (formData.attachments && formData.attachments.length > 0) {
      checkNewPage(20)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("ATTACHMENTS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      formData.attachments.forEach((attachment) => {
        pdf.text(`${attachment.name} (${attachment.type})`, margin, yPosition)
        yPosition += 6
      })

      yPosition += 10
    }

    // Footer
    checkNewPage(30)
    yPosition = pageHeight - 40

    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)

    pdf.text("Generated by Boohk Platform - Logistics Department", margin, yPosition)
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition + 5)

    pdf.text("Smart. Seamless. Scalable.", pageWidth - margin - 50, yPosition)
    pdf.setFont("helvetica", "bold")
    pdf.text("OH+", pageWidth - margin - 15, yPosition + 5)

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `service-assignment-create-${saNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating Service Assignment Create PDF:", error)
    throw new Error("Unable to create service assignment PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateServiceAssignmentFallbackPDF(
  serviceAssignment: ServiceAssignmentPDFData,
  returnBase64 = false,
): Promise<string | void> {
  try {
    console.log("Generating Service Assignment PDF using fallback method")

    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
      pdf.setFontSize(fontSize)
      const lines = pdf.splitTextToSize(text, maxWidth)
      pdf.text(lines, x, y)
      return y + lines.length * fontSize * 0.3
    }

    // Helper function to check if we need a new page
    const checkNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 20) {
        pdf.addPage()
        yPosition = margin
      }
    }

    // Header with gradient background (simulated with rectangles)
    pdf.setFillColor(30, 58, 138) // blue-900
    pdf.rect(0, 0, pageWidth, 25, "F")

    // Angular cyan section
    const cyanStartX = pageWidth * 0.6
    pdf.setFillColor(52, 211, 235) // cyan-400
    pdf.lines([
      [cyanStartX, 0],
      [pageWidth, 0],
      [pageWidth, 25],
      [cyanStartX - pageWidth * 0.15, 25],
    ], cyanStartX, 0, [1, 1], "F", true)

    // Add white text for header
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT", margin, 15)

    // Add logistics badge
    pdf.setFontSize(8)
    pdf.text("LOGISTICS DEPARTMENT", pageWidth - margin - 50, 15)

    yPosition = 35
    pdf.setTextColor(0, 0, 0)

    // Service Assignment Title and Number
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.text(`SA# ${serviceAssignment.saNumber}`, margin, yPosition)
    yPosition += 10

    // Status badge
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case "completed":
          return [34, 197, 94] // green
        case "pending":
          return [234, 179, 8] // yellow
        case "in progress":
          return [59, 130, 246] // blue
        default:
          return [107, 114, 128] // gray
      }
    }

    const statusColor = getStatusColor(serviceAssignment.status)
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.rect(margin, yPosition, 20, 6, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    pdf.text(serviceAssignment.status.toUpperCase(), margin + 2, yPosition + 4)
    pdf.setTextColor(0, 0, 0)
    yPosition += 20

    // Service Assignment Information Section
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("SERVICE ASSIGNMENT INFORMATION", margin, yPosition)
    yPosition += 8

    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Two column layout
    const leftColumn = margin
    const rightColumn = margin + contentWidth / 2

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")

    // Left column
    let leftY = yPosition
    const leftColumnData = [
      { label: "SA Number:", value: serviceAssignment.saNumber },
      { label: "Project Site:", value: serviceAssignment.projectSiteName },
      { label: "Location:", value: serviceAssignment.projectSiteLocation || "N/A" },
      { label: "Service Type:", value: serviceAssignment.serviceType },
      { label: "Assigned To:", value: serviceAssignment.assignedToName || serviceAssignment.assignedTo },
      { label: "Duration:", value: serviceAssignment.serviceDuration ? `${serviceAssignment.serviceDuration} hours` : "N/A" },
      { label: "Priority:", value: serviceAssignment.priority },
    ]

    leftColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, leftColumn, leftY)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, leftColumn + 35, leftY)
      leftY += 6
    })

    // Right column
    let rightY = yPosition
    const rightColumnData = [
      { label: "Created:", value: serviceAssignment.created.toLocaleDateString() },
      { label: "Start Date:", value: serviceAssignment.startDate ? serviceAssignment.startDate.toLocaleDateString() : "N/A" },
      { label: "End Date:", value: serviceAssignment.endDate ? serviceAssignment.endDate.toLocaleDateString() : "N/A" },
      { label: "Alarm Date:", value: serviceAssignment.alarmDate ? serviceAssignment.alarmDate.toLocaleDateString() : "N/A" },
      { label: "Alarm Time:", value: serviceAssignment.alarmTime || "N/A" },
      { label: "Illumination:", value: serviceAssignment.illuminationNits ? `${serviceAssignment.illuminationNits} nits` : "N/A" },
      { label: "Gondola:", value: serviceAssignment.gondola || "N/A" },
      { label: "Technology:", value: serviceAssignment.technology || "N/A" },
    ]

    rightColumnData.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, rightColumn, rightY)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, rightColumn + 35, rightY)
      rightY += 6
    })

    yPosition += 10

    // Equipment and Materials Section
    if (serviceAssignment.equipmentRequired || serviceAssignment.materialSpecs) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("EQUIPMENT & MATERIALS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      if (serviceAssignment.equipmentRequired) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Equipment Required:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(serviceAssignment.equipmentRequired, margin, yPosition, contentWidth)
        yPosition += 5
      }

      if (serviceAssignment.materialSpecs) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Material Specifications:", margin, yPosition)
        pdf.setFont("helvetica", "normal")
        yPosition += 5
        yPosition = addText(serviceAssignment.materialSpecs, margin, yPosition, contentWidth)
      }

      yPosition += 10
    }

    // Service Cost Section
    const totalCost = serviceAssignment.serviceExpenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0)
    if (totalCost > 0) {
      checkNewPage(40)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("SERVICE COST BREAKDOWN", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.setDrawColor(200, 200, 200)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")

      // All expenses
      serviceAssignment.serviceExpenses.forEach((expense) => {
        if (expense.name && expense.amount && Number.parseFloat(expense.amount) > 0) {
          pdf.setFont("helvetica", "bold")
          pdf.text(`${expense.name}:`, margin, yPosition)
          pdf.setFont("helvetica", "normal")
          pdf.text(formatCurrency(Number.parseFloat(expense.amount)), rightColumn, yPosition)
          yPosition += 6
        }
      })

      // Total
      yPosition += 5
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("TOTAL COST:", margin, yPosition)
      pdf.text(formatCurrency(totalCost), margin + 40, yPosition)
      yPosition += 15
    }

    // Remarks Section
    if (serviceAssignment.remarks) {
      checkNewPage(30)
      pdf.setFontSize(16)
      pdf.setFont("helvetica", "bold")
      pdf.text("REMARKS", margin, yPosition)
      yPosition += 8

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      yPosition = addText(serviceAssignment.remarks, margin, yPosition, contentWidth)
      yPosition += 10
    }

    // Requested By Section
    checkNewPage(20)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text("REQUESTED BY", margin, yPosition)
    yPosition += 8

    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "normal")
    pdf.text(`${serviceAssignment.requestedBy?.department || "LOGISTICS"} - ${serviceAssignment.requestedBy?.name || "Unknown User"}`, margin, yPosition)
    yPosition += 15

    // Footer
    checkNewPage(30)
    yPosition = pageHeight - 40

    // Footer separator
    pdf.setLineWidth(0.5)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10

    // Footer content
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)

    pdf.text("Generated by Boohk Platform - Logistics Department", margin, yPosition)
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition + 5)

    // Company info on the right
    pdf.text("Smart. Seamless. Scalable.", pageWidth - margin - 50, yPosition)
    pdf.setFont("helvetica", "bold")
    pdf.text("OH+", pageWidth - margin - 15, yPosition + 5)

    // Apply PDF viewer preferences for initial zoom
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"))
    const modifiedPdfBytes = await setPDFViewerPreferences(pdfBytes)

    if (returnBase64) {
      // Return base64 string for email attachment
      return Buffer.from(modifiedPdfBytes).toString('base64')
    } else {
      // Save the PDF for download
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const fileName = `service-assignment-${serviceAssignment.saNumber.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error("Error generating Service Assignment Fallback PDF:", error)
    throw new Error("Unable to create service assignment PDF. Please check your connection and try again. If the problem persists, contact support.")
  }
}

export async function generateServiceAssignmentHTMLSimple(
  assignment: ServiceAssignmentPDFData,
  companyData?: any,
  logoDataUrl?: string,
  signatureDataUrl?: string,
): Promise<string> {
  const companyName = companyData?.name || companyData?.company_name || "Golden Touch Imaging Specialist"
  const companyAddress = companyData?.address ? (() => {
    // Model 2: address as object with city, province, street
    if (companyData.address && typeof companyData.address === "object") {
      const { street, city, province } = companyData.address
      const addressParts = [street, city, province].filter(
        (part) => part && part.trim() !== "" && !part.toLowerCase().includes("default"),
      )
      return addressParts.join(", ")
    }

    // Model 3: address as string
    if (companyData.address && typeof companyData.address === "string") {
      return companyData.address
    }

    return "721 Gen Solano St., San Miguel, Manila City, Metro Manila, Philippines"
  })() : "721 Gen Solano St., San Miguel, Manila City, Metro Manila, Philippines"
  const logoSrc = logoDataUrl || "/placeholder.svg?height=32&width=60"

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Service Assignment - ${assignment.saNumber}</title>
      <style>
        body {
           font-family: 'Helvetica', 'Arial', sans-serif;
           margin: 0;
           padding: 0;
           background-color: #ffffff;
           color: #000000;
           line-height: 1.4;
         }

         .container {
           width: 816px;
           height: 1056px;
           margin: auto;
         }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          padding-bottom: 8px;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .company-logo {
          height: 32px;
        }

        .company-name {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .company-contact {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .header-right {
          text-align: right;
        }

        .tagged-jo-label {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .tagged-jo-number {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .recipient-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-left: 16px;
          padding-right: 16px;
          padding-top: 8px;
          padding-bottom: 8px;
        }

        .recipient-left {
          display: flex;
          flex-direction: column;
        }

        .recipient-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .recipient-name {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .recipient-dept {
          font-size: 12px;
          color: #6b7280;
          margin: 4px 0 0 0;
        }

        .recipient-right {
          text-align: right;
        }

        .sa-badge {
          background-color: #2196f3;
          color: white;
          padding: 8px 16px;
          font-size: 20px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 130px;
          height: 30px;
          flex-shrink: 0;
          margin-bottom: 8px;
        }

        .issued-date {
          font-size: 12px;
          color: #6b7280;
          margin-top: 8px;
        }

        .info-section {
          padding-left: 16px;
          padding-right: 16px;
          padding-top: 8px;
          padding-bottom: 16px;
        }

        .info-header {
          background-color: #2196f3;
          color: #ffffff;
          padding: 12px 16px;
          font-size: 16px;
          font-weight: 700;
          line-height: 1;
          margin-bottom: 0;
        }

        .info-table {
          width: 100%;
          border-collapse: collapse;
          height: 253px;
        }

        .info-table tr {
          border: 1px solid #d1d5db;
        }

        .info-table td {
          padding: 4px 16px;
          font-size: 12px;
          color: #6b7280;
        }

        .info-table td:first-child {
          background-color: #ffffff;
          width: 33.33%;
          border-right: 1px solid #d1d5db;
        }

        .info-table td:nth-child(2) {
          font-weight: 700;
        }

        .attachments-section {
          padding-left: 24px;
          padding-right: 24px;
          padding-bottom: 24px;
        }

        .attachments-label {
          font-size: 12px;
          font-weight: 700;
          color: #333333;
          line-height: 1;
          margin-bottom: 16px;
        }

        .attachments-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .attachment-box {
          width: 200px;
          height: 200px;
          border: 1px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
        }

        .attachment-image {
          max-width: 190px;
          max-height: 190px;
          object-fit: contain;
        }

        .prepared-by-section {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .prepared-by-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .signature-box {
          width: 152px;
          height: 91px;
          border: 1px solid #d1d5db;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #ffffff;
        }

        .signature-image {
          max-width: 140px;
          max-height: 80px;
          object-fit: contain;
        }

        .prepared-by-name {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          text-align: right;
          margin-top: 16px;
        }

        .prepared-by-dept {
          font-size: 12px;
          color: #6b7280;
          margin: 4px 0 0 0;
          text-align: right;
        }

        .footer {
          background-color: #ffffff;
          padding: 16px 24px;
          text-align: center;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
        }

        .footer-company {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin: 0;
        }

        .footer-address {
          font-size: 12px;
          color: #9ca3af;
          margin: 4px 0 0 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            <img src="${logoSrc}" alt="Company Logo" class="company-logo" />
            <p class="company-name">${companyName}</p>
            <p class="company-contact">${companyAddress}</p>
          </div>
          <div class="header-right">
            <p class="tagged-jo-label">Tagged JO</p>
            <p class="tagged-jo-number">JO#${assignment.saNumber.slice(-4)}</p>
          </div>
        </div>

        <!-- Recipient Section -->
        <div class="recipient-section">
          <div class="recipient-left">
            <p class="recipient-label">Recipient</p>
            <h2 class="recipient-name">
              ${assignment.requestedBy?.name || assignment.assignedTo}
            </h2>
            <p class="recipient-dept">Sales</p>
          </div>
          <div class="recipient-right">
            <div class="sa-badge">
              SA#${assignment.saNumber}
            </div>
            <p class="issued-date">Issued on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        <!-- Service Assignment Information Table -->
        <div class="info-section">
          <div class="info-header">
            Service Assignment Information
          </div>
          <table class="info-table">
            <tbody>
              <tr>
                <td>Site Name</td>
                <td>${assignment.projectSiteName}</td>
              </tr>
              <tr>
                <td>Site Address</td>
                <td>${assignment.projectSiteLocation}</td>
              </tr>
              <tr>
                <td>Campaign Name</td>
                <td>${assignment.campaignName || "N/A"}</td>
              </tr>
              <tr>
                <td>Service Type</td>
                <td>${assignment.serviceType}</td>
              </tr>
              <tr>
                <td>Material Specs</td>
                <td>${assignment.materialSpecs}</td>
              </tr>
              <tr>
                <td>Service Start Date</td>
                <td>${assignment.startDate ? new Date(assignment.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
              </tr>
              <tr>
                <td>Service End Date</td>
                <td>${assignment.endDate ? new Date(assignment.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
              </tr>
              <tr>
                <td>Crew</td>
                <td>${assignment.crewName || assignment.crew}</td>
              </tr>
              <tr>
                <td>Remarks</td>
                <td>${assignment.remarks}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="attachments-section">
          <p class="attachments-label">
            Attachments:
          </p>
          <div class="attachments-content">
            <div class="attachment-box">
              ${assignment.attachments && assignment.attachments.length > 0 && (assignment.attachments[0].url || assignment.attachments[0].fileUrl) ? `<img src="${assignment.attachments[0].url || assignment.attachments[0].fileUrl}" alt="Attachment" class="attachment-image" />` : ''}
            </div>
            <div class="prepared-by-section">
              <p class="prepared-by-label">Prepared By</p>
              <div class="signature-box">
                ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Signature" class="signature-image" />` : ''}
              </div>
              <p class="prepared-by-name">${assignment.requestedBy?.name || "User"}</p>
              <p class="prepared-by-dept">${assignment.requestedBy?.department || "Logistics Team"}</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p class="footer-company">${companyName}</p>
          <p class="footer-address">
            ${companyAddress}
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

export async function generateServiceAssignmentHTML(
  assignmentData: ServiceAssignmentPDFData,
  companyData: any,
  logoDataUrl: string,
): Promise<string> {
  const companyName = companyData?.name || companyData?.company_name || "Company Name"
  const companyTagline = companyData?.tagline || "Smart. Seamless. Scalable."

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Service Assignment - ${assignmentData.saNumber}</title>
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
          position: relative;
        }

        .header-logo {
          position: absolute;
          top: 10px;
          right: 20px;
          width: 60px;
          height: 60px;
          object-fit: contain;
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

        .terms-section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background-color: #ffffff;
        }

        .terms-section h2 {
          margin: 0 0 15px 0;
          font-size: 18px;
          font-weight: bold;
          color: #111827;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 5px;
        }

        .terms-list {
          font-size: 12px;
          line-height: 1.5;
        }

        .terms-list div {
          margin-bottom: 8px;
        }

        .signatures-section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background-color: #ffffff;
        }

        .signatures-section h2 {
          margin: 0 0 15px 0;
          font-size: 18px;
          font-weight: bold;
          color: #111827;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 5px;
        }

        .signature-row {
          display: flex;
          justify-content: space-between;
          margin: 20px 0;
        }

        .signature-box {
          flex: 1;
          margin: 0 10px;
          text-align: center;
        }

        .signature-line {
          border-bottom: 1px solid #000;
          margin: 20px 0;
          height: 30px;
        }

        .signature-name {
          font-weight: bold;
          font-size: 12px;
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
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Company Logo" class="header-logo">` : ''}
        <h1>SERVICE ASSIGNMENT</h1>
        <p>LOGISTICS DEPARTMENT</p>
      </div>

      <div class="sa-number">SA# ${assignmentData.saNumber}</div>

      <div class="status-badge status-${assignmentData.status.toLowerCase().replace(' ', '-')}">
        ${assignmentData.status.toUpperCase()}
      </div>

      <div class="section">
        <h2>SERVICE ASSIGNMENT INFORMATION</h2>
        <div class="field-grid">
          <div class="field">
            <label>SA Number:</label>
            <span>${assignmentData.saNumber}</span>
          </div>
          <div class="field">
            <label>Project Site:</label>
            <span>${assignmentData.projectSiteName}</span>
          </div>
          <div class="field">
            <label>Location:</label>
            <span>${assignmentData.projectSiteLocation || "N/A"}</span>
          </div>
          <div class="field">
            <label>Service Type:</label>
            <span>${assignmentData.serviceType}</span>
          </div>
          <div class="field">
            <label>Assigned To:</label>
            <span>${assignmentData.assignedToName || assignmentData.assignedTo}</span>
          </div>
          <div class="field">
            <label>Duration:</label>
            <span>${assignmentData.serviceDuration ? `${assignmentData.serviceDuration} hours` : "N/A"}</span>
          </div>
          <div class="field">
            <label>Priority:</label>
            <span>${assignmentData.priority}</span>
          </div>
          <div class="field">
            <label>Created:</label>
            <span>${safeToDate(assignmentData.created).toLocaleDateString()}</span>
          </div>
          <div class="field">
            <label>Start Date:</label>
            <span>${assignmentData.startDate ? safeToDate(assignmentData.startDate).toLocaleDateString() : "N/A"}</span>
          </div>
          <div class="field">
            <label>End Date:</label>
            <span>${assignmentData.endDate ? safeToDate(assignmentData.endDate).toLocaleDateString() : "N/A"}</span>
          </div>
          <div class="field">
            <label>Alarm Date:</label>
            <span>${assignmentData.alarmDate ? safeToDate(assignmentData.alarmDate).toLocaleDateString() : "N/A"}</span>
          </div>
          <div class="field">
            <label>Alarm Time:</label>
            <span>${assignmentData.alarmTime || "N/A"}</span>
          </div>
          <div class="field">
            <label>Illumination:</label>
            <span>${assignmentData.illuminationNits ? `${assignmentData.illuminationNits} nits` : "N/A"}</span>
          </div>
          <div class="field">
            <label>Gondola:</label>
            <span>${assignmentData.gondola || "N/A"}</span>
          </div>
          <div class="field">
            <label>Technology:</label>
            <span>${assignmentData.technology || "N/A"}</span>
          </div>
        </div>
      </div>

      ${assignmentData.equipmentRequired || assignmentData.materialSpecs ? `
      <div class="section">
        <h2>EQUIPMENT & MATERIALS</h2>
        ${assignmentData.equipmentRequired ? `
        <div class="field">
          <label>Equipment Required:</label>
          <span>${assignmentData.equipmentRequired}</span>
        </div>
        ` : ''}
        ${assignmentData.materialSpecs ? `
        <div class="field">
          <label>Material Specifications:</label>
          <span>${assignmentData.materialSpecs}</span>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${assignmentData.serviceExpenses && assignmentData.serviceExpenses.length > 0 ? `
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
            ${assignmentData.serviceExpenses.map(expense => `
            <tr>
              <td>${expense.name}</td>
              <td>PHP ${Number.parseFloat(expense.amount).toLocaleString()}</td>
            </tr>
            `).join('')}
            <tr class="total-row">
              <td><strong>TOTAL COST</strong></td>
              <td><strong>PHP ${assignmentData.serviceExpenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0).toLocaleString()}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}

      ${assignmentData.remarks ? `
      <div class="section">
        <h2>REMARKS</h2>
        <div class="field">
          <span>${assignmentData.remarks}</span>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <h2>REQUESTED BY</h2>
        <div class="field">
          <span>${assignmentData.requestedBy?.department || "LOGISTICS"} - ${assignmentData.requestedBy?.name || "Unknown User"}</span>
        </div>
      </div>

      <div class="terms-section">
        <h2>TERMS AND CONDITIONS</h2>
        <div class="terms-list">
          <div>1. Service assignments are subject to the terms and conditions outlined in the original service agreement.</div>
          <div>2. All work must be completed within the specified duration and meet quality standards.</div>
          <div>3. Equipment and materials provided must be handled with care and returned in good condition.</div>
          <div>4. Any additional costs incurred must be approved in advance.</div>
          <div>5. Safety protocols must be followed at all times during service execution.</div>
        </div>
      </div>

      <div class="signatures-section">
        <h2>SIGNATURES</h2>
        <div class="signature-row">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-name">Service Provider</div>
            <div style="font-size: 10px; color: #6b7280; margin-top: 5px;">${assignmentData.assignedToName || assignmentData.assignedTo}</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-name">Client Representative</div>
            <div style="font-size: 10px; color: #6b7280; margin-top: 5px;">${assignmentData.requestedBy?.name || "Unknown User"}</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Generated by Boohk Platform - Logistics Department</p>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>${companyTagline} - ${companyName}</p>
      </div>
    </body>
    </html>
  `
}
