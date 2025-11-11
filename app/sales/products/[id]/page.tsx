"use client"

import React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock3,
  Maximize,
  Check,
  X,
  Calendar,
  FileText,
  Mail,
  Eye,
  AlertCircle,
  Loader2,
  ImageIcon,
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getQuotationRequestsByProductId, type QuotationRequest } from "@/lib/firebase-service"
import { getAllCostEstimates, type CostEstimate } from "@/lib/cost-estimate-service"
import { getAllQuotations, type Quotation } from "@/lib/quotation-service"
import { getAllJobOrders, type JobOrder } from "@/lib/job-order-service"
import { getReportsByProductId, getLatestReportsByBookingIds, type ReportData } from "@/lib/report-service"
import type { Booking } from "@/lib/booking-service"
import { formatBookingDates } from "@/lib/booking-service"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import { collection, query, where, orderBy, getDocs } from "firebase/firestore"
import { SpotsGrid } from "@/components/spots-grid"
import { GoogleMap } from "@/components/GoogleMap"
import SiteInformation from "@/components/SiteInformation"
import { SpotSelectionDialog } from "@/components/spot-selection-dialog"

const CalendarView: React.FC<{ bookedDates: Date[] }> = ({ bookedDates }) => {
  const [currentDate, setCurrentDate] = useState(new Date())

  const isDateBooked = (date: Date) => {
    return bookedDates.some(bookedDate =>
      bookedDate.getDate() === date.getDate() &&
      bookedDate.getMonth() === date.getMonth() &&
      bookedDate.getFullYear() === date.getFullYear()
    )
  }

  const generateCalendarMonths = () => {
    const months = []
    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1)
      months.push(monthDate)
    }
    return months
  }

  const generateMonthDays = (monthDate: Date) => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const current = new Date(startDate)

    while (current <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }

  const months = generateCalendarMonths()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Booking Calendar</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {months.map((monthDate, monthIndex) => {
          const days = generateMonthDays(monthDate)
          const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

          return (
            <div key={monthIndex} className="border rounded-lg p-4">
              <h4 className="font-semibold text-center mb-4">{monthName}</h4>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, dayIndex) => {
                  const isCurrentMonth = day.getMonth() === monthDate.getMonth()
                  const isToday = day.toDateString() === new Date().toDateString()
                  const booked = isDateBooked(day)

                  return (
                    <div
                      key={dayIndex}
                      className={`
                        text-center py-2 text-sm relative
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-900'}
                        ${isToday ? 'bg-blue-100 rounded' : ''}
                        ${booked ? 'bg-red-100 text-red-800 font-semibold' : ''}
                      `}
                    >
                      {day.getDate()}
                      {booked && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center text-center break-all min-w-0 gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}

const GoogleMap = React.memo(({ location, className }: { location: string; className?: string }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    const initializeMaps = async () => {
      try {
        await loadGoogleMaps()
        await initializeMap()
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        setMapError(true)
      }
    }

    const initializeMap = async () => {
      if (!mapRef.current || !window.google) return

      try {
        const geocoder = new window.google.maps.Geocoder()

        // Geocode the location
        geocoder.geocode({ address: location }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status === "OK" && results && results[0]) {
            const map = new window.google.maps.Map(mapRef.current!, {
              center: results[0].geometry.location,
              zoom: 15,
              disableDefaultUI: true,
              gestureHandling: "none",
              zoomControl: false,
              mapTypeControl: false,
              scaleControl: false,
              streetViewControl: false,
              rotateControl: false,
              fullscreenControl: false,
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }],
                },
              ],
            })

            // Add marker
            new window.google.maps.Marker({
              position: results[0].geometry.location,
              map: map,
              title: location,
              icon: {
                url:
                  "data:image/svg+xml;charset=UTF-8," +
                  encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 32),
              },
            })

            setMapLoaded(true)
          } else {
            console.error("Geocoding failed:", status)
            setMapError(true)
          }
        })
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError(true)
      }
    }

    initializeMaps()
  }, [location])

  if (mapError) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center text-center break-all min-w-0 ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Map unavailable</p>
          <p className="text-xs mt-1">{location}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center text-center break-all min-w-0">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
});

// Helper function to convert Firebase timestamp to readable date
export const formatFirebaseDate = (timestamp: any): string => {
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

function formatDate(dateString: any): string {
  if (!dateString) return "N/A"

  try {
    const date =
      typeof dateString === "string"
        ? new Date(dateString)
        : dateString instanceof Date
          ? dateString
          : dateString.toDate
            ? dateString.toDate()
            : new Date()

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Invalid Date"
  }
}

function CustomNotification({
  show,
  type,
  message,
  onClose,
}: {
  show: boolean
  type: "success" | "error"
  message: string
  onClose: () => void
}) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [show, onClose])

  if (!show) return null

  return (
    <div
      className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300"
      role="alert"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${
          type === "success"
            ? "bg-green-50/95 border-green-200 text-green-800"
            : "bg-red-50/95 border-red-200 text-red-800"
        }`}
      >
        <div className="flex-shrink-0">
          {type === "success" ? (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center text-center break-all min-w-0">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center text-center break-all min-w-0">
              <X className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs sm:text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
   const router = useRouter()
   const { userData } = useAuth()
   const { toast } = useToast()

   // Diagnostic log for params
   console.log('🔍 DEBUG: params type:', typeof params, 'params value:', params)
   const paramsData = React.use(params)
   const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id

  // Helper functions for spots data
  const generateSpotsData = (cms: any, currentDayBookings: Booking[], reportsData: { [bookingId: string]: ReportData | null }) => {
    const totalSpots = cms.loops_per_day || 18
    const spots = []

    // Get occupied spot numbers from current day bookings
    const occupiedSpots = new Set<number>()
    currentDayBookings.forEach(booking => {
      if (booking.spot_numbers && Array.isArray(booking.spot_numbers)) {
        booking.spot_numbers.forEach(spotNumber => {
          occupiedSpots.add(spotNumber)
        })
      }
    })

    // Sample client names for demonstration
    const clientNames = ["Coca-Cola", "Bear-Brand", "Toyota", "Lucky Me", "Bench", "Maggi", "Oishi"]

    for (let i = 1; i <= totalSpots; i++) {
      const isOccupied = occupiedSpots.has(i)

      // Find booking for this spot to get client info
      const booking = currentDayBookings.find(b => b.spot_numbers?.includes(i))
      const schedule = screenSchedules.find(s => s.spot_number === i && s.active)

      // Get image URL from report attachments
      let imageUrl: string | undefined
      if (booking && reportsData[booking.id]) {
        const report = reportsData[booking.id]
        console.log(`Spot ${i}: Found report for booking ${booking.id}:`, report)
        if (report && report.attachments && report.attachments.length > 0) {
          // Find attachment with label "After" (case insensitive)
          const afterAttachment = report.attachments.find(att => att.label?.toLowerCase() === "after")
          console.log(`Spot ${i}: After attachment:`, afterAttachment)
          if (afterAttachment) {
            imageUrl = afterAttachment.fileUrl
          } else {
            // Use first attachment if no "After" label
            imageUrl = report.attachments[0].fileUrl
            console.log(`Spot ${i}: Using first attachment:`, imageUrl)
          }
        } else {
          console.log(`Spot ${i}: No attachments in report`)
        }
      } else {
        console.log(`Spot ${i}: No booking or report found for booking ${booking?.id}`)
      }
      console.log(`Spot ${i}: Final imageUrl:`, imageUrl)

      spots.push({
        id: `spot-${i}`,
        number: i,
        status: (isOccupied ? "occupied" : "vacant") as "occupied" | "vacant",
        clientName: isOccupied ? (booking?.client?.name || schedule?.title || clientNames[(i - 1) % clientNames.length]) : undefined,
        imageUrl,
      })
    }

    return spots
  }

  const calculateOccupiedSpots = (cms: any) => {
    console.log("🔍 DEBUG: calculateOccupiedSpots called with cms:", cms)
    console.log("🔍 DEBUG: currentDayBookings:", currentDayBookings)
    console.log("🔍 DEBUG: currentDayBookingsLoading:", currentDayBookingsLoading)

    if (currentDayBookingsLoading) {
      console.log("🔍 DEBUG: Still loading current day bookings, returning 0")
      return 0
    }

    // Count unique spot numbers from current day's bookings
    const occupiedSpots = new Set()
    currentDayBookings.forEach(booking => {
      if (booking.spot_numbers && Array.isArray(booking.spot_numbers)) {
        booking.spot_numbers.forEach(spotNumber => {
          occupiedSpots.add(spotNumber)
          console.log("🔍 DEBUG: Adding spot number to occupied:", spotNumber, "from booking:", booking.id)
        })
      } else {
        console.log("🔍 DEBUG: Booking has no spot_numbers or invalid format:", booking.id, booking.spot_numbers)
      }
    })

    const occupiedCount = occupiedSpots.size
    console.log("🔍 DEBUG: Total occupied spots calculated:", occupiedCount, "from", currentDayBookings.length, "bookings")

    return occupiedCount
  }

  const calculateVacantSpots = (cms: any) => {
    const totalSpots = cms.loops_per_day || 18
    return totalSpots - calculateOccupiedSpots(cms)
  }

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [quotationRequests, setQuotationRequests] = useState<QuotationRequest[]>([])
  const [quotationRequestsLoading, setQuotationRequestsLoading] = useState(true)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [costEstimates, setCostEstimates] = useState<CostEstimate[]>([])
  const [costEstimatesLoading, setCostEstimatesLoading] = useState(true)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [quotationsLoading, setQuotationsLoading] = useState(true)
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [jobOrdersLoading, setJobOrdersLoading] = useState(true)
  const [reports, setReports] = useState<ReportData[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsTotal, setReportsTotal] = useState(0)
  const [reportsPage, setReportsPage] = useState(1)
  const [bookingsTotal, setBookingsTotal] = useState(0)
  const [bookingsPage, setBookingsPage] = useState(1)
  const [costEstimatesTotal, setCostEstimatesTotal] = useState(0)
  const [costEstimatesPage, setCostEstimatesPage] = useState(1)
  const [quotationsTotal, setQuotationsTotal] = useState(0)
  const [quotationsPage, setQuotationsPage] = useState(1)
  const [jobOrdersTotal, setJobOrdersTotal] = useState(0)
  const [jobOrdersPage, setJobOrdersPage] = useState(1)
  const itemsPerPage = 10
  const [marketplaceDialogOpen, setMarketplaceDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("booking-summary")
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false)
  const [bookedDates, setBookedDates] = useState<Date[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [screenSchedules, setScreenSchedules] = useState<any[]>([])
  const [currentDayBookings, setCurrentDayBookings] = useState<Booking[]>([])
  const [currentDayBookingsLoading, setCurrentDayBookingsLoading] = useState(false)
  const [reportsData, setReportsData] = useState<{ [bookingId: string]: ReportData | null }>({})
  const [companyName, setCompanyName] = useState<string>("")
  const [companyLoading, setCompanyLoading] = useState(false)
  const [isSpotSelectionDialogOpen, setIsSpotSelectionDialogOpen] = useState(false)
  const [spotSelectionProducts, setSpotSelectionProducts] = useState<any[]>([])
  const [spotSelectionSpotsData, setSpotSelectionSpotsData] = useState<Record<string, any>>({})
  const [spotSelectionCurrentDate, setSpotSelectionCurrentDate] = useState("")
  const [spotSelectionType, setSpotSelectionType] = useState<"quotation" | "cost-estimate">("quotation")
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [bookingRequests, setBookingRequests] = useState<Booking[]>([])
  const [bookingRequestsLoading, setBookingRequestsLoading] = useState(false)

  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const [notification, setNotification] = useState<{
    show: boolean
    type: "success" | "error"
    message: string
  }>({
    show: false,
    type: "success",
    message: "",
  })

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({
      show: true,
      type,
      message,
    })
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, show: false }))
  }


  useEffect(() => {
    async function fetchProduct() {
      if (!paramsData.id) return

      setLoading(true)
      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id

        if (productId === "new") {
          router.push("/sales/product/upload")
          return
        }

        const productDoc = await getDoc(doc(db, "products", productId))

        if (productDoc.exists()) {
          const productData = { id: productDoc.id, ...productDoc.data() }
          setProduct(productData)
        } else {
          console.error("Product not found")
          showNotification("error", "Product not found")
        }
      } catch (error) {
        console.error("Error fetching product:", error)
        showNotification("error", "Failed to load product details")
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [paramsData.id, router])

  // Fetch quotation requests for this product
  useEffect(() => {
    const fetchQuotationRequests = async () => {
      if (!paramsData.id || paramsData.id === "new") {
        setQuotationRequestsLoading(false)
        return
      }

      setQuotationRequestsLoading(true)
      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const requests = await getQuotationRequestsByProductId(productId)
        setQuotationRequests(requests)
      } catch (error) {
        console.error("Error fetching quotation requests:", error)
      } finally {
        setQuotationRequestsLoading(false)
      }
    }

    fetchQuotationRequests()
  }, [paramsData.id])

  // Fetch bookings for this product
  useEffect(() => {
    const fetchBookings = async () => {
      if (!paramsData.id || activeTab !== "booking-summary") return

      setBookingsLoading(true)
      setBookings([])
      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        console.log('🔍 DEBUG fetchBookings: userData?.uid:', userData?.uid, 'productId:', productId)
        const bookingsQuery = query(
          collection(db, "booking"),
          where("seller_id", "==", userData?.uid),
          where("for_censorship", "==", 1),
          where("product_id", "==", productId),
          orderBy("created", "desc")
        )
        console.log('🔍 DEBUG fetchBookings: Executing query with filters - seller_id:', userData?.uid, 'for_censorship: 2, product_id:', productId)
        const bookingsSnapshot = await getDocs(bookingsQuery)
        console.log('🔍 DEBUG fetchBookings: Query returned', bookingsSnapshot.size, 'documents')
        const allBookings: Booking[] = []

        bookingsSnapshot.forEach((doc) => {
          const bookingData = doc.data() as any
          console.log('🔍 DEBUG fetchBookings: Booking id:', doc.id, 'reservation_id:', bookingData.reservation_id, 'seller_id:', bookingData.seller_id, 'for_censorship:', bookingData.for_censorship, 'product_id:', bookingData.product_id)
          allBookings.push({
            id: doc.id,
            ...bookingData,
          } as Booking)
        })

        console.log('🔍 DEBUG fetchBookings: Total allBookings after processing:', allBookings.length)
        setBookingsTotal(allBookings.length)
        const offset = (bookingsPage - 1) * itemsPerPage
        const paginatedBookings = allBookings.slice(offset, offset + itemsPerPage)
        setBookings(paginatedBookings)
        console.log('🔍 DEBUG fetchBookings: Paginated bookings for page', bookingsPage, ':', paginatedBookings.map(b => ({ id: b.id, reservation_id: b.reservation_id })))
      } catch (error) {
        console.error("Error fetching bookings:", error)
      } finally {
        setBookingsLoading(false)
      }
    }

    fetchBookings()
  }, [paramsData.id, bookingsPage, activeTab])

  useEffect(() => {
    const fetchCostEstimates = async () => {
      if (!paramsData.id || paramsData.id === "new" || !product || activeTab !== "ce") {
        setCostEstimatesLoading(false)
        return
      }

      setCostEstimatesLoading(true)
      try {
        const allCostEstimates = await getAllCostEstimates()
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const productName = product?.name || ""
        const productLocation =
          product?.type?.toLowerCase() === "rental"
            ? product.specs_rental?.location || ""
            : product.light?.location || ""

        const relatedEstimates = allCostEstimates.filter((estimate) =>
          estimate.lineItems?.some(
            (item) =>
              item.id === productId ||
              item.description?.toLowerCase().includes(productName.toLowerCase()) ||
              (productLocation && item.notes?.toLowerCase().includes(productLocation.toLowerCase())),
          ),
        )

        setCostEstimatesTotal(relatedEstimates.length)
        const offset = (costEstimatesPage - 1) * itemsPerPage
        const paginatedEstimates = relatedEstimates.slice(offset, offset + itemsPerPage)
        setCostEstimates(paginatedEstimates)
      } catch (error) {
        console.error("Error fetching cost estimates:", error)
        showNotification("error", "Failed to load cost estimates")
      } finally {
        setCostEstimatesLoading(false)
      }
    }

    fetchCostEstimates()
  }, [paramsData.id, product, costEstimatesPage, activeTab])

  useEffect(() => {
    const fetchQuotations = async () => {
      if (!paramsData.id || paramsData.id === "new" || !product || activeTab !== "quote") {
        setQuotationsLoading(false)
        return
      }

      setQuotationsLoading(true)
      try {
        const allQuotations = await getAllQuotations()

        // Filter quotations that have products referencing this product
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const productName = product?.name || ""
        const productLocation =
          product?.type?.toLowerCase() === "rental"
            ? product.specs_rental?.location || ""
            : product.light?.location || ""

        const relatedQuotations = allQuotations.filter((quotation) =>
          quotation.items && typeof quotation.items === 'object' &&
          (quotation.items.product_id === productId ||
           (quotation.items.name && quotation.items.name.toLowerCase().includes(productName.toLowerCase())) ||
           (productLocation && quotation.items.location && quotation.items.location.toLowerCase().includes(productLocation.toLowerCase())))
        )

        setQuotationsTotal(relatedQuotations.length)
        const offset = (quotationsPage - 1) * itemsPerPage
        const paginatedQuotations = relatedQuotations.slice(offset, offset + itemsPerPage)
        setQuotations(paginatedQuotations)
      } catch (error) {
        console.error("Error fetching quotations:", error)
      } finally {
        setQuotationsLoading(false)
      }
    }

    fetchQuotations()
  }, [paramsData.id, product, quotationsPage, activeTab])

  useEffect(() => {
    const fetchJobOrders = async () => {
      if (!paramsData.id || paramsData.id === "new" || !product || activeTab !== "job-order") {
        setJobOrdersLoading(false)
        return
      }

      setJobOrdersLoading(true)
      try {
        const allJobOrders = await getAllJobOrders()

        // Filter job orders that reference this product by site info
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const productName = product?.name || ""
        const productLocation =
          product?.type?.toLowerCase() === "rental"
            ? product.specs_rental?.location || ""
            : product.light?.location || ""

        const relatedJobOrders = allJobOrders.filter(
          (jobOrder) =>
            jobOrder.product_id === productId ||
            jobOrder.siteName?.toLowerCase().includes(productName.toLowerCase()) ||
            (productLocation && jobOrder.siteLocation?.toLowerCase().includes(productLocation.toLowerCase())),
        )

        setJobOrdersTotal(relatedJobOrders.length)
        const offset = (jobOrdersPage - 1) * itemsPerPage
        const paginatedJobOrders = relatedJobOrders.slice(offset, offset + itemsPerPage)
        setJobOrders(paginatedJobOrders)
      } catch (error) {
        console.error("Error fetching job orders:", error)
      } finally {
        setJobOrdersLoading(false)
      }
    }

    fetchJobOrders()
  }, [paramsData.id, product, jobOrdersPage, activeTab])

  // Reset pages when switching tabs
  useEffect(() => {
    if (activeTab !== "booking-summary") {
      setBookingsPage(1)
    }
    if (activeTab !== "ce") {
      setCostEstimatesPage(1)
    }
    if (activeTab !== "quote") {
      setQuotationsPage(1)
    }
    if (activeTab !== "job-order") {
      setJobOrdersPage(1)
    }
    if (activeTab !== "reports") {
      setReportsPage(1)
    }
  }, [activeTab])

  useEffect(() => {
    const fetchReports = async () => {
      if (!paramsData.id || paramsData.id === "new" || activeTab !== "reports") {
        setReportsLoading(false)
        return
      }

      setReportsLoading(true)
      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const { reports: reportsData, total } = await getReportsByProductId(productId, reportsPage, itemsPerPage)
        setReports(reportsData)
        setReportsTotal(total)
      } catch (error) {
        console.error("Error fetching reports:", error)
      } finally {
        setReportsLoading(false)
      }
    }

    fetchReports()
  }, [paramsData.id, reportsPage, activeTab])

  // Fetch screen schedules for spots content status
  useEffect(() => {
    const fetchScreenSchedules = async () => {
      if (!paramsData.id || paramsData.id === "new") return

      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const q = query(
          collection(db, "screen_schedule"),
          where("product_id", "==", productId),
          where("deleted", "==", false),
        )
        const querySnapshot = await getDocs(q)
        const schedules = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setScreenSchedules(schedules)
      } catch (error) {
        console.error("Error fetching screen schedules:", error)
      }
    }

    fetchScreenSchedules()
  }, [paramsData.id])

  // Fetch current day's bookings for occupied/vacant calculation
  useEffect(() => {
    const fetchCurrentDayBookings = async () => {
      if (!paramsData.id || paramsData.id === "new") return

      setCurrentDayBookingsLoading(true)
      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

        // Query bookings where start_date <= today <= end_date and status is active
        const bookingsQuery = query(
          collection(db, "booking"),
          where("seller_id", "==", userData?.uid),
          where("for_censorship", "==", 2),
          where("product_id", "==", productId),
          where("status", "in", ["RESERVED", "COMPLETED"])
        )

        const querySnapshot = await getDocs(bookingsQuery)
        const currentDayBookingsData: Booking[] = []

        querySnapshot.forEach((doc) => {
          const booking = { id: doc.id, ...doc.data() } as Booking

          // Check if booking covers today
          if (booking.start_date && booking.end_date) {
            const startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date)
            const endDate = booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date)

            if (startDate <= endOfDay && endDate >= startOfDay) {
              currentDayBookingsData.push(booking)
            }
          }
        })

        setCurrentDayBookings(currentDayBookingsData)

      } catch (error) {
        console.error("Error fetching current day bookings:", error)
      } finally {
        setCurrentDayBookingsLoading(false)
      }
    }

    fetchCurrentDayBookings()
  }, [paramsData.id])

  // Fetch booking requests (pending bookings) for this product
  useEffect(() => {
    const fetchBookingRequests = async () => {
      if (!paramsData.id || paramsData.id === "new") return

      setBookingRequestsLoading(true)
      try {
        const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
        console.log('🔍 DEBUG fetchBookingRequests: userData?.uid:', userData?.uid, 'productId:', productId)
        const bookingRequestsQuery = query(
          collection(db, "booking"),
          where("seller_id", "==", userData?.uid),
          where("for_censorship", "==", 1), // Pending requests
          where("product_id", "==", productId),
          orderBy("created", "desc")
        )
        console.log('🔍 DEBUG fetchBookingRequests: Executing query with filters - seller_id:', userData?.uid, 'for_censorship: 1, product_id:', productId)
        const bookingRequestsSnapshot = await getDocs(bookingRequestsQuery)
        console.log('🔍 DEBUG fetchBookingRequests: Query returned', bookingRequestsSnapshot.size, 'documents')
        const allBookingRequests: Booking[] = []

        bookingRequestsSnapshot.forEach((doc) => {
          const bookingData = doc.data() as any
          console.log('🔍 DEBUG fetchBookingRequests: Booking id:', doc.id, 'reservation_id:', bookingData.reservation_id, 'seller_id:', bookingData.seller_id, 'for_censorship:', bookingData.for_censorship, 'product_id:', bookingData.product_id)
          allBookingRequests.push({
            id: doc.id,
            ...bookingData,
          } as Booking)
        })

        console.log('🔍 DEBUG fetchBookingRequests: Total allBookingRequests after processing:', allBookingRequests.length)
        setBookingRequests(allBookingRequests)
      } catch (error) {
        console.error("Error fetching booking requests:", error)
      } finally {
        setBookingRequestsLoading(false)
      }
    }

    fetchBookingRequests()
  }, [paramsData.id])

  // Fetch latest reports for current day bookings
  useEffect(() => {
    const fetchReportsForBookings = async () => {
      if (!currentDayBookings || currentDayBookings.length === 0) {
        console.log("No current day bookings, setting empty reportsData")
        setReportsData({})
        return
      }

      try {
        const bookingIds = currentDayBookings.map(booking => booking.id)
        console.log("Fetching reports for booking IDs:", bookingIds)
        const reportsMap = await getLatestReportsByBookingIds(bookingIds)
        console.log("Fetched reports map:", reportsMap)
        setReportsData(reportsMap)
      } catch (error) {
        console.error("Error fetching reports for bookings:", error)
        setReportsData({})
      }
    }

    fetchReportsForBookings()
  }, [currentDayBookings])
  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!product?.company_id) {
        setCompanyName("")
        return
      }
      setCompanyLoading(true)
      try {
        const companyDoc = await getDoc(doc(db, "companies", product.company_id))
        if (companyDoc.exists()) {
          const companyData = companyDoc.data()
          setCompanyName(companyData?.name || "Not Set Company")
        } else {
          setCompanyName("Not Set Company")
        }
      } catch (error) {
        console.error("Error fetching company:", error)
        setCompanyName("Not Set Company")
      } finally {
        setCompanyLoading(false)
      }
    }
    fetchCompanyName()
  }, [product?.company_id])

  const handleBack = () => {
    router.back()
  }

  const handleDelete = async () => {
    if (!product) return

    try {
      // Mock function - replace with actual implementation
      showNotification("success", `${product.name} has been successfully deleted.`)
      // Update the product in the UI to show it as deleted
      setProduct({
        ...product,
        deleted: true,
        date_deleted: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      showNotification("error", "Failed to delete the product. Please try again.")
    }
  }

  const handleEdit = () => {
    if (product) {
      router.push(`/sales/products/edit/${product.id}`)
    }
  }

  const handleShare = () => {
    const shareUrl = `https://oohshop.online/product-details/${product.id}`
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        showNotification("success", "Product link copied to clipboard and ready to share!")
      })
      .catch(() => {
        showNotification("error", "Failed to copy link. Please try again.")
      })
  }

  function renderBookingStatusBadge(status) {
    switch (status?.toUpperCase()) {
      case "CONFIRMED":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            CONFIRMED
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock3 className="mr-1 h-3 w-3" />
            PENDING
          </Badge>
        )
      case "CANCELLED":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="mr-1 h-3 w-3" />
            CANCELLED
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {status || "UNKNOWN"}
          </Badge>
        )
    }
  }

  function renderPaymentStatusBadge(status) {
    switch (status?.toUpperCase()) {
      case "PAID":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            PAID
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock3 className="mr-1 h-3 w-3" />
            PENDING
          </Badge>
        )
      case "OVERDUE":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="mr-1 h-3 w-3" />
            OVERDUE
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {status || "UNKNOWN"}
          </Badge>
        )
    }
  }

  function renderStatusBadge(status: string, deleted = false) {
    if (deleted) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200" aria-label="Product deleted">
          DELETED
        </Badge>
      )
    }

    const statusConfig = {
      ACTIVE: { color: "bg-green-50 text-green-700 border-green-200", label: "ACTIVE" },
      PENDING: { color: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "PENDING" },
      DEFAULT: { color: "bg-gray-50 text-gray-700 border-gray-200", label: status || "UNKNOWN" },
    }

    const config = statusConfig[status?.toUpperCase() as keyof typeof statusConfig] || statusConfig.DEFAULT

    return (
      <Badge variant="outline" className={config.color} aria-label={`Status: ${config.label}`}>
        {config.label}
      </Badge>
    )
  }

  // Function to get site code from product
  const getSiteCode = (product) => {
    if (!product) return null

    // Try different possible locations for site_code
    if (product.site_code) return product.site_code
    if (product.specs_rental && "site_code" in product.specs_rental) return product.specs_rental.site_code
    if (product.light && "site_code" in product.light) return product.light.site_code

    // Check for camelCase variant
    if ("siteCode" in product) return product.siteCode

    return null
  }

  // Function to get current content from product
  const getCurrentContent = (product) => {
    if (!product) return null

    // Try different possible locations for current content
    if (product.current_content) return product.current_content
    if (product.current_campaign) return product.current_campaign

    return null
  }

  const getCostEstimateStatusConfig = (status: CostEstimate["status"]) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Draft",
        }
      case "sent":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Mail className="h-3.5 w-3.5" />,
          label: "Sent",
        }
      case "viewed":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Eye className="h-3.5 w-3.5" />,
          label: "Viewed",
        }
      case "approved":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Approved",
        }
      case "rejected":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: "Rejected",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock3 className="h-3.5 w-3.5" />,
          label: "Not Set",
        }
    }
  }

  const getQuotationStatusConfig = (status: Quotation["status"]) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Draft",
        }
      case "sent":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Mail className="h-3.5 w-3.5" />,
          label: "Sent",
        }
      case "viewed":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Eye className="h-3.5 w-3.5" />,
          label: "Viewed",
        }
      case "accepted":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Accepted",
        }
      case "rejected":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: "Rejected",
        }
      case "expired":
        return {
          color: "bg-orange-100 text-orange-800 border-orange-200",
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: "Expired",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock3 className="h-3.5 w-3.5" />,
          label: "Not Set",
        }
    }
  }

  const getJobOrderStatusConfig = (status: JobOrder["status"]) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Draft",
        }
      case "pending":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Clock3 className="h-3.5 w-3.5" />,
          label: "Pending",
        }
      case "approved":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Approved",
        }
      case "completed":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Completed",
        }
      case "cancelled":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: "Cancelled",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock3 className="h-3.5 w-3.5" />,
          label: "Not Set",
        }
    }
  }

  const getJobOrderPriorityConfig = (priority: JobOrder["priority"]) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          label: "High",
        }
      case "medium":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          label: "Medium",
        }
      case "low":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          label: "Low",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          label: "Normal",
        }
    }
  }

  const getTabCount = (tab: string) => {
    switch (tab) {
      case "booking-summary":
        return bookingsTotal
      case "ce":
        return costEstimatesTotal
      case "quote":
        return quotationsTotal
      case "job-order":
        return jobOrdersTotal
      case "reports":
        return reportsTotal
      default:
        return 0
    }
  }

  const fetchBookedDates = async () => {
    if (!paramsData.id) return

    setCalendarLoading(true)
    try {
      const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
      const bookingsRef = collection(db, "booking")
      const q = query(bookingsRef, where("product_id", "==", productId))
      const querySnapshot = await getDocs(q)

      const dates: Date[] = []
      querySnapshot.forEach((doc) => {
        const booking = doc.data()
        if (booking.start_date && booking.end_date) {
          const startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date)
          const endDate = booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date)

          // Add all dates between start and end
          const currentDate = new Date(startDate)
          while (currentDate <= endDate) {
            dates.push(new Date(currentDate))
            currentDate.setDate(currentDate.getDate() + 1)
          }
        }
      })

      setBookedDates(dates)
    } catch (error) {
      console.error("Error fetching booked dates:", error)
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleCalendarOpen = () => {
    setCalendarDialogOpen(true)
    fetchBookedDates()
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" className="mr-2" disabled>
            <ArrowLeft className="h-4 w-4 mr-1" />
            <Skeleton className="h-4 w-16" />
          </Button>
          <Skeleton className="h-6 w-48" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="rounded-xl">
              <CardContent className="p-0">
                <Skeleton className="h-[250px] w-full rounded-t-xl" />
                <div className="p-4 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="space-y-2">
                    {Array(6)
                      .fill(0)
                      .map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Skeleton className="h-10 w-full mb-4" />
            <Card className="rounded-xl">
              <CardContent className="p-8">
                <Skeleton className="h-[200px] w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Get site code
  const siteCode = getSiteCode(product)

  // Get current content if available
  const currentContent = getCurrentContent(product)

  return (
    <div className="mx-auto px-4 pt-2 pb-6">
      {/* Notification */}
      <CustomNotification
        show={notification.show}
        type={notification.type}
        message={notification.message}
        onClose={hideNotification}
      />

      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sales/dashboard")} className="mr-2">
            <ArrowLeft className="h-5 w-5 mr-1" />
          </Button>
          <h1 className="text-xl font-semibold">Site Information</h1>
        </div>
      </header>

      {product?.deleted && (
        <Alert variant="destructive" className="mb-6 border border-red-200 rounded-xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Deleted Product</AlertTitle>
          <AlertDescription>
            This product has been marked as deleted on {formatDate(product.date_deleted)}. It is no longer visible in
            product listings.
          </AlertDescription>
        </Alert>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SiteInformation
          product={product}
          activeImageIndex={activeImageIndex}
          setActiveImageIndex={setActiveImageIndex}
          setImageViewerOpen={setImageViewerOpen}
          handleCalendarOpen={handleCalendarOpen}
          companyLoading={companyLoading}
          companyName={companyName}
        />

                {/* Right Content - Tabbed Interface */}
        <section className="lg:col-span-2">
          {/* Spots Section - Only show for digital sites */}
          {product && product.content_type?.toLowerCase() === "digital" && product.cms && (
            <div className="mb-6">
              <SpotsGrid
                spots={generateSpotsData(product.cms, currentDayBookings, reportsData)}
                totalSpots={product.cms.loops_per_day || 18}
                occupiedCount={calculateOccupiedSpots(product.cms)}
                vacantCount={calculateVacantSpots(product.cms)}
                productId={paramsData.id}
                currentDate={currentDate}
                router={router}
                bookingRequests={bookingRequests}
                onBookingAccepted={() => {
                  // Refresh booking requests
                  const fetchBookingRequests = async () => {
                    setBookingRequestsLoading(true)
                    try {
                      const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id
                      const bookingRequestsQuery = query(
                        collection(db, "booking"),
                        where("seller_id", "==", userData?.uid),
                        where("for_censorship", "==", 1),
                        where("product_id", "==", productId),
                        orderBy("created", "desc")
                      )
                      const bookingRequestsSnapshot = await getDocs(bookingRequestsQuery)
                      const allBookingRequests: Booking[] = []

                      bookingRequestsSnapshot.forEach((doc) => {
                        const bookingData = doc.data() as any
                        allBookingRequests.push({
                          id: doc.id,
                          ...bookingData,
                        } as Booking)
                      })

                      setBookingRequests(allBookingRequests)
                    } catch (error) {
                      console.error("Error fetching booking requests:", error)
                    } finally {
                      setBookingRequestsLoading(false)
                    }
                  }

                  fetchBookingRequests()
                }}
              />
            </div>
          )}
            
            

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div>
                <TabsList className="flex flex-wrap justify-start bg-transparent border-none p-0 gap-0">
                <TabsTrigger value="booking-summary" className="bg-white border-2 border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Booking Summary</TabsTrigger>
                <TabsTrigger value="ce" className="bg-white border-2 border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Cost Estimates</TabsTrigger>
                <TabsTrigger value="quote" className="bg-white border-2 border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Quotations</TabsTrigger>
                <TabsTrigger value="job-order" className="bg-white border-2 border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Job Orders</TabsTrigger>
                <TabsTrigger value="reports" className="bg-white border-2 border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Reports</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent key={productId} value="booking-summary" className="mt-0">
              {(() => { console.log('Current bookings state in render:', bookings); return null; })()}
              <Card className="rounded-xl shadow-sm border-none px-4">
                <CardContent className="pb-4 overflow-x-auto">
                  {bookingsLoading ? (
                    <div className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">Loading bookings...</p>
                    </div>
                  ) : bookings.length > 0 ? (
                    <>
                      <div className="space-y-4 p-4">
                        {bookings.map((booking) => (
                          <Card key={booking.id} className="cursor-pointer" onClick={() => { setSelectedBooking(booking); setBookingDialogOpen(true); }}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center">
                                <div className="font-medium text-gray-900">BK#{booking.reservation_id || booking.id.slice(-8)}</div>
                                <div className="text-gray-600">{formatBookingDates(booking.start_date, booking.end_date)}</div>
                                <div className="font-semibold text-gray-900">P{booking.total_cost}</div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                  
                      {bookingsTotal > itemsPerPage && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                          <div className="text-sm text-gray-700">
                            Showing {((bookingsPage - 1) * itemsPerPage) + 1} to {Math.min(bookingsPage * itemsPerPage, bookingsTotal)} of {bookingsTotal} bookings
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
                              Page {bookingsPage} of {Math.ceil(bookingsTotal / itemsPerPage)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBookingsPage(prev => Math.min(Math.ceil(bookingsTotal / itemsPerPage), prev + 1))}
                              disabled={bookingsPage === Math.ceil(bookingsTotal / itemsPerPage)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}

                
               
                </CardContent>
                </Card>
            </TabsContent>
            {/* CE Tab */}
            <TabsContent value="ce" className="mt-0">
              <Card className="rounded-xl shadow-sm border-none px-4">
                <CardContent className="pb-4 overflow-x-auto">
                  {costEstimatesLoading ? (
                    <div className="p-8">
                      <div className="space-y-4">
                        {Array(3)
                          .fill(0)
                          .map((_, i) => (
                            <div key={i} className="grid grid-cols-6 gap-4">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-16" />
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : costEstimates.length === 0 ? (
                    <div className="p-8 text-center">
                      <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-xs sm:text-sm font-medium text-gray-900 mb-1">No CE records</h3>
                      <p className="text-sm text-gray-500">No cost estimates have been created for this site yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-5 gap-4 p-4 bg-white border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-700">
                        <div className="flex items-center text-center break-all min-w-0">Date</div>
                        <div className="flex items-center text-center break-all min-w-0">Cost Estimate ID</div>
                        <div className="flex items-center text-center break-all min-w-0">Client</div>
                        <div className="flex items-center text-center break-all min-w-0">Status</div>
                        <div className="flex items-center text-center break-all min-w-0">Price</div>
                      </div>
                      <div className="space-y-2 pb-4 overflow-x-auto">
                        {costEstimates.map((estimate, index) => (
                          <div
                            key={estimate.id}
                            className={`grid grid-cols-5 gap-4 p-4 text-xs sm:text-sm bg-[#F6F9FF] border-2 border-[#B8D9FF] rounded-[10px] hover:bg-gray-50 cursor-pointer transition-colors ${index === 0 ? 'mt-4' : ''}`}
                            onClick={() => router.push(`/sales/cost-estimates/${estimate.id}`)}
                          >
                            <div className="flex items-center text-center break-all min-w-0 text-gray-600">{formatDate(estimate.createdAt)}</div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900 font-medium break-all">
                              {estimate.costEstimateNumber || estimate.id.slice(-8)}
                            </div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                              {estimate.client?.company || estimate.client?.name || "Not Set Client"}
                            </div>
                            <div className="flex items-center text-center break-all min-w-0">
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                {estimate.status || "Draft"}
                              </Badge>
                            </div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                              ₱{estimate.totalAmount?.toLocaleString() || "0"}/month
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {costEstimatesTotal > itemsPerPage && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                          <div className="text-sm text-gray-700">
                            Showing {((costEstimatesPage - 1) * itemsPerPage) + 1} to {Math.min(costEstimatesPage * itemsPerPage, costEstimatesTotal)} of {costEstimatesTotal} cost estimates
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCostEstimatesPage(prev => Math.max(1, prev - 1))}
                              disabled={costEstimatesPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-gray-600">
                              Page {costEstimatesPage} of {Math.ceil(costEstimatesTotal / itemsPerPage)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCostEstimatesPage(prev => Math.min(Math.ceil(costEstimatesTotal / itemsPerPage), prev + 1))}
                              disabled={costEstimatesPage === Math.ceil(costEstimatesTotal / itemsPerPage)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                
              
              </CardContent>
              </Card>
            </TabsContent>
            {/* Quote Tab */}
            <TabsContent value="quote" className="space-y-4">
              <div className="bg-white rounded-lg pb-4 px-4 overflow-x-auto">
                {quotationsLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading quotations...</p>
                  </div>
                ) : quotations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No quotations found for this product.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-5 gap-4 p-4 bg-white border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-700">
                      <div className="flex items-center text-center break-all min-w-0">Date</div>
                      <div className="flex items-center text-center break-all min-w-0">Quotation ID</div>
                      <div className="flex items-center text-center break-all min-w-0">Client</div>
                      <div className="flex items-center text-center break-all min-w-0">Status</div>
                      <div className="flex items-center text-center break-all min-w-0">Price</div>
                    </div>
                    <div className="space-y-2 pb-4 overflow-x-auto">
                      {quotations.map((quotation, index) => {
                        const statusConfig = getQuotationStatusConfig(quotation.status)
                        return (
                          <div
                            key={quotation.id}
                            className={`grid grid-cols-5 gap-4 p-4  text-xs sm:text-sm bg-[#F6F9FF] border-2 border-[#B8D9FF] rounded-[10px] hover:bg-gray-50 cursor-pointer transition-colors ${index === 0 ? 'mt-4' : ''}`}
                            onClick={() => router.push(`/sales/quotations/${quotation.id}`)}
                          >
                            <div className="flex items-center text-center break-all min-w-0 text-gray-600">{quotation.created ? formatFirebaseDate(quotation.created) : "N/A"}</div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                              {quotation.quotation_number || quotation.id?.slice(-8) || "N/A"}
                            </div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                              {quotation.client_name || "Not Set Client"}
                            </div>
                            <div className="flex items-center text-center break-all min-w-0">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}
                              >
                                {statusConfig.icon}
                                {statusConfig.label}
                              </span>
                            </div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">₱{quotation.total_amount?.toLocaleString() || "0"}/month</div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Pagination */}
                    {quotationsTotal > itemsPerPage && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                          Showing {((quotationsPage - 1) * itemsPerPage) + 1} to {Math.min(quotationsPage * itemsPerPage, quotationsTotal)} of {quotationsTotal} quotations
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuotationsPage(prev => Math.max(1, prev - 1))}
                            disabled={quotationsPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {quotationsPage} of {Math.ceil(quotationsTotal / itemsPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuotationsPage(prev => Math.min(Math.ceil(quotationsTotal / itemsPerPage), prev + 1))}
                            disabled={quotationsPage === Math.ceil(quotationsTotal / itemsPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Job Order Tab */}
            <TabsContent value="job-order" className="space-y-4">
              <div className="bg-white rounded-lg pb-4 px-4 overflow-x-auto">
                {jobOrdersLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading job orders...</p>
                  </div>
                ) : jobOrders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No job orders found for this product.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-4 p-4 bg-white border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-700">
                      <div className="flex items-center text-center break-all min-w-0">Date</div>
                      <div className="flex items-center text-center break-all min-w-0">Job Order ID</div>
                      <div className="flex items-center text-center break-all min-w-0">Client</div>
                      <div className="flex items-center text-center break-all min-w-0">Status</div>
                    </div>
                    <div className="space-y-2 pb-4 overflow-x-auto">
                      {jobOrders.map((jobOrder, index) => {
                        const statusConfig = getJobOrderStatusConfig(jobOrder.status)

                        return (
                          <div
                            key={jobOrder.id}
                            className={`grid grid-cols-4 gap-4 p-4 text-xs sm:text-sm bg-[#F6F9FF] border-2 border-[#B8D9FF] rounded-[10px] hover:bg-gray-50 cursor-pointer transition-colors ${index === 0 ? 'mt-4' : ''}`}
                            onClick={() => router.push(`/sales/job-orders/${jobOrder.id}`)}
                          >
                            <div className="flex items-center text-center break-all min-w-0 text-gray-600">{jobOrder.created ? formatFirebaseDate(jobOrder.created) : "N/A"}</div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                              {jobOrder.joNumber || jobOrder.id.slice(-8)}
                            </div>
                            <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                              {jobOrder.clientName || "Not Set Client"}
                            </div>
                            <div className="flex items-center text-center break-all min-w-0">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}
                              >
                                {statusConfig.icon}
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Pagination */}
                    {jobOrdersTotal > itemsPerPage && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                          Showing {((jobOrdersPage - 1) * itemsPerPage) + 1} to {Math.min(jobOrdersPage * itemsPerPage, jobOrdersTotal)} of {jobOrdersTotal} job orders
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setJobOrdersPage(prev => Math.max(1, prev - 1))}
                            disabled={jobOrdersPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {jobOrdersPage} of {Math.ceil(jobOrdersTotal / itemsPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setJobOrdersPage(prev => Math.min(Math.ceil(jobOrdersTotal / itemsPerPage), prev + 1))}
                            disabled={jobOrdersPage === Math.ceil(jobOrdersTotal / itemsPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-4">
              <div className="bg-white rounded-lg pb-4 px-4 overflow-x-auto">
                {reportsLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading reports...</p>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No reports found for this product.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-5 gap-4 p-4 bg-white border-b border-gray-200 text-xs sm:text-sm font-medium text-gray-700">
                      <div className="flex items-center text-center break-all min-w-0">Date</div>
                      <div className="flex items-center text-center break-all min-w-0">Report ID</div>
                      <div className="flex items-center text-center break-all min-w-0">Type</div>
                      <div className="flex items-center text-center break-all min-w-0">Client</div>
                      <div className="flex items-center text-center break-all min-w-0">Status</div>
                    </div>
                    <div className="space-y-2 pb-4 overflow-x-auto">
                      {reports.map((report, index) => (
                        <div
                          key={report.id}
                          className={`grid grid-cols-5 gap-4 p-4 text-xs sm:text-sm bg-[#F6F9FF] border-2 border-[#B8D9FF] rounded-[10px] hover:bg-gray-50 cursor-pointer transition-colors ${index === 0 ? 'mt-4' : ''}`}
                          onClick={() => router.push(`/sales/reports/${report.id}`)}
                        >
                          <div className="flex items-center text-center break-all min-w-0 text-gray-600">{report.created ? formatFirebaseDate(report.created) : "N/A"}</div>
                          <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                            {report.report_id || report.id?.slice(-8) || "N/A"}
                          </div>
                          <div className="flex items-center text-center break-all min-w-0 text-gray-600">{report.reportType || "Not Set"}</div>
                          <div className="flex items-center text-center break-all min-w-0 text-gray-900">
                            {report.client || "Not Set Client"}
                          </div>
                          <div className="flex items-center text-center break-all min-w-0">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                              {report.status || "Draft"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {reportsTotal > itemsPerPage && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                          Showing {((reportsPage - 1) * itemsPerPage) + 1} to {Math.min(reportsPage * itemsPerPage, reportsTotal)} of {reportsTotal} reports
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReportsPage(prev => Math.max(1, prev - 1))}
                            disabled={reportsPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {reportsPage} of {Math.ceil(reportsTotal / itemsPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReportsPage(prev => Math.min(Math.ceil(reportsTotal / itemsPerPage), prev + 1))}
                            disabled={reportsPage === Math.ceil(reportsTotal / itemsPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Site Calendar Dialog */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="sm:max-w-4xl" aria-labelledby="calendar-dialog-title">
          <DialogHeader>
            <DialogTitle id="calendar-dialog-title">Site Calendar - {product?.name || "Product"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {calendarLoading ? (
              <div className="flex items-center text-center break-all min-w-0 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading calendar...</span>
              </div>
            ) : (
              <CalendarView bookedDates={bookedDates} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Gallery Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="sm:max-w-4xl" aria-labelledby="image-gallery-dialog-title">
          <DialogHeader>
            <DialogTitle id="image-gallery-dialog-title">Image Gallery</DialogTitle>
          </DialogHeader>

          <div className="relative">
            {product?.media && product.media.length > 0 ? (
              <>
                <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={product.media[activeImageIndex]?.url || "/placeholder.svg"}
                    alt={`Product image ${activeImageIndex + 1}`}
                    fill
                    className="object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = "/building-billboard.png"
                      target.className = "object-contain opacity-50"
                    }}
                  />
                </div>

                {/* Navigation buttons */}
                {product.media.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 h-10 w-10 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-md rounded-full"
                      onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : product.media.length - 1))}
                      aria-label="Previous image"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-10 w-10 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-md rounded-full"
                      onClick={() => setActiveImageIndex((prev) => (prev < product.media.length - 1 ? prev + 1 : 0))}
                      aria-label="Next image"
                    >
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </Button>
                  </>
                )}

                {/* Thumbnail strip */}
                {product.media.length > 1 && (
                  <div className="flex justify-center gap-2 mt-4 overflow-x-auto">
                    {product.media.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === activeImageIndex
                            ? "border-blue-500 ring-2 ring-blue-200"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        aria-label={`View image ${index + 1}`}
                      >
                        <Image
                          src={image.url || "/placeholder.svg"}
                          alt={`Thumbnail ${index + 1}`}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/building-billboard.png"
                            target.className = "object-cover opacity-50"
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Image counter */}
                <div className="text-center mt-2 text-sm text-gray-600">
                  {activeImageIndex + 1} of {product.media.length}
                </div>
              </>
            ) : (
              <div className="aspect-[4/3] w-full rounded-lg bg-gray-100 flex items-center text-center break-all min-w-0">
                <div className="text-center text-gray-500">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                  <p>No images available</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={marketplaceDialogOpen} onOpenChange={setMarketplaceDialogOpen}>
        <DialogContent className="sm:max-w-2xl" aria-labelledby="marketplace-dialog-title">
          <DialogHeader>
            <DialogTitle id="marketplace-dialog-title">Connect to a marketplace</DialogTitle>
            <DialogDescription>Select a DSP:</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center items-center gap-8 py-6">
            {[
              { name: "OOH!Shop", logo: "/ooh-shop-logo.png" },
              { name: "Vistar Media", logo: "/vistar-media-logo.png" },
              { name: "Broadsign", logo: "/broadsign-logo.png" },
              { name: "Moving Walls", logo: "/moving-walls-logo.png" },
            ].map((marketplace) => (
              <button
                key={marketplace.name}
                className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Connect to ${marketplace.name}`}
              >
                <div className="w-24 h-24 rounded-xl flex items-center text-center break-all min-w-0 mb-2 bg-white">
                  <Image
                    src={marketplace.logo || "/placeholder.svg"}
                    alt={`${marketplace.name} logo`}
                    width={80}
                    height={80}
                    className="object-contain rounded-lg"
                  />
                </div>
                <span className="text-xs sm:text-sm font-medium">{marketplace.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <SpotSelectionDialog
        open={isSpotSelectionDialogOpen}
        onOpenChange={setIsSpotSelectionDialogOpen}
        products={spotSelectionProducts}
        currentDate={spotSelectionCurrentDate}
        selectedDate={spotSelectionCurrentDate}
        type={spotSelectionType}
        nonDynamicSites={[]}
      />
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div>
                <label className="font-medium">Booking Code:</label>
                <p>BK#{selectedBooking.reservation_id || selectedBooking.id.slice(-8)}</p>
              </div>
              <div>
                <label className="font-medium">Dates:</label>
                <p>{formatBookingDates(selectedBooking.start_date, selectedBooking.end_date)}</p>
              </div>
              <div>
                <label className="font-medium">Price:</label>
                <p>P{selectedBooking.total_cost}</p>
              </div>
              <div>
                <label className="font-medium">Client:</label>
                <p>{selectedBooking.client?.name || 'N/A'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

