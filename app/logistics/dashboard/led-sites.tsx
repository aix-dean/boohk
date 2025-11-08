"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { AlertCircle, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getPaginatedUserProducts, type Product } from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { useAuth } from "@/contexts/auth-context"
import { CreateReportDialog } from "@/components/create-report-dialog"

// Number of items to display per page
const ITEMS_PER_PAGE = 8

export default function LEDSitesTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")

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

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")

  const { user } = useAuth()

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset pagination when search term changes
  useEffect(() => {
    setCurrentPage(1)
    setPageCache(new Map())
    fetchTotalCount()
    fetchProducts(1, true)
  }, [debouncedSearchTerm])

  // Fetch total count of products
  const fetchTotalCount = useCallback(async () => {
    if (!user?.uid) return

    setLoadingCount(true)
    try {
      // Get all user products and filter by content_type
      const allProducts = await getPaginatedUserProducts(user.uid, 1000, null, {
        active: true,
        searchTerm: debouncedSearchTerm,
      })

      const dynamicProducts = allProducts.items.filter((product) => product.content_type?.toLowerCase() === "dynamic")
      const count = dynamicProducts.length

      setTotalItems(count)
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (error) {
      console.error("Error fetching total count:", error)
    } finally {
      setLoadingCount(false)
    }
  }, [user?.uid, debouncedSearchTerm])

  // Fetch products for the current page
  const fetchProducts = useCallback(
    async (page: number, forceRefresh = false) => {
      if (!user?.uid) return

      // Check if we have this page in cache and not forcing refresh
      if (!forceRefresh && pageCache.has(page)) {
        const cachedData = pageCache.get(page)!
        setProducts(cachedData.items)
        setLastDoc(cachedData.lastDoc)
        return
      }

      const isFirstPage = page === 1
      setLoading(isFirstPage)
      setLoadingMore(!isFirstPage)

      try {
        // For the first page, start from the beginning
        // For subsequent pages, use the last document from the previous page
        const startDoc = isFirstPage ? null : lastDoc

        const result = await getPaginatedUserProducts(user.uid, ITEMS_PER_PAGE, startDoc, {
          active: true,
          searchTerm: debouncedSearchTerm,
        })

        // Filter products to only show dynamic content type
        const filteredItems = result.items.filter((product) => product.content_type?.toLowerCase() === "dynamic")

        setProducts(filteredItems)
        setLastDoc(result.lastDoc)
        setHasMore(result.hasMore)

        // Cache this page with filtered items
        setPageCache((prev) => {
          const newCache = new Map(prev)
          newCache.set(page, {
            items: filteredItems,
            lastDoc: result.lastDoc,
          })
          return newCache
        })
      } catch (error) {
        console.error("Error fetching products:", error)
        setError("Failed to load LED sites. Please try again.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user?.uid, lastDoc, pageCache, debouncedSearchTerm],
  )

  // Load initial data and count
  useEffect(() => {
    if (user?.uid) {
      fetchProducts(1)
      fetchTotalCount()
    }
  }, [user?.uid, fetchProducts, fetchTotalCount])

  // Load data when page changes
  useEffect(() => {
    if (currentPage > 0 && user?.uid) {
      fetchProducts(currentPage)
    }
  }, [currentPage, fetchProducts, user?.uid])

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

  // Convert product to site format for display
  const productToSite = (product: Product) => {
    // Determine status color based on product status
    let statusColor = "blue"
    if (product.status === "ACTIVE" || product.status === "OCCUPIED") statusColor = "blue"
    if (product.status === "VACANT" || product.status === "AVAILABLE") statusColor = "green"
    if (product.status === "MAINTENANCE" || product.status === "REPAIR") statusColor = "red"
    if (product.status === "PENDING" || product.status === "INSTALLATION") statusColor = "orange"

    // Get image from product media or use placeholder
    const image = product.media && product.media.length > 0 ? product.media[0].url : "/led-billboard-1.png"

    return {
      id: product.id,
      name: product.name,
      status: product.status,
      statusColor,
      image,
      location: product.specs_rental?.location || product.light?.location || "Unknown location",
    }
  }

  // Show loading if no user
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-500">Loading user data...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Date and Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-sm text-gray-600 font-medium">
          {currentDate}, {currentTime}
        </div>

        <div className="flex flex-1 max-w-md mx-auto md:mx-0">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search LED sites..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading LED sites...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 rounded-lg border border-dashed border-red-200">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-red-700">Error Loading LED Sites</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={() => fetchProducts(1, true)} className="bg-white">
            Try Again
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 border-dashed rounded-md p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No LED sites found</h3>
          <p className="text-gray-500 mb-4">
            {debouncedSearchTerm
              ? "No LED sites match your search criteria. Try adjusting your search terms."
              : "You don't have any LED sites yet. Contact an administrator to add LED sites."}
          </p>
          {debouncedSearchTerm && (
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* LED Sites Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-4">
            {products.map((product) => {
              const site = productToSite(product)
              return (
                <LEDSiteCard
                  key={site.id}
                  site={site}
                  onCreateReport={(siteId) => {
                    setSelectedSiteId(siteId)
                    setReportDialogOpen(true)
                  }}
                />
              )
            })}
          </div>

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
          {products.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
              <div className="text-sm text-gray-500 flex items-center">
                {loadingCount ? (
                  <div className="flex items-center">
                    <Loader2 size={14} className="animate-spin mr-2" />
                    <span>Calculating pages...</span>
                  </div>
                ) : (
                  <span>
                    Page {currentPage} of {totalPages} ({totalItems} items)
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

                {/* Page numbers */}
                <div className="flex items-center gap-1">
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

      {/* Report Dialog */}
      <CreateReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} siteId={selectedSiteId} />
    </div>
  )
}

// LED Site Card that matches the exact reference design
function LEDSiteCard({ site, onCreateReport }: { site: any; onCreateReport: (siteId: string) => void }) {
  const handleCreateReport = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCreateReport(site.id)
  }

  const handleCardClick = () => {
    window.location.href = `/logistics/sites/${site.id}`
  }

  return (
    <Card
      className="overflow-hidden cursor-pointer border border-gray-200 shadow-sm rounded-lg transition-all hover:shadow-lg bg-white w-full"
      onClick={handleCardClick}
    >
      <div className="relative h-32 bg-gray-200">
        <Image
          src={site.image || "/placeholder.svg"}
          alt={site.name}
          fill
          className="object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/led-billboard-1.png"
            target.className = "opacity-50 object-contain"
          }}
        />

        {/* Status Badge - Bottom Left */}
        <div className="absolute bottom-2 left-2">
          <div className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: "#38b6ff" }}>
            {site.status === "ACTIVE" ? "OPEN" : site.status}
          </div>
        </div>
      </div>

      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {/* Site Code */}
          <div className="text-xs text-gray-500 uppercase tracking-wide">{site.id}</div>

          {/* Site Name with Badge */}
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-gray-900 truncate">{site.name}</h3>
            <div className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0">M</div>
          </div>

          {/* Site Information */}
          <div className="space-y-1 text-xs">
            <div className="flex flex-col">
              <span className="text-black">
                <span className="font-bold">Operation:</span>
                <span className="ml-1 text-black">{site.status === "ACTIVE" ? "Active" : site.status}</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-black">
                <span className="font-bold">Display Health:</span>
                <span className="ml-1" style={{ color: "#00bf63" }}>
                  100%
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-black">
                <span className="font-bold">Compliance:</span>
                <span className="ml-1 text-black">Complete</span>
              </span>
            </div>
          </div>

          {/* Create Report Button */}
          <Button
            variant="secondary"
            className="mt-3 w-full h-8 text-xs bg-gray-100 hover:bg-gray-200 border-0 text-gray-700 hover:text-gray-900 rounded-md font-medium"
            onClick={handleCreateReport}
          >
            Create Report
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
