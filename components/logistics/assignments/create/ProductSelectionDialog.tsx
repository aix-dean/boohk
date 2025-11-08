"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getPaginatedUserProducts, getUserProductsCount, type Product } from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Loader2, AlertCircle, X } from "lucide-react"
import Image from "next/image"

// Number of items to display per page
const ITEMS_PER_PAGE = 8

interface ProductSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProduct: (product: Product) => void
}

export function ProductSelectionDialog({
  open,
  onOpenChange,
  onSelectProduct,
}: ProductSelectionDialogProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [contentTypeFilter, setContentTypeFilter] = useState("All")

  const { toast } = useToast()
  const { userData } = useAuth()

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

  // Fetch total count of products
  const fetchTotalCount = useCallback(async () => {
    if (!userData?.company_id) return

    setLoadingCount(true)
    try {
      const count = await getUserProductsCount(userData?.company_id, {
        active: true,
        searchTerm: searchQuery,
      })

      setTotalItems(count)
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (error) {
      console.error("Error fetching total count:", error)
    } finally {
      setLoadingCount(false)
    }
  }, [userData?.company_id, searchQuery])

  // Fetch products for the current page
  const fetchProducts = useCallback(
    async (page: number, forceRefresh = false) => {
      if (!userData?.company_id) return

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

        const result = await getPaginatedUserProducts(userData?.company_id, ITEMS_PER_PAGE, startDoc, {
          active: true,
          searchTerm: searchQuery,
        })

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
      } catch (error) {
        console.error("Error fetching products:", error)
        setError("Failed to load sites. Please try again.")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userData?.company_id, lastDoc, pageCache, searchQuery],
  )

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
    setPageCache(new Map())
    fetchTotalCount()
    fetchProducts(1, true)
  }, [searchQuery, contentTypeFilter])

  // Load initial data and count
  useEffect(() => {
    if (userData?.company_id && open) {
      fetchProducts(1)
      fetchTotalCount()
    }
  }, [userData?.company_id, open, fetchProducts, fetchTotalCount])

  // Load data when page changes
  useEffect(() => {
    if (currentPage > 0 && userData?.company_id && open) {
      fetchProducts(currentPage)
    }
  }, [currentPage, fetchProducts, userData?.company_id, open])

  // Filter products based on contentTypeFilter
  const filteredProducts = products.filter((product) => {
    // Content type filter
    if (contentTypeFilter !== "All") {
      if (contentTypeFilter === "Static") return product.content_type === "Static" || product.content_type === "static"
      else if (contentTypeFilter === "Dynamic")
        return product.content_type === "Dynamic" || product.content_type === "dynamic"
    }
    return true
  })

  // Convert product to site format for display
  const productToSite = (product: Product) => {
    // Determine status color based on product status
    let statusColor = "blue"
    if (product.status === "ACTIVE" || product.status === "OCCUPIED") statusColor = "blue"
    if (product.status === "VACANT" || product.status === "AVAILABLE") statusColor = "green"
    if (product.status === "MAINTENANCE" || product.status === "REPAIR") statusColor = "red"
    if (product.status === "PENDING" || product.status === "INSTALLATION") statusColor = "orange"

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
        : // 80-100 for operational
          product.status === "PENDING"
          ? Math.floor(Math.random() * 30) + 50
          : // 50-80 for warning
            Math.floor(Math.random() * 40) + 10) // 10-50 for error

    // Extract address information from different possible locations
    const address =
      product.specs_rental?.location ||
      product.light?.location ||
      product.location ||
      product.address ||
      "Address not specified"

    return {
      id: product.id,
      name: product.name || `Site ${product.id?.substring(0, 8)}`,
      status: product.status || "UNKNOWN",
      statusColor,
      image,
      address,
      contentType: (product.content_type || "static").toLowerCase(),
      healthPercentage,
      siteCode: product.site_code || product.id?.substring(0, 8),
      operationalStatus:
        product.status === "ACTIVE" || product.status === "OCCUPIED"
          ? "Operational"
          : product.status === "MAINTENANCE" || product.status === "REPAIR"
            ? "Under Maintenance"
            : product.status === "PENDING" || product.status === "INSTALLATION"
              ? "Pending Setup"
              : "Inactive",
    }
  }

  const handleProductSelect = (product: Product) => {
    console.log("ProductSelectionDialog handleProductSelect called with:", product)
    onSelectProduct(product)
    onOpenChange(false)
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select Project Site</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Search and Filter */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Content Type Filter */}
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                <SelectItem value="Static">Static</SelectItem>
                <SelectItem value="Dynamic">Dynamic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-gray-500">Loading sites...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
              <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-red-700">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => fetchProducts(1, true)}>
                Try Again
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredProducts.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-md p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">No sites found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || contentTypeFilter !== "All"
                  ? "No sites match your search criteria. Try adjusting your search terms or filters."
                  : "There are no sites in the system yet."}
              </p>
              {(searchQuery || contentTypeFilter !== "All") && (
                <Button variant="outline" onClick={() => { setSearchQuery(""); setContentTypeFilter("All") }}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {/* Site Grid */}
          {!loading && !error && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => {
                const site = productToSite(product)
                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="relative h-32 bg-gray-200">
                      <Image
                        src={site.image || "/placeholder.svg"}
                        alt={site.name}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = site.contentType === "dynamic" ? "/led-billboard-1.png" : "/roadside-billboard.png"
                          target.className = "opacity-50 object-contain"
                        }}
                      />

                      {/* Status Badge */}
                      <div className="absolute bottom-2 left-2">
                        <div className="px-2 py-1 rounded text-xs font-bold text-white bg-blue-500">
                          {site.operationalStatus === "Operational"
                            ? "OPEN"
                            : site.operationalStatus === "Under Maintenance"
                              ? "MAINTENANCE"
                              : site.operationalStatus === "Pending Setup"
                                ? "PENDING"
                                : "CLOSED"}
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{site.siteCode}</div>
                      <h3 className="font-bold text-sm text-gray-900 truncate mb-2">{site.name}</h3>
                      <div className="text-xs text-gray-600 truncate">{site.address}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {site.contentType === "dynamic" ? "Digital Billboard" : "Static Billboard"}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
