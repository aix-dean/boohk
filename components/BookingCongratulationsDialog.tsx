"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { X } from "lucide-react"
import Image from "next/image"
import { formatBookingDates } from "@/lib/booking-service"
import Barcode from 'react-barcode';

interface Booking {
  id: string
  reservation_id?: string
  start_date: any
  end_date: any
  client: {
    name: string
    company_name?: string
  }
  total_cost: number
  product_name?: string
  project_name?: string
  url?: string
  type?: string
  airing_code?: string
}

interface BookingCongratulationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking
}

export function BookingCongratulationsDialog({ open, onOpenChange, booking }: BookingCongratulationsDialogProps) {
  const ticketCode = booking.airing_code || "BH" + Date.now()
  const dateAccepted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const company = booking.client.company_name || booking.client.name
  const dates = formatBookingDates(booking.start_date, booking.end_date)
  const formatSchedule = (startDate: any, endDate: any): string => {
    if (!startDate || !endDate) return ""
    try {
      const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate)
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
      const startDay = start.getDate()
      const endDay = end.getDate()
      const year = start.getFullYear()
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    } catch {
      return ""
    }
  }
  const schedule = formatSchedule(booking.start_date, booking.end_date)
  const displayName = booking.product_name || booking.project_name || "N/A"
  const totalPayout = `₱${booking.total_cost?.toLocaleString() || "0"}`
  const bookingCode = booking.reservation_id
  const contentLabel = booking.type?.toUpperCase() || "CONTENT"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] h-[460px] max-w-none p-0 bg-white border-0">
        <div className="relative w-full h-full bg-white rounded-lg p-6 flex flex-col">
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-1 right-1 text-gray-700 text-2xl font-light transform rotate-45"
          >
            +
          </button>

          {/* Header row */}
          <div className="flex items-center mb-2">
            <Image src="/check_outline.svg" alt="Check" width={50} height={50} className="mr-4" />
            <h1 className="text-2xl font-bold text-gray-800">Congratulations!</h1>
          </div>

          {/* Subtext */}
          <p className="text-sm text-gray-800 mb-3">
            <span className="font-bold">Congratulations!</span> Great to see your inventory in action.<br />Here's your official Airing Ticket.
          </p>

          {/* Ticket card */}
          <div className="flex-1 relative bg-white mb-3 shadow-lg rounded-lg overflow-hidden">
            {/* Gradient Header */}
            <div className="w-full h-11 bg-gradient-to-r from-purple-500 via-slate-600 to-blue-500 rounded-t-lg flex items-center px-6">
              <div className="text-white text-base">Airing Ticket Code</div>
              <div className="ml-auto text-white text-base font-bold">{ticketCode}</div>
            </div>

            {/* White Body */}
            <div className="w-full bg-white rounded-b-lg p-4 relative">
              <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-4">
                {/* Confirmation Details */}
                <div>
                  <div className="text-gray-800 text-xs font-bold mb-2">Confirmation Details</div>
                  <div className="text-gray-800 text-xs mb-1">Date Accepted</div>
                  <div className="text-gray-800 text-base font-bold mb-2">{dateAccepted}</div>
                  <div className="text-gray-800 text-xs mb-1">Company</div>
                  <div className="text-gray-800 text-base font-bold">{company}</div>
                </div>

                {/* Booking Details */}
                <div>
                  <div className="text-gray-800 text-xs font-bold mb-2">Booking Details</div>
                  <div className="text-gray-800 text-xs mb-1">Dates</div>
              <div className="text-start text-gray-800 text-sm font-bold mb-4">{schedule}</div>
                  <div className="text-gray-800 text-xs mb-1">Display Name</div>
                  <div className="text-gray-800 text-base font-bold mb-2 truncate">{displayName}</div>
                  <div className="text-gray-800 text-xs mb-1">Total Payout</div>
                  <div className="text-gray-800 text-base font-bold mb-2">₱{booking.total_cost?.toLocaleString() || "0"}</div>
                  <div className="text-gray-800 text-xs mb-1">Booking Code</div>
                  <div className="text-gray-800 text-sm font-bold">{bookingCode}</div>
                </div>

                {/* Content */}
                <div>
                  <div className="text-gray-800 text-xs mb-2"style={{ transform: 'translate(-80px,0px)' }}>Content</div>

                  <div className=" w-[320px] h-[160px] bg-gray-100 rounded-lg overflow-hidden"style={{ transform: 'translate(-80px,0px)' }}>
                    {/* The media */}
                    {booking.url ? (
                      booking.url.includes('.mp4') || booking.url.includes('video') ? (
                        <video src={booking.url} className="w-full h-full object-cover" controls autoPlay />
                      ) : (
                        <img src={booking.url} alt="Content preview" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-500 text-xs">No Media</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* STACKED barcode overlay - Moved outside content div */}
              <div
                className="absolute right-4 top-12 px-1 py-1 flex flex-col items-center"
                style={{ transform: 'translate(25px, 30px)' }}
              >
                <div style={{ transform: 'rotate(90deg)' }}>
                  <Barcode
                    value={ticketCode}
                    format="CODE128"
                    width={1}
                    height={50}
                    displayValue={false}
                    lineColor="#000000"
                  />
                </div>
                <div className="text-black text-xs font-bold mt-1" style={{ transform: 'translate(45px, -40px) rotate(270deg)' }}>
                  {ticketCode}
                </div>
              </div>
            </div>
          </div>

          {/* OK Button */}
          <button onClick={() => onOpenChange(false)} className="self-end  w-[90px] h-[24px] rounded-[6.024px] bg-[#1D0BEB] text-white text-xs font-bold">OK</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}