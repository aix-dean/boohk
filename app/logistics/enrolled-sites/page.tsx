"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
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
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getPaginatedUserProducts,
  getUserProductsCount,
  type Product,
} from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useResponsive } from "@/hooks/use-responsive"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import { RouteProtection } from "@/components/route-protection"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/use-debounce"
import { Skeleton } from "@/components/ui/skeleton"

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

function EnrolledSitesContent() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { isMobile, isTablet } = useResponsive()

  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

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
  const { toast } = useToast()

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

  // Fetch products for the current page
  const fetchProducts = useCallback(
    async (page: number) => {
      if (!userData?.company_id) return

      // Check if we have this page in cache
      if (pageCache.has(page)) {
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

        const result = await getPaginatedUserProducts(userData?.company_id, ITEMS_PER_PAGE, startDoc, { active: true })

        setProducts(result.items)
        setLastDoc(result.lastDoc)
        setHasMore(result.hasMore)

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
        localStorage.setItem("logisticsProducts", JSON.stringify(simplifiedProducts))
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
    [userData, lastDoc, pageCache, toast],
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

  // Handle view details click
  const handleViewDetails = (productId: string) => {
    router.push(`/logistics/products/${productId}`)
  }

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
    // Search filter
    if (debouncedSearchQuery.trim()) {
      const searchLower = debouncedSearchQuery.toLowerCase()
      const name = product.name?.toLowerCase() || ""
      const location = (product.specs_rental?.location || (product as any).light?.location || "")?.toLowerCase() || ""
      const siteCode = getSiteCode(product)?.toLowerCase() || ""

      return name.includes(searchLower) ||
             location.includes(searchLower) ||
             siteCode.includes(searchLower)
    }

    return true
  })

  return (
    <div className="h-screen flex flex-col">
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
          <div className="grid grid-cols-1 gap-6 h-full">
            {/* Main Dashboard Content */}
            <div className="flex flex-col gap-1 md:gap-2 h-full overflow-hidden">
              {/* Dashboard Header */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h1 className="text-2xl font-semibold text-[#333333]">
                    {userData?.first_name
                      ? `${userData.first_name.charAt(0).toUpperCase()}${userData.first_name.slice(1).toLowerCase()}'s Dashboard`
                      : "Dashboard"}
                  </h1>
                </div>

                {/* Search and View Controls */}
                <div className="flex justify-between items-center">
                  <div className="relative">
                    <div className="w-80 mt-2 mb-2">
                      <Input
                        placeholder="Search sites..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 pl-4 pr-4 text-sm border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 transition-all"
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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

              {/* Empty state */}
              {!loading && filteredProducts.length === 0 && (
                <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed">
                  <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MapPin size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-base md:text-lg font-medium mb-2">No sites yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Contact an administrator to add sites</p>
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
                        onView={() => handleViewDetails(product.id || "")}
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
                              onClick={() => handleViewDetails(product.id || "")}
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
                                        className="h-full w-full object-cover"
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
                                    (product as any).type?.toLowerCase() === "rental"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-purple-50 text-purple-700 border-purple-200"
                                  }
                                >
                                  {(product as any).type || "Unknown"}
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EnrolledSitesPage() {
  const { user, userData } = useAuth()

  return (
    <RouteProtection requiredRoles="logistics">
      <div className="min-h-screen bg-[#fafafa] p-6">
        <div className="max-w-7xl mx-auto">
          <EnrolledSitesContent />
        </div>
      </div>
    </RouteProtection>
  )
}

// Product Card Component for Grid View
export function ProductCard({
  product,
  onView,
}: {
  product: Product
  onView: () => void
}) {
  // Determine location based on product type
  const location = product.specs_rental?.location || (product as any).light?.location || "Unknown location"

  // Format price if available
  const formattedPrice = product.price ? `₱${Number(product.price).toLocaleString()}/month` : "Price not set"

  // Get site code
  const siteCode = getSiteCode(product)

  return (
    <div
      className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all hover:shadow-xl border h-[340px] flex flex-col border-gray-200"
      onClick={onView}
    >
      <div className="h-[218px] bg-gray-300 relative rounded-t-2xl">
        <Image
          src={product.media && product.media.length > 0 ? product.media[0].url : "/placeholder.svg"}
          alt={product.name || "Product image"}
          fill
          className="object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/abstract-geometric-sculpture.png"
            target.className = "opacity-50 object-contain"
          }}
        />
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