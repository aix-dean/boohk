"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, FileText, ImageIcon, Video, File, X, Download, ZoomIn, Send, ExternalLink } from "lucide-react"
import { getReportsLegacy as getReports, type ReportData } from "@/lib/report-service"
import { getProductById, type Product } from "@/lib/firebase-service"
import { generateReportPDF } from "@/lib/pdf-service"
import { useAuth } from "@/contexts/auth-context"
import { SendReportDialog } from "@/components/send-report-dialog"
import { getUserById, type User } from "@/lib/firebase-service"

export default function ReportPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string
  const [report, setReport] = useState<ReportData | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullScreenAttachment, setFullScreenAttachment] = useState<any>(null)
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
  const { user } = useAuth()
  const [userData, setUserData] = useState<User | null>(null)

  useEffect(() => {
    if (reportId) {
      fetchReportData()
    }
  }, [reportId])

  const fetchReportData = async () => {
    try {
      // Get all reports and find the one with matching ID
      const reports = await getReports()
      const foundReport = reports.find((r) => r.id === reportId)

      if (foundReport) {
        console.log("Found report:", foundReport)
        console.log("Report attachments:", foundReport.attachments)
        setReport(foundReport)

        // Fetch product data for additional details
        if (foundReport.siteId) {
          const productData = await getProductById(foundReport.siteId)
          setProduct(productData)
        }

        // Fetch user data for company logo
        if (foundReport.sellerId) {
          const userInfo = await getUserById(foundReport.sellerId)
          setUserData(userInfo)
        }
      }
    } catch (error) {
      console.error("Error fetching report data:", error)
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

  // Improved image URL handling with better Firebase Storage support
  const getImageUrl = (originalUrl: string) => {
    if (!originalUrl) return "/placeholder.svg"

    // If it's already a Firebase Storage URL with token, use it directly
    if (originalUrl.includes("firebasestorage.googleapis.com") && originalUrl.includes("token=")) {
      return originalUrl
    }

    // If it's a Firebase Storage URL without token, try to use it directly first
    if (originalUrl.includes("firebasestorage.googleapis.com")) {
      return originalUrl
    }

    // For other URLs, return as is
    return originalUrl
  }

  const handleDownloadPDF = async () => {
    if (!report || !product) return

    setIsGeneratingPDF(true)
    try {
      await generateReportPDF(report, product, false)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleSendReport = () => {
    setIsSendDialogOpen(true)
  }

  const handleSendOption = (option: "email" | "whatsapp" | "viber" | "messenger") => {
    setIsSendDialogOpen(false)

    if (option === "email") {
      // Handle email sending logic here
      console.log("Send via email")
    } else {
      console.log(`Send via ${option}`)
    }
  }

  const handleBack = () => {
    router.back()
  }

  // Simplified image component with better error handling
  const ImageDisplay = ({ attachment, index }: { attachment: any; index: number }) => {
    const [imageError, setImageError] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const handleImageLoadError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      console.error(`Image load failed for:`, attachment.fileUrl)
      setImageError(true)
      setIsLoading(false)
    }

    const handleImageLoadSuccess = () => {
      console.log(`Image loaded successfully:`, attachment.fileUrl)
      setImageError(false)
      setIsLoading(false)
    }

    // If no fileUrl or image failed to load, show fallback
    if (!attachment.fileUrl || imageError) {
      return (
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <svg className="h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-700 font-medium break-all">{attachment.fileName || "Unknown file"}</p>
          <p className="text-xs text-red-500">Failed to load image</p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                if (attachment.fileUrl) {
                  openInNewTab(attachment.fileUrl)
                }
              }}
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                if (attachment.fileUrl) {
                  downloadFile(attachment.fileUrl, attachment.fileName || "file")
                }
              }}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
      )
    }

    if (isImageFile(attachment.fileName || "")) {
      return (
        <div className="w-full h-full relative flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}
          <img
            src={getImageUrl(attachment.fileUrl) || "/placeholder.svg"}
            alt={attachment.fileName || `Attachment ${index + 1}`}
            className="max-w-full max-h-full object-contain rounded"
            onError={handleImageLoadError}
            onLoad={handleImageLoadSuccess}
            style={{ display: isLoading ? "none" : "block" }}
          />
          {attachment.note && !isLoading && (
            <p className="absolute bottom-2 left-2 right-2 text-xs text-white bg-black bg-opacity-50 p-1 rounded text-center">
              "{attachment.note}"
            </p>
          )}
        </div>
      )
    }

    if (isVideoFile(attachment.fileName || "")) {
      return (
        <div className="w-full h-full relative">
          <video
            src={attachment.fileUrl}
            controls
            className="max-w-full max-h-full object-contain rounded"
            onError={() => {
              console.error("Video load failed:", attachment.fileUrl)
              setImageError(true)
            }}
          />
          {attachment.note && (
            <p className="absolute bottom-2 left-2 right-2 text-xs text-white bg-black bg-opacity-50 p-1 rounded text-center">
              "{attachment.note}"
            </p>
          )}
        </div>
      )
    }

    // For other file types
    return (
      <div className="text-center space-y-2">
        {getFileIcon(attachment.fileName || "")}
        <p className="text-sm text-gray-700 font-medium break-all">{attachment.fileName}</p>
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              openInNewTab(attachment.fileUrl)
            }}
            className="text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              downloadFile(attachment.fileUrl, attachment.fileName || "file")
            }}
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </div>
        {attachment.note && <p className="text-xs text-gray-500 italic mt-2 text-center">"{attachment.note}"</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading report...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Report not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-white px-4 py-3 flex items-center shadow-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="bg-cyan-400 text-white px-3 py-1 rounded text-sm font-medium">
            {product?.content_type || "Lilo & Stitch"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={handleSendReport}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isGeneratingPDF ? "Generating..." : "Download"}
          </Button>
        </div>
      </div>

      {/* Angular Blue Header */}
      <div className="w-full relative bg-white">
        <div className="relative h-16 overflow-hidden">
          {/* Main blue section */}
          <div className="absolute inset-0 bg-blue-900"></div>
          {/* Angular cyan section pointing right */}
          <div
            className="absolute top-0 right-0 h-full bg-cyan-400"
            style={{
              width: "40%",
              clipPath: "polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)",
            }}
          ></div>
          {/* Content overlay */}
          <div className="relative z-10 h-full flex items-center px-6">
            <div className="text-white text-lg font-semibold">Logistics</div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Report Header with Badge and Logo */}
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <div className="bg-cyan-400 text-white px-6 py-3 rounded-lg text-base font-medium inline-block">
              Installation Report
            </div>
            <p className="text-gray-600 text-sm mt-2">as of {formatDate(report.date)}</p>
          </div>
          <div className="flex-shrink-0">
            {userData?.company_logo ? (
              <div
                className="bg-white rounded-lg px-4 py-2 flex items-center justify-center shadow-sm"
                style={{ width: "160px", height: "160px" }}
              >
                <img
                  src={userData.company_logo || "/placeholder.svg"}
                  alt={`${userData.company || "Company"} Logo`}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    // Fallback to OH+ logo if company logo fails to load
                    const target = e.target as HTMLImageElement
                    target.src = "/ohplus-new-logo.png"
                  }}
                />
              </div>
            ) : (
              <div
                className="bg-white rounded-lg px-4 py-2 flex items-center justify-center shadow-sm"
                style={{ width: "160px", height: "160px" }}
              >
                <img src="/ohplus-new-logo.png" alt="OH+ Logo" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Project Information */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              <div className="space-y-2">
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Site ID:</span>
                  <span className="text-gray-900">
                    {report.siteId} {product?.light?.location || product?.specs_rental?.location || ""}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Job Order:</span>
                  <span className="text-gray-900">{report.id?.slice(-4).toUpperCase() || "N/A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Job Order Date:</span>
                  <span className="text-gray-900">
                    {formatDate(
                      report.created && typeof report.created.toDate === "function"
                        ? report.created.toDate().toISOString().split("T")[0]
                        : report.date,
                    )}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Site:</span>
                  <span className="text-gray-900">{report.siteName}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Size:</span>
                  <span className="text-gray-900">{product?.specs_rental?.size || product?.light?.size || "N/A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Start Date:</span>
                  <span className="text-gray-900">{formatDate(report.bookingDates.start)}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">End Date:</span>
                  <span className="text-gray-900">{formatDate(report.bookingDates.end)}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Installation Duration:</span>
                  <span className="text-gray-900">
                    {Math.ceil(
                      (new Date(report.bookingDates.end).getTime() - new Date(report.bookingDates.start).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )}{" "}
                    days
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Content:</span>
                  <span className="text-gray-900">{product?.content_type || "N/A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Material Specs:</span>
                  <span className="text-gray-900">{product?.specs_rental?.material || "N/A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Crew:</span>
                  <span className="text-gray-900">Team {report.assignedTo || "A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Illumination:</span>
                  <span className="text-gray-900">{product?.light?.illumination || "N/A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Gondola:</span>
                  <span className="text-gray-900">{product?.specs_rental?.gondola ? "YES" : "NO"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Technology:</span>
                  <span className="text-gray-900">{product?.specs_rental?.technology || "N/A"}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32 flex-shrink-0">Sales:</span>
                  <span className="text-gray-900">{report.sales}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Project Status</h2>
            <div className="bg-green-500 text-white px-3 py-1 rounded text-sm font-medium">
              {report.completionPercentage || 100}%
            </div>
          </div>

          {/* Attachments/Photos */}
          {report.attachments && report.attachments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.attachments.map((attachment, index) => (
                <div key={index} className="space-y-2">
                  <div
                    className="bg-gray-200 rounded-lg h-64 flex flex-col items-center justify-center p-4 overflow-hidden cursor-pointer hover:bg-gray-300 transition-colors relative group"
                    onClick={() => attachment.fileUrl && openFullScreen(attachment)}
                  >
                    {/* Zoom overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center z-10">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>

                    <ImageDisplay attachment={attachment} index={index} />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <span className="font-semibold">Date:</span> {formatDate(report.date)}
                    </div>
                    <div>
                      <span className="font-semibold">Time:</span>{" "}
                      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div>
                      <span className="font-semibold">Location:</span> {report.location || "N/A"}
                    </div>
                    {attachment.fileName && (
                      <div>
                        <span className="font-semibold">File:</span> {attachment.fileName}
                      </div>
                    )}
                    {attachment.fileType && (
                      <div>
                        <span className="font-semibold">Type:</span> {attachment.fileType}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-8 border-t">
          <div>
            <h3 className="font-semibold mb-2">Prepared by:</h3>
            <div className="text-sm text-gray-600">
              <div>{report.createdByName}</div>
              <div>LOGISTICS</div>
              <div>
                {formatDate(
                  report.created && typeof report.created.toDate === "function"
                    ? report.created.toDate().toISOString().split("T")[0]
                    : report.date,
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 italic">
            "All data are based on the latest available records as of{" "}
            {formatDate(new Date().toISOString().split("T")[0])}."
          </div>
        </div>
      </div>

      {/* Angular Footer */}
      <div className="w-full relative bg-white mt-8">
        <div className="relative h-16 overflow-hidden">
          {/* Cyan section on left */}
          <div className="absolute inset-0 bg-cyan-400"></div>
          {/* Angular dark blue section pointing left */}
          <div
            className="absolute top-0 right-0 h-full bg-blue-900"
            style={{
              width: "75%",
              clipPath: "polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)",
            }}
          ></div>
          {/* Content overlay */}
          <div className="relative z-10 h-full flex items-center justify-between px-8">
            <div className="flex items-center gap-6">
              <div className="text-white text-lg font-semibold">{""}</div>
              <div className="text-white text-sm">{""}</div>
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

      {/* Send Report Dialog */}
      {report && (
        <SendReportDialog
          isOpen={isSendDialogOpen}
          onClose={() => setIsSendDialogOpen(false)}
          report={report}
          onSelectOption={handleSendOption}
        />
      )}

      {/* Full Screen Preview Dialog */}
      <Dialog open={isFullScreenOpen} onOpenChange={setIsFullScreenOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 bg-black border-2 border-gray-800">
          <div className="relative w-full h-full flex flex-col">
            {/* Header with controls */}
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

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-auto pt-16 pb-16">
              <div className="min-h-full flex items-center justify-center p-6">
                {fullScreenAttachment?.fileUrl ? (
                  <div className="w-full max-w-full flex items-center justify-center">
                    {isImageFile(fullScreenAttachment.fileName || "") ? (
                      <img
                        src={getImageUrl(fullScreenAttachment.fileUrl) || "/placeholder.svg"}
                        alt={fullScreenAttachment.fileName || "Full screen preview"}
                        className="max-w-full max-h-[calc(90vh-8rem)] object-contain rounded shadow-lg"
                        style={{ maxWidth: "calc(90vw - 3rem)" }}
                        onError={() => console.error("Full screen image failed to load:", fullScreenAttachment.fileUrl)}
                        onLoad={() =>
                          console.log("Full screen image loaded successfully:", fullScreenAttachment.fileUrl)
                        }
                      />
                    ) : isVideoFile(fullScreenAttachment.fileName || "") ? (
                      <video
                        src={fullScreenAttachment.fileUrl}
                        controls
                        className="max-w-full max-h-[calc(90vh-8rem)] object-contain rounded shadow-lg"
                        style={{ maxWidth: "calc(90vw - 3rem)" }}
                        autoPlay
                      />
                    ) : isPdfFile(fullScreenAttachment.fileName || "") ? (
                      <div className="w-full h-[calc(90vh-8rem)] max-w-[calc(90vw-3rem)]">
                        <iframe
                          src={fullScreenAttachment.fileUrl}
                          className="w-full h-full border-0 rounded shadow-lg"
                          title={fullScreenAttachment.fileName || "PDF Preview"}
                        />
                      </div>
                    ) : (
                      <div className="text-center text-white space-y-4 p-8">
                        <div className="flex justify-center">{getFileIcon(fullScreenAttachment.fileName || "")}</div>
                        <div>
                          <p className="text-lg font-medium break-all">{fullScreenAttachment.fileName}</p>
                          <p className="text-sm text-gray-300 mt-2">Preview not available for this file type</p>
                          <div className="flex gap-2 justify-center mt-4">
                            <Button
                              variant="outline"
                              className="bg-transparent border-white text-white hover:bg-white hover:text-black"
                              onClick={() => openInNewTab(fullScreenAttachment.fileUrl)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open in New Tab
                            </Button>
                            <Button
                              variant="outline"
                              className="bg-transparent border-white text-white hover:bg-white hover:text-black"
                              onClick={() =>
                                downloadFile(fullScreenAttachment.fileUrl, fullScreenAttachment.fileName || "file")
                              }
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download File
                            </Button>
                          </div>
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

            {/* Footer with file info */}
            {fullScreenAttachment?.note && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-90 p-4 border-t border-gray-700">
                <p className="text-white text-sm italic text-center">"{fullScreenAttachment.note}"</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
