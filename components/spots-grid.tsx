import React, { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

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
  const { userData } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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
        <div style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: '700', lineHeight: '100%' }}>Booking Requests</div>
        {/* Booking Requests Card */}
        <div className="relative w-[245px] h-[76px] flex-shrink-0 rounded-[7.911px] border-[2.373px] border-[#B8D9FF] bg-[#F6F9FF] mb-4 flex items-center cursor-pointer" onClick={() => setIsDialogOpen(true)}>
          <div className="flex items-center gap-3 p-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 7V15L16 11L9 7ZM21 3H3C1.9 3 1 3.9 1 5V17C1 18.1 1.9 19 3 19H8V21H16V19H21C22.1 19 23 18.1 23 17V5C23 3.9 22.1 3 21 3ZM21 17H3V5H21V17Z" fill="#333333"/>
            </svg>
            <div className="flex flex-col">
              <div style={{fontSize:'16px', fontWeight:700, lineHeight:'132%', color:'#333', fontFamily:'Inter'}}>BK#0001</div>
              <div style={{fontSize:'12px', fontWeight:400, lineHeight:'132%', color:'#333', fontFamily:'Inter'}}>Nov 4, 2025 · 1 Day</div>
              <div style={{fontSize:'12px', fontWeight:700, lineHeight:'132%', color:'#333', fontFamily:'Inter'}}>P15,000.00</div>
            </div>
          </div>
          <div className="absolute top-2 right-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="2" r="1.5" fill="#333333"/>
              <circle cx="8" cy="8" r="1.5" fill="#333333"/>
              <circle cx="8" cy="14" r="1.5" fill="#333333"/>
            </svg>
          </div>
        </div>
        <div style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: '700', lineHeight: '100%' }}>Site spots</div>
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="relative">
              <DialogTitle>New Booking</DialogTitle>
              <DialogClose className="absolute top-0 right-0">
                <X width="24.007" height="31.209" />
              </DialogClose>
            </DialogHeader>
            <div className="flex gap-4">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-sm font-medium">Dates</label>
                  <p className="text-sm">Nov 4, 2025 · 1 Day</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Display Name</label>
                  <p className="text-sm">BK#0001</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Total Payout</label>
                  <p className="text-sm">P15,000.00</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Booking Code</label>
                  <p className="text-sm">BK#0001</p>
                </div>
              </div>
              <div className="w-[320px] space-y-2">
                <label className="text-sm font-medium">Content</label>
                <div className="h-[320px] flex-shrink-0 rounded-[10px] bg-gray-100">
                  {/* Content area */}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="w-[90px] h-[24px] px-[29px] rounded-[6px] border-[1.5px] border-[#C4C4C4] bg-white">Decline</Button>
              <Button className="w-[90px] h-[24px] rounded-[6.024px] bg-[#30C71D]">Accept</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  } else {
    return spotsContent
  }
}
