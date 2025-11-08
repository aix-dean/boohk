"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { getQuotationById } from "@/lib/quotation-service"
import type { Quotation, QuotationLineItem } from "@/lib/types/quotation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DownloadIcon, FileText, Loader2, Building } from "lucide-react"
import { generateQuotationPDF } from "@/lib/quotation-pdf-service"
import { db, getDoc, doc } from "@/lib/firebase"

interface CompanyData {
  id: string
  name?: string
  company_location?: any
  address?: any
  company_website?: string
  website?: string
  logo?: string
  contact_person?: string
  email?: string
  phone?: string
  social_media?: any
  created_by?: string
  created?: Date
  updated?: Date
}

const formatCompanyAddress = (companyData: CompanyData | null): string => {
  if (!companyData) return "N/A"

  const addressParts = [
    companyData.address?.street1,
    companyData.address?.street2,
    companyData.address?.city,
    companyData.address?.state,
    companyData.address?.zip,
    companyData.company_location?.country,
  ]

  const filteredAddressParts = addressParts.filter(Boolean)
  return filteredAddressParts.length > 0 ? filteredAddressParts.join(", ") : "N/A"
}

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

const getDateObject = (date: any): Date | undefined => {
  if (date === null || date === undefined) return undefined
  if (date instanceof Date) return date
  if (typeof date === "object" && date.toDate && typeof date.toDate === "function") {
    return date.toDate()
  }
  if (typeof date === "string") {
    const parsedDate = new Date(date)
    if (!isNaN(parsedDate.getTime())) return parsedDate
  }
  return undefined
}

const formatDate = (date: any) => {
  if (!date) return "N/A"
  try {
    const dateObj = getDateObject(date)
    if (!dateObj) return "N/A"
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

const formatDuration = (days: number) => {
  if (days <= 30) {
    return `${days} days`
  }
  const months = Math.floor(days / 30)
  const remainingDays = days % 30
  if (remainingDays === 0) {
    return `${months} ${months === 1 ? "month" : "months"}`
  }
  return `${months} ${months === 1 ? "month" : "months"} and ${remainingDays} ${remainingDays === 1 ? "day" : "days"}`
}

const safeFormatNumber = (value: any, options?: Intl.NumberFormatOptions): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return "0.00"
  const numValue = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  if (isNaN(numValue)) return "0.00"
  return numValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "draft":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "sent":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "viewed":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "accepted":
      return "bg-green-100 text-green-800 border-green-200"
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200"
    case "expired":
      return "bg-orange-100 text-orange-800 border-orange-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export default function PublicQuotationPage({ params }: { params: { id: string } }) {
  const { id: quotationId } = params
  const router = useRouter()
  const { toast } = useToast()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        const quotationData = await getQuotationById(quotationId)
        if (quotationData) {
          setQuotation(quotationData)

          // Fetch company data if available
          if (quotationData.items?.[0]?.company_id) {
            try {
              const companyDoc = await getDoc(doc(db, "companies", quotationData.items[0].company_id))
              if (companyDoc.exists()) {
                setCompanyData({ id: companyDoc.id, ...companyDoc.data() } as CompanyData)
              }
            } catch (error) {
              console.error("Error fetching company data:", error)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching quotation:", error)
        toast({
          title: "Error",
          description: "Failed to load quotation",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchQuotation()
  }, [quotationId, toast])

  const handleDownloadPDF = async () => {
    if (!quotation) return

    setDownloadingPDF(true)
    try {
      await generateQuotationPDF(quotation)
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      })
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      })
    } finally {
      setDownloadingPDF(false)
    }
  }

  const renderQuotationBlock = (siteName: string, items: QuotationLineItem[], pageNumber: number) => {
    if (!quotation) return null

    const item = items[0]
    const monthlyRate = item?.price || 0
    const durationMonths = Math.ceil((Number(item?.duration_days) || 40) / 30)
    const totalLease = monthlyRate * durationMonths
    const vatAmount = totalLease * 0.12
    const totalWithVat = totalLease + vatAmount

    return (
      <div key={siteName} className="p-8 bg-white">
        {/* Client and RFQ Info */}
        <div className="flex justify-between items-start mb-8">
          <div className="text-left">
            <p className="text-base font-medium mb-2">{format(new Date(), "MMMM dd, yyyy")}</p>
            <p className="text-base font-medium mb-1">{quotation.client_name || "Client Name"}</p>
            <p className="text-base font-medium">{quotation.client_company_name || "COMPANY NAME"}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-medium">RFQ. No. {quotation.quotation_number}</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900 mb-4">{items[0]?.name || "Site Name"}</h1>
        </div>

        {/* Greeting */}
        <div className="text-center mb-8">
          <p className="text-base mb-2">
            Good Day! Thank you for considering {companyData?.name || "our company"} for your business needs.
          </p>
          <p className="text-base mb-6">We are pleased to submit our quotation for your requirements:</p>
          <p className="text-base font-semibold">Details as follows:</p>
        </div>

        {/* Details Section - Read-only version */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Type</span>
            <span className="text-gray-700">: {item?.type || "Rental"}</span>
          </div>

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Size</span>
            <span className="text-gray-700">: {(item?.width && item?.height) ? `${item.width}ft (W) x ${item.height}ft (H)` : "N/A"}</span>
          </div>

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Contract Duration</span>
            <span className="text-gray-700">: {formatDuration(quotation?.duration_days || 0)}</span>
          </div>

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Contract Period</span>
            <span className="text-gray-700">
              :{quotation?.start_date ? format(new Date(quotation.start_date), "MMMM d, yyyy") : ""}
              {quotation?.start_date && quotation?.end_date ? " - " : ""}
              {quotation?.end_date ? format(new Date(quotation.end_date), "MMMM d, yyyy") : ""}
            </span>
          </div>

          <div className="flex">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Proposal to</span>
            <span className="text-gray-700">: {quotation?.client_company_name || "CLIENT COMPANY NAME"}</span>
          </div>

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Illumination</span>
            <span className="text-gray-700">: 10 units of 1000 watts metal Halide</span>
          </div>

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Lease Rate/Month</span>
            <span className="text-gray-700">: PHP {safeFormatNumber(items[0]?.price || 0)} (Exclusive of VAT)</span>
          </div>

          <div className="flex">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-32">Total Lease</span>
            <span className="text-gray-700">
              : PHP {safeFormatNumber(item?.item_total_amount || 0)} (Exclusive of VAT)
            </span>
          </div>
        </div>

        {/* Pricing Table */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700">Lease rate per month</span>
              <span className="text-gray-900">PHP {safeFormatNumber(items[0]?.price || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">x {formatDuration(quotation.duration_days || 180)}</span>
              <span className="text-gray-900">PHP {safeFormatNumber(items[0]?.item_total_amount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">12% VAT</span>
              <span className="text-gray-900">PHP {safeFormatNumber((items[0]?.item_total_amount || 0) * 0.12)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold text-lg">
                <span className="text-gray-900">TOTAL</span>
                <span className="text-gray-900">PHP {safeFormatNumber((items[0]?.item_total_amount || 0) * 1.12)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms and Conditions:</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>• Payment terms: 30% down payment, 70% upon installation</p>
            <p>• Installation will be completed within 7-10 working days upon receipt of down payment</p>
            <p>• Monthly rental fee is due on the 1st day of each month</p>
            <p>• Contract is subject to local government permits and regulations</p>
            <p>• This quotation is valid for 30 days from the date issued</p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="text-center">
          <p className="text-base mb-2">For any questions or clarifications, please contact us:</p>
          <p className="text-base font-medium">{companyData?.contact_person || "Sales Team"}</p>
          <p className="text-base">{companyData?.email || "sales@company.com"}</p>
          <p className="text-base">{companyData?.phone || "+63 123 456 7890"}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-gray-200 rounded-lg"></div>
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!quotation) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Quotation Not Found</h1>
          <p className="text-gray-600 mb-6">The quotation you're looking for doesn't exist or may have been removed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header for Public View */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm mb-6">
        <div className="max-w-[850px] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Badge className={`${getStatusColor(quotation.status || "")} border font-medium px-3 py-1`}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {quotation.status || "Draft"}
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 bg-transparent"
            >
              {downloadingPDF ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Download</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Document Container */}
      <div className="flex justify-center items-start gap-6 mt-6">
        <div className="max-w-[850px] bg-white shadow-md rounded-sm overflow-hidden">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              {companyData?.logo ? (
                <img
                  src={companyData.logo || "/placeholder.svg"}
                  alt="Company Logo"
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{companyData?.name || "Company Name"}</h1>
          </div>

          {/* Render quotation content */}
          {renderQuotationBlock("Single Site", quotation?.items || [], 1)}
        </div>
      </div>
    </div>
  )
}
