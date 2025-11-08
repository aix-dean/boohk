import React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"

interface Spot {
  id: string
  number: number
  status: "occupied" | "vacant"
  clientName?: string
  imageUrl?: string
}

interface SpotsGridProps {
  spots: Spot[]
  totalSpots: number
  occupiedCount: number
  vacantCount: number
  productId?: string
  currentDate: string
  router?: any
  selectedSpots?: number[]
  onSpotToggle?: (spotNumber: number) => void
  showSummary?: boolean
  bg?: boolean
}

export function SpotsGrid({ spots, totalSpots, occupiedCount, vacantCount, productId, currentDate, router, selectedSpots, onSpotToggle, showSummary = true, bg = true }: SpotsGridProps) {

  const handleSpotClick = (spotNumber: number) => {
    if (productId) {
      router?.push(`/sales/products/${productId}/spots/${spotNumber}`)
    }
  }

  const spotsContent = (
    <div className="flex gap-[13.758px] overflow-x-scroll pb-4 w-full pr-4">
    {spots.map((spot) => (
      <div
        key={spot.id}
        className="relative flex-shrink-0 w-[110px] h-[197px] bg-white p-1.5 rounded-[14px] shadow-[-1px_3px_7px_-1px_rgba(0,0,0,0.25)] border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex flex-col"
        onClick={() => onSpotToggle ? onSpotToggle(spot.number) : handleSpotClick(spot.number)}
      >
        {onSpotToggle && (
          <div className="absolute top-1 left-1 z-10">
            <Checkbox
              checked={selectedSpots?.includes(spot.number) || false}
              onChange={() => onSpotToggle(spot.number)}
              className="bg-white border-2 border-gray-300"
            />
          </div>
        )}

        {/* Image Section */}
        <div className="flex-1 p-1 rounded-[10px] bg-white flex justify-center relative overflow-hidden">
          {spot.imageUrl ? (
            <>
              {console.log(`Rendering image for spot ${spot.number}:`, spot.imageUrl)}
              <Image
                src={spot.imageUrl}
                alt={`Spot ${spot.number} report image`}
                fill
                className="object-cover"
                onError={(e) => {
                  console.log(`Image failed to load for spot ${spot.number}:`, spot.imageUrl)
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    const fallback = document.createElement('span')
                    fallback.className = 'text-gray-400 text-xs'
                    fallback.textContent = `Spot ${spot.number}`
                    parent.appendChild(fallback)
                  }
                }}
              />
            </>
          ) : (
            <>
              {console.log(`No imageUrl for spot ${spot.number}`)}
              <span className="text-gray-400 text-xs">Spot {spot.number}</span>
            </>
          )}
        </div>

        {/* Content Section */}
        <div className="flex flex-col p-1 bg-white">
          {/* Spot Number */}
          <div className="text-[11px] font-semibold text-black">
            {spot.number}/{totalSpots}
          </div>

          {/* Status */}
          <div className={`text-[11px] font-semibold ${
            spot.status === "occupied" ? "text-[#00d0ff]" : "text-[#a1a1a1]"
          }`}>
            {spot.status === "occupied" ? "Occupied" : "Vacant"}
          </div>

          {/* Client Name */}
          <div className={`text-[11px] font-semibold truncate ${
            spot.status === "occupied" ? "text-black" : "text-[#a1a1a1]"
          }`}>
            {spot.clientName || "Filler Content 1"}
          </div>
        </div>
      </div>
    ))}
    </div>
  )

  if (bg) {
    return (
      <div className="space-y-4">
        {/* Spots Grid */}
        <div className="bg-[#ECECEC] rounded-[13.8px] p-4">
          {showSummary && (
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="flex items-center gap-8">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">Total Spots:</span>
                  <span className="text-gray-700">{totalSpots}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">Total Occupied:</span>
                  <span className="text-cyan-600 font-medium">{occupiedCount} ({Math.round((occupiedCount / totalSpots) * 100)}%)</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">Total Vacant:</span>
                  <span className="font-bold text-gray-700">{vacantCount} ({Math.round((vacantCount / totalSpots) * 100)}%)</span>
                </div>
              </div>
              <span
                onClick={() => router?.push(`/sales/products/${productId}/spots/1`)}
                className="text-blue-600 cursor-pointer"
              >
                as of {currentDate} {'->'}
              </span>
            </div>
          )}
          {spotsContent}
        </div>
      </div>
    )
  } else {
    return spotsContent
  }
}
