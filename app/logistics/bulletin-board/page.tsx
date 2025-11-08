"use client"

import { useAuth } from "@/contexts/auth-context"
import { useEffect, useState, useRef } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, DocumentData, QueryDocumentSnapshot, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product } from "@/lib/firebase-service"
import { searchBookings } from "@/lib/algolia-service"
import { getReportsPerBooking } from "@/lib/report-service"
import { getLatestServiceAssignmentsPerBooking } from "@/lib/firebase-service"
import type { ReportData } from "@/lib/report-service"
import type { ServiceAssignment } from "@/lib/firebase-service"
import { formatDateShort } from "@/lib/utils"
import { BulletinBoardContent } from "@/components/BulletinBoardContent"

interface Booking {
  id: string
  product_id?: string
  product_owner?: string
  client_name?: string
  start_date?: any
  end_date?: any
  status?: string
  created?: any
  quotation_id?: string
  project_name?: string
  reservation_id?: string
}

export default function LogisticsBulletinBoardPage() {
   const { user, userData } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const [projectNames, setProjectNames] = useState<{ [productId: string]: string }>({})
  const [bookingIds, setBookingIds] = useState<{ [productId: string]: string }>({})
  const [reports, setReports] = useState<{ [bookingId: string]: ReportData[] }>({})
  const [reportsLoading, setReportsLoading] = useState(true)
  const [serviceAssignments, setServiceAssignments] = useState<{ [bookingId: string]: ServiceAssignment }>({})
  const [serviceAssignmentsLoading, setServiceAssignmentsLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prevPage) => prevPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1)
    }
  }

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm])

  useEffect(() => {
    const fetchBookings = async () => {
      if (!userData?.company_id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // If there's a search term, use Algolia search
        if (debouncedSearchTerm.trim()) {
          const searchResults = await searchBookings(debouncedSearchTerm.trim(), userData.company_id, 0, 1000) // Fetch all results

          if (searchResults.error) {
            console.error("Search error:", searchResults.error)
            setBookings([])
            setProducts([])
            setProjectNames({})
            setBookingIds({})
            setTotalPages(1)
            return
          }

          // Transform Algolia results to match expected format
          const fetchedBookings: Booking[] = searchResults.hits.map((hit: any) => ({
            id: hit.objectID,
            product_id: hit.product_id,
            product_owner: hit.product_owner || hit.product_name,
            client_name: hit.client_name || hit.client?.name,
            start_date: hit.start_date,
            end_date: hit.end_date,
            status: hit.status,
            created: hit.created ? new Date(hit.created) : null,
            quotation_id: hit.quotation_id,
            project_name: hit.project_name || "No Project Name",
            reservation_id: hit.reservation_id || `RV-${hit.objectID?.slice(-6)}`,
          }))

          setBookings(fetchedBookings)
          setTotalPages(Math.ceil(fetchedBookings.length / itemsPerPage))

          // Create project names map and booking IDs map
          const namesMap: { [productId: string]: string } = {}
          const bookingIdsMap: { [productId: string]: string } = {}
          fetchedBookings.forEach((booking) => {
            if (booking.product_id) {
              namesMap[booking.product_id] = booking.project_name || "No Project Name"
              bookingIdsMap[booking.product_id] = booking.reservation_id || booking.id
            }
          })
          setProjectNames(namesMap)
          setBookingIds(bookingIdsMap)

          const productIds = fetchedBookings
            .map((booking) => booking.product_id)
            .filter((id): id is string => Boolean(id))

          const uniqueProductIds = [...new Set(productIds)]

          // Batch fetch products in chunks of 10 (Firestore limit for 'in' queries)
          const productData: { [key: string]: Product } = {}
          const batchSize = 10

          for (let i = 0; i < uniqueProductIds.length; i += batchSize) {
            const batch = uniqueProductIds.slice(i, i + batchSize)
            try {
              const productsRef = collection(db, "products")
              const productsQuery = query(productsRef, where("__name__", "in", batch))
              const productsSnapshot = await getDocs(productsQuery)

              productsSnapshot.forEach((doc) => {
                productData[doc.id] = { id: doc.id, ...doc.data() } as Product
              })
            } catch (error) {
              console.error(`Error fetching product batch:`, error)
              // Fallback to individual fetches for this batch
              const batchPromises = batch.map(async (productId) => {
                try {
                  const productDoc = await getDoc(doc(db, "products", productId))
                  if (productDoc.exists()) {
                    productData[productId] = { id: productDoc.id, ...productDoc.data() } as Product
                  }
                } catch (err) {
                  console.error(`Error fetching product ${productId}:`, err)
                }
              })
              await Promise.all(batchPromises)
            }
          }

          setProducts(Object.values(productData).filter(p => p.id))
        } else {
          // No search term, use Firestore query
          const bookingsRef = collection(db, "booking")
          const bookingsQuery = query(
            bookingsRef,
            where("company_id", "==", userData.company_id),
            where("quotation_id", "!=", null),
            orderBy("created", "desc")
          )

          const querySnapshot = await getDocs(bookingsQuery)
          const fetchedBookings: Booking[] = []

          querySnapshot.docs.forEach((doc) => {
            fetchedBookings.push({ id: doc.id, ...doc.data() })
          })

          setBookings(fetchedBookings)
          setTotalPages(Math.ceil(fetchedBookings.length / itemsPerPage))

          // Create project names map and booking IDs map
          const namesMap: { [productId: string]: string } = {}
          const bookingIdsMap: { [productId: string]: string } = {}
          fetchedBookings.forEach((booking) => {
            if (booking.product_id) {
              namesMap[booking.product_id] = booking.project_name || "No Project Name"
              bookingIdsMap[booking.product_id] = booking.reservation_id || booking.id
            }
          })
          setProjectNames(namesMap)
          setBookingIds(bookingIdsMap)

          const productIds = fetchedBookings
            .map((booking) => booking.product_id)
            .filter((id): id is string => Boolean(id))

          const uniqueProductIds = [...new Set(productIds)]

          // Batch fetch products in chunks of 10 (Firestore limit for 'in' queries)
          const productData: { [key: string]: Product } = {}
          const batchSize = 10

          for (let i = 0; i < uniqueProductIds.length; i += batchSize) {
            const batch = uniqueProductIds.slice(i, i + batchSize)
            try {
              const productsRef = collection(db, "products")
              const productsQuery = query(productsRef, where("__name__", "in", batch))
              const productsSnapshot = await getDocs(productsQuery)

              productsSnapshot.forEach((doc) => {
                productData[doc.id] = { id: doc.id, ...doc.data() } as Product
              })
            } catch (error) {
              console.error(`Error fetching product batch:`, error)
              // Fallback to individual fetches for this batch
              const batchPromises = batch.map(async (productId) => {
                try {
                  const productDoc = await getDoc(doc(db, "products", productId))
                  if (productDoc.exists()) {
                    productData[productId] = { id: productDoc.id, ...productDoc.data() } as Product
                  }
                } catch (err) {
                  console.error(`Error fetching product ${productId}:`, err)
                }
              })
              await Promise.all(batchPromises)
            }
          }

          setProducts(Object.values(productData).filter(p => p.id))
        }
      } catch (error) {
        console.error("Error fetching bookings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [userData?.company_id, debouncedSearchTerm])

  useEffect(() => {
    const fetchReports = async () => {
      if (!userData?.company_id) {
        setReportsLoading(false)
        return
      }

      try {
        setReportsLoading(true)
        const latestReports = await getReportsPerBooking(userData.company_id)
        setReports(latestReports)
      } catch (error) {
        console.error("Error fetching reports:", error)
      } finally {
        setReportsLoading(false)
      }
    }

    fetchReports()

    // Set up real-time listener for reports
    if (userData?.company_id) {
      const reportsQuery = query(
        collection(db, "reports"),
        where("companyId", "==", userData.company_id),
        orderBy("created", "desc")
      )

      const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
        const latestReports: { [bookingId: string]: ReportData[] } = {}

        snapshot.docs.forEach((doc) => {
          const data = doc.data()
          const report: ReportData = {
            id: doc.id,
            ...data,
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
          } as ReportData

          // Add all reports for each booking_id
          if (report.booking_id) {
            if (!latestReports[report.booking_id]) {
              latestReports[report.booking_id] = []
            }
            latestReports[report.booking_id].push(report)
          }
        })

        setReports(latestReports)
      })

      return () => unsubscribe()
    }
  }, [userData?.company_id])

  useEffect(() => {
    const fetchServiceAssignments = async () => {
      if (!userData?.company_id) {
        setServiceAssignmentsLoading(false)
        return
      }

      try {
        setServiceAssignmentsLoading(true)
        const latestAssignments = await getLatestServiceAssignmentsPerBooking(userData.company_id)
        setServiceAssignments(latestAssignments)
      } catch (error) {
        console.error("Error fetching service assignments:", error)
      } finally {
        setServiceAssignmentsLoading(false)
      }
    }

    fetchServiceAssignments()
  }, [userData?.company_id])


  return (
    <div className="min-h-screen">
      <BulletinBoardContent
        title="Bulletin Board"
        showTitle={true}
        showSearch={true}
        containerClassName="bg-neutral-50 min-h-screen px-4 py-6"
        paginationClassName="flex justify-end mt-4 pb-4"
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        loading={loading}
        bookings={bookings}
        products={products}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalPages={totalPages}
        handleNextPage={handleNextPage}
        handlePreviousPage={handlePreviousPage}
        reports={reports}
        reportsLoading={reportsLoading}
        serviceAssignments={Object.fromEntries(Object.entries(serviceAssignments).map(([k, v]) => [k, [v]]))}
        serviceAssignmentsLoading={serviceAssignmentsLoading}
      />
    </div>
  )
}