"use client"

import type React from "react"
import { RouteProtection } from "@/components/route-protection"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  MoreVertical,
  FileText,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  Clock,
  Play,
  Repeat,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { Input } from "@/components/ui/input"
import { getPaginatedUserProducts, getUserProductsCount, softDeleteProduct, type Product } from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"

// Number of items to display per page
const ITEMS_PER_PAGE = 12

// Map product to content format for display
const mapProductToContent = (product: Product) => {
  return {
    id: product.id,
    title: product.name || "Untitled",
    type: product.type || "Document",
    status: product.status || "Draft",
    author: product.seller_name || "Unknown",
    dateCreated: typeof product.created === "string" ? product.created : "Recent",
    dateModified: typeof product.updated === "string" ? product.updated : "Recent",
    thumbnail: product.media?.[0]?.url || "/abstract-geometric-sculpture.png",
    tags: product.categories || [],
    description: product.description || "",
    // Billboard/LED specific fields
    dimensions: product.dimensions || "1920×1080",
    duration: product.duration || "15s",
    scheduledDates: product.scheduled_dates || { start: "Not scheduled", end: "Not scheduled" },
    locations: product.locations || [],
    format: product.format || "Image",
    approvalStatus: product.approval_status || "Pending",
    campaignName: product.campaign_name || "Unassigned",
    impressions: product.impressions || 0,
    // CMS specific fields
    cms: product.cms || null,
    productId: product.id?.substring(0, 8).toUpperCase() || "UNKNOWN",
    location: product.specs_rental?.location || "Unknown Location",
    operation: product.campaignName || "Unassigned Campaign",
    displayHealth: product.active ? "ON" : "OFF",
  }
}

export default function CMSDashboardPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

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

  // Navigation handlers for analytics cards

  // Fetch total count of dynamic products
  const fetchTotalCount = useCallback(async () => {
    if (!userData?.company_id) return

    setLoadingCount(true)
    try {
      const count = await getUserProductsCount(userData?.company_id, {
        active: true,
        content_type: "dynamic",
        searchTerm,
      })
      setTotalItems(count)
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (error) {
      console.error("Error fetching total count:", error)
      toast({
        title: "Error",
        description: "Failed to load content count. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingCount(false)
    }
  }, [userData, toast, searchTerm])

  // Fetch dynamic products for the current page
  const fetchProducts = useCallback(
    async (page: number) => {
      if (!userData?.company_id) return

      // Check if we have this page in cache
      const cacheKey = `${page}-${searchTerm}`
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

        const result = await getPaginatedUserProducts(userData?.company_id, ITEMS_PER_PAGE, startDoc, {
          active: true,
          content_type: "dynamic",
          searchTerm,
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
        toast({
          title: "Error",
          description: "Failed to load content. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userData, lastDoc, pageCache, toast, searchTerm],
  )

  // Store products in localStorage for use in breadcrumbs
  useEffect(() => {
    if (products.length > 0) {
      try {
        // Only store essential data (id and name) to keep localStorage size small
        const simplifiedProducts = products.map((product) => ({
          id: product.id,
          name: product.name,
        }))
        localStorage.setItem("cmsProducts", JSON.stringify(simplifiedProducts))
      } catch (error) {
        console.error("Error storing products in localStorage:", error)
      }
    }
  }, [products])

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

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Reset pagination and cache when searching
    setCurrentPage(1)
    setPageCache(new Map())
    fetchProducts(1)
    fetchTotalCount()
  }

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
        title: "Content deleted",
        description: `${productToDelete.name} has been successfully deleted.`,
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete the content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    }
  }

  // Handle edit click
  const handleEditClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    // Store the complete product data for the site page
    localStorage.setItem(`cms-product-${product.id}`, JSON.stringify(product))
    router.push(`/cms/content/edit/${product.id}`)
  }

  // Handle view site details click - Updated to use new site page
  const handleViewSite = (productId: string) => {
    // Find the product data to pass along
    const productData = products.find((p) => p.id === productId)
    if (productData) {
      // Store the complete product data for the site page
      localStorage.setItem(`cms-product-${productId}`, JSON.stringify(productData))
    }
    router.push(`/cms/site/${productId}`)
  }

  // Use mock data if no products are available from Firebase
  const [useMockData, setUseMockData] = useState(false)

  useEffect(() => {
    if (!loading && products.length === 0 && !userData?.company_id) {
      setUseMockData(true)
    }
  }, [loading, products, userData])

  // Mock data for demonstration when no Firebase data is available
  const mockContent = [
    {
      id: "1",
      title: "Bocaue 11",
      type: "Billboard",
      status: "Published",
      author: "John Smith",
      dateCreated: "2023-05-15",
      dateModified: "2023-06-10",
      thumbnail: "/abstract-geometric-sculpture.png",
      tags: ["Sale", "Summer"],
      dimensions: "14' × 48'",
      duration: "30 days",
      scheduledDates: { start: "2023-06-01", end: "2023-06-30" },
      locations: ["Downtown", "Highway 101"],
      format: "Static Image",
      approvalStatus: "Approved",
      campaignName: "Summer 2023",
      impressions: 45000,
      productId: "NAN20010",
      location: "Bocaue 11",
      operation: "MerryMart",
      displayHealth: "ON",
      cms: {
        start_time: "16:44",
        end_time: "18:44",
        spot_duration: 15,
        loops_per_day: 20,
        spots_per_loop: 5,
      },
    },
    {
      id: "2",
      title: "EDSA Corner Shaw",
      type: "LED Display",
      status: "Draft",
      author: "Sarah Johnson",
      dateCreated: "2023-06-20",
      dateModified: "2023-06-20",
      thumbnail: "/roadside-billboard.png",
      tags: ["Product Launch", "Digital"],
      dimensions: "1920×1080",
      duration: "15s",
      scheduledDates: { start: "Not scheduled", end: "Not scheduled" },
      locations: [],
      format: "Video",
      approvalStatus: "Pending",
      campaignName: "Q3 Launch",
      impressions: 0,
      productId: "LED20011",
      location: "EDSA Corner Shaw",
      operation: "Jollibee Campaign",
      displayHealth: "OFF",
      cms: {
        start_time: "08:00",
        end_time: "22:00",
        spot_duration: 30,
        loops_per_day: 48,
        spots_per_loop: 3,
      },
    },
    {
      id: "3",
      title: "Ayala Triangle",
      type: "LED Display",
      status: "Published",
      author: "Michael Brown",
      dateCreated: "2023-04-01",
      dateModified: "2023-04-15",
      thumbnail: "/led-billboard-1.png",
      tags: ["Holiday", "Promotion"],
      dimensions: "1920×1080",
      duration: "20s",
      scheduledDates: { start: "2023-12-01", end: "2023-12-31" },
      locations: ["Shopping Mall", "City Center"],
      format: "HTML Animation",
      approvalStatus: "Approved",
      campaignName: "Holiday 2023",
      impressions: 28500,
      productId: "AYA30001",
      location: "Ayala Triangle",
      operation: "Samsung Promo",
      displayHealth: "ON",
      cms: {
        start_time: "06:00",
        end_time: "24:00",
        spot_duration: 20,
        loops_per_day: 72,
        spots_per_loop: 4,
      },
    },
    {
      id: "4",
      title: "BGC Central Square",
      type: "Billboard",
      status: "Review",
      author: "Emily Davis",
      dateCreated: "2023-05-10",
      dateModified: "2023-06-05",
      thumbnail: "/led-billboard-2.png",
      tags: ["Brand", "Awareness"],
      dimensions: "10' × 30'",
      duration: "45 days",
      scheduledDates: { start: "2023-07-01", end: "2023-08-15" },
      locations: ["Airport", "Train Station"],
      format: "Static Image",
      approvalStatus: "In Review",
      campaignName: "Brand Expansion",
      impressions: 0,
      productId: "BGC40001",
      location: "BGC Central Square",
      operation: "Nike Campaign",
      displayHealth: "ON",
      cms: {
        start_time: "07:00",
        end_time: "23:00",
        spot_duration: 25,
        loops_per_day: 32,
        spots_per_loop: 6,
      },
    },
  ]

  // Map products to content format for display
  const content = useMockData ? mockContent : products.map(mapProductToContent)

  return (
    <RouteProtection requiredRoles="cms">
      <div className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {/* Header with title and actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h1 className="text-2xl font-bold">
              {userData?.first_name
                ? `${userData.first_name.charAt(0).toUpperCase()}${userData.first_name.slice(1).toLowerCase()}'s Dashboard`
                : "Dashboard"}
            </h1>
            <p className="text-muted-foreground">Manage your digital billboard content and campaigns</p>
          </div>

          {/* Analytics Cards */}

          {/* Search and View Toggle */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-80"
              />
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Display */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : content.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No content found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No content matches your search criteria." : "No content available."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {content.map((item) => (
                <Card key={item.id} className="group cursor-pointer transition-all hover:shadow-md">
                  <div
                    onClick={() => {
                      // Store the original product data, not the mapped content
                      const originalProduct = products.find((p) => p.id === item.id)
                      if (originalProduct) {
                        localStorage.setItem(`cms-product-${item.id}`, JSON.stringify(originalProduct))
                      }
                      handleViewSite(item.id)
                    }}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-t-lg">
                      <Image
                        src={item.thumbnail || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                      <div className="absolute right-2 top-2">
                        <Badge variant={item.status === "Published" ? "default" : "secondary"}>{item.status}</Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <h3 className="font-semibold leading-tight">{item.title}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleEditClick(item as any, e)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleDeleteClick(item as any, e)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">ID:</span>
                          <span>{item.productId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Location:</span>
                          <span className="truncate">{item.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Operation:</span>
                          <span className="truncate">{item.operation}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Display:</span>
                          <Badge variant={item.displayHealth === "ON" ? "default" : "secondary"} className="text-xs">
                            {item.displayHealth}
                          </Badge>
                        </div>
                        {item.cms && (
                          <div className="mt-3 space-y-1 border-t pt-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">
                                {item.cms.start_time} - {item.cms.end_time}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Play className="h-3 w-3" />
                              <span className="text-xs">{item.cms.spot_duration}s duration</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Repeat className="h-3 w-3" />
                              <span className="text-xs">
                                {item.cms.loops_per_day} loops/day, {item.cms.spots_per_loop} spots/loop
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Display</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {content.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => {
                        // Store the original product data, not the mapped content
                        const originalProduct = products.find((p) => p.id === item.id)
                        if (originalProduct) {
                          localStorage.setItem(`cms-product-${item.id}`, JSON.stringify(originalProduct))
                        }
                        handleViewSite(item.id)
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-16 overflow-hidden rounded">
                            <Image
                              src={item.thumbnail || "/placeholder.svg"}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-medium">{item.title}</div>
                            <div className="text-sm text-muted-foreground">{item.type}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.productId}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{item.operation}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Published" ? "default" : "secondary"}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.displayHealth === "ON" ? "default" : "secondary"}>
                          {item.displayHealth}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.cms ? (
                          <div className="text-sm">
                            <div>
                              {item.cms.start_time} - {item.cms.end_time}
                            </div>
                            <div className="text-muted-foreground">
                              {item.cms.spot_duration}s, {item.cms.loops_per_day} loops
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewSite(item.id)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Site
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleEditClick(item as any, e)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleDeleteClick(item as any, e)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Pagination */}
          {!loading && content.length > 0 && totalPages > 1 && (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {loadingCount ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading count...
                  </div>
                ) : (
                  `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} to ${Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    totalItems,
                  )} of ${totalItems} items`
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1 || loadingMore}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pageNum, index) => (
                    <div key={index}>
                      {pageNum === "..." ? (
                        <span className="px-2 py-1 text-sm text-muted-foreground">...</span>
                      ) : (
                        <Button
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(pageNum as number)}
                          disabled={loadingMore}
                          className="h-8 w-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages || loadingMore}
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete Content"
          description={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
        />
      </div>
    </RouteProtection>
  )
}

// Content Card Component for Grid View
function ContentCard({
  content,
  onView,
  onEdit,
  onDelete,
}: {
  content: any
  onView: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all border border-gray-300 shadow-sm hover:shadow-md rounded-lg bg-white"
      onClick={onView}
    >
      <div className="h-32 bg-gray-200 relative">
        <Image
          src={content.thumbnail || "/placeholder.svg"}
          alt={content.title || "Content thumbnail"}
          fill
          className="object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/abstract-geometric-sculpture.png"
            target.className = "opacity-50 object-contain"
          }}
        />

        {/* Status Badge - positioned at bottom left of image */}
        <div className="absolute bottom-2 left-2 z-10">
          <Badge
            className={`${
              content.status === "Published"
                ? "bg-blue-500 text-white border-0 font-medium px-3 py-1"
                : content.status === "Draft"
                  ? "bg-orange-500 text-white border-0 font-medium px-3 py-1"
                  : "bg-gray-500 text-white border-0 font-medium px-3 py-1"
            }`}
          >
            {content.status === "Published" ? "OCCUPIED" : content.status.toUpperCase()}
          </Badge>
        </div>

        {/* Action Menu - top right */}
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 bg-white/90 backdrop-blur-sm border-0 shadow-sm"
              >
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="mr-2 h-4 w-4" />
                View Site
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Content
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Content
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardContent className="p-3">
        <div className="flex flex-col space-y-2">
          {/* Title/Location */}
          <h3 className="text-base font-semibold text-gray-900">{content.title}</h3>

          {/* Location Info */}
          <div className="text-sm text-gray-700">
            <div className="flex items-center gap-1 mb-1 line-clamp-1">
              <span>{content.location}</span>
            </div>
          </div>

          {/* CMS Schedule Info */}
          {content.cms && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {content.cms.start_time} - {content.cms.end_time}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  <span>{content.cms.spot_duration}s spots</span>
                </div>
                <div className="flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  <span>{content.cms.loops_per_day} loops/day</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs">•</span>
                  <span>{content.cms.spots_per_loop} spots/loop</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
