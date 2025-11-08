"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Plus, MapPin, ChevronLeft, ChevronRight } from "lucide-react"
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

// Number of items to display per page
const ITEMS_PER_PAGE = 12

export default function AdminInventoryPage() {
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
      if (!userData?.company_id) {
        setProducts([])
        setLastDoc(null)
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        return
      }

      // Check if we have this page in cache
      if (pageCache.has(page)) {
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
    [userData?.company_id, lastDoc, pageCache, toast],
  )

  // Load initial data and count
  useEffect(() => {
    fetchProducts(1)
    fetchTotalCount()
  }, [userData?.company_id, fetchProducts, fetchTotalCount])

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

  const handleViewDetails = (productId: string) => {
    router.push(`/admin/inventory/${productId}`)
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

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
      </div>

      <div className="grid gap-6">
        {/* Product List */}
        <ResponsiveCardGrid mobileColumns={1} tabletColumns={2} desktopColumns={4} gap="md">
          {/* The "+ Add Site" card is now the first item in the grid */}
          <Card
            className="w-full min-h-[284px] flex flex-col items-center justify-center cursor-pointer bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-200 transition-colors"
            onClick={handleAddSiteClick}
          >
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-lg font-semibold">+ Add Site</span>
          </Card>

          {loading && products.length === 0
            ? // Show loading cards only when initially loading
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={`loading-${index}`} className="overflow-hidden border border-gray-200 shadow-md rounded-xl">
                  <div className="h-48 bg-gray-200 animate-pulse" />
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))
            : products.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden cursor-pointer border border-gray-200 shadow-md rounded-xl transition-all hover:shadow-lg"
                  onClick={() => handleViewDetails(product.id)}
                >
                  <div className="h-48 bg-gray-200 relative">
                    <Image
                      src={
                        product.media && product.media.length > 0
                          ? product.media[0].url
                          : "/abstract-geometric-sculpture.png"
                      }
                      alt={product.name || "Product image"}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/abstract-geometric-sculpture.png"
                        target.className = "opacity-50"
                      }}
                    />
                  </div>

                  <CardContent className="p-4">
                    <div className="flex flex-col">
                      <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                      <div className="mt-2 text-sm font-medium text-green-700">
                        ₱{Number(product.price).toLocaleString()}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 flex items-center">
                        <MapPin size={12} className="mr-1 flex-shrink-0" />
                        <span className="truncate">{product.specs_rental?.location || "Unknown location"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </ResponsiveCardGrid>

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
            <div className="text-gray-500 text-lg mb-2">Welcome to your inventory!</div>
            <div className="text-gray-400 text-sm">
              Click the "Add Site" button above to set up your company and create your first site.
            </div>
          </div>
        )}

        {/* Pagination Controls - Only show if there are products or multiple pages */}
        {(products.length > 0 || totalPages > 1) && (
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
    </div>
  )
}
