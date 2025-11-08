"use client"

import { ArrowLeft, Search, X, FileText, Loader2, CheckCircle, PlusCircle, MoreVertical, List, Grid3X3 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useEffect, useState, useRef } from "react"
import { collection, query, where, orderBy, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product } from "@/lib/firebase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { BulletinBoardContent } from "@/components/BulletinBoardContent"
import { getReportsPerBooking } from "@/lib/report-service"
import { getLatestServiceAssignmentsPerBooking } from "@/lib/firebase-service"
import type { ReportData } from "@/lib/report-service"
import type { ServiceAssignment } from "@/lib/firebase-service"


interface JobOrder {
  id: string
  joNumber: string
  product_id: string
  company_id: string
  status: string
  createdAt: any
  updatedAt: any
  [key: string]: any
}

interface Report {
  id: string
  joNumber: string
  date: any
  updated: any
  category: string
  status: string
  description: string
  descriptionOfWork?: string
  attachments?: string[]
  [key: string]: any
}

interface ProductReports {
  [productId: string]: Report[]
}

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
  const { user, userData } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [latestJoNumbers, setLatestJoNumbers] = useState<{ [productId: string]: string }>({})
  const [latestJoIds, setLatestJoIds] = useState<{ [productId: string]: string }>({})
  const [productReports, setProductReports] = useState<ProductReports>({})
  const [projectNames, setProjectNames] = useState<{ [productId: string]: string }>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDialogLoading, setIsDialogLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [totalPages, setTotalPages] = useState(1)
  const [reports, setReports] = useState<{ [bookingId: string]: ReportData[] }>({})
  const [reportsLoading, setReportsLoading] = useState(true)
  const [serviceAssignments, setServiceAssignments] = useState<{ [bookingId: string]: ServiceAssignment }>({})
  const [serviceAssignmentsLoading, setServiceAssignmentsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")



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

  const handleOpenDialog = async (product: Product) => {
    setSelectedProduct(product)
    setIsDialogOpen(true)
    setIsDialogLoading(true)

    try {
      if (!userData?.company_id) return

      const jobOrdersRef = collection(db, "job_orders")
      const q = query(
        jobOrdersRef,
        where("company_id", "==", userData.company_id),
        where("product_id", "==", product.id),
      )
      const querySnapshot = await getDocs(q)

      const fetchedJobOrders: JobOrder[] = []
      querySnapshot.forEach((doc) => {
        fetchedJobOrders.push({ id: doc.id, ...doc.data() } as JobOrder)
      })

      fetchedJobOrders.sort((a, b) => {
        let aTime: Date
        let bTime: Date

        // Handle Firestore Timestamp objects
        if (a.createdAt?.toDate) {
          aTime = a.createdAt.toDate()
        } else if (a.createdAt) {
          aTime = new Date(a.createdAt)
        } else {
          aTime = new Date(0) // Default to epoch if no date
        }

        if (b.createdAt?.toDate) {
          bTime = b.createdAt.toDate()
        } else if (b.createdAt) {
          bTime = new Date(b.createdAt)
        } else {
          bTime = new Date(0) // Default to epoch if no date
        }

        // Sort descending (newest first)
        return bTime.getTime() - aTime.getTime()
      })

      setJobOrders(fetchedJobOrders)
    } catch (error) {
      console.error("Error fetching job orders:", error)
      setJobOrders([])
    } finally {
      setIsDialogLoading(false)
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
        setProjectNames(namesMap)

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
    <div className="min-h-screen">
      <BulletinBoardContent
        title="Bulletin Board"
        showTitle={true}
        showSearch={true}
        containerClassName="bg-neutral-50 min-h-screen px-4 py-6"
        paginationClassName="flex justify-end mt-4 pb-4"
        linkPrefix="/admin/project-bulletin/details"
        latestJoIds={latestJoIds}
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


      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg p-6 w-[600px] max-w-[90vw] max-h-[80vh] relative animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setIsDialogOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Job Orders</h2>
              {selectedProduct && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedProduct.specs_rental?.location || selectedProduct.name || "Unknown Site"}
                </p>
              )}
            </div>

            {isDialogLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-500">Loading job orders...</p>
              </div>
            ) : jobOrders.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {jobOrders.map((jobOrder) => (
                    <div
                      key={jobOrder.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/project-bulletin/details/${jobOrder.id}`)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">
                          Job Order #: {jobOrder.joNumber || jobOrder.id.slice(-6)}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            jobOrder.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : jobOrder.status === "in_progress"
                                ? "bg-blue-100 text-blue-800"
                                : jobOrder.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {jobOrder.status || "Unknown"}
                        </span>
                      </div>

                      {jobOrder.description && <p className="text-sm text-gray-600 mb-2">{jobOrder.description}</p>}

                      <div className="text-xs text-gray-500">
                        Created: {(() => {
                          if (jobOrder.createdAt?.toDate) {
                            return jobOrder.createdAt.toDate().toLocaleDateString()
                          } else if (jobOrder.createdAt) {
                            const date = new Date(jobOrder.createdAt)
                            return isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString()
                          }
                          return "Unknown"
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No job orders found for this site</div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}