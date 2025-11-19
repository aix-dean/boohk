"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Booking } from 'oh-db-models'

interface TransactionsTableProps {
  transactions: Booking[]
  totalItems: number
  currentPage: number
  onPageChange: (page: number) => void
  itemsPerPage?: number
  onRowClick?: (booking: Booking) => void
}

export function TransactionsTable({
  transactions,
  totalItems,
  currentPage,
  onPageChange,
  itemsPerPage = 15,
  onRowClick
}: TransactionsTableProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const formatCurrency = (amount: number, currency: string = 'PHP') => {
    return `${currency === 'IDR' ? 'Rp' : '₱'}${amount.toLocaleString()}`
  }

  const formatDate = (date: Date | any) => {
    if (!date) return 'N/A'

    let d: Date

    if (date instanceof Date) {
      d = date
    } else if (typeof date === 'number') {
      // Handle Unix timestamp in milliseconds
      d = new Date(date)
    } else if (date && typeof date === 'object' && date.seconds) {
      // Handle Firestore timestamp
      d = new Date(date.seconds * 1000)
    } else {
      // Try to parse as string or other format
      d = new Date(date)
    }

    // Check if date is valid
    if (isNaN(d.getTime())) {
      return 'Invalid Date'
    }

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }
  const getMillis = (date: Date | any): number => {
    if (!date) return 0

    if (date instanceof Date) {
      return date.getTime()
    } else if (typeof date === 'number') {
      // Assume it's already milliseconds
      return date
    } else if (date && typeof date === 'object' && date.seconds) {
      // Handle Firestore timestamp
      return date.seconds * 1000
    } else if (date && typeof date === 'object' && date.toMillis) {
      // Handle Firestore timestamp with toMillis
      return date.toMillis()
    } else {
      // Try to parse as string or other format
      const d = new Date(date)
      return isNaN(d.getTime()) ? 0 : d.getTime()
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "text-[#30c71d] bg-transparent border-transparent"
      case "for review":
        return "text-[#2d3fff] bg-transparent border-transparent"
      case "upcoming":
        return "text-[#30c71d] bg-transparent border-transparent"
      case "declined":
        return "text-[#f95151] bg-transparent border-transparent"
      default:
        return "text-gray-600 bg-transparent border-transparent"
    }
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No transactions found
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[10px] overflow-hidden px-[15px]">
      {/* Table Header */}
      <div className="bg-white px-4 py-1.5">
        <div className="grid grid-cols-10 gap-2 text-xs font-semibold text-gray-700">
          <div className="min-w-16 py-1 px-2 mt-1">Date</div>
          <div className="min-w-24 py-1 px-2 mt-1">Site</div>
          <div className="min-w-20 py-1 px-2 mt-1">Airing Ticket</div>
          <div className="min-w-16 py-1 px-2 mt-1">Total Days</div>
          <div className="min-w-20 py-1 px-2 mt-1">Gross Amount</div>
          <div className="min-w-16 py-1 px-2 mt-1">Fees</div>
          <div className="min-w-16 py-1 px-2 mt-1">Tax (12%)</div>
          <div className="min-w-16 py-1 px-2 mt-1">Discount</div>
          <div className="min-w-20 py-1 px-2 mt-1">Payout Amount</div>
          <div className="min-w-16 py-1 px-2 mt-1">Status</div>
        </div>
      </div>

      {/* Table Rows */}
      <div className="border-t border-gray-200">
        {transactions.map((booking) => {
           const isForReview = booking.status?.toLowerCase() === "for review"
           const isClickable = onRowClick && (isForReview ? booking.id : true)
           return (
             <div key={booking.id}>
               <hr key={`hr-${booking.id}`} className={`border-gray-200 ${isForReview ? 'mb-2' : ''}`} />
               <div
                 key={`row-${booking.id}`}
                 className={`px-4 rounded-[10px] ${isForReview ? 'bg-[#F6F9FF] border-2 border-[#B8D9FF] border-solid mb-1' : 'bg-white'} ${isClickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                 onClick={() => isClickable && onRowClick(booking)}
               >
                <div className="grid grid-cols-10 gap-2 text-xs items-center">
                {/* Date */}
                <div className="min-w-16 py-1 px-2 mt-1 text-gray-900">
                  {formatDate(booking.created)}
                </div>

                {/* Site Name */}
                <div className="min-w-24 text-xs font-medium text-gray-900 truncate">
                  {booking.items?.name || 'Unknown'}
                </div>

                {/* Airing Code */}
                <div className="min-w-20 py-1 px-2 mt-1 text-gray-900 truncate">
                  {booking.airing_code || '-'}
                </div>

                {/* Total Days */}
                <div className="min-w-16 py-1 px-2 mt-1 text-gray-900">
                  {booking.start_date && booking.end_date ? Math.ceil((getMillis(booking.end_date) - getMillis(booking.start_date)) / (1000 * 60 * 60 * 24)) : booking.costDetails?.days || 1}
                </div>

                {/* Gross Amount */}
                <div className="min-w-20 py-1 px-2 mt-1 text-gray-900 font-medium truncate">
                  {formatCurrency(booking.total_cost || 0, 'PHP')}
                </div>

                {/* Fees */}
                <div className="min-w-16 py-1 px-2 mt-1 text-gray-900 truncate">
                  {formatCurrency(booking.costDetails?.otherFees || 0, 'PHP')}
                </div>

                {/* Tax (12%) */}
                <div className="min-w-16 py-1 px-2 mt-1 text-gray-900 truncate">
                  {formatCurrency(booking.costDetails?.vatAmount || 0, 'PHP')}
                </div>

                {/* Discount */}
                <div className="min-w-16 py-1 px-2 mt-1 text-gray-900 truncate">
                  {formatCurrency(booking.costDetails?.discount || 0, 'PHP')}
                </div>

                {/* Payout Amount */}
                <div className="min-w-20 py-1 px-2 mt-1 text-gray-900 font-medium truncate">
                  {formatCurrency((booking.transaction?.amount || 0) - ((booking.tax?.taxAmount || 0) + (booking.transaction?.fees.totalFee || 0) + (booking.discount?.discountTotal || 0)), 'PHP')}
                </div>

                {/* Status */}
                <div className="min-w-16 py-1 px-2 mt-1">
                  <span className={`text-xs font-medium ${getStatusStyle(booking.status || '')}`}>
                    {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1).toLowerCase() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center px-6 py-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-700">
              {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
