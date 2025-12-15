"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TransactionsTable } from "@/components/transactions-table"
import { TransactionMetrics } from "@/components/transaction-metrics"
import TransactionDetailsDialog from "@/components/TransactionDetailsDialog"
import { BookingDetailsDialog } from "@/components/BookingDetailsDialog"
import { collection, query, where, getDocs, orderBy, limit, startAfter, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { searchBookings } from "@/lib/algolia-service"
import { exportTransactionsToExcel } from "@/lib/excel-export"
import { bookingService } from "@/lib/booking-service"
import { Booking } from 'oh-db-models'

interface TransactionsPageProps {
  title: string
}

export default function TransactionsPage({ title }: TransactionsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Booking | null>(null)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isLoadingBooking, setIsLoadingBooking] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('this-month')
  const [metricsBookings, setMetricsBookings] = useState<Booking[]>([])
  const { userData } = useAuth()

  // Helper function to get date range for selected period
  const getDateRange = (period: string): { start: Date, end: Date } | null => {
    const now = new Date()
    switch (period) {
      case 'this-month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        return { start: startOfMonth, end: endOfMonth }
      case 'last-month':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        return { start: startOfLastMonth, end: endOfLastMonth }
      case 'this-year':
        const startOfYear = new Date(now.getFullYear(), 0, 1)
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
        return { start: startOfYear, end: endOfYear }
      default:
        return null
    }
  }

  const handleExport = async () => {
    if (bookings.length === 0) {
      alert('No bookings to export')
      return
    }

    setIsExporting(true)
    try {
      await exportTransactionsToExcel(bookings)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export bookings. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleRowClick = (booking: Booking) => {
    const isForReview = booking.status?.toLowerCase() === "for review"

    if (isForReview) {
      // For "for review" status, show booking details dialog
      setSelectedBooking(booking)
      setIsBookingDialogOpen(true)
    } else {
      // For other statuses, show transaction details dialog with booking data
      setSelectedTransaction(booking)
      setSelectedBooking(booking) // Pass booking data even for non-review transactions
      setIsTransactionDialogOpen(true)
    }
  }

  // Fetch bookings for the table (all bookings)
  useEffect(() => {
      console.log('fetchBookings called with searchTerm:', `"${searchTerm}"`, 'trimmed:', `"${searchTerm.trim()}"`, 'isEmpty:', !searchTerm.trim())
    const fetchBookings = async () => {
      if (!userData?.company_id) return

      try {
        setLoading(true)
        if (searchTerm.trim()) {
          // Use Algolia for search
          const searchResults = await searchBookings(searchTerm, userData.company_id, currentPage - 1, 15)

          // Convert Algolia results to Booking format with proper date handling
          const processedBookings: Booking[] = searchResults.hits.map(hit => {
            const booking = hit as unknown as Booking

            // Convert date fields from strings to proper formats
            if (booking.created && typeof booking.created === 'string') {
              booking.created = new Date(booking.created)
            }
            if (booking.start_date && typeof booking.start_date === 'string') {
              booking.start_date = Timestamp.fromDate(new Date(booking.start_date))
            }
            if (booking.end_date && typeof booking.end_date === 'string') {
              booking.end_date = Timestamp.fromDate(new Date(booking.end_date))
            }

            return booking
          })

          setBookings(processedBookings)
          setTotalItems(searchResults.nbHits)
          console.log('Fetching from Firestore (no search)')
        } else {
          // Use Firestore for initial load (no search)
          const itemsPerPage = 15
          const bookingsRef = collection(db, "booking")
          let q = query(
            bookingsRef,
            where("company_id", "==", userData.company_id),
            orderBy("created", "desc")
          )

          // Add pagination for pages beyond the first
          if (currentPage > 1) {
            const prevPageQuery = query(
              bookingsRef,
              where("company_id", "==", userData.company_id),
              orderBy("created", "desc"),
              limit((currentPage - 1) * itemsPerPage)
            )
            const prevSnapshot = await getDocs(prevPageQuery)
            const lastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1]
            if (lastDoc) {
              q = query(q, startAfter(lastDoc))
            }
          }

          q = query(q, limit(itemsPerPage))
          const snapshot = await getDocs(q)
          const bookingsData: Booking[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Booking))
          setBookings(bookingsData)

          // Get total count for pagination
          const countQuery = query(bookingsRef, where("company_id", "==", userData.company_id))
          const countSnapshot = await getDocs(countQuery)
          setTotalItems(countSnapshot.size)
        }
      } catch (error) {
        console.error("Error fetching bookings:", error)
        setBookings([])
        setTotalItems(0)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [userData?.company_id, searchTerm, currentPage])

  // Fetch bookings for metrics (filtered by period)
  useEffect(() => {
    const fetchMetricsBookings = async () => {
      if (!userData?.company_id) return

      try {
        const dateRange = getDateRange(selectedPeriod)
        if (!dateRange) return

        const bookingsRef = collection(db, "booking")
        const q = query(
          bookingsRef,
          where("company_id", "==", userData.company_id),
          where("created", ">=", dateRange.start),
          where("created", "<=", dateRange.end),
          orderBy("created", "desc")
        )
        const snapshot = await getDocs(q)
        const metricsData: Booking[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Booking))
        setMetricsBookings(metricsData)
      } catch (error) {
        console.error("Error fetching metrics bookings:", error)
        setMetricsBookings([])
      }
    }

    fetchMetricsBookings()
  }, [userData?.company_id, selectedPeriod])


  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 -mt-2">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h1>
          <div className="w-full sm:w-auto">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-[140px] bg-white h-10 sm:h-6 text-sm">
                <SelectValue placeholder="This month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month" className="text-sm">This month</SelectItem>
                <SelectItem value="last-month" className="text-sm">Last month</SelectItem>
                <SelectItem value="this-year" className="text-sm">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TransactionMetrics transactions={metricsBookings} />

        {/* Search and Export - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <span className="text-sm text-gray-700">Search:</span>
            <Input
              placeholder="Search transactions..."
              className="w-full sm:w-64 h-10 sm:h-6 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="border-gray-300 h-10 sm:h-6 text-sm w-full sm:w-auto"
            onClick={handleExport}
          >
            Export
          </Button>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="text-center py-8">Loading transactions...</div>
        ) : (
          <TransactionsTable
            transactions={bookings}
            totalItems={totalItems}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onRowClick={handleRowClick}
          />
        )}
      </div>

      {/* Export Loading Dialog */}
      <Dialog open={isExporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Preparing Export</DialogTitle>
            <DialogDescription>
              Please wait while we prepare your Excel file for download...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        transaction={selectedTransaction}
        booking={selectedBooking}
        isOpen={isTransactionDialogOpen}
        onClose={() => setIsTransactionDialogOpen(false)}
      />

      {/* Booking Details Dialog */}
      <BookingDetailsDialog
        open={isBookingDialogOpen}
        onOpenChange={setIsBookingDialogOpen}
        booking={selectedBooking}
        mode="view"
      />
    </div>
  )
}