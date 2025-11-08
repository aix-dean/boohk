"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  List,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Grid3X3,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  getPaginatedUserProductsRealtime,
  getUserProductsCount,
  type Product,
  type Booking,
} from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { collection, query, where, getDocs, getDoc, doc, Timestamp, addDoc, updateDoc, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useResponsive } from "@/hooks/use-responsive"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import { RouteProtection } from "@/components/route-protection"
import { Input } from "@/components/ui/input"
import { searchPriceListingProducts, SearchResult } from "@/lib/algolia-service"
import { useDebounce } from "@/hooks/use-debounce"

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

function PriceListingContent() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsWithBookings, setProductsWithBookings] = useState<Record<string, boolean>>({})
  const { isMobile, isTablet } = useResponsive()

  // Search states
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const pageCacheRef = useRef<
    Map<number, { items: Product[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }>
  >(new Map())
  const [loadingCount, setLoadingCount] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [selectedProductForUpdate, setSelectedProductForUpdate] = useState<Product | null>(null)
  const [newPrice, setNewPrice] = useState("")
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false)
  const [currentUnsubscribe, setCurrentUnsubscribe] = useState<(() => void) | null>(null)
  const [priceUpdaters, setPriceUpdaters] = useState<Record<string, string>>({})
  const [priceHistories, setPriceHistories] = useState<Record<string, any[]>>({})
  const [loadingPriceHistories, setLoadingPriceHistories] = useState<Set<string>>(new Set())
  const [priceHistoryUnsubscribers, setPriceHistoryUnsubscribers] = useState<Record<string, () => void>>({})

  const { user, userData } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // On mobile, default to grid view
  useEffect(() => {
    if (isMobile) {
      setViewMode("grid")
    }
  }, [isMobile])

  // Handle search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSearchResults([])
        setIsSearching(false)
        setSearchLoading(false)
        return
      }

      setSearchLoading(true)
      try {
        console.log(`Performing price listing search for: "${debouncedSearchTerm}"`)
        const result = await searchPriceListingProducts(debouncedSearchTerm, userData?.company_id || undefined)

        if (result.error) {
          console.error("Search error:", result.error)
          setSearchResults([])
        } else {
          setSearchResults(result.hits)
          setIsSearching(true)
        }
      } catch (error) {
        console.error("Error performing search:", error)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }

    performSearch()
  }, [debouncedSearchTerm, userData?.company_id])

  // Check for ongoing bookings
  const checkOngoingBookings = useCallback(
    async (productIds: string[]) => {
      if (!productIds.length) return

      // Loading bookings
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
        // Finished loading bookings
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
      })
    } finally {
      setLoadingCount(false)
    }
  }, [userData, toast])

  // Fetch price updaters
  const fetchPriceUpdaters = useCallback(async () => {
    if (!userData?.company_id) return

    try {
      const q = query(collection(db, "price_list"), where("company_id", "==", userData.company_id), orderBy("created", "desc"))
      const snapshot = await getDocs(q)
      const updaters: Record<string, string> = {}
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        if (!updaters[data.product_id]) {
          updaters[data.product_id] = data.name
        }
      })
      setPriceUpdaters(updaters)
      console.log(`Fetched price updaters for ${Object.keys(updaters).length} products`)
    } catch (error) {
      console.error("Error fetching price updaters:", error)
    }
  }, [userData?.company_id])

  // Setup real-time price history listener for a product
  const setupPriceHistoryListener = useCallback((productId: string) => {
    if (!userData?.company_id) return

    setLoadingPriceHistories(prev => new Set(prev).add(productId))

    const q = query(collection(db, "price_list"), where("product_id", "==", productId), where("company_id", "==", userData.company_id), orderBy("created", "desc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const histories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        // Exclude the latest (current) price from history
        const filteredHistories = histories.slice(1)
        setPriceHistories(prev => ({ ...prev, [productId]: filteredHistories }))
        setLoadingPriceHistories(prev => {
          const newSet = new Set(prev)
          newSet.delete(productId)
          return newSet
        })
      } catch (error) {
        console.error("Error processing price history snapshot:", error)
        setLoadingPriceHistories(prev => {
          const newSet = new Set(prev)
          newSet.delete(productId)
          return newSet
        })
      }
    }, (error) => {
      console.error("Error in price history listener:", error)
      setLoadingPriceHistories(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    })

    setPriceHistoryUnsubscribers(prev => ({ ...prev, [productId]: unsubscribe }))
  }, [userData?.company_id])

  // Fetch products for the current page
  const fetchProducts = useCallback(
    (page: number) => {
      if (!userData?.company_id) return

      // Check if we have this page in cache
      if (pageCacheRef.current.has(page)) {
        const cachedData = pageCacheRef.current.get(page)!
        setProducts(cachedData.items)
        setLastDoc(cachedData.lastDoc)

        // Check for ongoing bookings for the cached products
        const productIds = cachedData.items.map((product) => product.id).filter((id): id is string => id !== undefined) as string[];
        checkOngoingBookings(productIds)

        return
      }

      const isFirstPage = page === 1
      setLoading(isFirstPage)

      // Unsubscribe previous listener
      if (currentUnsubscribe) {
        currentUnsubscribe()
      }

      // For the first page, start from the beginning
      // For subsequent pages, use the last document from the previous page
      const startDoc = isFirstPage ? null : lastDoc

      const unsubscribe = getPaginatedUserProductsRealtime(userData?.company_id, ITEMS_PER_PAGE, startDoc, { active: true }, (result) => {
        setProducts(result.items)
        setLastDoc(result.lastDoc)

        // Check for ongoing bookings
        const productIds = result.items.map((product) => product.id).filter((id): id is string => id !== undefined) as string[];
        checkOngoingBookings(productIds)

        // Cache this page
        pageCacheRef.current.set(page, {
          items: result.items,
          lastDoc: result.lastDoc,
        })

        setLoading(false)
      })

      setCurrentUnsubscribe(() => unsubscribe)
    },
    [userData, lastDoc, checkOngoingBookings, currentUnsubscribe],
  )

  // Load initial data and count
  useEffect(() => {
    if (userData?.company_id) {
      fetchProducts(1)
      fetchTotalCount()
      fetchPriceUpdaters()
    }
  }, [userData?.company_id, fetchProducts, fetchTotalCount, fetchPriceUpdaters])

  // Cleanup unsubscribe on unmount
  useEffect(() => {
    return () => {
      if (currentUnsubscribe) {
        currentUnsubscribe()
      }
      // Cleanup all price history listeners
      Object.values(priceHistoryUnsubscribers).forEach(unsubscribe => unsubscribe())
    }
  }, [currentUnsubscribe, priceHistoryUnsubscribers])

  // Load data when page changes
  useEffect(() => {
    if (userData?.company_id && currentPage > 0) {
      fetchProducts(currentPage)
    }
  }, [currentPage, fetchProducts, userData?.company_id])

  // Real-time listener for product updates
  useEffect(() => {
    if (!userData?.company_id) return

    const productsQuery = query(
      collection(db, "products"),
      where("company_id", "==", userData.company_id),
      where("active", "==", true)
    )

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const data = change.doc.data()
          const updatedProduct: Product = {
            id: change.doc.id,
            ...data,
            updated: data.updated instanceof Timestamp ? data.updated.toDate() : data.updated,
          } as Product

          setProducts(prevProducts =>
            prevProducts.map(product =>
              product.id === updatedProduct.id ? updatedProduct : product
            )
          )
        }
      })
    })

    return unsubscribe
  }, [userData?.company_id])

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

  // Handle view details click
  const handleViewDetails = (productId: string) => {
    router.push(`/sales/products/${productId}`)
  }

  // Toggle row expansion for history
  const toggleRowExpansion = (productId: string) => {
    if (!productId) return // Don't allow expanding products without ID

    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        // Collapsing: unsubscribe the listener
        newSet.delete(productId)
        const unsubscribe = priceHistoryUnsubscribers[productId]
        if (unsubscribe) {
          unsubscribe()
          setPriceHistoryUnsubscribers(prev => {
            const newUnsubscribers = { ...prev }
            delete newUnsubscribers[productId]
            return newUnsubscribers
          })
        }
      } else {
        // Expanding: set up listener if not already set up
        newSet.add(productId)
        if (!priceHistoryUnsubscribers[productId]) {
          setupPriceHistoryListener(productId)
        }
      }
      return newSet
    })
  }

  // Handle opening update dialog
  const handleOpenUpdateDialog = (product: Product) => {
    // Normalize product data to ensure id is available (handle search results with objectID)
    const normalizedProduct = {
      ...product,
      id: product.id || (product as any).objectID
    }
    setSelectedProductForUpdate(normalizedProduct)
    setNewPrice(product.price ? product.price.toString() : "")
    setUpdateDialogOpen(true)
  }

  // Handle closing update dialog
  const handleCloseUpdateDialog = () => {
    setUpdateDialogOpen(false)
    setSelectedProductForUpdate(null)
    setNewPrice("")
  }

  // Handle price update
  const handleUpdatePrice = async () => {
    if (!selectedProductForUpdate || !newPrice.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid price.",
        variant: "destructive",
      })
      return
    }

    const priceValue = parseFloat(newPrice)
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive price.",
        variant: "destructive",
      })
      return
    }

    setIsUpdatingPrice(true)

    try {
      const priceListRef = collection(db, "price_list")

      // Check if this product has any existing price history
      const existingHistoryQuery = query(priceListRef, where("product_id", "==", selectedProductForUpdate.id), where("company_id", "==", userData?.company_id))
      const existingHistorySnapshot = await getDocs(existingHistoryQuery)

      // If no existing history, create an initial entry with the current price
      if (existingHistorySnapshot.empty && selectedProductForUpdate.price) {
        await addDoc(priceListRef, {
          product_id: selectedProductForUpdate.id,
          company_id: userData?.company_id,
          updated_by: user?.uid,
          name: userData?.seller_name || `${userData?.first_name} ${userData?.last_name}`,
          created: selectedProductForUpdate.created instanceof Timestamp ? selectedProductForUpdate.created : Timestamp.fromDate(new Date(selectedProductForUpdate.created)),
          price: selectedProductForUpdate.price,
        })
      }

      // 1. Create document in price_list collection for the new price
      await addDoc(priceListRef, {
        product_id: selectedProductForUpdate.id,
        company_id: userData?.company_id,
        updated_by: user?.uid,
        name: userData?.seller_name || `${userData?.first_name} ${userData?.last_name}`,
        created: Timestamp.now(),
        price: priceValue,
      })

      // 2. Update the product document
      const productRef = doc(db, "products", selectedProductForUpdate.id!)
      await updateDoc(productRef, {
        price: priceValue,
        updated: Timestamp.now(),
      })

      toast({
        title: "Price Updated",
        description: `Price for ${selectedProductForUpdate.name} has been updated to ₱${priceValue.toLocaleString()}.`,
      })

      // Update search results in real-time if this was from search
      if (isSearching) {
        setSearchResults(prevResults =>
          prevResults.map(result =>
            ((result as any).id || (result as any).objectID) === selectedProductForUpdate.id
              ? { ...result, price: priceValue, updated: Timestamp.now() }
              : result
          )
        )
      }

      // Refresh price updaters
      fetchPriceUpdaters()

      // Close the dialog
      handleCloseUpdateDialog()
    } catch (error) {
      console.error("Error updating price:", error)
      toast({
        title: "Error",
        description: "Failed to update price. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingPrice(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
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
          // Actual Content
          <div className="grid grid-cols-1 gap-6 h-full">
            {/* Left Column: Main Content */}
            <div className="flex flex-col gap-1 md:gap-2 h-full overflow-hidden">
              {/* Header with title and view toggle */}
              <div className="bg-white rounded-lg border border-[#e0e0e0] mb-6 sticky top-0 z-10">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#e0e0e0]">
                  <h2 className="text-xl font-semibold text-[#000000]">Price Listing</h2>
                </div>

                {/* Search and Controls */}
                <div className="px-6 py-4 border-b border-[#e0e0e0] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#a1a1a1] w-4 h-4" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-80 bg-[#fafafa] border-[#e0e0e0]"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a1a1a1] hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#a1a1a1]"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#a1a1a1]"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Search Loading State - Show only content area loading */}
              {searchLoading ? (
                <div className="flex-1">
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5 mt-4">
                      {Array(10)
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
                  ) : (
                    <div className="bg-white border border-[#e0e0e0] rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Site</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Price</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">By</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array(8).fill(0).map((_, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <Skeleton className="h-12 w-12 rounded-md" />
                                  <div>
                                    <Skeleton className="h-4 w-32 mb-1" />
                                    <Skeleton className="h-3 w-24" />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <Skeleton className="h-4 w-24" />
                              </td>
                              <td className="px-6 py-4">
                                <Skeleton className="h-4 w-20" />
                              </td>
                              <td className="px-6 py-4">
                                <Skeleton className="h-4 w-16" />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Skeleton className="h-8 w-16 ml-auto" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Regular Content - Only show when not searching */}
                {/* Empty state */}
                {!loading && !searchLoading && (isSearching ? searchResults.length === 0 : products.length === 0) && (
                  <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed">
                    <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <MapPin size={24} className="text-gray-400" />
                    </div>
                    <h3 className="text-base md:text-lg font-medium mb-2">
                      {isSearching ? "No products found" : "No products yet"}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {isSearching ? "Try adjusting your search terms" : "Contact an administrator to add products"}
                    </p>
                  </div>
                )}

                {/* Grid View */}
                {!loading && !searchLoading && (isSearching ? searchResults.length > 0 : products.length > 0) && viewMode === "grid" && (
                  <div className="flex-1 overflow-y-auto">
                    <ResponsiveCardGrid
                      mobileColumns={1}
                      tabletColumns={2}
                      desktopColumns={5}
                      gap="sm"
                    >
                      {(isSearching ? searchResults : products).map((item) => {
                        const itemId = (item as any).id || (item as any).objectID || ""
                        return (
                          <ProductCard
                            key={itemId}
                            product={item as any}
                            hasOngoingBooking={productsWithBookings[itemId] || false}
                            onView={() => handleViewDetails(itemId)}
                            isSearchResult={isSearching}
                          />
                        )
                      })}
                    </ResponsiveCardGrid>
                  </div>
                )}

                {/* List View */}
                {!loading && !searchLoading && (isSearching ? searchResults.length > 0 : products.length > 0) && viewMode === "list" && (
                  <>
                    {/* Header */}
                    <div className="bg-[#fafafa] border border-[#e0e0e0] rounded-lg p-4">
                      <div className="grid grid-cols-5 gap-4 text-sm font-medium text-[#000000]">
                        <div>Site</div>
                        <div>Price</div>
                        <div>Date</div>
                        <div>By</div>
                        <div>Actions</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                    {(isSearching ? searchResults : products).map((item) => {
                      const product = item as any
                      const productId = product.id || product.objectID || ""
                      const isExpanded = expandedRows.has(productId)
                      return (
                        <React.Fragment key={productId}>
                          <div className="border border-[#e0e0e0] rounded-lg overflow-hidden" style={{ backgroundColor: '#b8d9ff54' }}>
                            <table className="w-full table-fixed">
                              <tbody>
                                <tr className="bg-transparent">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-[#efefef] rounded-md flex items-center justify-center">
                                        {product.media && product.media.length > 0 ? (
                                          <Image
                                            src={product.media[0].url || "/placeholder.svg"}
                                            alt={product.name || "Product image"}
                                            width={48}
                                            height={48}
                                            priority
                                            className={`w-12 h-12 object-cover rounded-md ${productsWithBookings[product.id || ""] ? "grayscale" : ""}`}
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement
                                              target.src = "/abstract-geometric-sculpture.png"
                                              target.className = "opacity-50"
                                            }}
                                          />
                                        ) : (
                                          <div className="text-xs text-[#a1a1a1] text-center">
                                            <div>Site</div>
                                            <div>Photo</div>
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-sm text-[#a1a1a1]">{getSiteCode(product) || "N/A"}</div>
                                        <div className="text-sm font-medium text-[#000000]">{product.name}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium text-[#000000]">
                                    {product.price ? `₱${Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month` : "Not set"}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-[#000000]">
                                    As of {product.updated instanceof Timestamp
                                      ? new Date(product.updated.seconds * 1000).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric" })
                                      : product.updated instanceof Date
                                        ? product.updated.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric" })
                                      : product.updated
                                        ? new Date(product.updated).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric" })
                                      : "N/A"}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-[#000000]">
                                    {(productId && priceUpdaters[productId]) || "System"}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center justify-between">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-[#000000] border-[#e0e0e0] hover:bg-[#f6f9ff] bg-white"
                                        onClick={() => handleOpenUpdateDialog(product)}
                                      >
                                        Update
                                      </Button>
                                      <button
                                        onClick={() => toggleRowExpansion(productId)}
                                        className="p-1 hover:bg-[#f6f9ff] rounded transition-colors ml-auto"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-4 h-4 text-[#a1a1a1]" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4 text-[#a1a1a1]" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          {isExpanded && (
                            <div className="bg-gray-50 rounded-lg overflow-hidden shadow-lg border border-gray-200" style={{ position: 'relative', zIndex: 20 }}>
                              <div className="max-h-40 overflow-y-auto">
                                {loadingPriceHistories.has(productId) ? (
                                  <div className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Loader2 size={14} className="animate-spin mr-2" />
                                      <span>Loading price history...</span>
                                    </div>
                                  </div>
                                ) : priceHistories[productId] && priceHistories[productId].length > 0 ? (
                                  <table className="w-full">
                                    <tbody >
                                      {priceHistories[productId].map((history, index) => (
                                        <tr key={`history-${history.id || index}`} className="border-b border-gray-200 last:border-0">
                                          <td className="px-6 py-2 w-[20%]"></td>
                                          <td className="px-6 py-2 text-sm font-medium text-[#000000] w-[20%]">
                                            ₱{Number(history.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </td>
                                          <td className="px-6 py-2 text-sm text-[#000000] w-[20%]">
                                            {history.created instanceof Timestamp
                                              ? new Date(history.created.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                              : history.created
                                                ? new Date(history.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                              : "N/A"}
                                          </td>
                                          <td className="px-6 py-2 text-sm text-[#000000] w-[20%]">
                                            {history.name || "System"}
                                          </td>
                                          <td className="px-6 py-2 w-[20%]"></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="text-center text-gray-500">
                                    No price history available
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      )
                    })}
                    </div>
                  </>
                )}


                {/* Pagination Controls */}
                {!loading && !isSearching && products.length > 0 && (
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
              </>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Update Price Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Product Price</DialogTitle>
            <DialogDescription>
              Update the price for this product. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>

          {selectedProductForUpdate && (
            <div className="space-y-4">
              {/* Site Details */}
              <div className="bg-[#f6f9ff] p-4 rounded-lg">
                <h4 className="font-semibold text-[#000000] mb-3">Site Details</h4>
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-[#efefef] rounded-lg overflow-hidden flex items-center justify-center">
                      {selectedProductForUpdate.media && selectedProductForUpdate.media.length > 0 ? (
                        <Image
                          src={selectedProductForUpdate.media[0].url || "/placeholder.svg"}
                          alt={selectedProductForUpdate.name || "Product image"}
                          width={80}
                          height={80}
                          priority
                          className="object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/abstract-geometric-sculpture.png"
                            target.className = "opacity-50"
                          }}
                        />
                      ) : (
                        <div className="text-xs text-[#a1a1a1] text-center p-2">
                          <div>No</div>
                          <div>Image</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Site Information */}
                  <div className="flex-1 space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-[#a1a1a1]">Site Code:</span>{" "}
                      <span className="text-[#000000]">{getSiteCode(selectedProductForUpdate) || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-[#a1a1a1]">Site Name:</span>{" "}
                      <span className="text-[#000000]">{selectedProductForUpdate.name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-[#a1a1a1]">Location:</span>{" "}
                      <span className="text-[#000000]">
                        {selectedProductForUpdate.specs_rental?.location ||
                          (selectedProductForUpdate as any).light?.location ||
                          "Unknown location"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-[#a1a1a1]">Current Price:</span>{" "}
                      <span className="text-[#000000]">
                        {selectedProductForUpdate.price
                          ? `₱${Number(selectedProductForUpdate.price).toLocaleString()}`
                          : "Not set"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-medium">
                  New Price (₱)
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="Enter new price"
                  value={newPrice}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and one decimal point with up to 2 decimal places
                    const regex = /^\d*\.?\d{0,2}$/;
                    if (regex.test(value) || value === "") {
                      setNewPrice(value);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value && !isNaN(Number.parseFloat(value))) {
                      const parsed = Number.parseFloat(value);
                      setNewPrice(parsed.toFixed(2));
                    }
                  }}
                  className="w-full"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseUpdateDialog} disabled={isUpdatingPrice}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePrice}
              disabled={isUpdatingPrice}
              className="bg-[#ff3131] hover:bg-[#e02828]"
            >
              {isUpdatingPrice ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Price"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PriceListingPage() {
  const { user, userData } = useAuth()

  return (
    <RouteProtection requiredRoles="sales">
      <div className="h-screen overflow-hidden">
        <PriceListingContent />
      </div>
    </RouteProtection>
  )
}

// Product Card Component for Grid View
function ProductCard({
  product,
  hasOngoingBooking,
  onView,
  isSearchResult = false,
}: {
  product: Product | SearchResult
  hasOngoingBooking: boolean
  onView: () => void
  isSearchResult?: boolean
}) {
  if (!product) {
    return (
      <Card className="overflow-hidden border shadow-sm rounded-2xl bg-gray-50">
        <div className="relative h-48 bg-gray-100 p-3">
          <div className="relative h-full w-full rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center">
            <div className="text-gray-400 text-sm">No data available</div>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex flex-col gap-2 flex-1">
            <div className="text-base font-bold text-gray-400">N/A</div>
            <h3 className="text-sm text-gray-400">Record not available</h3>
            <div className="text-sm font-semibold text-gray-400 mt-1">Price not available</div>
          </div>
        </CardContent>
      </Card>
    )
  }

console.log('Rendering ProductCard for:', product);
  // Get the first media item for the thumbnail
  const thumbnailUrl = isSearchResult
    ? (product as Product).media![0].url || "/abstract-geometric-sculpture.png"
    : (product as Product).media && (product as Product).media!.length > 0 ? (product as Product).media![0].url : "/abstract-geometric-sculpture.png"
  // Determine location based on product type
  const location = isSearchResult
    ? (product as Product).specs_rental?.location || (product as any).light?.location || "Unknown location"
    : (product as Product).specs_rental?.location || (product as any).light?.location || "Unknown location"

  const formattedPrice = isSearchResult
    ? (product as SearchResult).price
      ? `₱${Number((product as SearchResult).price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month`
      : "Price not set"
    : (product as Product).price
      ? `₱${Number((product as Product).price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month`
      : "Price not set"

  // Get site code
  const siteCode = isSearchResult
    ? (product as SearchResult).site_code || "N/A"
    : getSiteCode(product as Product)

  const getStatusInfo = () => {
    const status = isSearchResult ? "ACTIVE" : (product as Product).status
    if (status === "ACTIVE" || status === "OCCUPIED") {
      return { label: "OPEN", color: "#38b6ff" }
    }
    if (status === "VACANT" || status === "AVAILABLE") {
      return { label: "AVAILABLE", color: "#00bf63" }
    }
    if (status === "MAINTENANCE" || status === "REPAIR") {
      return { label: "MAINTENANCE", color: "#ef4444" }
    }
    return { label: "OPEN", color: "#38b6ff" }
  }

  const statusInfo = getStatusInfo()

  const isDynamic = isSearchResult ? false : (product as Product).content_type?.toLowerCase() === "dynamic"

  return (
    <div className={`${isDynamic ? 'dynamic-border-wrapper' : ''}`}>
      {isDynamic && (
        <style>{`
@property --a {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes spin {
  to { --a: 1turn; }
}

.dynamic-border-wrapper {
  --border-size: 0.125rem;   /* 🔥 thinner rainbow border */
  --radius: 1rem;

  position: relative;
  display: inline-block;
  border-radius: var(--radius);
  padding: var(--border-size);
  background: 
    linear-gradient(#000 0 0) content-box,
    conic-gradient(in hsl longer hue from var(--a),
      rgba(255, 0, 0, 0.7) 0 100%);
  animation: spin 10s infinite linear;
}

.dynamic-border-wrapper > * {
  border-radius: calc(var(--radius) - var(--border-size));
  background: white;
  position: relative;
  z-index: 1;
}
        `}</style>
      )}
      <Card
        className="overflow-hidden border shadow-sm rounded-2xl bg-white flex flex-col h-[420px]"
      >
        <div className="relative h-64 p-3">
          <div className="relative h-full w-full rounded-xl overflow-hidden">
            <Image
              src={thumbnailUrl || "/placeholder.svg"}
              alt={product.name || "Product image"}
              fill
              priority
              className={`object-cover ${hasOngoingBooking ? "grayscale" : ""}`}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = "/abstract-geometric-sculpture.png"
                target.className = `opacity-50 object-contain ${hasOngoingBooking ? "grayscale" : ""}`
              }}
            />

            {/* Status Badge - Bottom Left */}
            <div className="absolute bottom-3 left-3">
              <div
                className="px-3 py-1 rounded-md text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: statusInfo.color }}
              >
                {statusInfo.label}
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-4 flex-1 flex flex-col h-full">
          <div className="flex flex-col gap-2 flex-1">
            {/* Site Code - Gray text */}
            <div
              className="font-medium truncate"
              style={{
                color: "#737373",
                fontSize: "13.6px",
                lineHeight: "1.2",
              }}
            >
              {siteCode || "N/A"}
            </div>

            {/* Product Name - Black text, larger font and bold */}
            <h3
              className="font-bold truncate"
              style={{
                color: "#000000",
                fontSize: "15.2px",
                lineHeight: "1.3",
              }}
            >
              {product.name || "No name available"}
            </h3>

            {/* Location */}
            <div
              className="font-medium truncate"
              style={{
                color: "#737373",
                fontSize: "13.6px",
                lineHeight: "1.2",
              }}
            >
              {location}
            </div>

            {/* Price - More prominent */}
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {product.price ? `₱${Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month` : "Price not set"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
