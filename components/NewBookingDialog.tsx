import React, { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import type { Booking } from "@/lib/booking-service"

interface NewBookingDialogProps {
   open: boolean
   onOpenChange: (open: boolean) => void
   booking: Booking | null
   playerOnline: boolean | null
   isAccepting: boolean
   onReject: () => void
   onAccept: () => void
   retailSpotNumbers: number[]
   takenSpotNumbers: number[]
   totalSpots: number
   activePages: any[]
   disabled?: boolean
 }

export function NewBookingDialog({
   open,
   onOpenChange,
   booking,
   playerOnline,
   isAccepting,
   onReject,
   onAccept,
   takenSpotNumbers,
   retailSpotNumbers,
   totalSpots,
   activePages,
   disabled = false
 }: NewBookingDialogProps) {
  // Local function to format booking dates
  const formatBookingDates = (startDate: any, endDate: any): string => {
    if (!startDate || !endDate) return "N/A"
    try {
      const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate)
      
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
      const startDay = start.getDate()
      const startYear = start.getFullYear()
      
      const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
      const endDay = end.getDate()
      const endYear = end.getFullYear()
      
      // If dates are the same, return single date
      if (start.getTime() === end.getTime()) {
        return `${startMonth} ${startDay} ${startYear}`
      }
      
      // If same month and year, return "Nov 12 - 20 2020"
      if (startMonth === endMonth && startYear === endYear) {
        return `${startMonth} ${startDay} - ${endDay} ${startYear}`
      }
      
      // Different months/years, return full range
      return `${startMonth} ${startDay} - ${endMonth} ${endDay} ${endYear}`
    } catch (error) {
      console.error("Error formatting booking dates:", error)
      return "Invalid Dates"
    }
  }

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
      <DialogContent className=" overflow-auto" style={{ height: "500px", width: "800px" }}>
        <DialogHeader className="relative">
          <DialogTitle>New Booking</DialogTitle>
          <DialogClose className="absolute top-[-10px] right-0">
            <X width="24.007" height="31.209" />
          </DialogClose>
        </DialogHeader>
        {booking && (
          <div className="flex gap-4">
            <div className=" flex-1">
              <div className="text-xs font-bold mb-[12px]">Booking Details</div>
              <div className="flex">
                <span className="text-xs w-[100px]">Booking ID:</span>
                <span className="text-xs font-bold">{booking.reservation_id}</span>
              </div>
              <div className="flex">
                <span className="text-xs w-[100px] ">Received On:</span>
                <span className="text-xs font-bold">{booking.created?.toDate ? booking.created.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
              </div>
              <div className="flex mb-[18px]">
                <span className="text-xs w-[100px]">Channel:</span>
                <span className="text-xs font-bold">{booking.channel.name || 'N/A'}</span>
              </div>
              <div className="flex">
                <span className="text-xs w-[100px]">Dates:</span>
                <span className="text-xs font-bold">{formatBookingDates(booking.start_date, booking.end_date)}</span>
              </div>
              <div className="flex">
                <span className="text-xs w-[100px]">Status:</span>
                <span className="text-xs font-bold">{booking.status || 'N/A'}</span>
              </div>
              <div className="flex">
                <span className="text-xs w-[100px]">Amount:</span>
                <span className="text-xs font-bold">{booking.costDetails?.total.toLocaleString("en-PH", {
                  style: "currency",
                  currency: "PHP"
                }) || booking.cost?.toLocaleString("en-PH", {
                  style: "currency",
                  currency: "PHP"
                }) || "0"}</span>
              </div>
              <div className="flex">
                <span className="text-xs w-[100px]">Site:</span>
                <span className="text-xs font-bold">{booking.product_name || booking.project_name || "N/A"}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold">Content</div>
              <div className="relative flex items-center justify-center bg-gray-100">
                <div className={`flex items-center justify-center overflow-hidden ${scaledWidth && scaledHeight ? '' : 'aspect-square'}`} style={scaledWidth && scaledHeight ? { width: `${scaledWidth}px`, height: `${scaledHeight}px` } : {}}>
                  {booking.url ? (
                    <video
                      key={booking.url}
                      src={booking.url}
                      width={scaledWidth}
                      height={scaledHeight}
                      disablePictureInPicture
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
          </div>
        )}
        <DialogFooter>
           <Button variant="outline" onClick={onReject} disabled={disabled} className="w-[90px] h-[24px] px-[29px] rounded-[6px] border-[1.5px] border-[#C4C4C4] bg-white">Decline</Button>
           <Button onClick={onAccept} disabled={!playerOnline || disabled} className="w-[120px] h-[24px] rounded-[6.024px] bg-[#30C71D]">
             {isAccepting ? <><Loader2 className="animate-spin mr-1 h-4 w-4" /></> : "Accept"}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}