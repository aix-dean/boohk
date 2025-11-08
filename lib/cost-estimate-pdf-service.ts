import jsPDF from "jspdf"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Helper function to safely convert dates
function safeToDate(dateValue: any): Date {
  if (!dateValue) return new Date()
  if (dateValue instanceof Date) return dateValue
  if (dateValue.toDate && typeof dateValue.toDate === "function") return dateValue.toDate()
  return new Date(dateValue)
}

// Generate QR code URL for cost estimate
async function generateQRCode(url: string): Promise<string> {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
}

// Category labels mapping
const categoryLabels = {
  media_cost: "Media Cost",
  production_cost: "Production Cost",
  installation_cost: "Installation Cost",
  maintenance_cost: "Maintenance Cost",
  other: "Other",
  "LED Billboard Rental": "LED Billboard Rental",
  "Static Billboard Rental": "Static Billboard Rental",
  "Billboard Rental": "Billboard Rental",
  Production: "Production",
  Installation: "Installation",
  Maintenance: "Maintenance",
}

async function fetchCompanyData(companyId: string) {
  // Provide immediate fallback data to prevent hanging

  try {
    // Attempt to fetch company data with a very short timeout
    const companyDoc = await getDoc(doc(db, "companies", companyId))

    if (companyDoc.exists()) {
      const data = companyDoc.data()
      // Return fetched data merged with fallback for missing fields
      // Use field names that match the API expectations
      return {
        name: data.name || "",
        address: data.address || [],
        phone: data.phone || data.telephone || data.contact_number || "",
        email: data.email || "",
        website: data.website || data.company_website || "",
        logo: data.logo || data.logo_url || null,
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching company data:", error)
    // Always return fallback data instead of throwing
    return null
  }
}

function formatCompanyAddress(companyData: any): string {
  if (!companyData) return ""

  // Handle company_location field (string format)
  if (companyData.company_location && typeof companyData.company_location === "string") {
    return companyData.company_location
  }

  // Handle address object format
  if (companyData.address && typeof companyData.address === "object") {
    const { street, city, province } = companyData.address
    const addressParts = []

    // Filter out default placeholder values
    if (street && street !== "Default Street" && street.trim()) {
      addressParts.push(street)
    }
    if (city && city !== "Default City" && city.trim()) {
      addressParts.push(city)
    }
    if (province && province !== "Default Province" && province.trim()) {
      addressParts.push(province)
    }

    return addressParts.join(", ")
  }

  // Handle address as string
  if (companyData.address && typeof companyData.address === "string") {
    return companyData.address
  }

  return ""
}

function formatCompanyPhone(companyData: any): string {
  if (!companyData) return ""

  // Try different phone field names
  const phoneFields = ["phone", "telephone", "contact_number"]
  for (const field of phoneFields) {
    if (companyData[field] && companyData[field].trim()) {
      return companyData[field]
    }
  }

  return ""
}

/**
 * Generate separate PDF files for each site in a cost estimate
 */
export async function generateSeparateCostEstimatePDFs(
  costEstimate: CostEstimate,
  selectedPages?: string[],
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
): Promise<void> {
  try {
    // Group line items by site based on the site rental items
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

    let companyData = null
    if (userData?.company_id || costEstimate.company_id) {
      const companyId = userData?.company_id || costEstimate.company_id
      if (companyId) {
        companyData = await fetchCompanyData(companyId)
      }
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

      // Generate PDF for this single site using the API
      const response = await fetch(`/api/generate-cost-estimate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          costEstimate: singleSiteCostEstimate,
          companyData,
          logoDataUrl: null,
          format: 'pdf',
          userData
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate PDF for ${siteName}: ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()

      // Create blob URL and trigger download
      const blob = new Blob([buffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const filename = `${uniqueCENumber}.pdf`
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Add a small delay between downloads to ensure proper file naming
      if (i < sitesToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  } catch (error) {
    console.error("Error generating separate PDFs:", error)
    throw error
  }
}

/**
 * Generate a cost estimate PDF using Puppeteer (similar to quotation PDF generation)
 */
export async function generateCostEstimatePDF(
  costEstimate: CostEstimate,
  selectedPages?: string[],
  returnBase64 = false,
  returnPDF = false,
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
): Promise<string | jsPDF | Blob | void> {
  try {
    // For now, we'll handle multiple sites by generating separate PDFs
    if (selectedPages && selectedPages.length > 0) {
      // Generate separate PDFs for selected pages
      await generateSeparateCostEstimatePDFs(costEstimate, selectedPages, userData)
      return
    }

    // Check if multiple sites - if so, generate separate PDFs
    const groupLineItemsBySite = (lineItems: any[]) => {
      const siteGroups: { [key: string]: any[] } = {}
      lineItems.forEach((item) => {
        if (item.category.includes("Billboard Rental")) {
          const siteName = item.description
          if (!siteGroups[siteName]) siteGroups[siteName] = []
          siteGroups[siteName].push(item)
          const siteId = item.id
          const relatedItems = lineItems.filter(
            (relatedItem) => relatedItem.id.includes(siteId) && relatedItem.id !== siteId,
          )
          siteGroups[siteName].push(...relatedItems)
        }
      })
      if (Object.keys(siteGroups).length === 0) siteGroups["Single Site"] = lineItems
      return siteGroups
    }

    const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
    const sites = Object.keys(siteGroups)

    if (sites.length > 1) {
      await generateSeparateCostEstimatePDFs(costEstimate, undefined, userData)
      return
    }

    // Single site - use Puppeteer API
    let companyData = null
    let logoDataUrl = null

    if (userData?.company_id || costEstimate.company_id) {
      const companyId = userData?.company_id || costEstimate.company_id
      if (companyId) {
        companyData = await fetchCompanyData(companyId)

        // Fetch company logo if available
        if (companyData?.logo) {
          try {
            const logoResponse = await fetch(companyData.logo)
            if (logoResponse.ok) {
              const logoBlob = await logoResponse.blob()
              const logoArrayBuffer = await logoBlob.arrayBuffer()
              const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64')
              const mimeType = logoBlob.type || 'image/png'
              logoDataUrl = `data:${mimeType};base64,${logoBase64}`
            }
          } catch (error) {
            console.error('Error fetching company logo:', error)
            // Continue without logo if fetch fails
          }
        }
      }
    }

    const response = await fetch(`/api/generate-cost-estimate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        costEstimate,
        companyData,
        logoDataUrl,
        format: 'pdf',
        userData
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate PDF: ${response.statusText}`)
    }

    if (returnBase64) {
      // Return the blob for custom handling
      return await response.blob()
    }

    // Create blob URL and trigger download
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const filename = `${costEstimate.costEstimateNumber || costEstimate.id || 'cost-estimate'}.pdf`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

  } catch (error) {
    console.error("Error generating PDF:", error)
    throw error
  }
}


/**
 * Generate a detailed cost estimate PDF with line item breakdown
 */
export async function generateDetailedCostEstimatePDF(
  costEstimate: CostEstimate,
  returnBase64 = false,
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
): Promise<string | void> {
  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let yPosition = margin

    // Convert dates safely
    const createdAt = safeToDate(costEstimate.createdAt)
    const validUntil = safeToDate(costEstimate.validUntil)
    const startDate = costEstimate.startDate ? safeToDate(costEstimate.startDate) : null
    const endDate = costEstimate.endDate ? safeToDate(costEstimate.endDate) : null

    let companyData = null
    let logoDataUrl = null

    if (userData?.company_id || costEstimate.company_id) {
      const companyId = userData?.company_id || costEstimate.company_id
      if (companyId) {
        companyData = await fetchCompanyData(companyId)

        // Fetch company logo if available
        if (companyData?.logo) {
          try {
            const logoResponse = await fetch(companyData.logo)
            if (logoResponse.ok) {
              const logoBlob = await logoResponse.blob()
              const logoArrayBuffer = await logoBlob.arrayBuffer()
              const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64')
              const mimeType = logoBlob.type || 'image/png'
              logoDataUrl = `data:${mimeType};base64,${logoBase64}`
            }
          } catch (error) {
            console.error('Error fetching company logo:', error)
            // Continue without logo if fetch fails
          }
        }
      }
    }

    // Header with company name
    const headerContentWidth = contentWidth - 22
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(0, 0, 0)
    const companyName = companyData?.name || "Golden Touch Imaging Specialist"
    const companyNameWidth = pdf.getTextWidth(companyName)
    const companyNameX = pageWidth / 2 - companyNameWidth / 2
    pdf.text(companyName, companyNameX, yPosition)
    yPosition += 15

    // Cost Estimate title
    pdf.setFontSize(24)
    pdf.setFont("helvetica", "bold")
    pdf.text("COST ESTIMATE", margin, yPosition)
    yPosition += 12

    pdf.setFontSize(16)
    pdf.setFont("helvetica", "normal")
    const titleLines = pdf.splitTextToSize(costEstimate.title || "Untitled Cost Estimate", headerContentWidth)
    pdf.text(titleLines, margin, yPosition)
    yPosition += titleLines.length * 6 + 3

    // Date and validity
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`Created: ${createdAt.toLocaleDateString()}`, margin, yPosition)
    pdf.text(`Estimate #: ${costEstimate.costEstimateNumber || costEstimate.id}`, margin, yPosition + 5)
    yPosition += 15

    // Reset text color
    pdf.setTextColor(0, 0, 0)

    // Client Information Section
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("CLIENT INFORMATION", margin, yPosition)
    yPosition += 6

    // Draw line under section header
    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")

    // Client details in two columns
    const leftColumn = margin
    const rightColumn = margin + contentWidth / 2

    // Left column
    pdf.setFont("helvetica", "bold")
    pdf.text("Company:", leftColumn, yPosition)
    pdf.setFont("helvetica", "normal")
    pdf.text(costEstimate.client?.company || "N/A", leftColumn + 25, yPosition)

    // Right column
    pdf.setFont("helvetica", "bold")
    pdf.text("Contact Person:", rightColumn, yPosition)
    pdf.setFont("helvetica", "normal")
    pdf.text(costEstimate.client?.name || "N/A", rightColumn + 35, yPosition)
    yPosition += 6

    // Second row
    pdf.setFont("helvetica", "bold")
    pdf.text("Email:", leftColumn, yPosition)
    pdf.setFont("helvetica", "normal")
    pdf.text(costEstimate.client?.email || "N/A", leftColumn + 25, yPosition)

    pdf.setFont("helvetica", "bold")
    pdf.text("Phone:", rightColumn, yPosition)
    pdf.setFont("helvetica", "normal")
    pdf.text(costEstimate.client?.phone || "N/A", rightColumn + 35, yPosition)
    yPosition += 6

    // Address (full width if present)
    if (costEstimate.client?.address) {
      pdf.setFont("helvetica", "bold")
      pdf.text("Address:", leftColumn, yPosition)
      pdf.setFont("helvetica", "normal")
      const addressLines = pdf.splitTextToSize(costEstimate.client.address, contentWidth - 25)
      pdf.text(addressLines, leftColumn + 25, yPosition)
      yPosition += addressLines.length * 5 + 3
    }

    yPosition += 8

    // Cost Summary Section
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("COST SUMMARY", margin, yPosition)
    yPosition += 6

    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    // Calculate totals
    const subtotal = costEstimate.lineItems.reduce((sum, item) => sum + item.total, 0)
    const vatRate = 0.12
    const vatAmount = subtotal * vatRate
    const totalWithVat = subtotal + vatAmount

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")

    // Summary items
    const summaryItems = [
      { label: "Number of Items:", value: `${costEstimate.lineItems?.length || 0} line items` },
      { label: "Duration:", value: `${costEstimate.durationDays || 0} days` },
      { label: "Start Date:", value: startDate ? startDate.toLocaleDateString() : "TBD" },
      { label: "End Date:", value: endDate ? endDate.toLocaleDateString() : "TBD" },
    ]

    summaryItems.forEach((item) => {
      pdf.setFont("helvetica", "bold")
      pdf.text(item.label, margin, yPosition)
      pdf.setFont("helvetica", "normal")
      pdf.text(item.value, margin + 40, yPosition)
      yPosition += 6
    })

    yPosition += 8

    // Financial Summary with better formatting
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text("FINANCIAL SUMMARY", margin, yPosition)
    yPosition += 8

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text("Subtotal:", margin + 5, yPosition)
    pdf.text(`₱${subtotal.toLocaleString()}`, pageWidth - margin - 40, yPosition)
    yPosition += 6

    pdf.text(`VAT (${(vatRate * 100).toFixed(0)}%):`, margin + 5, yPosition)
    pdf.text(`₱${vatAmount.toLocaleString()}`, pageWidth - margin - 40, yPosition)
    yPosition += 8

    // Total amount with better formatting
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    const totalText = `TOTAL AMOUNT: ₱${totalWithVat.toLocaleString()}`
    pdf.setFillColor(245, 245, 245)
    pdf.rect(margin, yPosition - 4, contentWidth, 12, "F")
    pdf.text(totalText, margin + 5, yPosition + 3)
    yPosition += 15

    // Notes section
    if (costEstimate.notes) {
      pdf.setFontSize(14)
      pdf.setFont("helvetica", "bold")
      pdf.text("ADDITIONAL NOTES", margin, yPosition)
      yPosition += 6

      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      pdf.setFontSize(10)
      pdf.setFont("helvetica", "normal")
      const noteLines = pdf.splitTextToSize(costEstimate.notes, contentWidth)
      pdf.text(noteLines, margin, yPosition)
      yPosition += noteLines.length * 5 + 10
    }

    // Footer
    const footerY = pageHeight - 15
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text("Generated by Boohk Platform", margin, footerY)
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, footerY)

    if (returnBase64) {
      // Return base64 string for email attachment
      return pdf.output("datauristring").split(",")[1]
    } else {
      // Save the PDF for download
      const fileName = `detailed-cost-estimate-${(costEstimate.title || "estimate").replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.pdf`
      pdf.save(fileName)
    }
  } catch (error) {
    console.error("Error generating detailed Cost Estimate PDF:", error)
    throw new Error("Failed to generate detailed Cost Estimate PDF")
  }
}

/**
 * Generate a cost estimate PDF for email attachment (similar to generateProposalPDF)
 * This function creates a simplified PDF optimized for email attachments
 */
export async function generateCostEstimateEmailPDF(
  costEstimate: CostEstimate,
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
): Promise<string | null> {
  try {
    console.log("[v0] Starting email PDF generation for cost estimate:", costEstimate.id)

    // Use the main generateCostEstimatePDF function with returnBase64 = true to ensure same formatting
    const pdfBase64 = await generateCostEstimatePDF(costEstimate, undefined, true, false, userData)

    if (pdfBase64) {
      console.log("[v0] Email PDF generated successfully")
      return pdfBase64 as string
    } else {
      console.log("[v0] Email PDF generation returned null")
      return null
    }
  } catch (error) {
    console.error("[v0] Error generating email PDF:", error)
    return null
  }
}

/**
 * Generate a cost estimate PDF blob for printing (client-side generation)
 * Returns a Blob that can be opened in a new window for printing
 */
export async function generateCostEstimatePDFBlob(
  costEstimate: CostEstimate,
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let yPosition = margin

  // Convert dates safely
  const createdAt = safeToDate(costEstimate.createdAt)
  const validUntil = safeToDate(costEstimate.validUntil)
  const startDate = costEstimate.startDate ? safeToDate(costEstimate.startDate) : null
  const endDate = costEstimate.endDate ? safeToDate(costEstimate.endDate) : null

  let companyData = null
  let logoDataUrl = null

  if (userData?.company_id || costEstimate.company_id) {
    const companyId = userData?.company_id || costEstimate.company_id
    if (companyId) {
      companyData = await fetchCompanyData(companyId)

      // Fetch company logo if available
      if (companyData?.logo) {
        try {
          const logoResponse = await fetch(companyData.logo)
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob()
            const logoArrayBuffer = await logoBlob.arrayBuffer()
            const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64')
            const mimeType = logoBlob.type || 'image/png'
            logoDataUrl = `data:${mimeType};base64,${logoBase64}`
          }
        } catch (error) {
          console.error('Error fetching company logo:', error)
          // Continue without logo if fetch fails
        }
      }
    }
  }

  // Header with company name
  const headerContentWidth = contentWidth - 22
  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0, 0, 0)
  const companyName = companyData?.name || "Golden Touch Imaging Specialist"
  const companyNameWidth = pdf.getTextWidth(companyName)
  const companyNameX = pageWidth / 2 - companyNameWidth / 2
  pdf.text(companyName, companyNameX, yPosition)
  yPosition += 15

  // Cost Estimate title
  pdf.setFontSize(24)
  pdf.setFont("helvetica", "bold")
  pdf.text("COST ESTIMATE", margin, yPosition)
  yPosition += 12

  pdf.setFontSize(16)
  pdf.setFont("helvetica", "normal")
  const titleLines = pdf.splitTextToSize(costEstimate.title || "Untitled Cost Estimate", headerContentWidth)
  pdf.text(titleLines, margin, yPosition)
  yPosition += titleLines.length * 6 + 3

  // Date and validity
  pdf.setFontSize(10)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Created: ${createdAt.toLocaleDateString()}`, margin, yPosition)
  pdf.text(`Estimate #: ${costEstimate.costEstimateNumber || costEstimate.id}`, margin, yPosition + 5)
  yPosition += 15

  // Reset text color
  pdf.setTextColor(0, 0, 0)

  // Client Information Section
  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.text("CLIENT INFORMATION", margin, yPosition)
  yPosition += 6

  // Draw line under section header
  pdf.setLineWidth(0.5)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")

  // Client details in two columns
  const leftColumn = margin
  const rightColumn = margin + contentWidth / 2

  // Left column
  pdf.setFont("helvetica", "bold")
  pdf.text("Company:", leftColumn, yPosition)
  pdf.setFont("helvetica", "normal")
  pdf.text(costEstimate.client?.company || "N/A", leftColumn + 25, yPosition)

  // Right column
  pdf.setFont("helvetica", "bold")
  pdf.text("Contact Person:", rightColumn, yPosition)
  pdf.setFont("helvetica", "normal")
  pdf.text(costEstimate.client?.name || "N/A", rightColumn + 35, yPosition)
  yPosition += 6

  // Second row
  pdf.setFont("helvetica", "bold")
  pdf.text("Email:", leftColumn, yPosition)
  pdf.setFont("helvetica", "normal")
  pdf.text(costEstimate.client?.email || "N/A", leftColumn + 25, yPosition)

  pdf.setFont("helvetica", "bold")
  pdf.text("Phone:", rightColumn, yPosition)
  pdf.setFont("helvetica", "normal")
  pdf.text(costEstimate.client?.phone || "N/A", rightColumn + 35, yPosition)
  yPosition += 6

  // Address (full width if present)
  if (costEstimate.client?.address) {
    pdf.setFont("helvetica", "bold")
    pdf.text("Address:", leftColumn, yPosition)
    pdf.setFont("helvetica", "normal")
    const addressLines = pdf.splitTextToSize(costEstimate.client.address, contentWidth - 25)
    pdf.text(addressLines, leftColumn + 25, yPosition)
    yPosition += addressLines.length * 5 + 3
  }

  yPosition += 8

  // Cost Summary Section
  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.text("COST SUMMARY", margin, yPosition)
  yPosition += 6

  pdf.setLineWidth(0.5)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  // Calculate totals
  const subtotal = costEstimate.lineItems.reduce((sum, item) => sum + item.total, 0)
  const vatRate = 0.12
  const vatAmount = subtotal * vatRate
  const totalWithVat = subtotal + vatAmount

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")

  // Summary items
  const summaryItems = [
    { label: "Number of Items:", value: `${costEstimate.lineItems?.length || 0} line items` },
    { label: "Duration:", value: `${costEstimate.durationDays || 0} days` },
    { label: "Start Date:", value: startDate ? startDate.toLocaleDateString() : "TBD" },
    { label: "End Date:", value: endDate ? endDate.toLocaleDateString() : "TBD" },
  ]

  summaryItems.forEach((item) => {
    pdf.setFont("helvetica", "bold")
    pdf.text(item.label, margin, yPosition)
    pdf.setFont("helvetica", "normal")
    pdf.text(item.value, margin + 40, yPosition)
    yPosition += 6
  })

  yPosition += 8

  // Financial Summary with better formatting
  pdf.setFontSize(12)
  pdf.setFont("helvetica", "bold")
  pdf.text("FINANCIAL SUMMARY", margin, yPosition)
  yPosition += 8

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text("Subtotal:", margin + 5, yPosition)
  pdf.text(`₱${subtotal.toLocaleString()}`, pageWidth - margin - 40, yPosition)
  yPosition += 6

  pdf.text(`VAT (${(vatRate * 100).toFixed(0)}%):`, margin + 5, yPosition)
  pdf.text(`₱${vatAmount.toLocaleString()}`, pageWidth - margin - 40, yPosition)
  yPosition += 8

  // Total amount with better formatting
  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  const totalText = `TOTAL AMOUNT: ₱${totalWithVat.toLocaleString()}`
  pdf.setFillColor(245, 245, 245)
  pdf.rect(margin, yPosition - 4, contentWidth, 12, "F")
  pdf.text(totalText, margin + 5, yPosition + 3)
  yPosition += 15

  // Notes section
  if (costEstimate.notes) {
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    pdf.text("ADDITIONAL NOTES", margin, yPosition)
    yPosition += 6

    pdf.setLineWidth(0.5)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    const noteLines = pdf.splitTextToSize(costEstimate.notes, contentWidth)
    pdf.text(noteLines, margin, yPosition)
    yPosition += noteLines.length * 5 + 10
  }

  // Footer
  const footerY = pageHeight - 15
  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text("Generated by Boohk Platform", margin, footerY)
  pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, footerY)

  // Return the PDF as a blob
  return pdf.output('blob')
}

/**
 * Generate and print a cost estimate PDF
 * Creates the PDF blob, opens it in a new window, and triggers the print dialog
 */
export async function printCostEstimatePDF(
  costEstimate: CostEstimate,
  selectedPages?: string[],
  userData?: { first_name?: string; last_name?: string; email?: string; company_id?: string },
): Promise<void> {
  try {
    let companyData = null
    let logoDataUrl = null

    if (userData?.company_id || costEstimate.company_id) {
      const companyId = userData?.company_id || costEstimate.company_id
      if (companyId) {
        companyData = await fetchCompanyData(companyId)

        // Fetch company logo if available
        if (companyData?.logo) {
          try {
            const logoResponse = await fetch(companyData.logo)
            if (logoResponse.ok) {
              const logoBlob = await logoResponse.blob()
              const logoArrayBuffer = await logoBlob.arrayBuffer()
              const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64')
              const mimeType = logoBlob.type || 'image/png'
              logoDataUrl = `data:${mimeType};base64,${logoBase64}`
            }
          } catch (error) {
            console.error('Error fetching company logo:', error)
            // Continue without logo if fetch fails
          }
        }
      }
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-cost-estimate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        costEstimate,
        companyData,
        logoDataUrl,
        format: 'pdf',
        userData
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate PDF: ${response.statusText}`)
    }

    const buffer = await response.arrayBuffer()
    const pdfBlob = new Blob([buffer], { type: 'application/pdf' })
    const pdfUrl = URL.createObjectURL(pdfBlob)

    // Open PDF in new window and trigger print
    const printWindow = window.open(pdfUrl, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
        // Clean up the URL after printing
        printWindow.onafterprint = () => {
          URL.revokeObjectURL(pdfUrl)
        }
      }
    } else {
      console.error("Failed to open print window")
      URL.revokeObjectURL(pdfUrl)
    }
  } catch (error) {
    console.error("Error printing PDF:", error)
    throw error
  }
}
