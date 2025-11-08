"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  User,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  Send,
  MoreHorizontal,
  History,
  Eye,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  getQuotationRequestById,
  updateQuotationRequest,
  getProductById,
  getQuotationsByRequestId,
  type QuotationRequest,
  type Product,
  type Quotation,
} from "@/lib/firebase-service"
import {
  createQuotation,
  generateQuotationNumber,
  calculateQuotationTotal,
  getQuotationById,
  generateQuotationPDF,
} from "@/lib/quotation-service"
import { SendQuotationDialog } from "@/components/send-quotation-dialog" // Import the new dialog
import { useAuth } from "@/contexts/auth-context" // Import useAuth
import { getClientByEmail } from "@/lib/client-service" // Import getClientByEmail

export default function QuotationRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user, userData } = useAuth() // Get current user and userData from AuthContext

  const [quotationRequest, setQuotationRequest] = useState<QuotationRequest | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [clientData, setClientData] = useState<any>(null) // Store client data including ID
  const [quotationHistory, setQuotationHistory] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [generateQuotationOpen, setGenerateQuotationOpen] = useState(false)
  const [quotationData, setQuotationData] = useState({
    price: "",
    notes: "",
    clientName: "",
    clientEmail: "",
  })
  const [isSendQuotationDialogOpen, setIsSendQuotationDialogOpen] = useState(false)
  const [quotationToSend, setQuotationToSend] = useState<Quotation | null>(null)

  // Helper function to safely convert any value to string
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return "N/A"
    if (typeof value === "string") return value
    if (typeof value === "number") return value.toString()
    if (typeof value === "boolean") return value.toString()
    if (value && typeof value === "object") {
      // Handle Firestore objects
      if (value.id) return value.id.toString()
      if (value.toString) return value.toString()
      return "N/A"
    }
    return String(value)
  }

  // Fetch quotation request, product, and client details
  useEffect(() => {
    const fetchData = async () => {
      if (!params.id) return

      setLoading(true)
      try {
        const requestId = Array.isArray(params.id) ? params.id[0] : params.id

        // Fetch quotation request
        const request = await getQuotationRequestById(requestId)
        if (!request) {
          toast({
            title: "Error",
            description: "Quotation request not found.",
            variant: "destructive",
          })
          router.push("/sales/quotation-requests")
          return
        }
        setQuotationRequest(request)

        // Fetch related product
        if (request.product_id) {
          const productData = await getProductById(request.product_id)
          setProduct(productData)

          // Initialize quotation data with product price
          setQuotationData((prev) => ({
            ...prev,
            price: productData?.price?.toString() || "",
          }))
        }

        // Fetch client data using email from quotation request
        if (request.email_address) {
          const client = await getClientByEmail(request.email_address)
          setClientData(client)
          // Initialize quotation data with client name and email
          setQuotationData((prev) => ({
            ...prev,
            clientName: client?.name || request.name || "",
            clientEmail: client?.email || request.email_address || "",
          }))
        } else {
          // If no email in request, still try to set client name from request
          setQuotationData((prev) => ({
            ...prev,
            clientName: request.name || "",
            clientEmail: "",
          }))
        }

        // Fetch quotation history
        setLoadingHistory(true)
        const quotations = await getQuotationsByRequestId(requestId)
        setQuotationHistory(quotations)
        setLoadingHistory(false)
      } catch (error) {
        console.error("Error fetching quotation request details:", error)
        toast({
          title: "Error",
          description: "Failed to load quotation request details.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, router, toast])

  // Helper functions
  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date)
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

  const formatDateTime = (date: any) => {
    if (!date) return "N/A"
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date)
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj)
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid Date"
    }
  }

  const convertToDate = (date: any): Date | null => {
    if (!date) return null
    try {
      return date.toDate ? date.toDate() : new Date(date)
    } catch (error) {
      console.error("Error converting date:", error)
      return null
    }
  }

  const calculateDuration = (startDate: any, endDate: any): number => {
    const start = convertToDate(startDate)
    const end = convertToDate(endDate)

    if (!start || !end) return 0

    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "approved":
        return "bg-green-100 text-green-800 border-green-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "sent":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "accepted":
        return "bg-green-100 text-green-800 border-green-200"
      case "expired":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "approved":
        return <CheckCircle className="h-4 w-4" />
      case "rejected":
        return <XCircle className="h-4 w-4" />
      case "sent":
        return <Send className="h-4 w-4" />
      case "draft":
        return <FileText className="h-4 w-4" />
      case "accepted":
        return <CheckCircle className="h-4 w-4" />
      case "expired":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!quotationRequest) return

    setUpdating(true)
    try {
      await updateQuotationRequest(quotationRequest.id, { status: newStatus.toUpperCase() })

      setQuotationRequest((prev) => (prev ? { ...prev, status: newStatus.toUpperCase() } : null))

      toast({
        title: "Status Updated",
        description: `Quotation request status changed to ${newStatus}.`,
      })
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleGenerateQuotation = async () => {
    if (!quotationRequest || !quotationData.price || !quotationData.clientName || !quotationData.clientEmail) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Price, Client Name, Client Email).",
        variant: "destructive",
      })
      return
    }

    if (!user || !user.uid) {
      toast({
        title: "Authentication Error",
        description: "User not logged in. Cannot create quotation.",
        variant: "destructive",
      })
      return
    }

    try {
      const pricePerDay = Number.parseFloat(quotationData.price)
      const startDate = convertToDate(quotationRequest.start_date)
      const endDate = convertToDate(quotationRequest.end_date)

      if (!startDate || !endDate) {
        toast({
          title: "Error",
          description: "Invalid date range.",
          variant: "destructive",
        })
        return
      }

      const { durationDays, totalAmount } = calculateQuotationTotal(
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
        pricePerDay,
      )

      const quotationNumber = generateQuotationNumber()

      const newQuotation = {
        quotation_number: quotationNumber,
        quotation_request_id: quotationRequest.id,
        product_id: quotationRequest.product_id,
        product_name: product?.name || "Unknown Product",
        product_location: product?.specs_rental?.location || product?.light?.location,
        site_code: product?.site_code,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        price: pricePerDay,
        total_amount: totalAmount,
        duration_days: durationDays,
        notes: quotationData.notes,
        status: "draft" as const,
        client_name: quotationData.clientName,
        client_email: quotationData.clientEmail,
        client_id: clientData?.id || undefined, // Pass client ID if available
        created_by: user.uid,
        created_by_first_name: userData?.first_name || "",
        created_by_last_name: userData?.last_name || "",
      }

      console.log("Final newQuotation object being sent:", newQuotation)

      const quotationId = await createQuotation(newQuotation)
      const savedQuotation = await getQuotationById(quotationId)

      if (savedQuotation) {
        setGenerateQuotationOpen(false)
        setQuotationToSend(savedQuotation)
        setIsSendQuotationDialogOpen(true)
      }

      const updatedQuotations = await getQuotationsByRequestId(quotationRequest.id)
      setQuotationHistory(updatedQuotations)

      toast({
        title: "Quotation Generated",
        description: `Quotation ${quotationNumber} has been created successfully.`,
      })
    } catch (error) {
      console.error("Error generating quotation:", error)
      toast({
        title: "Error",
        description: "Failed to generate quotation. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleQuotationSentSuccess = async (quotationId: string, newStatus: Quotation["status"]) => {
    await handleStatusUpdate(newStatus)
    if (quotationRequest) {
      const updatedQuotations = await getQuotationsByRequestId(quotationRequest.id)
      setQuotationHistory(updatedQuotations)
    }
    setIsSendQuotationDialogOpen(false)
  }

  const handleDownloadQuotation = async (quotation: Quotation) => {
    try {
      generateQuotationPDF(quotation)
      toast({
        title: "Download Started",
        description: `Downloading quotation ${quotation.quotation_number}.`,
      })
    } catch (error) {
      console.error("Error downloading quotation:", error)
      toast({
        title: "Error",
        description: "Failed to download quotation.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="flex items-center mb-6">
          <Skeleton className="h-9 w-20 mr-4" />
          <Skeleton className="h-8 w-64" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!quotationRequest) {
    return (
      <div className="container mx-auto px-6 py-12 text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Quotation Request Not Found</h2>
        <p className="text-gray-500 mb-6">
          The quotation request you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    )
  }

  const latestQuotation = quotationHistory.length > 0 ? quotationHistory[0] : null

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotation Request Details</h1>
            <p className="text-gray-600">Request from {safeString(quotationRequest.name)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={getStatusBadgeVariant(quotationRequest.status || "")}>
            <div className="flex items-center gap-1">
              {getStatusIcon(quotationRequest.status || "")}
              {quotationRequest.status || "Unknown"}
            </div>
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("approved")}
                disabled={quotationRequest.status?.toLowerCase() === "approved" || updating}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("rejected")}
                disabled={quotationRequest.status?.toLowerCase() === "rejected" || updating}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setGenerateQuotationOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Generate Quotation
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                  <p className="text-sm font-medium">{safeString(quotationRequest.name)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Position</Label>
                  <p className="text-sm font-medium">{safeString(quotationRequest.position)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Company</Label>
                  <p className="text-sm font-medium">{safeString(quotationRequest.company)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                  <p className="text-sm font-medium break-all">{safeString(quotationRequest.email_address)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Contact Number</Label>
                  <p className="text-sm font-medium">{safeString(quotationRequest.contact_number)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Company Address</Label>
                  <p className="text-sm font-medium">{safeString(quotationRequest.company_address)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Information */}
          {product && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Product Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Product Name</Label>
                    <p className="text-sm font-medium">{safeString(product.name)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Product Type</Label>
                    <p className="text-sm font-medium">{safeString(product.type)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Location</Label>
                    <p className="text-sm font-medium">
                      {safeString(product.specs_rental?.location || product.light?.location)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Site Code</Label>
                    <p className="text-sm font-medium">{safeString(product.site_code)}</p>
                  </div>
                  {product.price && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Listed Price</Label>
                      <p className="text-sm font-medium text-green-600">₱{Number(product.price).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rental Period */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Rental Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                  <p className="text-sm font-medium">{formatDate(quotationRequest.start_date)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">End Date</Label>
                  <p className="text-sm font-medium">{formatDate(quotationRequest.end_date)}</p>
                </div>
              </div>

              {quotationRequest.start_date && quotationRequest.end_date && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Duration:</strong>{" "}
                    {calculateDuration(quotationRequest.start_date, quotationRequest.end_date)} days
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quotation History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Quotation History
                <Badge variant="secondary" className="ml-2">
                  {quotationHistory.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : quotationHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Quotations Generated</h3>
                  <p className="text-gray-500 mb-4">No quotations have been generated for this request yet.</p>
                  <Button onClick={() => setGenerateQuotationOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate First Quotation
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotationHistory.map((quotation) => (
                        <TableRow key={quotation.id}>
                          <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusBadgeVariant(quotation.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(quotation.status)}
                                {quotation.status}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-green-600">
                            ₱{quotation.total_amount?.toLocaleString() || "0"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{formatDateTime(quotation.created)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleDownloadQuotation(quotation)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleDownloadQuotation(quotation)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setQuotationToSend(quotation) // Set the current quotation to be sent
                                      setIsSendQuotationDialogOpen(true) // Open the send dialog
                                    }}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send to Client
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => setGenerateQuotationOpen(true)}
                disabled={quotationRequest.status?.toLowerCase() === "rejected"}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Quotation
              </Button>

              {latestQuotation && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setQuotationToSend(latestQuotation)
                    setIsSendQuotationDialogOpen(true)
                  }}
                  disabled={quotationRequest.status?.toLowerCase() === "rejected"}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Latest Quotation
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate("approved")}
                  disabled={quotationRequest.status?.toLowerCase() === "approved" || updating}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate("rejected")}
                  disabled={quotationRequest.status?.toLowerCase() === "rejected" || updating}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>

              <Separator />

              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </CardContent>
          </Card>

          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-500">Request ID</Label>
                <p className="text-sm font-mono">{safeString(quotationRequest.id)}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500">Product Reference</Label>
                <p className="text-sm font-mono">{safeString(quotationRequest.product_ref)}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500">Submitted</Label>
                <p className="text-sm">{formatDateTime(quotationRequest.created)}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-500">Status</Label>
                <Badge variant="outline" className={getStatusBadgeVariant(quotationRequest.status || "")}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(quotationRequest.status || "")}
                    {safeString(quotationRequest.status)}
                  </div>
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quotation Summary */}
          {quotationHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quotation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Total Quotations</Label>
                  <p className="text-sm font-medium">{quotationHistory.length}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Latest Quotation</Label>
                  <p className="text-sm font-medium">{latestQuotation?.quotation_number || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Latest Amount</Label>
                  <p className="text-sm font-medium text-green-600">
                    ₱{latestQuotation?.total_amount?.toLocaleString() || "0"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Generate Quotation Dialog */}
      <Dialog open={generateQuotationOpen} onOpenChange={setGenerateQuotationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Quotation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={quotationData.clientName}
                onChange={(e) => setQuotationData((prev) => ({ ...prev, clientName: e.target.value }))}
                placeholder="Client name"
              />
            </div>

            <div>
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={quotationData.clientEmail}
                onChange={(e) => setQuotationData((prev) => ({ ...prev, clientEmail: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>

            <div>
              <Label htmlFor="price">Price per Day (₱)</Label>
              <Input
                id="price"
                type="number"
                value={quotationData.price}
                onChange={(e) => setQuotationData((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={quotationData.notes}
                onChange={(e) => setQuotationData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes or terms..."
                rows={3}
              />
            </div>

            {quotationData.price && quotationRequest.start_date && quotationRequest.end_date && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Quotation Summary:</p>
                <p className="text-sm">
                  <strong>Duration:</strong> {calculateDuration(quotationRequest.start_date, quotationRequest.end_date)}{" "}
                  days
                </p>
                <p className="text-sm">
                  <strong>Total Amount:</strong> ₱
                  {(
                    Number.parseFloat(quotationData.price) *
                    calculateDuration(quotationRequest.start_date, quotationRequest.end_date)
                  ).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateQuotationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateQuotation} disabled={!quotationData.price || !quotationData.clientName}>
              Generate Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Send Quotation Dialog */}
      {quotationToSend && quotationRequest && (
        <SendQuotationDialog
          isOpen={isSendQuotationDialogOpen}
          onClose={() => setIsSendQuotationDialogOpen(false)}
          quotation={quotationToSend}
          requestorEmail={quotationRequest.email_address}
          onQuotationSent={handleQuotationSentSuccess}
        />
      )}
    </div>
  )
}
