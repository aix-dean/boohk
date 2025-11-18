"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TransactionsTable } from "@/components/transactions-table"
import { TransactionMetrics } from "@/components/transaction-metrics"
import { BookingDetailsDialog } from "@/components/BookingDetailsDialog"
import { Transaction } from 'oh-db-models'
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { searchTransactions } from "@/lib/algolia-service"
import { exportTransactionsToExcel } from "@/lib/excel-export"
import { bookingService } from "@/lib/booking-service"
import type { Booking } from "@/lib/booking-service"

interface TransactionsPageProps {
  title: string
}

export default function TransactionsPage({ title }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isLoadingBooking, setIsLoadingBooking] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('this-month')
  const [metricsTransactions, setMetricsTransactions] = useState<Transaction[]>([])
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
    if (transactions.length === 0) {
      alert('No transactions to export')
      return
    }

    setIsExporting(true)
    try {
      await exportTransactionsToExcel(transactions)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export transactions. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleRowClick = async (transaction: Transaction) => {
    if (!transaction.bookingId) return

    setIsLoadingBooking(true)
    try {
      const booking = await bookingService.getBookingById(transaction.bookingId)
      if (booking) {
        setSelectedBooking(booking)
        setIsBookingDialogOpen(true)
      } else {
        alert('Booking details not found')
      }
    } catch (error) {
      console.error('Error fetching booking:', error)
      alert('Failed to load booking details. Please try again.')
    } finally {
      setIsLoadingBooking(false)
    }
  }

  // Fetch transactions for the table (all transactions)
  useEffect(() => {
      console.log('fetchTransactions called with searchTerm:', `"${searchTerm}"`, 'trimmed:', `"${searchTerm.trim()}"`, 'isEmpty:', !searchTerm.trim())
    const fetchTransactions = async () => {
      if (!userData?.company_id) return

      try {
        setLoading(true)
        if (searchTerm.trim()) {
          // Use Algolia for search
          const searchResults = await searchTransactions(searchTerm, userData.company_id, currentPage - 1, 15)
          setTransactions(searchResults.hits as unknown as Transaction[])
          setTotalItems(searchResults.nbHits)
          console.log('Fetching from Firestore (no search)')
        } else {
          // Use Firestore for initial load (no search)
          const transactionsRef = collection(db, "transactions")
          const q = query(
            transactionsRef,
            where("companyId", "==", userData.company_id),
            orderBy("createdAt", "desc"),
            limit(50)
          )
          const snapshot = await getDocs(q)
          const transactionsData: Transaction[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Transaction))
          setTransactions(transactionsData)
          setTotalItems(transactionsData.length)
        }
      } catch (error) {
        console.error("Error fetching transactions:", error)
        setTransactions([])
        setTotalItems(0)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [userData?.company_id, searchTerm, currentPage])

  // Fetch transactions for metrics (filtered by period)
  useEffect(() => {
    const fetchMetricsTransactions = async () => {
      if (!userData?.company_id) return

      try {
        const dateRange = getDateRange(selectedPeriod)
        if (!dateRange) return

        const transactionsRef = collection(db, "transactions")
        const q = query(
          transactionsRef,
          where("companyId", "==", userData.company_id),
          where("createdAt", ">=", dateRange.start),
          where("createdAt", "<=", dateRange.end),
          orderBy("createdAt", "desc")
        )
        const snapshot = await getDocs(q)
        const metricsData: Transaction[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Transaction))
        setMetricsTransactions(metricsData)
      } catch (error) {
        console.error("Error fetching metrics transactions:", error)
        setMetricsTransactions([])
      }
    }

    fetchMetricsTransactions()
  }, [userData?.company_id, selectedPeriod])


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px] bg-white h-6 text-xs">
              <SelectValue placeholder="This month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month" className="text-xs">This month</SelectItem>
              <SelectItem value="last-month" className="text-xs">Last month</SelectItem>
              <SelectItem value="this-year" className="text-xs">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TransactionMetrics transactions={metricsTransactions} />

        {/* Search and Export */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-700">Search:</span>
            <Input
              placeholder="Search transactions..."
              className="w-64 h-6 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="border-gray-300 h-6 text-xs"
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
            transactions={transactions}
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