"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, DocumentData, QueryDocumentSnapshot, serverTimestamp, updateDoc, getCountFromServer } from "firebase/firestore"
import { db, storage } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { format } from "date-fns"
import { Search, MoreHorizontal, FileText, Calculator, ChevronDown, ChevronRight, Upload, Loader2, CheckCircle, ChevronLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { searchBookings, SearchResult } from "@/lib/algolia-service"
import { Pagination } from "@/components/ui/pagination"

interface Booking {
   id: string
   product_name?: string
   product_id?: string
   product_owner?: string
   client_name?: string
   client_company_name?: string
   client?: {
     name?: string
     company_name?: string
   }
   start_date?: any
   end_date?: any
   status?: string
   created?: any
   quotation_id?: string
   reservation_id?: string // Generated reservation ID with format "RV-" + currentmillis
   projectCompliance?: {
     signedContract?: { status: string; fileUrl?: string; fileName?: string };
     irrevocablePo?: { status: string; fileUrl?: string; fileName?: string };
     paymentAsDeposit?: { status: string; note?: string; fileUrl?: string; fileName?: string };
     finalArtwork?: { status: string; fileUrl?: string; fileName?: string };
     signedQuotation?: { status: string; fileUrl?: string; fileName?: string };
   };
 }

interface Product {
   id?: string
   name?: string
   site_code?: string
   specs_rental?: {
     site_code?: string
     location?: string
   }
   light?: {
     site_code?: string
     location?: string
   }
   siteCode?: string
   [key: string]: any
}

// Function to get site code from product - following the pattern from sales dashboard
const getSiteCode = (product: Product | null) => {
  if (!product) return null

  // Try different possible locations for site_code
  if (product.site_code) return product.site_code
  if (product.specs_rental && "site_code" in product.specs_rental) return product.specs_rental.site_code
  if (product.light && "site_code" in product.light) return product.light.site_code

  // Check for camelCase variant
  if ("siteCode" in product) return product.siteCode

  return null
}

export default function ReservationsPage() {
  const { user, userData } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [bookings, setBookings] = useState<Booking[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<{ [key: string]: Product }>({})
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchingAlgolia, setIsSearchingAlgolia] = useState(false)
  const [expandedCompliance, setExpandedCompliance] = useState<Set<string>>(new Set())
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [pageLastDocs, setPageLastDocs] = useState<{ [page: number]: any }>({})
  const [hasMore, setHasMore] = useState(true)

  const [totalReservationsCount, setTotalReservationsCount] = useState<number>(0)

  const fetchTotalReservationsCount = async () => {
    if (!user?.uid || !userData?.company_id) return

    try {
      const bookingsRef = collection(db, "booking")
      const countQuery = query(
        bookingsRef,
        where("company_id", "==", userData.company_id)
      )

      const snapshot = await getCountFromServer(countQuery)
      setTotalReservationsCount(snapshot.data().count)
    } catch (error) {
      console.error("Error fetching total reservations count:", error)
    }
  }

  const fetchBookings = async (page: number = 1, reset: boolean = false) => {
    if (!user?.uid || !userData?.company_id) return

    try {
      setLoading(true)
      const bookingsRef = collection(db, "booking")
      let bookingsQuery = query(
        bookingsRef,
        where("company_id", "==", userData.company_id),
        orderBy("created", "desc"),
        limit(itemsPerPage + 1) // Fetch one extra to check if there's a next page
      )

      // If not the first page, start after the last document of the previous page
      if (page > 1 && !reset) {
        const prevPageLastDoc = pageLastDocs[page - 1]
        if (prevPageLastDoc) {
          bookingsQuery = query(bookingsQuery, startAfter(prevPageLastDoc))
        }
      }

      const querySnapshot = await getDocs(bookingsQuery)
      const fetchedBookings: Booking[] = []

      querySnapshot.forEach((doc) => {
        fetchedBookings.push({ id: doc.id, ...doc.data() })
      })

      // Check if there are more pages
      const hasMore = fetchedBookings.length > itemsPerPage
      const currentPageData = hasMore ? fetchedBookings.slice(0, itemsPerPage) : fetchedBookings

      // Store the last document for this page
      const pageLastDoc = hasMore ? querySnapshot.docs[itemsPerPage - 1] : querySnapshot.docs[querySnapshot.docs.length - 1]

      if (pageLastDoc) {
        setPageLastDocs(prev => ({
          ...prev,
          [page]: pageLastDoc
        }))
      }

      setBookings(currentPageData)
      setLastDoc(pageLastDoc)
      setHasMore(hasMore)

      const productIds = currentPageData
        .map((booking) => booking.product_id)
        .filter((id): id is string => Boolean(id))

      const uniqueProductIds = [...new Set(productIds)]
      const productData: { [key: string]: Product } = {}

      for (const productId of uniqueProductIds) {
        try {
          const productDoc = await getDoc(doc(db, "products", productId))
          if (productDoc.exists()) {
            productData[productId] = { id: productDoc.id, ...productDoc.data() }
          }
        } catch (error) {
          console.error(`Error fetching product ${productId}:`, error)
        }
      }

      setProducts(productData)
    } catch (error) {
      console.error("Error fetching bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBookings(1, true)
    fetchTotalReservationsCount()

    // Index bookings into Algolia on page load
    const indexBookings = async () => {
      try {
        const response = await fetch('/api/bookings/index', {
          method: 'POST',
        })
        const result = await response.json()
        console.log('Booking indexing result:', result)
      } catch (error) {
        console.error('Error indexing bookings:', error)
      }
    }

    indexBookings()
  }, [user, userData])

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "MMM d, yyyy")
      }
      if (typeof date === "string") {
        return format(new Date(date), "MMM d, yyyy")
      }
      return "N/A"
    } catch (error) {
      return "N/A"
    }
  }

  const calculateDuration = (startDate: any, endDate: any) => {
    if (!startDate || !endDate) return "N/A"

    try {
      const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate)

      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      return `${months} ${months === 1 ? "month" : "months"}`
    } catch (error) {
      return "N/A"
    }
  }

  const performAlgoliaSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      console.log("Search query is empty, clearing results")
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearchingAlgolia(true)
    try {
      console.log(`Performing Algolia search for query: "${searchQuery}" with company_id: ${userData?.company_id}`)
      const result = await searchBookings(searchQuery, userData?.company_id || undefined)
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
  }, [searchQuery, userData?.company_id])

  useEffect(() => {
    console.log(`Search useEffect triggered with searchQuery: "${searchQuery}"`)
    const handler = setTimeout(() => {
      console.log(`Executing debounced search for: "${searchQuery}"`)
      if (searchQuery.trim()) {
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
  }, [searchQuery, performAlgoliaSearch])

  const getFilteredBookings = () => {
    console.log(`getFilteredBookings called with searchQuery: "${searchQuery}", isSearching: ${isSearching}, searchResults length: ${searchResults.length}, bookings length: ${bookings.length}`)

    if (isSearching) {
      console.log("Using search results directly")
      return searchResults
    }

    // Fallback to client-side filtering if no search
    console.log("Using client-side filtering")
    const filtered = bookings.filter((booking) => {
      const product = booking.product_id ? products[booking.product_id] : null

      const matches = (
        product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.client_company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.client?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.client?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.status?.toLowerCase().includes(searchQuery.toLowerCase())
      )

      if (matches) {
        console.log(`Booking ${booking.id} matches client-side filter`)
      }

      return matches
    })
    console.log(`Client-side filtered to ${filtered.length} bookings`)
    return filtered
  }


  const getProjectCompliance = (booking: Booking) => {
    const compliance = booking.projectCompliance || {}

    const toReserveItems = [
      {
        key: "signedContract",
        name: "Signed Contract",
        status: compliance.signedContract?.fileUrl ? "completed" : "upload",
        file: compliance.signedContract?.fileName,
        fileUrl: compliance.signedContract?.fileUrl,
      },
      {
        key: "irrevocablePo",
        name: "Irrevocable PO",
        status: compliance.irrevocablePo?.fileUrl ? "completed" : "upload",
        file: compliance.irrevocablePo?.fileName,
        fileUrl: compliance.irrevocablePo?.fileUrl,
      },
      {
        key: "paymentAsDeposit",
        name: "Payment as Deposit",
        status: compliance.paymentAsDeposit?.fileUrl ? "completed" : "confirmation",
        note: "For Treasury's confirmation",
        file: compliance.paymentAsDeposit?.fileName,
        fileUrl: compliance.paymentAsDeposit?.fileUrl,
      },
    ]

    const otherRequirementsItems = [
      {
        key: "finalArtwork",
        name: "Final Artwork",
        status: compliance.finalArtwork?.fileUrl ? "completed" : "upload",
        file: compliance.finalArtwork?.fileName,
        fileUrl: compliance.finalArtwork?.fileUrl,
      },
      {
        key: "signedQuotation",
        name: "Signed Quotation",
        status: compliance.signedQuotation?.fileUrl ? "completed" : "upload",
        file: compliance.signedQuotation?.fileName,
        fileUrl: compliance.signedQuotation?.fileUrl,
      },
    ]

    const allItems = [...toReserveItems, ...otherRequirementsItems]
    const completed = allItems.filter((item) => item.status === "completed").length
    return {
      completed,
      total: allItems.length,
      toReserve: toReserveItems,
      otherRequirements: otherRequirementsItems,
    }
  }

  const toggleComplianceExpansion = (bookingId: string) => {
    setExpandedCompliance((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
      }
      return newSet
    })
  }


  const handleFileUpload = async (bookingId: string, complianceType: string, file: File) => {
    const uploadKey = `${bookingId}-${complianceType}`
    setUploadingFiles((prev) => new Set(prev).add(uploadKey))

    try {
      if (file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed")
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File size must be less than 10MB")
      }

      const fileName = `${Date.now()}-${file.name}`
      const storageRef = ref(storage, `bookings/${bookingId}/compliance/${complianceType}/${fileName}`)

      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      // Find the booking to get the quotation_id
      const currentBooking = bookings.find(b => b.id === bookingId)
      const quotationId = currentBooking?.quotation_id

      const updateData: { [key: string]: any } = {
        [`projectCompliance.${complianceType}`]: {
          status: "completed",
          fileUrl: downloadURL,
          fileName: file.name,
          uploadedAt: serverTimestamp(),
          uploadedBy: user?.uid,
        },
        updated: serverTimestamp(),
      }

      // Update booking document
      const bookingRef = doc(db, "booking", bookingId)
      await updateDoc(bookingRef, updateData)

      // Update quotation document if quotation_id exists
      if (quotationId) {
        try {
          const quotationRef = doc(db, "quotations", quotationId)
          await updateDoc(quotationRef, updateData)
          console.log(`Updated quotation ${quotationId} with compliance data`)
        } catch (quotationError) {
          console.error("Error updating quotation:", quotationError)
          // Don't fail the entire operation if quotation update fails
        }
      }

      setBookings((prevBookings) =>
        prevBookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                projectCompliance: {
                  ...b.projectCompliance,
                  [complianceType]: {
                    status: "completed",
                    fileUrl: downloadURL,
                    fileName: file.name,
                    uploadedAt: new Date().toISOString(), // Placeholder, actual timestamp is server-side
                    uploadedBy: user?.uid,
                  },
                },
              }
            : b,
        ),
      )

      toast({
        title: "Success",
        description: `${complianceType.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} uploaded successfully`,
      })
    } catch (error: any) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(uploadKey)
        return newSet
      })
    }
  }

  const triggerFileUpload = (bookingId: string, complianceType: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".pdf"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleFileUpload(bookingId, complianceType, file)
      }
    }
    input.click()
  }

  const displayedReservations = getFilteredBookings() as (Booking | SearchResult)[]

  const handleNextPage = async () => {
    if (hasMore) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      await fetchBookings(nextPage, false)
    }
  }

  const handlePreviousPage = async () => {
    if (currentPage > 1) {
      const prevPage = currentPage - 1
      setCurrentPage(prevPage)
      await fetchBookings(prevPage, false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Transactions</h1>
          <p className="text-sm text-gray-600">See the status of the quotations you've generated</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder=""
              className="pl-10 bg-white border-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {isSearching ? `Found ${searchResults.length} results` : `Total Reservations: ${loading ? "..." : totalReservationsCount}`}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
               <TableRow className="bg-gray-50">
                 <TableHead className="font-semibold text-gray-900">Airing ID</TableHead>
                 <TableHead className="font-semibold text-gray-900">Product</TableHead>
                 <TableHead className="font-semibold text-gray-900">Client</TableHead>
                 <TableHead className="font-semibold text-gray-900">From</TableHead>
                 <TableHead className="font-semibold text-gray-900">To</TableHead>
                 <TableHead className="font-semibold text-gray-900">Status</TableHead>
                 <TableHead className="font-semibold text-gray-900">Actions</TableHead>
               </TableRow>
             </TableHeader>
            <TableBody>
              {(loading || isSearchingAlgolia) ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : displayedReservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No reservations found
                  </TableCell>
                </TableRow>
              ) : (
                displayedReservations.map((item) => {
                  const isSearchResult = 'objectID' in item
                  const bookingId = isSearchResult ? (item as SearchResult).objectID : (item as Booking).id
                  const reservationId = isSearchResult ? (item as any).reservation_id : (item as Booking).reservation_id
                  const productName = isSearchResult ? (item as any).product_name : (item as Booking).product_name
                  const clientName = isSearchResult ? (item as any).client_name : (item as Booking).client_name
                  const clientCompanyName = isSearchResult ? (item as any).client_company_name : (item as Booking).client_company_name
                  const client = isSearchResult ? (item as any).client : (item as Booking).client
                  const startDate = isSearchResult ? (item as any).start_date : (item as Booking).start_date
                  const endDate = isSearchResult ? (item as any).end_date : (item as Booking).end_date
                  const status = isSearchResult ? (item as any).status : (item as Booking).status
                  const quotationId = isSearchResult ? (item as any).quotation_id : (item as Booking).quotation_id
                  const projectCompliance = isSearchResult ? null : (item as Booking).projectCompliance

                  const product = !isSearchResult && (item as Booking).product_id ? products[(item as Booking).product_id!] : null
                  const compliance = projectCompliance ? getProjectCompliance(item as Booking) : null
                  const isExpanded = expandedCompliance.has(bookingId)

                  return (
                    <TableRow
                      key={bookingId}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/sales/reservation/${bookingId}`)}
                    >
                      <TableCell className="font-medium text-sm font-mono">{reservationId || "N/A"}</TableCell>
                      <TableCell className="font-medium">{product?.name || productName || "-"}</TableCell>
                      <TableCell>
                        {(() => {
                          const companyName = clientCompanyName || client?.company_name || "";
                          const clientNameValue = clientName || client?.name || "";
                          if (companyName && clientNameValue) {
                            return `${companyName} - ${clientNameValue}`;
                          } else if (companyName) {
                            return companyName;
                          } else if (clientNameValue) {
                            return clientNameValue;
                          } else {
                            return "N/A";
                          }
                        })()}
                      </TableCell>
                      <TableCell>{formatDate(startDate)}</TableCell>
                      <TableCell>{formatDate(endDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={status?.toLowerCase() === "confirmed" ? "default" : "secondary"}
                          className={
                            status?.toLowerCase() === "confirmed"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                          }
                        >
                          {status?.toUpperCase() || "PENDING"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/sales/job-orders/select-booking?productId=${product?.id}`);
                              }}
                            >
                              Create JO
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {!isSearching && (
          <div className="flex justify-end mt-4">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button onClick={handlePreviousPage} disabled={currentPage === 1 || loading} variant="outline" size="sm">
                  Previous
                </Button>
                <Button onClick={handleNextPage} disabled={!hasMore || loading} variant="outline" size="sm">
                  Next
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                    <span className="font-medium">{(currentPage - 1) * itemsPerPage + bookings.length}</span> of{" "}
                    <span className="font-medium">{totalReservationsCount}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <Button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1 || loading}
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
                      disabled={!hasMore || loading}
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
        )}
      </div>

    </div>
  )
}
