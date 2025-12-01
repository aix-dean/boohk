"use client"

import { X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Booking } from 'oh-db-models'

interface TransactionDetailsDialogProps {
  transaction?: Booking | null
  booking?: Booking | null
  isOpen: boolean
  onClose: () => void
}

export default function transactionDetailsDialog({
  transaction,
  booking,
  isOpen,
  onClose
}: TransactionDetailsDialogProps) {
  if (!transaction || !isOpen) return null

  const bookingData = transaction // Since transaction is now Booking

  const formatCurrency = (amount: number, currency: string = 'PHP') => {
    return `${currency === 'IDR' ? 'Rp' : '₱'}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: Date | any) => {
    if (!date) return 'N/A'

    let d: Date

    if (date instanceof Date) {
      d = date
    } else if (typeof date === 'number') {
      d = new Date(date)
    } else if (date && typeof date === 'object' && date.seconds) {
      d = new Date(date.seconds * 1000)
    } else {
      d = new Date(date)
    }

    if (isNaN(d.getTime())) {
      return 'Invalid Date'
    }

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3.5">
      <div className="bg-[#ffffff] rounded-lg shadow-lg overflow-hidden flex flex-col" style={{ width: '491px', height: '570px' }}>
        {/* Header */}
        <div className="flex items-start justify-between pt-3.5 pb-4 px-6">
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
            <img src="/info.png" alt="Info" className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="text-[#333333] hover:text-[#a1a1a1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Information */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 px-6 flex-1">
          {/* Left Column */}
          <div className="space-y-0.5">
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Airing Ticket Code:</span>
              <span className="text-[#333333] text-xs font-bold">{bookingData.airing_code || "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Issued On:</span>
              <span className="text-[#333333] text-xs font-bold">{formatDate(bookingData.created)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Booking ID:</span>
              <span className="text-[#333333] text-xs font-bold">{bookingData.reservation_id || '-'}</span>
            </div>
           <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Received On:</span>
              <span className="text-[#333333] text-xs font-bold">{formatDate(bookingData.created)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Channel:</span>
              <span className="text-[#333333] text-xs font-bold">{bookingData.items?.length || 1}</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-0.5">
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Dates:</span>
              <span className="text-[#333333] text-xs font-bold">{formatDate(bookingData.start_date) + " to " + formatDate(bookingData.end_date) || "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Status:</span>
              <span className={`text-xs font-bold ${
                bookingData.status?.toLowerCase() === "paid" ? "text-[#30c71d]" :
                bookingData.status?.toLowerCase() === "for review" ? "text-[#2d3fff]" :
                bookingData.status?.toLowerCase() === "upcoming" ? "text-[#30c71d]" :
                bookingData.status?.toLowerCase() === "declined" ? "text-[#f95151]" :
                "text-gray-600"
              }`}>
                {bookingData.status ? bookingData.status.charAt(0).toUpperCase() + bookingData.status.slice(1).toLowerCase() : "-" }
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Amount:</span>
              <span className="text-[#333333] text-xs font-bold">{bookingData.transaction?.amount ? formatCurrency(bookingData.transaction.amount, 'PHP') : "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Site:</span>
              <span className="text-[#333333] text-xs font-bold">{bookingData.items?.name ||  "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#333333] text-xs">Spot:</span>
              <span className="text-[#333333] text-xs font-bold">{bookingData.spot_number || "-"}</span>
            </div>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative px-4 mb-3.5">
          <div className="h-[380px] flex-shrink-0 rounded-[10px] bg-gray-100 flex items-center justify-center">
            {booking?.url ? (
              booking.url.includes('.mp4') || booking.url.includes('video') ? (
                <video src={booking.url} disablePictureInPicture className="w-full h-[380px] object-contain rounded-[10px]" controls />
              ) : (
                <img src={booking.url} alt="Content preview" className="w-full h-[380px] object-contain rounded-[10px]" />
              )
            ) : (
              <div className="w-full h-full bg-gray-300 flex items-center justify-center rounded-[10px]">
                <span className="text-gray-500 text-xs">No Media</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}