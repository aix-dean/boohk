"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useEffect, useState } from "react"
import { collection, query, where, orderBy, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { BulletinBoardContent } from "@/components/BulletinBoardContent"
import { getReportsPerBooking } from "@/lib/report-service"
import { getLatestServiceAssignmentsPerBooking } from "@/lib/firebase-service"
import type { Product } from "@/lib/firebase-service"
import type { ReportData } from "@/lib/report-service"
import type { ServiceAssignment } from "@/lib/firebase-service"

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

export default function ProjectMonitoringPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [totalPages, setTotalPages] = useState(1)
  const [reports, setReports] = useState<{ [bookingId: string]: ReportData[] }>({})
  const [reportsLoading, setReportsLoading] = useState(true)
  const [serviceAssignments, setServiceAssignments] = useState<{ [bookingId: string]: ServiceAssignment }>({})
  const [serviceAssignmentsLoading, setServiceAssignmentsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')



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



  useEffect(() => {
    const fetchBookings = async () => {
      if (!userData?.company_id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
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

        // Create project names map
        const namesMap: { [productId: string]: string } = {}
        fetchedBookings.forEach((booking) => {
          if (booking.product_id && booking.project_name) {
            namesMap[booking.product_id] = booking.project_name
          }
        })
        const projectNames = namesMap

        const productIds = fetchedBookings
          .map((booking) => booking.product_id)
          .filter((id): id is string => Boolean(id))

        const uniqueProductIds = [...new Set(productIds)]
        const productData: { [key: string]: Product } = {}

        for (const productId of uniqueProductIds) {
          try {
            const productDoc = await getDoc(doc(db, "products", productId))
            if (productDoc.exists()) {
              productData[productId] = { id: productDoc.id, ...productDoc.data() } as Product
            }
          } catch (error) {
            console.error(`Error fetching product ${productId}:`, error)
          }
        }

        setProducts(Object.values(productData).filter(p => p.id))
      } catch (error) {
        console.error("Error fetching bookings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [userData?.company_id])

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



  const bookingData = bookings.map((b) => ({
    id: b.id,
    product_id: b.product_id,
    reservation_id: b.reservation_id,
    project_name: b.project_name,
  }))
  const reportsData = reports

  return (
    <BulletinBoardContent
      title="Bulletin Board"
      showTitle={true}
      showSearch={true}
      containerClassName="bg-neutral-50 min-h-screen px-4 py-6"
      paginationClassName="flex justify-end mt-4 pb-4"
      linkPrefix="/business/project-bulletin/details"
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      loading={loading}
      bookings={bookingData}
      products={products}
      currentPage={currentPage}
      itemsPerPage={itemsPerPage}
      totalPages={totalPages}
      handleNextPage={handleNextPage}
      handlePreviousPage={handlePreviousPage}
      reports={reportsData}
      reportsLoading={reportsLoading}
      serviceAssignments={Object.fromEntries(Object.entries(serviceAssignments).map(([k, v]) => [k, [v]]))}
      serviceAssignmentsLoading={serviceAssignmentsLoading}
    />
  )
}