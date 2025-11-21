"use client"

import type React from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, MapPin, ChevronLeft, ChevronRight, Search, List, Grid3X3, X } from "lucide-react"
import type { Product } from "@/lib/firebase-service"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import Image from "next/image"
import { useResponsive } from "@/hooks/use-responsive"

interface InventoryContentProps {
  title: string
  allProducts: Product[]
  filteredProducts: Product[]
  displayedProducts: Product[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearching: boolean
  viewMode: "grid" | "list"
  setViewMode: (mode: "grid" | "list") => void
  loading: boolean
  loadingCount: boolean
  totalItems: number
  totalPages: number
  currentPage: number
  setCurrentPage: (page: number) => void
  goToPage: (page: number) => void
  goToPreviousPage: () => void
  goToNextPage: () => void
  getPageNumbers: () => (number | string)[]
  handleViewDetails: (id: string) => void
  handleEditClick: (product: Product, e: React.MouseEvent) => void
  handleDeleteClick: (product: Product, e: React.MouseEvent) => void
  handleAddClick: () => void
  userData: any
  cardsRef: React.RefObject<HTMLDivElement | null>
  cardElementsRef: React.MutableRefObject<(HTMLDivElement | null)[]>
  setCardRef: (index: number) => (el: HTMLDivElement | null) => void
  AnimatedListItem: React.ComponentType<{ children: React.ReactNode; delay?: number; index: number }>
  emptyStateMessage?: string
  emptyStateDescription?: string
  addButtonText?: string
}

export default function InventoryContent({
  title,
  allProducts,
  filteredProducts,
  displayedProducts,
  searchQuery,
  setSearchQuery,
  isSearching,
  viewMode,
  setViewMode,
  loading,
  loadingCount,
  totalItems,
  totalPages,
  currentPage,
  setCurrentPage,
  goToPage,
  goToPreviousPage,
  goToNextPage,
  getPageNumbers,
  handleViewDetails,
  handleEditClick,
  handleDeleteClick,
  handleAddClick,
  userData,
  cardsRef,
  cardElementsRef,
  setCardRef,
  AnimatedListItem,
  emptyStateMessage = "No items found",
  emptyStateDescription = "Click the Add button to create your first item.",
  addButtonText = "Add Item"
}: InventoryContentProps) {
  const { isMobile, isTablet } = useResponsive()

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">{title}</h1>
        <Button
          className="bg-white border border-[#c4c4c4] text-[#333333] hover:bg-gray-50"
          style={{
            height: '29.37px',
            width: '117.46px',
            borderRadius: '7.53px',
            borderWidth: '1.205px',
            fontSize: '12px',
            fontWeight: '500'
          }}
          onClick={handleAddClick}
        >
          +Add Site
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Search: </span>
          <div className="relative">
            <Input
              placeholder="Search"
              className="pl-3 pr-10 w-80"
              style={{
                borderRadius: '6.002px',
                border: '1.2px solid #C4C4C4',
                background: '#FFF'
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && !isSearching && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a1a1a1] hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a1a1a1] w-4 h-4 animate-spin" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className={viewMode === "list" ? "bg-gray-100" : ""}>
            <List className="w-4 h-4 text-[#a1a1a1]" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "bg-gray-100" : ""}>
            <Grid3X3 className="w-4 h-4 text-[#a1a1a1]" />
          </Button>
        </div>
      </div>

      {/* Inventory Display - Grid or List View */}
      {viewMode === "grid" ? (
        /* Grid View */
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {loading && allProducts.length === 0
           ? Array.from({ length: 8 }).map((_, index) => (
               <Card key={`shimmer-${index}`} className="overflow-hidden border border-gray-200 shadow-lg rounded-xl">
                 <div className="h-36 bg-gray-200 animate-pulse rounded-t-xl" />
                 <CardContent className="p-3">
                   <div className="space-y-1">
                     <div className="h-3 bg-gray-200 rounded animate-pulse" />
                     <div className="h-3 bg-gray-200 rounded animate-pulse" />
                     <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse" />
                   </div>
                 </CardContent>
               </Card>
             ))
            : displayedProducts.map((product, index) => (
                <Card
                  key={product.id}
                  ref={setCardRef(index)}
                  className="bg-white border-[#d9d9d9] shadow-lg hover:shadow-xl transition-shadow cursor-pointer rounded-xl"
                  onClick={() => product.id && handleViewDetails(product.id)}
                >
                  <div className="h-48 bg-gray-200 relative rounded-t-xl overflow-hidden">
                    <Image
                      src={
                        product.media && product.media.length > 0
                          ? product.media[0].url
                          : "/abstract-geometric-sculpture.png"
                      }
                      alt={product.name || "Product image"}
                      fill
                      className="object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/abstract-geometric-sculpture.png"
                        target.className = "opacity-50"
                      }}
                    />
                  </div>

                  <CardContent className="p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="font-semibold text-xs text-black line-clamp-1 leading-tight">{product.name}</p>
                      <p className="font-semibold text-xs text-black leading-tight">{product.specs_rental?.location_label || product.specs_rental?.location || "Location"}</p>
                      <p className="font-semibold text-xs text-black leading-tight">P{Number(product.price).toLocaleString()}/ day</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white border border-[#d9d9d9] rounded-lg overflow-hidden">
          {/* List Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="grid grid-cols-10 gap-4 text-sm font-medium text-gray-700">
              <div className="col-span-4">Item Details</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Price</div>
            </div>
          </div>

          {/* List Items */}
          <div className="divide-y divide-gray-200">
            {loading && allProducts.length === 0
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div key={`shimmer-list-${index}`} className="px-6 py-4">
                    <div className="grid grid-cols-10 gap-4 items-center">
                      <div className="col-span-4 flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-200 rounded animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                          <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                      </div>
                      <div className="col-span-2">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                      </div>
                      <div className="col-span-2">
                        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))
              : displayedProducts.map((product, index) => (
                  <AnimatedListItem key={product.id} delay={0.1} index={index}>
                    <div
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => product.id && handleViewDetails(product.id)}
                    >
                      <div className="grid grid-cols-10 gap-4 items-center">
                        {/* Item Details */}
                        <div className="col-span-4 flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={
                                product.media && product.media.length > 0
                                  ? product.media[0].url
                                  : "/abstract-geometric-sculpture.png"
                              }
                              alt={product.name || "Product image"}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = "/abstract-geometric-sculpture.png"
                                target.className = "opacity-50"
                              }}
                            />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 line-clamp-1">{product.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-1">
                              {product.description || "No description"}
                            </p>
                          </div>
                        </div>

                        {/* Type */}
                        <div className="col-span-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {product.content_type === "static" ? "Static" : "Digital"}
                          </span>
                        </div>

                        {/* Location */}
                        <div className="col-span-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin size={14} className="mr-1 flex-shrink-0" />
                            <span className="truncate">{product.specs_rental?.location || "Unknown"}</span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="col-span-2">
                          <span className="text-sm font-medium text-green-700">
                            ₱{Number(product.price).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </AnimatedListItem>
                ))}
          </div>
        </div>
      )}

      {/* Show empty state message when no products and not loading */}
      {!loading && allProducts.length === 0 && userData?.company_id && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">{emptyStateMessage}</div>
          <div className="text-gray-400 text-sm">{emptyStateDescription}</div>
        </div>
      )}

      {/* Show setup message when no company_id */}
      {!loading && !userData?.company_id && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">Welcome to your inventory!</div>
          <div className="text-gray-400 text-sm">
            Click the "{addButtonText}" button below to set up your company and create your first item.
          </div>
        </div>
      )}

      {/* Pagination Controls - Only show if there are products or multiple pages */}
      {(displayedProducts.length > 0 || totalPages > 1) && (
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
  )
}