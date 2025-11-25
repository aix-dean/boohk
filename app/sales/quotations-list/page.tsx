"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  limit,
  startAfter,
  onSnapshot,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { format } from "date-fns"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CheckCircle,
  Search,
  X,
  MoreVertical,
  Upload,
  FileText,
  Loader2,
  Share2,
  Plus,
  EyeIcon,
  FilePen,
  Eye,
  Download,
  History,
  Printer,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { copyQuotation, generateQuotationPDF, getQuotationById } from "@/lib/quotation-service"
import { SentHistoryDialog } from "@/components/sent-history-dialog"
import { ComplianceDialog } from "@/components/compliance-dialog"
import { SendQuotationOptionsDialog } from "@/components/send-quotation-options-dialog"
import { ComplianceConfirmationDialog } from "@/components/compliance-confirmation-dialog"
import { BookingCongratulationsDialog } from "@/components/BookingCongratulationsDialog"
import { bookingService } from "@/lib/booking-service"
import { searchQuotations } from "@/lib/algolia-service"
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Helper function to get current user's signature date
const getCurrentUserSignatureDate = async (user: any): Promise<Date | null> => {
  try {
    const { doc, getDoc } = await import("firebase/firestore")
    const { db } = await import("@/lib/firebase")
    const userDocRef = doc(db, "boohk_users", user?.uid || "")
    const userDoc = await getDoc(userDocRef)

    if (userDoc.exists()) {
      const userDataFetched = userDoc.data()
      if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
        return userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching current user signature date:', error)
    return null
  }
}

// Helper function to generate PDF if needed
const generatePDFIfNeeded = async (quotation: any, user: any, userData: any, companyData: any) => {
  if (quotation.pdf && quotation.pdf.trim() !== "") {
    return { pdfUrl: quotation.pdf, password: quotation.password }
  }

  try {
    // Fetch signature date directly if not available from creatorUser
    let signatureDate: Date | null = null
    if (quotation.created_by) {
      try {
        const { doc, getDoc } = await import("firebase/firestore")
        const { db } = await import("@/lib/firebase")
        const userDocRef = doc(db, "boohk_users", quotation.created_by)
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
    if (companyData?.photo_url) {
      try {
        const logoResponse = await fetch(companyData.photo_url)
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
    if (user?.uid) {
      try {
        const { doc, getDoc } = await import("firebase/firestore")
        const { db } = await import("@/lib/firebase")
        const userDocRef = doc(db, "boohk_users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userDataFetched = userDoc.data()
          if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
            const signatureUrl = userDataFetched.signature.url
            console.log('[LIST_DOWNLOAD] Found current user signature URL:', signatureUrl)

            // Convert signature image to base64 data URL
            try {
              const response = await fetch(signatureUrl)
              if (response.ok) {
                const blob = await response.blob()
                const arrayBuffer = await blob.arrayBuffer()
                const base64 = Buffer.from(arrayBuffer).toString('base64')
                const mimeType = blob.type || 'image/png'
                userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                console.log('[LIST_DOWNLOAD] Converted current user signature to base64 data URL')
              } else {
                console.warn('[LIST_DOWNLOAD] Failed to fetch current user signature image:', response.status)
              }
            } catch (fetchError) {
              console.error('[LIST_DOWNLOAD] Error converting current user signature to base64:', fetchError)
            }
          }
        }
      } catch (error) {
        console.error('[LIST_DOWNLOAD] Error fetching current user signature:', error)
      }
    }

    const { generateAndUploadQuotationPDF } = await import("@/lib/quotation-service")
    const { pdfUrl, password } = await generateAndUploadQuotationPDF(quotation, userData ? {
      first_name: userData.first_name || undefined,
      last_name: userData.last_name || undefined,
      email: userData.email || undefined,
      company_id: userData.company_id || undefined,
    } : undefined, companyData, userSignatureDataUrl)

    // Update quotation with PDF URL, password, and signature date
    const { updateDoc, doc } = await import("firebase/firestore")
    const { db } = await import("@/lib/firebase")
    await updateDoc(doc(db, "quotations", quotation.id!), {
      pdf: pdfUrl,
      password: password,
      signature_date: signatureDate
    })

    console.log("Quotation PDF generated and uploaded successfully:", pdfUrl)
    return { pdfUrl, password }
  } catch (error) {
    console.error("Error generating quotation PDF:", error)
    throw error
  }
}

export default function QuotationsListPage() {
  const router = useRouter()
  const { user, userData } = useAuth()
  const [quotations, setQuotations] = useState<any[]>([])
  const [allQuotations, setAllQuotations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [pageLastDocs, setPageLastDocs] = useState<{ [page: number]: any }>({})
  const [hasMorePages, setHasMorePages] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [signingQuotes, setSigningQuotes] = useState<Set<string>>(new Set())
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [copyingQuotations, setCopyingQuotations] = useState<Set<string>>(new Set())
  const [generatingPDFs, setGeneratingPDFs] = useState<Set<string>>(new Set())
  const [searchLoading, setSearchLoading] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [selectedQuotationForShare, setSelectedQuotationForShare] = useState<any>(null)
  const [projectNameDialogOpen, setProjectNameDialogOpen] = useState(false)
  const [selectedQuotationForProject, setSelectedQuotationForProject] = useState<any>(null)
  const [projectName, setProjectName] = useState("")
  const [creatingReservation, setCreatingReservation] = useState(false)
  const [showSentHistoryDialog, setShowSentHistoryDialog] = useState(false)
  const [selectedQuotationForHistory, setSelectedQuotationForHistory] = useState<any>(null)
  const [showComplianceDialog, setShowComplianceDialog] = useState(false)
  const [selectedQuotationForCompliance, setSelectedQuotationForCompliance] = useState<any>(null)
  const [companyData, setCompanyData] = useState<any>(null)
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null)
   const [showReservationConfirmationDialog, setShowReservationConfirmationDialog] = useState(false)
    const [selectedQuotationForReservation, setSelectedQuotationForReservation] = useState<any>(null)
  const [showBookingCongratulationsDialog, setShowBookingCongratulationsDialog] = useState(false)
  const [createdBooking, setCreatedBooking] = useState<any>(null)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const handleProjectNameDialogClose = (open: boolean) => {
    if (!open) {
      // Dialog is being closed without submitting
      setProjectNameDialogOpen(false)
      setSelectedQuotationForProject(null)
      setProjectName("")
    }
  }
  const pageSize = 10
  const { toast } = useToast()

  // Note: Filtering is now handled server-side or removed for server-side pagination
  // We'll focus on pagination controls for now

  const fetchQuotations = async (page: number = 1, reset: boolean = false) => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // If there's a search term, use Algolia search
      if (debouncedSearchTerm.trim()) {
        const searchResults = await searchQuotations(debouncedSearchTerm.trim(), userData?.company_id || undefined, page - 1, pageSize)

        if (searchResults.error) {
          console.error("Search error:", searchResults.error)
          // Fallback to real-time listener if search fails
          setupRealtimeListener(page, reset)
          return
        }

        // Transform Algolia results to match the expected format
        let transformedQuotations = searchResults.hits.map((hit: any) => ({
          id: hit.objectID,
          quotation_number: hit.quotation_number,
          client_name: hit.client_name,
          client_company_name: hit.client_company_name,
          items: hit.items,
          seller_id: hit.seller_id,
          status: hit.status,
          created: hit.created ? new Date(hit.created) : null,
          projectCompliance: hit.projectCompliance || {},
          // Add other fields as needed
        }))
        console.log(`transformedQuotations:`, transformedQuotations)

        // Apply status filter if not "all"
        if (statusFilter !== "all") {
          transformedQuotations = transformedQuotations.filter(q => q.status === statusFilter)
        }

        setAllQuotations(transformedQuotations)
        setQuotations(transformedQuotations)
        setHasMorePages(searchResults.page < searchResults.nbPages - 1)
        setTotalCount(searchResults.nbHits)
      } else {
        // No search term, set up real-time listener
        setupRealtimeListener(page, reset)
      }
    } catch (error) {
      console.error("Error fetching quotations:", error)
      // Fallback to real-time listener on error
      setupRealtimeListener(page, reset)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeListener = (page: number = 1, reset: boolean = false) => {
    if (!user?.uid || !userData?.company_id) return

    // Clean up existing listener
    if (unsubscribe) {
      unsubscribe()
    }

    const quotationsRef = collection(db, "quotations")
    let q = query(
      quotationsRef,
      where("company_id", "==", userData.company_id),
      orderBy("created", "desc"),
      limit(pageSize + 1) // Fetch one extra to check if there are more pages
    )

    // If not the first page, start after the last document of the previous page
    if (page > 1 && !reset) {
      const prevPageLastDoc = pageLastDocs[page - 1]
      if (prevPageLastDoc) {
        q = query(q, startAfter(prevPageLastDoc))
      }
    }

    const unsubscribeListener = onSnapshot(q, (querySnapshot) => {
      const fetchedQuotations: any[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        fetchedQuotations.push({
          id: doc.id,
          ...data,
          // Ensure projectCompliance is included
          projectCompliance: data.projectCompliance || {}
        })
      })

      // Check if there are more pages
      const hasMore = fetchedQuotations.length > pageSize
      const currentPageData = hasMore ? fetchedQuotations.slice(0, pageSize) : fetchedQuotations

      // Store the last document for this page
      const pageLastDoc = hasMore ? querySnapshot.docs[pageSize - 1] : querySnapshot.docs[querySnapshot.docs.length - 1]

      if (pageLastDoc) {
        setPageLastDocs(prev => ({
          ...prev,
          [page]: pageLastDoc
        }))
      }

      // Apply status filter if not "all"
      let filteredData = currentPageData
      if (statusFilter !== "all") {
        filteredData = currentPageData.filter(q => q.status === statusFilter)
      }

      // Apply search filter if there's a search term
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase()
        filteredData = filteredData.filter(q =>
          q.quotation_number?.toLowerCase().includes(searchLower) ||
          q.client_name?.toLowerCase().includes(searchLower) ||
          q.client_company_name?.toLowerCase().includes(searchLower) ||
          q.items?.name?.toLowerCase().includes(searchLower)
        )
      }

      setAllQuotations(currentPageData)
      setLastDoc(pageLastDoc)
      setHasMorePages(hasMore)
      setQuotations(filteredData)
      setTotalCount(fetchedQuotations.length) // Approximate count
      setLoading(false)
    }, (error) => {
      console.error("Error in real-time listener:", error)
      setLoading(false)
    })

    setUnsubscribe(() => unsubscribeListener)
  }

  useEffect(() => {
    if (user?.uid && userData?.company_id) {
      setupRealtimeListener(1, true)
    }

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe()
        setUnsubscribe(null)
      }
    }
  }, [user?.uid, userData?.company_id])

  useEffect(() => {
    if (user && userData) {
      fetchCompanyData()
    }
  }, [user, userData])

  useEffect(() => {
    if (user?.uid) {
      setCurrentPage(1)
      setLastDoc(null)
      setPageLastDocs({})
      setHasMorePages(true)

      // If search term is cleared, immediately clear quotations to show reset
      if (!debouncedSearchTerm.trim()) {
        setQuotations([])
        setLoading(true)
      }

      fetchQuotations(1, true)
    }
  }, [debouncedSearchTerm, statusFilter, user?.uid])

  const handlePageChange = async (page: number) => {
    setCurrentPage(page)
    // If there's a search term, use Algolia search for pagination
    if (debouncedSearchTerm.trim()) {
      fetchQuotations(page, false)
    } else {
      setupRealtimeListener(page, false)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setCurrentPage(1)
    setLastDoc(null)
    setPageLastDocs({})
    setHasMorePages(true)
    setupRealtimeListener(1, true)
  }

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "MMM d, yyyy")
      }
      if (typeof date === "string") {
        return format(new Date(date), "MMM d, yyyy")
      }
      return "Invalid date"
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "booked":
        return "bg-red-100 text-red-800 border-red-200"
      case "sent":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "reserved":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "accepted":
        return "bg-green-100 text-green-800 border-green-200"
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "expired":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "viewed":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const handleQuoteSigned = async (quotation: any) => {
    if (!quotation.id || !user?.uid) return

    setSigningQuotes((prev) => new Set(prev).add(quotation.id))

    try {
      // First, get the full quotation details including items
      const quotationRef = doc(db, "quotations", quotation.id)
      const quotationDoc = await getDoc(quotationRef)

      if (!quotationDoc.exists()) {
        throw new Error("Quotation not found")
      }

      const fullQuotationData = quotationDoc.data()
      const items = fullQuotationData.items || []

      if (items.length === 0) {
        throw new Error("No items found in quotation")
      }

      const startDate = fullQuotationData.start_date ? new Date(fullQuotationData.start_date) : new Date()
      const durationDays = fullQuotationData.duration_days || 30

      const collectionPeriods = []
      let remainingDays = durationDays
      const currentDate = new Date(startDate)

      while (remainingDays > 0) {
        const periodDays = Math.min(30, remainingDays)
        currentDate.setDate(currentDate.getDate() + (collectionPeriods.length === 0 ? 30 : periodDays))
        collectionPeriods.push({
          collectionDate: new Date(currentDate),
          periodDays: periodDays,
          periodNumber: collectionPeriods.length + 1,
        })
        remainingDays -= periodDays
      }

      // Generate collectibles for each item and each collection period
      const collectiblesPromises = []

      for (const item of items) {
        const productId = item.product_id || item.id || `product-${Date.now()}`
        const totalItemAmount = item.item_total_amount || item.price * durationDays || 0
        const itemName = item.name || `Product ${items.indexOf(item) + 1}`

        // Create collectibles for each collection period
        for (const period of collectionPeriods) {
          const periodAmount = (totalItemAmount / durationDays) * period.periodDays

          const collectibleData = {
            // Basic information from quotation
            client_name: quotation.client_name || fullQuotationData.client_name || "",
            company_id: (user as any)?.company_id || user?.uid,
            type: "sites", // Default to sites type based on the business model

            // Financial data - proportional amount for this period
            net_amount: periodAmount,
            total_amount: periodAmount,

            // Document references with period number
            invoice_no: `INV-${quotation.quotation_number}-${productId.toString().slice(-4)}-P${period.periodNumber}`,
            or_no: `OR-${Date.now()}-${productId.toString().slice(-4)}-P${period.periodNumber}`,
            bi_no: `BI-${Date.now()}-${productId.toString().slice(-4)}-P${period.periodNumber}`,

            // Payment information
            mode_of_payment: "Credit/Debit Card", // Default payment method
            bank_name: "", // To be filled later

            // Status and dates
            status: "pending",
            collection_date: Timestamp.fromDate(period.collectionDate), // Use calculated collection date
            covered_period: `${fullQuotationData.start_date?.split("T")[0] || new Date().toISOString().split("T")[0]} - ${fullQuotationData.end_date?.split("T")[0] || new Date().toISOString().split("T")[0]}`,

            // Sites-specific fields
            site: item.location || item.site_code || "",
            booking_no: `BK-${quotation.quotation_number}-${productId.toString().slice(-4)}-P${period.periodNumber}`,

            // Additional fields from collectibles model
            vendor_name: quotation.client_name || fullQuotationData.client_name || "",
            business_address: quotation.client_address || fullQuotationData.client_address || "",
            tin_no: "", // To be filled later

            // System fields
            deleted: false,
            created: serverTimestamp(),
            updated: serverTimestamp(),

            // Reference to original quotation
            quotation_id: quotation.id,
            quotation_number: quotation.quotation_number,
            product_name: itemName,
            product_id: productId,

            period_number: period.periodNumber,
            period_days: period.periodDays,
            total_periods: collectionPeriods.length,
            duration_days: durationDays,
          }

          collectiblesPromises.push(addDoc(collection(db, "collectibles"), collectibleData))
        }
      }

      // Execute all collectibles creation
      const results = await Promise.all(collectiblesPromises)

      toast({
        title: "Success",
        description: `Quote signed successfully! Generated ${results.length} collectible document${results.length > 1 ? "s" : ""} across ${collectionPeriods.length} collection period${collectionPeriods.length > 1 ? "s" : ""}.`,
      })

      // Optionally update quotation status to 'accepted'
      // await updateDoc(quotationRef, { status: 'accepted', updated: serverTimestamp() })
    } catch (error) {
      console.error("Error generating collectibles:", error)
      toast({
        title: "Error",
        description: "Failed to generate collectibles documents. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSigningQuotes((prev) => {
        const newSet = new Set(prev)
        newSet.delete(quotation.id)
        return newSet
      })
    }
  }

  const handleFileUpload = async (quotationId: string, complianceType: string, file: File) => {
    const uploadKey = `${quotationId}-${complianceType}`
    setUploadingFiles((prev) => new Set(prev).add(uploadKey))
    console.log("[DEBUG] handleFileUpload called for quotationId:", quotationId, "complianceType:", complianceType)

    try {
      // Validate file type (PDF only)
      if (file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed")
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB")
      }


      // Normal upload flow for other compliance types
      // Create storage reference
      const fileName = `${Date.now()}-${file.name}`
      const storageRef = ref(storage, `quotations/${quotationId}/compliance/${complianceType}/${fileName}`)

      // Upload file
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      // Update quotation document with compliance data
      const quotationRef = doc(db, "quotations", quotationId)
      const updateData: { [key: string]: any } = {
        [`projectCompliance.${complianceType}`]: {
          status: "completed",
          completed: true,
          fileUrl: downloadURL,
          fileName: file.name,
          uploadedAt: serverTimestamp(),
          uploadedBy: user?.uid,
          sent_from: "Boohk",
          sent_by: `${userData?.first_name || ""} ${userData?.last_name || ""}`.trim() || user?.email || `User-${user?.uid?.slice(-6)}`,
        },
        updated: serverTimestamp(),
      }

      await updateDoc(quotationRef, updateData)

      // Update booking documents that have this quotation_id
      try {
        const bookingsRef = collection(db, "booking")
        const bookingsQuery = query(
          bookingsRef,
          where("quotation_id", "==", quotationId),
          where("company_id", "==", userData?.company_id)
        )
        const bookingsSnapshot = await getDocs(bookingsQuery)

        if (!bookingsSnapshot.empty) {
          const bookingUpdatePromises = bookingsSnapshot.docs.map(async (bookingDoc) => {
            const bookingRef = doc(db, "booking", bookingDoc.id)
            return updateDoc(bookingRef, updateData)
          })

          await Promise.all(bookingUpdatePromises)
          console.log(`Updated ${bookingsSnapshot.docs.length} booking document(s) with compliance data`)
        }
      } catch (bookingUpdateError) {
        console.error("Error updating booking documents:", bookingUpdateError)
        // Don't fail the entire operation if booking update fails
      }

      // Real-time listener will automatically update the list

      // Update the selected quotation for compliance dialog
      if (selectedQuotationForCompliance && selectedQuotationForCompliance.id === quotationId) {
        const updatedQuotation = quotations.find(q => q.id === quotationId) || selectedQuotationForCompliance
        setSelectedQuotationForCompliance({
          ...updatedQuotation,
          projectCompliance: {
            ...updatedQuotation.projectCompliance,
            [complianceType]: {
              ...updatedQuotation.projectCompliance?.[complianceType],
              status: "completed",
              completed: true,
              fileUrl: downloadURL,
              fileName: file.name,
              uploadedAt: new Date(),
              uploadedBy: user?.uid,
              sent_from: "Boohk",
              sent_by: `${userData?.first_name || ""} ${userData?.last_name || ""}`.trim() || user?.email || `User-${user?.uid?.slice(-6)}`,
            }
          }
        })
      }

      // Update the selected quotation for reservation confirmation dialog
      if (selectedQuotationForReservation && selectedQuotationForReservation.id === quotationId) {
        setSelectedQuotationForReservation({
          ...selectedQuotationForReservation,
          projectCompliance: {
            ...selectedQuotationForReservation.projectCompliance,
            [complianceType]: {
              ...selectedQuotationForReservation.projectCompliance?.[complianceType],
              status: "completed",
              completed: true,
              fileUrl: downloadURL,
              fileName: file.name,
              uploadedAt: new Date(),
              uploadedBy: user?.uid,
              sent_from: "Boohk",
              sent_by: `${userData?.first_name || ""} ${userData?.last_name || ""}`.trim() || user?.email || `User-${user?.uid?.slice(-6)}`,
            }
          }
        })
      }

      toast({
        title: "Success",
        description: `${complianceType.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} uploaded successfully`,
      })
    } catch (error: any) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(uploadKey)
        return newSet
      })
    }
  }

  const getProjectCompliance = (quotation: any) => {
    const compliance = quotation.projectCompliance || {}

    const toReserveItems = [
      {
        key: "signedContract",
        name: "Signed Contract",
        status: (compliance.signedContract?.fileUrl || compliance.signedContract?.status === "completed" || compliance.signedContract?.completed === true) ? "completed" : "upload",
        file: compliance.signedContract?.fileName,
        fileUrl: compliance.signedContract?.fileUrl,
      },
      {
        key: "irrevocablePo",
        name: "Irrevocable PO",
        status: (compliance.irrevocablePo?.fileUrl || compliance.irrevocablePo?.status === "completed" || compliance.irrevocablePo?.completed === true) ? "completed" : "upload",
        file: compliance.irrevocablePo?.fileName,
        fileUrl: compliance.irrevocablePo?.fileUrl,
      },
      {
        key: "paymentAsDeposit",
        name: "Payment as Deposit",
        status: (compliance.paymentAsDeposit?.fileUrl || compliance.paymentAsDeposit?.status === "completed" || compliance.paymentAsDeposit?.completed === true) ? "completed" : "confirmation",
        note: "For Treasury's confirmation",
        file: compliance.paymentAsDeposit?.fileName,
        fileUrl: compliance.paymentAsDeposit?.fileUrl,
      },
    ]

    const otherRequirementsItems = [
      {
        key: "finalArtwork",
        name: "Final Artwork",
        status: (compliance.finalArtwork?.fileUrl || compliance.finalArtwork?.status === "completed" || compliance.finalArtwork?.completed === true) ? "completed" : "upload",
        file: compliance.finalArtwork?.fileName,
        fileUrl: compliance.finalArtwork?.fileUrl,
      },
      {
        key: "signedQuotation",
        name: "Signed Quotation",
        status: (compliance.signedQuotation?.fileUrl || compliance.signedQuotation?.status === "completed" || compliance.signedQuotation?.completed === true) ? "completed" : "upload",
        file: compliance.signedQuotation?.fileName,
        fileUrl: compliance.signedQuotation?.fileUrl,
      },
    ]

    const allItems = [...toReserveItems, ...otherRequirementsItems]
    const completed = allItems.filter((item) => item.status === "completed").length
    return {
      completed,
      total: allItems.length,
      toReserve: toReserveItems,
      otherRequirements: otherRequirementsItems,
    }
  }


  const triggerFileUpload = (quotationId: string, complianceType: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".pdf"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleFileUpload(quotationId, complianceType, file)
      }
    }
    input.click()
  }

  const handleCopyQuotation = async (quotationId: string) => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "User information not available. Please try again.",
        variant: "destructive",
      })
      return
    }

    const userName = user.displayName || user.email || `User-${user.uid.slice(-6)}`

    setCopyingQuotations((prev) => new Set(prev).add(quotationId))

    try {
      console.log("[v0] Starting quotation copy for:", quotationId)
      const newQuotationId = await copyQuotation(quotationId, user.uid, userName)
      console.log("[v0] Quotation copied successfully, new ID:", newQuotationId)

      toast({
        title: "Success",
        description: "Quotation copied successfully! The new quotation has been created with a new quotation number.",
      })

      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log("[v0] Real-time listener will automatically update the quotations list")
    } catch (error: any) {
      console.error("Error copying quotation:", error)
      toast({
        title: "Copy Failed",
        description: error.message || "Failed to copy quotation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setCopyingQuotations((prev) => {
        const newSet = new Set(prev)
        newSet.delete(quotationId)
        return newSet
      })
    }
  }
  

  const handleDownloadPDF = async (quotationId: string) => {
    setGeneratingPDFs((prev) => new Set(prev).add(quotationId))

    try {
      // Get the full quotation data
      const quotation = await getQuotationById(quotationId)
      if (!quotation) {
        throw new Error("Quotation not found")
      }

      // Check if PDF already exists
      if (quotation.pdf) {
        // If PDF exists, check signature dates
        const currentSignatureDate = await getCurrentUserSignatureDate(user)
        const storedSignatureDate = quotation.signature_date

        let needsRegeneration = false

        if (currentSignatureDate && storedSignatureDate) {
          const currentDate = new Date(currentSignatureDate).getTime()
          const storedDate = new Date(storedSignatureDate).getTime()

          if (currentDate !== storedDate) {
            console.log('[LIST_DOWNLOAD] Signature dates do not match, regenerating PDF')
            needsRegeneration = true
          } else {
            console.log('[LIST_DOWNLOAD] Signature dates match, using existing PDF')
          }
        } else if (!currentSignatureDate || !storedSignatureDate) {
          console.log('[LIST_DOWNLOAD] Missing signature date info, regenerating PDF')
          needsRegeneration = true
        }

        if (!needsRegeneration) {
          // If PDF exists and signature dates match, download it directly
          try {
            const response = await fetch(quotation.pdf)
            if (response.ok) {
              const blob = await response.blob()
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `${quotation.quotation_number || quotation.id || 'quotation'}.pdf`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(url)

              toast({
                title: "Success",
                description: "Quotation PDF downloaded successfully",
              })
              return
            }
          } catch (fetchError) {
            console.error('Error fetching existing PDF:', fetchError)
            // Fall back to generating PDF
          }
        } else {
          // Show generating toast when regeneration is needed
          toast({
            title: "Generating PDF",
            description: "Please wait while we regenerate your PDF...",
          })
        }
      }

      // Prepare logo data URL if company logo exists
      let logoDataUrl = null
      if (companyData?.photo_url) {
        try {
          const logoResponse = await fetch(companyData.photo_url)
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

      // Fetch current user's signature for PDF generation
      let userSignatureDataUrl: string | null = null
      let signatureDate: Date | null = null
      if (user?.uid) {
        try {
          const { doc, getDoc } = await import("firebase/firestore")
          const { db } = await import("@/lib/firebase")
          const userDocRef = doc(db, "boohk_users", user.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
              const signatureUrl = userDataFetched.signature.url
              console.log('[LIST_DOWNLOAD] Found current user signature URL:', signatureUrl)

              // Convert signature image to base64 data URL
              try {
                const response = await fetch(signatureUrl)
                if (response.ok) {
                  const blob = await response.blob()
                  const arrayBuffer = await blob.arrayBuffer()
                  const base64 = Buffer.from(arrayBuffer).toString('base64')
                  const mimeType = blob.type || 'image/png'
                  userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                  console.log('[LIST_DOWNLOAD] Converted current user signature to base64 data URL')
                } else {
                  console.warn('[LIST_DOWNLOAD] Failed to fetch current user signature image:', response.status)
                }
              } catch (fetchError) {
                console.error('[LIST_DOWNLOAD] Error converting current user signature to base64:', fetchError)
              }
            }
            // Also fetch signature date
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('[LIST_DOWNLOAD] Error fetching current user signature:', error)
        }
      }

      // Generate and upload PDF using the service
      const { generateAndUploadQuotationPDF } = await import("@/lib/quotation-service")
      const { pdfUrl, password } = await generateAndUploadQuotationPDF(quotation, userData ? {
        first_name: userData.first_name || undefined,
        last_name: userData.last_name || undefined,
        email: userData.email || undefined,
        company_id: userData.company_id || undefined,
      } : undefined, companyData, userSignatureDataUrl)

      // Update quotation with PDF URL, password, and signature date
      const { updateDoc, doc } = await import("firebase/firestore")
      const { db } = await import("@/lib/firebase")
      await updateDoc(doc(db, "quotations", quotationId), {
        pdf: pdfUrl,
        password: password,
        signature_date: signatureDate
      })

      // Download the generated PDF
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error(`Failed to download generated PDF: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${quotation.quotation_number || quotation.id || 'quotation'}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Quotation PDF downloaded successfully",
      })
    } catch (error: any) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Download Failed",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDFs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(quotationId)
        return newSet
      })
    }
  }

  const handlePrintQuotation = async (quotationId: string) => {
    setGeneratingPDFs((prev) => new Set(prev).add(quotationId))

    try {
      // Get the full quotation data including the pdf field
      const quotation = await getQuotationById(quotationId)
      if (!quotation) {
        throw new Error("Quotation not found")
      }

      // Check if PDF already exists in the quotation document
      if (quotation.pdf) {
        // If PDF exists, check signature dates
        const currentSignatureDate = await getCurrentUserSignatureDate(user)
        const storedSignatureDate = quotation.signature_date

        let needsRegeneration = false

        if (currentSignatureDate && storedSignatureDate) {
          const currentDate = new Date(currentSignatureDate).getTime()
          const storedDate = new Date(storedSignatureDate).getTime()

          if (currentDate !== storedDate) {
            console.log('[LIST_PRINT] Signature dates do not match, regenerating PDF')
            needsRegeneration = true
          } else {
            console.log('[LIST_PRINT] Signature dates match, using existing PDF')
          }
        } else if (!currentSignatureDate || !storedSignatureDate) {
          console.log('[LIST_PRINT] Missing signature date info, regenerating PDF')
          needsRegeneration = true
        }

        if (!needsRegeneration) {
          // If PDF exists and signature dates match, open it for printing directly
          try {
            const response = await fetch(quotation.pdf)
            if (response.ok) {
              const blob = await response.blob()
              const pdfUrl = URL.createObjectURL(blob)

              // Open PDF in new window and trigger print
              const printWindow = window.open(pdfUrl)
              if (printWindow) {
                printWindow.onload = () => {
                  printWindow.print()
                  // Clean up the URL after printing
                  printWindow.onafterprint = () => {
                    URL.revokeObjectURL(pdfUrl)
                  }
                }
              } else {
                console.error("Failed to open print window")
                URL.revokeObjectURL(pdfUrl)
              }

              toast({
                title: "Success",
                description: "Quotation PDF opened for printing",
              })
              return
            }
          } catch (fetchError) {
            console.error('Error fetching existing PDF for printing:', fetchError)
            // Fall back to generating PDF
          }
        }
      }

      // Prepare logo data URL if company logo exists
      let logoDataUrl = null
      if (companyData?.photo_url) {
        try {
          const logoResponse = await fetch(companyData.photo_url)
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

      // Fetch current user's signature for PDF generation
      let userSignatureDataUrl: string | null = null
      let signatureDate: Date | null = null
      if (user?.uid) {
        try {
          const { doc, getDoc } = await import("firebase/firestore")
          const { db } = await import("@/lib/firebase")
          const userDocRef = doc(db, "boohk_users", user.uid)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
              const signatureUrl = userDataFetched.signature.url
              console.log('[LIST_PRINT] Found current user signature URL:', signatureUrl)

              // Convert signature image to base64 data URL
              try {
                const response = await fetch(signatureUrl)
                if (response.ok) {
                  const blob = await response.blob()
                  const arrayBuffer = await blob.arrayBuffer()
                  const base64 = Buffer.from(arrayBuffer).toString('base64')
                  const mimeType = blob.type || 'image/png'
                  userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                  console.log('[LIST_PRINT] Converted current user signature to base64 data URL')
                } else {
                  console.warn('[LIST_PRINT] Failed to fetch current user signature image:', response.status)
                }
              } catch (fetchError) {
                console.error('[LIST_PRINT] Error converting current user signature to base64:', fetchError)
              }
            }
            // Also fetch signature date
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('[LIST_PRINT] Error fetching current user signature:', error)
        }
      }

      // Show generating toast
      toast({
        title: "Generating PDF",
        description: "Please wait while we prepare your quotation...",
      })

      // Show generating toast
      toast({
        title: "Generating PDF",
        description: "Please wait while we prepare your quotation...",
      })

      // Show generating toast
      toast({
        title: "Generating PDF",
        description: "Please wait while we prepare your quotation...",
      })

      // Generate and upload PDF using the service
      const { generateAndUploadQuotationPDF } = await import("@/lib/quotation-service")
      const { pdfUrl, password } = await generateAndUploadQuotationPDF(quotation, userData ? {
        first_name: userData.first_name || undefined,
        last_name: userData.last_name || undefined,
        email: userData.email || undefined,
        company_id: userData.company_id || undefined,
      } : undefined, companyData, userSignatureDataUrl)

      // Update quotation with PDF URL, password, and signature date
      const { updateDoc, doc } = await import("firebase/firestore")
      const { db } = await import("@/lib/firebase")
      await updateDoc(doc(db, "quotations", quotationId), {
        pdf: pdfUrl,
        password: password,
        signature_date: signatureDate
      })

      // Show success toast
      toast({
        title: "PDF Generated",
        description: "Your quotation PDF has been prepared successfully.",
      })

      // Show success toast
      toast({
        title: "PDF Generated",
        description: "Your quotation PDF has been prepared successfully.",
      })

      // Show success toast
      toast({
        title: "PDF Generated",
        description: "Your quotation PDF has been prepared successfully.",
      })

      // Open the generated PDF for printing
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch generated PDF for printing: ${response.statusText}`)
      }

      const blob = await response.blob()
      const pdfUrlForPrint = URL.createObjectURL(blob)

      // Open PDF in new window and trigger print
      const printWindow = window.open(pdfUrlForPrint)
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
          // Clean up the URL after printing
          printWindow.onafterprint = () => {
            URL.revokeObjectURL(pdfUrlForPrint)
          }
        }
      } else {
        console.error("Failed to open print window")
        URL.revokeObjectURL(pdfUrlForPrint)
      }

      toast({
        title: "Success",
        description: "Quotation PDF opened for printing",
      })
    } catch (error: any) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Print Failed",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDFs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(quotationId)
        return newSet
      })
    }
  }

  const handlePrintQuotationWindow = async (quotationId: string) => {
    setGeneratingPDFs((prev) => new Set(prev).add(quotationId))

    try {
      // Get the full quotation data
      const quotation = await getQuotationById(quotationId)
      if (!quotation) {
        throw new Error("Quotation not found")
      }

      // Prepare logo data URL if company logo exists
      let logoDataUrl = null
      if (companyData?.photo_url) {
        try {
          const logoResponse = await fetch(companyData.photo_url)
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

      // Prepare quotation data for API (convert Timestamps to serializable format)
      const serializableQuotation = {
        ...quotation,
        created: quotation.created?.toDate ? quotation.created.toDate().toISOString() : quotation.created,
        updated: quotation.updated?.toDate ? quotation.updated.toDate().toISOString() : quotation.updated,
        valid_until: quotation.valid_until?.toDate ? quotation.valid_until.toDate().toISOString() : quotation.valid_until,
        start_date: quotation.start_date?.toDate ? quotation.start_date.toDate().toISOString() : quotation.start_date,
        end_date: quotation.end_date?.toDate ? quotation.end_date.toDate().toISOString() : quotation.end_date,
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
          userData,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()

      const pdfBlob = new Blob([buffer], { type: 'application/pdf' })
      const pdfUrl = URL.createObjectURL(pdfBlob)

      // Open PDF in new window and trigger print
      const printWindow = window.open(pdfUrl)
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
          // Clean up the URL after printing
          printWindow.onafterprint = () => {
            URL.revokeObjectURL(pdfUrl)
          }
        }
      } else {
        console.error("Failed to open print window")
        URL.revokeObjectURL(pdfUrl)
      }

      toast({
        title: "Success",
        description: "Quotation PDF opened for printing",
      })
    } catch (error: any) {
      console.error("Error generating PDF for printing:", error)
      toast({
        title: "Print Failed",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDFs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(quotationId)
        return newSet
      })
    }
  }

  const handleShareQuotation = async (quotationId: string) => {
    // Get the full quotation data first
    const quotation = await getQuotationById(quotationId)
    if (!quotation) {
      toast({
        title: "Error",
        description: "Quotation not found",
        variant: "destructive",
      })
      return
    }

    // Check if this is a multi-page quotation (has page_id)
    if (quotation.page_id) {
      // Get all related quotations by page_id
      const { getQuotationsByPageId } = await import("@/lib/quotation-service")
      const relatedQuotations = await getQuotationsByPageId(quotation.page_id)

      // Check if any PDFs need to be generated or if signature dates need checking
      const needsGeneration = relatedQuotations.some(q => !q.pdf)
      const needsSignatureCheck = relatedQuotations.some(q => q.pdf && q.signature_date)

      if (needsGeneration || needsSignatureCheck) {
        // Show generating toast
        toast({
          title: "Generating PDFs",
          description: "Please wait while we prepare all quotations for sharing...",
        })

        try {
          // Fetch the current user's signature once for all PDFs
          let userSignatureDataUrl: string | null = null
          let signatureDate: Date | null = null
          if (user?.uid) {
            try {
              const { doc, getDoc } = await import("firebase/firestore")
              const { db } = await import("@/lib/firebase")
              const userDocRef = doc(db, "boohk_users", user.uid)
              const userDoc = await getDoc(userDocRef)

              if (userDoc.exists()) {
                const userDataFetched = userDoc.data()
                if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
                  const signatureUrl = userDataFetched.signature.url
                  console.log('[LIST_SHARE_MULTI] Found current user signature URL:', signatureUrl)

                  // Convert signature image to base64 data URL
                  try {
                    const response = await fetch(signatureUrl)
                    if (response.ok) {
                      const blob = await response.blob()
                      const arrayBuffer = await blob.arrayBuffer()
                      const base64 = Buffer.from(arrayBuffer).toString('base64')
                      const mimeType = blob.type || 'image/png'
                      userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                      console.log('[LIST_SHARE_MULTI] Converted current user signature to base64 data URL')
                    } else {
                      console.warn('[LIST_SHARE_MULTI] Failed to fetch current user signature image:', response.status)
                    }
                  } catch (fetchError) {
                    console.error('[LIST_SHARE_MULTI] Error converting current user signature to base64:', fetchError)
                  }
                }
                // Also fetch signature date
                if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                  signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
                }
              }
            } catch (error) {
              console.error('[LIST_SHARE_MULTI] Error fetching current user signature:', error)
            }
          }

          // Generate PDFs for all quotations that don't have one or need regeneration due to signature mismatch
          const updatedRelatedQuotations = [...relatedQuotations]
          let generatedCount = 0

          for (let i = 0; i < relatedQuotations.length; i++) {
            const q = relatedQuotations[i]

            // Check if PDF already exists and signature dates match
            const currentSignatureDate = await getCurrentUserSignatureDate(user)
            const storedSignatureDate = q.signature_date

            let needsRegeneration = !q.pdf

            if (q.pdf && currentSignatureDate && storedSignatureDate) {
              const currentDate = new Date(currentSignatureDate).getTime()
              const storedDate = new Date(storedSignatureDate).getTime()

              if (currentDate !== storedDate) {
                console.log('[LIST_SHARE_MULTI] Signature dates do not match for quotation:', q.id, 'regenerating PDF')
                needsRegeneration = true
              } else {
                console.log('[LIST_SHARE_MULTI] Signature dates match for quotation:', q.id, 'using existing PDF')
              }
            } else if (q.pdf && (!currentSignatureDate || !storedSignatureDate)) {
              console.log('[LIST_SHARE_MULTI] Missing signature date info for quotation:', q.id, 'regenerating PDF')
              needsRegeneration = true
            }

            if (needsRegeneration) {
              // Generate and upload PDF using the current user's signature for all PDFs
              const { generateAndUploadQuotationPDF } = await import("@/lib/quotation-service")
              const { pdfUrl, password } = await generateAndUploadQuotationPDF(q, userData ? {
                first_name: userData.first_name || undefined,
                last_name: userData.last_name || undefined,
                email: userData.email || undefined,
                company_id: userData.company_id || undefined,
              } : undefined, companyData, userSignatureDataUrl)

              // Update the quotation with PDF URL and password
              const { updateDoc, doc } = await import("firebase/firestore")
              const { db } = await import("@/lib/firebase")
              await updateDoc(doc(db, "quotations", q.id!), {
                pdf: pdfUrl,
                password: password,
                signature_date: signatureDate
              })

              // Update the local state
              updatedRelatedQuotations[i] = { ...q, pdf: pdfUrl, password: password, signature_date: signatureDate }
              generatedCount++
            }
          }

          toast({
            title: "Success",
            description: `PDFs generated successfully (${generatedCount} generated). Opening share dialog...`,
          })
        } catch (error) {
          console.error("Error generating PDFs for share:", error)
          toast({
            title: "Error",
            description: "Failed to generate PDFs. Please try again.",
            variant: "destructive",
          })
          return
        }
      }
    } else {
      // Single quotation - check if PDF exists and signature dates match
      if (quotation.pdf) {
        // If PDF exists, check signature dates
        const currentSignatureDate = await getCurrentUserSignatureDate(user)
        const storedSignatureDate = quotation.signature_date

        let needsRegeneration = false

        if (currentSignatureDate && storedSignatureDate) {
          const currentDate = new Date(currentSignatureDate).getTime()
          const storedDate = new Date(storedSignatureDate).getTime()

          if (currentDate !== storedDate) {
            console.log('[LIST_SHARE] Signature dates do not match, regenerating PDF')
            needsRegeneration = true
          } else {
            console.log('[LIST_SHARE] Signature dates match, using existing PDF')
          }
        } else if (!currentSignatureDate || !storedSignatureDate) {
          console.log('[LIST_SHARE] Missing signature date info, regenerating PDF')
          needsRegeneration = true
        }

        if (!needsRegeneration) {
          // If PDF exists and signature dates match, proceed directly to share dialog
          setSelectedQuotationForShare(quotation)
          setShareDialogOpen(true)
          return
        } else {
          // Show generating toast when regeneration is needed
          toast({
            title: "Generating PDF",
            description: "Please wait while we regenerate your PDF...",
          })
        }
      }

      // Generate new PDF if it doesn't exist or needs regeneration
      try {
        const result = await generatePDFIfNeeded(quotation, user, userData, companyData)
        toast({
          title: "Success",
          description: "PDF generated successfully. Opening share dialog...",
        })
      } catch (error) {
        console.error("Error generating PDF for share:", error)
        toast({
          title: "Error",
          description: "Failed to generate PDF. Please try again.",
          variant: "destructive",
        })
        return
      }
    }

    // Set the selected quotation for share and open the dialog directly
    setSelectedQuotationForShare(quotation)
    setShareDialogOpen(true)
  }


  const validateComplianceForJO = (quotation: any) => {
    const compliance = quotation.projectCompliance || {}

    // Check if either signed contract OR signed quotation is uploaded
    const hasSignedContract = compliance.signedContract?.fileUrl
    const hasSignedQuotation = compliance.signedQuotation?.fileUrl

    if (hasSignedContract || hasSignedQuotation) {
      return {
        isValid: true,
        missingItems: [],
      }
    }

    return {
      isValid: false,
      missingItems: ["Signed Contract or Signed Quotation"],
    }
  }

  const handleCreateJO = (quotationId: string) => {
    console.log("[v0] Create JO clicked for quotationId:", quotationId)
    console.log(
      "[v0] Available quotations:",
      quotations.map((q) => ({ id: q.id, number: q.quotation_number })),
    )

    const quotation = quotations.find((q) => q.id === quotationId)
    console.log(
      "[v0] Found quotation:",
      quotation ? { id: quotation.id, number: quotation.quotation_number } : "NOT FOUND",
    )

    if (!quotation) {
      toast({
        title: "Error",
        description: "Quotation not found. Please try again.",
        variant: "destructive",
      })
      return
    }

    const validation = validateComplianceForJO(quotation)

    if (!validation.isValid) {
      toast({
        title: "Compliance Requirements Not Met",
        description: `Please complete the following items before creating a Job Order: ${validation.missingItems.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Navigate to JO creation with the quotation ID
    router.push(`/sales/job-orders/create?quotationId=${quotationId}`)
  }


  const handleQuotationRoute = (id: string) => {
    router.push(`/sales/quotations/${id}`)
  }
  const fetchCompanyData = async () => {
    if (!user?.uid || !userData) return

    try {
      let companyDoc = null
      let companyDataResult = null

      // First, try to find company by company_id if it exists in userData
      if (userData?.company_id) {
        try {
          const companyDocRef = doc(db, "companies", userData.company_id)
          const companyDocSnap = await getDoc(companyDocRef)

          if (companyDocSnap.exists()) {
            companyDoc = companyDocSnap
            companyDataResult = companyDocSnap.data()
          }
        } catch (error) {
          console.error("Error fetching company by company_id:", error)
        }
      }

      // If no company found by company_id, try other methods
      if (!companyDoc) {
        // Try to find company by created_by field
        let companiesQuery = query(collection(db, "companies"), where("created_by", "==", user.uid))
        let companiesSnapshot = await getDocs(companiesQuery)

        // If no company found by created_by, try to find by email or other identifiers
        if (companiesSnapshot.empty && user.email) {
          companiesQuery = query(collection(db, "companies"), where("email", "==", user.email))
          companiesSnapshot = await getDocs(companiesQuery)
        }

        // If still no company found, try to find by contact_person email
        if (companiesSnapshot.empty && user.email) {
          companiesQuery = query(collection(db, "companies"), where("contact_person", "==", user.email))
          companiesSnapshot = await getDocs(companiesQuery)
        }

        if (!companiesSnapshot.empty) {
          companyDoc = companiesSnapshot.docs[0]
          companyDataResult = companyDoc.data()
        }
      }

      if (companyDoc && companyDataResult) {
        const company: any = {
          id: companyDoc.id,
          name: companyDataResult.name,
          company_location: companyDataResult.company_location || companyDataResult.address,
          address: companyDataResult.address,
          company_website: companyDataResult.company_website || companyDataResult.website,
          photo_url: companyDataResult.photo_url,
          contact_person: companyDataResult.contact_person,
          email: companyDataResult.email,
          phone: companyDataResult.phone,
          social_media: companyDataResult.social_media || {},
          created_by: companyDataResult.created_by,
          created: companyDataResult.created?.toDate
            ? companyDataResult.created.toDate()
            : companyDataResult.created_at?.toDate(),
          updated: companyDataResult.updated?.toDate
            ? companyDataResult.updated.toDate()
            : companyDataResult.updated_at?.toDate(),
        }

        setCompanyData(company)
      } else {
        setCompanyData(null)
      }
    } catch (error) {
      console.error("Error fetching company data:", error)
    }
  }

  const handleProjectNameSubmit = async () => {
    if (!selectedQuotationForProject || !user?.uid || !userData?.company_id || !projectName.trim()) {
      toast({
        title: "Error",
        description: "Project name is required.",
        variant: "destructive",
      })
      return
    }

    setCreatingReservation(true)
    try {
      const quotationRef = doc(db, "quotations", selectedQuotationForProject.id)
      let downloadURL = ""

      // Upload the file to Firebase Storage
      if (selectedQuotationForProject.tempFile && selectedQuotationForProject.tempComplianceType) {
        const file = selectedQuotationForProject.tempFile
        const complianceType = selectedQuotationForProject.tempComplianceType

        // Create storage reference
        const fileName = `${Date.now()}-${file.name}`
        const storageRef = ref(storage, `quotations/${selectedQuotationForProject.id}/compliance/${complianceType}/${fileName}`)

        // Upload file
        const snapshot = await uploadBytes(storageRef, file)
        downloadURL = await getDownloadURL(snapshot.ref)
      }

      // Update quotation with compliance data including the file URL
      const updateData: { [key: string]: any } = {
        [`projectCompliance.${selectedQuotationForProject.tempComplianceType}`]: {
          status: "completed",
          fileUrl: downloadURL,
          fileName: selectedQuotationForProject.tempFile?.name || "",
          uploadedBy: user?.uid,
          sent_from: "Boohk",
          sent_by: `${userData?.first_name || ""} ${userData?.last_name || ""}`.trim() || user?.email || `User-${user?.uid?.slice(-6)}`,
        },
        status: "reserved", // Update the main status of the quotation
        updated: serverTimestamp(),
      }

      await updateDoc(quotationRef, updateData)

      // Then, fetch the updated quotation data
      const updatedQuotationDoc = await getDoc(quotationRef)
      if (!updatedQuotationDoc.exists()) {
        throw new Error("Updated quotation not found after compliance upload.")
      }
      const fullQuotationData = { id: selectedQuotationForProject.id, ...updatedQuotationDoc.data() } as any

      // Pass quotation dates directly to booking - the booking service will handle them properly
      const bookingData = {
        ...fullQuotationData,
        start_date: fullQuotationData.start_date,
        end_date: fullQuotationData.end_date,
      }

      const bookingId = await bookingService.createBooking(bookingData, user.uid, userData.company_id, projectName.trim())
      console.log("[DEBUG] Booking created with ID:", bookingId)

      // Create booking object for congratulations dialog
      const booking = {
        id: bookingId,
        reservation_id: bookingId, // Use bookingId as reservation_id
        ...bookingData
      }

      // Show congratulations dialog
      setCreatedBooking(booking)
      setShowBookingCongratulationsDialog(true)

      // Close project name dialog
      setProjectNameDialogOpen(false)
      setSelectedQuotationForProject(null)
      setProjectName("")

      // Real-time listener will automatically update the quotations list
    } catch (bookingError) {
      console.error("[DEBUG] Error creating booking:", bookingError)
      toast({
        title: "Booking Creation Failed",
        description: "Failed to create booking document. Please check console for details.",
        variant: "destructive",
      })
    } finally {
      setCreatingReservation(false)
    }
  }

  const handleViewSentHistory = (quotation: any) => {
    setSelectedQuotationForHistory(quotation)
    setShowSentHistoryDialog(true)
  }

  const handleAcceptCompliance = async (quotationId: string, complianceType: string) => {
    try {
      const quotationRef = doc(db, "quotations", quotationId)
      const updateData: { [key: string]: any } = {
        [`projectCompliance.${complianceType}.status`]: "completed",
        [`projectCompliance.${complianceType}.completed`]: true,
        updated: serverTimestamp(),
      }

      await updateDoc(quotationRef, updateData)

      toast({
        title: "Success",
        description: `${complianceType.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} accepted successfully`,
      })

      // Real-time listener will automatically update the quotations list

      // Update the selected quotation for compliance dialog
      if (selectedQuotationForCompliance && selectedQuotationForCompliance.id === quotationId) {
        setSelectedQuotationForCompliance({
          ...selectedQuotationForCompliance,
          projectCompliance: {
            ...selectedQuotationForCompliance.projectCompliance,
            [complianceType]: {
              ...selectedQuotationForCompliance.projectCompliance?.[complianceType],
              status: "completed",
              completed: true,
            }
          }
        })
      }
    } catch (error: any) {
      console.error("Error accepting compliance:", error)
      toast({
        title: "Error",
        description: "Failed to accept compliance. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeclineCompliance = async (quotationId: string, complianceType: string) => {
    try {
      const quotationRef = doc(db, "quotations", quotationId)
      const updateData: { [key: string]: any } = {
        [`projectCompliance.${complianceType}.status`]: "declined",
        [`projectCompliance.${complianceType}.completed`]: false,
        updated: serverTimestamp(),
      }

      await updateDoc(quotationRef, updateData)

      toast({
        title: "Success",
        description: `${complianceType.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} declined successfully`,
      })

      // Real-time listener will automatically update the quotations list

      // Update the selected quotation for compliance dialog
      if (selectedQuotationForCompliance && selectedQuotationForCompliance.id === quotationId) {
        setSelectedQuotationForCompliance({
          ...selectedQuotationForCompliance,
          projectCompliance: {
            ...selectedQuotationForCompliance.projectCompliance,
            [complianceType]: {
              ...selectedQuotationForCompliance.projectCompliance?.[complianceType],
              status: "declined",
              completed: false,
            }
          }
        })
      }
    } catch (error: any) {
      console.error("Error declining compliance:", error)
      toast({
        title: "Error",
        description: "Failed to decline compliance. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleViewCompliance = (quotation: any) => {
    setSelectedQuotationForCompliance(quotation)
    setShowComplianceDialog(true)
  }

  const handleMarkAsReserved = (quotation: any) => {
    const compliance = getProjectCompliance(quotation)
    const isComplete = compliance.completed === compliance.total

    if (isComplete) {
      // If compliance is complete, proceed directly to project name dialog
      setSelectedQuotationForProject(quotation)
      setProjectNameDialogOpen(true)
    } else {
      // If compliance is incomplete, show confirmation dialog first
      setSelectedQuotationForReservation(quotation)
      setShowReservationConfirmationDialog(true)
    }
    setShowComplianceDialog(false) // Close the compliance dialog
  }
  const handleReservationConfirmationSkip = () => {
    // User acknowledged and wants to skip incomplete compliance
    if (selectedQuotationForReservation) {
      setSelectedQuotationForProject(selectedQuotationForReservation)
      setProjectNameDialogOpen(true)
      setShowReservationConfirmationDialog(false)
      setSelectedQuotationForReservation(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Quotations</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 opacity-30" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 w-96 border-gray-300 rounded-full"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full p-0"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <Button
              onClick={() => router.push("/sales/dashboard?tab=quotations")}
              className="bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-900 font-medium rounded-lg px-6 py-2"
            >
              Create Quotation
            </Button>
          </div>
        </div>

        {(loading || searchLoading) ? (
          <Card className="bg-white overflow-hidden rounded-t-lg">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 border-0">Date</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Quotation ID</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Company</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Client</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Status</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Compliance</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-gray-200">
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-12" />
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : quotations.length > 0 ? (
          <Card className="border-gray-200 shadow-sm overflow-hidden rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 border-0">Date</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Quotation ID</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Company</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Client</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Status</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Compliance</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((quotation: any) => {
                  const compliance = getProjectCompliance(quotation)

                  return (
                    <TableRow key={quotation.id} className="cursor-pointer border-b border-gray-200" 
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/sales/quotations/${quotation.id}`)
                      }}>
                      <TableCell className="py-3">
                        <div className="text-sm text-gray-600">
                          {(() => {
                            const date = quotation.created instanceof Date ? quotation.created : (quotation.created && typeof quotation.created.toDate === 'function' ? quotation.created.toDate() : null);
                            if (!date || isNaN(date.getTime())) {
                              return "—";
                            }
                            return format(date, "MMM d, yyyy");
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="py-3" >
                        <div className="font-medium text-gray-900"   >{quotation.quotation_number || quotation.id || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-sm text-gray-600">{quotation.client_company_name || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium text-gray-900">{quotation.client_name || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-sm text-gray-600">{quotation.items?.name || quotation.product_name || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="secondary"
                          className={`${getStatusColor(quotation.status)} border`}
                        >
                          {quotation.status ? quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1).toLowerCase() : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className="font-bold text-[#2d3fff] font-medium underline leading-[0.5] cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewCompliance(quotation)
                          }}
                        >
                          ({compliance.completed}/{compliance.total})
                        </span>
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-600"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => router.push(`/sales/quotations/${quotation.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                 e.stopPropagation()
                                handleDownloadPDF(quotation.id)
                              }}
                              disabled={generatingPDFs.has(quotation.id)}
                            >
                              {generatingPDFs.has(quotation.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  Generating PDF...
                                </>
                              ) : (
                                <>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download PDF
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleShareQuotation(quotation.id)}>
                              <Share2 className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewSentHistory(quotation)}>
                              <History className="mr-2 h-4 w-4" />
                              View Sent History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handlePrintQuotation(quotation.id)}
                              disabled={generatingPDFs.has(quotation.id)}
                            >
                              {generatingPDFs.has(quotation.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                  Generating PDF...
                                </>
                              ) : (
                                <>
                                  <Printer className="mr-2 h-4 w-4" />
                                  Print
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="bg-white rounded-xl">
            <CardContent className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No quotations yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first quotation to get started
              </p>
              <Button
                onClick={() => router.push("/sales/quotations/compose/new")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Quotation
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pagination Controls */}
        {!loading && quotations.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="text-sm text-gray-600">
              Page {currentPage}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMorePages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedQuotationForShare && (
        <SendQuotationOptionsDialog
          isOpen={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          quotation={selectedQuotationForShare}
          onEmailClick={() => {
            setShareDialogOpen(false)
            router.push(`/sales/quotations/${selectedQuotationForShare.id}/compose-email`)
          }}
          companyData={companyData}
        />
      )}

      <Dialog open={projectNameDialogOpen} onOpenChange={handleProjectNameDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Project Name</DialogTitle>
            <DialogDescription>
              Please enter a name for this project. This will be saved with the reservation.
            </DialogDescription>
          </DialogHeader>

          {selectedQuotationForProject && (
            <div className="space-y-4">
              {/* Quotation Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm font-medium text-gray-900">
                  {selectedQuotationForProject.quotation_number || "New Quotation"}
                </div>
                <div className="text-xs text-gray-600">
                  {selectedQuotationForProject.client_name} • {selectedQuotationForProject.items?.name || "Service"}
                </div>
              </div>

              {/* Project Name Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Project Name *</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="w-full"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setProjectNameDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProjectNameSubmit} disabled={!projectName.trim() || creatingReservation}>
                  {creatingReservation ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Reservation...
                    </>
                  ) : (
                    "Create Reservation"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SentHistoryDialog
        open={showSentHistoryDialog}
        onOpenChange={setShowSentHistoryDialog}
        proposalId={selectedQuotationForHistory?.id || ""}
        emailType="quotation"
      />

      <ComplianceDialog
        open={showComplianceDialog}
        onOpenChange={setShowComplianceDialog}
        quotation={selectedQuotationForCompliance}
        onFileUpload={handleFileUpload}
        uploadingFiles={uploadingFiles}
        onAccept={handleAcceptCompliance}
        onDecline={handleDeclineCompliance}
        onMarkAsReserved={handleMarkAsReserved}
        userEmail={user?.email || userData?.email || undefined}
      />
      <ComplianceConfirmationDialog
        isOpen={showReservationConfirmationDialog}
        onClose={() => setShowReservationConfirmationDialog(false)}
        onSkip={handleReservationConfirmationSkip}
        onFileUpload={(complianceType, file) => handleFileUpload(selectedQuotationForReservation?.id || "", complianceType, file)}
        uploadingFiles={uploadingFiles}
        quotationId={selectedQuotationForReservation?.id}
        complianceItems={
          selectedQuotationForReservation
            ? getProjectCompliance(selectedQuotationForReservation).toReserve
                .concat(getProjectCompliance(selectedQuotationForReservation).otherRequirements)
                .map(item => ({
                  name: item.name,
                  completed: item.status === "completed",
                  type: item.status === "confirmation" ? "confirmation" : "upload" as "upload" | "confirmation",
                  key: item.key,
                  file: item.file,
                  fileUrl: item.fileUrl
                }))
            : []
        }
      />

      <BookingCongratulationsDialog
        open={showBookingCongratulationsDialog}
        onOpenChange={setShowBookingCongratulationsDialog}
        booking={createdBooking}
      />
    </div>
  )
}
