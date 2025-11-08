"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Upload, ImageIcon, Eye, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { getProductById, type Product, uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { collection, query, where, getDocs, limit, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { postReport, type ReportData } from "@/lib/report-service"
import { ReportPostSuccessDialog } from "@/components/report-post-success-dialog"

interface CreateReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  module?: "logistics" | "sales" | "admin"
  hideJobOrderSelection?: boolean
  preSelectedJobOrder?: string
}

interface AttachmentData {
  note: string
  file?: File
  fileName?: string
  preview?: string
  fileUrl?: string
  uploading?: boolean
  fileType?: string
  label?: string
}

interface JobOrder {
  id: string
  joNumber: string
  clientName: string
  clientCompany: string
  client_email?: string
  status: string
  joType: string
  siteName: string
  product_id: string
  siteImageUrl?: string
  requestedBy?: string
}

interface ServiceAssignment {
  id: string
  saNumber: string
  joNumber?: string
  projectSiteId: string
  projectSiteName: string
  projectSiteLocation: string
  serviceType: string
  assignedTo: string
  jobDescription: string
  requestedBy: {
    id: string
    name: string
    department: string
  }
  message: string
  campaignName?: string
  coveredDateStart: Date | null
  coveredDateEnd: Date | null
  alarmDate: Date | null
  alarmTime: string
  attachments: { name: string; type: string }[]
  serviceExpenses: { name: string; amount: string }[]
  status: string
  created: any
  updated: any
  company_id?: string
  reservation_number?: string
  booking_id?: string
}

export function CreateReportDialog({
  open,
  onOpenChange,
  siteId,
  module = "logistics",
  hideJobOrderSelection = false,
  preSelectedJobOrder,
}: CreateReportDialogProps) {
  const [product, setProduct] = useState<Product | null>(null)
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([])
  const [loadingSAs, setLoadingSAs] = useState(false)
  const [selectedServiceAssignmentDetails, setSelectedServiceAssignmentDetails] = useState<ServiceAssignment | null>(null)
  const [selectedSA, setSelectedSA] = useState("")
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState("completion-report")
  const [date, setDate] = useState("")
  const [attachments, setAttachments] = useState<AttachmentData[]>([{ note: "" }, { note: "" }])
  const [beforeImages, setBeforeImages] = useState<AttachmentData[]>([{ note: "" }])
  const [afterImages, setAfterImages] = useState<AttachmentData[]>([{ note: "" }])
  const [previewModal, setPreviewModal] = useState<{ open: boolean; file?: File; preview?: string }>({ open: false })
  const [description, setDescription] = useState("")

  // Installation report specific fields
  const [status, setStatus] = useState("")
  const [timeline, setTimeline] = useState("on-time")
  const [delayReason, setDelayReason] = useState("")
  const [delayDays, setDelayDays] = useState("")

  // Description of Work field for completion reports
  const [descriptionOfWork, setDescriptionOfWork] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successReportId, setSuccessReportId] = useState<string>("")

  const { toast } = useToast()
  const { user, userData, projectData } = useAuth()
  const router = useRouter()

  // Fetch product data when dialog opens
  useEffect(() => {
    if (open && siteId) {
      fetchProductData()
      if (!hideJobOrderSelection) {
        fetchServiceAssignments()
      }
      // Auto-fill date with current date
      setDate(new Date().toISOString().split("T")[0])

      if (preSelectedJobOrder) {
        setSelectedSA(preSelectedJobOrder)
        if (!hideJobOrderSelection) {
          fetchSelectedServiceAssignmentDetails(preSelectedJobOrder)
        }
      }
    }
  }, [open, siteId, hideJobOrderSelection, preSelectedJobOrder])

  // Fetch service assignment details when selection changes
  useEffect(() => {
    if (selectedSA && selectedSA !== "none" && !hideJobOrderSelection) {
      fetchSelectedServiceAssignmentDetails(selectedSA)
    } else {
      setSelectedServiceAssignmentDetails(null)
    }
  }, [selectedSA, hideJobOrderSelection])

  const fetchServiceAssignments = async () => {
    setLoadingSAs(true)
    try {
      // Query service assignments for this specific site/product
      const serviceAssignmentsRef = collection(db, "service_assignments")
      const q = query(serviceAssignmentsRef, where("projectSiteId", "==", siteId))
      const querySnapshot = await getDocs(q)

      const fetchedServiceAssignments: ServiceAssignment[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()

        fetchedServiceAssignments.push({
          id: doc.id,
          saNumber: data.saNumber || "N/A",
          joNumber: data.joNumber || "",
          projectSiteId: data.projectSiteId || "",
          projectSiteName: data.projectSiteName || "Unknown Site",
          projectSiteLocation: data.projectSiteLocation || "",
          serviceType: data.serviceType || "General",
          assignedTo: data.assignedTo || "Unknown",
          jobDescription: data.jobDescription || "",
          requestedBy: data.requestedBy || { id: "", name: "", department: "" },
          message: data.message || "",
          campaignName: data.campaignName || "",
          coveredDateStart: data.coveredDateStart || null,
          coveredDateEnd: data.coveredDateEnd || null,
          alarmDate: data.alarmDate || null,
          alarmTime: data.alarmTime || "",
          attachments: data.attachments || [],
          serviceExpenses: data.serviceExpenses || [],
          status: data.status || "unknown",
          created: data.created,
          updated: data.updated,
          company_id: data.company_id || "",
          reservation_number: data.reservation_number || "",
          booking_id: data.booking_id || "",
        })
      })

      setServiceAssignments(fetchedServiceAssignments)
    } catch (error) {
      console.error("Error fetching service assignments:", error)
      toast({
        title: "Error",
        description: "Failed to load service assignments",
        variant: "destructive",
      })
    } finally {
      setLoadingSAs(false)
    }
  }

  const fetchSelectedServiceAssignmentDetails = async (saNumber: string) => {
    try {
      // Find the service assignment from the list first
      const saFromList = serviceAssignments.find((sa) => sa.saNumber === saNumber)
      if (saFromList) {
        setSelectedServiceAssignmentDetails(saFromList)
        return
      }

      // If not found in list, fetch individual service assignment details
      const serviceAssignmentsRef = collection(db, "service_assignments")
      const q = query(serviceAssignmentsRef, where("saNumber", "==", saNumber))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0]
        const data = docSnap.data()

        const detailedSA = {
          id: docSnap.id,
          saNumber: data.saNumber || "N/A",
          joNumber: data.joNumber || "",
          projectSiteId: data.projectSiteId || "",
          projectSiteName: data.projectSiteName || "Unknown Site",
          projectSiteLocation: data.projectSiteLocation || "",
          serviceType: data.serviceType || "General",
          assignedTo: data.assignedTo || "Unknown",
          jobDescription: data.jobDescription || "",
          requestedBy: data.requestedBy || { id: "", name: "", department: "" },
          message: data.message || "",
          campaignName: data.campaignName || "",
          coveredDateStart: data.coveredDateStart || null,
          coveredDateEnd: data.coveredDateEnd || null,
          alarmDate: data.alarmDate || null,
          alarmTime: data.alarmTime || "",
          attachments: data.attachments || [],
          serviceExpenses: data.serviceExpenses || [],
          status: data.status || "unknown",
          created: data.created,
          updated: data.updated,
          company_id: data.company_id || "",
          reservation_number: data.reservation_number || "",
          booking_id: data.booking_id || "",
        }
        setSelectedServiceAssignmentDetails(detailedSA)
        console.log("Fetched detailed service assignment:", detailedSA)
      }
    } catch (error) {
      console.error("Error fetching service assignment details:", error)
    }
  }

  const fetchProductData = async () => {
    try {
      const productData = await getProductById(siteId)
      console.log("Fetched product data:", productData)
      console.log("Product name:", productData?.name)
      console.log("Product ID:", productData?.id)
      setProduct(productData)

      // If no job order is pre-selected and job order selection is not hidden,
      // try to find associated job orders for this product to get siteImageUrl
      if (!preSelectedJobOrder && !hideJobOrderSelection) {
        await fetchJobOrdersForProduct()
      }
    } catch (error) {
      console.error("Error fetching product data:", error)
      toast({
        title: "Error",
        description: "Failed to load site information",
        variant: "destructive",
      })
    }
  }

  const fetchJobOrdersForProduct = async () => {
    try {
      // Query job orders for this specific product to get siteImageUrl
      const jobOrdersRef = collection(db, "job_orders")
      const q = query(jobOrdersRef, where("product_id", "==", siteId), limit(1)) // Get just one to get siteImageUrl
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0]
        const data = docSnap.data()
        const siteImageUrl = data.siteImageUrl

        if (siteImageUrl) {
          console.log("Found siteImageUrl from associated job order for product:", siteImageUrl)
          // Store this in a way that can be used when creating the report
          const jobOrderDetails = {
            id: docSnap.id,
            joNumber: data.joNumber || "N/A",
            clientName: data.clientName || "Unknown Client",
            clientCompany: data.clientCompany || "",
            client_email: data.client_email || "",
            status: data.status || "unknown",
            joType: data.joType || "General",
            siteName: data.siteName || "Unknown Site",
            product_id: data.product_id || "",
            siteImageUrl: siteImageUrl,
            requestedBy: data.requestedBy || "",
          }
          // Note: This function is for job orders, but we're switching to service assignments
          // For now, we'll skip setting service assignment details from job order data
        } else {
          console.log("No siteImageUrl found in associated job order for product")
        }
      }
    } catch (error) {
      console.error("Error fetching job orders for product:", error)
      // Don't show error toast for this as it's not critical
    }
  }

  const handleAttachmentNoteChange = (index: number, note: string) => {
    const newAttachments = [...attachments]
    newAttachments[index].note = note
    setAttachments(newAttachments)
  }

  const handleBeforeImageNoteChange = (index: number, note: string) => {
    const newImages = [...beforeImages]
    newImages[index].note = note
    setBeforeImages(newImages)
  }

  const handleAfterImageNoteChange = (index: number, note: string) => {
    const newImages = [...afterImages]
    newImages[index].note = note
    setAfterImages(newImages)
  }

  const addBeforeImage = () => {
    setBeforeImages([...beforeImages, { note: "" }])
  }

  const addAfterImage = () => {
    setAfterImages([...afterImages, { note: "" }])
  }

  const removeBeforeImage = (index: number) => {
    if (beforeImages.length > 1) {
      setBeforeImages(beforeImages.filter((_, i) => i !== index))
    }
  }

  const removeAfterImage = (index: number) => {
    if (afterImages.length > 1) {
      setAfterImages(afterImages.filter((_, i) => i !== index))
    }
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split(".").pop()

    switch (extension) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
        return <ImageIcon className="h-8 w-8 text-green-500" />
      default:
        return <ImageIcon className="h-8 w-8 text-gray-500" />
    }
  }

  const createFilePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })
  }

  const handleFileUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Error",
          description: "Please upload only image files (JPEG, PNG, GIF, WebP)",
          variant: "destructive",
        })
        return
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast({
          title: "Error",
          description: "File size must be less than 10MB",
          variant: "destructive",
        })
        return
      }

      // Set uploading state immediately
      const newAttachments = [...attachments]
      newAttachments[index] = {
        ...newAttachments[index],
        file,
        fileName: file.name,
        fileType: file.type,
        uploading: true,
      }

      // Create preview for images immediately
      if (file.type.startsWith("image/")) {
        try {
          const preview = await createFilePreview(file)
          newAttachments[index].preview = preview
        } catch (error) {
          console.error("Error creating preview:", error)
        }
      }

      setAttachments(newAttachments)

      try {
        // Upload to Firebase Storage with a proper path structure
        const timestamp = Date.now()
        const uploadPath = `reports/${siteId}/${timestamp}_${file.name}`

        console.log("Uploading file to Firebase Storage:", uploadPath)
        const downloadURL = await uploadFileToFirebaseStorage(file, uploadPath)
        console.log("File uploaded successfully, download URL:", downloadURL)

        // Update attachment with Firebase URL
        const updatedAttachments = [...attachments]
        updatedAttachments[index] = {
          ...updatedAttachments[index],
          file,
          fileName: file.name,
          fileType: file.type,
          preview: newAttachments[index].preview,
          fileUrl: downloadURL, // This is the key field that was missing
          uploading: false,
        }
        setAttachments(updatedAttachments)

        toast({
          title: "Success",
          description: "File uploaded successfully",
        })
      } catch (error) {
        console.error("Error uploading file:", error)

        // Reset the attachment on error
        const errorAttachments = [...attachments]
        errorAttachments[index] = {
          note: newAttachments[index].note,
          uploading: false,
        }
        setAttachments(errorAttachments)

        toast({
          title: "Error",
          description: "Failed to upload file. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleBeforeImageUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await uploadImage(file, index, beforeImages, setBeforeImages, "before")
    }
  }

  const handleAfterImageUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await uploadImage(file, index, afterImages, setAfterImages, "After")
    }
  }

  const uploadImage = async (
    file: File,
    index: number,
    images: AttachmentData[],
    setImages: React.Dispatch<React.SetStateAction<AttachmentData[]>>,
    type: string
  ) => {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload only image files (JPEG, PNG, GIF, WebP)",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size must be less than 10MB",
        variant: "destructive",
      })
      return
    }

    // Set uploading state immediately
    const newImages = [...images]
    newImages[index] = {
      ...newImages[index],
      file,
      fileName: file.name,
      fileType: file.type,
      uploading: true,
    }

    // Create preview for images immediately
    if (file.type.startsWith("image/")) {
      try {
        const preview = await createFilePreview(file)
        newImages[index].preview = preview
      } catch (error) {
        console.error("Error creating preview:", error)
      }
    }

    setImages(newImages)

    try {
      // Upload to Firebase Storage with a proper path structure
      const timestamp = Date.now()
      const uploadPath = `reports/${siteId}/${type}/${timestamp}_${file.name}`

      console.log("Uploading file to Firebase Storage:", uploadPath)
      const downloadURL = await uploadFileToFirebaseStorage(file, uploadPath)
      console.log("File uploaded successfully, download URL:", downloadURL)

      // Update image with Firebase URL
      const updatedImages = [...images]
      updatedImages[index] = {
        ...updatedImages[index],
        file,
        fileName: file.name,
        fileType: file.type,
        preview: newImages[index].preview,
        fileUrl: downloadURL,
        uploading: false,
      }
      setImages(updatedImages)

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      })
    } catch (error) {
      console.error("Error uploading file:", error)

      // Reset the image on error
      const errorImages = [...images]
      errorImages[index] = {
        note: newImages[index].note,
        uploading: false,
      }
      setImages(errorImages)

      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePreviewFile = (attachment: AttachmentData, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Skip site image logic for admin mode
    if (module !== "admin") {
      // Get the effective service assignment (selected or product-associated) for non-admin modes
      const effectiveServiceAssignment = selectedServiceAssignmentDetails ||
        (selectedSA !== "none" ? serviceAssignments.find((sa) => sa.saNumber === selectedSA) : null)

      // Note: Service assignments don't have siteImageUrl, so we'll skip this logic for now
      // If we have a service assignment, we could potentially show a different image or skip this
      // For now, just proceed to show uploaded file
    }

    // Fallback to uploaded file
    if (!attachment.file) return

    // Handle images - show in full screen modal
    if (attachment.file.type.startsWith("image/")) {
      setPreviewModal({
        open: true,
        file: attachment.file,
        preview: attachment.preview,
      })
    }
  }

  const renderFilePreview = (attachment: AttachmentData, index: number) => {

    // Fallback to original behavior if no siteImageUrl
    if (attachment.uploading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-1">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-xs text-blue-600">Uploading...</span>
        </div>
      )
    }

    if (!attachment.file || !attachment.fileName) {
      return (
        <label
          htmlFor={`file-${index}`}
          className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <span className="text-xs text-gray-500">Upload</span>
        </label>
      )
    }

    const isImage = attachment.file.type.startsWith("image/")

    return (
      <div className="relative w-full h-full group">
        <label
          htmlFor={`file-${index}`}
          className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1 p-1"
        >
          {isImage && attachment.preview ? (
            <img
              src={attachment.preview || "/placeholder.svg"}
              alt={attachment.fileName}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <div className="flex items-center justify-center">{getFileIcon(attachment.fileName)}</div>
          )}
        </label>

        {/* Preview Button */}
        <button
          onClick={(e) => handlePreviewFile(attachment, e)}
          className="absolute top-1 right-1 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Preview file"
        >
          <Eye className="h-3 w-3" />
        </button>

        {/* Success indicator when uploaded */}
        {attachment.fileUrl && !attachment.uploading && (
          <div className="absolute bottom-1 right-1 bg-green-500 text-white p-1 rounded-full">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    )
  }

  const renderImagePreview = (image: AttachmentData, inputId: string, type: string) => {
    if (image.uploading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-1">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-xs text-blue-600">Uploading...</span>
        </div>
      )
    }

    if (!image.file || !image.fileName) {
      return (
        <label
          htmlFor={inputId}
          className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <span className="text-xs text-gray-500">Upload</span>
        </label>
      )
    }

    const isImage = image.file.type.startsWith("image/")

    return (
      <div className="relative w-full h-full group">
        <label
          htmlFor={inputId}
          className="cursor-pointer flex flex-col items-center justify-center h-full space-y-1 p-1"
        >
          {isImage && image.preview ? (
            <img
              src={image.preview || "/placeholder.svg"}
              alt={image.fileName}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <div className="flex items-center justify-center">{getFileIcon(image.fileName)}</div>
          )}
        </label>

        {/* Preview Button */}
        <button
          onClick={(e) => handlePreviewFile(image, e)}
          className="absolute top-1 right-1 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Preview image"
        >
          <Eye className="h-3 w-3" />
        </button>

        {/* Success indicator when uploaded */}
        {image.fileUrl && !image.uploading && (
          <div className="absolute bottom-1 right-1 bg-green-500 text-white p-1 rounded-full">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    )
  }

  const handleGenerateReport = async () => {
    if (!product) {
      toast({
        title: "Error",
        description: "Site information not loaded",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to create a report",
        variant: "destructive",
      })
      return
    }

    // Check if at least one attachment has a file with fileUrl
    let hasValidAttachments = false
    if (reportType === "completion-report" || reportType === "installation-report") {
      hasValidAttachments = [...beforeImages, ...afterImages, ...attachments].some((att) => att.file && att.fileUrl)
    } else {
      hasValidAttachments = attachments.some((att) => att.file && att.fileUrl)
    }

    if (!hasValidAttachments) {
      toast({
        title: "Error",
        description: "Please upload at least one image and wait for it to finish uploading",
        variant: "destructive",
      })
      return
    }

    // Check if any files are still uploading
    let isUploading = false
    if (reportType === "completion-report" || reportType === "installation-report") {
      isUploading = [...beforeImages, ...afterImages, ...attachments].some((att) => att.uploading)
    } else {
      isUploading = attachments.some((att) => att.uploading)
    }

    if (isUploading) {
      toast({
        title: "Error",
        description: "Please wait for all images to finish uploading",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Use the detailed service assignment data if available, otherwise fall back to list data
      const selectedServiceAssignment = selectedServiceAssignmentDetails ||
        (selectedSA !== "none" ? serviceAssignments.find((sa) => sa.saNumber === selectedSA) : null)

      // If no service assignment is selected but we have product-associated service assignment data, use that
      const effectiveServiceAssignment = selectedServiceAssignment || selectedServiceAssignmentDetails

      // Build the report data
      console.log("Building report data with product:", product)
      console.log("Product name for siteName:", product.name)

      // Convert date to timestamp
      const dateTimestamp = Timestamp.fromDate(new Date(date))

      // Use better fallback for site name
      const siteName = product.name ||
        product.specs_rental?.location ||
        product.light?.location ||
        `Site ${product.id?.slice(-4)}` ||
        "Unknown Site"

      const reportData: ReportData = {
        siteId: product.id || "",
        siteName: siteName,
        companyId: userData?.company_id || projectData?.project_id || userData?.project_id || "",
        sellerId: product.seller_id || user.uid,
        client: effectiveServiceAssignment?.projectSiteName || "No Client",
        clientId: effectiveServiceAssignment?.assignedTo || "no-client-id",
        client_email: "", // Service assignments don't have email
        joNumber: selectedSA !== "none" ? selectedSA : undefined,
        joType: effectiveServiceAssignment?.serviceType || "General",
        bookingDates: {
          start: dateTimestamp,
          end: dateTimestamp,
        },
        breakdate: dateTimestamp,
        sales: user.displayName || user.email || "Unknown User",
        reportType,
        date,
        attachments: (reportType === "completion-report" || reportType === "installation-report")
          ? [
            ...beforeImages
              .filter((img) => img.fileUrl)
              .map((img) => ({
                note: img.note,
                fileName: img.fileName || "",
                fileType: img.fileType || img.file?.type || "",
                fileUrl: img.fileUrl!,
                label: "before",
              })),
            ...afterImages
              .filter((img) => img.fileUrl)
              .map((img) => ({
                note: img.note,
                fileName: img.fileName || "",
                fileType: img.fileType || img.file?.type || "",
                fileUrl: img.fileUrl!,
                label: "After",
              })),
            ...attachments
              .filter((att) => att.fileUrl)
              .map((att) => ({
                note: att.note,
                fileName: att.fileName || "",
                fileType: att.fileType || att.file?.type || "",
                fileUrl: att.fileUrl!,
              }))
          ]
          : attachments
            .filter((att) => (att.note.trim() !== "" || att.file) && att.fileUrl)
            .map((att) => ({
              note: att.note,
              fileName: att.fileName || "",
              fileType: att.fileType || att.file?.type || "",
              fileUrl: att.fileUrl!,
            })),
        status: module === "sales" ? "posted" : "draft", // Save as posted for sales, draft for others (logistics and admin)
        createdBy: user.uid,
        createdByName: user.displayName || user.email || "Unknown User",
        category: module,
        subcategory: product.content_type || "general",
        priority: "medium",
        completionPercentage: reportType === "completion-report" ? 100 : 0,
        tags: [reportType, product.content_type || "general"].filter(Boolean),
        siteImageUrl: undefined,
      }
      console.log("Built report data with siteName:", reportData.siteName)
      console.log("Report siteImageUrl:", reportData.siteImageUrl)
      console.log("Selected service assignment:", selectedServiceAssignment)
      console.log("Effective service assignment:", effectiveServiceAssignment)
      console.log("Selected service assignment details:", selectedServiceAssignmentDetails)

      // Add product information
      reportData.product = {
        id: product.id || "",
        name: product.name || "",
        content_type: product.content_type,
        specs_rental: product.specs_rental,
        light: product.light,
      }

      // Add description of work for completion reports
      if (reportType === "completion-report" && descriptionOfWork.trim()) {
        reportData.descriptionOfWork = descriptionOfWork.trim()
      }

      // Add optional fields only if they have values
      if (product.site_code) {
        reportData.siteCode = product.site_code
      }

      if (product.light?.location || product.specs_rental?.location) {
        reportData.location = product.light?.location || product.specs_rental?.location
      }

      // Add service assignment specific fields
      if (effectiveServiceAssignment?.reservation_number) {
        reportData.reservation_number = effectiveServiceAssignment.reservation_number
      }

      if (effectiveServiceAssignment?.booking_id) {
        reportData.booking_id = effectiveServiceAssignment.booking_id
      }

      // Only add installation-specific fields if they have non-empty values
      if (reportType === "installation-report") {
        // Only add installationStatus if status has a valid numeric value
        if (status && status.trim() !== "" && !isNaN(Number(status)) && Number(status) >= 0) {
          reportData.installationStatus = status.trim()
        }

        // Only add installationTimeline if it's explicitly set to delayed
        if (timeline === "delayed") {
          reportData.installationTimeline = timeline

          // Only add delay-related fields if they have actual values
          if (delayReason && delayReason.trim() !== "") {
            reportData.delayReason = delayReason.trim()
          }
          if (delayDays && delayDays.trim() !== "" && !isNaN(Number(delayDays)) && Number(delayDays) > 0) {
            reportData.delayDays = delayDays.trim()
          }
        }
      }

      console.log("Generated report data with attachments:", reportData.attachments)
      console.log("Sample attachment with label:", reportData.attachments.find(att => att.label))
      console.log("Before images array:", beforeImages)
      console.log("After images array:", afterImages)
      console.log("General attachments array:", attachments)

      let reportId: string | undefined

      // For sales and logistics modules, save the report to database immediately with posted status
      if (module === "sales" || module === "logistics") {
        console.log(`Saving report to database for ${module} module`)
        reportId = await postReport(reportData)
        console.log("Report saved with ID:", reportId)

        // Set sessionStorage to trigger success dialog on service-reports page (for logistics module)
        if (module === "logistics") {
          sessionStorage.setItem("lastPostedReportId", reportId)
          setSuccessReportId(reportId)
          onOpenChange(false)
          setShowSuccessDialog(true)
        }
      }

      // For admin module, save the report to database immediately with draft status
      if (module === "admin") {
        console.log("Saving report to database for admin module with draft status")
        const { createReport } = await import("@/lib/report-service")
        reportId = await createReport(reportData)
        console.log("Saved admin report with draft status, ID:", reportId)

        // Store the report data in sessionStorage for the preview page
        const finalReportData = {
          ...reportData,
          id: reportId
        }
        sessionStorage.setItem("previewReportData", JSON.stringify(finalReportData))
        sessionStorage.setItem("previewProductData", JSON.stringify(product))
      }

      if (module !== "logistics") {
        toast({
          title: "Success",
          description: module === "sales"
            ? "Service Report Created and Posted Successfully!"
            : "Service Report Generated Successfully!",
        })
        onOpenChange(false)
      }
      // Reset form
      setReportType("completion-report")
      setDate("")
      setSelectedSA("")
      setAttachments([{ note: "" }, { note: "" }])
      setBeforeImages([{ note: "" }])
      setAfterImages([{ note: "" }])
      setStatus("")
      setTimeline("on-time")
      setDelayReason("")
      setDelayDays("")
      setDescriptionOfWork("")

      if (module !== "logistics") {
        const redirectPath = module === "sales"
          ? "/sales/reports/preview"
          : module === "admin"
          ? "/admin/reports/preview"
          : "/logistics/service-reports"

        console.log("Redirecting to:", redirectPath, "Module:", module, "Report ID:", reportId, "Report ID type:", typeof reportId, "Report ID truthy:", !!reportId)
        router.push(redirectPath)
      }
    } catch (error) {
      console.error("Error generating report:", error)
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md relative sm:max-w-md fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-6">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute -top-2 -right-2 z-10 bg-gray-500 hover:bg-gray-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-semibold">Service Report</DialogTitle>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto scrollbar-hide space-y-3 px-1">
            {/* Booking Information Section */}
            <div className="bg-gray-100 p-3 rounded-lg space-y-1">
              <div className="text-base">
                <span className="font-medium">SA#:</span>{" "}
                {hideJobOrderSelection
                  ? preSelectedJobOrder || "None"
                  : selectedSA === "none"
                  ? "None"
                  : selectedSA || "Select SA"}
              </div>
              <div className="text-base">
                <span className="font-medium">Reservation:</span> {selectedServiceAssignmentDetails?.reservation_number || "N/A"}
              </div>
            </div>

            {!hideJobOrderSelection && (
              <div className="space-y-2">
                <Label htmlFor="jo" className="text-sm font-semibold text-gray-900">
                  Service Assignment:
                </Label>
                <Select value={selectedSA} onValueChange={setSelectedSA}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select Service Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {loadingSAs ? (
                      <SelectItem value="loading" disabled>
                        Loading service assignments...
                      </SelectItem>
                    ) : serviceAssignments.length === 0 ? (
                      <SelectItem value="no-sas" disabled>
                        No service assignments found for this site
                      </SelectItem>
                    ) : (
                      serviceAssignments.map((sa) => (
                        <SelectItem key={sa.id} value={sa.saNumber}>
                          {sa.saNumber} - {sa.projectSiteName} ({sa.serviceType})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Report Type */}
            <div className="space-y-2">
              <Label htmlFor="report-type" className="text-sm font-semibold text-gray-900">
                Report Type:
              </Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completion-report">Completion Report</SelectItem>
                  <SelectItem value="monitoring-report">Monitoring Report</SelectItem>
                  <SelectItem value="installation-report">Installation Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-semibold text-gray-900">
                Date:
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="AutoFill"
                className="h-9 text-sm"
              />
            </div>
            {/* Installation Report Specific Fields */}
            {reportType === "installation-report" && (
              <>
                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-semibold text-gray-900">
                    Status:
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="status"
                      type="number"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      placeholder="0"
                      className="h-9 text-sm flex-1"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-gray-600 font-medium">% of 100</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-900">Timeline:</Label>
                  <RadioGroup value={timeline} onValueChange={setTimeline} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="on-time" id="on-time" className="h-4 w-4" />
                      <Label htmlFor="on-time" className="text-sm font-medium">
                        On Time
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delayed" id="delayed" className="h-4 w-4" />
                      <Label htmlFor="delayed" className="text-sm font-medium">
                        Delayed
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Delay Details */}
                  {timeline === "delayed" && (
                    <div className="space-y-2 mt-3 pl-6 border-l-2 border-red-200">
                      <Input
                        placeholder="Reason for delay..."
                        value={delayReason}
                        onChange={(e) => setDelayReason(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={delayDays}
                          onChange={(e) => setDelayDays(e.target.value)}
                          placeholder="0"
                          className="h-9 text-sm flex-1"
                          min="0"
                        />
                        <span className="text-sm text-gray-600 font-medium">Days</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Attachments */}
            {(reportType === "completion-report" || reportType === "installation-report") ? (
              <div className="space-y-4">
                <Label className="text-sm font-semibold text-gray-900">
                  Images: <span className="text-red-500">*</span>
                </Label>

                {/* Before Images */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">Before</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addBeforeImage}
                      className="h-6 w-6 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {beforeImages.map((image, index) => (
                      <div key={`before-${index}`} className="space-y-1">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg h-16 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center relative">
                          <input
                            type="file"
                            className="hidden"
                            id={`before-file-${index}`}
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            onChange={(e) => handleBeforeImageUpload(index, e)}
                            disabled={image.uploading}
                          />
                          {renderImagePreview(image, `before-file-${index}`, "before")}
                          {beforeImages.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                removeBeforeImage(index)
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <Input
                          placeholder="Add Note..."
                          value={image.note}
                          onChange={(e) => handleBeforeImageNoteChange(index, e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* After Images */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">After</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAfterImage}
                      className="h-6 w-6 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {afterImages.map((image, index) => (
                      <div key={`after-${index}`} className="space-y-1">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg h-16 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center relative">
                          <input
                            type="file"
                            className="hidden"
                            id={`after-file-${index}`}
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            onChange={(e) => handleAfterImageUpload(index, e)}
                            disabled={image.uploading}
                          />
                          {renderImagePreview(image, `after-file-${index}`, "After")}
                          {afterImages.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                removeAfterImage(index)
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <Input
                          placeholder="Add Note..."
                          value={image.note}
                          onChange={(e) => handleAfterImageNoteChange(index, e.target.value)}
                          className="text-xs h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">
                  Attachments: <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="space-y-1">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg h-16 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center">
                        <input
                          type="file"
                          className="hidden"
                          id={`file-${index}`}
                          accept=".jpg,.jpeg,.png,.gif,.webp"
                          onChange={(e) => handleFileUpload(index, e)}
                          disabled={attachment.uploading}
                        />
                        {renderFilePreview(attachment, index)}
                      </div>
                      <Input
                        placeholder="Add Note..."
                        value={attachment.note}
                        onChange={(e) => handleAttachmentNoteChange(index, e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description of Work - Only show for completion reports */}
            {reportType === "completion-report" && (
              <div className="space-y-2">
                <Label htmlFor="descriptionOfWork" className="text-sm font-semibold text-gray-900">
                  Description of Work:
                </Label>
                <textarea
                  id="descriptionOfWork"
                  value={descriptionOfWork}
                  onChange={(e) => setDescriptionOfWork(e.target.value)}
                  placeholder="Enter detailed description of work completed..."
                  className="w-full h-20 p-2 border border-gray-300 rounded-md text-sm resize-y"
                  rows={4}
                />
              </div>
            )}

            {/* Generate Report Button */}
            <Button
              onClick={handleGenerateReport}
              disabled={loading || [...beforeImages, ...afterImages, ...attachments].some((att) => att.uploading)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-sm font-medium mt-4"
            >
              {loading
                ? "Generating..."
                : [...beforeImages, ...afterImages, ...attachments].some((att) => att.uploading)
                ? "Uploading images..."
                : "Generate Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Preview Modal */}
      <Dialog open={previewModal.open} onOpenChange={(open) => setPreviewModal({ open })}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <button
              onClick={() => setPreviewModal({ open: false })}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full"
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </button>

            {previewModal.preview && (
              <img
                src={previewModal.preview || "/placeholder.svg"}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ReportPostSuccessDialog
        open={showSuccessDialog}
        onOpenChange={(open) => {
          setShowSuccessDialog(open)
          if (!open && successReportId) {
            const redirectPath = `/logistics/reports/${successReportId}`
            router.push(redirectPath)
          }
        }}
        reportId={successReportId}
        message="Congratulations You have successfully posted a report!"
      />

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}
