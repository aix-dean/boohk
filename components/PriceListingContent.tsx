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
import { Input } from "@/components/ui/input"
import { PriceHistoryDialog } from "@/components/price-history-dialog"
import { searchPriceListingProducts, SearchResult } from "@/lib/algolia-service"
import { useDebounce } from "@/hooks/use-debounce"

// Number of items to display per page
const ITEMS_PER_PAGE = 10

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


export default function PriceListingContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsWithBookings, setProductsWithBookings] = useState<Record<string, boolean>>({})
  const { isMobile, isTablet } = useResponsive()

  // Search states
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [fullSearchResults, setFullSearchResults] = useState<Product[]>([])
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
  const [rowDialogOpen, setRowDialogOpen] = useState(false)
  const [selectedRowProduct, setSelectedRowProduct] = useState<Product | null>(null)
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [newPriceInput, setNewPriceInput] = useState("")
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [newPriceInDialog, setNewPriceInDialog] = useState("")
  const [isUpdatingPriceInDialog, setIsUpdatingPriceInDialog] = useState(false)

  const { user, userData } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Handle search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSearchResults([])
        setFullSearchResults([])
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
          setFullSearchResults([])
        } else {
          setSearchResults(result.hits)
          setIsSearching(true)

          // Fetch full product data for search results
          if (result.hits.length > 0) {
            const productIds = result.hits.map((hit: any) => hit.objectID || hit.id).filter((id: string) => id)
            const fullProducts: Product[] = []
            for (const id of productIds) {
              try {
                const docSnap = await getDoc(doc(db, "products", id))
                if (docSnap.exists()) {
                  fullProducts.push({ id: docSnap.id, ...docSnap.data() } as Product)
                }
              } catch (error) {
                console.error("Error fetching product:", id, error)
              }
            }
            setFullSearchResults(fullProducts)
          } else {
            setFullSearchResults([])
          }
        }
      } catch (error) {
        console.error("Error performing search:", error)
        setSearchResults([])
        setFullSearchResults([])
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

  // Setup price history listener when dialog opens
  useEffect(() => {
    if (rowDialogOpen && selectedRowProduct?.id && !priceHistoryUnsubscribers[selectedRowProduct.id]) {
      setupPriceHistoryListener(selectedRowProduct.id)
    }
  }, [rowDialogOpen, selectedRowProduct?.id, setupPriceHistoryListener, priceHistoryUnsubscribers])

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
    setNewPrice(product.price ? Number(product.price).toLocaleString() : "")
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

    const priceValue = parseInt(newPrice.replace(/,/g, ''))
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
          name: `${userData?.first_name} ${userData?.last_name}`,
          created: selectedProductForUpdate.created instanceof Timestamp ? selectedProductForUpdate.created : Timestamp.fromDate(new Date(selectedProductForUpdate.created)),
          price: selectedProductForUpdate.price,
        })
      }

      // 1. Create document in price_list collection for the new price
      await addDoc(priceListRef, {
        product_id: selectedProductForUpdate.id,
        company_id: userData?.company_id,
        updated_by: user?.uid,
        name: `${userData?.first_name} ${userData?.last_name}`,
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
        setFullSearchResults(prevResults =>
          prevResults.map(result =>
            result.id === selectedProductForUpdate.id
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
  // Handle price update in dialog
  const handleUpdatePriceInDialog = async () => {
    if (!selectedRowProduct || !newPriceInDialog.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid price.",
        variant: "destructive",
      })
      return
    }

    const priceValue = parseInt(newPriceInDialog.replace(/,/g, ''))
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive price.",
        variant: "destructive",
      })
      return
    }

    setIsUpdatingPriceInDialog(true)

    try {
      const priceListRef = collection(db, "price_list")

      // Check if this product has any existing price history
      const existingHistoryQuery = query(priceListRef, where("product_id", "==", selectedRowProduct.id), where("company_id", "==", userData?.company_id))
      const existingHistorySnapshot = await getDocs(existingHistoryQuery)

      // If no existing history, create an initial entry with the current price
      if (existingHistorySnapshot.empty && selectedRowProduct.price) {
        await addDoc(priceListRef, {
          product_id: selectedRowProduct.id,
          company_id: userData?.company_id,
          updated_by: user?.uid,
          name: `${userData?.first_name} ${userData?.last_name}`,
          created: selectedRowProduct.created instanceof Timestamp ? selectedRowProduct.created : Timestamp.fromDate(new Date(selectedRowProduct.created)),
          price: selectedRowProduct.price,
        })
      }

      // 1. Create document in price_list collection for the new price
      await addDoc(priceListRef, {
        product_id: selectedRowProduct.id,
        company_id: userData?.company_id,
        updated_by: user?.uid,
        name: `${userData?.first_name} ${userData?.last_name}`,
        created: Timestamp.now(),
        price: priceValue,
      })

      // 2. Update the product document
      const productRef = doc(db, "products", selectedRowProduct.id!)
      await updateDoc(productRef, {
        price: priceValue,
        updated: Timestamp.now(),
      })

      toast({
        title: "Price Updated",
        description: `Price for ${selectedRowProduct.name} has been updated to ₱${priceValue.toLocaleString()}.`,
      })

      // Update search results in real-time if this was from search
      if (isSearching) {
        setFullSearchResults(prevResults =>
          prevResults.map(result =>
            result.id === selectedRowProduct.id
              ? { ...result, price: priceValue, updated: Timestamp.now() }
              : result
          )
        )
      }

      // Refresh price updaters
      fetchPriceUpdaters()

      // Close the dialog and reset form
      setRowDialogOpen(false)
      setShowUpdateForm(false)
      setNewPriceInDialog("")
    } catch (error) {
      console.error("Error updating price:", error)
      toast({
        title: "Error",
        description: "Failed to update price. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingPriceInDialog(false)
    }
  }

  return (
    <div className="h-full pb-4 overflow-hidden flex flex-col">
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
            <div className="flex flex-col gap-1 md:gap-2 h-full overflow-y-auto">
              {/* Header with title and view toggle */}
              <div className="rounded-lg mb-6 ">
                {/* Header */}
                <div className="py-4">
                  <h2 className="text-xl font-semibold text-[#000000]">Price Listing</h2>
                </div>

                {/* Search and Controls */}
                <div className="flex items-center gap-3">
                  <label htmlFor="">
                    Search:
                  </label>
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
                </div>
              </div>

              {/* Search Loading State - Show only content area loading */}
              {searchLoading ? (
                <div className="flex-1">
                  <div className="border-b border-[#e0e0e0]">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Site</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Price</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">By</th>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  {/* Regular Content - Only show when not searching */}
                  {/* Empty state */}
                  {!loading && !searchLoading && (isSearching ? fullSearchResults.length === 0 : products.length === 0) && (
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

                  {/* List View */}
                  {!loading && !searchLoading && (isSearching ? searchResults.length > 0 : products.length > 0) && (
                    <>
                      {/* Header */}
                      <div className="border-b border-[#e0e0e0] p-2 mb-2">
                        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-[#000000]">
                          <div className="pl-4">Site</div>
                          <div className="pl-4">Price</div>
                          <div className="pl-4">Date</div>
                          <div className="pl-4">By</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                      {(isSearching ? fullSearchResults : products).map((item) => {
                        const product = item as any
                        const productId = product.id || product.objectID || ""
                        const isExpanded = expandedRows.has(productId)
                        return (
                          <React.Fragment key={productId}>
                            <div className="border border-[#e0e0e0] rounded-lg h-[60px] overflow-hidden cursor-pointer" style={{ backgroundColor: '#b8d9ff54' }} onClick={() => { setSelectedRowProduct(product); setShowUpdateForm(false); setNewPriceInDialog(product.price ? product.price.toString() : ""); setRowDialogOpen(true); }}>
                              <table className="w-full table-fixed">
                                <tbody>
                                  <tr className="bg-transparent">
                                    <td className="px-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-[35px] h-[35px] bg-[#efefef] rounded-md flex items-center justify-center">
                                          {product.media && product.media.length > 0 ? (
                                            <Image
                                              src={product.media[0].url || "/placeholder.svg"}
                                              alt={product.name || "Product image"}
                                              width={32}
                                              height={32}
                                              priority
                                              className={`w-[35px] h-[35px] object-cover rounded-md ${productsWithBookings[product.id || ""] ? "grayscale" : ""}`}
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement
                                                target.src = "/abstract-geometric-sculpture.png"
                                                target.className = "opacity-50"
                                              }}
                                            />
                                          ) : (
                                            <div className="text-[10px] text-[#a1a1a1] text-center">
                                              <div>Site</div>
                                              <div>Photo</div>
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-[#000000]">{product.name}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-[#000000]">
                                      {product.price ? `₱${Number(product.price).toLocaleString()}/month` : "Not set"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[#000000]">
                                      {product.updated instanceof Timestamp
                                        ? new Date(product.updated.seconds * 1000).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric" })
                                        : product.updated instanceof Date
                                          ? product.updated.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric" })
                                        : product.updated
                                          ? new Date(product.updated).toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric" })
                                        : "N/A"}
                                    </td>
                                    <td className="pl-6 py-4 text-sm text-[#000000] truncate pr-10">
                                      {(productId && priceUpdaters[productId]) || `${userData?.first_name} ${userData?.last_name}` || "System"}
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
                                              ₱{Number(history.price).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-2 text-sm text-[#000000] w-[20%]">
                                              {history.created instanceof Timestamp
                                                ? new Date(history.created.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                : history.created
                                                  ? new Date(history.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                : "N/A"}
                                            </td>
                                            <td className="px-6 py-2 text-sm text-[#000000] w-[20%] truncate">
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
                  type="text"
                  placeholder="Enter new price"
                  value={newPrice}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                    setNewPrice(value ? Number(value).toLocaleString() : '');
                  }}
                  className="w-full"
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

      <PriceHistoryDialog
        rowDialogOpen={rowDialogOpen}
        setRowDialogOpen={setRowDialogOpen}
        selectedRowProduct={selectedRowProduct}
        priceHistories={priceHistories}
        loadingPriceHistories={loadingPriceHistories}
        newPriceInDialog={newPriceInDialog}
        setNewPriceInDialog={setNewPriceInDialog}
        showUpdateForm={showUpdateForm}
        setShowUpdateForm={setShowUpdateForm}
        isUpdatingPriceInDialog={isUpdatingPriceInDialog}
        handleUpdatePriceInDialog={handleUpdatePriceInDialog}
        getSiteCode={getSiteCode}
      />
    </div>
  )
}