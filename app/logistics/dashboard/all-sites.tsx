"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import type { Product } from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Bell } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { CreateReportDialog } from "@/components/create-report-dialog"
import { JobOrdersListDialog } from "@/components/job-orders-list-dialog"

// CSS for static gradient border
const gradientBorderStyles = `
.gradient-border {
  background: linear-gradient(45deg, #ff0000, #ffff00, #00ff00, #0000ff, #8B00FF);
}
`

// Direct Firebase imports for job order fetching
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, startAfter } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Number of items to display per page
const ITEMS_PER_PAGE = 12

interface AllSitesTabProps {
  searchQuery?: string
  contentTypeFilter?: string
  viewMode?: "grid" | "list"
}

export default function AllSitesTab({
  searchQuery = "",
  contentTypeFilter = "All",
  viewMode = "grid",
}: AllSitesTabProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobOrderCounts, setJobOrderCounts] = useState<Record<string, number>>({})

  const { toast } = useToast()
  const { userData } = useAuth()
  const router = useRouter()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const lastDocsRef = useRef<Map<number, QueryDocumentSnapshot<DocumentData> | null>>(new Map())

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")

  // Job Orders dialog state
  const [jobOrdersDialogOpen, setJobOrdersDialogOpen] = useState(false)
  const [selectedSiteForJO, setSelectedSiteForJO] = useState<{
    id: string
    name: string
  }>({ id: "", name: "" })







  // Reset pagination when search or filter changes
    useEffect(() => {
      setCurrentPage(1)
      lastDocsRef.current = new Map()
      setHasNextPage(false)
    }, [searchQuery, contentTypeFilter])
  
  // Debug effect to log JO counts when they change
    useEffect(() => {
      Object.entries(jobOrderCounts).forEach(([productId, count]) => {
        console.log(`Product ${productId}: ${count} JOs`)
      })
    }, [jobOrderCounts])
  
    // Real-time job orders listener
      useEffect(() => {
        if (!userData?.company_id) return
    
        const q = query(collection(db, "job_orders"), where("company_id", "==", userData.company_id), where("status", "==", "pending"))
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const counts: Record<string, number> = {}
          const productIds = products.map(p => p.id).filter(Boolean)
    
          querySnapshot.forEach((doc) => {
            const data = doc.data()
            const productId = data.product_id
            if (productId && productIds.includes(productId)) {
              counts[productId] = (counts[productId] || 0) + 1
            }
          })
    
          setJobOrderCounts(counts)
        })
    
        return unsubscribe
      }, [userData?.company_id, products])
    
      // Fetch paginated products
      const fetchProducts = useCallback(async (page: number = 1) => {
        if (!userData?.company_id) return
    
        setLoading(true)
        try {
          // Build base query
          let constraints: any[] = [
            where("company_id", "==", userData.company_id),
            where("active", "==", true),
            orderBy("created", "desc"),
            limit(ITEMS_PER_PAGE + 1) // +1 to check if there's a next page
          ]
    
          // Add startAfter cursor for pagination
          const lastDoc = lastDocsRef.current.get(page - 1)
          if (lastDoc && page > 1) {
            constraints.splice(-1, 0, startAfter(lastDoc)) // Insert before limit
          }
    
          const q = query(collection(db, "products"), ...constraints)
          const querySnapshot = await getDocs(q)
    
          const productsData: Product[] = []
          querySnapshot.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() } as Product
            productsData.push(product)
          })
    
          // Check if there's a next page
          const hasNext = productsData.length > ITEMS_PER_PAGE
          const currentPageProducts = hasNext ? productsData.slice(0, ITEMS_PER_PAGE) : productsData
    
          // Store the last document for next page
          const lastDocOfPage = querySnapshot.docs[querySnapshot.docs.length - (hasNext ? 2 : 1)]
          lastDocsRef.current.set(page, lastDocOfPage || null)
          setHasNextPage(hasNext)
    
          // Apply client-side filters
          let filtered = currentPageProducts
          if (searchQuery) {
            filtered = currentPageProducts.filter(p =>
              p.name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          }
    
          if (contentTypeFilter !== "All") {
            filtered = filtered.filter((product) => {
              const productType = (product.content_type || "").toLowerCase()
              const filterType = contentTypeFilter.toLowerCase()
              return productType === filterType
            })
          }
    
          setProducts(filtered)
          setLoading(false)
          setError(null)
        } catch (error) {
          console.error("Error fetching products:", error)
          setError("Failed to load sites. Please try again.")
          setLoading(false)
        }
      }, [userData?.company_id, searchQuery, contentTypeFilter])
    
      // Fetch products when dependencies change
      useEffect(() => {
        fetchProducts(currentPage)
      }, [currentPage, searchQuery, contentTypeFilter, userData?.company_id])

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1) {
      setCurrentPage(page)
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1)
    }
  }

  const goToNextPage = () => {
    if (hasNextPage) {
      goToPage(currentPage + 1)
    }
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

    // Get JO count for this site using the product ID
    const joCount = jobOrderCounts[product.id || ""] || 0

    return {
      id: product.id,
      name: product.name || `Site ${product.id?.substring(0, 8)}`,
      status: product.status || "UNKNOWN",
      statusColor,
      image,
      address,
      location: product.specs_rental?.location || null,
      contentType: (product.content_type || "static").toLowerCase(),
      healthPercentage,
      siteCode: product.site_code || product.id?.substring(0, 8),
      joCount,
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

  // Handle JO count click
  const handleJOCountClick = (siteId: string, siteName: string) => {
    setSelectedSiteForJO({ id: siteId, name: siteName })
    setJobOrdersDialogOpen(true)
  }

  // Show loading if no user
  if (!userData?.company_id) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-500">Loading user data...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 bg-transparent min-h-screen">
      {/* Inject CSS for gradient border */}
      <style dangerouslySetInnerHTML={{ __html: gradientBorderStyles }} />
      {/* Debug Panel - Remove this in production */}

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
          <Button variant="outline" className="mt-4 bg-transparent" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
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
            <Button variant="outline" onClick={() => window.location.reload()}>
              Clear Filters
            </Button>
          )}
        </div>
      )}
      {/* Site Display - Grid or List View */}
      {!loading && !error && products.length > 0 && (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {products.map((product) => (
                <UnifiedSiteCard
                  key={product.id}
                  site={productToSite(product)}
                  product={product}
                  onCreateReport={(siteId) => {
                    setSelectedSiteId(siteId)
                    setReportDialogOpen(true)
                  }}
                  onJOCountClick={handleJOCountClick}
                  router={router}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <UnifiedSiteListItem
                  key={product.id}
                  site={productToSite(product)}
                  onCreateReport={(siteId) => {
                    setSelectedSiteId(siteId)
                    setReportDialogOpen(true)
                  }}
                  onJOCountClick={handleJOCountClick}
                />
              ))}
            </div>
          )}
        </>
      )}


      {/* Pagination Controls */}
      {!loading && !error && products.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <div className="text-sm text-gray-500 flex items-center">
            <span>
              Page {currentPage} ({products.length} items)
            </span>
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

            {/* Current page indicator */}
            <div className="flex items-center gap-1">
              <Button
                variant="default"
                size="sm"
                className="h-8 px-3"
                disabled
              >
                {currentPage}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={!hasNextPage}
              className="h-8 w-8 p-0"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Report Dialog */}
      <CreateReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} siteId={selectedSiteId} />

      {/* Job Orders Dialog */}
      <JobOrdersListDialog
        open={jobOrdersDialogOpen}
        onOpenChange={setJobOrdersDialogOpen}
        siteId={selectedSiteForJO.id}
        siteName={selectedSiteForJO.name}
        companyId={userData?.company_id || ""}
      />
    </div>
  )
}

// Unified Site Card that matches the exact reference design
function UnifiedSiteCard({
  site,
  product,
  onCreateReport,
  onJOCountClick,
  router,
}: {
  site: any
  product: Product
  onCreateReport: (siteId: string) => void
  onJOCountClick: (siteId: string, siteName: string) => void
  router: any
}) {
  const handleCreateReport = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCreateReport(site.id)
  }

  const handleJOClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (site.joCount > 0) {
      onJOCountClick(site.id, site.name)
    }
  }

  const handleCardClick = () => {
    router.push(`/logistics/sites/${site.id}`)
  }

  return (
    <div className="relative">
      {product.content_type === "Dynamic" ? (
        <div
          className="p-[2px] rounded-[12px] gradient-border"
        >
          <Card
            className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white rounded-[10px] w-full relative"
            onClick={handleCardClick}
          >
            {site.joCount > 0 && (
              <div className="absolute top-[-0.5rem] right-[-0.5rem] bg-[#48a7fa] text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold z-10">
                {site.joCount}
              </div>
            )}
            <CardContent className="p-3">
              <div className="relative w-full aspect-square bg-gray-200">
                <Image
                  src={site.image || "/placeholder.svg"}
                  alt={site.name}
                  width={192}
                  height={192}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = site.contentType === "dynamic" ? "/led-billboard-1.png" : "/roadside-billboard.png"
                    target.className = "opacity-50 object-contain w-full h-full"
                  }}
                />
              </div>
              <div className="flex flex-col pt-2">
                {/* Site Code */}
                <div className="text-sm font-bold text-gray-400 uppercase tracking-wide truncate" title={site.siteCode}>{site.siteCode}</div>

                {/* Site Name */}
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-700 truncate">{site.name}</h3>
                </div>

                {/* Location Information */}
                {site.location && (
                  <div className="text-sm font-bold text-gray-700 truncate" title={site.location}>
                    <span className="font-bold">Location:</span> {site.location}
                  </div>
                )}

                {/* Specs Rental Information */}
                {site.specs_rental && (
                  <div className="text-sm font-bold text-gray-700">
                    <span className="font-bold">Specs:</span> {site.specs_rental}
                  </div>
                )}

                {/* Site Information */}
                <div className="">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-700">
                      <span className="font-bold">Status:</span>
                      <span className="ml-1">
                        {site.operationalStatus === "Operational"
                          ? "Active"
                          : site.operationalStatus === "Under Maintenance"
                            ? "Maintenance"
                            : site.operationalStatus === "Pending Setup"
                              ? "Pending"
                              : "Inactive"}
                      </span>
                    </span>
                  </div>

                  {site.contentType === "static" ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-700">
                        <span className="font-bold">Illumination:</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-700">
                        <span className="font-bold">Display Health:</span>
                        <span className="ml-1 text-green-600">
                          {site.healthPercentage > 90
                            ? "100%"
                            : site.healthPercentage > 80
                              ? "90%"
                              : site.healthPercentage > 60
                                ? "75%"
                                : "50%"}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Create Report Button */}
                <Button
                  variant="outline"
                  className="mt-3 w-full h-8 text-xs text-black border hover:bg-gray-50 rounded-md font-bold bg-transparent"
                  onClick={handleCreateReport}
                >
                  Create Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card
          className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white rounded-[12px] border-2 border-gray-300 w-full relative"
          onClick={handleCardClick}
        >
          {site.joCount > 0 && (
            <div className="absolute top-[-0.5rem] right-[-0.5rem] bg-[#48a7fa] text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold z-10">
              {site.joCount}
            </div>
          )}
          <CardContent className="p-3">
            <div className="relative w-full aspect-square bg-gray-200">
              <Image
                src={site.image || "/placeholder.svg"}
                alt={site.name}
                width={192}
                height={192}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = site.contentType === "dynamic" ? "/led-billboard-1.png" : "/roadside-billboard.png"
                  target.className = "opacity-50 object-contain w-full h-full"
                }}
              />
            </div>
            <div className="flex flex-col pt-2">
              {/* Site Code */}
              <div className="text-sm font-bold text-gray-400 uppercase tracking-wide truncate" title={site.siteCode}>{site.siteCode}</div>

              {/* Site Name */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-700 truncate">{site.name}</h3>
              </div>

              {/* Location Information */}
              {site.location && (
                <div className="text-sm font-bold text-gray-700 truncate" title={site.location}>
                  <span className="font-bold">Location:</span> {site.location}
                </div>
              )}

              {/* Specs Rental Information */}
              {site.specs_rental && (
                <div className="text-sm font-bold text-gray-700">
                  <span className="font-bold">Specs:</span> {site.specs_rental}
                </div>
              )}

              {/* Site Information */}
              <div className="">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700">
                    <span className="font-bold">Status:</span>
                    <span className="ml-1">
                      {site.operationalStatus === "Operational"
                        ? "Active"
                        : site.operationalStatus === "Under Maintenance"
                          ? "Maintenance"
                          : site.operationalStatus === "Pending Setup"
                            ? "Pending"
                            : "Inactive"}
                    </span>
                  </span>
                </div>

                {site.contentType === "static" ? (
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-700">
                      <span className="font-bold">Illumination:</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-700">
                      <span className="font-bold">Display Health:</span>
                      <span className="ml-1 text-green-600">
                        {site.healthPercentage > 90
                          ? "100%"
                          : site.healthPercentage > 80
                            ? "90%"
                            : site.healthPercentage > 60
                              ? "75%"
                              : "50%"}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Create Report Button */}
              <Button
                variant="outline"
                className="mt-3 w-full h-8 text-xs text-black border hover:bg-gray-50 rounded-md font-bold bg-transparent"
                onClick={handleCreateReport}
              >
                Create Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// List view component for sites
function UnifiedSiteListItem({
  site,
  onCreateReport,
  onJOCountClick,
}: {
  site: any
  onCreateReport: (siteId: string) => void
  onJOCountClick: (siteId: string, siteName: string) => void
}) {
  const handleCreateReport = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCreateReport(site.id)
  }

  const handleJOClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (site.joCount > 0) {
      onJOCountClick(site.id, site.name)
    }
  }

  const handleCardClick = () => {
    window.location.href = `/logistics/sites/${site.id}`
  }

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white rounded-tl-lg rounded-tr-lg rounded-br-lg rounded-bl-lg w-full"
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Site Image */}
            <div className="relative w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0">
              <Image
                src={site.image || "/placeholder.svg"}
                alt={site.name}
                fill
                className="object-cover rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = site.contentType === "dynamic" ? "/led-billboard-1.png" : "/roadside-billboard.png"
                  target.className = "opacity-50 object-contain rounded-lg"
                }}
              />
            </div>

            {/* Site Information */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-bold text-gray-800 uppercase tracking-wide truncate" title={site.siteCode}>{site.siteCode}</div>
                <div className="bg-purple-500 text-white text-sm font-bold px-1.5 py-0.5 rounded">
                  {site.contentType === "dynamic" ? "M" : "S"}
                </div>
              </div>

              <h3 className="text-sm font-bold text-gray-700 mb-0.5 truncate">{site.name}</h3>

              {/* Location Information */}
              {site.location && (
                <div className="text-sm font-bold text-gray-700 mb-0.5 truncate" title={site.location}>
                  <span className="font-bold">Location:</span> {site.location}
                </div>
              )}

              {/* Specs Rental Information */}
              {site.specs_rental && (
                <div className="text-sm font-bold text-gray-700 mb-0.5">
                  <span className="font-bold">Specs:</span> {site.specs_rental}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-0.5">
                <div>
                  <span className="text-sm font-bold text-gray-700">Status:</span>
                  <div className="text-sm font-bold text-gray-700">
                    {site.operationalStatus === "Operational"
                      ? "Active"
                      : site.operationalStatus === "Under Maintenance"
                        ? "Maintenance"
                        : site.operationalStatus === "Pending Setup"
                          ? "Pending"
                          : "Inactive"}
                  </div>
                </div>

                {site.contentType !== "static" && (
                  <div>
                    <span className="text-sm font-bold text-gray-700">Display Health:</span>
                    <div className="text-sm font-bold text-green-600">
                      {site.healthPercentage > 90
                        ? "100%"
                        : site.healthPercentage > 80
                          ? "90%"
                          : site.healthPercentage > 60
                            ? "75%"
                            : "50%"}
                    </div>
                  </div>
                )}
              </div>

              {/* JO Notification */}
              <div className="flex items-center gap-1">
                <Bell className="h-4 w-4 text-gray-400" />
                {site.joCount > 0 ? (
                  <button
                    onClick={handleJOClick}
                    className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    JO ({site.joCount})
                  </button>
                ) : (
                  <span className="text-sm font-bold text-gray-700">None</span>
                )}
                {/* Debug info - remove in production */}
              </div>
            </div>

            {/* Create Report Button */}
            <div className="flex-shrink-0">
              <Button
                variant="outline"
                className="h-10 px-6 text-sm text-black border hover:bg-gray-50 rounded-md font-bold bg-transparent"
                onClick={handleCreateReport}
              >
                Create Report
              </Button>
            </div>
          </div>
        </CardContent>
    </Card>
  )
}
