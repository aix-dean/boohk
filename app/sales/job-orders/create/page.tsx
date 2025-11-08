"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  CalendarIcon,
  Plus,
  Loader2,
  AlertCircle,
  FileText,
  ImageIcon,
  XCircle,
  Package,
  CircleCheck,
  Upload,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  createMultipleJobOrders,
  getBookingDetailsForJobOrder,
  generatePersonalizedJONumber,
} from "@/lib/job-order-service"
import { getQuotationById } from "@/lib/quotation-service"
import { generateJobOrderPDF } from "@/lib/job-order-pdf-generator"
import { updateQuotation } from "@/lib/quotation-service" // Import updateQuotation
import type { QuotationProduct } from "@/lib/types/quotation" // Corrected import for QuotationProduct
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { bookingService } from "@/lib/booking-service"
import type { JobOrderType, JobOrderStatus } from "@/lib/types/job-order"
import type { Booking } from "@/lib/booking-service"
import type { Product } from "@/lib/firebase-service"
import { type Client, updateClient, updateClientCompany, type ClientCompany, getClientCompanyById, createNotifications } from "@/lib/client-service" // Import updateClient, updateClientCompany, ClientCompany, and getClientCompanyById
import { cn, getProjectCompliance } from "@/lib/utils"
import { JobOrderCreatedSuccessDialog } from "@/components/job-order-created-success-dialog"
import { ComingSoonModal } from "@/components/coming-soon-dialog"
import { ComplianceConfirmationDialog } from "@/components/compliance-confirmation-dialog"
import { ComplianceDialog } from "@/components/compliance-dialog"
import { serverTimestamp, Timestamp } from "firebase/firestore"


interface JobOrderFormData {
  joNumber: string
  joType: JobOrderType | ""
  dateRequested: Date | undefined
  deadline: Date | undefined
  campaignName: string // Added campaign name
  remarks: string
  attachmentFile: File | null
  attachmentUrl: string | null
  uploadingAttachment: boolean
  attachmentError: string | null
  materialSpec: string
  materialSpecAttachmentFile: File | null
  materialSpecAttachmentUrl: string | null
  uploadingMaterialSpecAttachment: boolean
  materialSpecAttachmentError: string | null
  joTypeError: boolean
  dateRequestedError: boolean
}

// Helper function to safely parse date values
const safeToDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

export default function CreateJobOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("bookingId")
  const { user, userData } = useAuth()
  const { toast } = useToast()

  // All state declarations first
  const [loading, setLoading] = useState(true)
  const [bookingData, setBookingData] = useState<{
    booking: Booking
    products: Product[]
    client: ClientCompany | null // This should be ClientCompany
  } | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Client Compliance states
  const [dtiBirFile, setDtiBirFile] = useState<File | null>(null)
  const [dtiBirUrl, setDtiBirUrl] = useState<string | null>(null)
  const [uploadingDtiBir, setUploadingDtiBir] = useState(false)
  const [dtiBirError, setDtiBirError] = useState<string | null>(null)

  const [gisFile, setGisFile] = useState<File | null>(null)
  const [gisUrl, setGisUrl] = useState<string | null>(null)
  const [uploadingGis, setUploadingGis] = useState(false)
  const [gisError, setGisError] = useState<string | null>(null)

  const [idSignatureFile, setIdSignatureFile] = useState<File | null>(null)
  const [idSignatureUrl, setIdSignatureUrl] = useState<string | null>(null)
  const [uploadingIdSignature, setUploadingIdSignature] = useState(false)
  const [idSignatureError, setIdSignatureError] = useState<string | null>(null)


  // Project Compliance states
  const [signedQuotationFile, setSignedQuotationFile] = useState<File | null>(null)
  const [signedQuotationUrl, setSignedQuotationUrl] = useState<string | null>(null)
  const [uploadingSignedQuotation, setUploadingSignedQuotation] = useState(false)
  const [signedQuotationError, setSignedQuotationError] = useState<string | null>(null)

  const [signedContractFile, setSignedContractFile] = useState<File | null>(null)
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null)
  const [uploadingSignedContract, setUploadingSignedContract] = useState(false)
  const [signedContractError, setSignedContractError] = useState<string | null>(null)

  const [poMoFile, setPoMoFile] = useState<File | null>(null)
  const [poMoUrl, setPoMoUrl] = useState<string | null>(null)
  const [uploadingPoMo, setUploadingPoMo] = useState(false)
  const [poMoError, setPoMoError] = useState<string | null>(null)

  const [finalArtworkFile, setFinalArtworkFile] = useState<File | null>(null)
  const [finalArtworkUrl, setFinalArtworkUrl] = useState<string | null>(null)
  const [uploadingFinalArtwork, setUploadingFinalArtwork] = useState(false)
  const [finalArtworkError, setFinalArtworkError] = useState<string | null>(null)

  const [paymentAdvanceConfirmed, setPaymentAdvanceConfirmed] = useState(false)

  // Form data for each product
  const [jobOrderForms, setJobOrderForms] = useState<JobOrderFormData[]>([])


  // Coming soon dialog state
  const [showComingSoonDialog, setShowComingSoonDialog] = useState(false)

  // Compliance confirmation dialog state
  const [showComplianceDialog, setShowComplianceDialog] = useState(false)
  const [pendingJobOrderStatus, setPendingJobOrderStatus] = useState<JobOrderStatus | null>(null)

  // Compliance dialog state
  const [showComplianceDialogNew, setShowComplianceDialogNew] = useState(false)
  const [selectedQuotationForCompliance, setSelectedQuotationForCompliance] = useState<any>(null)
  const [uploadingFiles, setUploadingFiles] = useState(new Set<string>());

  // View Quote button loading state for specific quotation ID
  const [isViewQuoteLoading, setIsViewQuoteLoading] = useState(false)

  // Calculate derived values using useMemo - these will always be called


  const missingCompliance = useMemo(() => {
    const projectCompliance = bookingData?.booking?.projectCompliance
    return {
      dtiBir: !dtiBirUrl && !bookingData?.client?.compliance?.dti,
      gis: !gisUrl && !bookingData?.client?.compliance?.gis,
      idSignature: !idSignatureUrl && !bookingData?.client?.compliance?.id,
      signedQuotation: !signedQuotationUrl && !projectCompliance?.signedQuotation?.fileUrl,
      signedContract: !signedContractUrl && !projectCompliance?.signedContract?.fileUrl,
      poMo: !poMoUrl && !projectCompliance?.irrevocablePo?.fileUrl,
      finalArtwork: !finalArtworkUrl && !projectCompliance?.finalArtwork?.fileUrl,
      paymentAdvance: !paymentAdvanceConfirmed && !projectCompliance?.paymentAsDeposit?.fileUrl,
    }
  }, [
    dtiBirUrl,
    gisUrl,
    idSignatureUrl,
    signedQuotationUrl,
    signedContractUrl,
    poMoUrl,
    finalArtworkUrl,
    paymentAdvanceConfirmed,
    bookingData?.client?.compliance?.dti,
    bookingData?.client?.compliance?.gis,
    bookingData?.client?.compliance?.id,
    bookingData?.booking?.projectCompliance, // Depend on the whole object
  ])

  // Calculate duration in months
  const totalDays = useMemo(() => {
    if (!bookingData?.booking) return 0 // Default to 0 days if no booking data
    const booking = bookingData.booking
    return booking.costDetails?.days || 0 // Use days from costDetails
  }, [bookingData])

  // Calculate individual product totals for display
  const productTotals = useMemo(() => {
    if (!bookingData) return []

    const booking = bookingData.booking
    const products = bookingData.products // Access products here

    // Always treat as a single product from booking object
    const subtotal = booking.total_cost || 0 // Use total_cost for single product
    const vat = subtotal * 0.12 // Recalculate VAT based on new subtotal
    const total = subtotal + vat // Recalculate total

    const monthlyRate =
      booking.costDetails?.days && booking.costDetails.days > 0
        ? subtotal / (booking.costDetails.days / 30) // Approximate monthly rate
        : 0

    return [
      {
        subtotal,
        vat,
        total,
        monthlyRate: monthlyRate,
        siteCode: products[0]?.site_code || "N/A", // Get from product
        productName: products[0]?.name || booking.product_name || "N/A", // Get from product or booking
      },
    ]
  }, [bookingData])

  // Calculate overall totals
  const overallTotal = useMemo(() => {
    return productTotals.reduce((sum, product) => sum + product.total, 0)
  }, [productTotals])

  // Extract content_type from booking data
  const contentType = useMemo(() => {
    return bookingData?.products[0]?.content_type || "static"
  }, [bookingData])

  // Dynamic JO type options based on content_type
  const joTypeOptions = useMemo(() => {
    if (contentType === "static") {
      return ["Roll down", "Roll up", "Change Material", "Monitoring", "Other"]
    } else if (contentType === "dynamic") {
      return ["Publish", "Change Material", "Monitoring", "Other"]
    } else {
      return ["Roll down", "Roll up", "Change Material", "Monitoring", "Other"]
    }
  }, [contentType])

  // Dynamic material spec options based on content_type
  const materialSpecOptions = useMemo(() => {
    if (contentType === "static") {
      return ["Tarpaulin", "Sticker", "Other"]
    } else if (contentType === "dynamic") {
      return ["Digital File"]
    } else {
      return ["Tarpaulin", "Sticker", "Other"]
    }
  }, [contentType])
  console.log("product totals :", productTotals)
  // All useCallback hooks
  const formatCurrency = useCallback((amount: number | undefined) => {
    if (amount === undefined || amount === null || amount === 0) return "N/A"
    return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [])


  const formatPeriod = useCallback(
    (startDate?: Date | Timestamp | null, endDate?: Date | Timestamp | null) => {
      if (!startDate || !endDate) return "N/A"

      const start = startDate instanceof Timestamp
        ? startDate.toDate()
        : startDate instanceof Date
          ? startDate
          : new Date(startDate)

      const end = endDate instanceof Timestamp
        ? endDate.toDate()
        : endDate instanceof Date
          ? endDate
          : new Date(endDate)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn("Invalid date inputs:", startDate, endDate)
        return "Invalid Dates"
      }

      return `${format(start, "MMM dd, yyyy")} to ${format(end, "MMM dd, yyyy")}`
    },
    []
  )

  const isImageFile = useCallback((fileName: string | null, fileUrl: string | null) => {
    if (!fileName && !fileUrl) return false;

    // Pick fileName if provided, otherwise extract from URL
    let name = fileName || "";

    if (!name && fileUrl) {
      // Remove query params (?alt=...)
      const cleanUrl = fileUrl.split("?")[0];
      // Decode %20 etc.
      const decodedUrl = decodeURIComponent(cleanUrl);
      // Get the last part after /
      name = decodedUrl.split("/").pop() || "";
    }

    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];
    return imageExtensions.some(ext => name.toLowerCase().endsWith(ext));
  }, []);

  const getFileNameFromUrl = useCallback((fileUrl: string | null) => {
    if (!fileUrl) return null;

    // Remove query params (?alt=...)
    const cleanUrl = fileUrl.split("?")[0];
    // Decode %20 etc.
    const decodedUrl = decodeURIComponent(cleanUrl);
    // Get the last part after /
    return decodedUrl.split("/").pop() || null;
  }, []);

  const handleFileUpload = useCallback(
    async (
      file: File,
      type: "image" | "document",
      setFileState: React.Dispatch<React.SetStateAction<File | null>>,
      setUrlState: React.Dispatch<React.SetStateAction<string | null>>,
      setUploadingState: React.Dispatch<React.SetStateAction<boolean>>,
      setErrorState: React.Dispatch<React.SetStateAction<string | null>>,
      path: string,
      clientId?: string, // Optional client ID
      fieldToUpdate?: string, // Optional field to update in client document
    ) => {
      setUploadingState(true)
      setErrorState(null)
      setUrlState(null)

      const allowedImageTypes = ["image/jpeg", "image/png", "image/gif"]
      const allowedDocumentTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ]
      const maxSize = 5 * 1024 * 1024 // 5MB

      if (file.size > maxSize) {
        setErrorState("File size exceeds 5MB limit.")
        setUploadingState(false)
        return
      }

      if (type === "image" && !allowedImageTypes.includes(file.type)) {
        setErrorState("Invalid image file type. Only JPG, PNG, GIF are allowed.")
        setUploadingState(false)
        return
      }

      if (type === "document" && !allowedDocumentTypes.includes(file.type)) {
        setErrorState("Invalid document file type. Only PDF, DOC, DOCX, XLS, XLSX are allowed.")
        setUploadingState(false)
        return
      }

      try {
        const downloadURL = await uploadFileToFirebaseStorage(file, path)
        setUrlState(downloadURL)
        setFileState(file)

        // Prioritize updating client company compliance if clientId and a recognized fieldToUpdate are present
        // Handle project compliance updates for booking documents
        if (bookingId && fieldToUpdate && (fieldToUpdate === "signedQuotation" || fieldToUpdate === "signedContract" || fieldToUpdate === "poMo" || fieldToUpdate === "finalArtwork" || fieldToUpdate === "paymentAsDeposit")) {
          console.log("handleFileUpload: Attempting to update project compliance for booking.");
          console.log("handleFileUpload: bookingId:", bookingId);
          console.log("handleFileUpload: fieldToUpdate:", fieldToUpdate);
          // Handle project compliance updates for the quotation document
          let projectComplianceFieldKey:
            | "signedQuotation"
            | "signedContract"
            | "irrevocablePo"
            | "finalArtwork"
            | "paymentAsDeposit"
            | undefined

          if (fieldToUpdate === "signedQuotation") {
            projectComplianceFieldKey = "signedQuotation"
          } else if (fieldToUpdate === "signedContract") {
            projectComplianceFieldKey = "signedContract"
          } else if (fieldToUpdate === "poMo") {
            projectComplianceFieldKey = "irrevocablePo"
          } else if (fieldToUpdate === "finalArtwork") {
            projectComplianceFieldKey = "finalArtwork"
          } else if (fieldToUpdate === "paymentAsDeposit") {
            projectComplianceFieldKey = "paymentAsDeposit"
          }

          if (projectComplianceFieldKey) {
            // Get the current project compliance from booking data or use empty object with proper typing
            const currentProjectCompliance = bookingData?.booking?.projectCompliance || {
              finalArtwork: {
                fileName: null,
                fileUrl: null,
                notes: null,
                uploadedAt: null,
                uploadedBy: null,
                status: "pending"
              },
              paymentAsDeposit: {
                fileName: null,
                fileUrl: null,
                notes: null,
                uploadedAt: null,
                uploadedBy: null,
                status: "pending"
              },
              irrevocablePo: {
                fileName: null,
                fileUrl: null,
                notes: null,
                uploadedAt: null,
                uploadedBy: null,
                status: "pending"
              },
              signedContract: {
                fileName: null,
                fileUrl: null,
                notes: null,
                uploadedAt: null,
                uploadedBy: null,
                status: "pending"
              },
              signedQuotation: {
                fileName: null,
                fileUrl: null,
                notes: null,
                uploadedAt: null,
                uploadedBy: null,
                status: "pending"
              },
            }

            // Get the existing field data with proper type safety
            const existingField = currentProjectCompliance[projectComplianceFieldKey]
            const existingFieldData = existingField

            const updatedProjectCompliance = {
              ...currentProjectCompliance, // Spread the fully initialized object
              [projectComplianceFieldKey]: {
                // Preserve existing field data if it exists, otherwise create new object with defaults
                ...(existingFieldData || {
                  fileName: null,
                  fileUrl: null,
                  notes: null,
                  uploadedAt: null,
                  uploadedBy: null,
                  status: "pending"
                }),
                fileName: file.name,
                fileUrl: downloadURL,
                uploadedAt: new Date().toISOString(),
                uploadedBy: user?.uid || null,
                ...(projectComplianceFieldKey === "signedQuotation" && { status: "completed" }), // Add status for signedQuotation
              },
            }

            await bookingService.updateBookingProjectCompliance(bookingId, updatedProjectCompliance)

            // Update local bookingData to reflect the change
            setBookingData(prev => prev ? { ...prev, booking: { ...prev.booking, projectCompliance: updatedProjectCompliance } } : null)

            toast({
              title: "Project Compliance Document Updated",
              description: `Booking's ${fieldToUpdate} updated successfully.`,
            })
          } else {
            console.warn(`Unknown project compliance field to update: ${fieldToUpdate}`)
            toast({
              title: "Update Failed",
              description: `Could not update project compliance for unknown field: ${fieldToUpdate}.`,
              variant: "destructive",
            })
          }
        } else if (clientId && (fieldToUpdate === "dti_bir_2303_url" || fieldToUpdate === "gis_url" || fieldToUpdate === "id_signature_url")) {
          // Handle client company compliance updates
          const clientCompanyId = clientId; // Use the clientId passed as a parameter
          const existingClientCompany = await getClientCompanyById(clientCompanyId);
          console.log("Existing client company document:", existingClientCompany);
          const existingCompliance = existingClientCompany?.compliance || {};
          console.log("Existing compliance:", existingCompliance);

          let complianceFieldKey: "dti" | "gis" | "id" | undefined;

          if (fieldToUpdate === "dti_bir_2303_url") {
            complianceFieldKey = "dti";
          } else if (fieldToUpdate === "gis_url") {
            complianceFieldKey = "gis";
          } else if (fieldToUpdate === "id_signature_url") {
            complianceFieldKey = "id";
          }

          if (complianceFieldKey) {
            const updatedCompliance = {
              ...existingCompliance, // Preserve existing compliance fields from the fetched document
              [complianceFieldKey]: downloadURL, // Update the specific field
            };
            console.log("Updated compliance object:", updatedCompliance);
            console.log("client company ID used for update:", clientCompanyId);
            try {
              await updateClientCompany(clientCompanyId, { // Use clientCompanyId here
                compliance: updatedCompliance,
              });
              toast({
                title: "Client Company Document Updated",
                description: `Client company's ${fieldToUpdate} updated successfully.`,
              });
            } catch (updateError: any) {
              console.error("Error during updateClientCompany:", updateError);
              toast({
                title: "Update Failed",
                description: `Failed to update client company compliance: ${updateError.message || "Unknown error"}.`,
                variant: "destructive",
              });
            }
          } else {
            // This else block should ideally not be reached if the outer if condition is met
            console.warn(`handleFileUpload: Unexpected: complianceFieldKey not identified for fieldToUpdate: ${fieldToUpdate}`);
          }
        } else if (clientId && fieldToUpdate) {
          // Fallback to updating the individual client document if no client_company_id
          await updateClient(clientId, { [fieldToUpdate]: downloadURL })
          toast({
            title: "Client Document Updated",
            description: `Client's ${fieldToUpdate} updated successfully.`,
          })
        }

        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`,
        })
      } catch (error: any) {
        console.error("Upload failed:", error)
        setErrorState(`Upload failed: ${error.message || "Unknown error"}`)
        toast({
          title: "Upload Failed",
          description: `Could not upload ${file.name}. ${error.message || "Please try again."}`,
          variant: "destructive",
        })
      } finally {
        setUploadingState(false)
      }
    },
    [bookingData, bookingId, toast, user?.uid, userData?.first_name],
  )

  const handleFormUpdate = useCallback((productIndex: number, field: keyof JobOrderFormData, value: any) => {
    setJobOrderForms((prev) => {
      const updated = [...prev]
      if (updated[productIndex]) {
        updated[productIndex] = { ...updated[productIndex], [field]: value }
      }
      return updated
    })
  }, [])

  const handleProductAttachmentUpload = useCallback(
    async (productIndex: number, file: File) => {
      handleFormUpdate(productIndex, "uploadingAttachment", true)
      handleFormUpdate(productIndex, "attachmentError", null)
      handleFormUpdate(productIndex, "attachmentUrl", null)

      try {
        const downloadURL = await uploadFileToFirebaseStorage(file, `attachments/job-orders/product-${productIndex}/`)
        handleFormUpdate(productIndex, "attachmentUrl", downloadURL)
        handleFormUpdate(productIndex, "attachmentFile", file)
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`,
        })
      } catch (error: any) {
        console.error("Upload failed:", error)
        handleFormUpdate(productIndex, "attachmentError", `Upload failed: ${error.message || "Unknown error"}`)
        toast({
          title: "Upload Failed",
          description: `Could not upload ${file.name}. ${error.message || "Please try again."}`,
          variant: "destructive",
        })
      } finally {
        handleFormUpdate(productIndex, "uploadingAttachment", false)
      }
    },
    [handleFormUpdate, toast],
  )

  const handleMaterialSpecAttachmentUpload = useCallback(
    async (productIndex: number, file: File) => {
      handleFormUpdate(productIndex, "uploadingMaterialSpecAttachment", true)
      handleFormUpdate(productIndex, "materialSpecAttachmentError", null)
      handleFormUpdate(productIndex, "materialSpecAttachmentUrl", null)

      try {
        const downloadURL = await uploadFileToFirebaseStorage(file, `attachments/job-orders/material-spec-${productIndex}/`)
        handleFormUpdate(productIndex, "materialSpecAttachmentUrl", downloadURL)
        handleFormUpdate(productIndex, "materialSpecAttachmentFile", file)
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`,
        })
      } catch (error: any) {
        console.error("Upload failed:", error)
        handleFormUpdate(productIndex, "materialSpecAttachmentError", `Upload failed: ${error.message || "Unknown error"}`)
        toast({
          title: "Upload Failed",
          description: `Could not upload ${file.name}. ${error.message || "Please try again."}`,
          variant: "destructive",
        })
      } finally {
        handleFormUpdate(productIndex, "uploadingMaterialSpecAttachment", false)
      }
    },
    [handleFormUpdate, toast],
  )

  const validateForms = useCallback((): boolean => {
    let hasError = false

    jobOrderForms.forEach((form, index) => {
      if (!form.joType || !joTypeOptions.includes(form.joType)) {
        handleFormUpdate(index, "joTypeError", true)
        hasError = true
      } else {
        handleFormUpdate(index, "joTypeError", false)
      }

      // Check and reset materialSpec if invalid
      if (form.materialSpec && !materialSpecOptions.includes(form.materialSpec)) {
        handleFormUpdate(index, "materialSpec", "")
      }

      if (!form.dateRequested) {
        handleFormUpdate(index, "dateRequestedError", true)
        hasError = true
      } else {
        handleFormUpdate(index, "dateRequestedError", false)
      }

      if (!form.deadline) {
        hasError = true
      }
    })

    return !hasError
  }, [jobOrderForms, handleFormUpdate, joTypeOptions, materialSpecOptions])

  const createJobOrdersWithStatus = useCallback(
    async (status: JobOrderStatus) => {
      if (!bookingData || !user?.uid) {
        toast({
          title: "Missing Information",
          description: "Cannot create Job Orders due to missing data or user authentication.",
          variant: "destructive",
        })
        return
      }

      setIsSubmitting(true)

      try {
        const booking = bookingData.booking
        const products = bookingData.products
        const client = bookingData.client

        let jobOrdersData = []

        // Single product from quotation object
        const form = jobOrderForms[0]
        const product = products[0] || {}

        // Fetch the original quotation number from the quotation that created this booking
        // Get the quotation number from the booking data (stored when booking was created)
        let originalQuotationNumber = booking.quotation_number || ""
        if (booking.quotation_id) {
          try {
            const originalQuotation = await getQuotationById(booking.quotation_id)
            if (originalQuotation) {
              originalQuotationNumber = originalQuotation.quotation_number
            }
          } catch (error) {
            console.warn("Could not fetch original quotation for quotation number:", error)
          }
        }

        // DEBUG: Log all date/time values before processing
        console.log("[DEBUG] Date/Time values in job order creation:")
        console.log("- Current time:", new Date().toISOString())
        console.log("- Form dateRequested:", form.dateRequested, "Type:", typeof form.dateRequested)
        console.log("- Form deadline:", form.deadline, "Type:", typeof form.deadline)
        console.log("- Booking start_date:", booking.start_date, "Type:", typeof booking.start_date, "Raw value:", booking.start_date)
        console.log("- Booking end_date:", booking.end_date, "Type:", typeof booking.end_date, "Raw value:", booking.end_date)
        console.log("- Original quotation number:", originalQuotationNumber)

        // Validate date objects
        const createdDate = new Date()
        console.log("- Created date object:", createdDate, "Is valid:", !isNaN(createdDate.getTime()))

        let contractPeriodStart = null
        let contractPeriodEnd = null

        if (booking.start_date) {
          try {
            // Handle Firestore Timestamp objects
            if (booking.start_date && typeof booking.start_date === 'object' && 'toDate' in booking.start_date) {
              contractPeriodStart = booking.start_date.toDate()
            } else {
              contractPeriodStart = new Date(booking.start_date)
            }
            console.log("- Contract period start parsed:", contractPeriodStart, "Is valid:", !isNaN(contractPeriodStart.getTime()))
          } catch (error) {
            console.error("- Error parsing contractPeriodStart:", error)
            contractPeriodStart = null
          }
        }

        if (booking.end_date) {
          try {
            // Handle Firestore Timestamp objects
            if (booking.end_date && typeof booking.end_date === 'object' && 'toDate' in booking.end_date) {
              contractPeriodEnd = booking.end_date.toDate()
            } else {
              contractPeriodEnd = new Date(booking.end_date)
            }
            console.log("- Contract period end parsed:", contractPeriodEnd, "Is valid:", !isNaN(contractPeriodEnd.getTime()))
          } catch (error) {
            console.error("- Error parsing contractPeriodEnd:", error)
            contractPeriodEnd = null
          }
        }

        // Check form dates
        if (form.dateRequested) {
          console.log("- Form dateRequested valid:", !isNaN(form.dateRequested.getTime()), "Value:", form.dateRequested.toISOString())
        } else {
          console.warn("- Form dateRequested is null/undefined")
        }

        if (form.deadline) {
          console.log("- Form deadline valid:", !isNaN(form.deadline.getTime()), "Value:", form.deadline.toISOString())
        } else {
          console.warn("- Form deadline is null/undefined")
        }

        const contractDuration = totalDays > 0 ? `(${totalDays} days)` : "N/A" // Use totalDays

        const subtotal = booking.total_cost || 0 // Use total_cost for single product
        const productVat = subtotal * 0.12 // Recalculate VAT
        const productTotal = subtotal + productVat // Recalculate total

        jobOrdersData = [
          {
            quotationId: booking.quotation_id || booking.id, // Use quotation_id if available, else booking id
            booking_id: booking.id, // Add booking_id
            created: createdDate,
            joNumber: form.joNumber || await generatePersonalizedJONumber(userData), // Use input JO# if provided, else generate
            dateRequested: form.dateRequested!,
            joType: form.joType as JobOrderType,
            deadline: form.deadline!,
            campaignName: form.campaignName, // Added campaign name
            requestedBy: `${userData?.first_name} ${userData?.last_name}` || "Auto-Generated",
            remarks: form.remarks,
            attachments: form.materialSpecAttachmentUrl ? { name: form.materialSpecAttachmentFile?.name || "Attachment", type: form.materialSpecAttachmentFile?.type || "image", url: form.materialSpecAttachmentUrl } : null,
            materialSpec: form.materialSpec,
            materialSpecAttachmentUrl: form.materialSpecAttachmentUrl,
            clientCompliance: {
              dtiBirUrl: dtiBirUrl, // Added client compliance
              gisUrl: gisUrl, // Added client compliance
              idSignatureUrl: idSignatureUrl,
            }, // Initialize empty clientCompliance
            quotationNumber: originalQuotationNumber || booking.reservation_id, // Use original quotation number, fallback to reservation_id
            reservation_number: booking.reservation_id, // Include reservation number from booking
            clientName: client?.name || "N/A",
            clientCompany: booking.client?.company_name || "N/A", // Use company_name from booking client
            clientCompanyId: booking.client?.company_id || "",
            clientId: client?.id || "",
            client_email: (client as any)?.email || "",
            contractDuration: totalDays.toString(), // Convert to string as expected by type
            contractPeriodStart: contractPeriodStart || undefined,
            contractPeriodEnd: contractPeriodEnd || undefined,
            siteLocation: products[0]?.location || "N/A", // Get from product
            siteName: products[0]?.name || "", // Get from product
            siteCode: products[0]?.site_code || "N/A", // Get from product
            siteType: contentType || "N/A",
            siteSize: `${products[0]?.specs_rental?.height || 0}ft (h)  x ${products[0]?.specs_rental?.width || 0}ft (w)`, // Get from product specs
            siteIllumination: products[0]?.light ? "Yes" : "No", // Use product light as boolean
            illumination: typeof products[0]?.specs_rental?.illumination === 'object'
              ? "Custom Illumination Setup"
              : products[0]?.specs_rental?.illumination || "N/A", // Use product illumination specs
            leaseRatePerMonth:
              booking.costDetails?.days && booking.costDetails.days > 0
                ? subtotal / (booking.costDetails.days / 30)
                : 0, // Corrected monthlyRate
            totalMonths: totalDays / 30, // This might still be relevant for other calculations, but not for totalLease directly
            totalLease: subtotal, // totalLease is now the subtotal
            vatAmount: productVat, // Use recalculated VAT
            totalAmount: productTotal, // Use recalculated total
            siteImageUrl: products[0]?.media?.[0]?.url || "/placeholder.svg?height=48&width=48", // Get from product media array
            missingCompliance: missingCompliance,
            product_id: booking.product_id || "",
            company_id: userData?.company_id || "",
            created_by: user.uid, // Added created_by
            content_type: contentType, // Added content_type
            projectCompliance: { // Construct projectCompliance object
              signedQuotation: {
                fileName: signedQuotationFile?.name || null,
                fileUrl: signedQuotationUrl,
                notes: null,
                uploadedAt: signedQuotationUrl ? serverTimestamp() : null,
                uploadedBy: user?.uid || null,
                status: (signedQuotationUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
              },
              signedContract: {
                fileName: signedContractFile?.name || null,
                fileUrl: signedContractUrl,
                notes: null,
                uploadedAt: signedContractUrl ? serverTimestamp() : null,
                uploadedBy: user?.uid || null,
                status: (signedContractUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
              },
              irrevocablePo: {
                fileName: poMoFile?.name || null,
                fileUrl: poMoUrl,
                notes: null,
                uploadedAt: poMoUrl ? serverTimestamp() : null,
                uploadedBy: user?.uid || null,
                status: (poMoUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
              },
              finalArtwork: {
                fileName: finalArtworkFile?.name || null,
                fileUrl: finalArtworkUrl,
                notes: null,
                uploadedAt: finalArtworkUrl ? serverTimestamp() : null,
                uploadedBy: user?.uid || null,
                status: (finalArtworkUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
              },
              paymentAsDeposit: {
                fileName: null,
                fileUrl: null,
                notes: null,
                uploadedAt: paymentAdvanceConfirmed ? serverTimestamp() : null,
                uploadedBy: user?.uid || null,
                status: (paymentAdvanceConfirmed ? "completed" : "pending") as "pending" | "completed" | "uploaded",
              },
            },
          },
        ]

        const joIds = await createMultipleJobOrders(
          jobOrdersData.map((jo) => ({ ...jo, assignTo: "" })), // Add default assignTo
          user.uid,
          status,
        )

        // Create notifications for all departments
        if (userData?.company_id) {
          const departments = ["Logistics", "Sales", "Admin", "Finance", "Treasury", "Accounting"]
          const navigateTo = `/logistics/job-orders/${joIds[0]}`

          const notifications = departments.map((dept) => ({
            company_id: userData.company_id!,
            department_from: "Sales",
            department_to: dept,
            description: "A new job order has been created and requires your attention.",
            navigate_to: navigateTo,
            title: "New Job Order Created",
            type: "job_order_created",
            uid_to: null,
          }))

          try {
            await createNotifications(notifications)
          } catch (notificationError: any) {
            console.error("Error creating notifications:", notificationError)
            // Don't throw here - we don't want notification failure to break job order creation
          }
        }

        router.push(`/sales/job-orders?success=true&joIds=${joIds.join(',')}`)
      } catch (error: any) {
        console.error("Error creating job orders:", error)
        toast({
          title: "Error",
          description: `Failed to create Job Orders: ${error.message || "Unknown error"}. Please try again.`,
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      bookingData,
      user,
      jobOrderForms,
      totalDays,
      signedQuotationUrl,
      signedContractUrl,
      poMoUrl,
      finalArtworkUrl,
      paymentAdvanceConfirmed,
      missingCompliance,
      userData,
      toast,
    ],
  )

  const handlePrint = useCallback(async () => {
    if (!bookingData || !user?.uid || !userData) {
      toast({
        title: "Missing Information",
        description: "Cannot generate PDF due to missing data.",
        variant: "destructive",
      })
      return
    }

    try {
      const booking = bookingData.booking
      const products = bookingData.products
      const client = bookingData.client
      const form = jobOrderForms[0]

      // Fetch the original quotation number from the quotation that created this booking
      let originalQuotationNumber = ""
      if (booking.quotation_id) {
        try {
          const originalQuotation = await getQuotationById(booking.quotation_id)
          if (originalQuotation) {
            originalQuotationNumber = originalQuotation.quotation_number
          }
        } catch (error) {
          console.warn("Could not fetch original quotation for quotation number:", error)
        }
      }

      // Generate JO number if not provided
      const joNumber = form.joNumber || await generatePersonalizedJONumber(userData)

      // Create temporary JobOrder object
      const tempJobOrder = {
        id: "", // Not created yet
        quotationId: booking.quotation_id || booking.id, // Use quotation_id if available, else booking id
        booking_id: booking.id, // Add booking_id
        created: new Date(),
        joNumber,
        dateRequested: form.dateRequested || new Date(),
        joType: form.joType as JobOrderType,
        deadline: form.deadline || new Date(),
        campaignName: form.campaignName,
        requestedBy: userData?.first_name || "Auto-Generated",
        remarks: form.remarks,
        attachments: form.materialSpecAttachmentUrl ? { name: form.materialSpecAttachmentFile?.name || "Attachment", type: form.materialSpecAttachmentFile?.type || "image", url: form.materialSpecAttachmentUrl } : null,
        materialSpec: form.materialSpec,
        materialSpecAttachmentUrl: form.materialSpecAttachmentUrl,
        clientCompliance: {
          dtiBirUrl: dtiBirUrl,
          gisUrl: gisUrl,
          idSignatureUrl: idSignatureUrl,
        },
        quotationNumber: originalQuotationNumber || booking.reservation_id, // Use original quotation number, fallback to reservation_id
        reservation_number: booking.reservation_id, // Include reservation number from booking
        clientName: client?.name || "N/A",
        clientCompany: booking.client?.company_name || "N/A", // Use company_name from booking client
        clientCompanyId: booking.client?.company_id || "",
        clientId: client?.id || "",
        client_email: (client as any)?.email || "",
        contractDuration: totalDays.toString(),
        contractPeriodStart: booking.start_date ? safeToDate(booking.start_date) : undefined,
        contractPeriodEnd: booking.end_date ? safeToDate(booking.end_date) : undefined,
        siteLocation: products[0]?.location || "N/A", // Get from product
        siteName: products[0]?.name || "", // Get from product
        siteCode: products[0]?.site_code || "N/A", // Get from product
        siteType: contentType || "N/A",
        siteSize: `${products[0]?.specs_rental?.height || 0}ft (h) x ${products[0]?.specs_rental?.width || 0}ft (w)`, // Get from product specs
        siteIllumination: products[0]?.light ? "Yes" : "No", // Get from product
        illumination: typeof products[0]?.specs_rental?.illumination === 'object'
          ? "Custom Illumination Setup"
          : products[0]?.specs_rental?.illumination || "N/A",
        leaseRatePerMonth: booking.costDetails?.days && booking.costDetails.days > 0
          ? (booking.total_cost || 0) / (booking.costDetails.days / 30)
          : 0,
        totalMonths: totalDays / 30,
        totalLease: booking.total_cost || 0,
        vatAmount: (booking.total_cost || 0) * 0.12,
        totalAmount: (booking.total_cost || 0) * 1.12,
        siteImageUrl: products[0]?.media?.[0]?.url || "/placeholder.svg?height=48&width=48", // Get from product media array
        missingCompliance: missingCompliance,
        product_id: booking.product_id || "",
        company_id: userData?.company_id || "",
        created_by: user.uid,
        content_type: contentType,
        status: "draft" as const,
        assignTo: "",
        projectCompliance: {
          signedQuotation: {
            fileName: signedQuotationFile?.name || null,
            fileUrl: signedQuotationUrl,
            notes: null,
            uploadedAt: signedQuotationUrl ? serverTimestamp() : null,
            uploadedBy: user?.uid || null,
            status: (signedQuotationUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
          },
          signedContract: {
            fileName: signedContractFile?.name || null,
            fileUrl: signedContractUrl,
            notes: null,
            uploadedAt: signedContractUrl ? serverTimestamp() : null,
            uploadedBy: user?.uid || null,
            status: (signedContractUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
          },
          irrevocablePo: {
            fileName: poMoFile?.name || null,
            fileUrl: poMoUrl,
            notes: null,
            uploadedAt: poMoUrl ? serverTimestamp() : null,
            uploadedBy: user?.uid || null,
            status: (poMoUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
          },
          finalArtwork: {
            fileName: finalArtworkFile?.name || null,
            fileUrl: finalArtworkUrl,
            notes: null,
            uploadedAt: finalArtworkUrl ? serverTimestamp() : null,
            uploadedBy: user?.uid || null,
            status: (finalArtworkUrl ? "completed" : "pending") as "pending" | "completed" | "uploaded",
          },
          paymentAsDeposit: {
            fileName: null,
            fileUrl: null,
            notes: null,
            uploadedAt: paymentAdvanceConfirmed ? serverTimestamp() : null,
            uploadedBy: user?.uid || null,
            status: (paymentAdvanceConfirmed ? "completed" : "pending") as "pending" | "completed" | "uploaded",
          },
        },
      }

      await generateJobOrderPDF(tempJobOrder, 'print')
    } catch (error: any) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: `Failed to generate PDF: ${error.message || "Unknown error"}.`,
        variant: "destructive",
      })
    }
  }, [
    bookingData,
    user,
    userData,
    jobOrderForms,
    totalDays,
    signedQuotationUrl,
    signedContractUrl,
    poMoUrl,
    finalArtworkUrl,
    paymentAdvanceConfirmed,
    missingCompliance,
    contentType,
    dtiBirUrl,
    gisUrl,
    idSignatureUrl,
    signedQuotationFile,
    signedContractFile,
    poMoFile,
    finalArtworkFile,
    toast,
  ])


  const handleCreateJobOrders = useCallback(
    async (status: JobOrderStatus) => {
      if (!bookingData || !user?.uid) {
        toast({
          title: "Missing Information",
          description: "Cannot create Job Orders due to missing data or user authentication.",
          variant: "destructive",
        })
        return
      }

      if (!validateForms()) {
        toast({
          title: "Missing Fields",
          description: "Please fill in all required fields for all Job Orders.",
          variant: "destructive",
        })
        return
      }

      // Check if any project compliances are missing
      const hasMissingProjectCompliance = missingCompliance.signedQuotation ||
        missingCompliance.signedContract ||
        missingCompliance.poMo ||
        missingCompliance.finalArtwork ||
        missingCompliance.paymentAdvance

      // If there are missing project compliances, show the confirmation dialog
      if (hasMissingProjectCompliance) {
        setPendingJobOrderStatus(status)
        setShowComplianceDialog(true)
        return
      }

      // If all compliances are complete, proceed with creation
      await createJobOrdersWithStatus(status)
    },
    [bookingData, user?.uid, validateForms, missingCompliance, createJobOrdersWithStatus],
  )


  // useEffect hooks
  useEffect(() => {
    if (!bookingId) {
      toast({
        title: "Error",
        description: "No booking ID provided.",
        variant: "destructive",
      })
      router.push("/sales/job-orders/select-booking")
      return
    }

    const fetchDetails = async () => {
      setLoading(true)
      try {
        const data = await getBookingDetailsForJobOrder(bookingId)
        if (data) {
          setBookingData(data)
          console.log("Fetched booking data:", data);
          console.log("bookingData.booking.client.company_id:", data.booking.client.company_id);
          console.log("bookingData.client?.id (expected client id):", data.client?.id);

          // Fetch the client_company document using the client company_id from the booking object
          if (data.booking.client.company_id) {
            const clientCompanyDoc = await getClientCompanyById(data.booking.client.company_id)
            if (clientCompanyDoc) {
              // Use clientCompanyDoc data to set compliance URLs
              if (clientCompanyDoc.compliance?.dti) {
                setDtiBirUrl(clientCompanyDoc.compliance.dti)
              }
              if (clientCompanyDoc.compliance?.gis) {
                setGisUrl(clientCompanyDoc.compliance.gis)
              }
              if (clientCompanyDoc.compliance?.id) {
                setIdSignatureUrl(clientCompanyDoc.compliance.id)
              }
            } else {
              console.warn(`Client company with ID ${data.booking.client.company_id} not found.`)
              // If clientCompanyDoc is not found, and data.client exists, try to set from data.client's direct compliance fields
              if (data.client) {
                if ((data.client as any).dti_bir_2303_url) {
                  setDtiBirUrl((data.client as any).dti_bir_2303_url)
                }
                if ((data.client as any).gis_url) {
                  setGisUrl((data.client as any).gis_url)
                }
                if ((data.client as any).id_signature_url) {
                  setIdSignatureUrl((data.client as any).id_signature_url)
                }
              }
            }
          } else {
            // If no client company_id, and data.client exists, try to set from data.client's direct compliance fields
            if (data.client) {
              if ((data.client as any).dti_bir_2303_url) {
                setDtiBirUrl((data.client as any).dti_bir_2303_url)
              }
              if ((data.client as any).gis_url) {
                setGisUrl((data.client as any).gis_url)
              }
              if ((data.client as any).id_signature_url) {
                setIdSignatureUrl((data.client as any).id_signature_url)
              }
            }
          }

          // Initialize project compliance states from bookingData
          if (data.booking.projectCompliance) {
            const projectCompliance = data.booking.projectCompliance
            if (projectCompliance.signedQuotation?.fileUrl) {
              setSignedQuotationUrl(projectCompliance.signedQuotation.fileUrl)
            }
            if (projectCompliance.signedContract?.fileUrl) {
              setSignedContractUrl(projectCompliance.signedContract.fileUrl)
            }
            if (projectCompliance.irrevocablePo?.fileUrl) {
              setPoMoUrl(projectCompliance.irrevocablePo.fileUrl)
            }
            if (projectCompliance.finalArtwork?.fileUrl) {
              setFinalArtworkUrl(projectCompliance.finalArtwork.fileUrl)
            }
            if (projectCompliance.paymentAsDeposit?.fileUrl) {
              setPaymentAdvanceConfirmed(true)
            }
          }
        } else {
          toast({
            title: "Error",
            description: "Booking or Product details not found. Please ensure they exist.",
            variant: "destructive",
          })
          router.push("/sales/job-orders/select-booking")
        }
      } catch (error) {
        console.error("Failed to fetch booking details:", error)
        toast({
          title: "Error",
          description: "Failed to load booking details. Please try again.",
          variant: "destructive",
        })
        router.push("/sales/job-orders/select-booking")
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [bookingId, router, toast])

  // Initialize forms when booking data changes
  useEffect(() => {
    if (bookingData && userData?.uid) {
      const initialForms: JobOrderFormData[] = [
        {
          joNumber: "",
          joType: "",
          dateRequested: new Date(),
          deadline: undefined,
          campaignName: bookingData.booking?.project_name || "", // Initialize with booking project_name
          remarks: "",
          attachmentFile: null,
          attachmentUrl: null,
          uploadingAttachment: false,
          attachmentError: null,
          materialSpec: "",
          materialSpecAttachmentFile: null,
          materialSpecAttachmentUrl: null,
          uploadingMaterialSpecAttachment: false,
          materialSpecAttachmentError: null,
          joTypeError: false,
          dateRequestedError: false,
        },
      ]
      setJobOrderForms(initialForms)
    }
  }, [bookingData, userData?.uid])

  // Reset joType and materialSpec if they are not in the new dynamic options
  useEffect(() => {
    setJobOrderForms((prev) => {
      const updated = [...prev]
      if (updated[0]) {
        if (updated[0].joType && !joTypeOptions.includes(updated[0].joType)) {
          updated[0] = { ...updated[0], joType: "" }
        }
        if (updated[0].materialSpec && !materialSpecOptions.includes(updated[0].materialSpec)) {
          updated[0] = { ...updated[0], materialSpec: "" }
        }
      }
      return updated
    })
  }, [joTypeOptions, materialSpecOptions])

  // Early returns after all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
        <span className="ml-2 text-lg">Loading Job Order details...</span>
      </div>
    )
  }

  if (!bookingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4 text-center">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Booking Details Not Found</h2>
        <p className="text-gray-600 mb-4">The selected booking or its associated products could not be loaded.</p>
        <Button onClick={() => router.push("/sales/job-orders/select-booking")}>Go to Select Booking</Button>
      </div>
    )
  }

  // Safe access to data after null check
  const booking = bookingData.booking
  const products = bookingData.products
  const client = bookingData.client
  console.log()
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-2">
      <div className="flex items-center bg-white gap-4 mb-6 rounded-lg">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 py-4">Create Job Order</h1>
      </div>

      <div className="flex flex-col gap-6 max-w-6xl w-full mx-auto bg-gray-50 p-6 rounded-lg">
        {/* Left Column: Quotation Details */}
        <div className="bg-white rounded-[10px] shadow-[-2px_4px_7.8px_0px_rgba(0,0,0,0.25)] p-4">
          <div className="grid grid-cols-6 gap-4 items-center">
            <div>
              <p className="font-semibold text-[12px] text-[#333333]">Booking ID</p>
              <p className="font-normal text-[18px] text-[#333333]">{booking.reservation_id}</p>
            </div>
            <div>
              <p className="font-semibold text-[12px] text-[#333333]">Site</p>
              <p className="font-bold text-[18px] text-[#2d3fff]">{products[0]?.name || products[0]?.site_code || "N/A"}</p>
            </div>
            <div>
              <p className="font-semibold text-[12px] text-[#333333]">Client</p>
              <p className="font-bold text-[18px] text-[#2d3fff]">{client?.name || "N/A"}</p>
            </div>
            <div>
              <p className="font-semibold text-[12px] text-[#333333]">Booking Dates</p>
              <p className="font-normal text-[18px] text-[#333333]">{formatPeriod(booking.start_date, booking.end_date)}</p>
            </div>
            <div>
              <p className="font-semibold text-[12px] text-[#333333]">Compliance</p>
              <p
                className="font-bold text-[18px] text-[#2d3fff] cursor-pointer"
                onClick={() => {
                  console.log("[DEBUG] bookingData:", bookingData);
                  console.log("[DEBUG] bookingData?.booking:", bookingData?.booking);
                  console.log("[DEBUG] bookingData?.booking?.projectCompliance:", bookingData?.booking?.projectCompliance);
                  console.log("[DEBUG] selectedBookingForCompliance will be set to:", bookingData);
                  setSelectedQuotationForCompliance(bookingData)
                  setShowComplianceDialogNew(true)
                }}
              >
                ({getProjectCompliance(bookingData?.booking).completed}/{getProjectCompliance(bookingData?.booking).total})
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="bg-white border-2 border-[#c4c4c4] rounded-[10px] h-[35px] w-[140px]"
                disabled={isViewQuoteLoading}
                onClick={() => {
                  // Handle loading state and navigation for specific booking ID
                  if (bookingId === "sycqON5DiDawhWLjd3QB") {
                    setIsViewQuoteLoading(true);
                    console.log("Loading state started for booking ID:", bookingId);

                    // Show loading state for 1.5 seconds, then proceed with same-tab navigation
                    setTimeout(() => {
                      setIsViewQuoteLoading(false);
                      console.log("Loading state completed, proceeding with same-tab navigation for booking ID:", bookingId);

                      // Navigate in the same tab using router navigation
                      router.push(`/sales/bookings/${booking.id}`);
                    }, 1500);

                    return;
                  }

                  // Original navigation logic for other booking IDs
                  const handleViewBooking = () => {
                    try {
                      // First try to open in a new tab/window
                      const newWindow = window.open(`/sales/bookings/${booking.id}`, '_blank');

                      // Check if popup was blocked (newWindow will be null)
                      if (!newWindow) {
                        throw new Error('Popup blocked');
                      }

                      // Optional: Add a small delay and check if window is still open
                      setTimeout(() => {
                        if (newWindow && newWindow.closed) {
                          // Window was closed immediately, fall back to router navigation
                          router.push(`/sales/bookings/${booking.id}`);
                        }
                      }, 100);

                    } catch (error) {
                      // If popup fails or is blocked, fall back to router navigation
                      console.warn('Popup blocked or failed, falling back to navigation:', error);
                      router.push(`/sales/bookings/${booking.id}`);
                    }
                  };

                  handleViewBooking();
                }}
              >
                {isViewQuoteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <p className="font-medium text-[16px] text-[#333333]">Loading...</p>
                  </>
                ) : (
                  <p className="font-medium text-[16px] text-[#333333]">View Booking</p>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Job Order Forms */}
        <div className="space-y-4">
          {!(missingCompliance.dtiBir ||
            missingCompliance.gis ||
            missingCompliance.idSignature ||
            missingCompliance.signedQuotation ||
            missingCompliance.signedContract ||
            missingCompliance.poMo ||
            missingCompliance.finalArtwork ||
            missingCompliance.paymentAdvance) && (
            <Alert className="bg-green-100 border-green-400 text-green-700 py-2 px-3">
              <CircleCheck className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700 text-xs">
                All compliance requirements are met.
              </AlertTitle>
              <AlertDescription className="text-green-700 text-xs">
                All required documents have been uploaded successfully.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-6">
            <div className="w-[303px]">
              <div className="flex justify-center mb-2">
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  {products[0]?.media?.[0]?.url ? (
                    <Image
                      src={products[0].media[0].url}
                      alt={products[0]?.name || "Site image"}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-full h-full flex items-center justify-center ${products[0]?.media?.[0]?.url ? 'hidden' : ''}`}
                    style={{
                      backgroundColor: '#f3f4f6',
                      display: products[0]?.media?.[0]?.url ? 'none' : 'flex'
                    }}
                  >
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
              </div>
              <p className="font-bold text-[20px] text-[#333333]">{products[0]?.name || "Site Name"}</p>
              <p className="font-normal text-[14px] text-[#333333]">{products[0]?.location || "Location"}</p>
              <div className="bg-white border-2 border-[#c4c4c4] rounded-[10px] h-[125px] mt-2 flex items-center justify-center">
                <Input
                  placeholder="Remarks"
                  value={jobOrderForms[0]?.remarks || ""}
                  onChange={(e) => handleFormUpdate(0, "remarks", e.target.value)}
                  className="w-full h-full border-none bg-transparent text-center font-medium text-[14px] text-[#a1a1a1]"
                />
              </div>
            </div>
            <div className="bg-white rounded-[10px] shadow-[-2px_4px_7.8px_0px_rgba(0,0,0,0.25)] p-6 w-[947px]">
              <div className="flex justify-between items-center mb-6">
                <p className="font-bold text-[20px] text-[#333333]">JO#</p>
                <p className="font-bold text-[20px] text-[#333333]">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">Date:</p>
                  <p className="font-medium text-[14px] text-[#a1a1a1]">{new Date().toLocaleDateString()}</p>
                </div>
                <div className="flex items-center">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">JO Type:</p>
                  <Select
                    onValueChange={(value: JobOrderType) => {
                      handleFormUpdate(0, "joType", value)
                      handleFormUpdate(0, "joTypeError", false)
                    }}
                    value={jobOrderForms[0]?.joType}
                  >
                    <SelectTrigger className={cn(
                      "w-[311px] bg-white text-gray-800 border-2 border-[#c4c4c4] rounded-[10px] h-[39px] text-[16px]",
                      jobOrderForms[0]?.joTypeError && "border-red-500",
                    )}>
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {joTypeOptions.map((type) => (
                        <SelectItem key={type} value={type} className="text-sm">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">Campaign Name:</p>
                  <Input
                    placeholder="Campaign Name"
                    value={jobOrderForms[0]?.campaignName || ""}
                    onChange={(e) => handleFormUpdate(0, "campaignName", e.target.value)}
                    className="w-[311px] bg-white text-gray-800 border-2 border-[#c4c4c4] rounded-[10px] h-[39px] text-[16px]"
                  />
                </div>
                <div className="flex items-center">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">Deadline:</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[311px] justify-start text-left font-normal bg-white text-gray-800 border-2 border-[#c4c4c4] rounded-[10px] h-[39px] text-[16px]"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {jobOrderForms[0]?.deadline ? format(jobOrderForms[0].deadline, "PPP") : "Select Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={jobOrderForms[0]?.deadline}
                        onSelect={(date) => handleFormUpdate(0, "deadline", date)}
                        disabled={{ before: new Date() }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">Material Spec:</p>
                  <Select
                    onValueChange={(value) => handleFormUpdate(0, "materialSpec", value)}
                    value={jobOrderForms[0]?.materialSpec}
                  >
                    <SelectTrigger className="w-[311px] bg-white text-gray-800 border-2 border-[#c4c4c4] rounded-[10px] h-[39px] text-[16px]">
                      <SelectValue placeholder="Choose Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialSpecOptions.map((spec) => (
                        <SelectItem key={spec} value={spec} className="text-sm">
                          {spec}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">Attachments:</p>
                  <div className="w-[311px]">
                    {jobOrderForms[0]?.materialSpecAttachmentUrl ? (
                      // Show preview when file is uploaded
                      <div className="bg-white border-2 border-[#c4c4c4] rounded-[10px] w-[131px] aspect-square flex flex-col relative p-2">
                        {isImageFile(jobOrderForms[0]?.materialSpecAttachmentFile?.name || "", jobOrderForms[0]?.materialSpecAttachmentUrl || "") ? (
                          // Image file preview with loading and error handling
                          <div className="relative w-full h-full flex items-center justify-center">
                            {jobOrderForms[0]?.uploadingMaterialSpecAttachment ? (
                              // Loading state
                              <div className="flex flex-col items-center justify-center w-full h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
                                <span className="text-xs text-gray-500">Loading image...</span>
                              </div>
                            ) : (
                              // Image display with error fallback
                              <>
                                <Image
                                  src={jobOrderForms[0].materialSpecAttachmentUrl}
                                  alt={jobOrderForms[0]?.materialSpecAttachmentFile?.name || "Uploaded image"}
                                  fill
                                  className="object-cover rounded-md"
                                  sizes="311px"
                                  onLoad={() => {
                                    // Image loaded successfully
                                    console.log("Image loaded successfully");
                                  }}
                                  onError={(e) => {
                                    console.error("Image failed to load:", e);
                                    // Hide the image and show fallback
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) {
                                      fallback.style.display = 'flex';
                                    }
                                  }}
                                />
                                {/* Fallback icon when image fails to load */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-md hidden">
                                  <ImageIcon className="w-8 h-8 text-gray-400 mb-1" />
                                  <span className="text-xs text-gray-500 text-center px-2">
                                    Failed to load image
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          // Non-image file preview (existing logic)
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-6 h-6 text-gray-600" />
                              <span className="font-medium text-xs text-gray-800 truncate max-w-[200px]" title={jobOrderForms[0]?.materialSpecAttachmentFile?.name || "Uploaded file"}>
                                {jobOrderForms[0]?.materialSpecAttachmentFile?.name || "Uploaded file"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Remove button - positioned in top-right corner */}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleFormUpdate(0, "materialSpecAttachmentFile", null)
                            handleFormUpdate(0, "materialSpecAttachmentUrl", null)
                            handleFormUpdate(0, "materialSpecAttachmentError", null)
                          }}
                          className="absolute top-1 right-1 h-6 w-6 p-0 text-gray-500 hover:text-red-500 bg-white bg-opacity-75 rounded-full"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      // Show upload area when no file is uploaded
                      <div className="bg-[#c4c4c4] opacity-50 rounded-[10px] w-[131px] aspect-square flex items-center justify-center relative cursor-pointer hover:opacity-70 transition-opacity" onClick={() => document.getElementById("material-spec-attachment-upload-0")?.click()}>
                        <p className="font-semibold text-[10.267px] text-[#4e4e4e] text-center">Upload</p>
                        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <Upload className="w-[45.557px] h-[45.557px] opacity-50" />
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      id="material-spec-attachment-upload-0"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        if (event.target.files && event.target.files[0]) {
                          handleMaterialSpecAttachmentUpload(0, event.target.files[0])
                        }
                      }}
                    />
                    {jobOrderForms[0]?.materialSpecAttachmentError && (
                      <p className="text-xs text-red-500">{jobOrderForms[0].materialSpecAttachmentError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <p className="font-semibold text-[14px] text-[#333333] w-[177px]">Sales:</p>
                  <p className="font-medium text-[14px] text-[#a1a1a1]">{userData?.first_name} {userData?.last_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-[#c4c4c4] border-[1.5px] rounded-[50px] h-[112px] w-[440px] flex items-center justify-center gap-4 mx-auto mt-4">
        <Button
          onClick={() => handleCreateJobOrders("pending")}
          disabled={isSubmitting}
          className="bg-[#1d0beb] text-white font-bold text-[24px] h-[61px] w-[175px] rounded-[15px]"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send JO"}
        </Button>
        <p className="font-semibold text-[16px] text-[#333333] underline cursor-pointer" onClick={() => handleCreateJobOrders("draft")}>
          Save as Draft
        </p>
      </div>



      {/* Coming Soon Dialog */}
      {showComingSoonDialog && (
        <ComingSoonModal
          onClose={() => setShowComingSoonDialog(false)}
          onNotify={() => {
            // Handle notify functionality if needed
            setShowComingSoonDialog(false)
          }}
        />
      )}

      {/* Compliance Confirmation Dialog */}
      <ComplianceConfirmationDialog
        isOpen={showComplianceDialog}
        onClose={() => setShowComplianceDialog(false)}
        onSkip={() => {
          if (pendingJobOrderStatus) {
            createJobOrdersWithStatus(pendingJobOrderStatus)
          }
          setShowComplianceDialog(false)
        }}
        complianceItems={[
          { name: "Signed Quotation", completed: !missingCompliance.signedQuotation, type: "upload" },
          { name: "Signed Contract", completed: !missingCompliance.signedContract, type: "upload" },
          { name: "Irrevocable PO", completed: !missingCompliance.poMo, type: "upload" },
          { name: "Final Artwork", completed: !missingCompliance.finalArtwork, type: "upload" },
          { name: "Payment as Deposit/Advance", completed: !missingCompliance.paymentAdvance, type: "confirmation" },
        ]}
      />

      {/* Compliance Dialog */}
      <ComplianceDialog
        open={showComplianceDialogNew}
        onOpenChange={setShowComplianceDialogNew}
        quotation={selectedQuotationForCompliance?.quotation}
        onFileUpload={() => {}}
        uploadingFiles={uploadingFiles}
        userEmail={userData?.email || ""}
        viewOnly={true}
      />
    </div>
  )
}
