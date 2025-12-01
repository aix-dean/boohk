"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import type { Product } from "@/lib/firebase-service"
import type { SearchResult } from "@/lib/algolia-service"

interface ProductCardProps {
  product: Product | SearchResult
  hasOngoingBooking: boolean
  onView: () => void
  isSearchResult?: boolean
}

export function ProductCard({
  product,
  hasOngoingBooking,
  onView,
  isSearchResult = false,
}: ProductCardProps) {
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
      ? `₱${Number((product as SearchResult).price).toLocaleString()}/month`
      : "Price not set"
    : (product as Product).price
      ? `₱${Number((product as Product).price).toLocaleString()}/month`
      : "Price not set"

  // Get site code
  const siteCode = isSearchResult
    ? (product as SearchResult).site_code || "N/A"
    : (product as Product).site_code || "N/A"

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
              {product.price ? `₱${Number(product.price).toLocaleString()}/month` : "Price not set"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}