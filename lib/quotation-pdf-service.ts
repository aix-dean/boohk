import jsPDF from "jspdf"
import type { Quotation } from "./types/quotation"

const safeString = (value: any): string => {
  if (value === null || value === undefined) return "N/A"
  if (typeof value === "string") return value
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "boolean") return value.toString()
  if (value && typeof value === "object") {
    if (value.id) return value.id.toString()
    if (value.toString) return value.toString()
    return "N/A"
  }
  return String(value)
}

const formatDate = (date: any) => {
  if (!date) return "N/A"
  try {
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return "N/A"
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj)
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Invalid Date"
  }
}

const formatDuration = (days: number): string => {
  if (days <= 0) return "0 days"

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
  if (!companyData) return ""
  const parts = []
  if (companyData.address?.street) parts.push(companyData.address.street)
  if (companyData.address?.city) parts.push(companyData.address.city)
  if (companyData.address?.province) parts.push(companyData.address.province)
  if (companyData.zip) parts.push(companyData.zip)
  return parts.join(", ")
}

export const generateQuotationPDF = async (quotation: Quotation, companyData?: any) => {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  let yPosition = margin

  // Load company logo if available
  let logoDataUrl: string | null = null
  if (companyData?.logo) {
    try {
      const response = await fetch(companyData.logo)
      const blob = await response.blob()
      logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error loading company logo:', error)
    }
  }

  // Add header with logo or company name
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 15, yPosition - 10, 30, 15)
    yPosition += 12
  } else {
    pdf.setFontSize(20)
    pdf.setFont("helvetica", "bold")
    pdf.text(companyData?.name || "AI Xynergy", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 12
  }

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(formatDate(new Date()), margin, yPosition)
  pdf.text(`RFQ. No. ${quotation.quotation_number}`, pageWidth - margin, yPosition, { align: "right" })
  yPosition += 8

  pdf.text(quotation.client_name || "Client Name", margin, yPosition)
  yPosition += 5
  pdf.text(quotation.client_company_name || "COMPANY NAME", margin, yPosition)
  yPosition += 10

  const item = quotation.items
  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.text(`${item?.name || "Site Name"} - Quotation`, pageWidth / 2, yPosition, { align: "center" })
  yPosition += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(
    `Good Day! Thank you for considering ${companyData?.name || "AI Xynergy"} for your business needs.`,
    pageWidth / 2,
    yPosition,
    { align: "center" },
  )
  yPosition += 4
  pdf.text("We are pleased to submit our quotation for your requirements:", pageWidth / 2, yPosition, {
    align: "center",
  })
  yPosition += 8

  pdf.setFont("helvetica", "bold")
  pdf.text("Details as follows:", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 8

  if (item) {
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")

    const details = [
      `• Type: ${safeString(item.type) || "Rental"}`,
      `• Size: ${quotation.size || "100ft (H) x 60ft (W)"}`,
      `• Contract Duration: ${formatDuration(quotation.duration_days || 0)}`,
      `• Contract Period: ${formatDate(quotation.start_date)} - ${formatDate(quotation.end_date)}`,
      `• Proposal to: ${quotation.client_company_name || "CLIENT COMPANY NAME"}`,
      `• Illumination: 10 units of 1000 watts metal Halide`,
      `• Lease Rate/Month: PHP ${(item.price || 0).toLocaleString()} (Exclusive of VAT)`,
    ]

    details.forEach((detail) => {
      pdf.text(detail, margin, yPosition)
      yPosition += 5
    })

    yPosition += 8

    yPosition += 6
    pdf.setFont("helvetica", "normal")
    pdf.text("Lease rate per month", margin + 5, yPosition)
    pdf.text(`PHP ${(item.price || 0).toLocaleString()}`, pageWidth - margin - 5, yPosition, { align: "right" })
    yPosition += 5

    pdf.text(`x ${formatDuration(quotation.duration_days || 0)}`, margin + 5, yPosition)
    pdf.text(`PHP ${(item.item_total_amount || 0).toLocaleString()}`, pageWidth - margin - 5, yPosition, {
      align: "right",
    })
    yPosition += 5

    pdf.text("12% VAT", margin + 5, yPosition)
    pdf.text(`PHP ${((item.item_total_amount || 0) * 0.12).toLocaleString()}`, pageWidth - margin - 5, yPosition, {
      align: "right",
    })
    yPosition += 6

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.text("TOTAL", margin + 5, yPosition)
    pdf.text(`PHP ${((item.item_total_amount || 0) * 1.12).toLocaleString()}`, pageWidth - margin - 5, yPosition, {
      align: "right",
    })
    yPosition += 10

    const durationMonths = Math.ceil((quotation.duration_days || 0) / 30)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.text(`Note: free two (2) change material for ${durationMonths} month rental`, margin, yPosition)
    yPosition += 8

    pdf.setFont("helvetica", "bold")
    pdf.text("Terms and Conditions:", margin, yPosition)
    yPosition += 5

    pdf.setFont("helvetica", "normal")
    const terms = [
      "1. Quotation validity: 5 working days.",
      "2. Availability of the site is on first-come-first-served-basis only. Only official documents such as P.O's,",
      "    Media Orders, signed quotation, & contracts are accepted in order to booked the site.",
      "3. To book the site, one (1) month advance and one (2) months security deposit",
      "    payment dated 7 days before the start of rental is required.",
      "4. Final artwork should be approved ten (10) days before the contract period",
      `5. Print is exclusively for ${companyData?.name || "AI Xynergy"} Only.`,
    ]

    terms.forEach((term) => {
      pdf.text(term, margin, yPosition)
      yPosition += 4
    })

    yPosition += 10

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")

    const leftColX = margin
    const rightColX = pageWidth / 2 + 10

    pdf.text("Very truly yours,", leftColX, yPosition)
    pdf.text("Conforme:", rightColX, yPosition)
    yPosition += 12

    pdf.line(leftColX, yPosition, leftColX + 60, yPosition)
    pdf.line(rightColX, yPosition, rightColX + 60, yPosition)
    yPosition += 5

    pdf.text(quotation.signature_name || "AIX Xymbiosis", leftColX, yPosition)
    pdf.text(quotation.client_name || "Client Name", rightColX, yPosition)
    yPosition += 4

    pdf.text(quotation.signature_position || "Account Manager", leftColX, yPosition)
    pdf.text(quotation.client_company_name || "COMPANY NAME", rightColX, yPosition)
    yPosition += 6

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "italic")
    pdf.text("This signed quotation serves as an", rightColX, yPosition)
    yPosition += 3
    pdf.text("official document for billing purposes", rightColX, yPosition)
    yPosition += 8

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    const companyAddress = formatCompanyAddress(companyData)
    if (companyAddress) {
      pdf.text(companyAddress, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 3
    }
    if (companyData?.phone) {
      pdf.text(`Telephone: ${companyData.phone}`, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 3
    }
    if (companyData?.email) {
      pdf.text(`Email: ${companyData.email}`, pageWidth / 2, yPosition, { align: "center" })
    }
  }

  const fileName = `Quotation_${quotation.quotation_number || quotation.id?.slice(-8)}.pdf`
  pdf.save(fileName)
}

/**
 * Generate separate PDF files for multiple quotations with the same page_id
 * Similar to cost estimate's generateSeparateCostEstimatePDFs function
 */
export const generateSeparateQuotationPDFsByPageId = async (
  quotations: Quotation[],
  selectedQuotations?: string[],
  companyData?: any,
): Promise<void> => {
  try {
    console.log(
      "[v0] Generating separate PDFs for quotations:",
      quotations.map((q) => q.id),
    )

    // Filter quotations if specific ones are selected
    const quotationsToProcess =
      selectedQuotations && selectedQuotations.length > 0
        ? quotations.filter((q) => selectedQuotations.includes(q.id || ""))
        : quotations

    if (quotationsToProcess.length === 0) {
      throw new Error("No quotations selected for PDF generation")
    }

    // Generate separate PDF for each quotation with unique numbering
    for (let i = 0; i < quotationsToProcess.length; i++) {
      const quotation = quotationsToProcess[i]

      // Create unique quotation number with suffix if multiple quotations
      const baseQuotationNumber = quotation.quotation_number || quotation.id?.slice(-8) || "QT-000"
      const uniqueQuotationNumber =
        quotations.length > 1
          ? `${baseQuotationNumber}-${String.fromCharCode(65 + i)}` // Appends -A, -B, -C, etc.
          : baseQuotationNumber

      // Create modified quotation with unique number
      const modifiedQuotation: Quotation = {
        ...quotation,
        quotation_number: uniqueQuotationNumber,
      }

      // Generate PDF for this quotation
      await generateQuotationPDF(modifiedQuotation, companyData)

      // Add small delay between downloads to ensure proper file naming
      if (i < quotationsToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log("[v0] Successfully generated", quotationsToProcess.length, "separate quotation PDFs")
  } catch (error) {
    console.error("Error generating separate quotation PDFs:", error)
    throw error
  }
}

/**
 * Generate quotation PDFs with multi-page support
 * Handles both single quotations and multiple quotations with the same page_id
 */
export const generateQuotationPDFsWithMultiPageSupport = async (
  quotations: Quotation | Quotation[],
  selectedQuotations?: string[],
  companyData?: any,
  returnBase64 = false,
): Promise<string | void> => {
  try {
    // Handle single quotation
    if (!Array.isArray(quotations)) {
      if (returnBase64) {
        return await generateQuotationEmailPDF(quotations, true, undefined, companyData)
      } else {
        return await generateQuotationPDF(quotations, companyData)
      }
    }

    // Handle multiple quotations
    if (quotations.length === 1) {
      const quotation = quotations[0]
      if (returnBase64) {
        return await generateQuotationEmailPDF(quotation, true, undefined, companyData)
      } else {
        return await generateQuotationPDF(quotation, companyData)
      }
    }

    // Generate separate PDFs for multiple quotations
    if (returnBase64) {
      // For email, generate PDF for the first quotation only
      const firstQuotation = quotations[0]
      return await generateQuotationEmailPDF(firstQuotation, true, undefined, companyData)
    } else {
      // Generate separate PDFs for each quotation
      await generateSeparateQuotationPDFsByPageId(quotations, selectedQuotations, companyData)
    }
  } catch (error) {
    console.error("Error generating quotation PDFs with multi-page support:", error)
    throw error
  }
}

export const generateSeparateQuotationPDFs = async (quotation: Quotation, companyData?: any) => {
  // Single item quotation, generate normal PDF
  return generateQuotationPDF(quotation, companyData)
}

export const generateQuotationEmailPDF = async (
  quotation: Quotation,
  forEmail = false,
  userData?: any,
  companyData?: any,
): Promise<string> => {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  let yPosition = margin

  pdf.setFontSize(20)
  pdf.setFont("helvetica", "bold")
  pdf.text(companyData?.name || "AI Xynergy", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 12

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(formatDate(new Date()), margin, yPosition)
  pdf.text(`RFQ. No. ${quotation.quotation_number}`, pageWidth - margin, yPosition, { align: "right" })
  yPosition += 8

  pdf.text(quotation.client_name || "Client Name", margin, yPosition)
  yPosition += 5
  pdf.text(quotation.client_company_name || "COMPANY NAME", margin, yPosition)
  yPosition += 10

  const item = quotation.items
  pdf.setFontSize(14)
  pdf.setFont("helvetica", "bold")
  pdf.text(`${item?.name || "Site Name"} - Quotation`, pageWidth / 2, yPosition, { align: "center" })
  yPosition += 10

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.text(
    `Good Day! Thank you for considering ${companyData?.name || "AI Xynergy"} for your business needs.`,
    pageWidth / 2,
    yPosition,
    { align: "center" },
  )
  yPosition += 4
  pdf.text("We are pleased to submit our quotation for your requirements:", pageWidth / 2, yPosition, {
    align: "center",
  })
  yPosition += 8

  pdf.setFont("helvetica", "bold")
  pdf.text("Details as follows:", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 8

  if (item) {
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")

    const details = [
      `• Type: ${safeString(item.type) || "Rental"}`,
      `• Size: ${quotation.size || "100ft (H) x 60ft (W)"}`,
      `• Contract Duration: ${formatDuration(quotation.duration_days || 0)}`,
      `• Contract Period: ${formatDate(quotation.start_date)} - ${formatDate(quotation.end_date)}`,
      `• Proposal to: ${quotation.client_company_name || "CLIENT COMPANY NAME"}`,
      `• Illumination: 10 units of 1000 watts metal Halide`,
      `• Lease Rate/Month: PHP ${(item.price || 0).toLocaleString()} (Exclusive of VAT)`,
    ]

    details.forEach((detail) => {
      pdf.text(detail, margin, yPosition)
      yPosition += 5
    })

    yPosition += 8

    yPosition += 6
    pdf.setFont("helvetica", "normal")
    pdf.text("Lease rate per month", margin + 5, yPosition)
    pdf.text(`PHP ${(item.price || 0).toLocaleString()}`, pageWidth - margin - 5, yPosition, { align: "right" })
    yPosition += 5

    pdf.text(`x ${formatDuration(quotation.duration_days || 0)}`, margin + 5, yPosition)
    pdf.text(`PHP ${(item.item_total_amount || 0).toLocaleString()}`, pageWidth - margin - 5, yPosition, {
      align: "right",
    })
    yPosition += 5

    pdf.text("12% VAT", margin + 5, yPosition)
    pdf.text(`PHP ${((item.item_total_amount || 0) * 0.12).toLocaleString()}`, pageWidth - margin - 5, yPosition, {
      align: "right",
    })
    yPosition += 6

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.text("TOTAL", margin + 5, yPosition)
    pdf.text(`PHP ${((item.item_total_amount || 0) * 1.12).toLocaleString()}`, pageWidth - margin - 5, yPosition, {
      align: "right",
    })
    yPosition += 10

    const durationMonths = Math.ceil((quotation.duration_days || 0) / 30)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.text(`Note: free two (2) change material for ${durationMonths} month rental`, margin, yPosition)
    yPosition += 8

    pdf.setFont("helvetica", "bold")
    pdf.text("Terms and Conditions:", margin, yPosition)
    yPosition += 5

    pdf.setFont("helvetica", "normal")
    const terms = [
      "1. Quotation validity: 5 working days.",
      "2. Availability of the site is on first-come-first-served-basis only. Only official documents such as P.O's,",
      "    Media Orders, signed quotation, & contracts are accepted in order to booked the site.",
      "3. To book the site, one (1) month advance and one (2) months security deposit",
      "    payment dated 7 days before the start of rental is required.",
      "4. Final artwork should be approved ten (10) days before the contract period",
      `5. Print is exclusively for ${companyData?.name || "AI Xynergy"} Only.`,
    ]

    terms.forEach((term) => {
      pdf.text(term, margin, yPosition)
      yPosition += 4
    })

    yPosition += 10

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")

    const leftColX = margin
    const rightColX = pageWidth / 2 + 10

    pdf.text("Very truly yours,", leftColX, yPosition)
    pdf.text("Conforme:", rightColX, yPosition)
    yPosition += 12

    pdf.line(leftColX, yPosition, leftColX + 60, yPosition)
    pdf.line(rightColX, yPosition, rightColX + 60, yPosition)
    yPosition += 5

    pdf.text(quotation.signature_name || "AIX Xymbiosis", leftColX, yPosition)
    pdf.text(quotation.client_name || "Client Name", rightColX, yPosition)
    yPosition += 4

    pdf.text(quotation.signature_position || "Account Manager", leftColX, yPosition)
    pdf.text(quotation.client_company_name || "COMPANY NAME", rightColX, yPosition)
    yPosition += 6

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "italic")
    pdf.text("This signed quotation serves as an", rightColX, yPosition)
    yPosition += 3
    pdf.text("official document for billing purposes", rightColX, yPosition)
    yPosition += 8

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    const companyAddress = formatCompanyAddress(companyData)
    if (companyAddress) {
      pdf.text(companyAddress, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 3
    }
    if (companyData?.phone) {
      pdf.text(`Telephone: ${companyData.phone}`, pageWidth / 2, yPosition, { align: "center" })
      yPosition += 3
    }
    if (companyData?.email) {
      pdf.text(`Email: ${companyData.email}`, pageWidth / 2, yPosition, { align: "center" })
    }
  }

  if (forEmail) {
    return pdf.output("datauristring").split(",")[1]
  }

  const fileName = `Quotation_${quotation.quotation_number || quotation.id?.slice(-8)}.pdf`
  pdf.save(fileName)
  return fileName
}
