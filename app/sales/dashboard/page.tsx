"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  MapPin,
  LayoutGrid,
  List,
  Grid3X3,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarIcon,
  CheckCircle2,
  ArrowLeft,
  Filter,
  AlertCircle,
  Search,
  PlusCircle,
  Calculator,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import {
  getPaginatedUserProducts,
  getUserProductsCount,
  softDeleteProduct,
  type Product,
  type Booking,
} from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { collection, query, where, getDocs, getDoc, doc, Timestamp, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ProductSearchBox } from "@/components/product-search-box"
import type { SearchResult } from "@/lib/algolia-service"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useResponsive } from "@/hooks/use-responsive"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import { cn } from "@/lib/utils"
import { SalesChatWidget } from "@/components/sales-chat/sales-chat-widget"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"
import { getPaginatedClients, type Client } from "@/lib/client-service"
import { createProposal } from "@/lib/proposal-service"
import type { ProposalClient, ProposalProduct } from "@/lib/types/proposal"
import { ProposalHistory } from "@/components/proposal-history"
import { ClientDialog } from "@/components/client-dialog"
import { DateRangeCalendarDialog } from "@/components/date-range-calendar-dialog"
import { createDirectCostEstimate, createMultipleCostEstimates } from "@/lib/cost-estimate-service" // Import createMultipleCostEstimates function
import { Skeleton } from "@/components/ui/skeleton" // Import Skeleton
import { CollabPartnerDialog } from "@/components/collab-partner-dialog"
import { RouteProtection } from "@/components/route-protection"
import { CheckCircle } from "lucide-react"
import { createDirectQuotation, createMultipleQuotations } from "@/lib/quotation-service"
import { CreateReportDialog } from "@/components/create-report-dialog"
import { SpotSelectionDialog } from "@/components/spot-selection-dialog"
// CSS for static gradient border
const gradientBorderStyles = `
.gradient-border {
  background: linear-gradient(45deg, #ff0000, #ffff00, #00ff00, #0000ff, #8B00FF);
}
`

// Number of items to display per page
const ITEMS_PER_PAGE = 15

// Function to get site code from product
const getSiteCode = (product: Product | null) => {
  if (!product) return null

  // Try different possible locations for site_code
  if (product.site_code) return product.site_code
  if (product.specs_rental && "site_code" in product.specs_rental) return product.specs_rental.site_code
  if ((product as any).light && "siteCode" in (product as any).light) return (product as any).light.siteCode

  // Check for camelCase variant
  if ("siteCode" in product) return (product as any).siteCode

  return null
}

function SalesDashboardContent() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [productsWithBookings, setProductsWithBookings] = useState<Record<string, boolean>>({})
  const [loadingBookings, setLoadingBookings] = useState(false)
  const { isMobile, isTablet } = useResponsive()

  const [createReportDialogOpen, setCreateReportDialogOpen] = useState(false)
  const [selectedProductForReport, setSelectedProductForReport] = useState<string>("")

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchPagination, setSearchPagination] = useState<{ page: number; nbPages: number; nbHits: number } | null>(null)
  const [currentSearchPage, setCurrentSearchPage] = useState(0)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageCache, setPageCache] = useState<
    Map<number, { items: Product[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>
  >(new Map())
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingCount, setLoadingCount] = useState(false)

  const { user, userData } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Proposal Creation Flow State
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [proposalCreationMode, setProposalCreationMode] = useState(false)
  const [selectedClientForProposal, setSelectedClientForProposal] = useState<ProposalClient | null>(null)
  const [isCreatingProposal, setIsCreatingProposal] = useState(false)

  // Client Search/Selection on Dashboard (now for both proposal and CE/Quote)
  const [dashboardClientSearchTerm, setDashboardClientSearchTerm] = useState("")
  const [dashboardClientSearchResults, setDashboardClientSearchResults] = useState<Client[]>([])
  const [isSearchingDashboardClients, setIsSearchingDashboardClients] = useState(false)
  const debouncedDashboardClientSearchTerm = useDebounce(dashboardClientSearchTerm, 500)

  const clientSearchRef = useRef<HTMLDivElement>(null)
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)

  // CE/Quote mode states
  const [ceQuoteMode, setCeQuoteMode] = useState(false)
  const [ceMode, setCeMode] = useState(false)
  const [quoteMode, setQuoteMode] = useState(false)
  const [selectedSites, setSelectedSites] = useState<Product[]>([])
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false)
  const [actionAfterDateSelection, setActionAfterDateSelection] = useState<"cost_estimate" | "quotation" | null>(null)
  const [isCreatingDocument, setIsCreatingDocument] = useState(false) // New loading state for document creation

  

  // Search sites state
  const [siteSearchTerm, setSiteSearchTerm] = useState("")

  const [isCollabPartnerDialogOpen, setIsCollabPartnerDialogOpen] = useState(false)

  // Spot Selection Dialog state
  const [isSpotSelectionDialogOpen, setIsSpotSelectionDialogOpen] = useState(false)
  const [spotSelectionProducts, setSpotSelectionProducts] = useState<Product[]>([])
  const [spotSelectionSpotsData, setSpotSelectionSpotsData] = useState<Record<string, any>>({})
  const [spotSelectionCurrentDate, setSpotSelectionCurrentDate] = useState("")
  const [selectedSpots, setSelectedSpots] = useState<Record<string, number[]>>({})
  const [currentSpotSelectionProduct, setCurrentSpotSelectionProduct] = useState<Product | null>(null)

  const handleCreateReport = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const jobOrdersRef = collection(db, "job_orders")
      const q = query(
        jobOrdersRef,
        where("product_id", "==", product.id),
        orderBy("createdAt", "desc"),
        limit(1)
      )
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const latestJobOrder = snapshot.docs[0]
        router.push(`/sales/project-monitoring/details/${latestJobOrder.id}`)
      } else {
        toast({
          title: "No Job Order Found",
          description: "No job order found for this product.",
          variant: "destructive",
          open: true,
        })
      }
    } catch (error) {
      console.error("Error fetching job order:", error)
      toast({
        title: "Error",
        description: "Failed to fetch job order.",
        variant: "destructive",
        open: true,
      })
    }
  }

  const handleCopySitesFromProposal = (sites: Product[], client?: any) => {
    // Add the copied sites to the selected products for proposal creation
    setSelectedProducts(sites)

    // If no client is currently selected and we have client info from the proposal, select it
    if (!selectedClientForProposal && client) {
      setSelectedClientForProposal({
        id: client.id || "",
        company: client.company || "",
        contactPerson: client.contactPerson || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        industry: client.industry || "",
        designation: client.designation || "",
        targetAudience: client.targetAudience || "",
        campaignObjective: client.campaignObjective || "",
        company_id: client.company_id || "",
      })

      // Update the search term to show the selected client
      setDashboardClientSearchTerm(client.company || client.contactPerson || "")

      toast({
        title: "Sites and Client Copied",
        description: `${sites.length} site${sites.length === 1 ? "" : "s"} copied and client ${client.company || client.contactPerson} selected.`,
        open: true,
      })
    } else {
      // Show success message for sites only
      toast({
        title: "Sites Copied",
        description: `${sites.length} site${sites.length === 1 ? "" : "s"} copied and ready for proposal creation.`,
        open: true,
      })
    }
  }

  // On mobile, default to grid view
  useEffect(() => {
    if (isMobile) {
      setViewMode("grid")
    }
  }, [isMobile])

  // Store current mode in sessionStorage for side navigation active state
  useEffect(() => {
    if (proposalCreationMode) {
      sessionStorage.setItem('sales-dashboard-mode', 'proposal')
    } else if (ceQuoteMode) {
      sessionStorage.setItem('sales-dashboard-mode', ceMode ? 'cost-estimate' : 'quotation')
    } else {
      sessionStorage.setItem('sales-dashboard-mode', 'normal')
    }
  }, [proposalCreationMode, ceQuoteMode, ceMode])
  console.log(`user comoany id ${userData?.company_id}`)
  // Fetch clients for dashboard client selection (for proposals and CE/Quote)
  useEffect(() => {
    const fetchClients = async () => {
      if (user?.uid && (proposalCreationMode || ceQuoteMode)) {
        // Ensure user is logged in
        setIsSearchingDashboardClients(true)
        try {
          const itemsPerPage = debouncedDashboardClientSearchTerm.trim() ? 10000 : 100; // 1. Adjust itemsPerPage for initial load to 100. 2. If search term is not empty, fetch all clients (10000).
          const lastDocForSearch = debouncedDashboardClientSearchTerm.trim() ? null : null; // Ensure lastDoc is null for full client fetch when searching.
          const result = await getPaginatedClients(itemsPerPage, lastDocForSearch, debouncedDashboardClientSearchTerm.trim(), null, null, userData?.company_id || undefined, false);
          setDashboardClientSearchResults(result.items)
        } catch (error) {
          console.error("Error fetching clients for dashboard:", error)
          setDashboardClientSearchResults([])
        } finally {
          setIsSearchingDashboardClients(false)
        }
      } else {
        setDashboardClientSearchResults([])
      }
    }
    fetchClients()
  }, [debouncedDashboardClientSearchTerm, proposalCreationMode, ceQuoteMode, user?.uid]) // Add user.uid to dependencies

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Handle URL parameters for auto-activation of modes and client selection
  useEffect(() => {
    const mode = searchParams.get('mode')
    const clientId = searchParams.get('clientId')
    const tab = searchParams.get('tab')
    const action = searchParams.get('action')

    if (action === 'create-cost-estimate') {
      // Reset all modes first
      setProposalCreationMode(false)
      setCeQuoteMode(false)
      setCeMode(false)
      setQuoteMode(false)
      setSelectedClientForProposal(null)
      setDashboardClientSearchTerm("")
      setSelectedProducts([])
      setSelectedSites([])

      // Activate CE mode
      setTimeout(() => {
        setCeMode(true)
        setQuoteMode(false)
        setCeQuoteMode(true)
        setProposalCreationMode(false)
      }, 100)

      // Clean up URL parameter
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('action')
      window.history.replaceState({}, '', newUrl.toString())
      return
    }

    // Handle action parameter for direct mode activation (from proposals page)
    if (action && userData?.company_id) {
      // Reset all modes first
      setProposalCreationMode(false)
      setCeQuoteMode(false)
      setCeMode(false)
      setQuoteMode(false)
      setSelectedClientForProposal(null)
      setDashboardClientSearchTerm("")
      setSelectedProducts([])
      setSelectedSites([])

      // Activate the appropriate mode based on action parameter
      setTimeout(() => {
        if (action === 'create-proposal') {
          setProposalCreationMode(true)
          setCeQuoteMode(false)
        }
      }, 100)

      // Clean up URL parameters
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('action')
      window.history.replaceState({}, '', newUrl.toString())
      return
    }

    // Handle tab parameter for direct mode activation (from product page buttons)
    if (tab && userData?.company_id) {
      const productId = searchParams.get('productId')

      // Reset all modes first
      setProposalCreationMode(false)
      setCeQuoteMode(false)
      setCeMode(false)
      setQuoteMode(false)
      setSelectedClientForProposal(null)
      setDashboardClientSearchTerm("")
      setSelectedProducts([])
      setSelectedSites([])

      // If productId is provided, fetch and select the product
      if (productId) {
        const fetchProduct = async () => {
          try {
            const productDoc = await getDoc(doc(db, "products", productId))
            if (productDoc.exists()) {
              const product = { id: productDoc.id, ...productDoc.data() } as Product

              // Select the product based on the mode
              if (tab === 'proposals') {
                setSelectedProducts([product])
              } else if (tab === 'ce' || tab === 'quotations') {
                setSelectedSites([product])
              }
            }
          } catch (error) {
            console.error("Error fetching product for auto-selection:", error)
          }
        }
        fetchProduct()
      }

      // Activate the appropriate mode based on tab parameter
      setTimeout(() => {
        if (tab === 'proposals') {
          setProposalCreationMode(true)
          setCeQuoteMode(false)
        } else if (tab === 'ce') {
          setCeMode(true)
          setQuoteMode(false)
          setCeQuoteMode(true)
          setProposalCreationMode(false)
        } else if (tab === 'quotations') {
          setQuoteMode(true)
          setCeMode(false)
          setCeQuoteMode(true)
          setProposalCreationMode(false)
        }
      }, 100)

      // Clean up URL parameters
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('tab')
      newUrl.searchParams.delete('productId')
      window.history.replaceState({}, '', newUrl.toString())
      return
    }

    // Handle mode and clientId parameters (existing logic)
    if (mode && clientId && userData?.company_id) {
      // Reset all modes first
      setProposalCreationMode(false)
      setCeQuoteMode(false)
      setCeMode(false)
      setQuoteMode(false)
      setSelectedClientForProposal(null)
      setDashboardClientSearchTerm("")
      setSelectedProducts([])
      setSelectedSites([])

      // Fetch and select the client
      const fetchClient = async () => {
        try {
          const clientsRef = collection(db, "client_db")
          const clientDoc = await getDoc(doc(clientsRef, clientId))

          if (clientDoc.exists()) {
            const clientData = clientDoc.data()
            const client: Client = {
              id: clientDoc.id,
              name: clientData.contactPersons?.[0]?.name || clientData.name || "",
              company: clientData.company || "",
              email: clientData.email || "",
              phone: clientData.phone || "",
              address: clientData.address || "",
              industry: clientData.industry || "",
              designation: clientData.designation || "",
              company_id: clientData.company_id || "",
              status: "lead",
              created: new Date(),
              updated: new Date(),
            }

            // Select the client first
            handleClientSelectOnDashboard(client)

            // Then activate the appropriate mode
            setTimeout(() => {
              if (mode === 'proposal') {
                setProposalCreationMode(true)
                setCeQuoteMode(false)
              } else if (mode === 'cost_estimate') {
                // Activate CE mode without resetting the client
                setCeMode(true)
                setQuoteMode(false)
                setCeQuoteMode(true)
                setProposalCreationMode(false)
                setSelectedSites([])
                setDashboardClientSearchTerm(client.company || client.name || "")
              } else if (mode === 'quotation') {
                // Activate Quotation mode without resetting the client
                setQuoteMode(true)
                setCeMode(false)
                setCeQuoteMode(true)
                setProposalCreationMode(false)
                setSelectedSites([])
                setDashboardClientSearchTerm(client.company || client.name || "")
              }
            }, 100)

            // Clean up URL parameters
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.delete('mode')
            newUrl.searchParams.delete('clientId')
            window.history.replaceState({}, '', newUrl.toString())
          }
        } catch (error) {
          console.error("Error fetching client for auto-selection:", error)
        }
      }

      fetchClient()
    }
  }, [searchParams, userData?.company_id])

  // Check for ongoing bookings
  const checkOngoingBookings = useCallback(
    async (productIds: string[]) => {
      if (!productIds.length) return

      setLoadingBookings(true)
      try {
        const currentDate = new Date()
        const bookingsRef = collection(db, "booking")

        // Create a map to store booking status for each product
        const bookingStatus: Record<string, boolean> = {}

        // We need to check each product individually since Firestore doesn't support OR queries
        for (const productId of productIds) {
          // Only check rental products
          const product = products.find((p) => p.id === productId)
          if (product?.type?.toLowerCase() !== "rental") continue

          // Check for bookings with status "RESERVED" (case insensitive)
          const reservedStatuses = ["RESERVED", "reserved", "Reserved"]
          const bookingPromises = reservedStatuses.map(status =>
            getDocs(query(bookingsRef, where("product_id", "==", productId), where("status", "==", status)))
          )
          const bookingSnapshots = await Promise.all(bookingPromises)
          const allBookingDocs = bookingSnapshots.flatMap(snapshot => snapshot.docs)

          // Check if any booking is ongoing (current date is between start_date and end_date)
          let hasOngoingBooking = false
          allBookingDocs.forEach((doc) => {
            const booking = doc.data() as Booking
            const startDate =
              booking.start_date instanceof Timestamp ? booking.start_date.toDate() : new Date(booking.start_date)

            const endDate =
              booking.end_date instanceof Timestamp ? booking.end_date.toDate() : new Date(booking.end_date)

            if (currentDate >= startDate && currentDate <= endDate) {
              hasOngoingBooking = true
            }
          })

          bookingStatus[productId] = hasOngoingBooking
        }

        setProductsWithBookings(bookingStatus)
      } catch (error) {
        console.error("Error checking ongoing bookings:", error)
      } finally {
        setLoadingBookings(false)
      }
    },
    [products],
  )

  // Fetch total count of products
  const fetchTotalCount = useCallback(async () => {
    if (!userData?.company_id) return

    setLoadingCount(true)
    try {
      const count = await getUserProductsCount(userData?.company_id, { active: true })
      setTotalItems(count)
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (error) {
      console.error("Error fetching total count:", error)
      toast({
        title: "Error",
        description: "Failed to load product count. Please try again.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
    } finally {
      setLoadingCount(false)
    }
  }, [userData, toast])

  // Fetch products for the current page
  const fetchProducts = useCallback(
    async (page: number) => {
      if (!userData?.company_id) return

      // Check if we have this page in cache
      if (pageCache.has(page)) {
        const cachedData = pageCache.get(page)!
        setProducts(cachedData.items)
        setLastDoc(cachedData.lastDoc)

        // Check for ongoing bookings for the cached products
        const productIds = cachedData.items.map((product) => product.id).filter((id): id is string => id !== undefined) as string[];
        checkOngoingBookings(productIds)

        return
      }

      const isFirstPage = page === 1
      setLoading(isFirstPage)
      setLoadingMore(!isFirstPage)

      try {
        // For the first page, start from the beginning
        // For subsequent pages, use the last document from the previous page
        const startDoc = isFirstPage ? null : lastDoc

        const result = await getPaginatedUserProducts(userData?.company_id, ITEMS_PER_PAGE, startDoc, { active: true })

        setProducts(result.items)
        setLastDoc(result.lastDoc)
        setHasMore(result.hasMore)

        // Check for ongoing bookings
        const productIds = result.items.map((product) => product.id).filter((id): id is string => id !== undefined) as string[];
        checkOngoingBookings(productIds)

        // Cache this page
        setPageCache((prev) => {
          const newCache = new Map(prev)
          newCache.set(page, {
            items: result.items,
            lastDoc: result.lastDoc,
          })
          return newCache
        })

        // Store product names in localStorage for breadcrumb navigation
        const simplifiedProducts = result.items.map((product) => ({
          id: product.id,
          name: product.name,
        }))
        localStorage.setItem("salesProducts", JSON.stringify(simplifiedProducts))
      } catch (error) {
        console.error("Error fetching products:", error)
        toast({
          title: "Error",
          description: "Failed to load product count. Please try again.",
          variant: "destructive",
          open: true, // Add the missing 'open' property
        })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userData, lastDoc, pageCache, toast, checkOngoingBookings],
  )

  // Load initial data and count
  useEffect(() => {
    if (userData?.company_id) {
      fetchProducts(1)
      fetchTotalCount()
    }
  }, [userData?.company_id, fetchProducts, fetchTotalCount])

  // Load data when page changes
  useEffect(() => {
    if (userData?.company_id && currentPage > 0) {
      fetchProducts(currentPage)
    }
  }, [currentPage, fetchProducts, userData?.company_id])

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const goToPreviousPage = () => goToPage(currentPage - 1)
  const goToNextPage = () => goToPage(currentPage + 1)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // If we have 5 or fewer pages, show all of them
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // Always include first page
      pageNumbers.push(1)

      // Calculate start and end of page range around current page
      let startPage = Math.max(2, currentPage - 1)
      let endPage = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4)
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3)
      }

      // Add ellipsis if needed before the range
      if (startPage > 2) {
        pageNumbers.push("...")
      }

      // Add the range of pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }

      // Add ellipsis if needed after the range
      if (endPage < totalPages - 1) {
        pageNumbers.push("...")
      }

      // Always include last page
      pageNumbers.push(totalPages)
    }

    return pageNumbers
  }

  // Handle product deletion
  const handleDeleteClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return

    try {
      if (productToDelete.id) {
        await softDeleteProduct(productToDelete.id)
      } else {
        console.error("Product to delete has no ID:", productToDelete);
        toast({
          title: "Error",
          description: "Cannot delete product: ID is missing.",
          variant: "destructive",
          open: true, // Add the missing 'open' property
        });
        return;
      }

      // Update the UI by removing the deleted product
      setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productToDelete.id))

      // Update total count
      setTotalItems((prev) => prev - 1)

      // Recalculate total pages
      setTotalPages(Math.max(1, Math.ceil((totalItems - 1) / ITEMS_PER_PAGE)))

      // Clear cache to force refresh
      setPageCache(new Map())

      toast({
        title: "Product deleted",
        description: `${productToDelete.name} has been successfully deleted.`,
        open: true, // Add the missing 'open' property
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete the product. Please try again.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
    }
  }

  // Handle edit click
  const handleEditClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/sales/products/edit/${product.id}`)
  }

  // Handle view details click
  const handleViewDetails = (productId: string) => {
    router.push(`/sales/products/${productId}`)
  }

  // Handle search result click
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    if (result.type === "product") {
      router.push(`/sales/products/${result.objectID}`)
    } else if (result.type === "client") {
      router.push(`/sales/clients/${result.objectID}`)
    }
  }, [router])

  // Handle search results
  const handleSearchResults = useCallback((results: SearchResult[], query: string, pagination?: { page: number; nbPages: number; nbHits: number }) => {
    setSearchResults(results)
    setSearchQuery(query)
    setIsSearching(!!query)
    setSearchPagination(pagination || null)
  }, [])

  // Handle search error
  const handleSearchError = useCallback((error: string | null) => {
    setSearchError(error)
  }, [])

  // Handle search loading
  const handleSearchLoading = useCallback((isLoading: boolean) => {
    // We don't need to do anything with this for now
  }, [])

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setSearchResults([])
    setSearchQuery("")
    setIsSearching(false)
    setSearchError(null)
  }, [])

  // Clear search and return to normal view
  const handleClearSearch = () => {
    handleSearchClear()
  }

  // Handle proposal creation flow
  const handleInitiateProposalFlow = () => {
    setProposalCreationMode(true) // Activate the combined client & product selection mode
    setCeQuoteMode(false) // Ensure CE/Quote mode is off
    setSelectedClientForProposal(null) // Reset selected client
    setDashboardClientSearchTerm("") // Clear client search term
    setSelectedProducts([]) // Clear any previously selected products
    setSelectedSites([]) // Clear any previously selected sites
    
  }

  const handleClientSelectOnDashboard = (client: Client) => {
    setSelectedClientForProposal({
      id: client.id,
      company: client.company || "",
      contactPerson: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      industry: client.industry || "",
      designation: client.designation || "", // Add designation field
      targetAudience: "", // These might need to be fetched or added later
      campaignObjective: "", // These might need to be fetched or added later
      company_id: client.company_id || "", // Add company_id here
    })
    setDashboardClientSearchTerm(client.company || client.name || "") // Display selected client in search bar
    toast({
      title: "Client Selected",
      description: `Selected ${client.name} (${client.company}). Now select products.`,
      open: true, // Add the missing 'open' property
    })
    setIsClientDropdownOpen(false) // Close dropdown after selection
  }

  const handleCancelProposalCreationMode = () => {
    setProposalCreationMode(false)
    setSelectedClientForProposal(null)
    setDashboardClientSearchTerm("")
    setDashboardClientSearchResults([])
    setSelectedProducts([])
    
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProducts((prev) => {
      const isSelected = prev.some((p) => p.id === product.id)
      if (isSelected) {
        return prev.filter((p) => p.id !== product.id)
      } else {
        return [...prev, product]
      }
    })
  }

  const handleConfirmProposalCreation = async () => {
    if (!selectedClientForProposal) {
      toast({
        title: "No Client Selected",
        description: "Please select a client first.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
      return
    }
    if (selectedProducts.length === 0) {
      toast({
        title: "No products selected",
        description: "Please select at least one product for the proposal.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
      return
    }

    if (!user?.uid || !userData?.company_id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create a proposal.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
      return
    }

    setIsCreatingProposal(true) // Set loading state for proposal creation
    try {
      // Generate a simple title for the proposal
      const proposalTitle = `Proposal for ${selectedClientForProposal.company} - ${new Date().toLocaleDateString()}`

      const proposalProducts = selectedProducts.map(product => {
        const proposalProduct: any = {
          id: product.id || "",
          ID: product.id || "", // Document ID of the selected site
          name: product.name,
          type: product.type || "rental",
          price: product.price || 0,
          location: product.specs_rental?.location || (product as any).light?.location || "N/A", // Ensure location is present
          media: product.media || [],
          specs_rental: product.specs_rental || null,
          light: (product as any).light || null,
          description: product.description || "",
          health_percentage: 0, // Default value
          categories: product.categories || [], // Include categories from product
          category_names: product.category_names || [], // Include category names from product
        }

        // Only add site_code if it has a value
        const siteCode = product.site_code || product.specs_rental?.site_code || (product as any).light?.siteCode
        if (siteCode) {
          proposalProduct.site_code = siteCode
        }

        return proposalProduct as ProposalProduct
      });

      const proposalId = await createProposal(proposalTitle, selectedClientForProposal, proposalProducts as ProposalProduct[], user.uid, {
        // You can add notes or custom messages here if needed
        // notes: "Generated from dashboard selection",
        companyId: userData.company_id, // Add company_id to the proposal creation
        client_company_id: selectedClientForProposal.company_id, // Use client's company_id
      })

      toast({
        title: "Proposal Created",
        description: "Your proposal has been created successfully.",
        open: true, // Add the missing 'open' property
      })

      // Redirect to the new proposal's detail page with edit mode enabled
      router.push(`/sales/proposals/${proposalId}?action=edit`)

      // Reset the proposal creation mode and selected items
      setProposalCreationMode(false)
      setSelectedProducts([])
      setSelectedClientForProposal(null)
    } catch (error) {
      console.error("Error creating proposal:", error)
      toast({
        title: "Error",
        description: "Failed to create proposal. Please try again.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
    } finally {
      setIsCreatingProposal(false) // Reset loading state
    }
  }

  // Handle CE/Quote mode
  const handleCeQuoteMode = () => {
    setCeQuoteMode(true)
    setProposalCreationMode(false) // Ensure proposal mode is off
    setSelectedSites([])
    setSelectedClientForProposal(null) // Reset selected client
    setDashboardClientSearchTerm("") // Clear client search term
    setSelectedProducts([]) // Clear any previously selected products
  }

  const handleCeMode = () => {
    setCeMode(true)
    setQuoteMode(false)
    setCeQuoteMode(true)
    setProposalCreationMode(false)
    setSelectedSites([])
    setSelectedClientForProposal(null)
    setDashboardClientSearchTerm("")
    setSelectedProducts([])
  }

  const handleQuoteMode = () => {
    setQuoteMode(true)
    setCeMode(false)
    setCeQuoteMode(true)
    setProposalCreationMode(false)
    setSelectedSites([])
    setSelectedClientForProposal(null)
    setDashboardClientSearchTerm("")
    setSelectedProducts([])
  }

  const handleSiteSelect = async (product: Product) => {
    // Check if product is dynamic/digital
    const isDynamicSite = product.content_type?.toLowerCase() === "dynamic" || product.content_type?.toLowerCase() === "digital"

    if (isDynamicSite) {
      // Check if product is already selected
      const isAlreadySelected = selectedSites.some((p) => p.id === product.id)

      if (isAlreadySelected) {
        // Deselect the product and clear its spots
        setSelectedSites((prev) => prev.filter((p) => p.id !== product.id))
        setSelectedSpots((prev) => {
          const newSpots = { ...prev }
          delete newSpots[product.id || '']
          return newSpots
        })
      } else {
        // Open spot selection dialog for new selection
        setCurrentSpotSelectionProduct(product)
        setSpotSelectionProducts([product])

        try {
          const spotsData: Record<string, any> = {}
          const currentDate = new Date().toISOString().split('T')[0]

          const spotData = await generateSpotsDataForDialog(product)
          spotsData[product.id || ''] = {
            spots: spotData.spots,
            totalSpots: spotData.totalSpots,
            occupiedCount: spotData.occupiedCount,
            vacantCount: spotData.vacantCount,
            currentDate: spotData.currentDate,
          }

          setSpotSelectionSpotsData(spotsData)
          setSpotSelectionCurrentDate(currentDate)
          setIsSpotSelectionDialogOpen(true)
        } catch (error) {
          console.error("Error generating spots data:", error)
          toast({
            title: "Error",
            description: "Failed to load spot information.",
            variant: "destructive",
          })
        }
      }
    } else {
      // Regular site selection
      setSelectedSites((prev) => {
        const isSelected = prev.some((p) => p.id === product.id)
        if (isSelected) {
          return prev.filter((p) => p.id !== product.id)
        } else {
          return [...prev, product]
        }
      })
    }
  }

  // Helper function to generate spots data for dynamic/digital sites
  const generateSpotsDataForDialog = async (product: Product) => {
    const totalSpots = product.cms?.loops_per_day || 18
    const spots = []

    // Fetch current day bookings for the product
    const currentDate = new Date().toISOString().split('T')[0]
    const bookingsRef = collection(db, "booking")
    const q = query(
      bookingsRef,
      where("product_id", "==", product.id),
      where("status", "in", ["RESERVED", "reserved", "Reserved"])
    )
    const snapshot = await getDocs(q)

    const occupiedSpots = new Set<number>()
    snapshot.docs.forEach((doc) => {
      const booking = doc.data()
      const startDate = booking.start_date instanceof Timestamp ? booking.start_date.toDate() : new Date(booking.start_date)
      const endDate = booking.end_date instanceof Timestamp ? booking.end_date.toDate() : new Date(booking.end_date)
      const today = new Date()

      if (today >= startDate && today <= endDate) {
        // This booking is ongoing, mark spots as occupied
        // For simplicity, we'll assume all spots in the loop are occupied if there's any booking
        // In a real implementation, you'd need to track which specific spots are booked
        for (let i = 1; i <= totalSpots; i++) {
          occupiedSpots.add(i)
        }
      }
    })

    for (let i = 1; i <= totalSpots; i++) {
      spots.push({
        id: `spot-${i}`,
        number: i,
        status: occupiedSpots.has(i) ? "occupied" : "vacant",
      })
    }

    return {
      spots,
      totalSpots,
      occupiedCount: occupiedSpots.size,
      vacantCount: totalSpots - occupiedSpots.size,
      currentDate,
    }
  }

  // New functions to navigate to cost estimate date selection
  const navigateToCostEstimateDateSelection = async () => {
    if (selectedSites.length === 0) {
      toast({
        title: "No sites selected",
        description: "Please select at least one site for the cost estimate.",
        variant: "destructive",
      })
      return
    }
    if (!selectedClientForProposal) {
      toast({
        title: "No Client Selected",
        description: "Please select a client first.",
        variant: "destructive",
      })
      return
    }

    // Check if any selected site has dynamic or digital content type that doesn't have spots selected yet
    const dynamicSitesWithoutSpots = selectedSites.filter(site => {
      const isDynamic = site.content_type?.toLowerCase() === "dynamic" || site.content_type?.toLowerCase() === "digital"
      return isDynamic && (!selectedSpots[site.id || ''] || selectedSpots[site.id || ''].length === 0)
    })

    if (dynamicSitesWithoutSpots.length > 0) {
      // Show spot selection dialog for dynamic sites without spots
      setSpotSelectionProducts(dynamicSitesWithoutSpots)

      try {
        const spotsData: Record<string, any> = {}
        const currentDate = new Date().toISOString().split('T')[0]

        for (const site of dynamicSitesWithoutSpots) {
          const spotData = await generateSpotsDataForDialog(site)
          spotsData[site.id || ''] = {
            spots: spotData.spots,
            totalSpots: spotData.totalSpots,
            occupiedCount: spotData.occupiedCount,
            vacantCount: spotData.vacantCount,
            currentDate: spotData.currentDate,
          }
        }

        setSpotSelectionSpotsData(spotsData)
        setSpotSelectionCurrentDate(currentDate)
        setIsSpotSelectionDialogOpen(true)
      } catch (error) {
        console.error("Error generating spots data:", error)
        toast({
          title: "Error",
          description: "Failed to load spot information.",
          variant: "destructive",
        })
      }
      return
    }

    // All dynamic sites have spots selected, proceed to date selection
    // Combine selected sites with spot selections
    const allSpotSelections = Object.entries(selectedSpots).map(([productId, spots]) => ({
      productId,
      spotNumbers: spots
    }))

    const params = new URLSearchParams({
      spotSelections: JSON.stringify(allSpotSelections),
      sites: JSON.stringify(selectedSites.filter(site =>
        site.content_type?.toLowerCase() !== "dynamic" && site.content_type?.toLowerCase() !== "digital"
      ).map(site => site.id)),
      clientId: selectedClientForProposal.id,
    })

    router.push(`/sales/cost-estimates/select-dates?${params.toString()}`)
  }

  const navigateToQuotationDateSelection = async () => {
    if (selectedSites.length === 0) {
      toast({
        title: "No sites selected",
        description: "Please select at least one site for the quotation.",
        variant: "destructive",
      })
      return
    }
    if (!selectedClientForProposal) {
      toast({
        title: "No Client Selected",
        description: "Please select a client first.",
        variant: "destructive",
      })
      return
    }

    // Check if any selected site has dynamic or digital content type that doesn't have spots selected yet
    const dynamicSitesWithoutSpots = selectedSites.filter(site => {
      const isDynamic = site.content_type?.toLowerCase() === "dynamic" || site.content_type?.toLowerCase() === "digital"
      return isDynamic && (!selectedSpots[site.id || ''] || selectedSpots[site.id || ''].length === 0)
    })

    if (dynamicSitesWithoutSpots.length > 0) {
      // Show spot selection dialog for dynamic sites without spots
      setSpotSelectionProducts(dynamicSitesWithoutSpots)

      try {
        const spotsData: Record<string, any> = {}
        const currentDate = new Date().toISOString().split('T')[0]

        for (const site of dynamicSitesWithoutSpots) {
          const spotData = await generateSpotsDataForDialog(site)
          spotsData[site.id || ''] = {
            spots: spotData.spots,
            totalSpots: spotData.totalSpots,
            occupiedCount: spotData.occupiedCount,
            vacantCount: spotData.vacantCount,
            currentDate: spotData.currentDate,
          }
        }

        setSpotSelectionSpotsData(spotsData)
        setSpotSelectionCurrentDate(currentDate)
        setIsSpotSelectionDialogOpen(true)
      } catch (error) {
        console.error("Error generating spots data:", error)
        toast({
          title: "Error",
          description: "Failed to load spot information.",
          variant: "destructive",
        })
      }
      return
    }

    // All dynamic sites have spots selected, proceed to date selection
    // Combine selected sites with spot selections
    const allSpotSelections = Object.entries(selectedSpots).map(([productId, spots]) => ({
      productId,
      spotNumbers: spots
    }))

    const params = new URLSearchParams({
      spotSelections: JSON.stringify(allSpotSelections),
      sites: JSON.stringify(selectedSites.filter(site =>
        site.content_type?.toLowerCase() !== "dynamic" && site.content_type?.toLowerCase() !== "digital"
      ).map(site => site.id)),
      clientId: selectedClientForProposal.id,
    })

    router.push(`/sales/quotations/select-dates?${params.toString()}`)
  }

  // Callback from DateRangeCalendarDialog - NOW CREATES THE DOCUMENT
  const [isCreatingCostEstimate, setIsCreatingCostEstimate] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const handleDatesSelected = async (startDate: Date, endDate: Date) => {

    if (!user?.uid || !userData?.company_id) {
      console.log("[v0] handleDatesSelected - Missing auth data:", {
        userUid: user?.uid,
        userDataCompanyId: userData?.company_id,
        userData: userData,
      })
      toast({
        title: "Authentication Required",
        description: `Please log in to create a ${actionAfterDateSelection === "quotation" ? "quotation" : "cost estimate"}.`,
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
      return
    }

    if (actionAfterDateSelection === "quotation") {
      // For quotations, check selectedSites
      if (selectedSites.length === 0) {
        toast({
          title: "No Sites Selected",
          description: "Please select at least one site to create a quotation.",
          variant: "destructive",
          open: true, // Add the missing 'open' property
        })
        return
      }
    } else {
      if (selectedSites.length === 0) {
        toast({
          title: "No Sites Selected",
          description: "Please select at least one site to create a cost estimate.",
          variant: "destructive",
          open: true, // Add the missing 'open' property
        })
        return
      }
    }

    if (actionAfterDateSelection === "quotation") {
      setIsCreatingDocument(true)
      try {
        const sitesData = selectedSites.map((site) => ({
          id: site.id!, // Ensure id is a string
          name: site.name,
          location: site.specs_rental?.location || (site as any).light?.location || "N/A",
          price: site.price || 0,
          type: site.type || "Unknown",
          image: site.media && site.media.length > 0 ? site.media[0].url : undefined,
          content_type: site.content_type || "",
          specs_rental: site.specs_rental,

        }))
        const clientData = {
          id: selectedClientForProposal!.id,
          name: selectedClientForProposal!.contactPerson,
          email: selectedClientForProposal!.email,
          company: selectedClientForProposal!.company,
          phone: selectedClientForProposal!.phone,
          address: selectedClientForProposal!.address,
          designation: selectedClientForProposal!.designation,
          industry: selectedClientForProposal!.industry,
          company_id: selectedClientForProposal!.company_id
        }

        const options = {
          startDate,
          endDate,
          company_id: userData.company_id,
          client_company_id: selectedClientForProposal!.company_id, // Use client's company_id
          page_id: selectedSites.length > 1 ? `PAGE-${Date.now()}` : undefined,
          created_by_first_name: userData.first_name,
          created_by_last_name: userData.last_name,
        }



        let quotationIds: string[]

        if (selectedSites.length > 1) {
          // Create multiple quotations for multiple sites
          console.log(`client data: ${JSON.stringify(clientData)}`)
          quotationIds = await createMultipleQuotations(clientData, sitesData, user.uid, options)

          toast({
            title: "Quotations Created",
            description: `Successfully created ${quotationIds.length} quotations for the selected sites.`,
            open: true, // Add the missing 'open' property
          })
        } else {
          // Create single quotation for one site
          const quotationId = await createDirectQuotation(clientData, sitesData, user.uid, options)
          quotationIds = [quotationId]

          toast({
            title: "Quotation Created",
            description: "Quotation has been created successfully.",
            open: true, // Add the missing 'open' property
          })
        }

        // Navigate to the first quotation
        router.push(`/sales/quotations/${quotationIds[0]}`)
      } catch (error) {
        console.error("Error creating quotation:", error)
        toast({
          title: "Error",
          description: "Failed to create quotation. Please try again.",
          variant: "destructive",
          open: true, // Add the missing 'open' property
        })
      } finally {
        setIsCreatingDocument(false)
        setIsDateRangeDialogOpen(false)
      }
      return
    }
    setIsCreatingCostEstimate(true)
    try {
      const sitesData = selectedSites.map((site) => ({
          id: site.id!, // Ensure id is a string
          name: site.name,
          location: site.specs_rental?.location || (site as any).light?.location || "N/A",
          price: site.price || 0,
          type: site.type || "Unknown",
          image: site.media && site.media.length > 0 ? site.media[0].url : undefined,
          content_type: site.content_type || "",
          specs_rental: site.specs_rental,
        }))
      const clientData = {
        id: selectedClientForProposal!.id,
        name: selectedClientForProposal!.contactPerson,
        email: selectedClientForProposal!.email,
        company: selectedClientForProposal!.company,
        phone: selectedClientForProposal!.phone,
        address: selectedClientForProposal!.address,
        designation: selectedClientForProposal!.designation,
        industry: selectedClientForProposal!.industry,
      }

      const options = {
        startDate,
        endDate,
        company_id: userData.company_id,
        client_company_id: selectedClientForProposal!.company_id, // Use client's company_id
        page_id: selectedSites.length > 1 ? `PAGE-${Date.now()}` : undefined,
      }

      console.log("[v0] handleDatesSelected - options being passed:", options)

      let costEstimateIds: string[]

      if (selectedSites.length > 1) {
        // Create multiple cost estimates for multiple sites
        costEstimateIds = await createMultipleCostEstimates(clientData, sitesData, user.uid, options)

        toast({
          title: "Cost Estimates Created",
          description: `Successfully created ${costEstimateIds.length} cost estimates for the selected sites.`,
          open: true, // Add the missing 'open' property
        })
      } else {
        // Create single cost estimate for one site
        const costEstimateId = await createDirectCostEstimate(clientData, sitesData, user.uid, options)
        costEstimateIds = [costEstimateId]

        toast({
          title: "Cost Estimate Created",
          description: "Cost estimate has been created successfully.",
          open: true, // Add the missing 'open' property
        })
      }

      // Navigate to the first cost estimate
      router.push(`/sales/cost-estimates/${costEstimateIds[0]}`)
    } catch (error) {
      console.error("Error creating cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to create cost estimate. Please try again.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
    } finally {
      setIsCreatingCostEstimate(false)
      setShowDatePicker(false)
    }
  }

  const handleSkipDates = async () => {
    console.log("[v0] handleSkipDates - userData:", userData)
    console.log("[v0] handleSkipDates - userData.company_id:", userData?.company_id)
    console.log("[v0] handleSkipDates - user:", user)

    if (!user?.uid || !userData?.company_id) {
      console.log("[v0] handleSkipDates - Missing auth data:", {
        userUid: user?.uid,
        userDataCompanyId: userData?.company_id,
        userData: userData,
      })
      toast({
        title: "Authentication Required",
        description: "Please log in to create a cost estimate.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
      return
    }

    setIsCreatingDocument(true)
    try {
      if (actionAfterDateSelection === "cost_estimate") {
        const clientData = {
          id: selectedClientForProposal!.id,
          name: selectedClientForProposal!.contactPerson,
          email: selectedClientForProposal!.email,
          company: selectedClientForProposal!.company,
          phone: selectedClientForProposal!.phone,
          address: selectedClientForProposal!.address,
          designation: selectedClientForProposal!.designation,
          industry: selectedClientForProposal!.industry,
        }

        const sitesData = selectedSites.map((site) => ({
          id: site.id!, // Ensure id is a string
          name: site.name,
          location: site.specs_rental?.location || (site as any).light?.location || "N/A",
          price: site.price || 0,
          type: site.type || "Unknown",
          image: site.media && site.media.length > 0 ? site.media[0].url : undefined,
          content_type: site.content_type || "",
          specs_rental: site.specs_rental,
        }))
        console.log("sites data", sitesData)
        const options = {
          startDate: undefined,
          endDate: undefined,
          company_id: userData.company_id,
          client_company_id: selectedClientForProposal!.company_id, // Use client's company_id
          page_id: selectedSites.length > 1 ? `PAGE-${Date.now()}` : undefined,
        }

        console.log("[v0] handleSkipDates - options being passed:", options)

        if (selectedSites.length === 1) {
          // Single site - create one document
          const newCostEstimateId = await createDirectCostEstimate(clientData, sitesData, user.uid, options)

          toast({
            title: "Cost Estimate Created",
            description: "Your cost estimate has been created successfully without dates.",
            open: true, // Add the missing 'open' property
          })
          router.push(`/sales/cost-estimates/${newCostEstimateId}`) // Navigate to view page
        } else {
          // Multiple sites - create separate documents for each site
          const newCostEstimateIds = await createMultipleCostEstimates(clientData, sitesData, user.uid, options)

          toast({
            title: "Cost Estimates Created",
            description: `${newCostEstimateIds.length} cost estimates have been created successfully without dates - one for each selected site.`,
            open: true, // Add the missing 'open' property
          })

          // Navigate to the first cost estimate
          if (newCostEstimateIds.length > 0) {
            router.push(`/sales/cost-estimates/${newCostEstimateIds[0]}`)
          }
        }
      }
    } catch (error) {
      console.error("Error creating cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to create cost estimate. Please try again.",
        variant: "destructive",
        open: true, // Add the missing 'open' property
      })
    } finally {
      setIsCreatingDocument(false)
    }
  }

  const handleCancelCeQuote = () => {
    setCeQuoteMode(false)
    setCeMode(false)
    setQuoteMode(false)
    setSelectedSites([])
    setSelectedClientForProposal(null)
    setDashboardClientSearchTerm("")
    
  }

  

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
    // Search filter
    if (siteSearchTerm.trim()) {
      const searchLower = siteSearchTerm.toLowerCase()
      const name = product.name?.toLowerCase() || ""
      const location = (product.specs_rental?.location || product.light?.location || "")?.toLowerCase() || ""
      const siteCode = getSiteCode(product)?.toLowerCase() || ""

      return name.includes(searchLower) ||
             location.includes(searchLower) ||
             siteCode.includes(searchLower)
    }

    return true
  })

  return (
    <div className="h-screen flex flex-col">
      {/* Inject CSS for gradient border */}
      <style dangerouslySetInnerHTML={{ __html: gradientBorderStyles }} />
      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          // Skeleton Loading State
          <div className="flex flex-col gap-5">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>

            {/* Search and Actions Bar Skeleton */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <Skeleton className="h-10 w-full sm:w-96" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>

            {/* Filters Skeleton (if applicable, otherwise can be removed) */}
            <div className="flex gap-3">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>

            {/* Grid View Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
              {Array(8)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <div className="p-4">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-4 w-2/3 mb-4" />
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          // Actual Dashboard Content
          <div
            className={cn(
              "grid grid-cols-1 gap-6 h-full transition-all duration-300",
              // Only apply two-column layout when proposalCreationMode is true
              proposalCreationMode && "lg:grid-cols-[1fr_300px]",
            )}
          >
            {/* Left Column: Main Dashboard Content */}
            <div className="flex flex-col gap-1 md:gap-2 h-full overflow-hidden">
              {/* Proposal Creation Header */}
              {proposalCreationMode && (
                <div className="flex items-center mb-6 px-2 sm:px-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelProposalCreationMode}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent hover:scale-105 focus:ring-2 focus:ring-ring focus:ring-offset-2 mr-4"
                    aria-label="Cancel proposal creation and return to dashboard"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm font-medium">Back</span>
                  </Button>
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">
                    Create Proposal
                  </h2>
                </div>
              )}

              {/* CE/Quote Header */}
              {ceQuoteMode && !proposalCreationMode && (
                <div className="flex items-center mb-6 px-2 sm:px-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelCeQuote}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent hover:scale-105 focus:ring-2 focus:ring-ring focus:ring-offset-2 mr-4"
                    aria-label="Cancel site selection and return to dashboard"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm font-medium">Back</span>
                  </Button>
                  <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">
                    Select Sites
                  </h2>
                </div>
              )}

              {/* Dashboard Header */}
              {!(proposalCreationMode || ceQuoteMode) && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-semibold text-[#333333]">
                      {userData?.first_name
                        ? `${userData.first_name.charAt(0).toUpperCase()}${userData.first_name.slice(1).toLowerCase()}'s Dashboard`
                        : "Dashboard"}
                    </h1>

                    {/* Navigation Tabs */}
                    <div className="flex gap-2">
                      <Button variant="outline" className="bg-white border-[#d9d9d9] text-[#333333] hover:bg-gray-50" onClick={handleInitiateProposalFlow}>
                        Proposal
                      </Button>
                      <Button variant="outline" className="bg-white border-[#d9d9d9] text-[#333333] hover:bg-gray-50" onClick={handleCeMode}>
                        Cost Estimate
                      </Button>
                      <Button variant="outline" className="bg-white border-[#d9d9d9] text-[#333333] hover:bg-gray-50" onClick={handleQuoteMode}>
                        Quotation
                      </Button>
                      <Button variant="outline" className="bg-white border-[#d9d9d9] text-[#333333] hover:bg-gray-50" onClick={() => router.push("/sales/job-orders/select-booking")}>
                        Job Order
                      </Button>
                      <Button variant="outline" className="bg-white border-[#d9d9d9] text-[#333333] hover:bg-gray-50" onClick={() => setIsCollabPartnerDialogOpen(true)}>
                        Collab
                      </Button>
                    </div>
                  </div>

                  {/* Search and View Controls */}
                  <div className="flex justify-between items-center">
                    <div className="relative">
                      <div className="w-80 mt-2 mb-2">
                        <ProductSearchBox
                          companyId={userData?.company_id || ""}
                          onSearchResults={handleSearchResults}
                          onSearchError={handleSearchError}
                          onSearchLoading={handleSearchLoading}
                          onSearchClear={handleSearchClear}
                          placeholder="Search products..."
                          page={currentSearchPage}
                          hitsPerPage={20}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" className="bg-white border-[#d9d9d9] hover:bg-gray-50" onClick={() => setViewMode("list")}>
                        <List className="w-4 h-4 text-[#b7b7b7]" />
                      </Button>
                      <Button variant="outline" size="icon" className="bg-white border-[#d9d9d9] hover:bg-gray-50" onClick={() => setViewMode("grid")}>
                        <Grid3X3 className="w-4 h-4 text-[#b7b7b7]" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search and Client Selection - Responsive layout */}
              {(proposalCreationMode || ceQuoteMode) && (
                <div className="mt-0.5 mb-2">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Search Bar */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Search Sites</label>
                      <div className="relative">
                        <Input
                          placeholder="Search for sites..."
                          value={siteSearchTerm}
                          onChange={(e) => setSiteSearchTerm(e.target.value)}
                          className="h-11 pl-4 pr-4 text-sm border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 transition-all"
                          aria-label="Search sites"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    </div>

                    {/* Client Selection */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">Select Client</label>
                      <div className="relative" ref={clientSearchRef}>
                        <Input
                          placeholder="Choose a client..."
                          value={
                            selectedClientForProposal
                              ? selectedClientForProposal.company || selectedClientForProposal.contactPerson
                              : dashboardClientSearchTerm
                          }
                          onChange={(e) => {
                            setDashboardClientSearchTerm(e.target.value)
                            setSelectedClientForProposal(null)
                          }}
                          onFocus={() => {
                            setIsClientDropdownOpen(true)
                            if (selectedClientForProposal) {
                              setDashboardClientSearchTerm("")
                            }
                          }}
                          className={cn(
                            "h-11 pl-4 pr-10 text-sm border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 transition-all",
                            (proposalCreationMode || ceQuoteMode) && selectedClientForProposal && "border-green-500 bg-green-50",
                          )}
                        />
                        {isSearchingDashboardClients ? (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
                        ) : (
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        )}
                        {/* Results dropdown */}
                        {isClientDropdownOpen && (
                          <Card className="absolute top-full z-50 mt-2 w-full shadow-xl border border-gray-200 rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <div className="max-h-60 overflow-y-auto">
                              <div className="p-2">
                                {/* Always show "Add New Client" option at the top */}
                                <div
                                  className="flex items-center gap-3 py-3 px-3 hover:bg-blue-50 cursor-pointer rounded-md text-sm mb-2 border-b border-gray-100 transition-colors"
                                  onClick={() => setIsNewClientDialogOpen(true)}
                                >
                                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                                    <PlusCircle className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-blue-700">Add New Client</span>
                                </div>

                                {dashboardClientSearchResults.length > 0 ? (
                                  dashboardClientSearchResults.map((result) => (
                                    <div
                                      key={result.id}
                                      className="flex items-center justify-between py-3 px-3 hover:bg-gray-50 cursor-pointer rounded-md text-sm transition-colors"
                                      onClick={() => handleClientSelectOnDashboard(result)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                                          <span className="text-xs font-medium text-gray-600">
                                            {(result.company || result.name).charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900">
                                            {result.name} {result.company && `(${result.company})`}
                                          </p>
                                          <p className="text-xs text-gray-500">{result.email}</p>
                                        </div>
                                      </div>
                                      {selectedClientForProposal?.id === result.id && (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-6">
                                    <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">
                                      {dashboardClientSearchTerm.trim() && !isSearchingDashboardClients
                                        ? `No clients found for "${dashboardClientSearchTerm}".`
                                        : "Start typing to search for clients."}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              

              {/* Search Results View */}
              {isSearching && (
                <div className="flex flex-col gap-4 overflow-y-auto">
                  {/* Search Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={handleClearSearch} className="h-8 w-8 p-0">
                        <ArrowLeft size={16} />
                      </Button>
                      <h2 className="text-base md:text-lg font-medium truncate">
                        Results for "{searchQuery}" ({searchResults.length})
                      </h2>
                    </div>
                  </div>

                  {/* Search Error */}
                  {searchError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{searchError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Search Results */}
                  {searchResults.length > 0 ? (
                    <div>
                      {viewMode === "grid" ? (
                        // Grid View for Search Results
                        <ResponsiveCardGrid
                          mobileColumns={1}
                          tabletColumns={2}
                          desktopColumns={4}
                          gap="xl"
                        >
                          {searchResults.map((result) => {
                            // Convert SearchResult to Product-like object for ProductCard
                            const productLike: Product = {
                              id: result.objectID,
                              name: result.name,
                              type: result.type,
                              price: result.price || 0,
                              media: result.media || [],
                              specs_rental: result.specs_rental,
                              description: result.description || "",
                              site_code: result.site_code,
                              categories: [],
                              category_names: [],
                              active: true,
                              created: new Date(),
                              updated: new Date(),
                              deleted: false,
                              seller_id: result.seller_id || "",
                              seller_name: "",
                              position: 0,
                            }

                            return (
                              <ProductCard
                                key={result.objectID}
                                product={productLike}
                                hasOngoingBooking={false} // Search results don't show booking status
                                onView={() => handleSearchResultClick(result)}
                                onEdit={() => {}} // No edit for search results
                                onDelete={() => {}} // No delete for search results
                                onCreateReport={() => {}} // No report for search results
                                isSelected={false}
                                onSelect={() => {}}
                                selectionMode={false}
                              />
                            )
                          })}
                        </ResponsiveCardGrid>
                      ) : (
                        // List View for Search Results - Only show on tablet and desktop
                        !isMobile && (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[80px]">Image</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="hidden md:table-cell">Location</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead className="hidden md:table-cell">Site Code</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {searchResults.map((result) => (
                                    <TableRow
                                      key={result.objectID}
                                      className="cursor-pointer hover:bg-gray-50"
                                      onClick={() => handleSearchResultClick(result)}
                                    >
                                      <TableCell>
                                        <div className="h-12 w-12 bg-gray-100 rounded overflow-hidden relative">
                                          {result.image_url ? (
                                            <Image
                                              src={result.image_url || "/placeholder.svg"}
                                              alt={result.name || "Search result"}
                                              width={48}
                                              height={48}
                                              className="h-full w-full object-cover"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement
                                                target.src = "/abstract-geometric-sculpture.png"
                                                target.className = "opacity-50"
                                              }}
                                            />
                                          ) : (
                                            <div className="h-full w-full flex items-center justify-center text-gray-500 font-medium text-xs">
                                              NO IMAGE
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="font-medium">{result.name}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className={
                                            result.type?.toLowerCase() === "product" ||
                                            result.type?.toLowerCase() === "rental"
                                              ? "bg-blue-50 text-blue-700 border-blue-200"
                                              : result.type?.toLowerCase() === "client"
                                                ? "bg-green-50 text-green-700 border-green-200"
                                                : "bg-purple-50 text-purple-700 border-purple-200"
                                          }
                                        >
                                          {result.type || "Unknown"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell">
                                        {result.location || "Unknown location"}
                                      </TableCell>
                                      <TableCell>
                                        {result.price ? `₱${Number(result.price).toLocaleString()}` : "Not set"}
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell">{result.site_code || "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )
                      )}
                      {/* Search Pagination Controls */}
                      {searchPagination && searchPagination.nbPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                          <div className="text-sm text-gray-500">
                            Page {currentSearchPage + 1} of {searchPagination.nbPages} ({searchPagination.nbHits} results)
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentSearchPage(prev => Math.max(0, prev - 1))}
                              disabled={currentSearchPage === 0}
                              className="h-8 w-8 p-0 bg-transparent"
                            >
                              <ChevronLeft size={16} />
                            </Button>

                            {/* Page numbers - Hide on mobile */}
                            <div className="hidden sm:flex items-center gap-1">
                              {(() => {
                                const totalPages = searchPagination.nbPages
                                const currentPage = currentSearchPage
                                const maxVisible = 5

                                // Calculate the range of pages to show
                                let startPage = Math.max(0, currentPage - Math.floor(maxVisible / 2))
                                let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1)

                                // Adjust startPage if we're near the end
                                if (endPage - startPage + 1 < maxVisible) {
                                  startPage = Math.max(0, endPage - maxVisible + 1)
                                }

                                return Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                                  const pageNum = startPage + i
                                  return (
                                    <Button
                                      key={`search-page-${pageNum}`}
                                      variant={currentPage === pageNum ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setCurrentSearchPage(pageNum)}
                                      className="h-8 w-8 p-0"
                                    >
                                      {pageNum + 1}
                                    </Button>
                                  )
                                })
                              })()}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentSearchPage(prev => Math.min(searchPagination.nbPages - 1, prev + 1))}
                              disabled={currentSearchPage >= searchPagination.nbPages - 1}
                              className="h-8 w-8 p-0 bg-transparent"
                            >
                              <ChevronRight size={16} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // No Search Results
                    <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed">
                      <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Search size={24} className="text-gray-400" />
                      </div>
                      <h3 className="text-base md:text-lg font-medium mb-2">No results found</h3>
                      <p className="text-sm text-gray-500 mb-4 px-4">
                        No items match your search for "{searchQuery}". Try using different keywords.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Dashboard Content - Only show when not searching */}
              {!isSearching && (
                <>
                  {/* Empty state */}
                  {!loading && filteredProducts.length === 0 && (
                    <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed">
                      <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <MapPin size={24} className="text-gray-400" />
                      </div>
                      <h3 className="text-base md:text-lg font-medium mb-2">No products yet</h3>
                      <p className="text-sm text-gray-500 mb-4">Contact an administrator to add products</p>
                    </div>
                  )}

                  {/* Grid View */}
                  {!loading && filteredProducts.length > 0 && viewMode === "grid" && (
                    <div className="flex-1 overflow-y-auto">
                      <ResponsiveCardGrid
                        mobileColumns={1}
                        tabletColumns={2}
                        desktopColumns={4}
                        gap="xl"
                      >
                        {filteredProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            hasOngoingBooking={productsWithBookings[product.id || ""] || false}
                            onView={() => handleViewDetails(product.id || "")}
                            onEdit={(e) => handleEditClick(product, e)}
                            onDelete={(e) => handleDeleteClick(product, e)}
                            onCreateReport={(e) => handleCreateReport(product, e)}
                            isSelected={
                              proposalCreationMode
                                ? selectedProducts.some((p) => p.id === product.id)
                                : selectedSites.some((p) => p.id === product.id)
                            }
                            onSelect={() =>
                              proposalCreationMode ? handleProductSelect(product) : handleSiteSelect(product)
                            }
                            selectionMode={proposalCreationMode || ceQuoteMode}
                          />
                        ))}
                      </ResponsiveCardGrid>
                    </div>
                  )}

                  {/* List View - Only show on tablet and desktop */}
                  {!loading && filteredProducts.length > 0 && viewMode === "list" && !isMobile && (
                    <div className="flex-1 overflow-y-auto">
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[80px]">Site</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="hidden md:table-cell">Location</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead className="hidden md:table-cell">Site Code</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredProducts.map((product) => (
                                <TableRow
                                  key={product.id}
                                  className="cursor-pointer hover:bg-gray-50"
                                  onClick={() => {
                                    if (proposalCreationMode) {
                                      handleProductSelect(product)
                                    } else if (ceQuoteMode) {
                                      handleSiteSelect(product)
                                    } else {
                                      handleViewDetails(product.id || "")
                                    }
                                  }}
                                >
                                  <TableCell>
                                    <div className="h-12 w-12 bg-gray-100 rounded overflow-hidden relative">
                                      {product.media && product.media.length > 0 ? (
                                        <>
                                          <Image
                                            src={product.media[0].url || "/placeholder.svg"}
                                            alt={product.name || "Product image"}
                                            width={48}
                                            height={48}
                                            className={`h-full w-full object-cover ${productsWithBookings[product.id || ""] ? "grayscale" : ""}`}
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement
                                              target.src = "/abstract-geometric-sculpture.png"
                                              target.className = "opacity-50"
                                            }}
                                          />
                                        </>
                                      ) : (
                                        <div className="h-full w-full flex items-center justify-center text-gray-500 font-medium text-xs">
                                          NO IMAGE
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{product.name}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        product.type?.toLowerCase() === "rental"
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-purple-50 text-purple-700 border-purple-200"
                                      }
                                    >
                                      {product.type || "Unknown"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {product.specs_rental?.location || (product as any).light?.location || "Unknown location"}
                                  </TableCell>
                                  <TableCell>
                                    {product.price ? `₱${Number(product.price).toLocaleString()}` : "Not set"}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">{getSiteCode(product) || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading More Indicator */}
                  {loadingMore && (
                    <div className="flex justify-center my-4">
                      <div className="flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        <span>Loading more...</span>
                      </div>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {!loading && filteredProducts.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                      <div className="text-sm text-gray-500 flex items-center">
                        {loadingCount ? (
                          <div className="flex items-center">
                            <Loader2 size={14} className="animate-spin mr-2" />
                            <span>Calculating pages...</span>
                          </div>
                        ) : (
                          <span>
                            Page {currentPage} of {totalPages} ({filteredProducts.length} items)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToPreviousPage}
                          disabled={currentPage === 1}
                          className="h-8 w-8 p-0 bg-transparent"
                        >
                          <ChevronLeft size={16} />
                        </Button>

                        {/* Page numbers - Hide on mobile */}
                        <div className="hidden sm:flex items-center gap-1">
                          {getPageNumbers().map((page, index) =>
                            page === "..." ? (
                              <span key={`ellipsis-${index}`} className="px-2">
                                ...
                              </span>
                            ) : (
                              <Button
                                key={`page-${page}`}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => goToPage(page as number)}
                                className="h-8 w-8 p-0"
                              >
                                {page}
                              </Button>
                            ),
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextPage}
                          disabled={currentPage >= totalPages}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight size={16} />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

{/* Right Column: Proposal History - Always show when in proposal mode or when copying sites */}
{proposalCreationMode && (
  <div className="w-full md:w-80 h-[60vh] bg-white rounded-[20px] shadow-[-2px_4px_10.5px_-2px_rgba(0,0,0,0.25)] print:hidden flex flex-col mt-[100px]">
    <div className="p-6 pb-0">
      <h3 className="text-lg font-semibold">
        Proposal History
        {selectedClientForProposal && (
          <span className="text-sm font-normal text-gray-500 block">for {selectedClientForProposal.company}</span>
        )}
      </h3>
    </div>
    <div className="flex-1 overflow-y-auto">
      <ProposalHistory
        selectedClient={
          selectedClientForProposal
            ? {
                id: selectedClientForProposal.id || "",
                company: selectedClientForProposal.company,
                contactPerson: selectedClientForProposal.contactPerson,
              }
            : null
        }
        onCopySites={handleCopySitesFromProposal}
        showHeader={false}
      />
    </div>
  </div>
)}

          </div>
        )}

        {/* Next Button - Fixed position when in proposal mode */}
        {proposalCreationMode && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-white rounded-[20px] shadow-lg border border-gray-200 p-4 min-w-[350px] max-w-[450px]">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-gray-600 flex-shrink-0">
                  {selectedProducts.length} site{selectedProducts.length !== 1 ? 's' : ''} selected
                </div>
                <Button
                  onClick={handleConfirmProposalCreation}
                  disabled={!selectedClientForProposal || selectedProducts.length === 0 || isCreatingProposal}
                  className={`flex-1 h-12 rounded-lg text-lg font-semibold transition-all duration-200 ${
                    selectedClientForProposal && selectedProducts.length > 0
                      ? "bg-[#1d0beb] hover:bg-blue-700 text-white"
                      : "bg-gray-400 text-gray-600 cursor-not-allowed"
                  }`}
                  aria-label={`Create proposal with ${selectedProducts.length} selected sites`}
                >
                  {isCreatingProposal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Next →
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* CE/Quote Button - Fixed position when in CE/Quote mode */}
        {ceQuoteMode && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-white rounded-[20px] shadow-lg border border-gray-200 p-4 min-w-[350px] max-w-[450px]">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-gray-600 flex-shrink-0">
                  {selectedSites.length} site{selectedSites.length !== 1 ? 's' : ''} selected
                </div>
                <Button
                  onClick={ceMode ? navigateToCostEstimateDateSelection : navigateToQuotationDateSelection}
                  disabled={!selectedClientForProposal || selectedSites.length === 0 || isCreatingDocument}
                  className={`flex-1 h-12 rounded-lg text-lg font-semibold transition-all duration-200 ${
                    selectedClientForProposal && selectedSites.length > 0
                      ? ceMode
                        ? "bg-gray-600 hover:bg-gray-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-gray-400 text-gray-600 cursor-not-allowed"
                  }`}
                  aria-label={`${ceMode ? 'Create cost estimate' : 'Create quotation'} with ${selectedSites.length} selected sites`}
                >
                  {isCreatingDocument ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Next →
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* Date Range Selection Dialog */}
        <DateRangeCalendarDialog
          isOpen={isDateRangeDialogOpen}
          onClose={() => setIsDateRangeDialogOpen(false)}
          onSelectDates={handleDatesSelected}
          onSkipDates={handleSkipDates}
          selectedSiteIds={selectedSites.map((site) => site.id || "")}
          selectedClientId={selectedClientForProposal?.id}
          showSkipButton={actionAfterDateSelection === "cost_estimate"}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Product"
          description="This product will be removed from your dashboard. This action cannot be undone."
          itemName={productToDelete?.name}
        />

        {/* Collab Partner Selection Dialog */}
        <CollabPartnerDialog isOpen={isCollabPartnerDialogOpen} onClose={() => setIsCollabPartnerDialogOpen(false)} />

        {/* New Client Dialog (now using ClientDialog) */}
        <ClientDialog
          open={isNewClientDialogOpen}
          onOpenChange={setIsNewClientDialogOpen}
          onSuccess={(newClient) => {
            setIsNewClientDialogOpen(false)
            handleClientSelectOnDashboard(newClient)
            toast({
              title: "Client Added",
              description: `${newClient.name} (${newClient.company}) has been added.`,
              open: true, // Add the missing 'open' property
            })
          }}
        />

        <CreateReportDialog
          open={createReportDialogOpen}
          onOpenChange={setCreateReportDialogOpen}
          siteId={selectedProductForReport}
          module="sales"
        />

        {/* Spot Selection Dialog */}
        <SpotSelectionDialog
          open={isSpotSelectionDialogOpen}
          onOpenChange={setIsSpotSelectionDialogOpen}
          products={spotSelectionProducts}
          currentDate={spotSelectionCurrentDate}
          selectedDate={spotSelectionCurrentDate}
          type={ceMode ? "cost-estimate" : "quotation"}
          preSelectedClient={selectedClientForProposal}
          nonDynamicSites={selectedSites.filter(site =>
            site.content_type?.toLowerCase() !== "dynamic" && site.content_type?.toLowerCase() !== "digital"
          )}
          showDoneButton={!!currentSpotSelectionProduct}
          hideClientSelection={!!currentSpotSelectionProduct}
          onDone={(spots) => {
            // Store the selected spots
            setSelectedSpots(prev => ({
              ...prev,
              ...spots
            }))

            // Add the product to selected sites if it has spots selected
            if (currentSpotSelectionProduct && spots[currentSpotSelectionProduct.id || '']?.length > 0) {
              setSelectedSites(prev => {
                const isAlreadySelected = prev.some(p => p.id === currentSpotSelectionProduct.id)
                if (!isAlreadySelected) {
                  return [...prev, currentSpotSelectionProduct]
                }
                return prev
              })
            }

            setCurrentSpotSelectionProduct(null)
          }}
        />
      </div>
    </div>
  )
}

export default function SalesDashboardPage() {
  const { user, userData } = useAuth()

  return (
    <RouteProtection requiredRoles="sales">
      <div className="min-h-screen bg-[#fafafa] p-6">
        <div className="max-w-7xl mx-auto">
          <SalesDashboardContent />

          {/* Render SalesChatWidget without the floating button */}
          <SalesChatWidget />
        </div>
      </div>
    </RouteProtection>
  )
}

// Product Card Component for Grid View
export function ProductCard({
  product,
  hasOngoingBooking,
  onView,
  onEdit,
  onDelete,
  onCreateReport,
  isSelected = false,
  onSelect,
  selectionMode = false,
}: {
  product: Product
  hasOngoingBooking: boolean
  onView: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onCreateReport: (e: React.MouseEvent) => void
  isSelected?: boolean
  onSelect?: () => void
  selectionMode?: boolean
}) {
  // Determine location based on product type
  const location = product.specs_rental?.location || product.light?.location || "Unknown location"

  // Format price if available
  const formattedPrice = product.price ? `₱${Number(product.price).toLocaleString()}/month` : "Price not set"

  // Get site code
  const siteCode = getSiteCode(product)

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect()
    } else {
      onView()
    }
  }

  const isDynamicSite = product.content_type?.toLowerCase() === "dynamic" || product.content_type?.toLowerCase() === "digital";

  return isDynamicSite ? (
    <div className="p-[4px] rounded-[16px] gradient-border h-[344px]">
      <div
        className={cn(
          "bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all hover:shadow-xl border h-[335px] flex flex-col",
          isSelected ? "border-green-500" : "border-gray-200",
          selectionMode ? "hover:border-green-300" : "",
        )}
        onClick={handleClick}
      >
      <div className="h-[218px] bg-gray-300 relative rounded-t-2xl">
        <Image
          src={product.media && product.media.length > 0 ? product.media[0].url : "/placeholder.svg"}
          alt={product.name || "Product image"}
          fill
          className={`object-cover ${hasOngoingBooking ? "grayscale" : ""}`}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/abstract-geometric-sculpture.png"
            target.className = `opacity-50 object-contain ${hasOngoingBooking ? "grayscale" : ""}`
          }}
        />

        {/* Selection indicator */}
        {selectionMode && (
          <div className="absolute top-3 left-3 z-10">
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                isSelected ? "bg-green-500 border-green-500" : "bg-white border-gray-300",
              )}
            >
              {isSelected && <CheckCircle2 size={16} className="text-white" />}
            </div>
          </div>
        )}

      </div>

      <div className="p-4 flex-1 flex flex-col justify-end">
        <div className="space-y-2">
          <div className="text-sm text-black font-medium">{product.name}</div>
          <div className="text-sm text-black font-medium truncate">{location}</div>
          <div className="text-sm text-black font-medium">{formattedPrice}</div>
        </div>
      </div>
    </div>
  </div>
   ) : (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all hover:shadow-xl border h-[340px] flex flex-col",
        isSelected ? "border-green-500" : "border-gray-200",
        selectionMode ? "hover:border-green-300" : "",
      )}
      onClick={handleClick}
    >
      <div className="h-[218px] bg-gray-300 relative rounded-t-2xl">
        <Image
          src={product.media && product.media.length > 0 ? product.media[0].url : "/placeholder.svg"}
          alt={product.name || "Product image"}
          fill
          className={`object-cover ${hasOngoingBooking ? "grayscale" : ""}`}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/abstract-geometric-sculpture.png"
            target.className = `opacity-50 object-contain ${hasOngoingBooking ? "grayscale" : ""}`
          }}
        />

        {/* Selection indicator */}
        {selectionMode && (
          <div className="absolute top-3 left-3 z-10">
            <div
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                isSelected ? "bg-green-500 border-green-500" : "bg-white border-gray-300",
              )}
            >
              {isSelected && <CheckCircle2 size={16} className="text-white" />}
            </div>
          </div>
        )}

      </div>

      <div className="p-4 flex-1 flex flex-col justify-end">
        <div className="space-y-2">
          <div className="text-sm text-black font-medium">{product.name}</div>
          <div className="text-sm text-black font-medium truncate">{location}</div>
          <div className="text-sm text-black font-medium">{formattedPrice}</div>
        </div>
      </div>
    </div>
)
}


