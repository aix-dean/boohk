import React, { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { bookingService, formatBookingDates } from "@/lib/booking-service"
import {Booking} from 'oh-db-models'

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
          console.log("Fetched booking data:", bookingData)
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
  const originalWidth = booking?.items?.specs_rental.width;
  const originalHeight = booking?.items?.specs_rental.height;
  let scaledWidth = originalWidth;
  let scaledHeight = originalHeight;
  if (originalWidth && originalHeight) {
    const availableWidth = 450;
    const availableHeight = 300;
    const scale = Math.min(availableWidth / originalWidth, availableHeight / originalHeight);
    scaledWidth = Math.floor(originalWidth * scale);
    scaledHeight = Math.floor(originalHeight * scale);
  }



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[500px] h-[470px] rounded-xl overflow-auto flex flex-col gap-4">
        <DialogHeader className="relative">
          <DialogTitle className="text-left">View content</DialogTitle>
          <DialogClose className="absolute top-[-10px] right-[-10px]">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>
        <div className="space-y-2 bg-white rounded-xl">
          {/* Info Section */}
          <div className="grid grid-cols-2 gap-2 text-left mb-4">
            {/* Left Container */}
            <div className="">
              {/* Airing Ticket Code */}
              <div className="flex items-start">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">Airing Ticket Code:</span>
                <span className="text-xs font-bold truncate whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.airing_code ? booking.airing_code.slice(0, 8) : "N/A")}
                </span>
              </div>

              {/* Issued On */}
              <div className="flex items-start">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">Issued On:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.created ? new Date(booking.created.toDate ? booking.created.toDate() : booking.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A")}
                </span>
              </div>

              {/* Booking ID */}
              <div className="flex items-start">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">Booking ID:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2 truncate">
                  {bookingLoading ? "Loading..." : (booking?.reservation_id.slice(0, 10) || "N/A")}
                </span>
              </div>

              {/* Received On */}
              <div className="flex items-start">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">Received On:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.updated ? new Date(booking.updated.toDate ? booking.updated.toDate() : booking.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A")}
                </span>
              </div>

              {/* Channel */}
              <div className="flex items-start">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">Channel:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.channel?.name || "N/A")}
                </span>
              </div>
            </div>

            {/* Right Container (Now aligned) */}
            <div className="">
              {/* Dates */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 whitespace-nowrap">Dates:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : formatBookingDates(booking?.start_date, booking?.end_date)}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 ">Status:</span>
                <span className="text-xs font-bold text-gray-600 ml-2">
                  {bookingLoading ? "Loading..." : (() => {
                    if (!booking?.start_date || !booking?.end_date) return "N/A";
                    const now = new Date();
                    const start = booking.start_date.toDate ? booking.start_date.toDate() : booking.start_date;
                    const end = booking.end_date.toDate ? booking.end_date.toDate() : booking.end_date;
                    if (now > end) return "Completed";
                    if (now >= start) return "Ongoing";
                    return "Upcoming";
                  })()}
                </span>
              </div>

              {/* Amount */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 whitespace-nowrap">Amount:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.transaction?.amount ? `₱${booking.transaction?.amount.toLocaleString()}` : "N/A")}
                </span>
              </div>

              {/* Site */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 whitespace-nowrap">Site:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.items?.name || "N/A")}
                </span>
              </div>

              {/* Spot */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 whitespace-nowrap">Spot:</span>
                <span className="text-xs font-bold whitespace-nowrap ml-2">
                  {bookingLoading ? "Loading..." : (booking?.spot_number ? `${booking.spot_number}` : "N/A")}
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
            {/* Plus icon positioned at bottom right of content */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { SpotContentDialog }