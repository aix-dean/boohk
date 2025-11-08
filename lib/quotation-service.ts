import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { addQuotationToCampaign } from "@/lib/campaign-service"
import { jsPDF } from "jspdf"
import { loadImageAsBase64, generateQRCode, getImageDimensions } from "@/lib/pdf-service"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { QuotationProduct, Quotation } from "@/lib/types/quotation" // Import the updated Quotation type
import { getProductById as getProductFromFirebase } from "@/lib/firebase-service" // Import the product fetching function

export type { QuotationProduct, Quotation } from "@/lib/types/quotation"

// Generate an 8-digit password for quotation PDF access
export function generateQuotationPassword(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

// Create a new quotation
export async function createQuotation(quotationData: Omit<Quotation, "id">): Promise<string> {
  try {
    console.log("Creating quotation with data:", quotationData)

    // Ensure all required fields have proper values and no undefined values
    const sanitizedData = {
      ...quotationData,
      quotation_number: quotationData.quotation_number || "",
      client_name: quotationData.client_name || "",
      client_email: quotationData.client_email || "",
      client_id: quotationData.client_id || "",
      client_company_name: quotationData.client_company_name || "",
      client_phone: quotationData.client_phone || "",
      client_address: quotationData.client_address || "",
      client_designation: quotationData.client_designation || "",
      client_company_id: quotationData.client_company_id || "",
      status: quotationData.status || "draft",
      created_by: quotationData.created_by || "",
      seller_id: quotationData.seller_id || "",
      company_id: quotationData.company_id || "",
      created_by_first_name: quotationData.created_by_first_name || "",
      created_by_last_name: quotationData.created_by_last_name || "",
      start_date: quotationData.start_date || "",
      end_date: quotationData.end_date || "",
      duration_days: quotationData.duration_days || 0,
      total_amount: quotationData.total_amount || 0,
      valid_until: quotationData.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: quotationData.items || {},
      projectCompliance: quotationData.projectCompliance || {
        signedQuotation: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        signedContract: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        irrevocablePo: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        finalArtwork: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        paymentAsDeposit: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
      },
      created: serverTimestamp(),
      updated: serverTimestamp(),
    }

    console.log("New quotation data being sent to Firestore:", sanitizedData);

    const docRef = await addDoc(collection(db, "quotations"), sanitizedData)
    console.log("Quotation created with ID:", docRef.id)

    // If there's a campaign ID, add this quotation to the campaign
    if (quotationData.campaignId) {
      try {
        await addQuotationToCampaign(quotationData.campaignId, docRef.id, quotationData.created_by || "system")
      } catch (error) {
        console.error("Error linking quotation to campaign:", error)
        // Don't throw here, as the quotation was created successfully
      }
    }

    return docRef.id
  } catch (error: any) {
    console.error("Error creating quotation:", error)
    throw new Error("Failed to create quotation: " + error.message)
  }
}

// Get quotation by ID
export async function getQuotationById(quotationId: string): Promise<Quotation | null> {
  try {
    const quotationDoc = await getDoc(doc(db, "quotations", quotationId))

    if (quotationDoc.exists()) {
      const data = quotationDoc.data() as Quotation
      const itemInQuotation = data.items || {} // Changed from products to items

      // Fetch full product details for the product in the quotation
      let enrichedItem: QuotationProduct = itemInQuotation as QuotationProduct
      if (itemInQuotation.id) {
        const fullProductDetails = await getProductFromFirebase(itemInQuotation.id)
        if (fullProductDetails) {
          // Merge existing quotation product data with full product details.
          // Prioritize quotation-specific fields (like price, notes if they were overridden)
          // but ensure all detailed fields (media, specs_rental, description, etc.) are present.
          enrichedItem = {
            ...fullProductDetails, // Start with all details from the product collection
            ...itemInQuotation, // Overlay with any specific data stored in the quotation's product entry
            // Ensure price from quotation is used if it exists, otherwise fallback to product price
            price: itemInQuotation.price !== undefined ? itemInQuotation.price : fullProductDetails.price,
            // Populate media_url from the first media item if available
            media_url:
              fullProductDetails.media && fullProductDetails.media.length > 0
                ? fullProductDetails.media[0].url
                : undefined,
          } as QuotationProduct
        }
      }

      return {
        id: quotationDoc.id,
        ...data,
        items: enrichedItem, // Changed products to items
      } as Quotation
    }

    return null
  } catch (error) {
    console.error("Error fetching quotation:", error)
    return null
  }
}

// Update an existing quotation
export async function updateQuotation(
  quotationId: string,
  updatedData: Partial<Quotation>,
  userId: string,
  userName: string,
): Promise<void> {
  try {
    const quotationRef = doc(db, "quotations", quotationId)

    // Prepare data for Firestore update, handling nested objects
    const updateData: { [key: string]: any } = {
      updated: serverTimestamp(),
      updated_by: userName, // Or userId if you prefer to store ID
    }

    if (updatedData.quotation_number !== undefined) updateData.quotation_number = updatedData.quotation_number
    if (updatedData.client_name !== undefined) updateData.client_name = updatedData.client_name
    if (updatedData.client_email !== undefined) updateData.client_email = updatedData.client_email
    if (updatedData.client_id !== undefined) updateData.client_id = updatedData.client_id
    if (updatedData.client_company_name !== undefined) updateData.client_company_name = updatedData.client_company_name
    if (updatedData.client_phone !== undefined) updateData.client_phone = updatedData.client_phone
    if (updatedData.client_address !== undefined) updateData.client_address = updatedData.client_address
    if (updatedData.client_designation !== undefined) updateData.client_designation = updatedData.client_designation
    if (updatedData.client_company_id !== undefined) updateData.client_company_id = updatedData.client_company_id
    if (updatedData.status !== undefined) updateData.status = updatedData.status
    if (updatedData.created_by !== undefined) updateData.created_by = updatedData.created_by
    if (updatedData.seller_id !== undefined) updateData.seller_id = updatedData.seller_id
    if (updatedData.company_id !== undefined) updateData.company_id = updatedData.company_id
    if (updatedData.created_by_first_name !== undefined) updateData.created_by_first_name = updatedData.created_by_first_name
    if (updatedData.created_by_last_name !== undefined) updateData.created_by_last_name = updatedData.created_by_last_name
    if (updatedData.start_date !== undefined) updateData.start_date = updatedData.start_date
    if (updatedData.end_date !== undefined) updateData.end_date = updatedData.end_date
    if (updatedData.duration_days !== undefined) updateData.duration_days = updatedData.duration_days
    if (updatedData.total_amount !== undefined) updateData.total_amount = updatedData.total_amount
    if (updatedData.valid_until !== undefined) updateData.valid_until = updatedData.valid_until
    if (updatedData.notes !== undefined) updateData.notes = updatedData.notes
    if (updatedData.campaignId !== undefined) updateData.campaignId = updatedData.campaignId
    if (updatedData.proposalId !== undefined) updateData.proposalId = updatedData.proposalId
    if (updatedData.page_id !== undefined) updateData.page_id = updatedData.page_id
    if (updatedData.page_number !== undefined) updateData.page_number = updatedData.page_number
    if (updatedData.size !== undefined) updateData.size = updatedData.size
    if (updatedData.costEstimateNumber !== undefined) updateData.costEstimateNumber = updatedData.costEstimateNumber

    if (updatedData.pdf !== undefined) updateData.pdf = updatedData.pdf
    if (updatedData.password !== undefined) updateData.password = updatedData.password
    if (updatedData.signature_date !== undefined) updateData.signature_date = updatedData.signature_date

    if (updatedData.items !== undefined) {
      updateData.items = updatedData.items
    }

    if (updatedData.projectCompliance !== undefined) {
      updateData.projectCompliance = updatedData.projectCompliance
    }

    if (updatedData.client_compliance !== undefined) {
      updateData.client_compliance = updatedData.client_compliance
    }

    if (updatedData.signature_position !== undefined) updateData.signature_position = updatedData.signature_position
    if (updatedData.signature_name !== undefined) updateData.signature_name = updatedData.signature_name

    if (updatedData.template !== undefined) {
      updateData.template = updatedData.template
    }

    await updateDoc(quotationRef, updateData)
    console.log(`Quotation ${quotationId} updated successfully.`)
  } catch (error) {
    console.error("Error updating quotation:", error)
    throw new Error("Failed to update quotation: " + (error as any).message)
  }
}

// Generate quotation number
export function generateQuotationNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const time = String(now.getTime()).slice(-4)

  return `QT-${year}${month}${day}-${time}`
}

// Calculate prorated price based on actual calendar months and days
export function calculateProratedPrice(price: number, startDate: Date, endDate: Date): number {
  let total = 0;
  let currentDate = new Date(startDate);

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

// Calculate total amount based on dates and price
export function calculateQuotationTotal(
  startDate: string,
  endDate: string,
  items: QuotationProduct, // Changed from products to items
): {
  durationDays: number
  totalAmount: number
} {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  let totalAmount = 0
  const item = items
  const itemTotal = calculateProratedPrice(item.price || 0, start, end)
  item.item_total_amount = itemTotal // Assign calculated item total amount
  item.duration_days = durationDays // Assign calculated duration days to item
  totalAmount += itemTotal

  return {
    durationDays,
    totalAmount,
  }
}

// Helper to format date
const formatDate = (date: any) => {
  if (!date) return "N/A"
  try {
    const dateObj = date.toDate ? date.toDate() : new Date(date)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj)
  } catch (error) {
    return "Invalid Date"
  }
}

// Helper to safely convert to string for PDF
export const safeString = (value: any): string => {
  if (value === null || value === undefined) return "N/A"
  if (typeof value === "string") return value
  if (typeof value === "number") return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (typeof value === "boolean") return value.toString()
  if (value && typeof value === "object") {
    if (value.id) return value.id.toString()
    if (value.toString) return value.toString()
    return "N/A"
  }
  return String(value)
}

// Helper function to safely convert to Date (re-using from pdf-service)
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

// Helper function to add image to PDF (copied and adapted from pdf-service)
const addImageToPDF = async (
  pdf: jsPDF,
  imageUrl: string,
  x: number, // Target X for the bounding box
  y: number, // Target Y for the bounding box
  targetWidth: number, // Target width for the bounding box
  targetHeight: number, // Target height for the bounding box
) => {
  try {
    const base64 = await loadImageAsBase64(imageUrl)
    if (!base64) return { actualWidth: 0, actualHeight: 0, xOffset: 0, yOffset: 0 }

    const dimensions = await getImageDimensions(base64)

    const { width: imgWidth, height: imgHeight } = dimensions
    const aspectRatio = imgWidth / imgHeight

    let finalWidth = targetWidth
    let finalHeight = targetHeight

    // Scale to fit within targetWidth and targetHeight while preserving aspect ratio
    if (imgWidth / imgHeight > targetWidth / targetHeight) {
      // Image is wider than target box aspect ratio
      finalHeight = targetWidth / aspectRatio
      finalWidth = targetWidth
    } else {
      // Image is taller than target box aspect ratio
      finalWidth = targetHeight * aspectRatio
      finalHeight = targetHeight
    }

    // Calculate offsets to center the image within the target bounding box
    const xOffset = x + (targetWidth - finalWidth) / 2
    const yOffset = y + (targetHeight - finalHeight) / 2

    pdf.addImage(base64, "JPEG", xOffset, yOffset, finalWidth, finalHeight)
    return { actualWidth: finalWidth, actualHeight: finalHeight, xOffset, yOffset }
  } catch (error) {
    console.error("Error adding image to PDF:", error)
    return { actualWidth: 0, actualHeight: 0, xOffset: 0, yOffset: 0 }
  }
}

// Helper function to calculate text height without drawing
const calculateTextHeight = (text: string, maxWidth: number, fontSize = 10): number => {
  const tempPdf = new jsPDF() // Create a temporary jsPDF instance for calculation
  tempPdf.setFontSize(fontSize)
  const lines = tempPdf.splitTextToSize(text, maxWidth)
  return lines.length * fontSize * 0.35 // Adjusted multiplier for better estimation
}

// Generate PDF for quotation
export async function generateQuotationPDF(quotation: Quotation, returnBlob: boolean = false): Promise<void | Blob> {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let yPosition = margin

  // Safely convert dates
  const createdDate = safeToDate(quotation.created)
  const validUntilDate = safeToDate(quotation.valid_until)

  // Helper function to add text with word wrapping and return new yPosition
  const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
    pdf.setFontSize(fontSize)
    const lines = pdf.splitTextToSize(text, maxWidth)
    pdf.text(lines, x, y)
    return y + lines.length * fontSize * 0.35 // Adjusted multiplier
  }

  // Helper function to check if we need a new page
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 20) {
      // -20 for footer space
      pdf.addPage()
      yPosition = margin
      // Re-add header elements on new page
      addHeaderElementsToPage() // Call this without await as it's not critical for layout flow
      yPosition = Math.max(yPosition, margin + 35) // Ensure content starts below header elements
    }
  }

  // Helper function to add QR code and logo to current page
  const addHeaderElementsToPage = async () => {
    try {
      const qrSize = 20
      const qrX = pageWidth - margin - qrSize
      const qrY = margin

      // Generate QR Code for quotation view URL
      const quotationViewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quotations/${quotation.id}/accept`
      const qrCodeUrl = await generateQRCode(quotationViewUrl)
      const qrBase64 = await loadImageAsBase64(qrCodeUrl)

      if (qrBase64) {
        pdf.addImage(qrBase64, "PNG", qrX, qrY, qrSize, qrSize)
        pdf.setFontSize(6)
        pdf.setTextColor(100, 100, 100)
        const textWidth = pdf.getTextWidth("Scan to view online")
        pdf.text("Scan to view online", qrX + (qrSize - textWidth) / 2, qrY + qrSize + 3)
        pdf.setTextColor(0, 0, 0)
      }

      // Add Company Logo with proper aspect ratio handling
      const logoUrl = "public/boohk-logo.svg"
      const logoBase64 = await loadImageAsBase64(logoUrl)
      if (logoBase64) {
        // Get actual logo dimensions
        const { width: actualLogoWidth, height: actualLogoHeight } = await getImageDimensions(logoBase64)

        // Calculate proper dimensions maintaining aspect ratio
        const maxLogoWidth = 35
        const maxLogoHeight = 12
        const logoAspectRatio = actualLogoWidth / actualLogoHeight

        let finalLogoWidth = maxLogoWidth
        let finalLogoHeight = maxLogoWidth / logoAspectRatio

        // If height exceeds max, scale down based on height
        if (finalLogoHeight > maxLogoHeight) {
          finalLogoHeight = maxLogoHeight
          finalLogoWidth = maxLogoHeight * logoAspectRatio
        }

        pdf.addImage(logoBase64, "PNG", margin, margin, finalLogoWidth, finalLogoHeight)
      }
    } catch (error) {
      console.error("Error adding header elements to PDF:", error)
    }
  }

  // Add header elements to the first page
  await addHeaderElementsToPage()
  yPosition = Math.max(yPosition, margin + 40) // Ensure content starts below header elements with added spacing

  // Header (Quotation Title)
  pdf.setFontSize(24) // Increased font size
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(37, 99, 235) // Blue color
  pdf.text("QUOTATION", margin, yPosition)
  yPosition += 10 // Adjusted spacing

  pdf.setFontSize(12) // Adjusted font size
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(0, 0, 0)
  pdf.text(`Quotation No: ${quotation.quotation_number}`, margin, yPosition)
  yPosition += 5

  pdf.setLineWidth(0.5) // Thicker line
  pdf.setDrawColor(37, 99, 235) // Blue line
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 10

  // Quotation Information Section
  let quotationInfoHeight = 0
  quotationInfoHeight += 5 // Section title spacing
  quotationInfoHeight += 8 // Line spacing
  quotationInfoHeight += 5 // Created Date / Valid Until
  if (quotation.start_date || quotation.end_date) {
    quotationInfoHeight += 5 // Start Date / End Date
  }
  quotationInfoHeight += 5 // Total Amount
  quotationInfoHeight += 10 // Spacing after section
  checkNewPage(quotationInfoHeight)

  pdf.setFontSize(14) // Adjusted font size
  pdf.setFont("helvetica", "bold")
  pdf.text("QUOTATION INFORMATION", margin, yPosition)
  yPosition += 5
  pdf.setLineWidth(0.2)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  pdf.setFontSize(10) // Adjusted font size
  pdf.setFont("helvetica", "normal")
  pdf.text(`Created Date: ${formatDate(createdDate)}`, margin, yPosition)
  pdf.text(`Valid Until: ${formatDate(validUntilDate)}`, margin + contentWidth / 2, yPosition)
  yPosition += 6 // Adjusted spacing

  // Add start and end dates for the rental period
  if (quotation.start_date) {
    pdf.text(`Start Date: ${formatDate(quotation.start_date)}`, margin, yPosition)
  }
  if (quotation.end_date) {
    pdf.text(`End Date: ${formatDate(quotation.end_date)}`, margin + contentWidth / 2, yPosition)
  }
  if (quotation.start_date || quotation.end_date) {
    yPosition += 6 // Adjusted spacing
  }

  pdf.text(`Total Amount: PHP${safeString(quotation.total_amount)}`, margin, yPosition)
  yPosition += 10

  // Client Information Section
  let clientInfoHeight = 0
  clientInfoHeight += 5 // Section title spacing
  clientInfoHeight += 8 // Line spacing
  clientInfoHeight += 5 // Client Name / Email
  if (quotation.client_designation) clientInfoHeight += 5
  if (quotation.client_phone) clientInfoHeight += 5
  if (quotation.client_address)
    clientInfoHeight += calculateTextHeight(safeString(quotation.client_address), contentWidth / 2, 9) + 5
  if (quotation.quotation_request_id) clientInfoHeight += 5
  if (quotation.proposalId) clientInfoHeight += 5
  if (quotation.campaignId) clientInfoHeight += 5
  clientInfoHeight += 10 // Spacing after section
  checkNewPage(clientInfoHeight)

  pdf.setFontSize(14) // Adjusted font size
  pdf.setFont("helvetica", "bold")
  pdf.text("CLIENT INFORMATION", margin, yPosition)
  yPosition += 5
  pdf.setLineWidth(0.2)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  pdf.setFontSize(10) // Adjusted font size
  pdf.setFont("helvetica", "normal")

  pdf.text(`Client Name: ${safeString(quotation.client_name)}`, margin, yPosition)
  pdf.text(`Client Email: ${safeString(quotation.client_email)}`, margin + contentWidth / 2, yPosition)
  yPosition += 6 // Adjusted spacing

  if (quotation.client_designation) {
    pdf.text(`Designation: ${safeString(quotation.client_designation)}`, margin, yPosition)
  }
  if (quotation.client_phone) {
    pdf.text(`Phone: ${safeString(quotation.client_phone)}`, margin + contentWidth / 2, yPosition)
    yPosition += 6 // Adjusted spacing
  }
  if (quotation.client_address) {
    pdf.text(`Address:`, margin, yPosition)
    yPosition = addText(safeString(quotation.client_address), margin + 18, yPosition, contentWidth - 18, 10) // Adjusted spacing and font size
    yPosition += 6 // Adjusted spacing
  }

  if (quotation.quotation_request_id) {
    pdf.text(`Related Request ID: ${safeString(quotation.quotation_request_id)}`, margin, yPosition)
    yPosition += 6 // Adjusted spacing
  }
  if (quotation.proposalId) {
    pdf.text(`Related Proposal ID: ${safeString(quotation.proposalId)}`, margin, yPosition)
    yPosition += 6 // Adjusted spacing
  }
  if (quotation.campaignId) {
    pdf.text(`Related Campaign ID: ${safeString(quotation.campaignId)}`, margin, yPosition)
    yPosition += 6 // Adjusted spacing
  }
  yPosition += 5

  // Product & Services Section (Manual Table Drawing)
  let productsTableHeight = 0
  productsTableHeight += 5 // Section title spacing
  productsTableHeight += 8 // Line spacing
  productsTableHeight += 8 // Header row height
  productsTableHeight += 25 // Data rows (25mm per row)
  productsTableHeight += 15 // Spacing after table
  checkNewPage(productsTableHeight)

  pdf.setFontSize(14) // Adjusted font size
  pdf.setFont("helvetica", "bold")
  pdf.text("PRODUCT & SERVICES", margin, yPosition)
  yPosition += 5
  pdf.setLineWidth(0.2)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  const cellPadding = 3
  const headerRowHeight = 8
  const dataRowHeight = 25 // Increased for better spacing and images

  // Column widths including image column - Adjusted to match image proportions
  const colWidths = [
    contentWidth * 0.12, // Image
    contentWidth * 0.38, // Product
    contentWidth * 0.12, // Type
    contentWidth * 0.23, // Location
    contentWidth * 0.15, // Price
  ]

  // Table Headers
  pdf.setFillColor(243, 244, 246) // bg-gray-100
  pdf.rect(margin, yPosition, contentWidth, headerRowHeight, "F")
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.1)
  pdf.rect(margin, yPosition, contentWidth, headerRowHeight, "S")

  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0, 0, 0) // Changed to black text for headers

  let currentX = margin
  pdf.text("Image", currentX + cellPadding, yPosition + headerRowHeight / 2, { baseline: "middle" })
  currentX += colWidths[0]
  pdf.text("Product", currentX + cellPadding, yPosition + headerRowHeight / 2, { baseline: "middle" })
  currentX += colWidths[1]
  pdf.text("Type", currentX + cellPadding, yPosition + headerRowHeight / 2, { baseline: "middle" })
  currentX += colWidths[2]
  pdf.text("Location", currentX + cellPadding, yPosition + headerRowHeight / 2, { baseline: "middle" })
  currentX += colWidths[3]
  pdf.text("Price", currentX + colWidths[4] - cellPadding, yPosition + headerRowHeight / 2, {
    baseline: "middle",
    align: "right",
  })
  yPosition += headerRowHeight

  const item = quotation.items
  checkNewPage(dataRowHeight + 5) // Check for space for the next row
  pdf.setFillColor(255, 255, 255) // bg-white
  pdf.rect(margin, yPosition, contentWidth, dataRowHeight, "F")
  pdf.setDrawColor(200, 200, 200)
  pdf.rect(margin, yPosition, contentWidth, dataRowHeight, "S")

  currentX = margin

  // Image column - uniform size for all images
  const imageSize = 16 // Adjusted image size for better visibility
  const imageX = currentX + cellPadding + (colWidths[0] - imageSize) / 2 // Center image in column
  const imageY = yPosition + (dataRowHeight - imageSize) / 2

  // Use media_url if available, otherwise fallback to media[0].url
  const imageUrlToUse = item.media_url || (item.media && item.media.length > 0 ? item.media[0].url : undefined)

  if (imageUrlToUse) {
    try {
      const imageBase64 = await loadImageAsBase64(imageUrlToUse)
      if (imageBase64) {
        pdf.addImage(imageBase64, "JPEG", imageX, imageY, imageSize, imageSize)
      }
    } catch (error) {
      // Add placeholder if image fails to load
      pdf.setFillColor(240, 240, 240)
      pdf.rect(imageX, imageY, imageSize, imageSize, "F")
      pdf.setFontSize(6)
      pdf.setTextColor(150, 150, 150)
      pdf.text("No Image", imageX + imageSize / 2, imageY + imageSize / 2, {
        align: "center",
        baseline: "middle",
      })
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(9)
    }
  } else {
    // Add placeholder for missing image
    pdf.setFillColor(240, 240, 240)
    pdf.rect(imageX, imageY, imageSize, imageSize, "F")
    pdf.setFontSize(6)
    pdf.setTextColor(150, 150, 150)
    pdf.text("No Image", imageX + imageSize / 2, imageY + imageSize / 2, {
      align: "center",
      baseline: "middle",
    })
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
  }
  currentX += colWidths[0]

  // Product column
  let productY = yPosition + cellPadding
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  productY = addText(safeString(item.name), currentX + cellPadding, productY, colWidths[1] - 2 * cellPadding, 9)

  if (item.site_code) {
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100) // Gray for site code
    productY = addText(`Site: ${item.site_code}`, currentX + cellPadding, productY, colWidths[1] - 2 * cellPadding, 8)
    pdf.setTextColor(0, 0, 0)
  }
  if (item.description) {
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(100, 100, 100) // Gray for description
    productY = addText(
      safeString(item.description),
      currentX + cellPadding,
      productY,
      colWidths[1] - 2 * cellPadding,
      8,
    )
    pdf.setTextColor(0, 0, 0)
  }
  currentX += colWidths[1]

  // Type column
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  pdf.text(safeString(item.type), currentX + cellPadding, yPosition + dataRowHeight / 2, {
    baseline: "middle",
  })
  currentX += colWidths[2]

  // Location column
  const locationText = safeString(item.location)
  const locationTextHeight = calculateTextHeight(locationText, colWidths[3] - 2 * cellPadding, 9)
  const locationTextY = yPosition + (dataRowHeight - locationTextHeight) / 2
  addText(locationText, currentX + cellPadding, locationTextY, colWidths[3] - 2 * cellPadding, 9)
  currentX += colWidths[3]

  // Price column
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  pdf.text(
    `PHP${safeString(item.price)}`,
    currentX + colWidths[4] - cellPadding,
    yPosition + dataRowHeight / 2 - 3, // Adjusted for "per month"
    {
      baseline: "middle",
      align: "right",
    },
  )
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100) // Gray for "per month"
  pdf.text(
    `/month`,
    currentX + colWidths[4] - cellPadding,
    yPosition + dataRowHeight / 2 + 3, // Adjusted for "per month"
    {
      baseline: "middle",
      align: "right",
    },
  )
  pdf.setTextColor(0, 0, 0)
  yPosition += dataRowHeight

  // Total Amount Row
  checkNewPage(headerRowHeight)
  pdf.setFillColor(243, 244, 246) // bg-gray-50
  pdf.rect(margin, yPosition, contentWidth, headerRowHeight, "F")
  pdf.setDrawColor(200, 200, 200)
  pdf.rect(margin, yPosition, contentWidth, headerRowHeight, "S")

  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(0, 0, 0) // Black for "Total Amount:" label

  // Position "Total Amount:" to span most columns
  const totalLabelX = margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 5
  pdf.text("Total Amount:", totalLabelX, yPosition + headerRowHeight / 2, {
    baseline: "middle",
    align: "right",
  })

  // Position the actual total amount in the price column
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(37, 99, 235) // Blue color for total amount
  pdf.text(
    `PHP${safeString(quotation.total_amount)}`,
    pageWidth - margin - cellPadding,
    yPosition + headerRowHeight / 2,
    {
      baseline: "middle",
      align: "right",
    },
  )
  yPosition += headerRowHeight + 5 // Reduced spacing after total amount

  // Additional Information (Notes)
  if (quotation.notes) {
    let notesSectionHeight = 5 // Section title spacing
    notesSectionHeight += 8 // Line spacing
    notesSectionHeight += calculateTextHeight(quotation.notes, contentWidth, 10) // Adjusted font size
    notesSectionHeight += 10 // Spacing after notes
    checkNewPage(notesSectionHeight)

    pdf.setFontSize(14) // Adjusted font size
    pdf.setFont("helvetica", "bold")
    pdf.text("ADDITIONAL INFORMATION", margin, yPosition)
    yPosition += 5
    pdf.setLineWidth(0.2)
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    pdf.setFontSize(10) // Adjusted font size
    pdf.setFont("helvetica", "normal")
    yPosition = addText(quotation.notes, margin, yPosition, contentWidth, 10) // Adjusted font size
    yPosition += 10
  }

  // Footer
  pdf.setFontSize(8) // Adjusted font size
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(107, 114, 128) // Gray color
  pdf.text(`This quotation is valid until ${formatDate(validUntilDate)}`, pageWidth / 2, pageHeight - 20, {
    align: "center",
  })
  pdf.text(
    `© ${new Date().getFullYear()} Boohk Outdoor Advertising. All rights reserved.`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" },
  )

  // Download the PDF or return blob
  if (returnBlob) {
    return pdf.output('blob')
  } else {
    pdf.save(`Quotation-${quotation.quotation_number}.pdf`)
  }
}

// Generate PDF and upload to Firebase storage with password protection
export async function generateAndUploadQuotationPDF(
  quotation: Quotation,
  companyData?: any,
  logoDataUrl?: string | null,
  userData?: any,
  userSignatureDataUrl?: string | null
): Promise<{ pdfUrl: string; password: string }> {
  try {
    // Generate password
    const password = generateQuotationPassword()

    // Always fetch fresh company data and logo to ensure consistency
    let logoDataUrlFinal = logoDataUrl
    let finalUserSignatureDataUrl: string | null = userSignatureDataUrl || null
    let finalCompanyData = companyData

    console.log('[QUOTATION_PDF] Company ID from userData or quotation:', userData?.company_id || quotation.company_id)
    console.log('[QUOTATION_PDF] User signature data URL provided:', !!userSignatureDataUrl)

    // Fetch user signature if not provided and available
    if (!finalUserSignatureDataUrl && quotation.created_by) {
      try {
        console.log('[QUOTATION_PDF] Fetching user signature for createdBy:', quotation.created_by)
        const userDocRef = doc(db, "iboard_users", quotation.created_by)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userDataFetched = userDoc.data()
          if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
            const signatureUrl = userDataFetched.signature.url
            console.log('[QUOTATION_PDF] Found user signature URL:', signatureUrl)

            // Convert signature image to base64 data URL like logoDataUrl
            try {
              const response = await fetch(signatureUrl)
              if (response.ok) {
                const blob = await response.blob()
                const arrayBuffer = await blob.arrayBuffer()
                const base64 = Buffer.from(arrayBuffer).toString('base64')
                const mimeType = blob.type || 'image/png'
                finalUserSignatureDataUrl = `data:${mimeType};base64,${base64}`
                console.log('[QUOTATION_PDF] Converted signature to base64 data URL')
              } else {
                console.warn('[QUOTATION_PDF] Failed to fetch signature image:', response.status)
              }
            } catch (fetchError) {
              console.error('[QUOTATION_PDF] Error converting signature to base64:', fetchError)
            }
          }
        }
      } catch (error) {
        console.error('[QUOTATION_PDF] Error fetching user signature:', error)
      }
    }

    // Always try to fetch company data and logo from database
    const companyId = userData?.company_id || quotation.company_id
    if (companyId) {
      console.log('[QUOTATION_PDF] Fetching company data for ID:', companyId)
      try {
        const companyDoc = await getDoc(doc(db, "companies", companyId))
        if (companyDoc.exists()) {
          const companyInfo = companyDoc.data()
          console.log('[QUOTATION_PDF] Company data found:', companyInfo.name)

          // Merge provided companyData with fresh database data
          finalCompanyData = {
            name: finalCompanyData?.name || companyInfo.name || "Company Name",
            address: finalCompanyData?.address || companyInfo.address,
            phone: finalCompanyData?.phone || companyInfo.phone || companyInfo.telephone || companyInfo.contact_number,
            email: finalCompanyData?.email || companyInfo.email,
            website: finalCompanyData?.website || companyInfo.website || companyInfo.company_website,
          }

          // Always fetch logo from database
          if (companyInfo?.logo) {
            console.log('[QUOTATION_PDF] Fetching company logo from:', companyInfo.logo)
            const logoResponse = await fetch(companyInfo.logo)
            if (logoResponse.ok) {
              const logoBlob = await logoResponse.blob()
              const logoArrayBuffer = await logoBlob.arrayBuffer()
              const logoBase64 = Buffer.from(logoArrayBuffer).toString('base64')
              const mimeType = logoBlob.type || 'image/png'
              logoDataUrlFinal = `data:${mimeType};base64,${logoBase64}`
              console.log('[QUOTATION_PDF] Logo fetched and converted to base64, length:', logoBase64.length)
            } else {
              console.warn('[QUOTATION_PDF] Failed to fetch logo, status:', logoResponse.status)
            }
          } else {
            console.log('[QUOTATION_PDF] No logo found in company data')
          }
        } else {
          console.warn('[QUOTATION_PDF] Company document not found for ID:', companyId)
        }
      } catch (error) {
        console.error('[QUOTATION_PDF] Error fetching company data and logo:', error)
        // Continue with provided data if fetch fails
      }
    }

    // Ensure we have company data
    if (!finalCompanyData) {
      console.log('[QUOTATION_PDF] Using default company data')
      finalCompanyData = {
        name: "Company Name",
        address: undefined,
        phone: undefined,
        email: undefined,
        website: undefined,
      }
    }

    console.log('[QUOTATION_PDF] Final company data:', finalCompanyData.name)
    console.log('[QUOTATION_PDF] Logo data URL available:', !!logoDataUrlFinal)

    // Prepare quotation data for API (convert Timestamps to serializable format)
    const serializableQuotation = {
      ...quotation,
      created: quotation.created?.toDate ? quotation.created.toDate().toISOString() : quotation.created,
      updated: quotation.updated?.toDate ? quotation.updated.toDate().toISOString() : quotation.updated,
      valid_until: quotation.valid_until?.toDate ? quotation.valid_until.toDate().toISOString() : quotation.valid_until,
      start_date: quotation.start_date?.toDate ? quotation.start_date.toDate().toISOString() : quotation.start_date,
      end_date: quotation.end_date?.toDate ? quotation.end_date.toDate().toISOString() : quotation.end_date,
    }

    // Call the generate-quotation-pdf API
    const response = await fetch('/api/generate-quotation-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quotation: serializableQuotation,
        companyData: finalCompanyData,
        logoDataUrl: logoDataUrlFinal,
        userData,
        userSignatureDataUrl: finalUserSignatureDataUrl,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`Failed to generate PDF: ${response.status} ${errorText}`)
    }

    const blob = await response.blob()

    // Create a unique filename
    const timestamp = Date.now()
    const filename = `quotation_${quotation.id}_${timestamp}.pdf`

    // Convert blob to File object for upload
    const pdfFile = new File([blob], filename, { type: 'application/pdf' })

    // Upload to Firebase storage
    const uploadPath = `quotations/pdfs/${filename}`
    const pdfUrl = await uploadFileToFirebaseStorage(pdfFile, uploadPath)

    return { pdfUrl, password }
  } catch (error) {
    console.error("Error generating and uploading quotation PDF:", error)
    throw error
  }
}

// Send quotation email to client
export async function sendQuotationEmail(quotation: Quotation, requestorEmail: string): Promise<boolean> {
  try {
    console.log("Sending quotation email:", {
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_number,
      requestorEmail,
    })

    const response = await fetch("/api/quotations/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quotation,
        requestorEmail,
      }),
    })

    console.log("API response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      console.error("API error response:", errorData)
      throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    console.log("Email sent successfully:", result)
    return true
  } catch (error) {
    console.error("Error sending quotation email:", error)
    throw error // Re-throw to show specific error message
  }
}

// Update quotation status
export async function updateQuotationStatus(quotationId: string, status: string): Promise<void> {
  try {
    const response = await fetch("/api/quotations/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quotationId,
        status,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to update quotation status")
    }
  } catch (error) {
    console.error("Error updating quotation status:", error)
    throw error
  }
}

// Get quotations by campaign ID
export async function getQuotationsByCampaignId(campaignId: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("campaignId", "==", campaignId))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      const quotation = { id: doc.id, ...data, items: data.items || {} } as Quotation

      // Check if the item in this quotation matches the product ID
      const hasMatchingProduct = quotation.items.product_id === campaignId

      if (hasMatchingProduct) {
        quotations.push(quotation)
      }
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by campaign ID:", error)
    return []
  }
}

// Get quotations by created_by ID
export async function getQuotationsByCreatedBy(userId: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("created_by", "==", userId), orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      quotations.push({
        id: doc.id,
        ...data,
        created: data.created?.toDate() || new Date(), // Changed createdAt to created
        updated: data.updated?.toDate() || new Date(), // Changed updatedAt to updated
        // Removed startDate, endDate, validUntil conversions as they are handled by start_date, end_date, valid_until
      } as Quotation)
    })

    return quotations.sort((a, b) => b.created.getTime() - a.created.getTime()) // Changed createdAt to created
  } catch (error: any) {
    console.error("Error fetching quotations by created_by ID:", error)
    throw error
  }
}

// Get paginated quotations by seller ID
export async function getQuotationsPaginated(
  userId: string,
  pageSize: number,
  startAfterDoc: QueryDocumentSnapshot<DocumentData> | null,
) {
  const quotationsRef = collection(db, "quotations")
  let q

  if (startAfterDoc) {
    q = query(
      quotationsRef,
      where("seller_id", "==", userId),
      orderBy("created", "desc"),
      startAfter(startAfterDoc),
      limit(pageSize),
    )
  } else {
    q = query(quotationsRef, where("seller_id", "==", userId), orderBy("created", "desc"), limit(pageSize))
  }

  const querySnapshot = await getDocs(q)
  const quotations: any[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    quotations.push({ id: doc.id, ...data, items: data.items || {} }) // Changed products to items
  })

  const lastVisibleId = querySnapshot.docs[querySnapshot.docs.length - 1] || null
  const hasMore = querySnapshot.docs.length === pageSize

  return { quotations, lastVisibleId, hasMore }
}

// Copy an existing quotation with a new quotation number
export async function copyQuotation(originalQuotationId: string, userId: string, userName: string): Promise<string> {
  try {
    console.log("Copying quotation:", originalQuotationId)

    // Get the original quotation
    const originalQuotation = await getQuotationById(originalQuotationId)
    if (!originalQuotation) {
      throw new Error("Original quotation not found")
    }

    // Create a copy with new quotation number and reset fields
    const quotationCopy: Omit<Quotation, "id"> = {
      ...originalQuotation,
      quotation_number: generateQuotationNumber(),
      status: "draft", // Reset status to draft
      created_by: userName || "",
      seller_id: userId,
      // Reset project compliance to initial state
      projectCompliance: {
        signedQuotation: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        signedContract: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        irrevocablePo: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        finalArtwork: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        paymentAsDeposit: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
      },
      // Remove timestamps - they will be set by createQuotation
      created: undefined as any,
      updated: undefined as any,
    }

    // Remove the id field since it's auto-generated
    delete (quotationCopy as any).id

    // Create the new quotation
    const newQuotationId = await createQuotation(quotationCopy)
    console.log("Quotation copied successfully with ID:", newQuotationId)

    return newQuotationId
  } catch (error: any) {
    console.error("Error copying quotation:", error)
    throw new Error("Failed to copy quotation: " + error.message)
  }
}

export async function createDirectQuotation(
  clientData: any,
  sitesData: any[],
  userId: string,
  options: {
    startDate?: Date
    endDate?: Date
    company_id: string
    page_id?: string
    created_by_first_name?: string
    created_by_last_name?: string
    spotNumbers?: number[] // Added spot numbers array parameter
    client_company_id?: string // Added client_company_id field
  },
): Promise<string> {
  try {
    if (sitesData.length === 0) {
      throw new Error("No sites provided for quotation creation")
    }

    const site = sitesData[0] // Use the first (and should be only) site
    const quotationNumber = generateQuotationNumber()

    // Calculate duration and total if dates are provided
    let durationDays = 30 // Default duration
    let totalAmount = site.price || 0

    if (options.startDate && options.endDate) {
      const start = new Date(options.startDate)
      const end = new Date(options.endDate)
      durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      totalAmount = calculateProratedPrice(site.price || 0, start, end)
    }

    const pageId = options.page_id || `PAGE-${Date.now()}`

    const quotationData: Omit<Quotation, "id"> = {
      quotation_number: quotationNumber,

      client_name: clientData.name || "",
      client_email: clientData.email || "",
      client_id: clientData.id || "",
      client_company_name: clientData.company || "",
      client_phone: clientData.phone || "",
      client_address: clientData.address || "",
      client_designation: clientData.designation || "",
      client_company_id: options.client_company_id || "",
      status: "draft",
      created: serverTimestamp(),
      created_by: userId,
      seller_id: userId,
      company_id: options.company_id,
      created_by_first_name: options.created_by_first_name || "",
      created_by_last_name: options.created_by_last_name || "",
      start_date: options.startDate ? Timestamp.fromDate(options.startDate) : null,
      end_date: options.endDate ? Timestamp.fromDate(options.endDate) : null,
      duration_days: durationDays,
      total_amount: totalAmount,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      items: {
        product_id: site.id || "", // This serves as the product_id
        name: site.name || "",
        location: site.location || "",
        price: site.price || 0,
        type: site.content_type ? site.content_type.charAt(0).toUpperCase() + site.content_type.slice(1) : "",
        duration_days: durationDays,
        item_total_amount: totalAmount,
        media_url: site.image || "",
        height: site.height || 0,
        width: site.width || 0,
        content_type: site.content_type || "",
        ...(site.cms && { cms: site.cms }),
        ...(site.specs_rental && { specs: site.specs_rental }),
        ...(site.spot_number && { spot_number: site.spot_number }),
      },
      spot_numbers: options.spotNumbers || [],
      projectCompliance: {
        signedQuotation: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        signedContract: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        irrevocablePo: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        finalArtwork: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        paymentAsDeposit: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
      },
    }

    return await createQuotation(quotationData)
  } catch (error: any) {
    console.error("Error creating direct quotation:", error)
    throw new Error("Failed to create quotation: " + error.message)
  }
}

export async function createMultipleQuotations(
  clientData: any,
  sitesData: any[],
  userId: string,
  options: {
    startDate?: Date
    endDate?: Date
    company_id: string
    page_id?: string
    created_by_first_name?: string
    created_by_last_name?: string
    client_company_id?: string // Added client_company_id field
  },
): Promise<string[]> {
  try {
    if (sitesData.length === 0) {
      throw new Error("No sites provided for quotation creation")
    }

    const quotationIds: string[] = []
    const baseQuotationNumber = generateQuotationNumber()
    const pageId = options.page_id || `PAGE-${Date.now()}`

    // Calculate duration if dates are provided
    let durationDays = 30 // Default duration
    let start: Date | undefined
    let end: Date | undefined
    if (options.startDate && options.endDate) {
      start = new Date(options.startDate)
      end = new Date(options.endDate)
      durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }

    // Create a separate quotation for each site
    for (let i = 0; i < sitesData.length; i++) {
      const site = sitesData[i]
      const quotationNumber = `${baseQuotationNumber}-${String.fromCharCode(65 + i)}` // Appends -A, -B, -C, etc.
      const totalAmount = start && end ? calculateProratedPrice(site.price || 0, start, end) : site.price || 0

      const quotationData: Omit<Quotation, "id"> = {
        quotation_number: quotationNumber,
        client_name: clientData.name || "",
        client_email: clientData.email || "",
        client_id: clientData.id || "",
        client_company_name: clientData.company || "",
        client_phone: clientData.phone || "",
        client_address: clientData.address || "",
        client_designation: clientData.designation || "",
        client_company_id: clientData.company_id || "",
        status: "draft",
        created: serverTimestamp(),
        created_by: userId,
        seller_id: userId,
        company_id: options.company_id,
        page_id: pageId, // Set the same page_id for all quotations in this group
        page_number: i + 1, // Set sequential page numbers (1, 2, 3, etc.)
        created_by_first_name: options.created_by_first_name || "",
        created_by_last_name: options.created_by_last_name || "",
        start_date: options.startDate ? Timestamp.fromDate(options.startDate) : null,
        end_date: options.endDate ? Timestamp.fromDate(options.endDate) : null,
        duration_days: durationDays,
        total_amount: totalAmount,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        items: {
          product_id: site.id || "", // This serves as the product_id
          name: site.name || "",
          location: site.location || "",
          price: site.price || 0,
          type: site.content_type ? site.content_type.charAt(0).toUpperCase() + site.content_type.slice(1) : "",
          duration_days: durationDays,
          item_total_amount: totalAmount,
          media_url: site.image || "",
          height: site.height || 0,
          width: site.width || 0,
          content_type: site.content_type || "",
          ...(site.specs_rental && { specs: site.specs_rental }),
          ...(site.cms && { cms: site.cms }),
          ...(site.spot_number && { spot_number: site.spot_number }),
        },
        projectCompliance: {
          signedQuotation: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
          signedContract: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
          irrevocablePo: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
          finalArtwork: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
          paymentAsDeposit: { completed: false, fileUrl: null, fileName: null, uploadedAt: null, notes: null },
        },
      }

      const quotationId = await createQuotation(quotationData)
      quotationIds.push(quotationId)
    }

    return quotationIds
  } catch (error: any) {
    console.error("Error creating multiple quotations:", error)
    throw new Error("Failed to create quotations: " + error.message)
  }
}

// Get quotations by product ID (for history sidebar)
export async function getQuotationsByProductId(productId: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      const quotation = { id: doc.id, ...data, items: data.items || {} } as Quotation

      // Check if any item in this quotation matches the product ID
      const hasMatchingProduct = quotation.items.product_id === productId

      if (hasMatchingProduct) {
        quotations.push(quotation)
      }
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by product ID:", error)
    return []
  }
}

// Get quotations by client ID
export async function getQuotationsByClientId(clientId: string): Promise<Quotation[]> {
  try {
    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("client.id", "==", clientId))
    const querySnapshot = await getDocs(q)

    const quotations: Quotation[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      quotations.push({
        id: doc.id,
        ...data,
        created: data.created?.toDate() || new Date(), // Use 'created' instead of 'createdAt'
        updated: data.updated?.toDate() || new Date(), // Use 'updated' instead of 'updatedAt'
        start_date: data.start_date || "", // Ensure start_date is a string
        end_date: data.end_date || "", // Ensure end_date is a string
        total_amount: data.total_amount || 0, // Ensure total_amount is a number
        duration_days: data.duration_days || 0, // Ensure duration_days is a number
        quotation_number: data.quotation_number || "", // Ensure quotation_number is a string
        status: data.status || "draft", // Ensure status is a valid type
        valid_until: data.valid_until?.toDate(),
        items: data.items || {}, // Ensure items is an object
      } as Quotation)
    })

    return quotations.sort((a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0))
  } catch (error) {
    console.error("Error fetching quotations by client ID:", error)
    throw error
  }
}

// Get quotations by client name
export async function getQuotationsByClientName(clientName: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("client_name", "==", clientName), orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      quotations.push({ id: doc.id, ...data, items: data.items || {} } as Quotation)
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by client name:", error)
    return []
  }
}

// Get quotations by page ID
export async function getQuotationsByPageId(pageId: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("page_id", "==", pageId), orderBy("page_number", "asc"))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      quotations.push({ id: doc.id, ...data, items: data.items || {} } as Quotation)
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by page ID:", error)
    return []
  }
}

export async function getQuotationsByProductIdAndCompanyId(productId: string, companyId: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      const quotation = { id: doc.id, ...data, items: data.items || {} } as Quotation

      const hasMatchingProduct = quotation.items.product_id === productId
      const hasMatchingCompany = quotation.company_id === companyId

      if (hasMatchingProduct && hasMatchingCompany) {
        quotations.push(quotation)
      }
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by product ID and company ID:", error)
    return []
  }
}

// Fetch all quotations
export async function getAllQuotations(): Promise<Quotation[]> {
  try {
    const q = query(collection(db, "quotations"), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Quotation[]
    return quotations
  } catch (error) {
    console.error("Error fetching all quotations:", error)
    throw error
  }
}

export async function getQuotationsByClientCompanyId(clientCompanyId: string): Promise<Quotation[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("client_company_id", "==", clientCompanyId), orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      quotations.push({
        id: doc.id,
        ...data,
        created: data.created?.toDate() || new Date(), // Use 'created' instead of 'createdAt'
        updated: data.updated?.toDate() || new Date(), // Use 'updated' instead of 'updatedAt'
        start_date: data.start_date || "", // Ensure start_date is a string
        end_date: data.end_date || "", // Ensure end_date is a string
        total_amount: data.total_amount || 0, // Ensure total_amount is a number
        duration_days: data.duration_days || 0, // Ensure duration_days is a number
        quotation_number: data.quotation_number || "", // Ensure quotation_number is a string
        status: data.status || "draft", // Ensure status is a valid type
        valid_until: data.valid_until?.toDate(),
        items: data.items || {}, // Ensure items is an object
      } as Quotation)
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by client company ID:", error)
    throw error
  }
}

export { getQuotationById as getQuotation }
