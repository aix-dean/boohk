import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, serverTimestamp, orderBy, limit } from "firebase/firestore"
import type { Booking } from "@/lib/booking-service"
import { formatBookingDates } from "@/lib/booking-service"
import { createCMSContentDeployment } from "@/lib/cms-api"
import { useToast } from "@/hooks/use-toast"
import { BookingCongratulationsDialog } from "@/components/BookingCongratulationsDialog"
import { SpotContentDialog } from "@/components/SpotContentDialog"
import { convertSegmentPathToStaticExportFilename } from "next/dist/shared/lib/segment-cache/segment-value-encoding"

interface Spot {
  id: string
  number: number
  status: "occupied" | "vacant"
  clientName?: string
  imageUrl?: string
}

interface SpotsGridProps {
  spots: Spot[]
  totalSpots: number
  occupiedCount: number
  vacantCount: number
  productId?: string
  currentDate: string
  router?: any
  selectedSpots?: number[]
  onSpotToggle?: (spotNumber: number) => void
  showSummary?: boolean
  bg?: boolean
  bookingRequests?: Booking[]
  onBookingAccepted?: () => void
}

interface MediaPlayerProps {
  url?: string
  className?: string
  controls?: boolean
  playing?: boolean
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ url, className = "w-full h-full object-contain rounded-[10px]", controls = true, playing = false }) => {
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [fallbackContent, setFallbackContent] = useState<React.JSX.Element | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.play().catch(() => {
          // Ignore play errors (e.g., user interaction required)
        })
      } else {
        videoRef.current.pause()
      }
    }
  }, [playing])

  // URL validation function
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Function to detect YouTube URLs
  const isYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    return youtubeRegex.test(url)
  }

  // Function to detect Vimeo URLs
  const isVimeoUrl = (url: string): boolean => {
    const vimeoRegex = /(?:vimeo\.com\/)(?:.*#|.*\/videos\/|.*\/|channels\/.*\/|groups\/.*\/videos\/|album\/.*\/video\/|video\/)?([0-9]+)(?:$|\/|\?)/
    return vimeoRegex.test(url)
  }

  // Function to get YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
    return match ? match[1] : null
  }

  // Function to get Vimeo video ID
  const getVimeoVideoId = (url: string): string | null => {
    const match = url.match(/(?:vimeo\.com\/)(?:.*#|.*\/videos\/|.*\/|channels\/.*\/|groups\/.*\/videos\/|album\/.*\/video\/|video\/)?([0-9]+)(?:$|\/|\?)/)
    return match ? match[1] : null
  }

  // Function to infer MIME type from URL
  const getMimeType = (url: string): string | undefined => {
    // Check for YouTube/Vimeo first
    if (isYouTubeUrl(url) || isVimeoUrl(url)) {
      return 'embed'
    }

    // Remove query parameters and extract extension
    const urlWithoutQuery = url.split('?')[0]
    const extension = urlWithoutQuery.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'mp4':
        return 'video/mp4'
      case 'webm':
        return 'video/webm'
      case 'ogg':
        return 'video/ogg'
      case 'avi':
        return 'video/avi'
      case 'mov':
        return 'video/quicktime'
      case 'm4v':
        return 'video/mp4'
      case 'mkv':
        return 'video/x-matroska'
      case 'flv':
        return 'video/x-flv'
      case 'wmv':
        return 'video/x-ms-wmv'
      case '3gp':
        return 'video/3gpp'
      case 'mpg':
      case 'mpeg':
        return 'video/mpeg'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      case 'gif':
        return 'image/gif'
      case 'webp':
        return 'image/webp'
      case 'svg':
        return 'image/svg+xml'
      case 'bmp':
        return 'image/bmp'
      case 'tiff':
      case 'tif':
        return 'image/tiff'
      default:
        // Try to detect video URLs without extensions (streaming URLs)
        if (url.includes('video') || url.includes('stream') || url.includes('media')) {
          return 'video/mp4' // Default to mp4 for unknown video URLs
        }
        return undefined
    }
  }

  if (!url) {
    return <p className="text-gray-500 text-center">No media URL available</p>
  }

  if (!isValidUrl(url)) {
    return <p className="text-red-500 text-center">Invalid media URL</p>
  }

  if (mediaError) {
    return (
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">{mediaError}</p>
        {fallbackContent}
      </div>
    )
  }

  const mimeType = getMimeType(url)

  if (mimeType === 'embed') {
    if (isYouTubeUrl(url)) {
      const videoId = getYouTubeVideoId(url)
      if (videoId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className={className}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setMediaError(null)
              setFallbackContent(null)
            }}
            onError={() => {
              setMediaError('Failed to load YouTube video')
              setFallbackContent(<p className="text-xs text-gray-500 mt-1">Check the YouTube URL</p>)
            }}
          />
        )
      }
    } else if (isVimeoUrl(url)) {
      const videoId = getVimeoVideoId(url)
      if (videoId) {
        return (
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            className={className}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setMediaError(null)
              setFallbackContent(null)
            }}
            onError={() => {
              setMediaError('Failed to load Vimeo video')
              setFallbackContent(<p className="text-xs text-gray-500 mt-1">Check the Vimeo URL</p>)
            }}
          />
        )
      }
    }
    // Fallback for unrecognized embed URLs
    return (
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Unsupported embed URL</p>
        <p className="text-xs text-gray-500 mt-1">Only YouTube and Vimeo embeds are supported</p>
      </div>
    )
  } else if (mimeType?.startsWith('video/')) {
    return (
      <video
        ref={videoRef}
        controls={controls}
        preload="metadata"
        className={className}
        muted // Add muted to allow autoplay on hover
        onError={(e) => {
          const target = e.target as HTMLVideoElement
          let errorMessage = 'Video failed to load'
          let fallback = null

          if (target.error) {
            switch (target.error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Video loading was aborted'
                break
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Network error while loading video'
                fallback = <p className="text-xs text-gray-500 mt-1">Check your internet connection</p>
                break
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Video format not supported by your browser'
                fallback = <p className="text-xs text-gray-500 mt-1">Try a different browser or format</p>
                break
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Video source not supported'
                fallback = <p className="text-xs text-gray-500 mt-1">Unsupported video format</p>
                break
              default:
                errorMessage = 'Unknown video error'
                break
            }
          }

          setMediaError(errorMessage)
          setFallbackContent(fallback)
        }}
        onLoadedData={() => {
          setMediaError(null)
          setFallbackContent(null)
        }}
      >
        <source src={url} type={mimeType} />
        Your browser does not support the video tag.
      </video>
    )
  } else if (mimeType?.startsWith('image/')) {
    return (
      <img
        src={url}
        alt="Media content"
        className={className}
        onError={() => {
          setMediaError('Image failed to load')
          setFallbackContent(<p className="text-xs text-gray-500 mt-1">Check the image URL or format</p>)
        }}
        onLoad={() => {
          setMediaError(null)
          setFallbackContent(null)
        }}
      />
    )
  } else {
    return (
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Unsupported media type</p>
        <p className="text-xs text-gray-500 mt-1">Supported: videos, images, YouTube, Vimeo</p>
      </div>
    )
  }
}

export function SpotsGrid({ spots, totalSpots, occupiedCount, vacantCount, productId, currentDate, router, selectedSpots, onSpotToggle, showSummary = true, bg = true, bookingRequests = [], onBookingAccepted }: SpotsGridProps) {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeclineConfirmDialogOpen, setIsDeclineConfirmDialogOpen] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [isBookingCongratulationsOpen, setIsBookingCongratulationsOpen] = useState(false)
  const [congratulationsBooking, setCongratulationsBooking] = useState<Booking | null>(null)
  const [isDeclineReasonDialogOpen, setIsDeclineReasonDialogOpen] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [otherReason, setOtherReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isThankYouDialogOpen, setIsThankYouDialogOpen] = useState(false)
  const [isSpotDialogOpen, setIsSpotDialogOpen] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [hoveredSpots, setHoveredSpots] = useState<Record<number, boolean>>({})
  const [retailSpotNumbers, setRetailSpotNumbers] = useState<number[]>([])
  const filteredBookings = bookingRequests.filter(booking => booking.for_screening === 0)
  const topRow = filteredBookings.filter((_, index) => index % 2 === 0)
  const bottomRow = filteredBookings.filter((_, index) => index % 2 === 1)

  useEffect(() => {
    if (!productId) return

    const fetchSpotImages = async () => {
      try {
        // Fetch product
        const productRef = doc(db, "products", productId)
        const productSnap = await getDoc(productRef)
        if (!productSnap.exists()) return
        const product = productSnap.data()

        setRetailSpotNumbers(product.retail_spot?.spot_number || [])

        // Query playlists
        const playlistQuery = query(
          collection(db, "playlist"),
          where("product_id", "==", productId),
          where("playerIds", "==", product.playerIds)
        )
        const playlistSnap = await getDocs(playlistQuery)
        const playlists = playlistSnap.docs.map(doc => doc.data())

        // Filter active pages
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const activePages = []
        playlists.forEach(playlist => {
          if (playlist.pages) {
            playlist.pages.forEach((page: any) => {
              if (page.schedules?.every((schedule: any) => {
                let endDate = schedule.endDate?.toDate ? schedule.endDate.toDate() : new Date(schedule.endDate)
                endDate.setHours(0, 0, 0, 0)
                return endDate >= today
              })) {
                activePages.push(page)
              }
            })
          }
        })

        // Map spot numbers to image URLs
        const urls: Record<number, string> = {}
        activePages.forEach((page: any) => {
          if (page.spot_number && page.widgets && page.widgets.length > 0) {
            // Assume first widget has the url
            const widget = page.widgets[0]
            if (widget.url) {
              urls[page.spot_number] = widget.url
            }
          }
        })

      } catch (error) {
        console.error("Error fetching spot images:", error)
      }
    }

    fetchSpotImages()
  }, [productId])


  const handleSpotClick = (spotNumber: number) => {
    const spot = spots.find(s => s.number === spotNumber)
    if (spot) {
      setSelectedSpot(spot)
      setIsSpotDialogOpen(true)
    }
  }

  const handleAcceptBooking = async () => {
    if (!selectedBooking) return

    setIsAccepting(true)
    try {
      // Generate airing_code
      const airing_code = "BH" + Date.now()

      // Update booking to set for_screening = 2 (accepted) and airing_code
      await updateDoc(doc(db, "booking", selectedBooking.id), {
        for_screening: 2,
        airing_code,
        updated: new Date()
      })

      // Update selectedBooking with airing_code for the dialog
      selectedBooking.airing_code = airing_code

      toast({
        title: "Booking accepted",
        description: "The booking has been accepted and is now for screening."
      })

      // Open congratulations dialog
      setCongratulationsBooking(selectedBooking)
      setIsBookingCongratulationsOpen(true)

      // Fetch product data for CMS API
      const productRef = doc(db, "products", productId!)
      const productSnap = await getDoc(productRef)
      const product: any = productSnap.exists() ? { id: productSnap.id, ...productSnap.data() } : null

      if (product) {
        // Query the latest playlist for this product and playerIds
        const playlistQuery = query(
          collection(db, "playlist"),
          where("product_id", "==", product.id),
          where("playerIds", "==", product.playerIds),
          orderBy("created", "desc"),
          limit(1)
        )
        const playlistSnap = await getDocs(playlistQuery)
        let existingPages = []
        if (!playlistSnap.empty) {
          const latestPlaylist = playlistSnap.docs[0].data()
          existingPages = latestPlaylist.pages || []
        }

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

        // Calculate the maximum spot_number from active pages
        let maxSpotNumber = 0
        activePages.forEach(page => {
          if (page.spot_number && page.spot_number > maxSpotNumber) maxSpotNumber = page.spot_number
        })

        // Call CMS API with booking and product data
        // Construct basic parameters - this may need adjustment based on actual CMS requirements
        const duration = product.cms.spot_duration * 1000 || 9000 // in milliseconds
        const schedules = {
          startDate: selectedBooking.start_date?.toDate?.()?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          endDate: selectedBooking.end_date?.toDate?.()?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          plans: [{
            weekDays: [0, 1, 2, 3, 4, 5, 6], // All days
            startTime: product.cms.start_time || "00:00",
            endTime: product.cms.end_time || "23:59"
          }]
        }
         const schedule = {
          startDate: "2020-04-11",
          endDate: "2060-05-12",
          plans: [{
            weekDays: [0, 1, 2, 3, 4, 5, 6], // All days
            startTime: product.cms.start_time || "00:00",
            endTime: product.cms.end_time || "23:59"
          }]
        }
        const pages = selectedBooking.url ? [
          {
            name: `booking-${selectedBooking.id}-page`,
            widgets: [
              {
                zIndex: 1,
                type: "STREAM_MEDIA",
                size: 12000,
                md5: "placeholder-md5",
                duration: duration,
                url: selectedBooking.url,
                layout: {
                  x: "0%",
                  y: "0%",
                  width: "100%",
                  height: "100%"
                }
              }
            ]
          }
        ] : []

        // Combine active existing pages with new booking pages
        const newPages = [...activePages, ...pages]

        // Create playlist document for specific product
        if (product.id) {
          const playlistDoc = {
            playerIds: product.playerIds,
            product_id: product.id,
            company_id: product.company_id,
            created: serverTimestamp(),
            pages: [
              ...activePages,
              ...pages.map((page, index) => ({
                ...page,
                schedules: [schedules],
                client_id: selectedBooking.client.id,
                client_name: selectedBooking.client.name || selectedBooking.client?.name,
                acceptByUid: userData?.uid,
                acceptBy: `${userData?.first_name || ""} ${userData?.last_name || ""}`,
                booking_id: selectedBooking.id,
                spot_number: maxSpotNumber + index + 1
              }))
            ]
          }
          await addDoc(collection(db, "playlist"), playlistDoc)
          const playerIds = product.playerIds || []
          // Prepare pages for CMS (only name and widgets)
          const cmsPages = playlistDoc.pages.map(page => ({
            name: page.name,
            schedules: page.schedules,
            widgets: page.widgets
          }))

          await createCMSContentDeployment(playerIds, schedule, cmsPages)
        }
      }

      // Close dialog and refresh
      setIsDialogOpen(false)
      setSelectedBooking(null)
      onBookingAccepted?.()
    } catch (error) {
      console.error("Error accepting booking:", error)
      toast({
        title: "Error",
        description: "Failed to accept the booking. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDeclineBooking = async () => {
    if (!selectedBooking) return

    setIsDeclining(true)
    try {
      await updateDoc(doc(db, "booking", selectedBooking.id), {
        for_screening: 3,
        updated: new Date()
      })

      toast({
        title: "Booking rejected",
        description: "The booking has been rejected."
      })

      setIsDialogOpen(false)
      setSelectedBooking(null)
      onBookingAccepted?.()
    } catch (error) {
      console.error("Error rejecting booking:", error)
      toast({
        title: "Error",
        description: "Failed to reject the booking. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsDeclining(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedBooking) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "booking_declined"), {
        bookingId: selectedBooking.id,
        selectedReasons,
        otherReason,
        declinedAt: serverTimestamp(),
        clientId: selectedBooking.client?.id,
        clientName: selectedBooking.client?.name,
        startDate: selectedBooking.start_date,
        endDate: selectedBooking.end_date,
        totalCost: selectedBooking.total_cost || selectedBooking.cost,
        productName: selectedBooking.product_name || selectedBooking.project_name,
      });
      await handleDeclineBooking();
      setIsDeclineReasonDialogOpen(false);
      setIsThankYouDialogOpen(true);
      setSelectedReasons([]);
      setOtherReason("");
    } catch (error) {
      console.error("Error declining booking:", error);
      toast({
        title: "Error",
        description: "Failed to decline booking.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const spotsContent = (
    <div className="flex gap-[13.758px] overflow-x-scroll pb-4 w-full pr-4">
      {spots.map((spot) => (
        <div
          key={spot.id}
          className={`relative flex-shrink-0 w-[110px] h-[197px] bg-white p-1.5 rounded-[14px]  shadow-[-1px_3px_7px_-1px_rgba(0,0,0,0.25)] ${retailSpotNumbers.includes(spot.number) ? 'border-4 border-[#737fff]' : 'border border-gray-200'} overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex flex-col`}
          onClick={() => onSpotToggle ? onSpotToggle(spot.number) : handleSpotClick(spot.number)}
          onMouseEnter={() => setHoveredSpots(prev => ({ ...prev, [spot.number]: true }))}
          onMouseLeave={() => setHoveredSpots(prev => ({ ...prev, [spot.number]: false }))}
        >
          {/* Image Section */}
          <div className="flex-1 p-1 rounded-[10px] bg-white flex justify-center relative overflow-hidden">
            {(() => {
              const imageUrl = spot.imageUrl
              return imageUrl ? (
                <>
                  <MediaPlayer url={imageUrl} className="w-full h-full object-cover rounded-[10px]" controls={false} playing={hoveredSpots[spot.number] || false} />
                </>
              ) : (
                <>

                </>
              )
            })()}
          </div>

          {/* Content Section */}
          <div className="flex flex-col p-1 bg-white">
            {/* Spot Number */}
            <div className="text-[11px] font-semibold text-black">
              {spot.number}/{totalSpots}
            </div>

            {/* Status */}
            <div className={`text-[11px] font-semibold ${spot.status === "occupied" ? "text-[#00d0ff]" : "text-[#a1a1a1]"
              }`}>
              {spot.status === "occupied" ? "Occupied" : "Vacant"}
            </div>

            {/* Client Name */}
            <div className={`text-[11px] truncate ${spot.status === "occupied" ? "text-black" : "text-[#a1a1a1]"
              }`}>
              {`${spot.endDate ? `Till ${new Date(spot.endDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}` : "-"}` || "-"}
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  if (bg) {
    return (
      <div className="space-y-4">
        {filteredBookings.length > 0 && (
          <>
            <div style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: '700', lineHeight: '100%' }}>Booking Requests</div>
            {/* Booking Requests Cards */}
            <div className="mb-4 max-h-[170px] overflow-y-auto">
              <div className="">
                <div className="flex space-x-4 overflow-x-auto pb-2">
                  {topRow.map((booking) => {
                    return (
                      <div
                        key={booking.id}
                        className="relative w-[245px] h-[76px] flex-shrink-0 rounded-[7.911px] border-[2.373px] border-[#B8D9FF] bg-[#F6F9FF] flex items-center cursor-pointer"
                        onClick={() => {
                          setSelectedBooking(booking)
                          setIsDialogOpen(true)
                        }}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M9 7V15L16 11L9 7ZM21 3H3C1.9 3 1 3.9 1 5V17C1 18.1 1.9 19 3 19H8V21H16V19H21C22.1 19 23 18.1 23 17V5C23 3.9 22.1 3 21 3ZM21 17H3V5H21V17Z" fill="#333333" />
                          </svg>
                          <div className="flex flex-col">
                            <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: '132%', color: '#333', fontFamily: 'Inter' }}>BK#{booking.reservation_id || booking.id.slice(-8)}</div>
                            <div style={{ fontSize: '12px', fontWeight: 400, lineHeight: '132%', color: '#333', fontFamily: 'Inter' }}>{formatBookingDates(booking.start_date, booking.end_date)}</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: '132%', color: '#333', fontFamily: 'Inter' }}>P{booking.total_cost?.toLocaleString() || booking.cost?.toLocaleString() || "0"}</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="2" r="1.5" fill="#333333" />
                            <circle cx="8" cy="8" r="1.5" fill="#333333" />
                            <circle cx="8" cy="14" r="1.5" fill="#333333" />
                          </svg>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex space-x-4 overflow-x-auto pb-2">
                  {bottomRow.map((booking) => {
                    return (
                      <div
                        key={booking.id}
                        className="relative w-[245px] h-[76px] flex-shrink-0 rounded-[7.911px] border-[2.373px] border-[#B8D9FF] bg-[#F6F9FF] flex items-center cursor-pointer"
                        onClick={() => {
                          setSelectedBooking(booking)
                          setIsDialogOpen(true)
                        }}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M9 7V15L16 11L9 7ZM21 3H3C1.9 3 1 3.9 1 5V17C1 18.1 1.9 19 3 19H8V21H16V19H21C22.1 19 23 18.1 23 17V5C23 3.9 22.1 3 21 3ZM21 17H3V5H21V17Z" fill="#333333" />
                          </svg>
                          <div className="flex flex-col">
                            <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: '132%', color: '#333', fontFamily: 'Inter' }}>BK#{booking.reservation_id || booking.id.slice(-8)}</div>
                            <div style={{ fontSize: '12px', fontWeight: 400, lineHeight: '132%', color: '#333', fontFamily: 'Inter' }}>{formatBookingDates(booking.start_date, booking.end_date)}</div>
                            <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: '132%', color: '#333', fontFamily: 'Inter' }}>P{booking.total_cost?.toLocaleString() || booking.cost?.toLocaleString() || "0"}</div>
                          </div>
                        </div>
                        <div className="absolute top-2 right-2">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="2" r="1.5" fill="#333333" />
                            <circle cx="8" cy="8" r="1.5" fill="#333333" />
                            <circle cx="8" cy="14" r="1.5" fill="#333333" />
                          </svg>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
        <div style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: '700', lineHeight: '100%' }}>Site spots</div>
        {/* Spots Grid */}
        <div className="bg-[#ECECEC] rounded-[13.8px] p-4">
          {showSummary && (
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="flex items-center gap-8">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">Total Spots:</span>
                  <span className="text-gray-700">{totalSpots}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">Total Occupied:</span>
                  <span className="text-cyan-600 font-medium">{occupiedCount} ({Math.round((occupiedCount / totalSpots) * 100)}%)</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">Total Vacant:</span>
                  <span className="font-bold text-gray-700">{vacantCount} ({Math.round((vacantCount / totalSpots) * 100)}%)</span>
                </div>
              </div>
              <span
                onClick={() => router?.push(`/sales/products/${productId}/spots/1`)}
                className="text-blue-600 cursor-pointer"
              >
                as of {currentDate} {'->'}
              </span>
            </div>
          )}
          {spotsContent}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="relative">
              <DialogTitle>Booking Request</DialogTitle>
              <DialogClose className="absolute top-0 right-0">
                <X width="24.007" height="31.209" />
              </DialogClose>
            </DialogHeader>
            {selectedBooking && (
              <div className="flex gap-4">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-sm font-medium">Dates</label>
                    <p className="text-sm">{formatBookingDates(selectedBooking.start_date, selectedBooking.end_date)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Display Name</label>
                    <p className="text-sm">{selectedBooking.product_name || selectedBooking.project_name || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Total Payout</label>
                    <p className="text-sm">P{selectedBooking.total_cost?.toLocaleString() || selectedBooking.cost?.toLocaleString() || "0"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Booking Code</label>
                    <p className="text-sm">BK#{selectedBooking.reservation_id || selectedBooking.id.slice(-8)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Client</label>
                    <p className="text-sm">{selectedBooking.client?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="w-[320px] space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <div className="h-[320px] flex-shrink-0 rounded-[10px] bg-gray-100 flex items-center justify-center">
                    <MediaPlayer url={selectedBooking.url} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); setIsDeclineConfirmDialogOpen(true); }} className="w-[90px] h-[24px] px-[29px] rounded-[6px] border-[1.5px] border-[#C4C4C4] bg-white">Reject</Button>
              <Button onClick={() => { setIsDialogOpen(false); setIsConfirmDialogOpen(true); }} disabled={isAccepting} className="w-[120px] h-[24px] rounded-[6.024px] bg-[#30C71D]">
                {isAccepting ? <><Loader2 className="animate-spin mr-1 h-4 w-4" />Accepting...</> : "Accept"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="w-[283px] h-[153px] p-1">
            <DialogHeader className="relative p-0">
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-2 ">
              <Image src="/check_outline.svg" alt="Check" width={32} height={32} />
              <p className="text-sm text-center">Are you sure you want to accept?</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => { setIsConfirmDialogOpen(false); setIsDialogOpen(true); }} className="w-[129px] h-[28px] rounded-[5.992px] border-[1.198px] border-[#C4C4C4] bg-[#FFF]">Cancel</Button>
              <Button onClick={async () => { setIsConfirming(true); try { await handleAcceptBooking(); } finally { setIsConfirming(false); setIsConfirmDialogOpen(false); } }} disabled={isConfirming} className="w-[115px] h-[28px] rounded-[5.992px] bg-[#1D0BEB]">
                {isConfirming ? <><Loader2 className="animate-spin mr-1 h-4 w-4" />Confirming...</> : "Yes, proceed"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDeclineConfirmDialogOpen} onOpenChange={setIsDeclineConfirmDialogOpen}>
          <DialogContent className="w-[283px] h-[153px] p-1">
            <DialogHeader className="relative p-0">
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-2 ">
              <Image src="/cancel_outline.svg" alt="Cancel" width={32} height={32} />
              <p className="text-sm text-center">Are you sure you want to reject?</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => { setIsDeclineConfirmDialogOpen(false); setIsDialogOpen(true); }} className="w-[129px] h-[28px] rounded-[5.992px] border-[1.198px] border-[#C4C4C4] bg-[#FFF]">Cancel</Button>
              <Button onClick={() => { setIsDeclineConfirmDialogOpen(false); setIsDeclineReasonDialogOpen(true); }} className="w-[115px] h-[28px] rounded-[5.992px] bg-[#1D0BEB]">
                Yes, proceed
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDeclineReasonDialogOpen} onOpenChange={(open) => { setIsDeclineReasonDialogOpen(open); if (!open) { setSelectedReasons([]); setOtherReason(""); } }}>
          <DialogContent style={{ width: '369px', height: '460px', flexShrink: 0 }} className="p-6">
            <DialogHeader className="relative">
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              <Image src="/boohk-logo.png" alt="boohk logo" width={40.984} height={51.228} />
              <h1 className="text-lg font-semibold text-center">Booking declined.</h1>
              <p style={{ color: '#333', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontWeight: 400, lineHeight: '114%' }}>To help us understand and improve future requests, would you mind selecting a reason?</p>
              <div className="w-full space-y-2">
                {["Timing doesn't work", "Creative not a good fit", "Screen unavailable or under maintenance", "Double booking or scheduling conflict", "Other"].map(reason => (
                  <div key={reason} className="flex items-center space-x-2">
                    <Checkbox
                      className="border-[#333333]"
                      checked={selectedReasons.includes(reason)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedReasons(prev => [...prev, reason]);
                          setOtherReason(prev => {
                            if (prev.includes(reason + '. ')) return prev;
                            return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + reason + '. ';
                          });
                        } else {
                          setSelectedReasons(prev => prev.filter(r => r !== reason));
                          setOtherReason(prev => prev.replace(new RegExp(reason + '\\. ', 'g'), ''));
                        }
                      }}
                    />
                    <label style={{ color: '#333', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontWeight: 400, lineHeight: '114%' }}>{reason}</label>
                  </div>
                ))}
              </div>
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={150}
                placeholder="150 words"
                className="w-full h-20 p-2 border rounded resize-none"
                style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: 400, lineHeight: '114%' }}
              />
            </div>
            <DialogFooter className="justify-end">
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-[90px] h-[24px] rounded-[6.024px] bg-[#1D0BEB]" style={{ color: '#FFF', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontWeight: 700, lineHeight: '12px' }}>
                {isSubmitting ? <><Loader2 className="animate-spin mr-1 h-4 w-4" />Sending...</> : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isThankYouDialogOpen} onOpenChange={setIsThankYouDialogOpen}>
          <DialogContent style={{ width: '382px', height: '259px' }} className="p-6">
            <DialogHeader className="relative">
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              <Image src="/boohk-logo.png" alt="boohk logo" width={40.984} height={51.228} style={{ imageRendering: 'pixelated', }} />
              <h1 style={{ color: '#333', textAlign: 'center', fontFamily: 'Inter', fontSize: '22px', fontWeight: 700, lineHeight: '100%' }}>Thank you!</h1>
              <p style={{ color: '#333', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontWeight: 400, lineHeight: '114%' }}>You’ve chosen not to accept this campaign at this time. No worries! Your screen remains available for future opportunities. We’ll keep you posted when new requests come in.</p>
            </div>
            <DialogFooter className="justify-end">
              <Button onClick={() => setIsThankYouDialogOpen(false)} className="w-[90px] h-[24px] rounded-[6.024px] bg-[#1D0BEB]" style={{ color: '#FFF', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontWeight: 700, lineHeight: '12px' }}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {congratulationsBooking && (
          <BookingCongratulationsDialog
            open={isBookingCongratulationsOpen}
            onOpenChange={(open) => {
              setIsBookingCongratulationsOpen(open)
              if (!open) {
                setCongratulationsBooking(null)
              }
            }}
            booking={congratulationsBooking}
          />
        )}
        <SpotContentDialog
          open={isSpotDialogOpen}
          onOpenChange={setIsSpotDialogOpen}
          spot={selectedSpot}
        />
      </div>
    )
  } else {
    return spotsContent
  }
}
