import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { bookingService, Booking, formatBookingDates } from "@/lib/booking-service"

interface Spot {
  id: string
  number: number
  status: "occupied" | "vacant"
  clientName?: string
  imageUrl?: string
  booking_id?: string
}

interface SpotContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  spot: Spot | null
}

const SpotContentDialog: React.FC<SpotContentDialogProps> = ({ open, onOpenChange, spot }) => {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    const fetchBooking = async () => {
      if (spot?.booking_id) {
        setBookingLoading(true)
        try {
          const bookingData = await bookingService.getBookingById(spot.booking_id)
          setBooking(bookingData)
        } catch (error) {
          console.error("Error fetching booking:", error)
        } finally {
          setBookingLoading(false)
        }
      } else {
        setBooking(null)
      }
    }

    fetchBooking()
  }, [spot?.booking_id])

  if (!spot) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-6">
        <DialogHeader className="relative">
          <DialogTitle className="text-left">View content</DialogTitle>
          <DialogClose className="absolute top-[-10px] right-[-10px]">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>
        <div className="space-y-4">
          {/* Info Section */}
          <div className="grid grid-cols-3 gap-4 text-left">
             <div>
               <div className="text-xs text-gray-600 mb-1">Airing Ticket Code</div>
               <div className="text-xs font-bold">
                 {bookingLoading ? "Loading..." : (booking?.airing_code || "N/A")}
               </div>
             </div>
             <div>
               <div className="text-xs text-gray-600 mb-1">Dates</div>
               <div className="text-xs font-bold">
                 {bookingLoading ? "Loading..." : formatBookingDates(booking?.start_date, booking?.end_date)}
               </div>
             </div>
             <div>
               <div className="text-xs text-gray-600 mb-1">Booking Code</div>
               <div className="text-xs font-bold truncate max-w-[100px]">
                 {bookingLoading ? "Loading..." : (booking?.id || "N/A")}
               </div>
             </div>
           </div>

          {/* Content Section */}
          <div className="relative">
            <div className="aspect-square rounded-[10px] bg-gray-100 flex items-center justify-center overflow-hidden">
              {spot.imageUrl ? (
                <video
                  key={spot.imageUrl} // <-- Add this line
                  src={spot.imageUrl}
                  className="object-cover h-full w-full"
                  controls
                  autoPlay
                />
              ) : (
                <span className="text-gray-500">No content available</span>
              )}
            </div>
            {/* Plus icon positioned at bottom right of content */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { SpotContentDialog }