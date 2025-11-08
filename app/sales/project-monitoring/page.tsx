"use client"

import { ArrowLeft, Search, ChevronDown, X, FileText, Loader2, CheckCircle, PlusCircle, MoreVertical, List, Grid3X3 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useEffect, useState, useRef } from "react"
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, DocumentData, QueryDocumentSnapshot, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product } from "@/lib/firebase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { getAllClients, type Client } from "@/lib/client-service"
import { DateRangeCalendarDialog } from "@/components/date-range-calendar-dialog"
import { createDirectQuotation, createMultipleQuotations } from "@/lib/quotation-service"
import { useDebounce } from "@/hooks/use-debounce"
import { BulletinBoardContent } from "@/components/BulletinBoardContent"
import { getReportsPerBooking } from "@/lib/report-service"
import { getLatestServiceAssignmentsPerBooking } from "@/lib/firebase-service"
import type { ReportData } from "@/lib/report-service"
import type { ServiceAssignment } from "@/lib/firebase-service"

interface JobOrderCount {
  [productId: string]: number
}

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
  const [jobOrderCounts, setJobOrderCounts] = useState<JobOrderCount>({})
  const [latestJoNumbers, setLatestJoNumbers] = useState<{ [productId: string]: string }>({})
  const [latestJoIds, setLatestJoIds] = useState<{ [productId: string]: string }>({})
  const [reports, setReports] = useState<{ [bookingId: string]: ReportData[] }>({})
  const [reportsLoading, setReportsLoading] = useState(true)
  const [serviceAssignments, setServiceAssignments] = useState<{ [bookingId: string]: ServiceAssignment }>({})
  const [serviceAssignmentsLoading, setServiceAssignmentsLoading] = useState(true)
  const [projectNames, setProjectNames] = useState<{ [productId: string]: string }>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDialogLoading, setIsDialogLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [totalPages, setTotalPages] = useState(1)

  // Quote mode states
  const [quoteMode, setQuoteMode] = useState(false)
  const [selectedSites, setSelectedSites] = useState<Product[]>([])
  const [selectedClientForQuote, setSelectedClientForQuote] = useState<Client | null>(null)
  const [dashboardClientSearchTerm, setDashboardClientSearchTerm] = useState("")
  const [dashboardClientSearchResults, setDashboardClientSearchResults] = useState<Client[]>([])
  const [isSearchingDashboardClients, setIsSearchingDashboardClients] = useState(false)
  const debouncedDashboardClientSearchTerm = useDebounce(dashboardClientSearchTerm, 500)
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false)
  const [actionAfterDateSelection, setActionAfterDateSelection] = useState<"quotation" | null>(null)
  const [isCreatingDocument, setIsCreatingDocument] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const clientSearchRef = useRef<HTMLDivElement>(null)


  const fetchJobOrderCounts = async (productIds: string[]) => {
    if (!userData?.company_id || productIds.length === 0) return

    try {
      const counts: JobOrderCount = {}
      const latestJoNumbersMap: { [productId: string]: string } = {}
      const latestJoIdsMap: { [productId: string]: string } = {}

      // Fetch job orders for all products at once
      const jobOrdersRef = collection(db, "job_orders")
      const q = query(jobOrdersRef, where("company_id", "==", userData.company_id))
      const querySnapshot = await getDocs(q)

      // Group job orders by productId
      const jobOrdersByProduct: { [productId: string]: JobOrder[] } = {}
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const productId = data.product_id
        if (productId && productIds.includes(productId)) {
          if (!jobOrdersByProduct[productId]) {
            jobOrdersByProduct[productId] = []
          }
          jobOrdersByProduct[productId].push({ id: doc.id, ...data } as JobOrder)
        }
      })

      // For each product, sort job orders by createdAt descending and get latest joNumber and ID
      Object.keys(jobOrdersByProduct).forEach((productId) => {
        const jobOrders = jobOrdersByProduct[productId]
        counts[productId] = jobOrders.length

        if (jobOrders.length > 0) {
          // Sort by createdAt descending (newest first)
          jobOrders.sort((a, b) => {
            let aTime: Date
            let bTime: Date

            if (a.createdAt?.toDate) {
              aTime = a.createdAt.toDate()
            } else if (a.createdAt) {
              aTime = new Date(a.createdAt)
            } else {
              aTime = new Date(0)
            }

            if (b.createdAt?.toDate) {
              bTime = b.createdAt.toDate()
            } else if (b.createdAt) {
              bTime = new Date(b.createdAt)
            } else {
              bTime = new Date(0)
            }

            return bTime.getTime() - aTime.getTime()
          })

          // Get the latest job order
          const latestJo = jobOrders[0]
          latestJoNumbersMap[productId] = latestJo.joNumber || latestJo.id.slice(-6)
          latestJoIdsMap[productId] = latestJo.id
        }
      })

      console.log('Job Order Counts:', counts)
      console.log('Latest JO Numbers:', latestJoNumbersMap)
      console.log('Latest JO IDs:', latestJoIdsMap)
      setJobOrderCounts(counts)
      setLatestJoNumbers(latestJoNumbersMap)
      setLatestJoIds(latestJoIdsMap)
    } catch (error) {
      console.error("Error fetching job order counts:", error)
    }
  }

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

  // Quote mode functions
  const handleQuoteMode = () => {
    setQuoteMode(true)
    setSelectedSites([])
    setSelectedClientForQuote(null)
    setDashboardClientSearchTerm("")
  }

  const handleCancelQuote = () => {
    setQuoteMode(false)
    setSelectedSites([])
    setSelectedClientForQuote(null)
    setDashboardClientSearchTerm("")
  }

  const handleClientSelectForQuote = (client: Client) => {
    setSelectedClientForQuote(client)
    setDashboardClientSearchTerm(client.company || client.name || "")
  }

  const handleSiteSelect = (product: Product) => {
    setSelectedSites((prev) => {
      const isSelected = prev.some((p) => p.id === product.id)
      if (isSelected) {
        return prev.filter((p) => p.id !== product.id)
      } else {
        return [...prev, product]
      }
    })
  }

  const openCreateQuotationDateDialog = () => {
    if (selectedSites.length === 0) {
      alert("Please select at least one site for the quotation.")
      return
    }
    if (!selectedClientForQuote) {
      alert("Please select a client first.")
      return
    }
    setActionAfterDateSelection("quotation")
    setIsDateRangeDialogOpen(true)
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

        if (uniqueProductIds.length > 0) {
          await fetchJobOrderCounts(uniqueProductIds)
        }
      } catch (error) {
        console.error("Error fetching bookings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
   }, [userData?.company_id])

   // Fetch clients for quote mode
   useEffect(() => {
     const fetchClients = async () => {
       if (quoteMode && userData?.company_id) {
         setIsSearchingDashboardClients(true)
         try {
           const result = await getAllClients()
           setDashboardClientSearchResults(result)
         } catch (error) {
           console.error("Error fetching clients for quote mode:", error)
           setDashboardClientSearchResults([])
         } finally {
           setIsSearchingDashboardClients(false)
         }
       } else {
         setDashboardClientSearchResults([])
       }
     }
     fetchClients()
   }, [quoteMode, userData?.company_id])

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

   useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
       if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
         // Close any open dropdowns if needed
       }
     }

     document.addEventListener("mousedown", handleClickOutside)
     return () => {
       document.removeEventListener("mousedown", handleClickOutside)
     }
   }, [])

   const handleDatesSelected = async (startDate: Date, endDate: Date) => {
     if (!user?.uid || !userData?.company_id) {
       alert("Authentication required")
       return
     }

     setIsCreatingDocument(true)
     try {
       const sitesData = selectedSites.map((site) => ({
         id: site.id!,
         name: site.name,
         location: site.specs_rental?.location || (site as any).light?.location || "N/A",
         price: site.price || 0,
         type: site.type || "Unknown",
         image: site.media && site.media.length > 0 ? site.media[0].url : undefined,
         content_type: site.content_type || "",
         specs_rental: site.specs_rental,
       }))
       const clientData = {
         id: selectedClientForQuote!.id,
         name: selectedClientForQuote!.name,
         email: selectedClientForQuote!.email,
         company: selectedClientForQuote!.company,
         phone: selectedClientForQuote!.phone,
         address: selectedClientForQuote!.address,
         designation: selectedClientForQuote!.designation,
         industry: selectedClientForQuote!.industry,
         company_id: selectedClientForQuote!.company_id
       }

       const options = {
         startDate,
         endDate,
         company_id: userData.company_id,
         client_company_id: selectedClientForQuote!.company_id,
         page_id: selectedSites.length > 1 ? `PAGE-${Date.now()}` : undefined,
         created_by_first_name: userData.first_name,
         created_by_last_name: userData.last_name,
       }

       let quotationIds: string[]

       if (selectedSites.length > 1) {
         quotationIds = await createMultipleQuotations(clientData, sitesData, user!.uid, options)
         alert(`Successfully created ${quotationIds.length} quotations for the selected sites.`)
       } else {
         const quotationId = await createDirectQuotation(clientData, sitesData, user!.uid, options)
         quotationIds = [quotationId]
         alert("Quotation has been created successfully.")
       }

       router.push(`/sales/quotations/${quotationIds[quotationIds.length - 1]}`)
     } catch (error) {
       console.error("Error creating quotation:", error)
       alert("Failed to create quotation. Please try again.")
     } finally {
       setIsCreatingDocument(false)
       setIsDateRangeDialogOpen(false)
     }
   }
 
   const bookingData = bookings.map((b) => ({
     id: b.id,
     product_id: b.product_id,
     reservation_id: b.reservation_id,
     project_name: b.project_name,
   }))
   const reportsData = reports
 
   return (
     <div className="min-h-screen">

      {quoteMode && (
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">Select Client:</span>
            <div className="relative w-64" ref={clientSearchRef}>
              <Input
                placeholder="Search or select client..."
                value={selectedClientForQuote ? (selectedClientForQuote.company || selectedClientForQuote.name) : dashboardClientSearchTerm}
                onChange={(e) => {
                  setDashboardClientSearchTerm(e.target.value)
                  setSelectedClientForQuote(null)
                }}
                className="pr-10"
              />
              {isSearchingDashboardClients && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
              )}
              {dashboardClientSearchResults.length > 0 && (
                <Card className="absolute top-full z-50 mt-1 w-full shadow-lg">
                  <div className="max-h-[200px] overflow-y-auto">
                    <div className="p-2">
                      <div
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 cursor-pointer rounded-md text-sm mb-2 border-b pb-2"
                        onClick={() => {/* Add new client */}}
                      >
                        <PlusCircle className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-blue-700">Add New Client</span>
                      </div>
                      {dashboardClientSearchResults.map((result) => (
                        <div
                          key={result.id}
                          className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-100 cursor-pointer rounded-md text-sm"
                          onClick={() => handleClientSelectForQuote(result)}
                        >
                          <div>
                            <p className="font-medium">{result.name} ({result.company})</p>
                            <p className="text-xs text-gray-500">{result.email}</p>
                          </div>
                          {selectedClientForQuote?.id === result.id && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
            {selectedClientForQuote && (
              <span className="text-sm text-green-600">Client selected: {selectedClientForQuote.company || selectedClientForQuote.name}</span>
            )}
          </div>
        </div>
      )}

      <div>
        {loading ? (
          <div className="text-center py-12" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading projects...</p>
            <span className="sr-only">Loading project data</span>
          </div>
        ) : bookings.length > 0 ? (
          <BulletinBoardContent
            title="Bulletin Board"
            showTitle={true}
            showSearch={true}
            containerClassName="bg-neutral-50 min-h-screen px-4 py-6"
            paginationClassName="flex justify-end mt-4 pb-4"
            linkPrefix="/sales/project-monitoring/details"
            latestJoIds={latestJoIds}
            onClick={quoteMode ? handleSiteSelect : undefined}
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
            reportsLoading={false}
            serviceAssignments={Object.fromEntries(Object.entries(serviceAssignments).map(([k, v]) => [k, [v]]))}
            serviceAssignmentsLoading={serviceAssignmentsLoading}
          />
        ) : (
          <div className="text-center py-12" role="status" aria-live="polite">
            <div className="text-gray-400 mb-4">
              <Search className="h-12 w-12 mx-auto" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or check back later.</p>
          </div>
        )}
      </div>

      {quoteMode && selectedSites.length > 0 && selectedClientForQuote && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Button
            onClick={openCreateQuotationDateDialog}
            className="gap-2 bg-green-600 text-white hover:bg-green-700"
            disabled={isCreatingDocument}
          >
            {isCreatingDocument ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Create Quotation
              </>
            )}
          </Button>
        </div>
      )}

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
                      onClick={() => router.push(`/sales/project-monitoring/details/${jobOrder.id}`)}
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

      <DateRangeCalendarDialog
        isOpen={isDateRangeDialogOpen}
        onClose={() => setIsDateRangeDialogOpen(false)}
        onSelectDates={handleDatesSelected}
        onSkipDates={() => {}}
        selectedSiteIds={selectedSites.map((site) => site.id || "")}
        selectedClientId={selectedClientForQuote?.id}
        showSkipButton={false}
      />
    </div>
  )
}
