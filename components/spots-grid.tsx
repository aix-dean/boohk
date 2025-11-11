import React, { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, getDoc, updateDoc, doc } from "firebase/firestore"
import type { Booking } from "@/lib/booking-service"
import { formatBookingDates } from "@/lib/booking-service"
import { createCMSContentDeployment } from "@/lib/cms-api"
import { useToast } from "@/hooks/use-toast"

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
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ url, className = "w-full h-full object-contain rounded-[10px]" }) => {
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [fallbackContent, setFallbackContent] = useState<React.JSX.Element | null>(null)

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
        controls
        autoPlay
        preload="metadata"
        className={className}
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


  const handleSpotClick = (spotNumber: number) => {
    if (productId) {
      router?.push(`/sales/products/${productId}/spots/${spotNumber}`)
    }
  }

  const handleAcceptBooking = async () => {
    if (!selectedBooking) return

    setIsAccepting(true)
    try {
      // Update booking to set for_screening = 1
      await updateDoc(doc(db, "booking", selectedBooking.id), {
        for_screening: 1,
        updated: new Date()
      })

      toast({
        title: "Booking accepted",
        description: "The booking has been accepted and is now for screening."
      })

      // Fetch product data for CMS API
      const productRef = doc(db, "products", productId!)
      const productSnap = await getDoc(productRef)
      const product: any = productSnap.exists() ? { id: productSnap.id, ...productSnap.data() } : null

      if (product) {
        // Call CMS API with booking and product data
        // Construct basic parameters - this may need adjustment based on actual CMS requirements
        const playerIds = product.playerIds
        const schedule = {
          startDate: selectedBooking.start_date?.toDate?.()?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          endDate: selectedBooking.end_date?.toDate?.()?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          plans: [{
            weekDays: [0,1,2,3,4,5,6], // All days
            startTime: "00:00",
            endTime: "23:59"
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
                duration: 9000,
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

        await createCMSContentDeployment(playerIds, schedule, pages)
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

  const spotsContent = (
    <div className="flex gap-[13.758px] overflow-x-scroll pb-4 w-full pr-4">
    {spots.map((spot) => (
      <div
        key={spot.id}
        className="relative flex-shrink-0 w-[110px] h-[197px] bg-white p-1.5 rounded-[14px] shadow-[-1px_3px_7px_-1px_rgba(0,0,0,0.25)] border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow flex flex-col"
        onClick={() => onSpotToggle ? onSpotToggle(spot.number) : handleSpotClick(spot.number)}
      >
        {onSpotToggle && (
          <div className="absolute top-1 left-1 z-10">
            <Checkbox
              checked={selectedSpots?.includes(spot.number) || false}
              onChange={() => onSpotToggle(spot.number)}
              className="bg-white border-2 border-gray-300"
            />
          </div>
        )}

        {/* Image Section */}
        <div className="flex-1 p-1 rounded-[10px] bg-white flex justify-center relative overflow-hidden">
          {spot.imageUrl ? (
            <>
              {console.log(`Rendering image for spot ${spot.number}:`, spot.imageUrl)}
              <Image
                src={spot.imageUrl}
                alt={`Spot ${spot.number} report image`}
                fill
                className="object-cover"
                onError={(e) => {
                  console.log(`Image failed to load for spot ${spot.number}:`, spot.imageUrl)
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    const fallback = document.createElement('span')
                    fallback.className = 'text-gray-400 text-xs'
                    fallback.textContent = `Spot ${spot.number}`
                    parent.appendChild(fallback)
                  }
                }}
              />
            </>
          ) : (
            <>
              {console.log(`No imageUrl for spot ${spot.number}`)}
              <span className="text-gray-400 text-xs">Spot {spot.number}</span>
            </>
          )}
        </div>

        {/* Content Section */}
        <div className="flex flex-col p-1 bg-white">
          {/* Spot Number */}
          <div className="text-[11px] font-semibold text-black">
            {spot.number}/{totalSpots}
          </div>

          {/* Status */}
          <div className={`text-[11px] font-semibold ${
            spot.status === "occupied" ? "text-[#00d0ff]" : "text-[#a1a1a1]"
          }`}>
            {spot.status === "occupied" ? "Occupied" : "Vacant"}
          </div>

          {/* Client Name */}
          <div className={`text-[11px] font-semibold truncate ${
            spot.status === "occupied" ? "text-black" : "text-[#a1a1a1]"
          }`}>
            {spot.clientName || "Filler Content 1"}
          </div>
        </div>
      </div>
    ))}
    </div>
  )

  if (bg) {
    return (
      <div className="space-y-4">
        {bookingRequests.length > 0 && (
          <>
            <div style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: '700', lineHeight: '100%' }}>Booking Requests</div>
            {/* Booking Requests Cards */}
            <div className="space-y-2 mb-4">
              {bookingRequests.map((booking) => {
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
                        <path d="M9 7V15L16 11L9 7ZM21 3H3C1.9 3 1 3.9 1 5V17C1 18.1 1.9 19 3 19H8V21H16V19H21C22.1 19 23 18.1 23 17V5C23 3.9 22.1 3 21 3ZM21 17H3V5H21V17Z" fill="#333333"/>
                      </svg>
                      <div className="flex flex-col">
                        <div style={{fontSize:'12px', fontWeight:700, lineHeight:'132%', color:'#333', fontFamily:'Inter'}}>BK#{booking.reservation_id || booking.id.slice(-8)}</div>
                        <div style={{fontSize:'12px', fontWeight:400, lineHeight:'132%', color:'#333', fontFamily:'Inter'}}>{formatBookingDates(booking.start_date, booking.end_date)}</div>
                        <div style={{fontSize:'12px', fontWeight:700, lineHeight:'132%', color:'#333', fontFamily:'Inter'}}>P{booking.total_cost?.toLocaleString() || booking.cost?.toLocaleString() || "0"}</div>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="2" r="1.5" fill="#333333"/>
                        <circle cx="8" cy="8" r="1.5" fill="#333333"/>
                        <circle cx="8" cy="14" r="1.5" fill="#333333"/>
                      </svg>
                    </div>
                  </div>
                )
              })}
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
                    <p className="text-sm">BK#{selectedBooking.reservation_id || selectedBooking.id.slice(-8)}</p>
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
              <Button variant="outline" className="w-[90px] h-[24px] px-[29px] rounded-[6px] border-[1.5px] border-[#C4C4C4] bg-white">Decline</Button>
              <Button onClick={handleAcceptBooking} disabled={isAccepting} className="w-[120px] h-[24px] rounded-[6.024px] bg-[#30C71D]">
                {isAccepting ? <><Loader2 className="animate-spin mr-1 h-4 w-4" />Accepting...</> : "Accept"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  } else {
    return spotsContent
  }
}
