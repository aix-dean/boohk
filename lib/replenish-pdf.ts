import jsPDF from "jspdf"
import QRCode from "qrcode"
import type { FinanceRequest } from "@/lib/types/finance-request"

type ReplenishRequest = FinanceRequest & {
  Particulars?: string
  ["Total Amount"]?: number
  ["Voucher No."]?: string
  ["Management Approval"]?: string
  ["Date Requested"]?: any
}

function toSafeDate(value: any): Date {
  try {
    if (!value) return new Date(Number.NaN)
    if (value instanceof Date) return value
    if (typeof value?.toDate === "function") return value.toDate()
    return new Date(value)
  } catch {
    return new Date(Number.NaN)
  }
}

function fmtDateTime(value: any): string {
  const d = toSafeDate(value)
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleString()
}

function fmtDate(value: any): string {
  const d = toSafeDate(value)
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString()
}

function fmtCurrency(amount: number | undefined, currency = "PHP"): string {
  const n = typeof amount === "number" ? amount : 0
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function generateQrDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 192 })
  } catch {
    return null
  }
}

/**
 * Generates a user-friendly PDF for a replenish request based only on the request fields.
 * No attachment files are used or embedded.
 *
 * If options.returnBase64 is true: returns the base64 payload (no data: prefix).
 * Otherwise, triggers a file download in the browser.
 */
export async function generateReplenishRequestPDF(
  request: ReplenishRequest,
  options?: { returnBase64?: boolean; preparedBy?: string },
): Promise<string | void> {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2

  // Header
  pdf.setFillColor(30, 58, 138) // blue-900
  pdf.rect(0, 0, pageWidth, 26, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(18)
  pdf.text("REPLENISHMENT REQUEST", margin, 16)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 22)

  // Optional QR link back to this request
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").toString().replace(/\/$/, "")
  const link = request.id ? `${appUrl}/finance/requests/details/${request.id}` : appUrl || ""
  const qr = link ? await generateQrDataUrl(link) : null
  if (qr) {
    const size = 18
    pdf.addImage(qr, "PNG", pageWidth - margin - size, margin, size, size)
  }

  // Title + status
  let y = 34
  const status = (request.Actions || "Pending").toUpperCase()
  pdf.setTextColor(0, 0, 0)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.text(`Request #${String(request["Request No."] ?? request.id)}`, margin, y)

  // Status pill
  const badgeW = Math.max(28, pdf.getTextWidth(status) + 10)
  const bx = pageWidth - margin - badgeW
  const by = y - 6
  const statusColor =
    (request.Actions || "").toLowerCase() === "approved"
      ? [34, 197, 94]
      : (request.Actions || "").toLowerCase() === "rejected"
        ? [239, 68, 68]
        : (request.Actions || "").toLowerCase() === "processing"
          ? [59, 130, 246]
          : [156, 163, 175]
  pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  pdf.roundedRect(bx, by, badgeW, 10, 2, 2, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(10)
  pdf.text(status, bx + 5, by + 7)
  pdf.setTextColor(0, 0, 0)

  y += 10

  // Summary
  const leftX = margin
  const rightX = margin + contentWidth / 2 + 4
  const rowGap = 6

  const labelValue = (label: string, value: string, x: number, yy: number) => {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text(label, x, yy)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.text(value || "N/A", x + 32, yy)
  }

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text("Summary", margin, y)
  y += 5
  pdf.setDrawColor(220, 220, 220)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 6

  let lY = y
  let rY = y
  labelValue("Requestor:", String(request.Requestor || "-"), leftX, lY)
  lY += rowGap
  labelValue("Prepared By:", String(options?.preparedBy || request.Requestor || "-"), leftX, lY)
  lY += rowGap
  labelValue("Created:", fmtDateTime(request.created), leftX, lY)
  lY += rowGap

  labelValue("Type:", "Replenish", rightX, rY)
  rY += rowGap
  labelValue("Date Requested:", fmtDate((request as any)["Date Requested"]), rightX, rY)
  rY += rowGap
  labelValue("Voucher No.:", String((request as any)["Voucher No."] || "-"), rightX, rY)
  rY += rowGap

  y = Math.max(lY, rY) + 8

  // Financial Summary (cards)
  const cardH = 22
  const gap = 6
  const cardW = (contentWidth - gap) / 2
  const drawCard = (x: number, title: string, value: string) => {
    pdf.setFillColor(248, 250, 252) // slate-50
    pdf.roundedRect(x, y, cardW, cardH, 2, 2, "F")
    pdf.setDrawColor(226, 232, 240)
    pdf.roundedRect(x, y, cardW, cardH, 2, 2, "S")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.setTextColor(71, 85, 105) // slate-600
    pdf.text(title, x + 4, y + 7)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(12)
    pdf.setTextColor(15, 23, 42) // slate-900
    pdf.text(value, x + 4, y + 15)
    pdf.setTextColor(0, 0, 0)
  }
  drawCard(margin, "Amount", fmtCurrency(Number((request as any).Amount) || 0, (request as any).Currency || "PHP"))
  drawCard(
    margin + cardW + gap,
    "Total Amount",
    fmtCurrency(Number((request as any)["Total Amount"]) || 0, (request as any).Currency || "PHP"),
  )
  y += cardH + 10

  // Approval
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text("Approval", margin, y)
  y += 5
  pdf.setDrawColor(220, 220, 220)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 6

  labelValue("Management Approval:", String((request as any)["Management Approval"] || "Pending"), margin, y)
  labelValue("Approved By:", String((request as any)["Approved By"] || "-"), rightX, y)
  y += rowGap + 6

  // Particulars
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text("Particulars", margin, y)
  y += 5
  pdf.setDrawColor(226, 232, 240)
  const blockHeight = 30
  pdf.roundedRect(margin, y, contentWidth, blockHeight, 2, 2, "S")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  const particulars = String((request as any).Particulars || (request as any)["Requested Item"] || "-")
  const lines = pdf.splitTextToSize(particulars, contentWidth - 8)
  pdf.text(lines, margin + 4, y + 7)
  y += blockHeight + 8

  // Note
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text("This report reflects the currently saved details of the replenishment request.", margin, y)
  pdf.setTextColor(0, 0, 0)

  // Footer
  const fy = pageHeight - 12
  pdf.setDrawColor(229, 231, 235)
  pdf.line(margin, fy, pageWidth - margin, fy)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.setTextColor(100, 116, 139)
  pdf.text("Generated by OH Plus Platform", margin, fy + 5)
  pdf.setTextColor(0, 0, 0)

  if (options?.returnBase64) {
    return pdf.output("datauristring").split(",")[1] || ""
  } else {
    const fileName = `replenish-request-${String((request as any)["Request No."] ?? request.id)}.pdf`
    pdf.save(fileName)
  }
}
