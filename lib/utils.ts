import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeAgo(date: Date | any): string {
  if (!date) return "Unknown"

  const now = new Date()
  const timestamp = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date))
  const diffInMs = now.getTime() - timestamp.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`

  return timestamp.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: timestamp.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

export function formatDateShort(date: Date | any): string {
  if (!date) return "Unknown"

  const timestamp = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date))
  const day = timestamp.getDate()
  const month = timestamp.toLocaleDateString('en-US', { month: 'short' })
  return `${day}, ${month}`
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function generateLicenseKey(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let licenseKey = ""
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      licenseKey += "-"
    }
    licenseKey += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return licenseKey
}

export function getProjectCompliance(quotation: any) {
  console.log("[DEBUG] getProjectCompliance called with quotation:", quotation);
  console.log("[DEBUG] quotation?.projectCompliance:", quotation?.projectCompliance);
  const compliance = quotation?.projectCompliance || {}
  console.log("[DEBUG] compliance object:", compliance);

  const toReserveItems = [
    {
      key: "signedContract",
      name: "Signed Contract",
      status: compliance.signedContract?.fileUrl ? "completed" : "upload",
      file: compliance.signedContract?.fileName,
      fileUrl: compliance.signedContract?.fileUrl,
    },
    {
      key: "irrevocablePo",
      name: "Irrevocable PO",
      status: compliance.irrevocablePo?.fileUrl ? "completed" : "upload",
      file: compliance.irrevocablePo?.fileName,
      fileUrl: compliance.irrevocablePo?.fileUrl,
    },
    {
      key: "paymentAsDeposit",
      name: "Payment as Deposit",
      status: compliance.paymentAsDeposit?.fileUrl ? "completed" : "confirmation",
      note: "For Treasury's confirmation",
      file: compliance.paymentAsDeposit?.fileName,
      fileUrl: compliance.paymentAsDeposit?.fileUrl,
    },
  ]

  const otherRequirementsItems = [
    {
      key: "finalArtwork",
      name: "Final Artwork",
      status: compliance.finalArtwork?.fileUrl ? "completed" : "upload",
      file: compliance.finalArtwork?.fileName,
      fileUrl: compliance.finalArtwork?.fileUrl,
    },
    {
      key: "signedQuotation",
      name: "Signed Quotation",
      status: compliance.signedQuotation?.fileUrl ? "completed" : "upload",
      file: compliance.signedQuotation?.fileName,
      fileUrl: compliance.signedQuotation?.fileUrl,
    },
  ]

  const allItems = [...toReserveItems, ...otherRequirementsItems]
  const completed = allItems.filter((item) => item.status === "completed").length
  return {
    completed,
    total: allItems.length,
    toReserve: toReserveItems,
    otherRequirements: otherRequirementsItems,
  }
}