"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MoreVertical, CheckCircle, Clock3, XCircle } from "lucide-react"
import { Booking } from "oh-db-models"

interface TransactionsTabProps {
  selectedYear: number
  setSelectedYear: (year: number) => void
  bookings: Booking[]
  bookingsLoading: boolean
  bookingsPage: number
  setBookingsPage: (page: number) => void
  itemsPerPage: number
  setSelectedBooking: (booking: Booking | null) => void
  setBookingDialogOpen: (open: boolean) => void
}

const TransactionsTab: React.FC<TransactionsTabProps> = ({
  selectedYear,
  setSelectedYear,
  bookings,
  bookingsLoading,
  bookingsPage,
  setBookingsPage,
  itemsPerPage,
  setSelectedBooking,
  setBookingDialogOpen,
}) => {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2020 + 1 }, (_, i) => 2020 + i)

  // Helper function to convert Firebase timestamp to readable date
  const formatFirebaseDate = (timestamp: any): string => {
    if (!timestamp) return ""

    try {
      // Check if it's a Firebase Timestamp object
      if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000)
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      }

      // If it's already a string or Date, handle accordingly
      if (typeof timestamp === "string") {
        return timestamp
      }

      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      }

      return ""
    } catch (error) {
      console.error("Error formatting date:", error)
      return ""
    }
  }

  const renderBookingStatusBadge = (booking: Booking) => {
    const now = new Date()
    let startDate: Date | null = null
    if (booking.start_date) {
      startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any)
    }
    if (startDate && startDate > now) {
      return (
        <span className="font-bold text-[#ff9500]">
          Upcoming
        </span>
      )
    }
    switch (booking.status?.toUpperCase()) {
      case "COMPLETED":
        return (
          <span className="font-bold text-[#30c71d]">
            Completed
          </span>
        )
      case "PENDING":
        return (
          <span className="font-bold text-[#2d3fff]">
            For Review
          </span>
        )
      case "DECLINED":
        return (
          <span className="font-bold text-[#f95151]">
            Declined
          </span>
        )
      case "UPCOMING":
        return (
          <span className="font-bold text-[#ff9500]">
            Upcoming
          </span>
        )
      default:
        return (
          <span className="text-gray-700 font-bold">
            {`${booking.status?.charAt(0).toUpperCase()}${booking.status?.slice(1)}` || "UNKNOWN"}
          </span>
        )
    }
  }

  return (
    <Card className="rounded-xl shadow-sm border-none p-4">
      <CardContent className="pb-4 overflow-x-auto">
        <h3 className="text-lg font-semibold mb-2">Transactions</h3>
        <div className="flex justify-between items-start mb-6">
          {/* Left side - Title and Filter */}
          <div className="flex-1">
            <div className="mb-2">
              <label className="text-sm font-medium text-gray-700">Select a Year</label>
            </div>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[70px] text-xs h-[24px]" >
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Right side - Statistics */}
          {(() => {
            const filteredBookings = bookings.filter(booking => {
              if (!booking.start_date) return false;
              const date = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any);
              return date.getFullYear() === selectedYear;
            });
            const totalBookings = filteredBookings.length;
            const completedBookings = filteredBookings.filter(booking =>
              booking.status?.toUpperCase() === "COMPLETED" || booking.status?.toUpperCase() === "ONGOING"
            ).length;
            const declinedBookings = filteredBookings.filter(booking =>
              booking.status?.toUpperCase() === "DECLINED"
            ).length;

            return (
              <div className="flex-1 justify-end">
                <div className="text-right">
                  <div className="flex items-center justify-end">
                    <span className="text-xs">Total Bookings:</span>
                    <span className="text-xs font-bold">{totalBookings}</span>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className="text-xs">Accepted:</span>
                    <span className="text-xs font-bold">{completedBookings}</span>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className="text-xs">Declined:</span>
                    <span className="text-xs font-bold">{declinedBookings}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {bookingsLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-gray-500">Loading bookings...</p>
          </div>
        ) : (() => {
          const filteredBookings = bookings.filter(booking => {
            if (!booking.start_date) return false;
            const date = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any);
            return date.getFullYear() === selectedYear;
          });
          const filteredTotal = filteredBookings.length;
          if (filteredBookings.length > 0) {
            const offset = (bookingsPage - 1) * itemsPerPage;
            const paginatedBookings = filteredBookings.slice(offset, offset + itemsPerPage);
            const formatTotalAmount = (totalAmount : any) => {
              if(totalAmount === undefined || totalAmount === null) {
                return "-";
              }
              return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalAmount);
            }
            return ( 
              <>
                <div className="w-full overflow-x-auto border-b border-gray-200 bg-white">
                  <div className="min-w-[880px]">
                    <div className="grid grid-cols-[100px_120px_250px_120px_120px_100px] gap-4 pb-2 border-b border-gray-300 text-xs font-semibold text-[#333] mb-4 px-4">
                      <div>Date</div>
                      <div>ATC</div>
                      <div>Booking Dates</div>
                      <div>Total Amount</div>
                      <div>Status</div>
                      <div>Actions</div>
                    </div>
                    <div className="space-y-3">
                      {paginatedBookings.map((booking) => (
                        <div key={booking.id} className="grid grid-cols-[100px_120px_250px_120px_120px_100px] gap-4 px-4 py-2 items-center h-[46px] text-xs bg-[#f6f9ff] border-2 border-[#b8d9ff] rounded-[10px] transition-all duration-200 shadow-sm">
                          <div>{formatFirebaseDate(booking.created)}</div>
                          <div>{booking.airing_code || "-"}</div>
                          <div>{booking.start_date && booking.end_date ? (() => {
                            const startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any);
                            const endDate = booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date as any);
                            const startFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            const endFormatted = `${endDate.getDate()}, ${endDate.getFullYear()}`;
                            const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            return `${startFormatted} - ${endFormatted} • ${days} Days`;
                          })() : 'N/A'}</div>
                          <div className="font-bold">{formatTotalAmount(booking.transaction?.amount)}</div>
                          <div>{renderBookingStatusBadge(booking)}</div>
                          <div>
                            <button onClick={() => { setSelectedBooking(booking); setBookingDialogOpen(true); }}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {filteredTotal > itemsPerPage && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                    <div className="text-sm text-gray-700">
                      Showing {((bookingsPage - 1) * itemsPerPage) + 1} to {Math.min(bookingsPage * itemsPerPage, filteredTotal)} of {filteredTotal} bookings
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookingsPage(prev => Math.max(1, prev - 1))}
                        disabled={bookingsPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {bookingsPage} of {Math.ceil(filteredTotal / itemsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookingsPage(prev => Math.min(Math.ceil(filteredTotal / itemsPerPage), prev + 1))}
                        disabled={bookingsPage === Math.ceil(filteredTotal / itemsPerPage)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          } else {
            return (
              <div className="p-8 text-center text-gray-500">
                <p>No bookings found for the selected year.</p>
              </div>
            );
          }
        })()}
      </CardContent>
    </Card>
  )
}

export default TransactionsTab