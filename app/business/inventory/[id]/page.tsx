"use client"

import React, { useRef } from "react"
import { useState, useEffect, use } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Calendar, Trash2, Upload, X, Loader2, AlertTriangle, CheckCircle, XCircle, Clock3, Maximize, Check, ImageIcon, MoreVertical } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { doc, getDoc, getDocs, updateDoc, serverTimestamp } from "firebase/firestore"
import { db} from "@/lib/firebase"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { Product } from "@/lib/firebase-service"
import { Skeleton } from "@/components/ui/skeleton"
import { softDeleteProduct } from "@/lib/firebase-service"
import { useToast } from "@/hooks/use-toast"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import SiteInformation from "@/components/SiteInformation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore"
import { SpotsGrid } from "@/components/spots-grid"
import { SpotSelectionDialog } from "@/components/spot-selection-dialog"
import TransactionsTab from "@/components/TransactionsTab"
import ProgramListTab from "@/components/ProgramListTab"
import ProofOfPlayTab from "@/components/ProofOfPlayTab"
import { OperatorProgramContentDialog } from "@/components/OperatorProgramContentDialog"
import type { Booking } from "@/lib/booking-service"
import { formatBookingDates } from "@/lib/booking-service"
import { useAuth } from "@/contexts/auth-context"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
// Price validation functions
const validatePriceInput = (value: string): boolean => {
  // Allow empty string, numbers, and decimal point
  const regex = /^(\d*\.?\d{0,2}|\d+\.)$/;
  return regex.test(value);
};

const formatPriceOnBlur = (value: string): string => {
  if (!value || value === '') return '0';
  const num = parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setPrice: (value: string) => void) => {
  const value = e.target.value;
  if (validatePriceInput(value)) {
    setPrice(value);
  }
};

const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, setPrice: (value: string) => void) => {
  const value = e.target.value;
  const formatted = formatPriceOnBlur(value);
  setPrice(formatted);
};

const handleFormattedNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setValue: (value: string) => void) => {
  let value = e.target.value.replace(/,/g, '');
  if (value === '' || /^\d*\.?\d*$/.test(value)) {
    setValue(value === '' ? '' : Number(value).toLocaleString());
  }
};

// Enhanced validation function for dynamic content with detailed calculations
const validateDynamicContent = (cms: { start_time: string; end_time: string; spot_duration: string; loops_per_day: string }, siteType: string, setValidationError: (error: string | null) => void) => {
  if (siteType !== "digital") {
    setValidationError(null)
    return true
  }

  const { start_time, end_time, spot_duration, loops_per_day } = cms

  if (!start_time || !end_time || !spot_duration || !loops_per_day) {
    setValidationError("All dynamic content fields are required.")
    return false
  }

  try {
    // Parse start and end times
    const [startHour, startMinute] = start_time.split(":").map(Number)
    const [endHour, endMinute] = end_time.split(":").map(Number)

    // Validate time format
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
      setValidationError("Invalid time format.")
      return false
    }

    // Convert to total minutes
    const startTotalMinutes = startHour * 60 + startMinute
    let endTotalMinutes = endHour * 60 + endMinute

    // Handle next day scenario (e.g., 22:00 to 06:00)
    if (endTotalMinutes <= startTotalMinutes) {
      endTotalMinutes += 24 * 60 // Add 24 hours
    }

    // Calculate duration in minutes, then convert to seconds
    const durationMinutes = endTotalMinutes - startTotalMinutes
    const durationSeconds = durationMinutes * 60

    // Parse numeric values
    const spotDurationNum = Number.parseInt(spot_duration)
    const spotsPerLoopNum = Number.parseInt(loops_per_day)

    if (isNaN(spotDurationNum) || isNaN(spotsPerLoopNum) || spotDurationNum <= 0 || spotsPerLoopNum <= 0) {
      setValidationError("Spot duration and spots per loop must be positive numbers.")
      return false
    }

    // Calculate total spot time needed per loop
    const totalSpotTimePerLoop = spotDurationNum * spotsPerLoopNum

    // Calculate how many complete loops can fit in the time duration
    const loopsResult = durationSeconds / totalSpotTimePerLoop

    // Check if the division results in a whole number (integer)
    if (!Number.isInteger(loopsResult)) {
      // Find suggested values that result in whole number of loops
      const findWorkingValues = (currentValue: number, isSpotDuration: boolean) => {
        const suggestions: number[] = []
        const maxOffset = 5 // Look for values within ±5 of current value

        for (let offset = 1; offset <= maxOffset; offset++) {
          // Try values above current
          const higher = currentValue + offset
          const lower = Math.max(1, currentValue - offset)

          // Check if higher value works
          const higherTotal = isSpotDuration
            ? higher * spotsPerLoopNum
            : spotDurationNum * higher
          if (durationSeconds % higherTotal === 0) {
            suggestions.push(higher)
            if (suggestions.length >= 2) break
          }

          // Check if lower value works
          const lowerTotal = isSpotDuration
            ? lower * spotsPerLoopNum
            : spotDurationNum * lower
          if (durationSeconds % lowerTotal === 0) {
            suggestions.push(lower)
            if (suggestions.length >= 2) break
          }
        }

        return suggestions
      }

      const spotDurationSuggestions = findWorkingValues(spotDurationNum, true)
      const spotsPerLoopSuggestions = findWorkingValues(spotsPerLoopNum, false)

      // Format duration for display
      const durationHours = Math.floor(durationMinutes / 60)
      const remainingMinutes = durationMinutes % 60
      const durationDisplay = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`

      // Build suggestions message
      let suggestionsText = "Suggested corrections:\n"
      let optionCount = 1

      if (spotDurationSuggestions.length > 0) {
        spotDurationSuggestions.forEach(suggestion => {
          const loops = Math.floor(durationSeconds / (suggestion * spotsPerLoopNum))
          suggestionsText += `• Option ${optionCount}: Change spot duration to ${suggestion}s (${loops} complete loops)\n`
          optionCount++
        })
      }

      if (spotsPerLoopSuggestions.length > 0) {
        spotsPerLoopSuggestions.forEach(suggestion => {
          const loops = Math.floor(durationSeconds / (spotDurationNum * suggestion))
          suggestionsText += `• Option ${optionCount}: Change spots per loop to ${suggestion} (${loops} complete loops)\n`
          optionCount++
        })
      }

      if (optionCount === 1) {
        // Fallback if no good suggestions found
        suggestionsText += "• Try adjusting spot duration or spots per loop to values that divide evenly into the total time"
      }

      setValidationError(
        `Invalid Input: The current configuration results in ${loopsResult.toFixed(2)} loops, which is not a whole number. \n\nTime Duration: ${durationDisplay} (${durationSeconds} seconds)\nCurrent Configuration: ${spotDurationNum}s × ${spotsPerLoopNum} spots = ${totalSpotTimePerLoop}s per loop\nResult: ${durationSeconds}s ÷ ${totalSpotTimePerLoop}s = ${loopsResult.toFixed(2)} loops\n\n${suggestionsText}`,
      )
      return false
    }

    // Success case - show calculation details
    const durationHours = Math.floor(durationMinutes / 60)
    const remainingMinutes = durationMinutes % 60
    const durationDisplay = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`

    setValidationError(
      `✓ Valid Configuration: ${Math.floor(loopsResult)} complete loops will fit in the ${durationDisplay} time period. Each loop uses ${totalSpotTimePerLoop}s (${spotDurationNum}s × ${spotsPerLoopNum} spots).`,
    )
    return true
  } catch (error) {
    console.error("Validation error:", error)
    setValidationError("Invalid time format or values.")
    return false
  }
}


export default function BusinessProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { userData } = useAuth()
  const { toast } = useToast()
  const paramsData = params
  const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id

  // Helper functions for spots data
  const generateSpotsData = (cms: any, activePlaylistPages: any[]) => {
    const totalSpots = cms.loops_per_day || 18
    const spots = []
    for (let i = 1; i <= totalSpots; i++) {
      // Find the active playlist page for this spot
      const page = activePlaylistPages.find(p => p.spot_number === i)
      const isOccupied = !!page

      // Get image URL from playlist page widget with matching spot_number
      let imageUrl: string | undefined
      let endDate: Date | undefined
      if (page && page.widgets) {
        const widget = activePlaylistPages.find((w: any) => w.spot_number === i)
        if (widget) {
          imageUrl = widget.widgets[0].url
          const scheduleEndDate = widget.schedules[0]?.endDate
          endDate = scheduleEndDate?.toDate ? scheduleEndDate.toDate() : new Date(scheduleEndDate)
        }
      }

      spots.push({
        id: `spot-${i}`,
        number: i,
        status: (isOccupied ? "occupied" : "vacant") as "occupied" | "vacant",
        endDate,
        imageUrl,
        booking_id: page?.booking_id,
      })
    }

    return spots
  }

  const calculateOccupiedSpots = (cms: any) => {
    if (currentDayBookingsLoading) {
      return 0
    }

    // Count unique spot numbers from current day's bookings
    const occupiedSpots = new Set()
    currentDayBookings.forEach(booking => {
      if (booking.spot_number) {
        occupiedSpots.add(booking.spot_number)
      } else {
        console.log("🔍 DEBUG: Booking has no spot_number:", booking.id, booking.spot_number)
      }
    })

    const occupiedCount = occupiedSpots.size

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
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsTotal, setBookingsTotal] = useState(0)
  const [bookingsPage, setBookingsPage] = useState(1)
  const itemsPerPage = 10
  const [marketplaceDialogOpen, setMarketplaceDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("transactions")
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false)
  const [bookedDates, setBookedDates] = useState<Date[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [screenSchedules, setScreenSchedules] = useState<any[]>([])
  const [currentDayBookings, setCurrentDayBookings] = useState<Booking[]>([])
  const [currentDayBookingsLoading, setCurrentDayBookingsLoading] = useState(false)
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
  const [activePlaylistPages, setActivePlaylistPages] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2020 + 1 }, (_, i) => 2020 + i)
  const [selectedContent, setSelectedContent] = useState<any | null>(null)
  const [contentDialogOpen, setContentDialogOpen] = useState(false)
  const [programListBookings, setProgramListBookings] = useState<Booking[]>([])
  const [programListBookingsLoading, setProgramListBookingsLoading] = useState(false)

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

  // Helper function to convert Firebase timestamp to readable date
  const formatFirebaseDate = (timestamp: any): string => {
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
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${type === "success"
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
              const markerElement = document.createElement('img');
              markerElement.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
                </svg>
              `);
              markerElement.style.width = '32px';
              markerElement.style.height = '32px';

              new window.google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: results[0].geometry.location,
                title: location,
                content: markerElement,
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

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Edit form state
  const [siteType, setSiteType] = useState<"static" | "digital">("static")
  const [category, setCategory] = useState("")
  const [siteName, setSiteName] = useState("")
  const [location, setLocation] = useState("")
   const [geopoint, setGeopoint] = useState<[number, number] | null>(null)
  const [locationLabel, setLocationLabel] = useState("")
  const [height, setHeight] = useState("")
  const [width, setWidth] = useState("")
  const [dimensionUnit, setDimensionUnit] = useState<"ft" | "m">("ft")
  const [elevation, setElevation] = useState("")
  const [elevationUnit, setElevationUnit] = useState<"ft" | "m">("ft")
  const [description, setDescription] = useState("")
  const [selectedAudience, setSelectedAudience] = useState<string[]>([])
  const [dailyTraffic, setDailyTraffic] = useState("")
  const [trafficUnit, setTrafficUnit] = useState<"daily" | "weekly" | "monthly">("monthly")
  const [price, setPrice] = useState("")
  const [priceUnit, setPriceUnit] = useState<"per spot" | "per day" | "per month">("per month")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([])

  // Dynamic settings state
  const [cms, setCms] = useState({
    start_time: "",
    end_time: "",
    spot_duration: "",
    loops_per_day: "",
  })
  const [validationError, setValidationError] = useState<string | null>(null)
   const [landOwner, setLandOwner] = useState("")
   const [partner, setPartner] = useState("")
   const [orientation, setOrientation] = useState("")
   const [locationVisibility, setLocationVisibility] = useState("")
   const [locationVisibilityUnit, setLocationVisibilityUnit] = useState<string>("ft")
   const [isCalendarOpen, setIsCalendarOpen] = useState(false)
   const [isOperatorDialogOpen, setIsOperatorDialogOpen] = useState(false)
   const [selectedOperatorSpot, setSelectedOperatorSpot] = useState<any>(null)
   const [operatorPlayerOnline, setOperatorPlayerOnline] = useState<boolean | null>(null)
   const [isCheckingOperatorPlayer, setIsCheckingOperatorPlayer] = useState(false)

  useEffect(() => {
    async function fetchProduct() {
      if (!params.id) return

      setLoading(true)
      try {
        const productId = Array.isArray(params.id) ? params.id[0] : params.id

        const productDoc = await getDoc(doc(db, "products", productId))

        if (productDoc.exists()) {
          setProduct({ id: productDoc.id, ...productDoc.data() } as Product)
        } else {
          console.error("Product not found")
        }
      } catch (error) {
        console.error("Error fetching product:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [params])

  // Fetch bookings for this product
  useEffect(() => {
    if (!params.id || activeTab !== "transactions") return

    setBookingsLoading(true)
    const productId = Array.isArray(params.id) ? params.id[0] : params.id
    const bookingsQuery = query(
      collection(db, "booking"),
      where("for_censorship", "==", 1),
      where("product_id", "==", productId),
      orderBy("created", "desc")
    )

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const allBookings: Booking[] = []

      snapshot.forEach((doc) => {
        const bookingData = doc.data() as any
        allBookings.push({
          id: doc.id,
          ...bookingData,
        } as Booking)
      })

      setBookings(allBookings)
      setBookingsTotal(allBookings.length)
      setBookingsLoading(false)
    }, (error) => {
      console.error("Error fetching bookings:", error)
      setBookingsLoading(false)
    })

    return unsubscribe
  }, [params.id, activeTab])

  // Reset pages when switching tabs
  useEffect(() => {
    if (activeTab !== "booking-summary") {
      setBookingsPage(1)
    }
  }, [activeTab])

  // Fetch screen schedules for spots content status
  useEffect(() => {
    const fetchScreenSchedules = async () => {
      if (!params.id || params.id === "new") return

      try {
        const productId = Array.isArray(params.id) ? params.id[0] : params.id
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
  }, [params.id])

  // Fetch current day's bookings for occupied/vacant calculation
  useEffect(() => {
    const fetchCurrentDayBookings = async () => {
      if (!params.id || params.id === "new") return

      setCurrentDayBookingsLoading(true)
      try {
        const productId = Array.isArray(params.id) ? params.id[0] : params.id
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

        // Query bookings where start_date <= today <= end_date and status is active
        const bookingsQuery = query(
          collection(db, "booking"),
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
            const startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any)
            const endDate = booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date as any)

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
  }, [params.id])

  // Fetch bookings for selected date in program list (realtime)
  useEffect(() => {
    if (!params.id || params.id === "new") return

    setProgramListBookingsLoading(true)
    const productId = Array.isArray(params.id) ? params.id[0] : params.id
    const selectedDate = new Date(selectedYear, selectedMonth - 1, selectedDay)
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59)

    const bookingsQuery = query(
      collection(db, "booking"),
      where("product_id", "==", productId)
    )

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const programListBookingsData: Booking[] = []

      snapshot.forEach((doc) => {
        const booking = { id: doc.id, ...doc.data() } as Booking

        // Check if booking covers selected date
        if (booking.start_date && booking.end_date) {
          const startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any)
          const endDate = booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date as any)

          if (startDate <= endOfDay && endDate >= startOfDay) {
            programListBookingsData.push(booking)
          }
        }
      })

      setProgramListBookings(programListBookingsData)
      setProgramListBookingsLoading(false)
    }, (error) => {
      console.error("Error fetching program list bookings:", error)
      setProgramListBookingsLoading(false)
    })

    return unsubscribe
  }, [params.id, selectedYear, selectedMonth, selectedDay])

  // Fetch booking requests (pending bookings) for this product
  useEffect(() => {
    if (!params.id || params.id === "new") {
      setBookingRequestsLoading(false)
      return
    }

    setBookingRequestsLoading(true)
    const productId = Array.isArray(params.id) ? params.id[0] : params.id
    const bookingRequestsQuery = query(
      collection(db, "booking"),
      where("for_censorship", "==", 1),
      where("product_id", "==", productId),
      orderBy("created", "desc")
    )

    const unsubscribe = onSnapshot(bookingRequestsQuery, (snapshot) => {
      const allBookingRequests: Booking[] = []

      snapshot.forEach((doc) => {
        const bookingData = doc.data() as any
        allBookingRequests.push({
          id: doc.id,
          ...bookingData,
        } as Booking)
      })

      setBookingRequests(allBookingRequests)
      setBookingRequestsLoading(false)
    }, (error) => {
      console.error("Error fetching booking requests:", error)
      setBookingRequestsLoading(false)
    })

    return unsubscribe
  }, [params.id, userData?.uid])

  // Fetch latest playlist and filter active pages
  useEffect(() => {
    if (!params.id || params.id === "new") return

    const productId = Array.isArray(params.id) ? params.id[0] : params.id
    const playlistQuery = query(
      collection(db, "playlist"),
      where("product_id", "==", productId),
      orderBy("created", "desc"),
      limit(1)
    )

    const unsubscribe = onSnapshot(playlistQuery, (playlistSnap) => {
      const changes = playlistSnap.docChanges()
      const hasRelevantChange = changes.some(change => change.type === 'added' || change.type === 'modified')

      if (!hasRelevantChange) return

      if (!playlistSnap.empty) {
        const latestPlaylist = playlistSnap.docs[0].data()
        const existingPages = latestPlaylist.pages || []

        // Filter out expired pages (where any schedule has endDate in the past)
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Set to start of today
        const activePages = existingPages.filter((page: any) =>
          page.schedules?.every((schedule: any) => {
            let scheduleEndDate = schedule.endDate?.toDate
              ? schedule.endDate.toDate()
              : new Date(schedule.endDate)
            scheduleEndDate.setHours(0, 0, 0, 0) // Set to start of that day
            return scheduleEndDate >= today
          })
        )
        setActivePlaylistPages(activePages)
      } else {
        setActivePlaylistPages([])
      }
    }, (error) => {
      console.error("Error fetching playlist:", error)
      setActivePlaylistPages([])
    })

    return unsubscribe
  }, [params.id])

  useEffect(() => {
    setBookingsPage(1)
  }, [selectedYear])

  // Fetch content history for this product

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

  // Update price unit based on site type
  useEffect(() => {
    setPriceUnit(siteType === "static" ? "per month" : "per spot")
  }, [siteType])


  // Validate dynamic content when fields change
  useEffect(() => {
    if (siteType === "digital") {
      validateDynamicContent(cms, siteType, setValidationError)
    } else {
      setValidationError(null)
    }
  }, [cms.start_time, cms.end_time, cms.spot_duration, cms.loops_per_day, siteType])
  const fetchBookedDates = async () => {
    if (!params.id) return

    setCalendarLoading(true)
    try {
      const productId = Array.isArray(params.id) ? params.id[0] : params.id
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
    setIsCalendarOpen(true)
    fetchBookedDates()
  }

  const handleBack = () => {
    router.back()
  }

  // Form handlers
  const toggleAudience = (type: string) => {
    setSelectedAudience(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)])
    }
  }

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : uploadedFiles.length - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex(prev => (prev < uploadedFiles.length - 1 ? prev + 1 : 0))
  }

  const handleRemoveImage = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    if (currentImageIndex >= index && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1)
    }
  }

  const handleRemoveExistingImage = (imageUrl: string) => {
    setImagesToRemove(prev => [...prev, imageUrl])
  }

  const handleRestoreExistingImage = (imageUrl: string) => {
    setImagesToRemove(prev => prev.filter(url => url !== imageUrl))
  }

  const handleDelete = async () => {
    if (!product || !product.id) return

    try {
      await softDeleteProduct(product.id)
      toast({
        title: "Product deleted",
        description: `${product.name} has been successfully deleted.`,
      })
      // Update the product in the UI to show it as deleted
      setProduct({
        ...product,
        deleted: true,
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete the product. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async () => {
    if (!product || !product.id) return

    setIsSubmitting(true)

    // Clear previous validation errors
    setValidationErrors([])

    // Validation - collect all errors
    const errors: string[] = []

    if (!siteName.trim()) {
      errors.push("Site name")
    }

    if (!location.trim()) {
      errors.push("Location")
    }

    if (!price.trim()) {
      errors.push("Price")
    } else if (isNaN(Number(price.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Price must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    // Validate dynamic content if digital site type
    if (siteType === "digital" && !validateDynamicContent(cms, siteType, setValidationError)) {
      toast({
        title: "Validation Error",
        description: "Please fix the dynamic content configuration errors.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (locationVisibility.trim() && isNaN(Number(locationVisibility.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Location Visibility must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (height.trim() && isNaN(Number(height.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Height must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (width.trim() && isNaN(Number(width.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Width must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (elevation.trim() && isNaN(Number(elevation.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Elevation must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    // Show validation error for missing required fields
    if (errors.length > 0) {
      setValidationErrors(errors)
      const errorMessage = errors.length === 1
        ? `${errors[0]} is required.`
        : `The following fields are required: ${errors.join(", ")}.`

      toast({
        title: "Required Fields Missing",
        description: errorMessage,
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Upload new files to Firebase Storage
      const mediaUrls: Array<{ url: string; distance: string; type: string; isVideo: boolean }> = []
      for (const file of uploadedFiles) {
        const url = await uploadFileToFirebaseStorage(file, `products/${product.company_id}`)
        mediaUrls.push({
          url,
          distance: "0",
          type: file.type,
          isVideo: file.type.startsWith('video/')
        })
      }

      // Filter out removed images and combine with new media
      const existingMedia = (product.media || []).filter(mediaItem => !imagesToRemove.includes(mediaItem.url))
      const allMedia = [...existingMedia, ...mediaUrls]

      // Create update data
      const updateData = {
        name: siteName,
        description,
        price: parseFloat(price.replace(/,/g, '')) || 0,
        content_type: siteType,
        categories: [category],
        cms: siteType === "digital" ? {
          start_time: cms.start_time,
          end_time: cms.end_time,
          spot_duration: parseInt(cms.spot_duration) || 0,
          loops_per_day: parseInt(cms.loops_per_day) || 0,
        } : null,
        specs_rental: {
          audience_types: selectedAudience,
          location,
          location_label: locationLabel,
          land_owner: landOwner,
           ...(geopoint && { geopoint }),
          partner,
          orientation,
          location_visibility: parseFloat(locationVisibility.replace(/,/g, '')) || null,
          location_visibility_unit: locationVisibilityUnit,
          traffic_count: parseInt(dailyTraffic) || null,
          traffic_unit: trafficUnit,
          height: parseFloat(height.replace(/,/g, '')) || null,
          width: parseFloat(width.replace(/,/g, '')) || null,
          elevation: parseFloat(elevation.replace(/,/g, '')) || null,
          dimension_unit: dimensionUnit,
          elevation_unit: elevationUnit,
          structure: product.specs_rental?.structure || {
            color: null,
            condition: null,
            contractor: null,
            last_maintenance: null,
          },
          illumination: product.specs_rental?.illumination || {
            bottom_count: null,
            bottom_lighting_specs: null,
            left_count: null,
            left_lighting_specs: null,
            right_count: null,
            right_lighting_specs: null,
            upper_count: null,
            upper_lighting_specs: null,
            power_consumption_monthly: null,
          },
        },
        media: allMedia,
        type: "RENTAL",
        updated: serverTimestamp(),
      }

      // Update in Firestore
      await updateDoc(doc(db, "products", product.id), updateData)

      // Update local state
      setProduct({
        ...product,
        ...updateData,
      })

      setEditDialogOpen(false)

      toast({
        title: "Site updated successfully",
        description: `${siteName} has been updated.`,
      })
    } catch (error) {
      console.error("Error updating product:", error)
      toast({
        title: "Error",
        description: "Failed to update site. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = () => {
    if (product) {
      // Populate form with existing product data
      const currentSiteType = product.content_type === "static" ? "static" : "digital"
      setSiteType(currentSiteType)
      setCategory(product.categories?.[0] || "")
      setSiteName(product.name || "")
       setGeopoint(product.specs_rental?.geopoint || null)
      setLocation(product.specs_rental?.location || "")
      setLocationLabel(product.specs_rental?.location_label || "")
      setHeight(product.specs_rental?.height ? Number(product.specs_rental.height).toLocaleString() : "")
      setWidth(product.specs_rental?.width ? Number(product.specs_rental.width).toLocaleString() : "")
      setDimensionUnit(product.specs_rental?.dimension_unit || "ft")
      setElevation(product.specs_rental?.elevation ? Number(product.specs_rental.elevation).toLocaleString() : "")
      setElevationUnit(product.specs_rental?.elevation_unit || "ft")
      setDescription(product.description || "")
      setSelectedAudience(product.specs_rental?.audience_types || [])
      setDailyTraffic(product.specs_rental?.traffic_count ? Number(product.specs_rental.traffic_count).toLocaleString() : "")
      setTrafficUnit(product.specs_rental?.traffic_unit || "monthly")
      setPrice(product.price ? formatPriceOnBlur(String(product.price)) : "0")
      setPriceUnit(currentSiteType === "static" ? "per month" : "per spot")
      setUploadedFiles([])
      setCurrentImageIndex(0)
      setImagesToRemove([])

      // Set CMS data if it exists
      if (product.cms) {
        setCms({
          start_time: product.cms.start_time || "06:00",
          end_time: product.cms.end_time || "22:00",
          spot_duration: product.cms.spot_duration ? String(product.cms.spot_duration) : "10",
          loops_per_day: product.cms.loops_per_day ? String(product.cms.loops_per_day) : "18",
        })
      } else {
        // Set defaults for new digital sites
        setCms({
          start_time: "06:00",
          end_time: "22:00",
          spot_duration: "10",
          loops_per_day: "18",
        })
      }
       setLandOwner(product.specs_rental?.land_owner || "")
       setPartner(product.specs_rental?.partner || "")
       setOrientation(product.specs_rental?.orientation || "")
       setLocationVisibility(product.specs_rental?.location_visibility ? Number(product.specs_rental.location_visibility).toLocaleString() : "")
       setLocationVisibilityUnit(product.specs_rental?.location_visibility_unit || "ft")

      setEditDialogOpen(true)
      setValidationErrors([])
      setValidationError(null)

      // Show info about required fields
      // setTimeout(() => {
      //   toast({
      //     title: "Required Fields",
      //     description: "Fields marked with * are required: Site Name, Location, and Price.",
      //   })
      // }, 500)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-xs">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-[300px] w-full mb-6 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="max-w-xs text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

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
          <Button variant="ghost" size="sm" onClick={() => router.push("/business/dashboard")} className="mr-2">
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
                spots={generateSpotsData(product.cms, activePlaylistPages)}
                totalSpots={product.cms.loops_per_day || 18}
                occupiedCount={activePlaylistPages.length}
                vacantCount={(product.cms.loops_per_day || 18) - activePlaylistPages.length}
                productId={params.id}
                currentDate={currentDate}
                router={router}
                bookingRequests={bookingRequests}
                disableBookingActions={true}
                disableEmptySpotClicks={true}
              />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div>
              <TabsList className="flex flex-wrap justify-start bg-transparent border-none p-0 gap-0">
                <TabsTrigger value="transactions" className="bg-white border-2 w-[127px] border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Transactions</TabsTrigger>
                <TabsTrigger value="program-list" className="bg-white border-2 w-[140px] border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Program List</TabsTrigger>
                <TabsTrigger value="proof-of-play" className="bg-white border-2 w-[140px] border-[#DFDFDF] text-[#DFDFDF] rounded-none h-auto min-h-9 px-2 py-2 whitespace-normal text-center data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-[#C4C4C4]">Proof of Play</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent key={1} value="transactions">
              <TransactionsTab
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                bookings={bookings}
                bookingsLoading={bookingsLoading}
                bookingsPage={bookingsPage}
                setBookingsPage={setBookingsPage}
                itemsPerPage={itemsPerPage}
                setSelectedBooking={setSelectedBooking}
                setBookingDialogOpen={setBookingDialogOpen}
              />
            </TabsContent>
            <TabsContent key={2} value="program-list">
              <ProgramListTab
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                activePlaylistPages={activePlaylistPages}
                cms={product?.cms}
                bookings={programListBookings}
                loading={programListBookingsLoading}
                retailSite={product.retail_spot.spot_number}
              />
            </TabsContent>
            <TabsContent key={3} value="proof-of-play">
              <ProofOfPlayTab />
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
                    priority
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
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${index === activeImageIndex
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

      <OperatorProgramContentDialog
        open={isOperatorDialogOpen}
        onOpenChange={setIsOperatorDialogOpen}
        spot={selectedOperatorSpot}
        productId={productId}

        playerOnline={operatorPlayerOnline ?? true}
        disabled={true}
      />

      {/* Edit Site Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[20px] py-0 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b px-6 mb-0 min-h-[4rem] flex items-start pt-6">
            <DialogTitle className="text-2xl font-semibold text-[#333333]">Edit Site</DialogTitle>
          </DialogHeader>

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Please fill in the required fields:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul role="list" className="list-disc pl-5 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Site Type */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Site Type:</Label>
                <div className="flex gap-2">
                  <Button
                    variant={siteType === "static" ? "default" : "outline"}
                    onClick={() => {
                      setSiteType("static")
                      setCms({
                        start_time: "",
                        end_time: "",
                        spot_duration: "",
                        loops_per_day: "",
                      })
                    }}
                    className={`flex-1 ${
                      siteType === "static"
                        ? "bg-[#30c71d] hover:bg-[#28a819] text-white border-[#30c71d]"
                        : "bg-white border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                    }`}
                  >
                    Static
                  </Button>
                  <Button
                    variant={siteType === "digital" ? "default" : "outline"}
                    onClick={() => {
                      setSiteType("digital")
                      setCms({
                        start_time: "06:00",
                        end_time: "22:00",
                        spot_duration: "10",
                        loops_per_day: "18",
                      })
                    }}
                    className={`flex-1 ${
                      siteType === "digital"
                        ? "bg-[#30c71d] hover:bg-[#28a819] text-white border-[#30c71d]"
                        : "bg-white border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                    }`}
                  >
                    Digital
                  </Button>
                </div>
              </div>

              {/* Category */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Category:</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="border-[#c4c4c4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(siteType === "static" ? ["Billboard", "Wallboard", "Transit Ads", "Column", "Bridgeway billboard", "Banner", "Lampost", "Lightbox", "Building Wrap", "Gantry", "Toll Plaza"] : ["Digital Billboard", "LED Poster", "Digital Transit Ads"]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Site Name */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Site Name: <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Site Name"
                  className="border-[#c4c4c4]"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>

              {/* Location */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Location: <span className="text-red-500">*</span>
                </Label>
                <GooglePlacesAutocomplete
                  value={location}
                  onChange={setLocation}
                  onGeopointChange={setGeopoint}
                  placeholder="Enter street address or search location..."
                  enableMap={true}
                  mapHeight="250px"
                />
              </div>

              {/* Location Label */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Location Label:</Label>
                <Input
                  className="border-[#c4c4c4]"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                />
              </div>

              {/* Location Visibility */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Location Visibility:</Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="e.g., 100"
                    className="flex-1 border-[#c4c4c4]"
                    value={locationVisibility}
                    onChange={(e) => handleFormattedNumberInput(e, setLocationVisibility)}
                  />
                  <Select value={locationVisibilityUnit} onValueChange={(value: string) => setLocationVisibilityUnit(value)}>
                    <SelectTrigger className="w-20 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Land Owner */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Land Owner:</Label>
                <Input
                  placeholder="Enter land owner name"
                  className="border-[#c4c4c4]"
                  value={landOwner}
                  onChange={(e) => setLandOwner(e.target.value)}
                />
              </div>

              {/* Partner */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Partner:</Label>
                <Input
                  placeholder="Enter partner name"
                  className="border-[#c4c4c4]"
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                />
              </div>

              {/* Orientation */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Orientation:</Label>
                <Input
                  placeholder="e.g., North, South, East, West"
                  className="border-[#c4c4c4]"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                />
              </div>

              {/* Dimension */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Dimension:</Label>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-[#4e4e4e] text-sm mb-1 block">Height:</Label>
                    <Input
                      type="text"
                      className="border-[#c4c4c4]"
                      value={height}
                      onChange={(e) => handleFormattedNumberInput(e, setHeight)}
                    />
                  </div>
                  <span className="text-[#4e4e4e]">x</span>
                  <div className="flex-1">
                    <Label className="text-[#4e4e4e] text-sm mb-1 block">Width:</Label>
                    <Input
                      type="text"
                      className="border-[#c4c4c4]"
                      value={width}
                      onChange={(e) => handleFormattedNumberInput(e, setWidth)}
                    />
                  </div>
                  <Select value={dimensionUnit} onValueChange={(value: "ft" | "m") => setDimensionUnit(value)}>
                    <SelectTrigger className="w-20 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Elevation from ground */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Elevation from ground: <span className="text-[#c4c4c4]">(Optional)</span>
                </Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    className="flex-1 border-[#c4c4c4]"
                    value={elevation}
                    onChange={(e) => handleFormattedNumberInput(e, setElevation)}
                  />
                  <Select value={elevationUnit} onValueChange={(value: "ft" | "m") => setElevationUnit(value)}>
                    <SelectTrigger className="w-20 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Description */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Description:</Label>
                <Textarea
                  className="min-h-[120px] border-[#c4c4c4] resize-none"
                  placeholder=""
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Audience Type */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Audience Type: <span className="text-[#c4c4c4]">(can choose multiple)</span>
                </Label>
                <div className="flex gap-2">
                  {["A", "B", "C", "D", "E"].map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      onClick={() => toggleAudience(type)}
                      className={`w-12 h-10 ${
                        selectedAudience.includes(type)
                          ? "bg-[#30c71d] hover:bg-[#28a819] text-white border-[#30c71d]"
                          : "bg-white border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                      }`}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Traffic */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Traffic:</Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    className="flex-1 border-[#c4c4c4]"
                    value={dailyTraffic}
                    onChange={(e) => handleFormattedNumberInput(e, setDailyTraffic)}
                  />
                  <Select value={trafficUnit} onValueChange={(value: "daily" | "weekly" | "monthly") => setTrafficUnit(value)}>
                    <SelectTrigger className="w-24 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">daily</SelectItem>
                      <SelectItem value="weekly">weekly</SelectItem>
                      <SelectItem value="monthly">monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Current Images */}
              {product?.media && product.media.length > 0 && (
                <div>
                  <Label className="text-[#4e4e4e] font-medium mb-3 block">Current Images:</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {product.media
                      .filter(mediaItem => !imagesToRemove.includes(mediaItem.url))
                      .map((mediaItem, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                          <img
                            src={mediaItem.url || "/placeholder.svg"}
                            alt={`Current image ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/abstract-geometric-sculpture.png"
                            }}
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveExistingImage(mediaItem.url)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                  </div>
                  {imagesToRemove.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-[#4e4e4e] font-medium mb-2 block text-sm">Images marked for removal:</Label>
                      <div className="flex flex-wrap gap-2">
                        {imagesToRemove.map((url, index) => {
                          const mediaItem = product.media?.find(m => m.url === url)
                          return (
                            <div key={index} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-2 py-1">
                              <span className="text-sm text-red-700">Image {index + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                                onClick={() => handleRestoreExistingImage(url)}
                              >
                                ↺
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Photo Upload */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Add New Photos: <span className="text-[#c4c4c4]">(can upload multiple)</span>
                </Label>

                {/* Image Preview/Carousel */}
                {uploadedFiles.length > 0 && (
                  <div className="mb-4">
                    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                      {/* Main Image Display */}
                      <div className="aspect-video relative">
                        <img
                          src={URL.createObjectURL(uploadedFiles[currentImageIndex])}
                          alt={`Preview ${currentImageIndex + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Remove Button */}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          onClick={() => handleRemoveImage(currentImageIndex)}
                        >
                          ×
                        </Button>
                      </div>

                      {/* Navigation Arrows (only show if multiple images) */}
                      {uploadedFiles.length > 1 && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                            onClick={handlePrevImage}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                            onClick={handleNextImage}
                          >
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                        </>
                      )}

                      {/* Image Counter */}
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                        {currentImageIndex + 1} / {uploadedFiles.length}
                      </div>
                    </div>

                    {/* Thumbnail Strip */}
                    {uploadedFiles.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {uploadedFiles.map((file, index) => (
                          <button
                            key={index}
                            className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                              index === currentImageIndex ? 'border-blue-500' : 'border-gray-300'
                            }`}
                            onClick={() => setCurrentImageIndex(index)}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Area */}
                <div className="border-2 border-dashed border-[#c4c4c4] rounded-lg p-8 text-center bg-gray-50">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-[#c4c4c4] mx-auto mb-2" />
                    <p className="text-[#c4c4c4] font-medium">Upload</p>
                  </label>
                  {uploadedFiles.length === 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Click to select images
                    </p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Price: <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    className="flex-1 border-[#c4c4c4]"
                    value={price}
                    onChange={(e) => handleFormattedNumberInput(e, setPrice)}
                    onBlur={(e) => handlePriceBlur(e, setPrice)}
                  />
                  <Select value={priceUnit} disabled>
                    <SelectTrigger className="w-28 border-[#c4c4c4] bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per spot">per spot</SelectItem>
                      <SelectItem value="per day">per day</SelectItem>
                      <SelectItem value="per month">per month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Settings - Only show for digital site type */}
              {siteType === "digital" && (
                <div>
                  <Label className="text-[#4e4e4e] font-medium mb-3 block">Digital Content Settings:</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-start_time" className="text-[#4e4e4e] font-medium mb-3 block">Start Time</Label>
                      <Input
                        id="edit-detail-start_time"
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.start_time}
                        onChange={(e) => setCms(prev => ({ ...prev, start_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-end_time" className="text-[#4e4e4e] font-medium mb-3 block">End Time</Label>
                      <Input
                        id="edit-detail-end_time"
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.end_time}
                        onChange={(e) => setCms(prev => ({ ...prev, end_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-spot_duration" className="text-[#4e4e4e] font-medium mb-3 block">Spot Duration (seconds)</Label>
                      <Input
                        id="edit-detail-spot_duration"
                        type="number"
                        className="border-[#c4c4c4]"
                        value={cms.spot_duration}
                        onChange={(e) => setCms(prev => ({ ...prev, spot_duration: e.target.value }))}
                        placeholder="Enter duration in seconds"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-loops_per_day" className="text-[#4e4e4e] font-medium mb-3 block">Spots Per Loop</Label>
                      <Input
                        id="edit-detail-loops_per_day"
                        type="number"
                        className="border-[#c4c4c4]"
                        value={cms.loops_per_day}
                        onChange={(e) => setCms(prev => ({ ...prev, loops_per_day: e.target.value }))}
                        placeholder="Enter spots per loop"
                        required
                      />
                    </div>
                  </div>

                  {/* Validation feedback display */}
                  {validationError && (
                    <div
                      className={`mt-4 p-4 rounded-lg border ${
                        validationError.startsWith("✓")
                          ? "bg-green-50 border-green-200 text-green-800"
                          : "bg-red-50 border-red-200 text-red-800"
                      }`}
                    >
                      <div className="text-sm font-medium mb-2">
                        {validationError.startsWith("✓") ? "Configuration Valid" : "Configuration Error"}
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-mono">{validationError}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-white border-t border-[#c4c4c4] mt-8 pt-6 pb-6 -mb-6">
            <div className="flex justify-end gap-4 px-6">
              <Button
                variant="outline"
                className="px-8 border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50 bg-transparent"
                onClick={() => setEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="px-8 bg-[#1d0beb] hover:bg-[#1508d1] text-white"
                onClick={handleUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update Site"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatDate(dateValue?: string | any): string {
  if (!dateValue) return "Unknown"

  try {
    let date: Date

    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue === "object" && "toDate" in dateValue) {
      date = dateValue.toDate()
    }
    // Handle ISO string dates
    else if (typeof dateValue === "string") {
      date = new Date(dateValue)
    }
    // Handle any other date-like input
    else {
      date = new Date(dateValue)
    }

    return date.toLocaleDateString()
  } catch (error) {
    console.error("Error formatting date:", error)
    return String(dateValue)
  }
}
