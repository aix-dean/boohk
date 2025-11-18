"use client"

import React from "react"
import { Transaction } from 'oh-db-models'

interface TransactionsTableProps {
  transactions: Transaction[]
  totalItems: number
  currentPage: number
  onPageChange: (page: number) => void
  itemsPerPage?: number
  onRowClick?: (transaction: Transaction) => void
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
        <div className="grid grid-cols-10 gap-6 text-xs font-semibold text-gray-700">
          <div className="col-span-1 py-1 px-2 mt-1">Date</div>
          <div className="col-span-1 py-1 px-2 mt-1">Site Name</div>
          <div className="col-span-1 py-1 px-2 mt-1">Booking ID</div>
          <div className="col-span-1 py-1 px-2 mt-1">Total Days</div>
          <div className="col-span-1 py-1 px-2 mt-1">Gross Amount</div>
          <div className="col-span-1 py-1 px-2 mt-1">Fees</div>
          <div className="col-span-1 py-1 px-2 mt-1">Tax (12%)</div>
          <div className="col-span-1 py-1 px-2 mt-1">Discount</div>
          <div className="col-span-1 py-1 px-2 mt-1">Payout Amount</div>
          <div className="col-span-1 py-1 px-2 mt-1">Status</div>
        </div>
      </div>

      {/* Table Rows */}
      <div className="border-t border-gray-200">
        {transactions.map((transaction) => {
           const isForReview = transaction.status?.toLowerCase() === "for review"
           const isClickable = onRowClick && transaction.bookingId
           return (
             <React.Fragment key={transaction.id}>
               <hr className={`border-gray-200 ${isForReview ? 'mb-2' : ''}`} />
               <div
                 className={`px-4 rounded-[10px] ${isForReview ? 'bg-[#F6F9FF] border-2 border-[#B8D9FF] border-solid mb-1' : 'bg-white'} ${isClickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                 onClick={() => isClickable && onRowClick(transaction)}
               >
                <div className="grid grid-cols-10 gap-6 text-xs items-center">
                {/* Date */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900">
                  {formatDate(transaction.createdAt)}
                </div>

                {/* Site Name */}
                <div className="text-xs font-medium text-gray-900">
                  {transaction.client?.name || transaction.merchantName || 'Unknown'}
                </div>

                {/* Booking ID */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900">
                  {transaction.reservationId || '-'}
                </div>

                {/* Total Days */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900">
                  {transaction.items?.length || 1}
                </div>

                {/* Gross Amount */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900 font-medium">
                  {formatCurrency(transaction.amount || 0, transaction.currency)}
                </div>

                {/* Fees */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900">
                  {formatCurrency(transaction.fees?.totalFee || 0, transaction.currency)}
                </div>

                {/* Tax (12%) */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900">
                  {formatCurrency((transaction.tax?.taxAmount || 0), transaction.currency)}
                </div>

                {/* Discount */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900">
                  {formatCurrency((transaction.discount?.discountTotal || 0), transaction.currency)}
                </div>

                {/* Payout Amount */}
                <div className="col-span-1 py-1 px-2 mt-1 text-gray-900 font-medium">
                  {formatCurrency(transaction.amount - (transaction.tax?.taxAmount || 0 + transaction.fees?.totalFee || 0 + transaction.discount?.discountTotal || 0), transaction.currency)}
                </div>

                {/* Status */}
                <div className="col-span-1 py-1 px-2 mt-1">
                  <span className={`text-xs font-medium ${getStatusStyle(transaction.status || '')}`}>
                    {transaction.status ? transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1).toLowerCase() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </React.Fragment>
        )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
              if (pageNum > totalPages) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${
                    pageNum === currentPage
                      ? 'text-blue-600 bg-blue-50 border border-blue-300'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
