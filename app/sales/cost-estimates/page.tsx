"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MoreVertical,
  FileText,
  Eye,
  Download,
  Calendar,
  Building2,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Calculator,
  X,
  Share2,
  Printer,
  Check,
  Copy,
  Mail,
  MessageSquare,
  MessageCircle,
  History,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"
import { getCostEstimatesByCreatedBy, getPaginatedCostEstimatesByCreatedBy, getCostEstimate, generateAndUploadCostEstimatePDF, updateCostEstimate } from "@/lib/cost-estimate-service" // Import CostEstimate service
import type { CostEstimate, CostEstimateStatus, CostEstimateLineItem } from "@/lib/types/cost-estimate" // Import CostEstimate type
import { generateCostEstimatePDF, printCostEstimatePDF, generateCostEstimatePDFBlob } from "@/lib/cost-estimate-pdf-service"
import { useResponsive } from "@/hooks/use-responsive"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CostEstimatesList } from "@/components/cost-estimates-list" // Import CostEstimatesList
import { SendCostEstimateOptionsDialog } from "@/components/send-cost-estimate-options-dialog" // Import SendCostEstimateOptionsDialog
import { SentHistoryDialog } from "@/components/sent-history-dialog"
import { searchCostEstimates, SearchResult } from "@/lib/algolia-service"
import { useDebounce } from "@/hooks/use-debounce"
import { Timestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

function CostEstimatesPageContent() {
  const [costEstimates, setCostEstimates] = useState<CostEstimate[]>([])
  const [filteredCostEstimates, setFilteredCostEstimates] = useState<CostEstimate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false) // Assuming this might be used for CE
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [selectedCostEstimateForShare, setSelectedCostEstimateForShare] = useState<any>(null)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  const [showSentHistoryDialog, setShowSentHistoryDialog] = useState(false)
  const [selectedCostEstimateForHistory, setSelectedCostEstimateForHistory] = useState<any>(null)

  // Algolia search states
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [lastDocId, setLastDocId] = useState<string | null>(null)
  const [hasMorePages, setHasMorePages] = useState(true)
  const itemsPerPage = 10

  // PDF generation states
  const [generatingPDFs, setGeneratingPDFs] = useState<Set<string>>(new Set())

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const { user, userData } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isMobile } = useResponsive()
  const { toast } = useToast()

  useEffect(() => {
    if (user?.uid) {
      loadCostEstimates(1, true)
    }
  }, [user])

  useEffect(() => {
    // Reset pagination when filters change
    if (user?.uid) {
      setCurrentPage(1)
      setLastDocId(null)
      setHasMorePages(true)

      // Use Algolia search if there's a search term or status filter
      if (debouncedSearchTerm || statusFilter !== "all") {
        performAlgoliaSearch(debouncedSearchTerm, statusFilter, 0)
      } else {
        // Load all cost estimates if no search/filter
        loadCostEstimates(1, true)
        setIsSearching(false)
        setSearchResults([])
      }
    }
  }, [debouncedSearchTerm, statusFilter, user?.uid])

  // Assuming a success dialog might be relevant for cost estimates too
  useEffect(() => {
    const success = searchParams.get("success")
    if (success === "email-sent") {
      setShowSuccessDialog(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("success")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  const loadCostEstimates = async (page: number = 1, reset: boolean = false) => {
    if (!user?.uid) return

    setLoading(true)
    try {
      const result = await getPaginatedCostEstimatesByCreatedBy(
        userData?.company_id || "",
        itemsPerPage,
        reset ? null : lastDocId
      )

      if (reset) {
        setCostEstimates(result.items)
        setLastDocId(result.lastVisible)
        setCurrentPage(1)
      } else {
        setCostEstimates(result.items)
        setLastDocId(result.lastVisible)
      }

      setHasMorePages(result.hasMore)
    } catch (error) {
      console.error("Error loading cost estimates:", error)
    } finally {
      setLoading(false)
    }
  }

  const performAlgoliaSearch = async (query: string, status: string, page: number = 0) => {
    if (!user?.uid || !userData?.company_id) {
      console.log("No user or company_id, skipping search")
      return
    }

    setSearchLoading(true)
    try {
      console.log("Performing Algolia search with:", { query, status, companyId: userData.company_id })

      let filters = `company_id:${userData.company_id}`

      // Add status filter if not "all"
      if (status !== "all") {
        filters += ` AND status:${status}`
      }

      console.log("Search filters:", filters)

      const result = await searchCostEstimates(query, userData.company_id, page, itemsPerPage)

      console.log("Algolia search result:", result)

      if (result.error) {
        console.error("Algolia search error:", result.error)
        setSearchResults([])
        return
      }

      console.log("Search hits:", result.hits)
      setSearchResults(result.hits)
      setIsSearching(query.length > 0 || status !== "all")
    } catch (error) {
      console.error("Error performing Algolia search:", error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  // Note: Filtering is now handled server-side or simplified for server-side pagination
  // For now, we'll use the costEstimates directly

  const getStatusConfig = (status: CostEstimate["status"]) => {
    switch (status) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: Clock,
          label: "Draft",
        }
      case "sent":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Send,
          label: "Sent",
        }
      case "viewed":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: Eye,
          label: "Viewed",
        }
      case "accepted":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: CheckCircle,
          label: "Accepted",
        }
      case "declined":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: XCircle,
          label: "Declined",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: Clock,
          label: "Unknown",
        }
    }
  }

  const handleViewCostEstimate = (costEstimateId: string) => {
    router.push(`/sales/cost-estimates/${costEstimateId}`)
  }

  // Helper function to fetch current user's signature.updated date
  const getCurrentUserSignatureDate = async (): Promise<Date | null> => {
    if (!user?.uid) return null
    try {
      const { doc, getDoc } = await import("firebase/firestore")
      const { db } = await import("@/lib/firebase")
      const userDocRef = doc(db, "iboard_users", user.uid)
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

  // Helper function to generate PDF if needed with signature date check
  const generatePDFIfNeeded = async (costEstimate: CostEstimate, userData: any) => {
    // Check if PDF exists and signature dates match
    if (costEstimate.pdf) {
      const currentSignatureDate = await getCurrentUserSignatureDate()
      const storedSignatureDate = costEstimate.signature_date

      if (currentSignatureDate && storedSignatureDate) {
        const currentDate = new Date(currentSignatureDate).getTime()
        const storedDate = new Date(storedSignatureDate).getTime()

        if (currentDate === storedDate) {
          console.log('[LIST_PDF_GENERATE] Signature dates match, using existing PDF')
          return { pdfUrl: costEstimate.pdf, password: costEstimate.password }
        } else {
          console.log('[LIST_PDF_GENERATE] Signature dates do not match, regenerating PDF')
        }
      } else {
        console.log('[LIST_PDF_GENERATE] Missing signature date info, regenerating PDF')
      }
    }

    try {
      // Fetch user signature from iboard_users collection
      let userSignatureDataUrl: string | null = null
      let signatureDate: Date | null = null
      if (costEstimate.createdBy) {
        try {
          const { doc, getDoc } = await import("firebase/firestore")
          const { db } = await import("@/lib/firebase")
          const userDocRef = doc(db, "iboard_users", costEstimate.createdBy)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
              const signatureUrl = userDataFetched.signature.url
              console.log('[LIST_PDF_GENERATE] Found user signature URL:', signatureUrl)

              // Convert signature image to base64 data URL
              try {
                const response = await fetch(signatureUrl)
                if (response.ok) {
                  const blob = await response.blob()
                  const arrayBuffer = await blob.arrayBuffer()
                  const base64 = Buffer.from(arrayBuffer).toString('base64')
                  const mimeType = blob.type || 'image/png'
                  userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                  console.log('[LIST_PDF_GENERATE] Converted signature to base64 data URL')
                } else {
                  console.warn('[LIST_PDF_GENERATE] Failed to fetch signature image:', response.status)
                }
              } catch (fetchError) {
                console.error('[LIST_PDF_GENERATE] Error converting signature to base64:', fetchError)
              }
            }
            // Also fetch signature date
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('[LIST_PDF_GENERATE] Error fetching user signature:', error)
        }
      }

      // Generate and upload PDF, then save to database
      const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(costEstimate, userData ? {
        first_name: userData.first_name || undefined,
        last_name: userData.last_name || undefined,
        email: userData.email || undefined,
        company_id: userData.company_id || undefined,
      } : undefined, undefined, userSignatureDataUrl)

      // Update cost estimate with PDF URL, password, and signature date
      await updateCostEstimate(costEstimate.id, {
        pdf: pdfUrl,
        password: password,
        signature_date: signatureDate
      })

      console.log("Cost estimate PDF generated and uploaded successfully:", pdfUrl)
      return { pdfUrl, password }
    } catch (error) {
      console.error("Error generating cost estimate PDF:", error)
      throw error
    }
  }

  const handleDownloadPDF = async (costEstimate: CostEstimate, userData: any) => {
    try {
      // Fetch the full cost estimate data first
      const costEstimateId = costEstimate.id || (costEstimate as any).objectID
      const fullCostEstimate = await getCostEstimate(costEstimateId)
      if (!fullCostEstimate) {
        throw new Error("Cost estimate not found")
      }

      // Check if PDF already exists
      if (fullCostEstimate.pdf) {
        // If PDF exists, check signature dates
        const currentSignatureDate = await getCurrentUserSignatureDate()
        const storedSignatureDate = fullCostEstimate.signature_date

        if (currentSignatureDate && storedSignatureDate) {
          const currentDate = new Date(currentSignatureDate).getTime()
          const storedDate = new Date(storedSignatureDate).getTime()

          if (currentDate !== storedDate) {
            console.log('[LIST_DOWNLOAD] Signature dates do not match, regenerating PDF')
            // Generate new PDF
            const result = await generatePDFIfNeeded(fullCostEstimate, userData)
            const newPdfUrl = result.pdfUrl

            // Download the newly generated PDF
            const response = await fetch(newPdfUrl)
            if (!response.ok) {
              throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${fullCostEstimate.costEstimateNumber || fullCostEstimate.id}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)

            // Revoke blob URL after a short delay
            setTimeout(() => {
              window.URL.revokeObjectURL(url)
            }, 2000)

            toast({
              title: "Success",
              description: "PDF regenerated and downloaded successfully",
            })
            return
          } else {
            console.log('[LIST_DOWNLOAD] Signature dates match, using existing PDF')
          }
        } else {
          console.log('[LIST_DOWNLOAD] Missing signature date info, regenerating PDF')
          // Generate new PDF
          const result = await generatePDFIfNeeded(fullCostEstimate, userData)
          const newPdfUrl = result.pdfUrl

          // Download the newly generated PDF
          const response = await fetch(newPdfUrl)
          if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
          }

          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${fullCostEstimate.costEstimateNumber || fullCostEstimate.id}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)

          // Revoke blob URL after a short delay
          setTimeout(() => {
            window.URL.revokeObjectURL(url)
          }, 2000)

          toast({
            title: "Success",
            description: "PDF generated and downloaded successfully",
          })
          return
        }

        // If PDF exists and signature dates match, download it directly
        const response = await fetch(fullCostEstimate.pdf)
        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fullCostEstimate.costEstimateNumber || fullCostEstimate.id}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Revoke blob URL after a short delay
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 2000)

        toast({
          title: "Success",
          description: "PDF downloaded successfully",
        })
      } else {
        // Show generating toast
        toast({
          title: "Generating PDF",
          description: "Please wait while we generate your PDF...",
        })

        // If no PDF exists, generate it and save to database
        // Fetch user signature from iboard_users collection
        let userSignatureDataUrl: string | null = null
        let signatureDate: Date | null = null
        if (fullCostEstimate.createdBy) {
          try {
            const { doc, getDoc } = await import("firebase/firestore")
            const { db } = await import("@/lib/firebase")
            const userDocRef = doc(db, "iboard_users", fullCostEstimate.createdBy)
            const userDoc = await getDoc(userDocRef)

            if (userDoc.exists()) {
              const userDataFetched = userDoc.data()
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
                const signatureUrl = userDataFetched.signature.url
                console.log('[LIST_PDF] Found user signature URL:', signatureUrl)

                // Convert signature image to base64 data URL
                try {
                  const response = await fetch(signatureUrl)
                  if (response.ok) {
                    const blob = await response.blob()
                    const arrayBuffer = await blob.arrayBuffer()
                    const base64 = Buffer.from(arrayBuffer).toString('base64')
                    const mimeType = blob.type || 'image/png'
                    userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                    console.log('[LIST_PDF] Converted signature to base64 data URL')
                  } else {
                    console.warn('[LIST_PDF] Failed to fetch signature image:', response.status)
                  }
                } catch (fetchError) {
                  console.error('[LIST_PDF] Error converting signature to base64:', fetchError)
                }
              }
              // Also fetch signature date
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
              }
            }
          } catch (error) {
            console.error('[LIST_PDF] Error fetching user signature:', error)
          }
        }

        // Generate and upload PDF, then save to database
        const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(fullCostEstimate, userData ? {
          first_name: userData.first_name || undefined,
          last_name: userData.last_name || undefined,
          email: userData.email || undefined,
          company_id: userData.company_id || undefined,
        } : undefined, undefined, userSignatureDataUrl)

        // Update cost estimate with PDF URL, password, and signature date
        await updateCostEstimate(fullCostEstimate.id, {
          pdf: pdfUrl,
          password: password,
          signature_date: signatureDate
        })

        // Download the newly generated PDF
        const response = await fetch(pdfUrl)
        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fullCostEstimate.costEstimateNumber || fullCostEstimate.id}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Revoke blob URL after a short delay
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 2000)

        toast({
          title: "Success",
          description: "PDF generated and downloaded successfully",
        })
      }
    } catch (error) {
      console.error("Error downloading PDF:", error)
      alert("Failed to download PDF. Please try again.")
    }
  }

  const handlePrintPDF = async (costEstimate: CostEstimate) => {
    const costEstimateId = costEstimate.id || (costEstimate as any).objectID
    setGeneratingPDFs((prev) => new Set(prev).add(costEstimateId))

    try {
      // Get the full cost estimate data including the pdf field
      const fullCostEstimate = await getCostEstimate(costEstimateId)
      if (!fullCostEstimate) {
        throw new Error("Cost estimate not found")
      }

      // Check if PDF already exists in the cost estimate document
      if (fullCostEstimate.pdf) {
        // If PDF exists, check signature dates
        const currentSignatureDate = await getCurrentUserSignatureDate()
        const storedSignatureDate = fullCostEstimate.signature_date

        if (currentSignatureDate && storedSignatureDate) {
          const currentDate = new Date(currentSignatureDate).getTime()
          const storedDate = new Date(storedSignatureDate).getTime()

          if (currentDate !== storedDate) {
            console.log('[LIST_PRINT] Signature dates do not match, regenerating PDF')
            // Show generating toast
            toast({
              title: "Generating PDF",
              description: "Please wait while we regenerate your PDF for printing...",
            })
            // Generate new PDF
            const result = await generatePDFIfNeeded(fullCostEstimate, userData)
            const newPdfUrl = result.pdfUrl

            // Open the newly generated PDF for printing
            const printWindow = window.open(newPdfUrl)
            if (printWindow) {
              printWindow.onload = () => {
                printWindow.print()
              }
            } else {
              console.error("Failed to open print window")
            }

            toast({
              title: "Success",
              description: "PDF regenerated and opened for printing",
            })
            return
          } else {
            console.log('[LIST_PRINT] Signature dates match, using existing PDF')
          }
        } else {
          console.log('[LIST_PRINT] Missing signature date info, regenerating PDF')
          // Show generating toast
          toast({
            title: "Generating PDF",
            description: "Please wait while we generate your PDF for printing...",
          })
          // Generate new PDF
          const result = await generatePDFIfNeeded(fullCostEstimate, userData)
          const newPdfUrl = result.pdfUrl

          // Open the newly generated PDF for printing
          const printWindow = window.open(newPdfUrl)
          if (printWindow) {
            printWindow.onload = () => {
              printWindow.print()
            }
          } else {
            console.error("Failed to open print window")
          }

          toast({
            title: "Success",
            description: "PDF generated and opened for printing",
          })
          return
        }

        // If PDF exists and signature dates match, open it directly for printing
        const printWindow = window.open(fullCostEstimate.pdf)
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print()
          }
        } else {
          console.error("Failed to open print window")
        }

        toast({
          title: "Success",
          description: "PDF opened for printing",
        })
      } else {
        // Show generating toast
        toast({
          title: "Generating PDF",
          description: "Please wait while we generate your PDF for printing...",
        })

        // If no PDF exists, generate it and save to database (same as download)
        // Fetch user signature from iboard_users collection
        let userSignatureDataUrl: string | null = null
        let signatureDate: Date | null = null
        if (fullCostEstimate.createdBy) {
          try {
            const { doc, getDoc } = await import("firebase/firestore")
            const { db } = await import("@/lib/firebase")
            const userDocRef = doc(db, "iboard_users", fullCostEstimate.createdBy)
            const userDoc = await getDoc(userDocRef)

            if (userDoc.exists()) {
              const userDataFetched = userDoc.data()
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
                const signatureUrl = userDataFetched.signature.url
                console.log('[LIST_PRINT] Found user signature URL:', signatureUrl)

                // Convert signature image to base64 data URL
                try {
                  const response = await fetch(signatureUrl)
                  if (response.ok) {
                    const blob = await response.blob()
                    const arrayBuffer = await blob.arrayBuffer()
                    const base64 = Buffer.from(arrayBuffer).toString('base64')
                    const mimeType = blob.type || 'image/png'
                    userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                    console.log('[LIST_PRINT] Converted signature to base64 data URL')
                  } else {
                    console.warn('[LIST_PRINT] Failed to fetch signature image:', response.status)
                  }
                } catch (fetchError) {
                  console.error('[LIST_PRINT] Error converting signature to base64:', fetchError)
                }
              }
              // Also fetch signature date
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
              }
            }
          } catch (error) {
            console.error('[LIST_PRINT] Error fetching user signature:', error)
          }
        }

        // Generate and upload PDF, then save to database
        const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(fullCostEstimate, userData ? {
          first_name: userData.first_name || undefined,
          last_name: userData.last_name || undefined,
          email: userData.email || undefined,
          company_id: userData.company_id || undefined,
        } : undefined, undefined, userSignatureDataUrl)

        // Update cost estimate with PDF URL, password, and signature date
        await updateCostEstimate(fullCostEstimate.id, {
          pdf: pdfUrl,
          password: password,
          signature_date: signatureDate
        })

        // Open PDF in new window and trigger print
        const printWindow = window.open(pdfUrl)
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print()
          }
        } else {
          console.error("Failed to open print window")
        }
      }

      toast({
        title: "Success",
        description: "PDF generated and opened for printing",
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
        newSet.delete(costEstimateId)
        return newSet
      })
    }
  }

  const handlePrintCostEstimateWindow = async (costEstimate: CostEstimate) => {
    const costEstimateId = costEstimate.id || (costEstimate as any).objectID
    setGeneratingPDFs((prev) => new Set(prev).add(costEstimateId))

    try {
      // Get the full cost estimate data
      const fullCostEstimate = await getCostEstimate(costEstimateId)
      if (!fullCostEstimate) {
        throw new Error("Cost estimate not found")
      }

      // Generate the PDF blob using client-side jsPDF
      const pdfBlob = await generateCostEstimatePDFBlob(fullCostEstimate, {
        first_name: user?.displayName?.split(' ')[0] || "",
        last_name: user?.displayName?.split(' ').slice(1).join(' ') || "",
        email: user?.email || "",
        company_id: userData?.company_id || "",
      })

      // Create a blob URL and open in new window for printing
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const printWindow = window.open(pdfUrl, '_blank')

      if (printWindow) {
        // Wait a bit for the PDF to load, then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
          }, 1000)
        }
      }

      toast({
        title: "Success",
        description: "Cost estimate PDF opened in print window",
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
        newSet.delete(costEstimateId)
        return newSet
      })
    }
  }

  const handleCreateQuotation = async (costEstimateId: string) => {
    try {
      // Fetch the cost estimate data
      const costEstimate = await getCostEstimate(costEstimateId)
      if (!costEstimate) {
        toast({
          title: "Error",
          description: "Cost estimate not found.",
          variant: "destructive",
        })
        return
      }

      // Check if cost estimate has start and end dates
      if (!costEstimate.startDate || !costEstimate.endDate) {
        // Extract site IDs from line items - handle spot IDs by extracting product ID
        const siteIds = costEstimate.lineItems.map(item => {
          // If the ID contains '-', extract the product ID (format: productId-spotNumber)
          if (item.id.includes('-')) {
            return item.id.split('-')[0]
          }
          return item.id
        })
        const sitesParam = encodeURIComponent(JSON.stringify(siteIds))
        const clientId = costEstimate.client?.id

        // Extract CMS and spot number data from line items
        const cmsData: Record<string, any> = {}
        const spotNumbersData: Record<string, string> = {}

        costEstimate.lineItems.forEach(item => {
          // Use the product ID as the key (extract from spot IDs if needed)
          const productId = item.id.includes('-') ? item.id.split('-')[0] : item.id
          if (item.cms) {
            cmsData[productId] = item.cms
          }
          if (item.spot_number) {
            spotNumbersData[productId] = item.spot_number
          }
        })

        // Build URL parameters
        let url = `/sales/quotations/select-dates?sites=${sitesParam}&clientId=${clientId}`

        if (Object.keys(cmsData).length > 0) {
          url += `&cmsData=${encodeURIComponent(JSON.stringify(cmsData))}`
        }

        if (Object.keys(spotNumbersData).length > 0) {
          url += `&spotNumbersData=${encodeURIComponent(JSON.stringify(spotNumbersData))}`
        }

        // Redirect to quotations select-dates page
        router.push(url)
        return
      }

      // Import required functions
      const { createDirectQuotation, createMultipleQuotations, generateQuotationNumber } = await import("@/lib/quotation-service")
      const { Timestamp } = await import("firebase/firestore")

      // Prepare client data
      const clientData = {
        id: costEstimate.client.id || "",
        name: costEstimate.client.name || "",
        email: costEstimate.client.email || "",
        company: costEstimate.client.company || "",
        phone: costEstimate.client.phone || "",
        address: costEstimate.client.address || "",
        designation: costEstimate.client.designation || "",
        industry: costEstimate.client.industry || "",
        company_id: costEstimate.client.company_id || "",
      }

      // Prepare sites data
      const sitesData = costEstimate.lineItems.map(item => ({
        id: item.id,
        name: item.description,
        location: item.specs?.location || "",
        price: item.unitPrice,
        type: item.category.replace(" Rental", ""),
        image: item.image,
        content_type: item.content_type || "",
        specs_rental: item.specs,
        cms: item.cms,
        spot_number: item.spot_number,
      }))

      const options = {
        startDate: costEstimate.startDate,
        endDate: costEstimate.endDate,
        company_id: userData?.company_id || "",
        client_company_id: costEstimate.client.company_id || "",
        page_id: sitesData.length > 1 ? `PAGE-${Date.now()}` : undefined,
        created_by_first_name: userData?.first_name || "",
        created_by_last_name: userData?.last_name || "",
      }

      let quotationIds: string[]

      if (sitesData.length === 1) {
        // Single site - create direct quotation
        const quotationId = await createDirectQuotation(clientData, sitesData, user?.uid || "", options)
        quotationIds = [quotationId]
        toast({
          title: "Quotation Created",
          description: "Quotation has been created successfully from cost estimate.",
        })
      } else {
        // Multiple sites - create multiple quotations
        quotationIds = await createMultipleQuotations(clientData, sitesData, user?.uid || "", options)
        toast({
          title: "Quotations Created",
          description: `${quotationIds.length} quotations have been created successfully from cost estimate.`,
        })
      }

      // Navigate to the first created quotation
      router.push(`/sales/quotations/${quotationIds[0]}`)

    } catch (error) {
      console.error("Error creating quotation from cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to create quotation from cost estimate. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShareCostEstimate = async (costEstimate: CostEstimate) => {
    // Check if this cost estimate has a page_id (multi-site)
    const costEstimateId = costEstimate.id || (costEstimate as any).objectID
    const fullCostEstimate = await getCostEstimate(costEstimateId)
    if (!fullCostEstimate) {
      toast({
        title: "Error",
        description: "Cost estimate not found",
        variant: "destructive",
      })
      return
    }

    // If this is a multi-site cost estimate (has page_id), check/generate PDFs for all related cost estimates
    if (fullCostEstimate.page_id) {
      // Get all related cost estimates by page_id
      const { getCostEstimatesByPageId } = await import("@/lib/cost-estimate-service")
      const relatedCostEstimates = await getCostEstimatesByPageId(fullCostEstimate.page_id)

      // Check if any PDFs need to be generated
      const needsGeneration = relatedCostEstimates.some(estimate => !estimate.pdf)

      if (needsGeneration) {
        // Show generating toast
        toast({
          title: "Generating PDFs",
          description: "Please wait while we prepare all cost estimates for sharing...",
        })

        try {
          // Fetch the current user's signature once for all PDFs
          let userSignatureDataUrl: string | null = null
          let signatureDate: Date | null = null
          if (user?.uid) {
            try {
              const { doc, getDoc } = await import("firebase/firestore")
              const { db } = await import("@/lib/firebase")
              const userDocRef = doc(db, "iboard_users", user.uid)
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

          // Generate PDFs for all cost estimates that don't have one
          const updatedRelatedEstimates = [...relatedCostEstimates]
          let generatedCount = 0

          for (let i = 0; i < relatedCostEstimates.length; i++) {
            const estimate = relatedCostEstimates[i]

            // Check if PDF already exists
            if (!estimate.pdf) {
              // Generate and upload PDF using the current user's signature for all PDFs
              const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(estimate, userData ? {
                first_name: userData.first_name || undefined,
                last_name: userData.last_name || undefined,
                email: userData.email || undefined,
                company_id: userData.company_id || undefined,
              } : undefined, undefined, userSignatureDataUrl)

              // Update the cost estimate with PDF URL and password
              await updateCostEstimate(estimate.id, {
                pdf: pdfUrl,
                password: password,
                signature_date: signatureDate
              })

              // Update the local state
              updatedRelatedEstimates[i] = { ...estimate, pdf: pdfUrl, password: password }
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
      // Single cost estimate - check if PDF exists, if not generate it
      if (!fullCostEstimate.pdf) {
        // Show generating toast
        toast({
          title: "Generating PDF",
          description: "Please wait while we prepare your cost estimate for sharing...",
        })

        try {
          // Fetch user signature from iboard_users collection
          let userSignatureDataUrl: string | null = null
          let signatureDate: Date | null = null
          if (fullCostEstimate.createdBy) {
            try {
              const { doc, getDoc } = await import("firebase/firestore")
              const { db } = await import("@/lib/firebase")
              const userDocRef = doc(db, "iboard_users", fullCostEstimate.createdBy)
              const userDoc = await getDoc(userDocRef)

              if (userDoc.exists()) {
                const userDataFetched = userDoc.data()
                if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
                  const signatureUrl = userDataFetched.signature.url
                    console.log('[LIST_SHARE] Found user signature URL:', signatureUrl)

                    // Convert signature image to base64 data URL
                    try {
                      const response = await fetch(signatureUrl)
                      if (response.ok) {
                        const blob = await response.blob()
                        const arrayBuffer = await blob.arrayBuffer()
                        const base64 = Buffer.from(arrayBuffer).toString('base64')
                        const mimeType = blob.type || 'image/png'
                        userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                        console.log('[LIST_SHARE] Converted signature to base64 data URL')
                      } else {
                        console.warn('[LIST_SHARE] Failed to fetch signature image:', response.status)
                      }
                    } catch (fetchError) {
                      console.error('[LIST_SHARE] Error converting signature to base64:', fetchError)
                    }
                  }
                  // Also fetch signature date
                  if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                    signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
                  }
                }
              } catch (error) {
                console.error('[LIST_SHARE] Error fetching user signature:', error)
              }
            }

            // Generate and upload PDF, then save to database
            const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(fullCostEstimate, userData ? {
              first_name: userData.first_name || undefined,
              last_name: userData.last_name || undefined,
              email: userData.email || undefined,
              company_id: userData.company_id || undefined,
            } : undefined, undefined, userSignatureDataUrl)

            // Update cost estimate with PDF URL, password, and signature date
            await updateCostEstimate(fullCostEstimate.id, {
              pdf: pdfUrl,
              password: password,
              signature_date: signatureDate
            })

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
      }

    setSelectedCostEstimateForShare(costEstimate)
    setShareDialogOpen(true)
  }



  const generateShareableLink = (costEstimate: any) => {
    return `${process.env.NEXT_PUBLIC_APP_URL}/cost-estimates/view/${costEstimate.id}/compose-email`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
      // Use toast if available, but since not imported, use alert
      alert("Link copied to clipboard!")
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
      alert("Failed to copy to clipboard. Please try again.")
    }
  }

  const shareViaEmail = (costEstimate: any) => {
    const subject = encodeURIComponent(`Cost Estimate: ${costEstimate.title || "Custom Cost Estimate"}`)
    const body = encodeURIComponent(`Please review our cost estimate: ${generateShareableLink(costEstimate)}`)
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`
    window.open(mailtoUrl, "_blank")
  }

  const shareViaWhatsApp = (costEstimate: any) => {
    const message = encodeURIComponent(`Please review our cost estimate: ${generateShareableLink(costEstimate)}`)
    window.open(`https://wa.me/?text=${message}`)
  }

  const shareViaViber = (costEstimate: any) => {
    const message = encodeURIComponent(`Please review our cost estimate: ${generateShareableLink(costEstimate)}`)
    window.open(`viber://forward?text=${message}`)
  }

  const shareViaMessenger = (costEstimate: any) => {
    const message = encodeURIComponent(`Please review our cost estimate: ${generateShareableLink(costEstimate)}`)
    window.open(`https://m.me/?text=${message}`)
  }

  const handleViewSentHistory = (costEstimate: any) => {
    setSelectedCostEstimateForHistory(costEstimate)
    setShowSentHistoryDialog(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Cost Estimates</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 opacity-30" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-96 border-gray-300 rounded-full"
                />
              </div>
            </div>
            <Button
              onClick={() => router.push("/sales/dashboard?action=create-cost-estimate")}
              className="bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-900 font-medium rounded-lg px-6 py-2"
            >
              Create Cost Estimate
            </Button>
          </div>
        </div>

        {(loading || searchLoading) ? (
          <Card className="bg-white overflow-hidden rounded-t-lg">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 border-0">Date</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Cost Estimate ID</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Company</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Contact Person</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Status</TableHead>
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
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (isSearching ? searchResults.length === 0 : costEstimates.length === 0) ? (
          <Card className="bg-white rounded-xl">
            <CardContent className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {isSearching ? "No cost estimates found" : "No cost estimates yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {isSearching
                  ? "Try adjusting your search or filter criteria"
                  : "Create your first cost estimate to get started"}
              </p>
              {!isSearching && (
                <Button
                  onClick={() => router.push("/sales/cost-estimates/compose/new")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Cost Estimate
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-200 shadow-sm overflow-hidden rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 border-0">Date</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Cost Estimate ID</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Company</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Contact Person</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Status</TableHead>
                  <TableHead className="font-semibold text-gray-900 border-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isSearching ? searchResults : costEstimates).map((item, index) => {
                  // Handle both CostEstimate and SearchResult types
                  const costEstimate = item as any
                  const statusConfig = getStatusConfig(costEstimate.status)
                  const StatusIcon = statusConfig.icon

                  return (
                    <TableRow
                      key={costEstimate.id || costEstimate.objectID || `cost-estimate-${index}`}
                      className="cursor-pointer border-b border-gray-200"
                      onClick={() => handleViewCostEstimate(costEstimate.id || costEstimate.objectID)}
                    >
                      <TableCell className="py-3">
                        <div className="text-sm text-gray-600">
                          {(() => {
                            let date = null;
                            if (costEstimate.createdAt instanceof Date) {
                              date = costEstimate.createdAt;
                            } else if (costEstimate.createdAt && typeof costEstimate.createdAt.toDate === 'function') {
                              date = costEstimate.createdAt.toDate();
                            } else if (typeof costEstimate.createdAt === 'string') {
                              date = new Date(costEstimate.createdAt);
                            } else if (typeof costEstimate.createdAt === 'number') {
                              date = new Date(costEstimate.createdAt);
                            }
                            if (!date || isNaN(date.getTime())) {
                              return "N/A";
                            }
                            return format(date, "MMM d, yyyy");
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium text-gray-900">{costEstimate.costEstimateNumber || costEstimate.id || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium text-gray-900">{costEstimate.client?.company || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-sm text-gray-600">{costEstimate.client?.name || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-sm text-gray-600">{costEstimate.lineItems?.[0]?.description || "—"}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={`${statusConfig.color} border`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleViewCostEstimate(costEstimate.id || costEstimate.objectID)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(costEstimate as CostEstimate, userData)}>
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShareCostEstimate(costEstimate)}>
                              <Share2 className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCreateQuotation(costEstimate.id || costEstimate.objectID)}>
                              <Calculator className="mr-2 h-4 w-4" />
                              Create Quotation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleViewSentHistory(costEstimate)}>
                              <History className="mr-2 h-4 w-4" />
                              View Sent History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handlePrintPDF(costEstimate as CostEstimate)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print
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
        )}

        {/* Pagination Controls */}
        {!loading && !searchLoading && (isSearching ? searchResults.length > 0 : costEstimates.length > 0) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="text-sm text-gray-600">
              {isSearching ? `Found ${(isSearching ? searchResults : costEstimates).length} results` : `Page ${currentPage}`}
            </div>
            <div className="flex items-center space-x-2">
              {!isSearching ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1)
                        loadCostEstimates(currentPage - 1, false)
                      }
                    }}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (hasMorePages) {
                        setCurrentPage(currentPage + 1)
                        loadCostEstimates(currentPage + 1, false)
                      }
                    }}
                    disabled={!hasMorePages || loading}
                  >
                    Next
                  </Button>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Search results
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm mx-auto text-center border-0 shadow-lg">
          <div className="py-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Success!</h2>
              <div className="flex justify-center mb-4">
                <div className="text-6xl">🎉</div>
              </div>
              <p className="text-gray-600">Your cost estimate has been sent successfully!</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCostEstimateForShare && (
        <SendCostEstimateOptionsDialog
          isOpen={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          costEstimate={selectedCostEstimateForShare}
          onEmailClick={() => {
            setShareDialogOpen(false)
            router.push(`/sales/cost-estimates/${selectedCostEstimateForShare.id || selectedCostEstimateForShare.objectID}/compose-email`)
          }}
        />
      )}

      <SentHistoryDialog
        open={showSentHistoryDialog}
        onOpenChange={setShowSentHistoryDialog}
        proposalId={selectedCostEstimateForHistory?.id || selectedCostEstimateForHistory?.objectID || ""}
        emailType="cost_estimate"
      />
    </div>
  )
}

export default function CostEstimatesPage() {
  return <CostEstimatesPageContent />
}
