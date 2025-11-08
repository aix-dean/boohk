"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getProductById, type Product } from "@/lib/firebase-service"
import {
  ArrowLeft,
  Play,
  Loader2,
} from "lucide-react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { createDirectCostEstimate } from "@/lib/cost-estimate-service"
import { createDirectQuotation } from "@/lib/quotation-service"
import type { Booking } from "@/lib/booking-service"
import { getLatestReportsByBookingIds, type ReportData } from "@/lib/report-service"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SpotSelectionDialog } from "@/components/spot-selection-dialog"

export default function SpotDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { userData } = useAuth()
  const { toast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [spotSchedule, setSpotSchedule] = useState<any>(null)
  const [spotSchedules, setSpotSchedules] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [currentSpotIndex, setCurrentSpotIndex] = useState(0)
  const [bookedDates, setBookedDates] = useState<Date[]>([])
  const [monthOffset, setMonthOffset] = useState(0)
  const [totalBookedSpots, setTotalBookedSpots] = useState(0)
  const [calendarSpotFilter, setCalendarSpotFilter] = useState<number>(1)
  const [spotSelectionDialogOpen, setSpotSelectionDialogOpen] = useState(false)
  const [spotSelectionType, setSpotSelectionType] = useState<"quotation" | "cost-estimate">("quotation")
  const [currentDayBookings, setCurrentDayBookings] = useState<Booking[]>([])
  const [currentDayBookingsLoading, setCurrentDayBookingsLoading] = useState(false)
  const [reportsData, setReportsData] = useState<{ [bookingId: string]: ReportData | null }>({})
  const calendarRef = useRef<HTMLDivElement>(null)
  const currentMonthRef = useRef<HTMLDivElement>(null)

  const productId = params.id as string
  const spotNumber = parseInt(params.spotNumber as string)

  // Initialize carousel position based on URL spot number
  useEffect(() => {
    if (spotNumber && spotNumber > 0) {
      setCurrentSpotIndex(spotNumber - 1)
      setCalendarSpotFilter(spotNumber)
    }
  }, [spotNumber])

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return

      try {
        setLoading(true)
        const productData = await getProductById(productId)
        if (productData) {
          // Verify this product belongs to the current user's company
          if (userData?.company_id && productData.company_id !== userData.company_id) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to view this site.",
              variant: "destructive",
            })
            router.push("/sales/dashboard")
            return
          }
          setProduct(productData)
        } else {
          toast({
            title: "Error",
            description: "Site not found.",
            variant: "destructive",
          })
          router.push("/sales/dashboard")
        }
      } catch (error) {
        console.error("Error fetching product:", error)
        toast({
          title: "Error",
          description: "Failed to load site details. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [productId, userData?.company_id, toast, router])

  // Fetch spot schedules
  useEffect(() => {
    const fetchSpotSchedules = async () => {
      if (!productId) return

      try {
        const q = query(
          collection(db, "screen_schedule"),
          where("product_id", "==", productId),
          where("spot_number", "==", spotNumber),
          where("deleted", "==", false),
        )
        const querySnapshot = await getDocs(q)
        const schedules = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setSpotSchedules(schedules)
        // Find the active/current schedule
        const activeSchedule = schedules.find((s: any) => s.active === true)
        setSpotSchedule(activeSchedule || null)
      } catch (error) {
        console.error("Error fetching spot schedules:", error)
      }
    }

    fetchSpotSchedules()
  }, [productId, spotNumber])
  // Debug: Check all bookings for this product
  useEffect(() => {
    const debugBookings = async () => {
      if (!productId) return
      try {
        const allBookingsQuery = query(
          collection(db, "booking"),
          where("product_id", "==", productId),
        )
        const allBookingsSnapshot = await getDocs(allBookingsQuery)
        console.log(`[DEBUG] Total bookings for product ${productId}: ${allBookingsSnapshot.size}`)

        allBookingsSnapshot.forEach((doc) => {
          const booking = doc.data() as Booking
          console.log(`[DEBUG] Booking ${booking.id} has spot_numbers:`, booking.spot_numbers, 'start_date:', booking.start_date, 'end_date:', booking.end_date)
        })
      } catch (error) {
        console.error("Error debugging bookings:", error)
      }
    }

    debugBookings()
  }, [productId])

  // Fetch bookings for this product and selected calendar spot
  // Fetch bookings for this product and selected calendar spot
  useEffect(() => {
    const fetchBookings = async () => {
      if (!productId) return
      console.log(`[DEBUG] Fetching bookings for productId: ${productId}, spotNumber: ${calendarSpotFilter}`);

      try {
        const bookingsQuery = query(
          collection(db, "booking"),
          where("product_id", "==", productId),
          where("spot_numbers", "array-contains", calendarSpotFilter),
        )
        const bookingsSnapshot = await getDocs(bookingsQuery)
        console.log(`[DEBUG] Found ${bookingsSnapshot.size} bookings`);

        const dates: Date[] = []
        bookingsSnapshot.forEach((doc) => {
          const booking = doc.data() as Booking
          console.log(`[DEBUG] Processing booking:`, booking.id, booking.start_date, booking.end_date);
          if (booking.start_date && booking.end_date) {
            const startDate = booking.start_date.toDate()
            const endDate = booking.end_date.toDate()

            // Add all dates between start and end
            const currentDate = new Date(startDate)
            while (currentDate <= endDate) {
              dates.push(new Date(currentDate))
              currentDate.setDate(currentDate.getDate() + 1)
            }
          }
        })

        console.log(`[DEBUG] Set booked dates:`, dates);
        setBookedDates(dates)
      } catch (error) {
        console.error("Error fetching booked dates:", error)
      }
    }

    fetchBookings()
  }, [productId, calendarSpotFilter])

  // Update calendar spot filter when carousel changes
  useEffect(() => {
    setCalendarSpotFilter(currentSpotIndex + 1)
  }, [currentSpotIndex])

  // Fetch total booked spots for selected date

  useEffect(() => {    const fetchTotalBookedSpots = async () => {
      if (!productId || !selectedDate) {
        setTotalBookedSpots(0)
        return
      }

      try {
        const selectedDateObj = new Date(selectedDate)
        const bookingsQuery = query(
          collection(db, "booking"),
          where("product_id", "==", productId),
        )
        const bookingsSnapshot = await getDocs(bookingsQuery)

        let totalSpots = 0
        bookingsSnapshot.forEach((doc) => {
          const booking = doc.data() as Booking
          if (booking.start_date && booking.end_date && booking.spot_numbers) {
            const startDate = booking.start_date.toDate()
            const endDate = booking.end_date.toDate()

            // Check if selected date falls within booking period
            if (selectedDateObj >= startDate && selectedDateObj <= endDate) {
              totalSpots += booking.spot_numbers.length
            }
          }
        })

        setTotalBookedSpots(totalSpots)
      } catch (error) {
        console.error("Error fetching total booked spots:", error)
        setTotalBookedSpots(0)
      }
    }

    fetchTotalBookedSpots()
  }, [productId, selectedDate])

// Fetch current day's bookings for occupied/vacant calculation
useEffect(() => {
  const fetchCurrentDayBookings = async () => {
    if (!productId) return

    setCurrentDayBookingsLoading(true)
    try {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

      // Query bookings where start_date <= today <= end_date and status is active
      const bookingsQuery = query(
        collection(db, "booking"),
        where("product_id", "==", productId),
        where("status", "in", ["RESERVED", "COMPLETED"])
      )

      const querySnapshot = await getDocs(bookingsQuery)
      const currentDayBookingsData: Booking[] = []

      querySnapshot.forEach((doc) => {
        const booking = { id: doc.id, ...doc.data() } as Booking

        // Check if booking covers today
        if (booking.start_date && booking.end_date) {
          const startDate = booking.start_date.toDate()
          const endDate = booking.end_date.toDate()

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
}, [productId])

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


  const handleBack = () => {
    router.push(`/sales/products/${productId}`)
  }

  const formatDate = (dateString: any): string => {
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-amber-100 text-amber-800"
      case "available":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalSpots = product?.cms?.loops_per_day || 18

  const nextSpot = () => {
    setCurrentSpotIndex((prev) => (prev + 1) % totalSpots)
  }

  const prevSpot = () => {
    setCurrentSpotIndex((prev) => (prev - 1 + totalSpots) % totalSpots)
  }
  const isDateBooked = (date: Date) => {
    return bookedDates.some(bookedDate =>
      bookedDate.getDate() === date.getDate() &&
      bookedDate.getMonth() === date.getMonth() &&
      bookedDate.getFullYear() === date.getFullYear()
    )
  }


  const renderCalendar = (monthIndex: number, year: number) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const startDay = new Date(year, monthIndex, 1).getDay()

    return (
        <div className="text-left ml-2">
            <h3 className="font-bold mb-2 text-center">
                {new Date(year, monthIndex).toLocaleString("default", { month: "long" })} {year}
            </h3>
            <div className="grid grid-cols-7 gap-1 text-xs">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="font-semibold text-gray-600 p-1">
                        {d}
                    </div>
                ))}
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`e-${i}`} className="p-1" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const date = new Date(year, monthIndex, day)
                    const booked = isDateBooked(date)

                    
                    const isSelected = selectedDate && date.toDateString() === new Date(selectedDate).toDateString()

                    return (
                        <div
                            key={day}
                            onClick={() => {
                                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                                setSelectedDate(selectedDate === dateStr ? "" : dateStr) // Toggle selection
                            }}
                            className={`p-1 rounded text-center relative cursor-pointer ${
                                isSelected
                                    ? "bg-blue-500 text-white font-bold ring-2 ring-blue-300"
                                    : booked
                                        ? "bg-[#C0C5FF] text-black"
                                        : "bg-white text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                            {day}
                            {isSelected && (
                                <div className="absolute -top-1 -right-0 w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }

  // Generate 12 months starting from 6 months ago for vertical scrolling
  const baseDate = new Date()
  const monthsToShow = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i - 6, 1)
    return { month: monthDate.getMonth(), year: monthDate.getFullYear() }
  })

  // Scroll to current month after calendar loads
  useEffect(() => {
    if (!loading && currentMonthRef.current) {
      currentMonthRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'start'
      })
    }
  }, [loading])

  // Navigation controls - disabled for single date selection
  const canGoLeft = false
  const canGoRight = false


  const calculateOccupiedSpots = () => {
    // Count unique spot numbers from current day's bookings
    const occupiedSpots = new Set()
    // For simplicity, we'll use the spot schedules to determine occupied spots
    spotSchedules.forEach(schedule => {
      if (schedule.active) {
        occupiedSpots.add(schedule.spot_number)
      }
    })
    return occupiedSpots.size
  }

  const calculateVacantSpots = () => {
    return totalSpots - calculateOccupiedSpots()
  }

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex-1 p-4">
        <div className="flex flex-col items-center justify-center py-12 text-left ml-2">
          <h3 className="mb-2 text-lg font-semibold">Site not found</h3>
          <p className="text-muted-foreground mb-4">The requested site could not be found.</p>
          <Button onClick={handleBack}>Back to Site</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          View Spot
        </Button>
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">Create:</p>
          <Button
            variant="outline"
            onClick={() => {
              setSpotSelectionType("cost-estimate")
              setSpotSelectionDialogOpen(true)
            }}
          >
            Cost Estimate
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSpotSelectionType("quotation")
              setSpotSelectionDialogOpen(true)
            }}
          >
            Quotation
          </Button>
        </div>
      </div>

      {/* Scroll Spots and Calendar side by side */}
      <div className="flex gap-6 mb-6">
        {/* Scroll Spots */}
        <div className="w-[12vw] flex flex-col">
          <div className="text-left ml-2 mb-4">
            <p className="text-[#333] font-inter text-base font-bold leading-none mb-1">Spot</p>
            <p className="text-[#333] font-inter text-xs font-normal leading-none">Click arrows to view other spots</p>
          </div>
          <div className="relative flex items-center justify-center flex-1">
            {/* Left arrow */}
            <button
              onClick={prevSpot}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-md hover:bg-gray-50 z-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* Single spot display */}
            <div className="flex justify-center items-center flex-1">
              {(() => {
                const i = currentSpotIndex
                const startTime = product.cms?.start_time || "06:00"
                const spotDuration = product.cms?.spot_duration || 15
                const [startHours, startMinutes] = startTime.split(":").map(Number)
                const startTotalMinutes = startHours * 60 + startMinutes

                const spotStartMinutes = startTotalMinutes + (i * spotDuration / 60)
                const startHour = Math.floor(spotStartMinutes / 60) % 24
                const startMin = Math.floor(spotStartMinutes % 60)
                const startTimeStr = `${startHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`

                const currentSpotNumber = i + 1
                const isOccupied = currentDayBookings.some(booking =>
                  booking.spot_numbers?.includes(currentSpotNumber)
                )
                const booking = currentDayBookings.find(b => b.spot_numbers?.includes(currentSpotNumber))
                const isCurrentSpot = i + 1 === spotNumber
                const hasContent = spotSchedule && spotSchedule.spot_number === spotNumber
                // Get image URL from report attachments
                let imageUrl: string | undefined
                if (booking && reportsData[booking.id]) {
                  const report = reportsData[booking.id]
                  console.log(`Spot ${currentSpotNumber}: Found report for booking ${booking.id}:`, report)
                  if (report && report.attachments && report.attachments.length > 0) {
                    // Find attachment with label "After" (case insensitive)
                    const afterAttachment = report.attachments.find(att => att.label?.toLowerCase() === "after")
                    console.log(`Spot ${currentSpotNumber}: After attachment:`, afterAttachment)
                    if (afterAttachment) {
                      imageUrl = afterAttachment.fileUrl
                    } else {
                      // Use first attachment if no "After" label
                      imageUrl = report.attachments[0].fileUrl
                      console.log(`Spot ${currentSpotNumber}: Using first attachment:`, imageUrl)
                    }
                  } else {
                    console.log(`Spot ${currentSpotNumber}: No attachments in report`)
                  }
                } else {
                  console.log(`Spot ${currentSpotNumber}: No booking or report found for booking ${booking?.id}`)
                }
                console.log(`Spot ${currentSpotNumber}: Final imageUrl:`, imageUrl)

                return (
                  <div
                    className="flex-shrink-0 w-[160px] min-h-[280px] bg-white rounded-[13px] shadow-[-1px_3px_7px_-1px_rgba(0,0,0,0.25)] border border-gray-200 overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    {/* Image Section */}
                    <div className="h-[200px] relative mx-2 mt-2 rounded-[13px] overflow-hidden">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={`Spot ${i + 1}`}
                          fill
                          className="object-cover"
                        />
                      ) : spotSchedule?.media ? (
                        <Image
                          src={spotSchedule.media}
                          alt={`Spot ${i + 1}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No image</span>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="flex flex-col p-[13px] flex-1">
                      {/* Spot Number */}
                      <div className="text-[11px] font-semibold text-black">
                        {i + 1}/{totalSpots}
                      </div>

                      {/* Status */}
                      <div className={`text-[11px] font-semibold ${
                        isOccupied ? "text-[#00d0ff]" : "text-[#a1a1a1]"
                      }`}>
                        {isOccupied ? "Occupied" : "Vacant"}
                      </div>

                      {/* Client Name */}
                      <div className={`text-[11px] font-semibold ${
                        isOccupied ? "text-black" : "text-[#a1a1a1]"
                      }`}>
                        {isOccupied ? (booking?.client?.name || spotSchedule?.title || "Content") : "Filler Content 1"}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Right arrow */}
            <button
              onClick={nextSpot}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-md hover:bg-gray-50 z-10"
            >
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>

        {/* Calendar Column */}
        <div className="flex-1">
          <div className="mb-4">
            <div className="mb-4">
              <div>
                <p className="text-[#333] font-inter text-base font-bold leading-none mb-1">Select Date</p>
                <p className="text-[#333] font-inter text-xs font-normal leading-none">Select a date to view more data</p>
              </div>
            </div>
          </div>
          <div className="bg-[#ECECEC] rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="flex-1"></div>
          </div>
          <div ref={calendarRef} className="max-h-[250px] overflow-y-auto">
            {Array.from({ length: Math.ceil(monthsToShow.length / 3) }, (_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {monthsToShow.slice(rowIndex * 3, (rowIndex + 1) * 3).map(({ month, year }) => {
                  const isCurrentMonth = month === baseDate.getMonth() && year === baseDate.getFullYear()
                  return (
                    <div key={`${year}-${month}`} ref={isCurrentMonth ? currentMonthRef : undefined}>
                      {renderCalendar(month, year)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Micro Spots */}
      <div className="bg-white rounded-lg shadow-sm border p-4 pb-2.5">
        <p className="font-bold text-lg mb-4">
          Micro Spots <span className="font-light">({selectedDate ? new Date(selectedDate).toLocaleDateString() : 'Select Date'})</span>
        </p>
        <div className="flex overflow-x-auto gap-0 pb-2.5">
          {(() => {
            const startTime = product.cms?.start_time || "06:00"
            const endTime = product.cms?.end_time || "22:00"
            const [startHours] = startTime.split(":").map(Number)
            const [endHours] = endTime.split(":").map(Number)
            const hoursBetween = Math.max(1, endHours - startHours)

            return Array.from({ length: hoursBetween }, (_, i) => {
              const hour24 = startHours + i
              const hour12 = ((hour24 - 1) % 12) + 1
              const ampm = hour24 < 12 ? "AM" : "PM"
              const comSovValue = ((1 / (product.cms?.loops_per_day || 18)) * 100).toFixed(1)
              const actSovValue = totalBookedSpots > 0 ? ((1 / totalBookedSpots) * 100).toFixed(1) : "0.0"

              return (
                <div key={i} className="flex-shrink-0 w-[70px] h-40 border-2 border-gray-300 p-2 text-center">
                  <p className="text-xs font-bold mb-2">{hour12} {ampm}</p>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">COM SOV</div>
                    <div className="text-s font-bold text-[#2D3FFF]">{comSovValue}%</div>
                    <div className="text-xs text-gray-600">ACT SOV</div>
                    <div className="text-s font-bold text-[#30C71D]">{actSovValue}%</div>
                  </div>
                </div>
              );
            })
          })()}
        </div>
      </div>

      {/* Spot Selection Dialog */}
      <SpotSelectionDialog
        open={spotSelectionDialogOpen}
        onOpenChange={setSpotSelectionDialogOpen}
        products={product ? [product] : []}
        currentDate={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        selectedDate={selectedDate}
        type={spotSelectionType}
      />
    </div>
  )
}
