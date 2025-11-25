import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

interface Spot {
  id: string
  number: number
  status: "occupied" | "vacant"
  clientName?: string
  imageUrl?: string
  booking_id?: string
}

interface Page {
  spot_number: number
  schedules?: any[]
  widgets?: any[]
}

interface OperatorContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spot: Spot | null
  productId?: string
  activePages: Page[]
  onEdit?: () => void
}

const OperatorContentDialog: React.FC<OperatorContentDialogProps> = ({ open, onOpenChange, spot, productId, activePages, onEdit }) => {
  const [scaledWidth, setScaledWidth] = useState<number | undefined>(undefined)
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const fetchProductSpecs = async () => {
      if (!productId) return

      try {
        const productRef = doc(db, "products", productId)
        const productSnap = await getDoc(productRef)
        if (productSnap.exists()) {
          const product = productSnap.data()
          const originalWidth = product.specs_rental?.width
          const originalHeight = product.specs_rental?.height
          if (originalWidth && originalHeight) {
            const availableWidth = 450
            const availableHeight = 300
            const scale = Math.min(availableWidth / originalWidth, availableHeight / originalHeight)
            setScaledWidth(Math.floor(originalWidth * scale))
            setScaledHeight(Math.floor(originalHeight * scale))
          }
        }
      } catch (error) {
        console.error("Error fetching product specs:", error)
      }
    }

    fetchProductSpecs()
  }, [productId])

  if (!spot) return null

  const page = activePages.find(p => p.spot_number === spot.number)
  const schedules = page?.schedules || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[500px] h-[470px] rounded-xl overflow-auto flex flex-col gap-4">
        <DialogHeader className="relative">
          <DialogTitle className="text-left">Operator Content</DialogTitle>
          <DialogClose className="absolute top-[-10px] right-[-10px]">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>
        <div className="space-y-2 bg-white rounded-xl">
          {/* Info Section */}
          <div className="grid grid-cols-2 gap-2 text-left mb-4">
            {/* Left Container */}
            <div className="">
              {/* Spot Number */}
              <div className="flex items-start">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">Spot Number:</span>
                <span className="text-xs font-bold truncate whitespace-nowrap ml-2">
                  {spot.number}
                </span>
              </div>
            </div>

            {/* Right Container */}
            <div className="">
              {/* Dates */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 whitespace-nowrap">Dates:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {schedules.length > 0 ? (() => {
                    const startDate = schedules[0].startDate?.toDate ? schedules[0].startDate.toDate() : new Date(schedules[0].startDate)
                    const endDate = schedules[0].endDate?.toDate ? schedules[0].endDate.toDate() : new Date(schedules[0].endDate)
                    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  })() : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="relative flex items-center justify-center bg-gray-100">
            <div className={`flex items-center justify-center overflow-hidden ${scaledWidth && scaledHeight ? '' : 'aspect-square'}`} style={scaledWidth && scaledHeight ? { width: `${scaledWidth}px`, height: `${scaledHeight}px` } : {}}>
              {spot.imageUrl ? (
                <video
                  key={spot.imageUrl}
                  src={spot.imageUrl}
                  width={scaledWidth}
                  height={scaledHeight}
                  className="object-fill h-full w-full"
                  controls
                  autoPlay
                />
              ) : (
                <span className="text-gray-500">No content available</span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onEdit} className="w-[90px] h-[24px] rounded-[6px] bg-blue-600 text-white">
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { OperatorContentDialog }