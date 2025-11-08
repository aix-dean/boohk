"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, MapPin, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { getPaginatedUserProducts, getUserProductsCount, softDeleteProduct, type Product } from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { useResponsive } from "@/hooks/use-responsive"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { CompanyRegistrationDialog } from "@/components/company-registration-dialog"
import { CompanyUpdateDialog } from "@/components/company-update-dialog"
import { CompanyService } from "@/lib/company-service"
import Image from "next/image"
import { algoliasearch } from "algoliasearch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { subscriptionService } from "@/lib/subscription-service"
import { CreateReportDialog } from "@/components/create-report-dialog"

// Number of items to display per page
const ITEMS_PER_PAGE = 12

// Initialize Algolia client
const getAlgoliaClient = () => {
  return algoliasearch(
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
  )
}

export default function AdminAssetsPage() {
  const router = useRouter()
  const { user, userData, subscriptionData, refreshUserData } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const { isMobile, isTablet } = useResponsive()

  // Company registration dialog state
  const [showCompanyDialog, setShowCompanyDialog] = useState(false)

  // Company update dialog state
  const [showCompanyUpdateDialog, setShowCompanyUpdateDialog] = useState(false)

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

  // Subscription limit dialog state
  const [showSubscriptionLimitDialog, setShowSubscriptionLimitDialog] = useState(false)
  const [subscriptionLimitMessage, setSubscriptionLimitMessage] = useState("")

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [contentTypeFilter, setContentTypeFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [activeTab, setActiveTab] = useState("sites")

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")

  // Test Algolia connection
  const testAlgoliaConnection = useCallback(async () => {
    try {
      console.log("🧪 Testing Algolia connection...")
      const client = getAlgoliaClient() as any
      const results = await client.search([{
        indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!,
        query: "",
        params: {
          page: 0,
          hitsPerPage: 1,
          filters: `company_id:${userData?.company_id}`,
        }
      }])
      console.log("✅ Algolia connection successful:", results)
      return true
    } catch (error) {
      console.error("❌ Algolia connection failed:", error)
      return false
    }
  }, [userData?.company_id])

  // Algolia search functions
  const searchProductsWithAlgolia = useCallback(async (
    searchTerm: string,
    page: number = 0,
    hitsPerPage: number = ITEMS_PER_PAGE
  ) => {
    try {
      if (!userData?.company_id) {
        throw new Error("No company_id available for search")
      }

      console.log("🔍 Algolia Search Debug:")
      console.log("- Search term:", searchTerm)
      console.log("- Page:", page)
      console.log("- Company ID:", userData.company_id)
      console.log("- Index name:", process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME)
      console.log("- Filter applied:", `company_id:${userData.company_id}`)

      const client = getAlgoliaClient() as any

      const searchParams = {
        indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!,
        query: searchTerm || "", // Empty string for browse all
        params: {
          page,
          hitsPerPage,
          filters: `company_id:${userData.company_id}`,
          // Search across all attributes
          restrictSearchableAttributes: [],
          // Include all attributes in response
          attributesToRetrieve: ['*'],
        }
      }

      // 🔍 COMPANY FILTER DEBUGGING & AUTO-DETECTION
      // This code automatically detects the correct filter syntax for company isolation
      // It tries multiple approaches and uses the first one that works
      console.log("🔍 Auto-detecting company filter syntax...")

      // First, let's see what fields are available
      const exploreParams = {
        indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!,
        query: searchTerm || "",
        params: {
          page: 0,
          hitsPerPage: 1,
          attributesToRetrieve: ['*'],
        }
      }

      const exploreResults = await client.search([exploreParams])
      const exploreResult = exploreResults.results[0]
      const firstHit = exploreResult?.hits?.[0] || {}

      console.log("🔍 Available fields in Algolia:", Object.keys(firstHit))
      console.log("🔍 Company ID in data:", firstHit.company_id)
      console.log("🔍 Expected company ID:", userData.company_id)

      // Try different filter syntaxes
      const filterAttempts = [
        `company_id:${userData.company_id}`,
        `company_id:"${userData.company_id}"`,
        `company_id='${userData.company_id}'`,
        `${userData.company_id}`, // Try as facet
      ]

      let workingResult = null
      for (const filter of filterAttempts) {
        try {
          console.log(`🔍 Trying filter: ${filter}`)
          const testParams = {
            indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!,
            query: searchTerm || "",
            params: {
              page,
              hitsPerPage,
              filters: filter,
              attributesToRetrieve: ['*'],
            }
          }

          const testResults = await client.search([testParams])
          const testResult = testResults.results[0]

          console.log(`🔍 Filter "${filter}" results: ${testResult?.nbHits || 0} hits`)

          if ((testResult?.nbHits || 0) > 0) {
            console.log(`✅ Filter "${filter}" works!`)
            workingResult = testResult
            break
          }
        } catch (error) {
          console.log(`❌ Filter "${filter}" failed:`, error)
        }
      }

      // Use working result or fallback to no filter
      const result = workingResult || exploreResult
      const results = workingResult ? { results: [result] } : exploreResults

      return {
        hits: result.hits || [],
        totalHits: result.nbHits || 0,
        totalPages: result.nbPages || 0,
        currentPage: result.page || 0,
      }
    } catch (error) {
      console.error("❌ Algolia search error:", error)
      throw error
    }
  }, [userData?.company_id])

  // Fetch total count of products
  const fetchTotalCount = useCallback(async () => {
    if (!userData?.company_id) {
      setTotalItems(0)
      setTotalPages(1)
      setLoadingCount(false)
      return
    }

    setLoadingCount(true)
    try {
      console.log("🔍 Using Algolia for total count - Search term:", searchTerm || "(no search)")
      let count: number

      try {
        // Use Algolia for all count operations
        const results = await searchProductsWithAlgolia(searchTerm || "", 0, 1)
        count = results.totalHits
        console.log("🔍 Algolia total count:", count)
      } catch (algoliaError) {
        console.warn("⚠️ Algolia count failed, falling back to Firebase:", algoliaError)
        // Fallback to Firebase if Algolia fails
        count = await getUserProductsCount(userData?.company_id, {
          active: true,
          searchTerm: searchTerm || undefined,
          content_type: contentTypeFilter !== "all" ? contentTypeFilter : undefined
        })
      }

      setTotalItems(count)
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (error) {
      console.error("Error fetching total count:", error)
      toast({
        title: "Error",
        description: "Failed to load product count. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingCount(false)
    }
  }, [userData, toast, searchTerm, contentTypeFilter, searchProductsWithAlgolia])

  // Fetch products for the current page
  const fetchProducts = useCallback(
    async (page: number) => {
      if (!userData?.company_id) {
        setProducts([])
        setLastDoc(null)
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        return
      }

      // Check if we have this page in cache (only for non-search)
      if (!searchTerm && pageCache.has(page)) {
        const cachedData = pageCache.get(page)!
        setProducts(cachedData.items)
        setLastDoc(cachedData.lastDoc)
        setLoading(false)
        setLoadingMore(false)
        return
      }

      const isFirstPage = page === 1
      setLoading(isFirstPage)
      setLoadingMore(!isFirstPage)

      try {
        let result: { items: Product[]; lastDoc?: QueryDocumentSnapshot<DocumentData> | null; hasMore?: boolean }

        console.log("🔍 Using Algolia for all product fetching - Search term:", searchTerm || "(no search)")
        try {
          // Use Algolia for all product fetching (search or browse)
          const algoliaPage = page - 1 // Algolia uses 0-based pagination
          const searchResults = await searchProductsWithAlgolia(searchTerm || "", algoliaPage, ITEMS_PER_PAGE)

          console.log("🔍 Algolia results for mapping:", searchResults.hits)

          // Map Algolia results to Product interface
          const products: Product[] = searchResults.hits.map((hit: any) => ({
            id: hit.objectID,
            ...hit,
          } as Product))

          console.log("🔍 Mapped products:", products)

          result = {
            items: products,
            hasMore: searchResults.currentPage < searchResults.totalPages - 1,
          }
        } catch (algoliaError) {
          console.warn("⚠️ Algolia failed, falling back to Firebase:", algoliaError)
          // Fallback to Firebase if Algolia fails
          const startDoc = isFirstPage ? null : lastDoc

          const firebaseResult = await getPaginatedUserProducts(userData?.company_id, ITEMS_PER_PAGE, startDoc, {
            active: true,
            searchTerm: searchTerm || undefined,
            content_type: contentTypeFilter !== "all" ? contentTypeFilter : undefined
          })

          result = firebaseResult

          // Cache this page as fallback
          setPageCache((prev) => {
            const newCache = new Map(prev)
            newCache.set(page, {
              items: firebaseResult.items,
              lastDoc: firebaseResult.lastDoc,
            })
            return newCache
          })
        }

        setProducts(result.items)
        setLastDoc(result.lastDoc || null)
        setHasMore(result.hasMore || false)
      } catch (error) {
        console.error("Error fetching products:", error)
        toast({
          title: "Error",
          description: "Failed to load products. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userData?.company_id, lastDoc, pageCache, toast, searchTerm, contentTypeFilter, searchProductsWithAlgolia],
  )

  // Refetch data when search or filter changes
  const refetchData = useCallback(async () => {
    console.log("🔄 Refetching data - Search term:", searchTerm, "Content type filter:", contentTypeFilter)
    setCurrentPage(1)
    if (!searchTerm) {
      setPageCache(new Map())
    }

    // Only fetch data for sites tab, other tabs show fallback
    if (userData?.company_id && activeTab === "sites") {
      console.log("🔄 Refetching with Algolia - Search term:", searchTerm || "(no search)")
      try {
        // Use Algolia for all data fetching
        const searchResults = await searchProductsWithAlgolia(searchTerm || "", 0, ITEMS_PER_PAGE)

        const products: Product[] = searchResults.hits.map((hit: any) => ({
          id: hit.objectID,
          ...hit,
        } as Product))

        console.log("🔄 Algolia refetch results:", products.length, "products")

        setProducts(products)
        setLastDoc(null)
        setHasMore(searchResults.currentPage < searchResults.totalPages - 1)
        setTotalItems(searchResults.totalHits)
        setTotalPages(Math.max(1, searchResults.totalPages))

        setLoading(false)
        setLoadingMore(false)
        setLoadingCount(false)
      } catch (algoliaError) {
        console.warn("⚠️ Algolia refetch failed, falling back to Firebase:", algoliaError)
        try {
          // Fallback to Firebase
          const contentTypeFilterValue = contentTypeFilter !== "all" ? contentTypeFilter : undefined

          const fetchOptions = {
            active: true,
            searchTerm: searchTerm || undefined,
            content_type: contentTypeFilterValue
          }

          // Fetch first page
          const result = await getPaginatedUserProducts(userData.company_id, ITEMS_PER_PAGE, null, fetchOptions)
          setProducts(result.items)
          setLastDoc(result.lastDoc)
          setHasMore(result.hasMore)

          // Fetch total count
          const count = await getUserProductsCount(userData.company_id, fetchOptions)
          setTotalItems(count)
          setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))

          setLoading(false)
          setLoadingMore(false)
          setLoadingCount(false)
        } catch (firebaseError) {
          console.error("❌ Both Algolia and Firebase failed:", firebaseError)
          toast({
            title: "Error",
            description: "Failed to load products. Please try again.",
            variant: "destructive",
          })
          setLoading(false)
          setLoadingMore(false)
          setLoadingCount(false)
        }
      }
    } else {
      // For non-sites tabs, clear products and set empty state
      setProducts([])
      setTotalItems(0)
      setTotalPages(1)
      setLoading(false)
      setLoadingCount(false)
    }
  }, [searchTerm, contentTypeFilter, activeTab, userData?.company_id, toast, searchProductsWithAlgolia])

  // Test Algolia connection on mount
  useEffect(() => {
    if (userData?.company_id) {
      testAlgoliaConnection()
    }
  }, [userData?.company_id, testAlgoliaConnection])

  // Load initial data and count
  useEffect(() => {
    if (userData?.company_id) {
      refetchData()
    }
  }, [userData?.company_id, refetchData])

  // Load data when page changes
  useEffect(() => {
    if (currentPage > 0) {
      fetchProducts(currentPage)
    }
  }, [currentPage, fetchProducts])

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: "smooth" })

      // If searching with Algolia, fetch the specific page
      if (searchTerm && searchTerm.trim()) {
        fetchProducts(page)
      }
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
    if (!productToDelete?.id) return

    try {
      await softDeleteProduct(productToDelete.id)

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
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete the product. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/admin/products/edit/${product.id}`)
  }

  const handleCreateReport = (productId: string) => {
    if (!productId) return
    setSelectedSiteId(productId)
    setReportDialogOpen(true)
  }

  const handleAddSiteClick = async () => {
    // Check if user has company_id first
    if (!userData?.company_id) {
      setShowCompanyDialog(true)
      return
    }

    // Check if company information is complete
    try {
      const isCompanyComplete = await CompanyService.isCompanyInfoComplete(userData.company_id)
      if (!isCompanyComplete) {
        setShowCompanyUpdateDialog(true)
        return
      }
    } catch (error) {
      console.error("Error checking company completeness:", error)
      setSubscriptionLimitMessage("Error checking company information. Please try again or contact support.")
      setShowSubscriptionLimitDialog(true)
      return
    }

    // Query subscription by company ID
    let currentSubscription = null
    try {
      currentSubscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
    } catch (error) {
      console.error("Error fetching subscription:", error)
      setSubscriptionLimitMessage("Error fetching subscription data. Please try again or contact support.")
      setShowSubscriptionLimitDialog(true)
      return
    }

    // Check if user has license key
    if (!userData?.license_key) {
      setSubscriptionLimitMessage("No active license found. Please choose a subscription plan to get started.")
      setShowSubscriptionLimitDialog(true)
      return
    }

    // Check if subscription exists and is active
    if (!currentSubscription) {
      setSubscriptionLimitMessage("No active subscription found. Please choose a plan to start adding sites.")
      setShowSubscriptionLimitDialog(true)
      return
    }

    if (currentSubscription.status !== "active") {
      setSubscriptionLimitMessage(
        `Your subscription is ${currentSubscription.status}. Please activate your subscription to continue.`,
      )
      setShowSubscriptionLimitDialog(true)
      return
    }

    // Check product limit
    if (totalItems >= currentSubscription.maxProducts) {
      setSubscriptionLimitMessage(
        `You've reached your plan limit of ${currentSubscription.maxProducts} sites. Upgrade your plan to add more sites.`,
      )
      setShowSubscriptionLimitDialog(true)
      return
    }

    router.push("/admin/products/create")
  }

  const handleCompanyRegistrationSuccess = async () => {
    await refreshUserData()
    setShowCompanyDialog(false)

    // Wait a bit for userData to update
    setTimeout(async () => {
      // Query subscription by company ID after company registration
      let currentSubscription = null
      try {
        if (userData?.company_id) {
          currentSubscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
        }
      } catch (error) {
        console.error("Error fetching subscription after company registration:", error)
      }

      // Check subscription after company registration
      if (!userData?.license_key) {
        setSubscriptionLimitMessage(
          "Company registered successfully! Now choose a subscription plan to start adding sites.",
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (!currentSubscription) {
        setSubscriptionLimitMessage(
          "Company registered successfully! Please choose a subscription plan to start adding sites.",
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (currentSubscription.status !== "active") {
        setSubscriptionLimitMessage(
          `Company registered successfully! Your subscription is ${currentSubscription.status}. Please activate it to continue.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (totalItems >= currentSubscription.maxProducts) {
        setSubscriptionLimitMessage(
          `Company registered successfully! You've reached your plan limit of ${currentSubscription.maxProducts} sites. Upgrade your plan to add more sites.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Only redirect if all subscription checks pass
      router.push("/admin/products/create")
    }, 1000) // Wait 1 second for userData to refresh
  }

  const handleCompanyUpdateSuccess = async () => {
    setShowCompanyUpdateDialog(false)

    // Wait a bit for any updates to propagate
    setTimeout(async () => {
      // Continue with the subscription checks after company update
      let currentSubscription = null
      try {
        if (userData?.company_id) {
          currentSubscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
        }
      } catch (error) {
        console.error("Error fetching subscription after company update:", error)
        setSubscriptionLimitMessage("Error fetching subscription data. Please try again or contact support.")
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Check if user has license key
      if (!userData?.license_key) {
        setSubscriptionLimitMessage("No active license found. Please choose a subscription plan to get started.")
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Check if subscription exists and is active
      if (!currentSubscription) {
        setSubscriptionLimitMessage("No active subscription found. Please choose a plan to start adding sites.")
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (currentSubscription.status !== "active") {
        setSubscriptionLimitMessage(
          `Your subscription is ${currentSubscription.status}. Please activate your subscription to continue.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Check product limit
      if (totalItems >= currentSubscription.maxProducts) {
        setSubscriptionLimitMessage(
          `You've reached your plan limit of ${currentSubscription.maxProducts} sites. Upgrade your plan to add more sites.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Only redirect if all checks pass
      router.push("/admin/products/create")
    }, 500) // Wait 0.5 seconds for updates to propagate
  }

  // Show loading only on initial load
  if (loading && products.length === 0 && userData === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }
  
  // Admin Site List Item component matching logistics dashboard design
  function AdminSiteListItem({
    product,
    onCreateReport,
  }: {
    product: Product
    onCreateReport: (productId: string) => void
  }) {
    // Determine status based on active field
    const isActive = product.active === true
    const statusText = isActive ? "Active" : "Inactive"
    const statusColor = isActive ? "#00bf63" : "#ff6b35" // Green for active, red for inactive

    // Get image from product media or use placeholder
    const image =
      product.media && product.media.length > 0
        ? product.media[0].url
        : product.content_type === "dynamic"
          ? "/led-billboard-1.png"
          : "/roadside-billboard.png"

    // Generate a health percentage based on status if not available
    const healthPercentage =
      product.health_percentage ||
      (product.status === "ACTIVE"
        ? Math.floor(Math.random() * 20) + 80
        : Math.floor(Math.random() * 40) + 10)

    // Extract address information
    const address =
      product.specs_rental?.location ||
      product.light?.location ||
      product.location ||
      product.address ||
      "Address not specified"

    const handleCardClick = () => {
      if (product.id) {
        router.push(`/admin/assets/${product.id}`)
      }
    }
  
    return (
      <div className="p-3 bg-gray-200 rounded-xl">
        <Card
          className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white border border-gray-200 rounded-lg w-full"
          onClick={handleCardClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Product Image */}
              <div className="relative w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0">
                <Image
                  src={image}
                  alt={product.name || "Product image"}
                  fill
                  className="object-cover rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = product.content_type === "dynamic" ? "/led-billboard-1.png" : "/roadside-billboard.png"
                    target.className = "opacity-50 object-contain rounded-lg"
                  }}
                />
              </div>
  
              {/* Product Information */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    {product.site_code || product.id?.substring(0, 8) || "N/A"}
                  </div>
                  <div className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                    {product.content_type === "dynamic" ? "M" : "S"}
                  </div>
                </div>
  
                <h3 className="font-semibold text-base leading-none tracking-normal text-gray-900 mb-2 truncate">
                  {product.name || `Site ${product.id?.substring(0, 8)}`}
                </h3>
  

                <div className="mb-2">
                  <span className="font-semibold text-base leading-none tracking-normal text-black">
                    {address}
                  </span>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-semibold text-base leading-none tracking-normal">Status:</span>
                  <span className="ml-1 font-semibold text-base leading-none tracking-normal">
                    {statusText}
                  </span>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-bold">
                    {product.content_type === "dynamic" ? "Display Health:" : "Illumination:"}
                  </span>
                  <span className="ml-1" style={{ color: "#00bf63" }}>
                    {product.content_type === "dynamic"
                      ? (healthPercentage > 90 ? "100%" :
                         healthPercentage > 80 ? "90%" :
                         healthPercentage > 60 ? "75%" : "50%")
                      : "ON" // Illumination status for static
                    }
                  </span>
                </div>
              </div>
  
              {/* View Details Button */}
              <div className="flex-shrink-0">
                <Button
                  variant="secondary"
                  className="h-10 px-6 text-sm border-0 text-white hover:text-white rounded-md font-medium"
                  style={{ backgroundColor: "#0f76ff" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (product.id) {
                      onCreateReport(product.id)
                    }
                  }}
                >
                  Create Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Admin Site Card component matching logistics dashboard design
  function AdminSiteCard({
    product,
    onCreateReport,
  }: {
    product: Product
    onCreateReport: (productId: string) => void
  }) {
    // Determine status based on active field
    const isActive = product.active === true
    const statusText = isActive ? "Occupied" : "Not Occupied"
    const statusColor = isActive ? "#00bf63" : "#ff6b35" // Green for active, red for inactive

    // Get image from product media or use placeholder
    const image =
      product.media && product.media.length > 0
        ? product.media[0].url
        : product.content_type === "dynamic"
          ? "/led-billboard-1.png"
          : "/roadside-billboard.png"

    // Generate a health percentage based on status if not available
    const healthPercentage =
      product.health_percentage ||
      (product.status === "ACTIVE"
        ? Math.floor(Math.random() * 20) + 80
        : Math.floor(Math.random() * 40) + 10)

    // Extract address information
    const address =
      product.specs_rental?.location ||
      product.light?.location ||
      product.location ||
      product.address ||
      "Address not specified"

    const handleCardClick = () => {
      if (product.id) {
        router.push(`/admin/assets/${product.id}`)
      }
    }

    return (
      <div className="p-2 rounded-xl">
        <Card
          className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white border border-gray-200 rounded-xl flex flex-col"
          style={{ width: '276.2px', height: '441px' }}
          onClick={handleCardClick}
        >
          <CardContent className="flex-1 p-2">
            <div className="relative mb-2" style={{ width: '249.34px', height: '232px' }}>
              <Image
                src={image}
                alt={product.name || "Product image"}
                fill
                className="object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = product.content_type === "dynamic" ? "/led-billboard-1.png" : "/roadside-billboard.png"
                  target.className = "opacity-50 object-contain"
                }}
              />

            </div>
            <div className="flex flex-col gap-1">
              {/* Site Code */}
              <div className="font-semibold text-base leading-none tracking-normal" style={{ color: '#A1A1A1' }}>
                {product.site_code || product.id?.substring(0, 8) || "N/A"}
              </div>

              {/* Product Name */}
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base leading-none tracking-normal text-gray-900 mb-1 truncate">{product.name || `Site ${product.id?.substring(0, 8)}`}</h3>
              </div>

              {/* Product Information */}
              <div className="space-y-0.5 text-xs">

                <div className="flex flex-col">
                  <span className="font-semibold text-base leading-none tracking-normal text-black truncate">
                    {address}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-black">
                    <span className="font-semibold text-base leading-none tracking-normal">Status:</span>
                    <span className="ml-1 font-normal text-base leading-none tracking-normal text-black">
                      {statusText}
                    </span>
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-black">
                    <span className="font-semibold text-base leading-none tracking-normal">
                      {product.content_type === "dynamic" ? "Display Health:" : "Illumination:"}
                    </span>
                    <span className="ml-1 font-normal text-base leading-none tracking-normal text-black" style={{ color: "#00bf63" }}>
                      {product.content_type === "dynamic"
                        ? (healthPercentage > 90 ? "100%" :
                           healthPercentage > 80 ? "90%" :
                           healthPercentage > 60 ? "75%" : "50%")
                        : "ON" // Illumination status for static
                      }
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>

          {/* View Details Button */}
          <div className="flex justify-center mt-4">
            <Button
              variant="secondary"
              className="text-xs text-black hover:text-black font-medium"
              style={{
                width: '245.04px',
                height: '37px',
                backgroundColor: "#FFFFFF",
                border: '1px solid #C4C4C4',
                borderRadius: '5px',
                transform: 'translateY(-20px)'
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (product.id) {
                  onCreateReport(product.id)
                }
              }}
            >
              Create Report
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto relative bg-gray-50">
      <main className="p-6">
        <div className="flex flex-col gap-6">
          {/* Header Section */}
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {"Assets"}
            </h1>
          </div>

      {/* Asset Category Tabs */}
      <div className="mb-2">
        <div className="flex space-x-8">
          {[
            { value: "sites", label: "Sites" },
            { value: "properties", label: "Properties" },
            { value: "equipments", label: "Equipments" },
            { value: "vehicles", label: "Vehicles" }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab.value
                  ? "text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.value && (
                <div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 bg-blue-600"
                  style={{
                    width: "60px",
                    height: "0px",
                    borderTop: "4.5px solid #2563eb"
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter Controls - Only show for sites tab */}
      {activeTab === "sites" && (
        <div className="mb-2 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 flex gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => {
                  console.log("🔍 Search input changed:", e.target.value)
                  setSearchTerm(e.target.value)
                }}
                className="pl-10"
                style={{
                  width: "460px",
                  height: "30px",
                  border: "1px solid #C4C4C4"
                }}
              />
            </div>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger style={{ width: "130px", height: "30px" }}>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="static">Static Billboard</SelectItem>
                <SelectItem value="dynamic">Dynamic Billboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setViewMode("card")}
              className={`h-11 w-11 p-0 ${
                viewMode === "card"
                  ? "bg-gray-200 hover:bg-gray-300"
                  : "bg-transparent hover:bg-gray-100"
              }`}
            >
              <Image
                src="/icons/cardview.png"
                alt="Card view"
                width={16}
                height={16}
                className="h-4 w-4 opacity-30"
              />
            </Button>
            <Button
              size="sm"
              onClick={() => setViewMode("list")}
              className={`h-11 w-11 p-0 ${
                viewMode === "list"
                  ? "bg-gray-200 hover:bg-gray-300"
                  : "bg-transparent hover:bg-gray-100"
              }`}
            >
              <Image
                src="/icons/listview.png"
                alt="List view"
                width={16}
                height={16}
                className="h-4 w-4 opacity-30"
              />
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Product List */}
        {activeTab !== "sites" ? (
          /* Fallback for Properties, Equipments, Vehicles */
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">
              {activeTab === "properties" && "Properties Management"}
              {activeTab === "equipments" && "Equipment Management"}
              {activeTab === "vehicles" && "Vehicle Management"}
            </div>
            <div className="text-gray-400 text-sm mb-4">
              This feature is coming soon. Currently displaying site assets only.
            </div>
            <div className="text-xs text-gray-300">
              Switch to the "Sites" tab to view and manage your billboard assets.
            </div>
          </div>
        ) : viewMode === "card" ? (
          <div className="flex flex-wrap gap-4 justify-start">
            {/* Add Site Card */}
            <div className="p-2 bg-gray-100 rounded-xl">
              <Card
                className="flex flex-col items-center justify-center cursor-pointer bg-white rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-200 transition-colors"
                style={{ width: '276.2px', height: '441px' }}
                onClick={handleAddSiteClick}
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="text-lg font-semibold">+ Add Site</span>
              </Card>
            </div>

            {loading && products.length === 0
              ? // Show loading cards only when initially loading
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={`loading-${index}`} className="p-2 bg-gray-100 rounded-xl">
                    <Card className="overflow-hidden bg-white border border-gray-200 rounded-xl">
                      <div className="relative h-32 bg-gray-200 animate-pulse" />
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded animate-pulse" />
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              : products.map((product) => (
                  <AdminSiteCard
                    key={product.id}
                    product={product}
                    onCreateReport={handleCreateReport}
                  />
                ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {/* Add Site Button for List View */}
            <div className="p-3 bg-gray-200 rounded-xl">
              <Card
                className="cursor-pointer bg-white rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={handleAddSiteClick}
              >
                <CardContent className="p-6 flex items-center justify-center">
                  <Plus className="h-6 w-6 mr-3" />
                  <span className="text-lg font-semibold">+ Add Site</span>
                </CardContent>
              </Card>
            </div>

            {loading && products.length === 0 ? (
              // Loading skeleton for list view
              Array.from({ length: 5 }).map((_, index) => (
                <div key={`loading-${index}`} className="p-3 bg-gray-200 rounded-xl">
                  <Card className="bg-white border border-gray-200 rounded-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="relative w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 animate-pulse" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2 mb-1" />
                          <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
                        </div>
                        <div className="flex-shrink-0">
                          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            ) : (
              products.map((product) => (
                <AdminSiteListItem
                  key={product.id}
                  product={product}
                  onCreateReport={handleCreateReport}
                />
              ))
            )}
          </div>
        )}

        {/* Show empty state message when no products and not loading */}
        {!loading && products.length === 0 && userData?.company_id && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">No sites found</div>
            <div className="text-gray-400 text-sm">Click the "Add Site" button above to create your first site.</div>
          </div>
        )}

        {/* Show company setup message when no company_id */}
        {!loading && !userData?.company_id && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-2">Welcome to your assets!</div>
            <div className="text-gray-400 text-sm">
              Click the "Add Site" button above to set up your company and create your first site.
            </div>
          </div>
        )}

        {/* Pagination Controls - Only show for sites tab with products */}
        {activeTab === "sites" && (products.length > 0 || totalPages > 1) && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
            <div className="text-sm text-gray-500 flex items-center">
              {loadingCount ? (
                <div className="flex items-center">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  <span>Calculating pages...</span>
                </div>
              ) : (
                <span>
                  Page {currentPage} of {totalPages} ({products.length} items)
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
      </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        description="This product will be removed from your inventory. This action cannot be undone."
        itemName={productToDelete?.name}
      />

      {/* Subscription Limit Dialog */}
      <Dialog open={showSubscriptionLimitDialog} onOpenChange={setShowSubscriptionLimitDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>🎯 Let's Get You Started!</DialogTitle>
            <DialogDescription>{subscriptionLimitMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => router.push("/admin/subscriptions/choose-plan")}>Choose Plan</Button>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Registration Dialog */}
      <CompanyRegistrationDialog
        isOpen={showCompanyDialog}
        onClose={() => setShowCompanyDialog(false)}
        onSuccess={handleCompanyRegistrationSuccess}
      />

      {/* Company Update Dialog */}
      <CompanyUpdateDialog
        isOpen={showCompanyUpdateDialog}
        onClose={() => setShowCompanyUpdateDialog(false)}
        onSuccess={handleCompanyUpdateSuccess}
      />

      {/* Create Report Dialog */}
      <CreateReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        siteId={selectedSiteId}
        module="admin"
      />
      </main>
    </div>
  )
}