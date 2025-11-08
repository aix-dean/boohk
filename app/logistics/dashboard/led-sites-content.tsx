"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { LayoutGrid, List, AlertCircle, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Product } from "@/lib/firebase-service"
import { getServiceAssignmentsByProductId, type ServiceAssignment } from "@/lib/firebase-service"
import { CreateReportDialog } from "@/components/create-report-dialog"

// Number of items to display per page
const ITEMS_PER_PAGE = 8

export default function LEDSitesContentTab({ products = [] }: { products?: Product[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products)

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")

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

  // Filter products based on search term
  useEffect(() => {
    if (!debouncedSearchTerm) {
      setFilteredProducts(products)
      return
    }

    const filtered = products.filter(
      (product) =>
        product.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        product.id?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
    )
    setFilteredProducts(filtered)
  }, [debouncedSearchTerm, products])

  return (
    <div className="flex flex-col gap-4">
      {/* Date, Search and View Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-sm text-gray-600">
          {currentDate}, {currentTime}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search LED sites..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="border rounded-md p-1 flex">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid size={18} />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No LED sites found</h3>
          <p className="text-gray-500 mb-4">
            {debouncedSearchTerm
              ? `No LED sites matching "${debouncedSearchTerm}" were found`
              : "No dynamic content LED sites are currently available"}
          </p>
        </div>
      )}

      {/* LED Site Grid */}
      {filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {filteredProducts.map((product) => (
            <LEDSiteCard
              key={product.id}
              product={product}
              onCreateReport={(siteId) => {
                setSelectedSiteId(siteId)
                setReportDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Create Service Assignment Button */}
      <div className="fixed bottom-6 right-6">
        <Button size="lg" className="rounded-full shadow-lg gap-2">
          <Plus size={18} />
          Create Service Assignment
        </Button>
      </div>

      {/* Report Dialog */}
      <CreateReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} siteId={selectedSiteId} />
    </div>
  )
}

function LEDSiteCard({ product, onCreateReport }: { product: Product; onCreateReport: (siteId: string) => void }) {
  // Get the first media item for the thumbnail
  const thumbnailUrl = product.media && product.media.length > 0 ? product.media[0].url : "/led-billboard-1.png"

  // Determine location based on product type
  const location = product.specs_rental?.location || product.light?.location || "Unknown location"

  // State for service assignments
  const [activeAssignments, setActiveAssignments] = useState<ServiceAssignment[]>([])
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

  // Add the handleCreateReport function
  const handleCreateReport = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCreateReport(product.id)
  }

  const handleCardClick = () => {
    window.location.href = `/logistics/sites/${product.id}?view=content`
  }

  // Fetch service assignments for this specific product
  useEffect(() => {
    const fetchProductAssignments = async () => {
      try {
        setIsLoadingAssignments(true)
        const assignments = await getServiceAssignmentsByProductId(product.id)
        setActiveAssignments(assignments)
      } catch (error) {
        console.error(`Error fetching assignments for product ${product.id}:`, error)
      } finally {
        setIsLoadingAssignments(false)
      }
    }

    fetchProductAssignments()
  }, [product.id])

  return (
    <div
      className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
        <img
          src={thumbnailUrl || "/placeholder.svg"}
          alt={product.name || "LED Site"}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/led-billboard-1.png"
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-medium text-sm mb-1 truncate">{product.name || "Unnamed Site"}</h3>
        <p className="text-xs text-gray-500 mb-2 truncate">{location}</p>

        {/* Service Assignment Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs">
            {isLoadingAssignments ? (
              <span className="text-gray-400">Loading...</span>
            ) : activeAssignments.length > 0 ? (
              <span className="text-green-600 font-medium">
                {activeAssignments.length} Active Assignment{activeAssignments.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-gray-400">No Active Assignments</span>
            )}
          </div>
        </div>

        <Button size="sm" variant="outline" className="w-full text-xs bg-transparent" onClick={handleCreateReport}>
          Create Report
        </Button>
      </div>
    </div>
  )
}
