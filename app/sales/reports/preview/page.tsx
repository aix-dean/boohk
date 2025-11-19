"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, FileText, ImageIcon, Video, File, X, Download, ZoomIn, ExternalLink } from "lucide-react"
import { postReport, type ReportData } from "@/lib/report-service"
import type { Product } from "@/lib/firebase-service"
import { generateReportPDF } from "@/lib/pdf-service"
import { useAuth } from "@/contexts/auth-context"
import { SendReportDialog } from "@/components/send-report-dialog"
import { useToast } from "@/hooks/use-toast"
import { doc, getDoc, Timestamp, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { CongratulationsDialog } from "@/components/congratulations-dialog"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

export default function SalesReportPreviewPage() {
  const router = useRouter()
  const [report, setReport] = useState<ReportData | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [fullScreenAttachment, setFullScreenAttachment] = useState<any>(null)
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set())
  const [preparedByName, setPreparedByName] = useState<string>("")
  const { user } = useAuth()
  const { toast } = useToast()
  const [companyLogo, setCompanyLogo] = useState<string>("public/boohk-logo.png")
  const [showCongratulations, setShowCongratulations] = useState(false)
  const [booking, setBooking] = useState<any>(null)
  const reportContentRef = useRef<HTMLDivElement>(null)

  const handleCongratulationsClose = () => {
    setShowCongratulations(false)
  }

  useEffect(() => {
    loadPreviewData()
  }, [])

  useEffect(() => {
    if (user?.uid) {
      fetchPreparedByName()
    }
  }, [user?.uid])

  const fetchPreparedByName = async () => {
    if (!user?.uid) return

    try {
      console.log("Fetching user data for uid:", user.uid)

      const userDocRef = doc(db, "boohk_users", user.uid)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        console.log("User data found:", userData)

        if (userData.company_id) {
          console.log("Fetching company data for company_id:", userData.company_id)

          const companyDocRef = doc(db, "companies", userData.company_id)
          const companyDoc = await getDoc(companyDocRef)

          if (companyDoc.exists()) {
            const companyData = companyDoc.data()
            console.log("Company data found:", companyData)

            const name =
              companyData.name ||
              companyData.company_name ||
              userData.display_name ||
              userData.first_name + " " + userData.last_name ||
              user.displayName ||
              user.email?.split("@")[0] ||
              "User"

            setPreparedByName(name)
            console.log("Set prepared by name to:", name)

            if (companyData.photo_url && companyData.photo_url.trim() !== "") {
              console.log("Setting company logo to:", companyData.photo_url)
              setCompanyLogo(companyData.photo_url)
            } else {
              console.log("No company photo_url found, using default Boohk logo")
              setCompanyLogo("public/boohk-logo.png")
            }
            return
          } else {
            console.log("Company document not found for company_id:", userData.company_id)
          }
        } else {
          console.log("No company_id found in user data")
        }

        const fallbackName =
          userData.display_name ||
          userData.first_name + " " + userData.last_name ||
          user.displayName ||
          user.email?.split("@")[0] ||
          "User"

        setPreparedByName(fallbackName)
        setCompanyLogo("public/boohk-logo.png")
      } else {
        console.log("User document not found for uid:", user.uid)
        setPreparedByName(user.displayName || user.email?.split("@")[0] || "User")
        setCompanyLogo("public/boohk-logo.png")
      }
    } catch (error) {
      console.error("Error fetching prepared by name:", error)
      setPreparedByName(user.displayName || user.email?.split("@")[0] || "User")
      setCompanyLogo("public/boohk-logo.png")
    }
  }

  // Helper function to reconstruct Firestore Timestamps from JSON
  const reconstructTimestamp = (obj: any): any => {
    if (obj && typeof obj === 'object' && obj.seconds !== undefined && obj.nanoseconds !== undefined) {
      return new Timestamp(obj.seconds, obj.nanoseconds)
    }
    if (Array.isArray(obj)) {
      return obj.map(reconstructTimestamp)
    }
    if (obj && typeof obj === 'object') {
      const reconstructed: any = {}
      for (const [key, value] of Object.entries(obj)) {
        reconstructed[key] = reconstructTimestamp(value)
      }
      return reconstructed
    }
    return obj
  }

  const loadPreviewData = async () => {
    try {
      const reportDataString = sessionStorage.getItem("previewReportData")
      const productDataString = sessionStorage.getItem("previewProductData")

      if (reportDataString && productDataString) {
        const parsedReportData = JSON.parse(reportDataString)
        const reportData = reconstructTimestamp(parsedReportData)
        const productData = JSON.parse(productDataString)

        console.log("Loaded preview report data:", reportData)
        console.log("Preview report attachments:", reportData.attachments)

        setReport({
          ...reportData,
          attachments: Array.isArray(reportData.attachments) ? reportData.attachments : []
        })
        setProduct(productData)

        // Fetch booking data
        if (productData?.id) {
          try {
            const bookingsRef = collection(db, "booking")
            const q = query(
              bookingsRef,
              where("product_id", "==", productData.id),
              orderBy("created", "desc"),
              limit(1)
            )
            const snapshot = await getDocs(q)

            if (!snapshot.empty) {
              const bookingData = snapshot.docs[0].data()
              setBooking(bookingData)
            }
          } catch (error) {
            console.error("Error fetching booking:", error)
          }
        }
      } else {
        console.error("No preview data found in session storage")
        toast({
          title: "Error",
          description: "No preview data found",
          variant: "destructive",
        })
        router.push("/sales/dashboard")
      }
    } catch (error) {
      console.error("Error loading preview data:", error)
      toast({
        title: "Error",
        description: "Failed to load preview data",
        variant: "destructive",
      })
      router.push("/sales/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const handlePostReport = async () => {
    if (!report) {
      toast({
        title: "Error",
        description: "No report data available",
        variant: "destructive",
      })
      return
    }

    setPosting(true)
    try {
      console.log("Posting report with attachments:", report.attachments)

      const finalReportData: ReportData = {
        ...report,
        // Ensure bookingDates exists with default values if undefined
        bookingDates: report.bookingDates || {
          start: new Date().toISOString().split("T")[0],
          end: new Date().toISOString().split("T")[0],
        },
        breakdate: report.breakdate || report.date || new Date().toISOString().split("T")[0],
        status: "posted",
        category: "sales",
        id: undefined,
        created: undefined,
        updated: undefined,
      }

      if (finalReportData.attachments) {
        finalReportData.attachments = finalReportData.attachments
          .filter((attachment: any) => attachment && attachment.fileUrl && attachment.fileName)
          .map((attachment: any) => ({
            note: attachment.note || "",
            fileName: attachment.fileName,
            fileType: attachment.fileType || "unknown",
            fileUrl: attachment.fileUrl,
          }))
      }

      console.log("Final report data being posted:", finalReportData)
      console.log("Final attachments data:", finalReportData.attachments)

      const reportId = await postReport(finalReportData)

      // Fetch the actual saved report data from database
      const { getReportById } = await import("@/lib/report-service")
      const savedReport = await getReportById(reportId)

      if (savedReport) {
        // Update the report state with the actual saved report data
        setReport(savedReport)
        console.log("Updated report state with saved report data:", savedReport)
      }

      sessionStorage.setItem("lastPostedReportId", reportId)

      sessionStorage.removeItem("previewReportData")
      sessionStorage.removeItem("previewProductData")

      setShowCongratulations(true)
    } catch (error) {
      console.error("Error posting report:", error)
      toast({
        title: "Error",
        description: "Failed to post report. Please try again.",
        variant: "destructive",
      })
    } finally {
      setPosting(false)
    }
  }

  const handleSendReport = () => {
    setIsSendDialogOpen(true)
  }

  const handleSendOption = (option: "email" | "whatsapp" | "viber" | "messenger") => {
    setIsSendDialogOpen(false)

    if (option === "email") {
      console.log("Send via email")
    } else {
      console.log(`Send via ${option}`)
    }
  }

  const formatDate = (dateValue: string | any) => {
    let date: Date
    if (typeof dateValue === 'string') {
      date = new Date(dateValue)
    } else if (dateValue && typeof dateValue.toDate === 'function') {
      // Handle Firestore Timestamp
      date = dateValue.toDate()
    } else {
      date = new Date(dateValue)
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getReportTypeDisplay = (type: string) => {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const getFileIcon = (fileName: string) => {
    if (!fileName) return <File className="h-12 w-12 text-gray-400" />

    const extension = fileName.toLowerCase().split(".").pop()

    switch (extension) {
      case "pdf":
        return <FileText className="h-12 w-12 text-red-500" />
      case "doc":
      case "docx":
        return <FileText className="h-12 w-12 text-blue-500" />
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
        return <ImageIcon className="h-12 w-12 text-green-500" />
      case "mp4":
      case "avi":
      case "mov":
      case "wmv":
        return <Video className="h-12 w-12 text-purple-500" />
      default:
        return <File className="h-12 w-12 text-gray-500" />
    }
  }

  const isImageFile = (fileName: string) => {
    if (!fileName) return false
    const extension = fileName.toLowerCase().split(".").pop()
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "")
  }

  const isVideoFile = (fileName: string) => {
    if (!fileName) return false
    const extension = fileName.toLowerCase().split(".").pop()
    return ["mp4", "avi", "mov", "wmv"].includes(extension || "")
  }

  const isPdfFile = (fileName: string) => {
    if (!fileName) return false
    const extension = fileName.toLowerCase().split(".").pop()
    return extension === "pdf"
  }

  const openFullScreen = (attachment: any) => {
    setFullScreenAttachment(attachment)
    setIsFullScreenOpen(true)
  }

  const closeFullScreen = () => {
    setIsFullScreenOpen(false)
    setFullScreenAttachment(null)
  }

  const downloadFile = (fileUrl: string, fileName: string) => {
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = fileName
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openInNewTab = (fileUrl: string) => {
    window.open(fileUrl, "_blank", "noopener,noreferrer")
  }

  const handleImageError = (fileUrl: string, fileName: string) => {
    console.error("Image failed to load:", fileUrl)
    setImageLoadErrors((prev) => new Set(prev).add(fileUrl))
  }

  const handleDownloadPDF = async () => {
    if (!report) return

    setIsGeneratingPDF(true)
    try {
      // Dynamic imports for client-side libraries
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      toast({
        title: "Download",
        description: "Generating PDF...",
      })

      // Find all page containers (similar to proposals)
      const pageContainers = document.querySelectorAll('[class*="mx-32 mb-8 bg-white shadow-lg"]')

      if (pageContainers.length === 0) {
        throw new Error("No report pages found")
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      for (let i = 0; i < pageContainers.length; i++) {
        const container = pageContainers[i] as HTMLElement

        // Temporarily remove height restrictions to capture full content
        const originalMaxHeight = container.style.maxHeight
        const originalOverflow = container.style.overflow
        container.style.maxHeight = 'none'
        container.style.overflow = 'visible'

        // Capture the page with html2canvas
        const canvas = await html2canvas(container, {
          scale: 3, // Higher quality like proposals
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: container.offsetWidth,
          height: container.offsetHeight,
          imageTimeout: 0,
          logging: false,
        })

        // Restore original styles
        container.style.maxHeight = originalMaxHeight
        container.style.overflow = originalOverflow

        const imgData = canvas.toDataURL('image/jpeg', 0.7)

        // Calculate dimensions to fit the page (same as proposals)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
        const imgX = (pdfWidth - imgWidth * ratio) / 2
        const imgY = (pdfHeight - imgHeight * ratio) / 2

        if (i > 0) {
          pdf.addPage()
        }

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      }

      // Save the PDF
      pdf.save(`report-${report.id || 'preview'}.pdf`)

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  const handleEdit = () => {
    router.back()
  }

  const calculateInstallationDuration = (startDate: any, endDate: any) => {
    if (!startDate || !endDate) return 0

    let start: Date
    let end: Date

    if (typeof startDate === 'string') {
      start = new Date(startDate)
    } else if (startDate && typeof startDate.toDate === 'function') {
      start = startDate.toDate()
    } else {
      start = new Date(startDate)
    }

    if (typeof endDate === 'string') {
      end = new Date(endDate)
    } else if (endDate && typeof endDate.toDate === 'function') {
      end = endDate.toDate()
    } else {
      end = new Date(endDate)
    }

    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getSiteLocation = (product: Product | null) => {
    if (!product) return "N/A"
    return product.specs_rental?.location || product.light?.location || "N/A"
  }

  const getSiteName = (report: ReportData | null) => {
    if (!report) return "N/A"
    return report.siteName || "N/A"
  }

  const getSiteSize = (product: Product | null) => {
    if (!product) return "N/A"

    const specs = product.specs_rental
    if (specs?.height && specs?.width) {
      const panels = specs.panels || "N/A"
      return `${specs.height} (H) x ${specs.width} (W) x ${panels} Panels`
    }

    return product.specs_rental?.size || product.light?.size || "N/A"
  }

  const getMaterialSpecs = (product: Product | null) => {
    if (!product) return "N/A"
    return product.specs_rental?.material || "Stickers"
  }

  const getIllumination = (product: Product | null) => {
    if (!product) return "N/A"
    return product.specs_rental?.illumination || "LR 2097 (200 Watts x 40)"
  }

  const getGondola = (product: Product | null) => {
    if (!product) return "N/A"
    return product.specs_rental?.gondola ? "YES" : "NO"
  }

  const getTechnology = (product: Product | null) => {
    if (!product) return "N/A"
    return product.specs_rental?.technology || "Clear Tapes"
  }

  const getCompletionPercentage = (report: ReportData | null) => {
    if (!report) return 100

    if (report.installationStatus !== undefined) {
      const percentage = Number.parseInt(report.installationStatus.toString(), 10)
      return isNaN(percentage) ? 0 : percentage
    }

    if (report.completionPercentage !== undefined) {
      return report.completionPercentage
    }

    return report.reportType === "installation-report" ? 0 : 100
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading report preview...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">No report data available</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      <div className="bg-white px-4 py-3 mb-4 flex items-center shadow-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-[#38b6ff] text-white px-4 py-2 rounded-full text-[27.7px] font-medium">{booking?.project_name || "Lilo & Stitch"}</div>
          {report.joNumber && <span className="text-lg font-bold text-[25.1px] text-[#0f76ff] bg-blue-100 px-3 py-1 rounded-md">{report.joNumber}</span>}
        </div>

        <div className="ml-auto"></div>
      </div>

      <div className="relative">
        <div className="absolute left-2 top-6 z-10">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center">
              <Button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 p-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
              >
                <Download className="h-6 w-6" />
              </Button>
              <span className="text-xs text-gray-600 mt-1 font-medium">{isGeneratingPDF ? "..." : "Download"}</span>
            </div>
          </div>
        </div>

        <div ref={reportContentRef} className="mx-32 mb-8 bg-white shadow-lg rounded-lg overflow-y-auto overflow-x-hidden h-[calc(100vh-12rem)]">
          <div className="w-full relative">
            <div className="relative h-16">
              <div className="absolute inset-0 bg-blue-900"></div>
              <div
                className="absolute top-0 right-0 h-full bg-cyan-400"
                style={{
                  width: "40%",
                  clipPath: "polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)",
                }}
              ></div>
              <div className="relative z-10 h-full flex items-center px-6">
                <div className="text-white text-lg font-semibold">Sales</div>
              </div>
            </div>
          </div>

          <div className="w-2xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <div className="bg-cyan-400 text-white px-6 py-3 rounded-lg text-base font-medium inline-block">
                  {getReportTypeDisplay(report.reportType)}
                </div>
                <p className="text-gray-600 text-sm mt-2">as of {formatDate(report.date)}</p>
              </div>
              <div className="flex-shrink-0">
                <div
                  className="bg-white rounded-lg px-4 py-2 flex items-center justify-center shadow-sm"
                  style={{ width: "160px", height: "160px" }}
                >
                  <img
                    src={companyLogo || "/placeholder.svg"}
                    alt="Company Logo"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      console.error("Company logo failed to load:", companyLogo)
                      setCompanyLogo("public/boohk-logo.png")
                    }}
                  />
                </div>
              </div>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">Project Information</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Site ID:</span>
                      <span className="text-gray-900">{getSiteLocation(product)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Job Order:</span>
                      <span className="text-gray-900">
                        {report.joNumber || report.id?.slice(-4).toUpperCase() || "N/A"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Job Order Date:</span>
                      <span className="text-gray-900">{formatDate(report.date)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Site:</span>
                      <span className="text-gray-900">{getSiteName(report)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Size:</span>
                      <span className="text-gray-900">{getSiteSize(product)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Start Date:</span>
                      <span className="text-gray-900">
                        {report.bookingDates?.start ? formatDate(report.bookingDates.start) : "N/A"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">End Date:</span>
                      <span className="text-gray-900">
                        {report.bookingDates?.end ? formatDate(report.bookingDates.end) : "N/A"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Installation Duration:</span>
                      <span className="text-gray-900">
                        {report.bookingDates?.start && report.bookingDates?.end
                          ? `${calculateInstallationDuration(report.bookingDates.start, report.bookingDates.end)} days`
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Content:</span>
                      <span className="text-gray-900">{product?.content_type || "Static"}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Material Specs:</span>
                      <span className="text-gray-900">{getMaterialSpecs(product)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Crew:</span>
                      <span className="text-gray-900">Team {report.assignedTo || "4"}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Illumination:</span>
                      <span className="text-gray-900">{getIllumination(product)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Gondola:</span>
                      <span className="text-gray-900">{getGondola(product)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Technology:</span>
                      <span className="text-gray-900">{getTechnology(product)}</span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                      <span className="font-bold text-gray-700 whitespace-nowrap">Sales:</span>
                      <span className="text-gray-900">{report.sales}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-900">Project Status</h2>
                <div
                  className={`text-white px-3 py-1 rounded text-sm font-medium ${(() => {
                    const percentage = getCompletionPercentage(report)

                    if (percentage >= 90) return "bg-green-500"
                    if (percentage >= 70) return "bg-yellow-500"
                    if (percentage >= 50) return "bg-orange-500"
                    return "bg-red-500"
                  })()}`}
                >
                  {getCompletionPercentage(report)}%
                </div>
              </div>

              {report.attachments && report.attachments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {report.attachments.slice(0, 2).map((attachment, index) => (
                    <div key={index} className="space-y-2">
                      <div
                        className="bg-white-200 rounded-lg h-96 flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-white-300 transition-colors relative group"
                        onClick={() => attachment.fileUrl && openFullScreen(attachment)}
                      >
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center z-10">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>

                        {report.siteImageUrl && isImageFile(attachment.fileName) ? (
                          <img
                            src={report.siteImageUrl || "/placeholder.svg"}
                            alt={attachment.fileName}
                            className="max-w-full max-h-full object-cover rounded"
                            onError={(e) => handleImageError(report.siteImageUrl || "", attachment.fileName)}
                          />
                        ) : attachment.fileUrl && isImageFile(attachment.fileName) ? (
                          <img
                            src={attachment.fileUrl || "/placeholder.svg"}
                            alt={attachment.fileName}
                            className="max-w-full max-h-full object-cover rounded"
                            onError={(e) => handleImageError(attachment.fileUrl, attachment.fileName)}
                          />
                        ) : (
                          <div className="text-center space-y-2">
                            {getFileIcon(attachment.fileName)}
                            <p className="text-sm text-gray-700 font-medium break-all">{attachment.fileName}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <div className="flex justify-between items-start pt-8 border-t">
              <div>
                <h3 className="font-semibold mb-2">Prepared by:</h3>
                <div className="text-sm text-black font-medium">
                  <div>{preparedByName || "Loading..."}</div>
                  <div>SALES</div>
                  <div>{formatDate(report.date)}</div>
                </div>
              </div>
              <div className="text-right text-sm text-black italic">
                "All data are based on the latest available records as of{" "}
                {formatDate(new Date().toISOString().split("T")[0])}."
              </div>
            </div>
          </div>

          <div className="w-full relative">
            <div className="relative h-16">
              <div className="absolute inset-0 bg-cyan-400"></div>
              <div
                className="absolute top-0 right-0 h-full bg-blue-900"
                style={{
                  width: "75%",
                  clipPath: "polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)",
                }}
              ></div>
              <div className="relative z-10 h-full flex items-center justify-between px-8">
                <div className="flex items-center gap-6">
                  <div className="text-white text-lg font-semibold">{""}</div>
                </div>
                <div className="text-white text-right flex items-center gap-2">
                  <div className="text-sm font-medium">Smart. Seamless. Scalable</div>
                  <div className="text-2xl font-bold flex items-center">
                    OH!
                    <div className="ml-1 text-cyan-400">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSendReport}
          disabled={posting}
          className="text-white px-10 py-5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-lg"
          style={{ backgroundColor: "#00bf63", minWidth: "140px", minHeight: "64px" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#00a855")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00bf63")}
        >
          {posting ? "Sending..." : "Send"}
        </Button>
      </div>

      {report && (
        <SendReportDialog
          isOpen={isSendDialogOpen}
          onClose={() => setIsSendDialogOpen(false)}
          report={report}
          onSelectOption={handleSendOption}
        />
      )}

      <Dialog open={isFullScreenOpen} onOpenChange={setIsFullScreenOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 bg-black border-2 border-gray-800">
          <div className="relative w-full h-full flex flex-col">
            <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-90 p-4 flex justify-between items-center border-b border-gray-700">
              <DialogTitle className="text-white text-lg font-medium truncate pr-4">
                {fullScreenAttachment?.fileName || "File Preview"}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                {fullScreenAttachment?.fileUrl && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openInNewTab(fullScreenAttachment.fileUrl)}
                      className="text-white hover:bg-white hover:bg-opacity-20"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        downloadFile(fullScreenAttachment.fileUrl, fullScreenAttachment.fileName || "file")
                      }
                      className="text-white hover:bg-white hover:bg-opacity-20"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeFullScreen}
                  className="text-white hover:bg-white hover:bg-opacity-20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 pt-16 pb-16">
              <div className="min-h-full flex items-center justify-center p-6">
                {fullScreenAttachment?.fileUrl ? (
                  <div className="w-full max-w-full flex items-center justify-center">
                    {isImageFile(fullScreenAttachment.fileName || "") ? (
                      <img
                        src={fullScreenAttachment.fileUrl || "/placeholder.svg"}
                        alt={fullScreenAttachment.fileName || "Full screen preview"}
                        className="max-w-full max-h-[calc(90vh-8rem)] object-contain rounded shadow-lg"
                        style={{ maxWidth: "calc(90vw - 3rem)" }}
                      />
                    ) : (
                      <div className="text-center text-white space-y-4 p-8">
                        <div className="flex justify-center">{getFileIcon(fullScreenAttachment.fileName || "")}</div>
                        <div>
                          <p className="text-lg font-medium break-all">{fullScreenAttachment.fileName}</p>
                          <p className="text-sm text-gray-300 mt-2">Preview not available for this file type</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-white p-8">
                    <p>File not available</p>
                  </div>
                )}
              </div>
            </div>

            {fullScreenAttachment?.note && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-90 p-4 border-t border-gray-700">
                <p className="text-white text-sm italic text-center">{fullScreenAttachment.note}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CongratulationsDialog isOpen={showCongratulations} onClose={handleCongratulationsClose} />
    </div>
  )
}
