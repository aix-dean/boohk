"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function BookingsPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(9)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [pageSnapshots, setPageSnapshots] = useState<QueryDocumentSnapshot<DocumentData>[]>([])
  const [activeTab, setActiveTab] = useState("bookings") // Keep activeTab for consistency, though only one tab now

  const router = useRouter()

  const fetchBookings = async (
    direction: "next" | "prev" | "first" = "first",
    startDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  ) => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const bookingsRef = collection(db, "booking")

      let q

      if (direction === "first") {
        q = query(bookingsRef, where("seller_id", "==", user.uid), orderBy("created", "desc"), limit(pageSize))
      } else if (direction === "next" && startDoc) {
        q = query(
          bookingsRef,
          where("seller_id", "==", user.uid),
          orderBy("created", "desc"),
          startAfter(startDoc),
          limit(pageSize),
        )
      } else if (direction === "prev" && startDoc) {
        const prevPageStartDoc = pageSnapshots[currentPage - 2]
        if (prevPageStartDoc) {
          q = query(
            bookingsRef,
            where("seller_id", "==", user.uid),
            orderBy("created", "desc"),
            startAfter(prevPageStartDoc),
            limit(pageSize),
          )
        } else {
          q = query(bookingsRef, where("seller_id", "==", user.uid), orderBy("created", "desc"), limit(pageSize))
        }
      } else {
        q = query(bookingsRef, where("seller_id", "==", user.uid), orderBy("created", "desc"), limit(pageSize))
      }

      const querySnapshot = await getDocs(q!)
      const fetchedBookings: any[] = []

      const firstVisible = querySnapshot.docs[0] || null
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null
      const hasMoreItems = querySnapshot.docs.length === pageSize

      querySnapshot.forEach((doc) => {
        fetchedBookings.push({ id: doc.id, ...doc.data() })
      })

      setBookings(fetchedBookings)

      if (direction === "first") {
        setLastDoc(lastVisible)
        setCurrentPage(1)
        if (firstVisible) {
          setPageSnapshots([firstVisible])
        }
      } else if (direction === "next") {
        setLastDoc(lastVisible)
        setCurrentPage((prev) => prev + 1)
        if (firstVisible) {
          setPageSnapshots((prev) => [...prev, firstVisible])
        }
      } else if (direction === "prev") {
        setLastDoc(firstVisible)
        setCurrentPage((prev) => prev - 1)
        setPageSnapshots((prev) => prev.slice(0, -1))
      }

      setHasMore(hasMoreItems)
    } catch (error) {
      console.error("Error fetching bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.uid && activeTab === "bookings") {
      fetchBookings()
    }
  }, [user, activeTab])

  const handleNextPage = () => {
    if (lastDoc && hasMore) {
      fetchBookings("next", lastDoc)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prevPageSnapshot = pageSnapshots[currentPage - 2]
      if (prevPageSnapshot) {
        fetchBookings("prev", prevPageSnapshot)
      } else {
        fetchBookings("first")
      }
    }
  }

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "MMM d, yyyy")
      }
      if (typeof date === "string") {
        return format(new Date(date), "MMM d, yyyy")
      }
      return "Invalid date"
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <Tabs defaultValue="bookings" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-1">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            {loading && activeTab === "bookings" ? (
              <Card className="border-gray-200 shadow-sm rounded-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead className="font-semibold text-gray-900 py-3">Date</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Client</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Duration</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Status</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Amount</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array(pageSize)
                      .fill(0)
                      .map((_, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-28" />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Card>
            ) : bookings.length === 0 ? (
              <Card className="border-gray-200 shadow-sm rounded-xl">
                <CardContent className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-8 w-8 text-gray-400"
                    >
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings yet</h3>
                  <p className="text-gray-600 mb-6">Create your first booking to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-200 shadow-sm overflow-hidden rounded-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead className="font-semibold text-gray-900 py-3">Date</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Client</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Duration</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Status</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Amount</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow
                        key={booking.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                        onClick={() => router.push(`/sales/bookings/${booking.id}`)}
                      >
                        <TableCell className="font-medium py-3">{formatDate(booking.created)}</TableCell>
                        <TableCell className="py-3">{booking.client_name}</TableCell>
                        <TableCell className="py-3">
                          {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className={`${getStatusColor(booking.status)} border font-medium`}>
                            {booking.status || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">₱{booking.total_cost?.toLocaleString() || "N/A"}</TableCell>
                        <TableCell className="py-3">
                          {booking.booking_reference || booking.id.substring(0, 8)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            <div className="flex justify-between items-center mt-6 px-2">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} {hasMore ? "•" : ""}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage <= 1 || loading}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasMore || loading}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {loading && activeTab === "bookings" && currentPage > 1 && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow">
            <p>Loading bookings...</p>
          </div>
        </div>
      )}
    </div>
  )
}
