"use client"
import { useEffect, useState, useCallback, use } from "react"
import type React from "react"

import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  getQuotationById,
  getQuotationsByPageId,
  updateQuotationStatus,
  updateQuotation,
  getQuotationsByProductIdAndCompanyId,
  calculateProratedPrice,
  generateAndUploadQuotationPDF,
} from "@/lib/quotation-service"
import type { Quotation, QuotationProduct } from "@/lib/types/quotation"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  DownloadIcon,
  FileText,
  Loader2,
  LayoutGrid,
  Pencil,
  Save,
  X,
  Building,
  ImageIcon,
} from "lucide-react"
import { getProposal } from "@/lib/proposal-service"
import type { Proposal } from "@/lib/types/proposal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { generateQuotationPDF } from "@/lib/quotation-pdf-service" // Use quotation PDF service
import { QuotationSentSuccessDialog } from "@/components/quotation-sent-success-dialog" // Use quotation success dialog
import { SendQuotationOptionsDialog } from "@/components/send-quotation-options-dialog" // Use quotation options dialog
import { db, getDoc, doc } from "@/lib/firebase" // Import Firebase functions
import { generateSeparateQuotationPDFs } from "@/lib/quotation-pdf-service"
import { Timestamp } from "firebase/firestore"
import { getUserById, type User } from "@/lib/access-management-service"

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
    companyData.address?.street,
    companyData.address?.city,
    companyData.address?.province,
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

const formatTime = (time: any): string => {
  if (!time) return "N/A"
  try {
    // If it's already a formatted time string, return as is
    if (typeof time === "string") return time
    // If it's a Date object, format it
    if (time instanceof Date) {
      return time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
    }
    return String(time)
  } catch (error) {
    console.error("Error formatting time:", error)
    return "Invalid Time"
  }
}

const calculateHours = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime || startTime === "N/A" || endTime === "N/A") return 0

  try {
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    let diffMinutes = endMinutes - startMinutes
    if (diffMinutes < 0) diffMinutes += 24 * 60 // Handle overnight operation

    return Math.floor(diffMinutes / 60)
  } catch (error) {
    console.error("Error calculating hours:", error)
    return 0
  }
}

const formatDuration = (days: number, startDate?: Date | any, endDate?: Date | any) => {
  let totalDays = days
  if (startDate && endDate) {
    const start = getDateObject(startDate)
    const end = getDateObject(endDate)

    if (start && end) {
      totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }
  }

  return `${totalDays} ${totalDays === 1 ? "day" : "days"}`
}

const safeFormatNumber = (value: any, options?: Intl.NumberFormatOptions): string => {
  if (value === null || value === undefined) return "0.00"
  let numValue: number
  if (typeof value === "string") {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.-]/g, '')
    numValue = Number.parseFloat(cleaned)
  } else {
    numValue = Number(value)
  }
  if (isNaN(numValue)) return "0.00"
  return numValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
}

const formatCurrency = (amount: number | string | undefined | null) => {
  if (!amount || amount === 0) return "PHP 0.00"
  const numAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount
  if (isNaN(numAmount)) return "PHP 0.00"
  return `PHP ${numAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}


export default function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: quotationId } = use(params)
  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [editableQuotation, setEditableQuotation] = useState<Quotation | null>(null)
  const [relatedQuotations, setRelatedQuotations] = useState<Quotation[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = useState(false)
  const [isSendOptionsDialogOpen, setIsSendOptionsDialogOpen] = useState(false)
  const [ccEmail, setCcEmail] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [downloadingImage, setDownloadingImage] = useState(false)
  const [showPageSelection, setShowPageSelection] = useState(false)
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [projectData, setProjectData] = useState<{ company_logo?: string; company_name?: string } | null>(null)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [clientHistory, setClientHistory] = useState<Quotation[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [pdfPreviewDialogOpen, setPdfPreviewDialogOpen] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Quotation | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [loadingPdfPreview, setLoadingPdfPreview] = useState(false)
  const [preparingSend, setPreparingSend] = useState(false)
  const [preparingDownload, setPreparingDownload] = useState(false)
  const [userSignatureUrl, setUserSignatureUrl] = useState<string | null>(null)
  const [creatorUser, setCreatorUser] = useState<User | null>(null)

  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValues, setTempValues] = useState<Record<string, any>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleFieldEdit = (fieldName: string, currentValue: any) => {
    setEditingField(fieldName)
    if (fieldName === "contractPeriod") {
      setTempValues({
        ...tempValues,
        start_date: getDateObject(currentValue.start_date),
        end_date: getDateObject(currentValue.end_date)
      })
    } else {
      setTempValues({ ...tempValues, [fieldName]: currentValue })
    }
    setHasUnsavedChanges(true)
  }

  const updateTempValues = (fieldName: string, newValue: any) => {
    const updatedTempValues = { ...tempValues, [fieldName]: newValue }
    setTempValues(updatedTempValues)

    // Update the editable quotation with the new value
    if (editableQuotation) {
      if (fieldName === "duration_days") {
        // When duration changes, update contract period and pricing
        const durationDays = newValue
        const startDate = getDateObject(editableQuotation.start_date) || new Date()
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + durationDays - 1)

        // Update pricing based on prorated calculation
        const price = editableQuotation.items?.price || 0
        const newTotalAmount = calculateProratedPrice(price, startDate, endDate)

        setEditableQuotation({
          ...editableQuotation,
          duration_days: durationDays,
          end_date: Timestamp.fromDate(endDate),
          items: { ...editableQuotation.items, duration_days: durationDays, item_total_amount: newTotalAmount },
        })

        // Update temp values for contract period
        setTempValues((prev) => ({
          ...prev,
          duration_days: durationDays,
          end_date: endDate,
        }))
      } else if (fieldName === "start_date" || fieldName === "end_date") {
        // When contract period changes, update duration and pricing
        const startDate =
          fieldName === "start_date" ? new Date(newValue) : (getDateObject(editableQuotation.start_date) || new Date())
        const endDate =
          fieldName === "end_date" ? new Date(newValue) : (getDateObject(editableQuotation.end_date) || new Date())

        const timeDiff = endDate.getTime() - startDate.getTime()
        const durationDays = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1

        // Update pricing based on prorated calculation
        const price = editableQuotation.items?.price || 0
        const newTotalAmount = calculateProratedPrice(price, startDate, endDate)

        setEditableQuotation({
          ...editableQuotation,
          [fieldName]: Timestamp.fromDate(newValue),
          duration_days: durationDays,
          items: { ...editableQuotation.items, duration_days: durationDays, item_total_amount: newTotalAmount },
        })

        // Update temp values for duration
        setTempValues((prev) => ({
          ...prev,
          [fieldName]: newValue,
          duration_days: durationDays,
        }))
      } else if (fieldName === "price" && editableQuotation.items) {
        const startDate = getDateObject(editableQuotation.start_date) || new Date()
        const endDate = getDateObject(editableQuotation.end_date) || new Date()
        const newTotalAmount = calculateProratedPrice(newValue, startDate, endDate)

        setEditableQuotation({
          ...editableQuotation,
          items: { ...editableQuotation.items, price: newValue, item_total_amount: newTotalAmount },
        })
      } else if (fieldName === "salutation" || fieldName === "greeting") {
        setEditableQuotation({
          ...editableQuotation,
          template: {
            ...editableQuotation.template,
            [fieldName]: newValue,
          },
        })
      } else if (fieldName === "site_notes" || fieldName === "price_notes") {
        setEditableQuotation({
          ...editableQuotation,
          items: {
            ...editableQuotation.items,
            [fieldName]: newValue,
          },
        })
      } else if (fieldName === "terms_and_conditions") {
        setEditableQuotation({
          ...editableQuotation,
          template: {
            ...editableQuotation.template,
            terms_and_conditions: newValue,
          },
        })
      } else if (fieldName === "closing_message") {
        setEditableQuotation({
          ...editableQuotation,
          template: {
            ...editableQuotation.template,
            closing_message: newValue,
          },
        })
      } else {
        setEditableQuotation({
          ...editableQuotation,
          [fieldName]: newValue,
        })
      }
    }
  }

  const fetchQuotationHistory = useCallback(async () => {
    if (!quotation?.items?.product_id || !quotation?.company_id) return

    setLoadingHistory(true)
    try {
      const productId = quotation.items.product_id
      const companyId = quotation.company_id
      const history = await getQuotationsByProductIdAndCompanyId(productId, companyId)
      // Filter out current quotation from history
      const filteredHistory = history.filter((q) => q.id !== quotation.id)
      setClientHistory(filteredHistory)
    } catch (error) {
      console.error("Error fetching quotation history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }, [quotation?.items?.product_id, quotation?.company_id, quotation?.id])

  const fetchCompanyData = useCallback(async () => {
    if (!user || !userData) {
      console.log("[v0] fetchCompanyData: Missing user or userData", { user: !!user, userData: !!userData })
      return
    }

    try {
      console.log("[v0] fetchCompanyData: userData:", userData)
      console.log("[v0] fetchCompanyData: userData.company_id:", userData.company_id)

      if (!userData.company_id) {
        console.warn("[v0] No company_id found in userData:", userData)
        return
      }

      console.log("[v0] Fetching company data for company_id:", userData.company_id)
      const companyDoc = await getDoc(doc(db, "companies", userData.company_id))

      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as CompanyData
        console.log("[v0] Company data fetched successfully:", companyData)
        setCompanyData(companyData)
      } else {
        console.warn("[v0] No company data found for company_id:", userData.company_id)
      }
    } catch (error) {
      console.error("[v0] Error fetching company data:", error)
    }
  }, [user, userData])

  const fetchRelatedQuotations = useCallback(async (currentQuotation: Quotation) => {
    if (currentQuotation.page_id) {
      console.log("[v0] Fetching related quotations for page_id:", currentQuotation.page_id)
      const relatedCEs = await getQuotationsByPageId(currentQuotation.page_id)
      console.log("[v0] Related quotations found:", relatedCEs.length, relatedCEs)

      // Sort all quotations by page_number (including current)
      const sortedRelated = relatedCEs.sort((a, b) => (a.page_number || 0) - (b.page_number || 0))

      setRelatedQuotations(sortedRelated)

      // Find current page index based on the current quotation's ID
      const currentIndex = sortedRelated.findIndex((ce) => ce.id === currentQuotation.id)
      console.log("[v0] Current page index:", currentIndex)
      setCurrentPageIndex(currentIndex >= 0 ? currentIndex : 0)
    } else {
      console.log("[v0] No page_id found for this quotation")
      setRelatedQuotations([])
      setCurrentPageIndex(0)
    }
  }, [])

  useEffect(() => {
    const fetchQuotationData = async () => {
      if (!quotationId) return

      setLoading(true)
      try {
        const q = await getQuotationById(quotationId)
        if (q) {
          console.log("[v0] Loaded quotation data:", q)
          console.log("[v0] Items array:", q.items)
          console.log("[v0] Item:", q.items)

          setQuotation(q)
          setEditableQuotation({ ...q }) // Create proper deep copy

          console.log("[v0] Current quotation proposalId:", q.proposalId)

          if (q.proposalId) {
            const linkedProposal = await getProposal(q.proposalId)
            setProposal(linkedProposal)
          }

          // Fetch related quotations
          await fetchRelatedQuotations(q)

        } else {
          toast({
            title: "Quotation Not Found", // Updated title
            description: "The quotation you're looking for doesn't exist.",
            variant: "destructive",
          })
          router.push("/sales/quotations-list") // Navigate to quotations list
        }
      } catch (error) {
        console.error("Error fetching quotation:", error) // Updated error message
        toast({
          title: "Error",
          description: "Failed to load quotation. Please try again.", // Updated description
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchQuotationData()
  }, [quotationId, router, toast, fetchRelatedQuotations])

  useEffect(() => {
    console.log("[v0] useEffect triggered - user:", !!user, "userData:", !!userData)
    if (user && userData) {
      console.log("[v0] Calling fetchCompanyData")
      fetchCompanyData()
    }
  }, [user, userData, fetchCompanyData])

  useEffect(() => {
    if (quotation?.items?.product_id) {
      fetchQuotationHistory()
    }
  }, [fetchQuotationHistory])


  // Fetch creator user data
  useEffect(() => {
    const fetchCreatorUser = async () => {
      if (!quotation?.created_by) return

      try {
        const creator = await getUserById(quotation.created_by)
        setCreatorUser(creator)
        setUserSignatureUrl(creator?.signature.url || null)
      } catch (error) {
        console.error("Error fetching creator user:", error)
      }
    }

    fetchCreatorUser()
  }, [quotation?.created_by])

  // Handle automatic share when page loads with action parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const action = searchParams.get("action")

    if (action === "share" && quotation && !loading) {
      // Small delay to ensure the quotation is fully rendered
      setTimeout(() => {
        setIsSendOptionsDialogOpen(true)
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 1000)
    }
  }, [quotation, loading])

  useEffect(() => {
    if (isSendEmailDialogOpen && quotation) {
      setEmailSubject(`Quotation: ${quotation.quotation_number || "Custom Quotation"} - Boohk`) // Updated subject
      setEmailBody(
        `Dear ${quotation.client_name || "Valued Client"},

We are pleased to provide you with a detailed quotation for your advertising campaign. Please find the full quotation attached and accessible via the link below.

Thank you for considering Boohk for your advertising needs. We look forward to working with you to bring your campaign to life!

Best regards,
The Boohk Team`,
      )
      if (user?.email) {
        setCcEmail(user.email)
      } else {
        setCcEmail("")
      }
    }
  }, [isSendEmailDialogOpen, quotation, user?.email]) // Use quotation

  const getCurrentQuotation = () => {
    if (relatedQuotations.length > 0 && currentPageIndex >= 0 && currentPageIndex < relatedQuotations.length) {
      return relatedQuotations[currentPageIndex]
    }
    return quotation
  }

  const getCurrentItem = () => {
    const currentQuotation = getCurrentQuotation()
    return currentQuotation?.items || null
  }

  const handleEditClick = () => {
    const currentQuotation = getCurrentQuotation()
    if (currentQuotation) {
      console.log("[v0] Entering edit mode with data:", currentQuotation)
      setEditableQuotation({ ...currentQuotation }) // Create proper copy
      setTempValues({
        terms_and_conditions: currentQuotation?.template?.terms_and_conditions || [
          "Quotation validity: 5 working days.",
          "Site availability: First-come-first-served basis. Official documents required.",
          "Payment terms: One month advance and two months security deposit.",
          "Payment deadline: 7 days before rental start.",
        ]
      }) // Set default terms
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    const currentQuotation = getCurrentQuotation()
    if (currentQuotation) {
      console.log("[v0] Canceling edit mode, restoring data:", currentQuotation)
      setEditableQuotation({ ...currentQuotation }) // Restore original data
      setTempValues({}) // Clear temp values
      setIsEditing(false)
      setHasUnsavedChanges(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!editableQuotation) return

    setIsSaving(true)
    try {
      console.log("[v0] Saving changes:", editableQuotation)

      // First, generate the PDF before saving the quotation data
      console.log("[v0] Generating new PDF before saving changes")

      // Prepare logo data URL if company logo exists
      let logoDataUrl: string | null = null
      if (companyData?.logo) {
        try {
          const logoResponse = await fetch(companyData.logo)
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob()
            logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(logoBlob)
          })
          }
        } catch (error) {
          console.error('Error fetching company logo:', error)
          // Continue without logo if fetch fails
        }
      }

      // Prepare signature data URL if user signature exists
      let userSignatureDataUrl: string | null = null
      if (userSignatureUrl) {
        try {
          const signatureResponse = await fetch(userSignatureUrl)
          if (signatureResponse.ok) {
            const signatureBlob = await signatureResponse.blob()
            userSignatureDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(signatureBlob)
            })
          }
        } catch (error) {
          console.error('Error fetching user signature:', error)
          // Continue without signature if fetch fails
        }
      }

      // Fetch signature date directly if not available from creatorUser
      let signatureDate: Date | null = null
      if (editableQuotation.created_by) {
        try {
          const userDocRef = doc(db, "iboard_users", editableQuotation.created_by)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('Error fetching signature date:', error)
        }
      }

      const { pdfUrl, password } = await generateAndUploadQuotationPDF(editableQuotation, companyData, logoDataUrl, creatorUser, userSignatureDataUrl)

      // Only save the quotation data if PDF generation succeeded
      await updateQuotation(
        editableQuotation.id!,
        editableQuotation,
        editableQuotation.created_by || "system",
        `${editableQuotation.created_by_first_name || "User"} ${editableQuotation.created_by_last_name || ""}`,
      )

      // Update quotation with new PDF URL and password
      await updateQuotation(
        editableQuotation.id!,
        { pdf: pdfUrl, password: password, signature_date: signatureDate },
        creatorUser?.id || "system",
        creatorUser?.displayName || "System"
      )

      // Update local state
      setQuotation(editableQuotation)
      // Update the quotation in relatedQuotations if it exists there
      setRelatedQuotations(prev =>
        prev.map(q => q.id === editableQuotation.id ? { ...editableQuotation, pdf: pdfUrl, password: password } : q)
      )

      setIsEditing(false)
      setHasUnsavedChanges(false)
      toast({
        title: "Success",
        description: "Quotation updated successfully.",
      })

      // Refresh data from server
      const refreshedQuotation = await getQuotationById(quotationId)
      if (refreshedQuotation) {
        setQuotation(refreshedQuotation)
        setEditableQuotation({ ...refreshedQuotation })
        await fetchRelatedQuotations(refreshedQuotation)
      }

      console.log("[v0] PDF generated and quotation saved successfully:", pdfUrl)
    } catch (error) {
      console.error("Error saving quotation or generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to save changes. PDF generation failed. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditableQuotation((prev) => ({
      ...prev!,
      [name]: value,
    }))
  }

  const handleDateChange = (date: Date | undefined, field: "start_date" | "end_date") => {
    setEditableQuotation((prev) => ({
      ...prev!,
      [field]: date || new Date(),
    }))
  }

  const handleDownloadPDF = async () => {
    if (!quotation) return

    setDownloadingPDF(true)
    try {
      // Check if signature dates match - if not, force regeneration
      let forceRegenerate = false
      if (quotation.created_by && creatorUser?.signature?.updated) {
        const quotationSignatureDate = quotation.signature_date ? new Date(quotation.signature_date) : null
        const userSignatureDate = creatorUser.signature.updated.toDate ? creatorUser.signature.updated.toDate() : new Date(creatorUser.signature.updated)

        if (!quotationSignatureDate || quotationSignatureDate.getTime() !== userSignatureDate.getTime()) {
          forceRegenerate = true
        }
      }

      // Ensure PDF is generated and saved if not already done
      await generatePDFIfNeeded(quotation, forceRegenerate)
      // Prepare logo data URL if company logo exists
      let logoDataUrl: string | null = null
      if (companyData?.logo) {
        try {
          const logoResponse = await fetch(companyData.logo)
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob()
            logoDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(logoBlob)
            })
          }
        } catch (error) {
          console.error('Error fetching company logo:', error)
          // Continue without logo if fetch fails
        }
      }
      // Check if there are multiple related quotations (same page_id)
      if (relatedQuotations.length > 1) {
        console.log("[v0] Downloading multiple quotation PDFs:", relatedQuotations.length)

        // Generate PDFs for all related quotations if needed and collect pdfUrls
        const quotationData = []
        for (const relatedQuotation of relatedQuotations) {
          // Check if signature dates match for each related quotation
          let forceRegenerate = false
          if (relatedQuotation.created_by && creatorUser?.signature?.updated) {
            const quotationSignatureDate = relatedQuotation.signature_date ? new Date(relatedQuotation.signature_date) : null
            const userSignatureDate = creatorUser.signature.updated.toDate ? creatorUser.signature.updated.toDate() : new Date(creatorUser.signature.updated)

            if (!quotationSignatureDate || quotationSignatureDate.getTime() !== userSignatureDate.getTime()) {
              forceRegenerate = true
            }
          }

          const { pdfUrl } = await generatePDFIfNeeded(relatedQuotation, forceRegenerate)
          if (pdfUrl) {
            quotationData.push({ quotation: relatedQuotation, pdfUrl })
          }
        }

        // Download all related quotations as separate PDFs from saved URLs
        for (let i = 0; i < quotationData.length; i++) {
          const { quotation: relatedQuotation, pdfUrl } = quotationData[i]

          // Create unique quotation number with suffix
          const baseQuotationNumber = relatedQuotation.quotation_number || relatedQuotation.id?.slice(-8) || "QT-000"
          const uniqueQuotationNumber = `${baseQuotationNumber}-${String.fromCharCode(65 + i)}` // Appends -A, -B, -C, etc.

          // Download from the saved PDF URL
          const response = await fetch(pdfUrl)
          if (!response.ok) {
            console.error('Failed to download PDF from:', pdfUrl)
            continue
          }

          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${uniqueQuotationNumber}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)

          // Add small delay between downloads to ensure proper file naming
          if (i < quotationData.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }

        toast({
          title: "PDFs Downloaded",
          description: `${quotationData.length} PDF files have been downloaded for all pages.`,
        })
      } else {
        // Single quotation
        // Ensure PDF is generated and saved if not already done
        await generatePDFIfNeeded(quotation)

        if (!quotation.pdf) {
          throw new Error("Failed to generate PDF")
        }

        // Download from the saved PDF URL
        const response = await fetch(quotation.pdf)
        if (!response.ok) {
          console.error('Failed to download PDF from:', quotation.pdf)
          throw new Error("Failed to download PDF")
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${quotation.quotation_number || quotation.id || 'quotation'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Success",
          description: "PDF downloaded successfully",
        })
      }
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handleDownloadImage = async () => {
    if (!quotation) return

    // Check if any PDFs need to be generated
    const needsPDFGeneration = relatedQuotations.length > 1
      ? relatedQuotations.some(q => !q.pdf || q.pdf.trim() === "")
      : !quotation.pdf || quotation.pdf.trim() === ""

    if (needsPDFGeneration) {
      setPreparingDownload(true)
    }

    setDownloadingImage(true)
    try {
      // Check if there are multiple related quotations (same page_id)
      if (relatedQuotations.length > 1) {
        console.log("[v0] Downloading multiple quotation PDFs:", relatedQuotations.length)

        // Generate PDFs for all related quotations if needed and collect pdfUrls
        const quotationData = []
        for (const relatedQuotation of relatedQuotations) {
          // Check if signature dates match for each related quotation
          let forceRegenerate = false
          if (relatedQuotation.created_by && creatorUser?.signature?.updated) {
            const quotationSignatureDate = relatedQuotation.signature_date ? new Date(relatedQuotation.signature_date) : null
            const userSignatureDate = creatorUser.signature.updated.toDate ? creatorUser.signature.updated.toDate() : new Date(creatorUser.signature.updated)

            if (!quotationSignatureDate || quotationSignatureDate.getTime() !== userSignatureDate.getTime()) {
              forceRegenerate = true
            }
          }

          const { pdfUrl } = await generatePDFIfNeeded(relatedQuotation, forceRegenerate)
          if (pdfUrl) {
            quotationData.push({ quotation: relatedQuotation, pdfUrl })
          }
        }

        // Download all related quotations as separate PDFs from saved URLs
        for (let i = 0; i < quotationData.length; i++) {
          const { quotation: relatedQuotation, pdfUrl } = quotationData[i]

          // Create unique quotation number with suffix
          const baseQuotationNumber = relatedQuotation.quotation_number || relatedQuotation.id?.slice(-8) || "QT-000"
          const uniqueQuotationNumber = `${baseQuotationNumber}-${String.fromCharCode(65 + i)}` // Appends -A, -B, -C, etc.

          // Download from the saved PDF URL
          const response = await fetch(pdfUrl)
          if (!response.ok) {
            console.error('Failed to download PDF from:', pdfUrl)
            continue
          }

          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${uniqueQuotationNumber}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)

          // Add small delay between downloads to ensure proper file naming
          if (i < quotationData.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }

        toast({
          title: "PDFs Downloaded",
          description: `${quotationData.length} PDF files have been downloaded for all pages.`,
        })
      } else {
        // Single quotation
        // Ensure PDF is generated and saved if not already done
        const { pdfUrl } = await generatePDFIfNeeded(quotation)

        if (!pdfUrl) {
          throw new Error("Failed to generate PDF")
        }

        // Download from the saved PDF URL
        const response = await fetch(pdfUrl)
        if (!response.ok) {
          console.error('Failed to download PDF from:', pdfUrl)
          throw new Error("Failed to download PDF")
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${quotation.quotation_number || quotation.id || 'quotation'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Success",
          description: "PDF downloaded successfully",
        })
      }
    } catch (error) {
      console.error("Error generating image:", error)
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDownloadingImage(false)
      if (needsPDFGeneration) {
        setPreparingDownload(false)
      }
    }
  }

  const handleStatusUpdate = async (newStatus: Quotation["status"]) => {
    if (!quotation || !quotation.id) return

    try {
      await updateQuotationStatus(quotation.id, newStatus)
      setQuotation({ ...quotation, status: newStatus })
      setEditableQuotation((prev) => (prev ? { ...prev, status: newStatus } : null))
      toast({
        title: "Success",
        description: `Quotation status updated to ${newStatus}`,
      })
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update quotation status",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-gray-100 text-gray-800"
      case "sent":
        return "bg-blue-100 text-blue-800"
      case "accepted":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "expired":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handlePreviousPage = () => {
    if (currentPageIndex > 0) {
      const prevQuotation = relatedQuotations[currentPageIndex - 1]
      router.push(`/sales/quotations/${prevQuotation.id}`)
    }
  }

  const handleNextPage = () => {
    if (currentPageIndex < relatedQuotations.length - 1) {
      const nextQuotation = relatedQuotations[currentPageIndex + 1]
      router.push(`/sales/quotations/${nextQuotation.id}`)
    }
  }

  const handlePageSelect = (pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < relatedQuotations.length) {
      const selectedQuotation = relatedQuotations[pageIndex]
      router.push(`/sales/quotations/${selectedQuotation.id}`)
    }
  }

  const handleHistoryItemClick = async (historyItem: Quotation) => {
    setSelectedHistoryItem(historyItem)
    setLoadingPdfPreview(true)
    setPdfPreviewDialogOpen(true)

    try {
      // Check if quotation already has a PDF
      if (historyItem.pdf && historyItem.pdf.trim() !== "") {
        setPdfPreviewUrl(historyItem.pdf)
      } else {
        // If no PDF exists, generate one
        // Fetch signature date directly if not available from creatorUser
        let signatureDate: Date | null = null
        if (historyItem.created_by) {
          try {
            const userDocRef = doc(db, "iboard_users", historyItem.created_by)
            const userDoc = await getDoc(userDocRef)

            if (userDoc.exists()) {
              const userDataFetched = userDoc.data()
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
              }
            }
          } catch (error) {
            console.error('Error fetching signature date:', error)
          }
        }

        // Prepare logo data URL if company logo exists
        let logoDataUrl: string | null = null
        if (companyData?.logo) {
          try {
            const logoResponse = await fetch(companyData.logo)
            if (logoResponse.ok) {
              const logoBlob = await logoResponse.blob()
              logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(logoBlob)
              })
            }
          } catch (error) {
            console.error('Error fetching company logo:', error)
          }
        }

        // Prepare quotation data for API (convert Timestamps to serializable format)
        const serializableQuotation = {
          ...historyItem,
          created: historyItem.created?.toDate ? historyItem.created.toDate().toISOString() : historyItem.created,
          updated: historyItem.updated?.toDate ? historyItem.updated.toDate().toISOString() : historyItem.updated,
          valid_until: historyItem.valid_until?.toDate ? historyItem.valid_until.toDate().toISOString() : historyItem.valid_until,
          start_date: historyItem.start_date?.toDate ? historyItem.start_date.toDate().toISOString() : historyItem.start_date,
          end_date: historyItem.end_date?.toDate ? historyItem.end_date.toDate().toISOString() : historyItem.end_date,
        }

        // Call the generate-quotation-pdf API
        const response = await fetch('/api/generate-quotation-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quotation: serializableQuotation,
            companyData,
            logoDataUrl,
            creatorUser,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Error:', response.status, errorText)
          throw new Error(`Failed to generate PDF: ${response.status} ${errorText}`)
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)

        // Save the generated PDF URL to the quotation
        try {
          const { pdfUrl } = await generateAndUploadQuotationPDF(historyItem)
          await updateQuotation(
            historyItem.id!,
            { pdf: pdfUrl, signature_date: signatureDate },
            creatorUser?.id || "system",
            creatorUser?.displayName || "System"
          )
          console.log("PDF saved to quotation:", pdfUrl)
        } catch (saveError) {
          console.error("Error saving PDF to quotation:", saveError)
          // Continue with preview even if save fails
        }

        setPdfPreviewUrl(url)
      }
    } catch (error) {
      console.error("Error loading PDF preview:", error)
      toast({
        title: "Error",
        description: "Failed to load PDF preview",
        variant: "destructive",
      })
      setPdfPreviewDialogOpen(false)
    } finally {
      setLoadingPdfPreview(false)
    }
  }

  const handleClosePdfPreview = () => {
    setPdfPreviewDialogOpen(false)
    setSelectedHistoryItem(null)
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(null)
    }
  }

  const handleAddTerm = () => {
    const currentTerms = tempValues.terms_and_conditions || editableQuotation?.template?.terms_and_conditions || [
      "Quotation validity: 5 working days.",
      "Site availability: First-come-first-served basis. Official documents required.",
      "Payment terms: One month advance and two months security deposit.",
      "Payment deadline: 7 days before rental start.",
    ]
    const newTerms = [...currentTerms, ""]
    setEditableQuotation({
      ...editableQuotation!,
      template: {
        ...editableQuotation?.template,
        terms_and_conditions: newTerms,
      },
    })
    setTempValues({
      ...tempValues,
      terms_and_conditions: newTerms,
    })
    setHasUnsavedChanges(true)
  }

  const handleUpdateTerm = (index: number, value: string) => {
    const currentTerms = tempValues.terms_and_conditions || editableQuotation?.template?.terms_and_conditions || []
    const newTerms = [...currentTerms]
    newTerms[index] = value
    setTempValues({
      ...tempValues,
      terms_and_conditions: newTerms,
    })
    setEditableQuotation({
      ...editableQuotation!,
      template: {
        ...editableQuotation?.template,
        terms_and_conditions: newTerms,
      },
    })
  }

  const handleRemoveTerm = (index: number) => {
    const currentTerms = tempValues.terms_and_conditions || editableQuotation?.template?.terms_and_conditions || []
    const newTerms = currentTerms.filter((_: string, i: number) => i !== index)
    setTempValues({
      ...tempValues,
      terms_and_conditions: newTerms,
    })
    setEditableQuotation({
      ...editableQuotation!,
      template: {
        ...editableQuotation?.template,
        terms_and_conditions: newTerms,
      },
    })
    setHasUnsavedChanges(true)
  }

  const renderQuotationBlock = (siteName: string, items: QuotationProduct, pageNumber: number) => {
    const currentQuotation = editableQuotation || quotation
    if (!currentQuotation) return null

    const item = items
    const monthlyRate = item?.price || 0
    const durationMonths = Math.ceil((Number(item?.duration_days) || 40) / 30)
    const totalLease = monthlyRate * durationMonths
    const vatAmount = totalLease * 0.12
    const totalWithVat = totalLease + vatAmount

    return (
      <div key={siteName} className="px-8 bg-white">
        {/* Header Section */}
        <div className="text-center mb-8"></div>

        <div id="quotation-body">
          {/* Date */}
          <div className="text-left mb-8">
            <p className="text-base">{format(new Date(), "MMMM dd, yyyy")}</p>
          </div>

        {/* Client and RFQ Info */}
        <div className="flex justify-between items-start mb-8">
          <div className="text-left">
            <p className="text-base ">{currentQuotation.client_name || "Client Name"}</p>
            <p className="text-base ">{currentQuotation.client_designation || "Position"}</p>
            <p className="text-base font-bold">{currentQuotation.client_company_name || "COMPANY NAME"}</p>
          </div>
          <div className="text-right">
            <p className="text-base">RFQ. No. {currentQuotation.quotation_number}</p>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900 mb-4">{item?.name || "Site Name"} - Quotation</h1>
        </div>

        {/* Salutation */}
        <div className="text-left mb-4">
          <p className="text-base">
            Dear {isEditing && editingField === "salutation" ? (
              <select
                value={tempValues.salutation || currentQuotation?.template?.salutation || "Mr."}
                onChange={(e) => updateTempValues("salutation", e.target.value)}
                className="border border-gray-300 rounded px-1 py-0 text-sm"
              >
                <option value="Mr.">Mr.</option>
                <option value="Ms.">Ms.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Miss">Miss</option>
              </select>
            ) : (
              <span
                className={isEditing ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : ""}
                onClick={() => isEditing && handleFieldEdit("salutation", currentQuotation?.template?.salutation || "Mr.")}
                title={isEditing ? "Click to edit salutation" : ""}
              >
                {currentQuotation?.template?.salutation || "Mr."}
                {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
              </span>
            )} {currentQuotation?.client_name?.split(' ').pop() || 'Client'},
          </p>
        </div>

        {/* Greeting */}
        <div className="text-left mb-8">
          {isEditing && editingField === "greeting" ? (
            <textarea
              value={tempValues.greeting || currentQuotation?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`}
              onChange={(e) => updateTempValues("greeting", e.target.value)}
              className="w-full text-left text-base border border-gray-300 rounded p-2"
              rows={2}
              placeholder="Enter greeting text"
            />
          ) : (
            <div
              className={isEditing ? "cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : ""}
              onClick={() => isEditing && handleFieldEdit("greeting", currentQuotation?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`)}
              title={isEditing ? "Click to edit greeting" : ""}
            >
              <p className="text-base">
                {currentQuotation?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`}
              </p>
              {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
            </div>
          )}
        </div>

        {/* Details Header */}
        <div className="text-left mb-1">
          <p className="text-base font-semibold">Site details:</p>
        </div>

        {/* Details Section with editable fields */}
        <div className="space-y-2 mb-4">
          {!(item?.type?.toLowerCase() === "dynamic" || item?.type?.toLowerCase() === "digital") && (
            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/3">Type:</span>
              <span className="text-gray-700">{item?.type || "Rental"}</span>
            </div>
          )}

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-1/3">
              {(item?.type?.toLowerCase() === "billboard" || item?.type?.toLowerCase() === "dynamic") ? "Site Location:" : "Size:"}
            </span>
            <span className="text-gray-700">
              {(item?.type?.toLowerCase() === "billboard" || item?.type?.toLowerCase() === "dynamic")
                ? (item?.specs?.location || "N/A")
                : `${item?.specs?.height ? `${item.specs.height}ft (H)` : "N/A"} x ${item?.specs?.width ? `${item.specs.width}ft (W)` : "N/A"}`
              }
            </span>
          </div>

          {item?.illumination && (
            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/3">Illumination:</span>
              <span className="text-gray-700">{item.illumination}</span>
            </div>
          )}

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-1/3">Contract Duration:</span>
            {isEditing && editingField === "duration_days" ? (
              <div className="flex items-center gap-2 ml-1">
                <Input
                  type="number"
                  value={tempValues.duration_days || ""}
                  onChange={(e) => updateTempValues("duration_days", Number.parseInt(e.target.value) || 0)}
                  className="w-24 h-6 text-sm"
                  placeholder={currentQuotation?.duration_days?.toString() || "0"}
                />
                <span className="text-sm text-gray-600">days</span>
              </div>
            ) : (
              <span
                className={`text-gray-700 ${
                  isEditing
                    ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                    : ""
                }`}
                onClick={() => isEditing && handleFieldEdit("duration_days", currentQuotation?.duration_days || 0)}
                title={isEditing ? "Click to edit contract duration" : ""}
              >
                {formatDuration(currentQuotation?.duration_days || 0, currentQuotation?.start_date, currentQuotation?.end_date)}
                {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
              </span>
            )}
          </div>

          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-1/3">Contract Period:</span>
            {isEditing && editingField === "contractPeriod" ? (
              <div className="flex items-center gap-2 ml-1">
                <Input
                  type="date"
                  value={tempValues.start_date ? tempValues.start_date.toISOString().split('T')[0] : ""}
                  onChange={(e) => updateTempValues("start_date", new Date(e.target.value))}
                  className="w-36 h-8 text-sm border-gray-300 rounded-md"
                />
                <span className="text-gray-500">-</span>
                <Input
                  type="date"
                  value={tempValues.end_date ? tempValues.end_date.toISOString().split('T')[0] : ""}
                  onChange={(e) => updateTempValues("end_date", new Date(e.target.value))}
                  className="w-36 h-8 text-sm border-gray-300 rounded-md"
                />
              </div>
            ) : (
              <span
                className={`text-gray-700 ${
                  isEditing
                    ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                    : ""
                }`}
                onClick={() =>
                  isEditing &&
                  handleFieldEdit("contractPeriod", {
                    start_date: currentQuotation?.start_date,
                    end_date: currentQuotation?.end_date,
                  })
                }
                title={isEditing ? "Click to edit contract period" : ""}
              >
                {currentQuotation?.start_date ? formatDate(currentQuotation.start_date) : ""}
                {currentQuotation?.start_date && currentQuotation?.end_date ? " - " : ""}
                {currentQuotation?.end_date ? formatDate(currentQuotation.end_date) : ""}
                {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
              </span>
            )}
          </div>

          <div className="flex">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-1/3">Proposal to:</span>
            <span className="text-gray-700">{currentQuotation?.client_company_name || "CLIENT COMPANY NAME"}</span>
          </div>


          <div className="flex items-center">
            <span className="w-4 text-center">•</span>
            <span className="font-medium text-gray-700 w-1/3">Lease rate per month:</span>

            {isEditing && editingField === "price" ? (
              <div className="flex items-center gap-2 ml-1">
                <Input
                  type="number"
                  value={tempValues.price || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const parsed = Number.parseFloat(value);
                    if (!isNaN(parsed)) {
                      updateTempValues("price", Number(parsed.toFixed(2)));
                    } else if (value === "") {
                      updateTempValues("price", 0);
                    }
                  }}
                  className="w-32 h-6 text-sm"
                  placeholder={item?.price?.toString() || "0.00"}
                  step="0.01"
                />
                <span className="text-sm text-gray-600">(Exclusive of VAT)</span>
              </div>
            ) : (
              <span
                className={`text-gray-700 ${
                  isEditing
                    ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                    : ""
                }`}
                onClick={() => isEditing && handleFieldEdit("price", monthlyRate)}
                title={isEditing ? "Click to edit lease rate" : ""}
              >
                PHP {safeFormatNumber(item?.price || 0)} (Exclusive of VAT)
                {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
              </span>
            )}
          </div>
          {(item?.type?.toLowerCase() === "dynamic" || item?.type?.toLowerCase() === "digital") && item?.cms && (
            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/3">LED Billboard Operation Time:</span>
              <span className="text-gray-700">
                {formatTime(item.cms.start_time)} - {formatTime(item.cms.end_time)} (Total of {calculateHours(formatTime(item.cms.start_time), formatTime(item.cms.end_time))} hours daily)
              </span>
            </div>
          )}


        </div>

        {/* Site Notes */}
        {isEditing && editingField === "site_notes" ? (
          <div className="mt-4">
            <textarea
              value={tempValues.site_notes || currentQuotation?.items?.site_notes || ""}
              onChange={(e) => updateTempValues("site_notes", e.target.value)}
              className="w-full text-base border border-gray-300 rounded p-2"
              rows={3}
              placeholder="Enter site notes"
            />
          </div>
        ) : currentQuotation?.items?.site_notes ? (
          <div
            className={isEditing ? "mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : "mt-4"}
            onClick={() => isEditing && handleFieldEdit("site_notes", currentQuotation.items.site_notes || "")}
            title={isEditing ? "Click to edit site notes" : ""}
          >
            <p className="text-sm italic"><strong>Note:</strong> {currentQuotation.items.site_notes}</p>
            {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
          </div>
        ) : isEditing ? (
          <div
            className="mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200 text-gray-500"
            onClick={() => handleFieldEdit("site_notes", "")}
            title="Click to add site notes"
          >
            <p className="text-base">+ Add site notes</p>
          </div>
        ) : null}

        <p className="font-bold mt-2">Price breakdown:</p>
        {/* Pricing Table - Updated for quotation pricing */}
        <div className="px-4 pt-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-700">Lease rate per month</span>
              <span className="text-gray-900">PHP {safeFormatNumber(item?.price || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Contract duration</span>
              <span className="text-gray-900">x {formatDuration(currentQuotation.duration_days || 0, currentQuotation.start_date, currentQuotation.end_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Total lease</span>
              <span className="text-gray-900">PHP {safeFormatNumber(calculateProratedPrice(item?.price || 0, getDateObject(currentQuotation?.start_date) || new Date(), getDateObject(currentQuotation?.end_date) || new Date()))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Add: VAT</span>
              <span className="text-gray-900">PHP {safeFormatNumber(calculateProratedPrice(item?.price || 0, getDateObject(currentQuotation?.start_date) || new Date(), getDateObject(currentQuotation?.end_date) || new Date()) * 0.12)}</span>
            </div>
            <div className="border-t pt-1 mt-1">
              <div className="flex justify-between font-bold text-lg">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">PHP {safeFormatNumber((calculateProratedPrice(item?.price || 0, getDateObject(currentQuotation?.start_date) || new Date(), getDateObject(currentQuotation?.end_date) || new Date())) * 1.12)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Price Notes */}
        {isEditing && editingField === "price_notes" ? (
          <div className="mt-4">
            <textarea
              value={tempValues.price_notes || currentQuotation?.items?.price_notes || ""}
              onChange={(e) => updateTempValues("price_notes", e.target.value)}
              className="w-full text-base border border-gray-300 rounded p-2"
              rows={3}
              placeholder="Enter price notes"
            />
          </div>
        ) : currentQuotation?.items?.price_notes ? (
          <div
            className={isEditing ? "mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : "mt-4"}
            onClick={() => isEditing && handleFieldEdit("price_notes", currentQuotation.items.price_notes || "")}
            title={isEditing ? "Click to edit price notes" : ""}
          >
            <p className="text-sm italic mb-[15px]"><strong>Note:</strong> {currentQuotation.items.price_notes}</p>
            {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
          </div>
        ) : isEditing ? (
          <div
            className="mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200 text-gray-500"
            onClick={() => handleFieldEdit("price_notes", "")}
            title="Click to add price notes"
          >
            <p className="text-base">+ Add price notes</p>
          </div>
        ) : null}

        {/* Terms and Conditions */}
        <div className="mb-8 mt-2">
          <p className="font-semibold mb-4">Terms and Conditions:</p>
          <div className="space-y-2 text-sm">
            {(isEditing
              ? tempValues.terms_and_conditions || currentQuotation?.template?.terms_and_conditions || [
                  "Quotation validity: 5 working days.",
                  "Site availability: First-come-first-served basis. Official documents required.",
                  "Payment terms: One month advance and two months security deposit.",
                  "Payment deadline: 7 days before rental start.",
                ]
              : currentQuotation?.template?.terms_and_conditions || [
                  "Quotation validity: 5 working days.",
                  "Site availability: First-come-first-served basis. Official documents required.",
                  "Payment terms: One month advance and two months security deposit.",
                  "Payment deadline: 7 days before rental start.",
                ]
            ).map((term: string, index: number) => (
              <div key={index} className="flex items-start gap-2">
                <span className="flex-shrink-0">{index + 1}.</span>
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <textarea
                      value={term}
                      onChange={(e) => handleUpdateTerm(index, e.target.value)}
                      className="flex-1 text-sm border border-gray-300 rounded p-1 min-h-[40px]"
                      placeholder="Enter term and condition"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveTerm(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="flex-1">{term}</span>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTerm}
                  className="text-blue-600 hover:text-blue-800"
                >
                  + Add Term
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Closing Message */}
        {isEditing && editingField === "closing_message" ? (
          <div className="mb-8">
            <textarea
              value={tempValues.closing_message || currentQuotation?.template?.closing_message || ""}
              onChange={(e) => updateTempValues("closing_message", e.target.value)}
              className="w-full text-base border border-gray-300 rounded p-2"
              rows={3}
              placeholder="Enter closing message (optional)"
            />
          </div>
        ) : currentQuotation?.template?.closing_message ? (
          <div
            className={isEditing ? "mb-8 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : "mb-8"}
            onClick={() => isEditing && handleFieldEdit("closing_message", currentQuotation?.template?.closing_message || "")}
            title={isEditing ? "Click to edit closing message" : ""}
          >
            <p className="text-base">{currentQuotation.template.closing_message}</p>
            {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
          </div>
        ) : isEditing ? (
          <div
            className="mb-8 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200 text-gray-500"
            onClick={() => handleFieldEdit("closing_message", "")}
            title="Click to add closing message"
          >
            <p className="text-base">+ Add closing message</p>
          </div>
        ) : null}

        <div className="space-y-8 mb-8">
          <div className="text-left">
            <p className="mb-4">Very truly yours,</p>
            <div>
              {userSignatureUrl ? (
                <div className="mb-2">
                  <img
                    src={userSignatureUrl}
                    alt="Signature"
                    className="max-w-48 max-h-16 object-contain"
                    style={{ width: 'auto', height: 'auto' }}
                  />
                  <div className="border-b border-gray-400 w-48 mb-2"></div>
                </div>
              ) : (
                <div className="border-b border-gray-400 w-48 mb-2"></div>
              )}
              <p className="font-medium">
                {creatorUser?.first_name && creatorUser?.last_name
                  ? `${creatorUser?.first_name} ${creatorUser?.last_name}`
                  : "AIX Xymbiosis"}
              </p>
              {isEditing && editingField === "signature_position" ? (
                <Input
                  type="text"
                  value={tempValues.signature_position || ""}
                  onChange={(e) => updateTempValues("signature_position", e.target.value)}
                  className="w-32 h-6 text-sm"
                  placeholder={currentQuotation?.signature_position || "Position"}
                />
              ) : (
                <p
                  className={`text-sm ${
                    isEditing
                      ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                      : ""
                  }`}
                  onClick={() => isEditing && handleFieldEdit("signature_position", currentQuotation?.signature_position || "")}
                  title={isEditing ? "Click to edit position" : ""}
                >
                  {currentQuotation?.signature_position || "Sales"}
                  {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
                </p>
              )}
            </div>
          </div>
          <div className="text-left">
            <p className="mb-16">Conforme:</p>
            <div className="border-b border-gray-400 w-48 mb-2"></div>
            <p className="font-medium">{currentQuotation?.client_name || "Client Name"}</p>
            <p className="text-sm">{currentQuotation?.client_designation || "Position"}</p>
            <p className="text-xs mt-4 text-gray-600 italic">
              This signed quotation serves as an
              <br />
              official document for billing purposes
            </p>
          </div>
        </div>
        </div>

        <div className="text-center text-xs text-gray-600 mt-8 border-t pt-4">
          <p className="font-semibold">{companyData?.name || "Company Name"}</p>
          <p>{formatCompanyAddress(companyData)}</p>
          <span className="text-center gap-1 flex-1">{companyData?.phone && `Tel no: ${companyData.phone}`}|
          {companyData?.email && `Email: ${companyData.email}`}</span>
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
          <Button onClick={() => router.push("/sales/quotations-list")} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotations
          </Button>
        </div>
      </div>
    )
  }

  const currentQuotation = isEditing ? editableQuotation : getCurrentQuotation()
  const hasMultipleSites = false

  const generatePDFIfNeeded = async (quotation: Quotation, forceRegenerate: boolean = false) => {
    // Check if PDF exists and forceRegenerate is false
    if (!forceRegenerate && quotation.pdf && quotation.pdf.trim() !== "") {
      return { pdfUrl: quotation.pdf, password: quotation.password }
    }

    try {
      // Fetch signature date directly if not available from creatorUser
      let signatureDate: Date | null = null
      if (quotation.created_by) {
        try {
          const userDocRef = doc(db, "iboard_users", quotation.created_by)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('Error fetching signature date:', error)
        }
      }

      // Prepare logo data URL if company logo exists
      let logoDataUrl: string | null = null
      if (companyData?.logo) {
        try {
          const logoResponse = await fetch(companyData.logo)
          if (logoResponse.ok) {
            const logoBlob = await logoResponse.blob()
            logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(logoBlob)
          })
          }
        } catch (error) {
          console.error('Error fetching company logo:', error)
          // Continue without logo if fetch fails
        }
      }

      // Prepare signature data URL if user signature exists
      let userSignatureDataUrl: string | null = null
      if (userSignatureUrl) {
        try {
          const signatureResponse = await fetch(userSignatureUrl)
          if (signatureResponse.ok) {
            const signatureBlob = await signatureResponse.blob()
            userSignatureDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(signatureBlob)
            })
          }
        } catch (error) {
          console.error('Error fetching user signature:', error)
          // Continue without signature if fetch fails
        }
      }

      const { pdfUrl, password } = await generateAndUploadQuotationPDF(quotation, companyData, logoDataUrl, creatorUser, userSignatureDataUrl)

      // Update quotation with PDF URL, password, and signature date
      await updateQuotation(
        quotation.id!,
        { pdf: pdfUrl, password: password, signature_date: signatureDate },
        creatorUser?.id || "system",
        creatorUser?.displayName || "System"
      )

      // Update local state - check if it's the current quotation or a related one
      const current = getCurrentQuotation()
      if (current && quotation.id === current.id) {
        setQuotation(prev => prev ? { ...prev, pdf: pdfUrl, password: password, signature_date: signatureDate } : null)
      } else {
        // Update in relatedQuotations
        setRelatedQuotations(prev =>
          prev.map(q => q.id === quotation.id ? { ...q, pdf: pdfUrl, password: password, signature_date: signatureDate } : q)
        )
      }

      console.log("Quotation PDF generated and uploaded successfully:", pdfUrl)
      return { pdfUrl, password }
    } catch (error) {
      console.error("Error generating quotation PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleSendClick = async () => {
    if (!quotation) return

    // Always set preparing state since we need to check signatures and potentially regenerate PDFs
    setPreparingSend(true)

    try {
      // Fetch signature date directly if not available from creatorUser
      let signatureDate: Date | null = null
      if (quotation.created_by) {
        try {
          const userDocRef = doc(db, "iboard_users", quotation.created_by)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('Error fetching signature date:', error)
        }
      }

      // If there are multiple related quotations, generate PDFs for all of them
      if (relatedQuotations.length > 1) {
        for (const relatedQuotation of relatedQuotations) {
          // Check if signature dates match for each related quotation
          let forceRegenerate = false
          if (relatedQuotation.created_by && creatorUser?.signature?.updated) {
            const quotationSignatureDate = relatedQuotation.signature_date ? new Date(relatedQuotation.signature_date) : null
            const userSignatureDate = creatorUser.signature.updated.toDate ? creatorUser.signature.updated.toDate() : new Date(creatorUser.signature.updated)

            if (!quotationSignatureDate || quotationSignatureDate.getTime() !== userSignatureDate.getTime()) {
              forceRegenerate = true
            }
          }

          const { pdfUrl } = await generatePDFIfNeeded(relatedQuotation, forceRegenerate)
          if (pdfUrl) {
            await updateQuotation(
              relatedQuotation.id!,
              { signature_date: signatureDate },
              creatorUser?.id || "system",
              creatorUser?.displayName || "System"
            )
          }
        }
        // Refresh related quotations data after updates
        await fetchRelatedQuotations(quotation)
      } else {
        // Single quotation - check if signature dates match
        let forceRegenerate = false
        if (quotation.created_by && creatorUser?.signature?.updated) {
          const quotationSignatureDate = quotation.signature_date ? new Date(quotation.signature_date) : null
          const userSignatureDate = creatorUser.signature.updated.toDate ? creatorUser.signature.updated.toDate() : new Date(creatorUser.signature.updated)

          if (!quotationSignatureDate || quotationSignatureDate.getTime() !== userSignatureDate.getTime()) {
            forceRegenerate = true
          }
        }

        const { pdfUrl } = await generatePDFIfNeeded(quotation, forceRegenerate)
        if (pdfUrl) {
          await updateQuotation(
            quotation.id!,
            { signature_date: signatureDate },
            creatorUser?.id || "system",
            creatorUser?.displayName || "System"
          )
        }
      }
      setIsSendOptionsDialogOpen(true)
    } catch (error) {
      // Error is already handled in generatePDFIfNeeded
    } finally {
      setPreparingSend(false)
    }
  }

  const handleEmailClick = async () => {
    if (!quotation) return

    setIsSendOptionsDialogOpen(false)

    // Ensure PDF is generated and saved before sending
    try {
      await generatePDFIfNeeded(quotation)
      // Navigate to compose email page
      router.push(`/sales/quotations/${quotationId}/compose-email`)
    } catch (error) {
      // Error is already handled in generatePDFIfNeeded
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Word-style Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm mb-6">
        <div className="px-4 py-2 flex items-center">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Badge className={`${getStatusColor(quotation.status || "")} border font-medium px-3 py-1`}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {quotation.status || "Draft"}
            </Badge>
          </div>
        </div>
      </div>

      {/* New Wrapper for Sidebar + Document */}
      <div className="flex justify-center items-start gap-6 mt-6">
        {/* Left Panel */}
        {quotation.status === "draft" && (
          <div className="flex flex-col space-y-4 z-20 hidden lg:flex">
            <Button
              variant="ghost"
              className="h-16 w-16 flex flex-col items-center justify-center p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            >
              <LayoutGrid className="h-8 w-8 text-gray-500 mb-1" />
              <span className="text-[10px] text-gray-700">Templates</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleEditClick}
              disabled={isEditing}
              className="h-16 w-16 flex flex-col items-center justify-center p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            >
              <Pencil className="h-8 w-8 text-gray-500 mb-1" />
              <span className="text-[10px] text-gray-700">Edit</span>
            </Button>
            <Button
              variant="ghost"
              onClick={ () => handleDownloadImage()}
              disabled={downloadingImage || preparingDownload}
              className="h-16 w-16 flex flex-col items-center justify-center p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            >
              {preparingDownload ? (
                <>
                  <Loader2 className="h-8 w-8 text-gray-500 mb-1 animate-spin" />
                  <span className="text-[10px] text-gray-700">Preparing...</span>
                </>
              ) : downloadingImage ? (
                <>
                  <Loader2 className="h-8 w-8 text-gray-500 mb-1 animate-spin" />
                  <span className="text-[10px] text-gray-700">Generating...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="h-8 w-8 text-gray-500 mb-1" />
                  <span className="text-[10px] text-gray-700">Download</span>
                </>
              )}
            </Button>
          </div>
        )}

        <div className="flex gap-6 items-start">
          {quotation.status === "sent" && quotation.pdf ? (
            <div className="w-[210mm] min-h-[297mm] bg-white shadow-md rounded-sm overflow-hidden">
              <iframe
                src={`${quotation.pdf}#view=FitH`}
                className="w-full h-full min-h-[297mm]"
                title="Quotation PDF"
              />
            </div>
          ) : (
            <div id="quotation-document" className="w-[210mm] min-h-[297mm] bg-white shadow-md py-8 rounded-sm overflow-auto">
             <div className="text-left mb-8 ml-8">
               <div className="flex items-center justify-start mb-6 mt-6">
                 {companyData?.logo ? (
                   <img
                     src={companyData.logo || "/placeholder.svg"}
                     alt="Company Logo"
                     className="h-24 w-auto object-contain"
                   />
                 ) : (
                   <div className="h-24 w-24 bg-gray-100 rounded-lg flex items-center justify-center">
                     <Building className="h-12 w-12 text-gray-400" />
                   </div>
                 )}
               </div>
             </div>
              {currentQuotation?.items && renderQuotationBlock("Single Site", currentQuotation.items, 1)}

              {proposal && (
                <div className="p-6 sm:p-8 border-t border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200 font-[Calibri]">
                    Linked Proposal
                  </h2>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-lg font-semibold">{proposal.title}</p>
                      <p className="text-gray-600">
                        Created on {format(proposal.createdAt, "PPP")} by {proposal.createdBy}
                      </p>
                      <Button
                        variant="link"
                        className="p-0 mt-2"
                        onClick={() => router.push(`/sales/proposals/${proposal.id}`)}
                      >
                        View Proposal
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Right Sidebar - Updated for quotation history */}
          <div className="w-80 bg-white shadow-md rounded-lg p-4 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto hidden xl:block">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Quotation History</h3>
              <div className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-medium inline-block mb-4">
                {quotation?.items?.name || "Product"}
              </div>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : clientHistory.length > 0 ? (
              <div className="space-y-3">
                {clientHistory.map((historyItem) => (
                  <div
                    key={historyItem.id}
                    onClick={() => handleHistoryItemClick(historyItem)}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {historyItem.quotation_number || historyItem.id?.slice(-8) || "N/A"}
                    </div>
                    <div className="text-sm text-red-600 font-medium mb-2">
                      PHP {safeFormatNumber(historyItem.items?.price || 0)}
                      /month
                    </div>
                    <div className="flex justify-end">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(historyItem.status)}`}
                      >
                        {historyItem.status}
                      </span>
                    </div>
                  </div>
                ))}
                {currentQuotation?.quotation_request_id && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500 mb-2">Related Request ID</Label>
                    <p className="text-base text-gray-900 font-mono">
                      {safeString(currentQuotation.quotation_request_id)}
                    </p>
                  </div>
                )}
                {currentQuotation?.proposalId && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500 mb-2">Related Proposal ID</Label>
                    <p className="text-base text-gray-900 font-mono">{safeString(currentQuotation.proposalId)}</p>
                  </div>
                )}
                {currentQuotation?.campaignId && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500 mb-2">Related Campaign ID</Label>
                    <p className="text-base text-gray-900 font-mono">{safeString(currentQuotation.campaignId)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-sm">No other quotations found for this client</div> {/* Updated message */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      {isEditing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">✏️ Edit Mode Active</span>
            <span className="text-xs">Click on highlighted fields to edit them</span>
          </div>
        </div>
      )}
      {isEditing ? (
        <div className="fixed bottom-6 right-6 flex space-x-4">
          <Button
            onClick={handleCancelEdit}
            variant="outline"
            className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </div>
      ) : null}

      {/* Pagination Controls - Updated for quotations */}
      {relatedQuotations.length > 1 ? (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-full shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPageIndex === 0}
              className="px-6 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-medium"
            >
              Previous
            </Button>

            <div className="px-4 py-2 bg-gray-100 text-gray-800 rounded-full font-medium text-sm">
              {currentPageIndex + 1}/{relatedQuotations.length}
            </div>

            {currentPageIndex === relatedQuotations.length - 1 ? (
              <Button
                onClick={handleSendClick}
                disabled={preparingSend}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium disabled:opacity-50"
              >
                {preparingSend ? "Generating PDF..." : "Send"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPageIndex === relatedQuotations.length - 1}
                className="px-6 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-medium"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Button
            onClick={handleSendClick}
            disabled={preparingSend}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium disabled:opacity-50"
          >
            {preparingSend ? "Generating PDF..." : "Send"}
          </Button>
        </div>
      )}


      {quotation && (
        <SendQuotationOptionsDialog
          isOpen={isSendOptionsDialogOpen}
          onOpenChange={setIsSendOptionsDialogOpen}
          quotation={quotation}
          onEmailClick={handleEmailClick}
          companyData={companyData || undefined}
        />
      )}

      {/* Email Dialog */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Quotation via Email</DialogTitle>
            <DialogDescription>Send this quotation to the client via email.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                To
              </Label>
              <Input type="email" id="email" defaultValue={quotation?.client_email} className="col-span-3" disabled />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cc" className="text-right">
                CC
              </Label>
              <Input
                type="email"
                id="cc"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="subject" className="text-right mt-2">
                Subject
              </Label>
              <Input
                type="text"
                id="subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="body" className="text-right mt-2">
                Body
              </Label>
              <Textarea
                id="body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="col-span-3 min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsSendEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={async () => {
                setSendingEmail(true)
                try {
                  // Simulate sending email
                  await new Promise((resolve) => setTimeout(resolve, 1500))
                  setIsSendEmailDialogOpen(false)
                  setShowSuccessDialog(true)
                  toast({
                    title: "Email Sent",
                    description: "The quotation has been sent to the client.",
                  })
                } catch (error) {
                  console.error("Error sending email:", error)
                  toast({
                    title: "Error",
                    description: "Failed to send email. Please try again.",
                    variant: "destructive",
                  })
                } finally {
                  setSendingEmail(false)
                }
              }}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotation Sent Success Dialog */}
      <QuotationSentSuccessDialog
        isOpen={showSuccessDialog}
        onDismissAndNavigate={() => setShowSuccessDialog(false)}
      />

      {/* PDF Preview Dialog */}
      <Dialog open={pdfPreviewDialogOpen} onOpenChange={handleClosePdfPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedHistoryItem ? `Quotation ${selectedHistoryItem.quotation_number || selectedHistoryItem.id?.slice(-8) || "N/A"}` : "PDF Preview"}
            </DialogTitle>
            <DialogDescription>
              Preview of the quotation PDF
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[600px]">
            {loadingPdfPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Generating PDF preview...</p>
                </div>
              </div>
            ) : pdfPreviewUrl ? (
              <iframe
                src={`${pdfPreviewUrl}#view=FitH&toolbar=0&navpanes=0`}
                className="w-full h-full min-h-[600px] border-0"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600">Failed to load PDF preview</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePdfPreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
