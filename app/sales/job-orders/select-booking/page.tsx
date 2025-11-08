"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, FileText, CheckCircle, ArrowLeft, Package, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { bookingService } from "@/lib/booking-service"
import type { Booking } from "@/lib/booking-service"
import type { DocumentSnapshot } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { searchBookings, SearchResult } from "@/lib/algolia-service"

export default function SelectBookingPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get("productId")

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchingAlgolia, setIsSearchingAlgolia] = useState(false)
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [pageLastDocs, setPageLastDocs] = useState<{ [page: number]: DocumentSnapshot }>({})
  const [hasMore, setHasMore] = useState(true)
  const [totalBookingsCount, setTotalBookingsCount] = useState<number>(0)

  const fetchTotalBookingsCount = async () => {
    if (!userData?.company_id) return

    try {
      const count = await bookingService.getTotalBookingsCount(userData.company_id)
      setTotalBookingsCount(count)
    } catch (error) {
      console.error("Error fetching total bookings count:", error)
    }
  }

  const performAlgoliaSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      console.log("Search query is empty, clearing results")
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearchingAlgolia(true)
    try {
      console.log(`Performing Algolia search for query: "${searchTerm}" with company_id: ${userData?.company_id}`)
      const result = await searchBookings(searchTerm, userData?.company_id || undefined)
      console.log(`Algolia search result:`, result)
      console.log(`Algolia search returned ${result.hits?.length || 0} hits:`, result.hits)
      if (result.error) {
        console.error("Algolia search error:", result.error)
        setSearchResults([])
        setIsSearching(false)
      } else {
        setSearchResults(result.hits || [])
        setIsSearching(true)
      }
    } catch (error) {
      console.error("Algolia search failed:", error)
      setSearchResults([])
      setIsSearching(false)
    } finally {
      setIsSearchingAlgolia(false)
    }
  }, [searchTerm, userData?.company_id])


  const fetchBookings = async (page: number = 1, reset: boolean = false) => {
    if (!userData?.company_id) return

    try {
      setLoading(true)
      const options = {
        page,
        pageSize: itemsPerPage,
        lastDoc: reset ? undefined : (page > 1 ? pageLastDocs[page - 1] : undefined)
      }

      const filters = productId ? { product_id: productId } : undefined
      const { bookings: fetchedBookings, lastDoc: newLastDoc } = await bookingService.getCollectiblesBookings(userData.company_id, options, filters)

      // Check if there are more pages (if we got exactly pageSize items, there might be more)
      const hasMorePages = fetchedBookings.length === itemsPerPage

      // Store the last document for this page
      if (newLastDoc) {
        setPageLastDocs(prev => ({
          ...prev,
          [page]: newLastDoc
        }))
      }

      console.log('fetchBookings completed for page:', page, 'fetchedBookings length:', fetchedBookings.length)
      setBookings(fetchedBookings)
      setLastDoc(newLastDoc)
      setHasMore(hasMorePages)

    } catch (error) {
      console.error("Error fetching bookings:", error)
      toast({
        title: "Error",
        description: "Failed to load bookings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings(1, true)
    fetchTotalBookingsCount()
  }, [userData?.company_id, productId])

  useEffect(() => {
    console.log(`Search useEffect triggered with searchQuery: "${searchTerm}"`)
    const handler = setTimeout(() => {
      console.log(`Executing debounced search for: "${searchTerm}"`)
      if (searchTerm.trim()) {
        performAlgoliaSearch()
      } else {
        console.log("Clearing search results")
        setSearchResults([])
        setIsSearching(false)
      }
    }, 300) // Debounce search input

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm, performAlgoliaSearch])


  const getFilteredBookings = () => {
    console.log(`getFilteredBookings called with searchTerm: "${searchTerm}", isSearching: ${isSearching}, searchResults length: ${searchResults.length}, bookings length: ${bookings.length}`)

    if (isSearching) {
      console.log("Using search results directly")
      return searchResults
    }

    // Return all bookings when not searching
    console.log("Returning all bookings")
    return bookings
  }

  const handleSelect = (item: Booking | SearchResult) => {
    console.log('[handleSelect] Item clicked:', item)
    const isSearchResult = 'objectID' in item
    console.log('[handleSelect] Is search result:', isSearchResult)
    const bookingId = isSearchResult ? (item as SearchResult).objectID : (item as Booking).id
    console.log('[handleSelect] Booking ID:', bookingId)
    console.log('[handleSelect] Navigating to:', `/sales/job-orders/create?bookingId=${bookingId}`)
    router.push(`/sales/job-orders/create?bookingId=${bookingId}`)
  }

  const handleNextPage = async () => {
    console.log('handleNextPage called, hasMore:', hasMore, 'currentPage:', currentPage)
    if (hasMore) {
      const nextPage = currentPage + 1
      console.log('Setting currentPage to:', nextPage)
      setCurrentPage(nextPage)
      await fetchBookings(nextPage, false)
    } else {
      console.log('Not proceeding because hasMore is false')
    }
  }

  const handlePreviousPage = async () => {
    console.log('handlePreviousPage called, currentPage:', currentPage)
    if (currentPage > 1) {
      const prevPage = currentPage - 1
      console.log('Setting currentPage to:', prevPage)
      setCurrentPage(prevPage)
      await fetchBookings(prevPage, false)
    } else {
      console.log('Not proceeding because currentPage is 1')
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {productId ? "Select a Reservation" : "Select a Reservation"}
          </h1>
        </div>
        <div className="text-sm text-gray-600">
          {productId ? "Filtered Reservations" : `Total Reservations: ${loading ? "..." : totalBookingsCount}`}
        </div>
      </div>

      <Card className="flex-1 flex flex-col p-6">
        <div className="relative mb-4">
          <Input
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : getFilteredBookings().length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No bookings found.
            {searchTerm && ` for "${searchTerm}"`}
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reservation ID</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredBookings().map((item, index) => {
                  console.log('Rendering booking item', index, item)
                   const isSearchResult = 'objectID' in item
                   const bookingId = isSearchResult ? (item as SearchResult).objectID : (item as Booking).id
                   const reservationId = isSearchResult ? (item as any).reservation_id : (item as Booking).reservation_id
                   const clientName = isSearchResult ? (item as any).client_name : (item as Booking).client?.name
                   const productName = isSearchResult ? (item as any).product_name : (item as Booking).product_name
                   const projectName = isSearchResult ? (item as any).project_name : (item as Booking).project_name
                   const startDate = isSearchResult ? (item as any).start_date : (item as Booking).start_date
                   const endDate = isSearchResult ? (item as any).end_date : (item as Booking).end_date
                   const status = isSearchResult ? (item as any).status : (item as Booking).status
                   const created = isSearchResult ? (item as any).created : (item as Booking).created

                   return (
                  <TableRow
                    key={bookingId}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSelect(item as Booking)}
                  >
                    <TableCell className="font-semibold">
                      {reservationId}
                    </TableCell>
                    <TableCell>{clientName || "N/A"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {productName || "N/A"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {projectName || "N/A"}
                    </TableCell>
                    <TableCell>{formatDate(startDate)}</TableCell>
                    <TableCell>{formatDate(endDate)}</TableCell>
                    <TableCell>
                      <Badge variant={status === "RESERVED" ? "default" : "secondary"}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {created ? formatDate(created) : "N/A"}
                    </TableCell>
                  </TableRow>
                )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Pagination Controls */}
        <div className="flex justify-end mt-4">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button onClick={handlePreviousPage} disabled={currentPage === 1 || loading || isSearching} variant="outline" size="sm">
                Previous
              </Button>
              <Button onClick={handleNextPage} disabled={!hasMore || loading || isSearching} variant="outline" size="sm">
                Next
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-medium">{(currentPage - 1) * itemsPerPage + getFilteredBookings().length}</span> of{" "}
                  <span className="font-medium">{productId ? 'filtered' : totalBookingsCount}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <Button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1 || loading || isSearching}
                    variant="outline"
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </Button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                    {currentPage}
                  </span>
                  <Button
                    onClick={handleNextPage}
                    disabled={!hasMore || loading || isSearching}
                    variant="outline"
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}