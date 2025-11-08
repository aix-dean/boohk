"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Download, Send } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { getProductById, type Product } from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"
import { generateReportPDF } from "@/lib/pdf-service"
import { SendReportDialog } from "@/components/send-report-dialog"
import { useToast } from "@/hooks/use-toast"
import type { ReportData } from "@/lib/report-service"

export default function ReportViewPage() {
  const params = useParams()
  const router = useRouter()
  const siteId = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (siteId && user?.uid) {
      fetchProductData()
    }
  }, [siteId, user?.uid])

  const fetchProductData = async () => {
    try {
      const productData = await getProductById(siteId)
      if (productData) {
        setProduct(productData)
      }
    } catch (error) {
      console.error("Error fetching product data:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleBack = () => {
    router.back()
  }

  const handleDownloadPDF = async () => {
    if (!product) return

    setIsDownloading(true)
    try {
      // Create mock report data based on the product
      const reportData: ReportData = {
        id: `REPORT-${Date.now()}`,
        siteId: product.id,
        siteName: product.name || "P01",
        reportType: "completion-report",
        date: new Date().toISOString().split("T")[0],
        location: product.location || "Guadalupe Viejo",
        assignedTo: "Team A",
        sales: "aixymbiosis@aix.com",
        completionPercentage: 100,
        bookingDates: {
          start: "2025-05-20",
          end: "2025-06-20",
        },
        attachments: [
          {
            fileName: "report.pdf",
            fileUrl: "/placeholder.jpg",
            note: "Completion report attachment",
          },
        ],
        created: new Date().toISOString(),
        createdBy: user?.uid || "",
        createdByName: user?.email || "aixymbiosis@aix.com",
      }

      // Generate and download PDF
      await generateReportPDF(reportData, product, false)

      toast({
        title: "PDF Downloaded",
        description: "The completion report has been downloaded successfully.",
      })
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast({
        title: "Download Failed",
        description: "Failed to download the PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSendReport = () => {
    setSendDialogOpen(true)
  }

  const handleSendOption = (option: "email" | "whatsapp" | "viber" | "messenger") => {
    if (!product) return

    // Create mock report data for sending
    const reportData: ReportData = {
      id: `REPORT-${Date.now()}`,
      siteId: product.id,
      siteName: product.name || "P01",
      reportType: "completion-report",
      date: new Date().toISOString().split("T")[0],
      location: product.location || "Guadalupe Viejo",
      assignedTo: "Team A",
      sales: "aixymbiosis@aix.com",
      completionPercentage: 100,
      bookingDates: {
        start: "2025-05-20",
        end: "2025-06-20",
      },
      attachments: [
        {
          fileName: "report.pdf",
          fileUrl: "/placeholder.jpg",
          note: "Completion report attachment",
        },
      ],
      created: new Date().toISOString(),
      createdBy: user?.uid || "",
      createdByName: user?.email || "aixymbiosis@aix.com",
    }

    if (option === "email") {
      // Navigate to compose email page (similar to logistics dashboard)
      router.push(`/logistics/reports/${reportData.id}/compose`)
    } else {
      toast({
        title: "Feature Coming Soon",
        description: `Sharing via ${option} will be available soon.`,
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading report...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Report not found</div>
      </div>
    )
  }

  // Create report data for the send dialog
  const reportData: ReportData = {
    id: `REPORT-${Date.now()}`,
    siteId: product.id,
    siteName: product.name || "P01",
    reportType: "completion-report",
    date: new Date().toISOString().split("T")[0],
    location: product.location || "Guadalupe Viejo",
    assignedTo: "Team A",
    sales: "aixymbiosis@aix.com",
    completionPercentage: 100,
    bookingDates: {
      start: "2025-05-20",
      end: "2025-06-20",
    },
    attachments: [
      {
        fileName: "report.pdf",
        fileUrl: "/placeholder.jpg",
        note: "Completion report attachment",
      },
    ],
    created: new Date().toISOString(),
    createdBy: user?.uid || "",
    createdByName: user?.email || "aixymbiosis@aix.com",
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button and Content Title Section */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="lg"
            onClick={handleBack}
            className="text-black rounded-full p-3 hover:bg-gray-100"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <Badge className="bg-cyan-400 text-white px-4 py-2 rounded-full font-medium text-lg">Completion Report</Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Send Button */}
          <Button
            onClick={handleSendReport}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>

          {/* Download PDF Button */}
          <Button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="w-full">
        <img src="/logistics-header.png" alt="Logistics Header" className="w-full h-auto object-cover" />
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Report Title */}
        <div className="flex justify-between items-center">
          <div>
            <Badge className="bg-cyan-400 text-white text-lg px-4 py-2 rounded-full">Completion Report</Badge>
            <p className="text-gray-600 mt-2 italic">as of July 10, 2025</p>
          </div>
          <div className="flex-shrink-0">
            <img src="/gts-logo.png" alt="GTS Incorporated Logo" className="h-24 w-auto" />
          </div>
        </div>

        {/* Project Information */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Site ID:</span> {product.id} Guadalupe Viejo
                </div>
                <div>
                  <span className="font-semibold">Job Order:</span> KTHB
                </div>
                <div>
                  <span className="font-semibold">Job Order Date:</span> July 10, 2025
                </div>
                <div>
                  <span className="font-semibold">Site:</span> P01
                </div>
                <div>
                  <span className="font-semibold">Size:</span> N/A
                </div>
                <div>
                  <span className="font-semibold">Start Date:</span> May 20, 2025
                </div>
                <div>
                  <span className="font-semibold">End Date:</span> June 20, 2025
                </div>
                <div>
                  <span className="font-semibold">Installation Duration:</span> 31 days
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="font-semibold">Content:</span> Static
                </div>
                <div>
                  <span className="font-semibold">Material Specs:</span> N/A
                </div>
                <div>
                  <span className="font-semibold">Crew:</span> Team A
                </div>
                <div>
                  <span className="font-semibold">Illumination:</span> N/A
                </div>
                <div>
                  <span className="font-semibold">Gondola:</span> NO
                </div>
                <div>
                  <span className="font-semibold">Technology:</span> N/A
                </div>
                <div>
                  <span className="font-semibold">Sales:</span> aixymbiosis@aix.com
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">Project Status</h2>
            <Badge className="bg-green-500 text-white px-3 py-1 rounded">100%</Badge>
          </div>

          {/* Report File Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="bg-gray-200 rounded-lg h-64 flex flex-col items-center justify-center p-4">
                <div className="text-center space-y-2">
                  <div className="text-6xl">📄</div>
                  <p className="text-sm text-gray-700 font-medium">report.pdf</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <span className="font-semibold">Date:</span> July 10, 2025
                </div>
                <div>
                  <span className="font-semibold">Time:</span> 10:28 AM
                </div>
                <div>
                  <span className="font-semibold">Location:</span> Guadalupe Viejo
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-8 border-t">
          <div>
            <h3 className="font-semibold mb-2">Prepared by:</h3>
            <div className="text-sm text-gray-600">
              <div>aixymbiosis@aix.com</div>
              <div>LOGISTICS</div>
              <div>July 10, 2025</div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 italic">
            "All data are based on the latest available records as of July 10, 2025."
          </div>
        </div>
      </div>

      {/* Bottom Branding */}
      <div className="w-full mt-8">
        <img src="/logistics-footer.png" alt="Logistics Footer" className="w-full h-auto object-cover" />
      </div>

      {/* Send Report Dialog */}
      <SendReportDialog
        isOpen={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        report={reportData}
        onSelectOption={handleSendOption}
      />
    </div>
  )
}
