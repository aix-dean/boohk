"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getReportById } from "@/lib/report-service"
import { getProductById } from "@/lib/firebase-service"
import { generateReportPDF } from "@/lib/pdf-service"

interface ReportData {
  id?: string
  siteId: string
  siteName: string
  companyId: string
  sellerId: string
  client: string
  clientId: string
  joNumber?: string
  bookingDates: { start: string; end: string }
  breakdate: string
  sales: string
  reportType: string
  date: string
  attachments: Array<{
    note: string
    fileName: string
    fileType: string
    fileUrl: string
  }>
  status: string
  createdBy: string
  createdByName: string
  category: string
  subcategory: string
  priority: string
  completionPercentage: number
}

interface Product {
  id?: string
  name: string
  description: string
  price: number
  specs_rental?: {
    location?: string
    height?: number
    width?: number
    material?: string
    illumination?: string
    gondola?: boolean
    technology?: string
  }
  content_type?: string
}

export default function PublicReportPage() {
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<ReportData | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true)

        // Fetch report data
        const reportData = await getReportById(reportId)
        if (!reportData) {
          setError("Report not found")
          return
        }

        setReport(reportData)

        // Fetch product data if siteId exists
        if (reportData.siteId) {
          const productData = await getProductById(reportData.siteId)
          setProduct(productData)
        }
      } catch (err) {
        console.error("Error fetching report:", err)
        setError("Failed to load report")
      } finally {
        setLoading(false)
      }
    }

    if (reportId) {
      fetchReportData()
    }
  }, [reportId])

  const handleDownload = async () => {
    if (!report || !product) return

    try {
      await generateReportPDF(report, product)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return "bg-green-500"
    if (percentage >= 75) return "bg-blue-500"
    if (percentage >= 50) return "bg-yellow-500"
    if (percentage >= 25) return "bg-orange-500"
    return "bg-red-500"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Report not found"}</p>
          <Button onClick={() => window.history.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 mb-4 flex items-center justify-between shadow-sm border-b">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium">Lilo & Stitch</div>
          <span className="text-gray-700 font-medium">{report.joNumber || "N/A"}</span>
        </div>

        <Button onClick={handleDownload} variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* Report Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-400 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <div className="bg-cyan-400 text-white px-4 py-2 rounded-full text-sm font-medium inline-block mb-2">
                {report.reportType}
              </div>
              <p className="text-cyan-100 text-sm">as of {formatDate(report.date)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <img src="public/boohk-logo.svg" alt="Company Logo" className="h-12 w-auto" />
            </div>
          </div>
        </div>

        {/* Project Information */}
        <div className="bg-white p-6 border-x border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Project Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="space-y-3">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Site ID:</span>
                <span className="text-gray-600">{report.siteId || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Job Order:</span>
                <span className="text-gray-600">{report.joNumber || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Job Order Date:</span>
                <span className="text-gray-600">{formatDate(report.bookingDates?.start)}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Site:</span>
                <span className="text-gray-600">{report.siteName || product?.name || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Size:</span>
                <span className="text-gray-600">
                  {product?.specs_rental?.height && product?.specs_rental?.width
                    ? `${product.specs_rental.height}ft (H) x ${product.specs_rental.width}ft (W)`
                    : "N/A"}
                </span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Start Date:</span>
                <span className="text-gray-600">{formatDate(report.bookingDates?.start)}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">End Date:</span>
                <span className="text-gray-600">{formatDate(report.bookingDates?.end)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Content:</span>
                <span className="text-gray-600">{product?.content_type || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Material Specs:</span>
                <span className="text-gray-600">{product?.specs_rental?.material || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Illumination:</span>
                <span className="text-gray-600">{product?.specs_rental?.illumination || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Gondola:</span>
                <span className="text-gray-600">{product?.specs_rental?.gondola ? "YES" : "NO"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Technology:</span>
                <span className="text-gray-600">{product?.specs_rental?.technology || "N/A"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-700 w-32">Sales:</span>
                <span className="text-gray-600">{report.sales || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Project Status */}
        <div className="bg-white p-6 border-x border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Project Status</h2>
            <span
              className={`${getStatusColor(report.completionPercentage)} text-white px-3 py-1 rounded-full text-sm font-medium`}
            >
              {report.completionPercentage}%
            </span>
          </div>

          {/* Attachments */}
          {report.attachments && report.attachments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.attachments.slice(0, 2).map((attachment, index) => (
                <div key={index} className="relative group cursor-pointer">
                  {attachment.fileType?.startsWith("image/") ? (
                    <img
                      src={attachment.fileUrl || "/placeholder.svg"}
                      alt={attachment.note || `Attachment ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedImage(attachment.fileUrl)}
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-gray-400 mb-2">📄</div>
                        <p className="text-sm text-gray-600">{attachment.fileName}</p>
                      </div>
                    </div>
                  )}
                  {attachment.note && <p className="mt-2 text-sm text-gray-600">{attachment.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white p-6 rounded-b-lg border-x border-b border-gray-200">
          <div className="text-center text-sm text-gray-600 space-y-1">
            <p>
              <strong>Prepared by:</strong> {report.createdByName || "N/A"}
            </p>
            <p>
              <strong>Department:</strong> SALES
            </p>
            <p>
              <strong>Date Prepared:</strong> {formatDate(report.date)}
            </p>
            <p className="text-xs text-gray-500 mt-4">
              This report is generated by Boohk Sales Management System. For inquiries, please contact our sales team.
            </p>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage || "/placeholder.svg"}
              alt="Full size attachment"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
