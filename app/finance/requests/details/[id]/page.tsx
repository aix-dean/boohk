"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import {
  AlertCircle,
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Play,
  Shrink,
  Expand,
  User,
  X,
  XCircle,
  Clock,
  File as FileGeneric,
} from "lucide-react"

import type { FinanceRequest } from "@/lib/types/finance-request"
import ReplenishReportActions from "@/components/finance/replenish-report-actions"

type AttachmentType = "image" | "video" | "pdf" | "document"
type Attachment = {
  url: string
  name: string
  type: AttachmentType
  field: "Attachments" | "Quotation" | "Send Report" | "Print Report"
}

const currencies = [
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
]

const getStatusIcon = (status: string) => {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return <CheckCircle className="h-5 w-5 text-green-600" />
    case "pending":
      return <Clock className="h-5 w-5 text-yellow-600" />
    case "rejected":
      return <XCircle className="h-5 w-5 text-red-600" />
    case "processing":
      return <AlertCircle className="h-5 w-5 text-blue-600" />
    default:
      return <Clock className="h-5 w-5 text-gray-600" />
  }
}

const getStatusBadgeVariant = (status: string) => {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "default"
    case "pending":
      return "secondary"
    case "rejected":
      return "destructive"
    case "processing":
      return "outline"
    default:
      return "secondary"
  }
}

const getCurrencySymbol = (currencyCode: string) => {
  const currency = currencies.find((c) => c.code === currencyCode)
  return currency?.symbol || currencyCode
}

const formatAmount = (amount: number, currencyCode: string) => {
  const symbol = getCurrencySymbol(currencyCode)
  return `${symbol}${(amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const getFileType = (url: string): AttachmentType => {
  const clean = url.split("?")[0] || ""
  const extension = clean.split(".").pop()?.toLowerCase() || ""
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) return "image"
  if (["mp4", "webm", "ogg", "mov", "avi", "m4v"].includes(extension)) return "video"
  if (extension === "pdf") return "pdf"
  return "document"
}

const getFileName = (url: string) => {
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.split("/").pop() || "attachment")
  } catch {
    const clean = url.split("?")[0]
    return decodeURIComponent(clean.split("/").pop() || "attachment")
  }
}

const IconForType = ({ type, className }: { type: AttachmentType; className?: string }) => {
  switch (type) {
    case "image":
      return <ImageIcon className={className} />
    case "video":
      return <Play className={className} />
    case "pdf":
      return <FileText className={className} />
    default:
      return <FileGeneric className={className} />
  }
}

export default function RequestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()

  const [request, setRequest] = useState<FinanceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Attachment states
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const galleryItems = useMemo(() => attachments.filter((a) => a.type === "image" || a.type === "video"), [attachments])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const viewerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Optional PDF inline preview (kept intact so we don't break existing behaviors)
  const [pdfPreview, setPdfPreview] = useState<Attachment | null>(null)

  const requestId = params.id as string

  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        const docRef = doc(db, "request", requestId)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
          setNotFound(true)
          return
        }

        const data = docSnap.data() as any

        // Ownership and deletion checks preserved
        const companyIdentifier = user?.company_id || userData?.project_id || user?.uid
        if (data.company_id !== companyIdentifier || data.deleted === true) {
          setNotFound(true)
          return
        }

        const req = { id: docSnap.id, ...data } as FinanceRequest
        setRequest(req)

        // Build attachments list (unchanged sources)
        const all: Attachment[] = []
        if (req.Attachments) {
          all.push({
            url: req.Attachments,
            name: getFileName(req.Attachments),
            type: getFileType(req.Attachments),
            field: "Attachments",
          })
        }
        if (req.request_type === "requisition" && req.Quotation) {
          all.push({
            url: req.Quotation,
            name: getFileName(req.Quotation),
            type: getFileType(req.Quotation),
            field: "Quotation",
          })
        }
        if (req.request_type === "replenish") {
          if ((req as any)["Send Report"]) {
            const url = (req as any)["Send Report"]
            all.push({
              url,
              name: getFileName(url),
              type: getFileType(url),
              field: "Send Report",
            })
          }
          if ((req as any)["Print Report"]) {
            const url = (req as any)["Print Report"]
            all.push({
              url,
              name: getFileName(url),
              type: getFileType(url),
              field: "Print Report",
            })
          }
        }
        setAttachments(all)
      } catch (e) {
        console.error(e)
        toast({
          title: "Error",
          description: "Failed to fetch request details.",
          variant: "destructive",
        })
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchRequest()
  }, [requestId, user, userData, toast])

  // Keyboard navigation when gallery is open inline
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!galleryOpen || galleryItems.length === 0) return
      if (e.key === "ArrowRight") setGalleryIndex((i) => (i + 1) % galleryItems.length)
      if (e.key === "ArrowLeft") setGalleryIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length)
      if (e.key === "Escape") setGalleryOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [galleryOpen, galleryItems.length])

  // Fullscreen listeners
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  const handleBack = () => router.push("/finance/requests")

  const handleDownload = (att: Attachment) => {
    const a = document.createElement("a")
    a.href = att.url
    a.download = att.name
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleView = (att: Attachment) => {
    if (att.type === "image" || att.type === "video") {
      const idx = galleryItems.findIndex((g) => g.url === att.url)
      setGalleryIndex(Math.max(0, idx))
      setGalleryOpen(true)
      // Scroll into view
      setTimeout(() => viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0)
    } else if (att.type === "pdf") {
      setPdfPreview(att)
      // keep behavior inline; not required by user but does not interfere
    } else {
      // Document types: no preview; keep download-only behavior
      toast({
        title: "Preview not available",
        description: "This file type can only be downloaded.",
      })
    }
  }

  const toggleFullscreen = async () => {
    if (!viewerRef.current) return
    try {
      if (!document.fullscreenElement) {
        await viewerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error("Fullscreen toggle error", err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-muted rounded animate-pulse" />
          <div>
            <div className="h-8 bg-muted rounded w-48 animate-pulse" />
            <div className="h-4 bg-muted rounded w-32 mt-2 animate-pulse" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-32 animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-32 animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (notFound || !request) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Requests
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Request Not Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              The request you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Requests
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Requests
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Request #{request["Request No."]}</h1>
            <p className="text-muted-foreground">
              {request.request_type === "reimbursement" ? "Reimbursement" : "Requisition"} Request Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(request.Actions)}
          <Badge variant={getStatusBadgeVariant(request.Actions)}>{request.Actions}</Badge>
          {request.request_type === "replenish" && <ReplenishReportActions request={request} />}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Request Number</span>
              <span className="font-medium">#{request["Request No."]}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Type</span>
              <Badge variant={request.request_type === "reimbursement" ? "outline" : "secondary"}>
                {request.request_type}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Requestor</span>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{request.Requestor}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Amount</span>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-lg">{formatAmount(request.Amount, request.Currency || "PHP")}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Approved By</span>
              <span className="font-medium">{request["Approved By"] || "Not specified"}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Created Date</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {request.created ? format(request.created.toDate(), "MMM dd, yyyy HH:mm") : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Vendor Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Vendor Name</span>
              <span className="font-medium">{(request as any)["Vendor Name"] || "Not specified"}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">TIN No.</span>
              <span className="font-medium">{(request as any)["TIN No."] || "Not specified"}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium text-muted-foreground">Business Address</span>
              <span className="font-medium max-w-[60%] text-right">
                {(request as any)["Business Address"] || "Not specified"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Request Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Requested Item</span>
              <p className="mt-1 text-sm bg-muted p-3 rounded-md">{request["Requested Item"]}</p>
            </div>
            <Separator />
            {request.request_type === "reimbursement" && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Date Released</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {request["Date Released"]
                      ? format(request["Date Released"].toDate(), "MMM dd, yyyy")
                      : "Not specified"}
                  </span>
                </div>
              </div>
            )}
            {request.request_type === "requisition" && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Cashback</span>
                  <span className="font-medium">{formatAmount(request.Cashback || 0, request.Currency || "PHP")}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">O.R Number</span>
                  <span className="font-medium">{request["O.R No."] || "Not specified"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Invoice Number</span>
                  <span className="font-medium">{request["Invoice No."] || "Not specified"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Date Requested</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {request["Date Requested"]
                        ? format(request["Date Requested"].toDate(), "MMM dd, yyyy")
                        : "Not specified"}
                    </span>
                  </div>
                </div>
              </>
            )}
            {request.request_type === "replenish" && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Particulars</span>
                  <span className="font-medium max-w-[60%] text-right">{(request as any).Particulars}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Amount</span>
                  <span className="font-medium">{formatAmount(request.Amount, request.Currency || "PHP")}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                  <span className="font-medium">
                    {formatAmount((request as any)["Total Amount"] || 0, request.Currency || "PHP")}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Voucher No.</span>
                  <span className="font-medium">{(request as any)["Voucher No."] || "Not specified"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Management Approval</span>
                  <span className="font-medium">{(request as any)["Management Approval"] || "Pending"}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Date Requested</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {(request as any)["Date Requested"]
                        ? format((request as any)["Date Requested"].toDate(), "MMM dd, yyyy")
                        : "Not specified"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Attachments ({attachments.length})
            </CardTitle>
            <CardDescription>
              Click "View" to preview images or videos on the page, or "Download" to save locally
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Attachment list rows */}
              <div className="grid gap-4 md:grid-cols-2">
                {attachments.map((att, idx) => (
                  <div key={`${att.url}-${idx}`} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <IconForType type={att.type} className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate" title={att.name}>
                          {att.name}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize truncate">
                          {att.type} • {att.field}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(att)}
                        disabled={att.type === "document"}
                        title={att.type === "document" ? "Preview not available for this file type" : "View"}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(att)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Inline PDF preview (unchanged behavior; shown only when chosen) */}
              {pdfPreview && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Preview: {pdfPreview.name}</h4>
                    <Button variant="ghost" size="sm" onClick={() => setPdfPreview(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="h-96">
                      <iframe
                        src={`${pdfPreview.url}#toolbar=1&navpanes=1&scrollbar=1`}
                        className="w-full h-full border-0"
                        title={pdfPreview.name}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Image/Video Gallery Viewer */}
              {galleryOpen && galleryItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {galleryIndex + 1} / {galleryItems.length}
                      </span>
                      <span className="font-medium truncate max-w-[60vw]" title={galleryItems[galleryIndex].name}>
                        {galleryItems[galleryIndex].name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                        {isFullscreen ? <Shrink className="h-4 w-4 mr-2" /> : <Expand className="h-4 w-4 mr-2" />}
                        {isFullscreen ? "Exit full screen" : "Full screen"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setGalleryOpen(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Close
                      </Button>
                    </div>
                  </div>

                  <div
                    ref={viewerRef}
                    className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ minHeight: "360px" }}
                    aria-label="Media viewer"
                  >
                    {/* Media */}
                    <div className="max-h-[70vh] w-full flex items-center justify-center p-4">
                      {galleryItems[galleryIndex].type === "image" ? (
                        <img
                          src={
                            galleryItems[galleryIndex].url ||
                            "/placeholder.svg?height=300&width=600&query=image%20preview" ||
                            "/placeholder.svg" ||
                            "/placeholder.svg"
                          }
                          alt={galleryItems[galleryIndex].name}
                          className="mx-auto max-h-[70vh] max-w-full object-contain"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=300&width=600"
                          }}
                        />
                      ) : (
                        <video
                          controls
                          className="mx-auto max-h-[70vh] max-w-full"
                          src={galleryItems[galleryIndex].url}
                          onError={() =>
                            toast({
                              title: "Error",
                              description: "Unable to load video file.",
                              variant: "destructive",
                            })
                          }
                        />
                      )}
                    </div>

                    {/* Navigation */}
                    {galleryItems.length > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                          onClick={() => setGalleryIndex((i) => (i - 1 + galleryItems.length) % galleryItems.length)}
                          aria-label="Previous"
                        >
                          <ChevronLeft className="h-7 w-7" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                          onClick={() => setGalleryIndex((i) => (i + 1) % galleryItems.length)}
                          aria-label="Next"
                        >
                          <ChevronRight className="h-7 w-7" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {galleryItems.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pt-2">
                      {galleryItems.map((item, idx) => (
                        <button
                          key={item.url}
                          type="button"
                          onClick={() => setGalleryIndex(idx)}
                          className={`flex-shrink-0 rounded-md overflow-hidden border ${
                            idx === galleryIndex ? "ring-2 ring-foreground" : "border-border"
                          }`}
                          title={item.name}
                          aria-label={`Open ${item.name}`}
                        >
                          {item.type === "image" ? (
                            <img
                              src={item.url || "/placeholder.svg?height=72&width=96&query=thumbnail"}
                              alt={item.name}
                              className="h-18 w-24 object-cover"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=72&width=96"
                              }}
                            />
                          ) : (
                            <div className="h-18 w-24 bg-black/80 flex items-center justify-center text-white">
                              <Play className="h-6 w-6" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
