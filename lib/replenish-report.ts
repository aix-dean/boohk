import type { FinanceRequest } from "@/lib/types/finance-request"
import { generateReplenishRequestPDF } from "@/lib/replenish-pdf"

type SendOptions = {
  to: string[] // required, at least 1
  cc?: string[]
  subject: string
  body: string
}

// Convert base64 (no data: prefix) to a PDF Blob
function base64ToPdfBlob(base64: string): Blob {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: "application/pdf" })
}

/**
 - Always generates a fresh PDF from the request’s fields only (no attachment files).
 - Opens in a new tab so the user can use the browser print dialog.
*/
export async function printReplenishReport(request: FinanceRequest) {
  const base64 = await generateReplenishRequestPDF(request as any, { returnBase64: true })
  if (!base64 || typeof base64 !== "string") throw new Error("Failed to generate PDF")
  const blob = base64ToPdfBlob(base64)
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 - Always generates a fresh PDF from the request’s fields only (no attachment files).
 - Sends via your existing /api/send-email route as an attachment.
*/
export async function sendReplenishReport(request: FinanceRequest, opts: SendOptions) {
  if (!opts.to?.length) throw new Error("Recipient required")

  const base64 = await generateReplenishRequestPDF(request as any, { returnBase64: true })
  if (!base64 || typeof base64 !== "string") throw new Error("Failed to generate PDF")

  const blob = base64ToPdfBlob(base64)
  const file = new File([blob], `replenish-request-${String(request["Request No."] ?? request.id)}.pdf`, {
    type: "application/pdf",
  })

  const form = new FormData()
  form.append("to", JSON.stringify(opts.to))
  if (opts.cc?.length) form.append("cc", JSON.stringify(opts.cc))
  form.append("subject", opts.subject)
  form.append("body", opts.body)
  form.append("attachment_0", file)

  const res = await fetch("/api/send-email", { method: "POST", body: form })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || "Failed to send email")
  }
}
