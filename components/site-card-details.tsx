"use client"

import React, { useState, useEffect, useRef } from "react"
import { Maximize, Calendar, Loader2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { loadGoogleMaps } from "@/lib/google-maps-loader"

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
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
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
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
});

interface SiteCardDetailsProps {
  product: any
  activeImageIndex: number
  setActiveImageIndex: (index: number) => void
  setImageViewerOpen: (open: boolean) => void
  handleCalendarOpen: () => void
  companyLoading: boolean
  companyName: string
}

export default function SiteCardDetails({
  product,
  activeImageIndex,
  setActiveImageIndex,
  setImageViewerOpen,
  handleCalendarOpen,
  companyLoading,
  companyName,
}: SiteCardDetailsProps) {
  return (
    <Card className="bg-transparent border-none shadow-none">
      <CardContent className="p-0">
        {/* Site Image and Map */}
        <div className="flex">
          {/* Site Image */}
          <div className="relative flex-1 aspect-square overflow-hidden">
            {product?.media && product.media.length > 0 ? (
              <>
                <Image
                  src={product.media[activeImageIndex]?.url || "/placeholder.svg"}
                  alt={product.name || "Site image"}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/building-billboard.png"
                    target.className = "object-cover opacity-50"
                  }}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-md rounded-full"
                  onClick={() => {
                    setActiveImageIndex(0)
                    setImageViewerOpen(true)
                  }}
                  aria-label="View image gallery"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <Image
                  src="/building-billboard.png"
                  alt="Site placeholder"
                  fill
                  className="object-cover opacity-50"
                />
              </div>
            )}
          </div>

          {/* Map View */}
          {(product?.type?.toLowerCase() === "rental" ? product.specs_rental?.location : product.light?.location) && (
            <div className="flex-1 aspect-square overflow-hidden">
              <GoogleMap
                location={product?.type?.toLowerCase() === "rental" ? product.specs_rental.location : product.light.location}
                className="w-full h-full"
              />
            </div>
          )}
        </div>

        {/* Site Calendar Button */}
        <div className="mt-2">
          <Button
            variant="outline"
            className="w-full border-solid"
            onClick={handleCalendarOpen}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Site Calendar
          </Button>
        </div>



        {/* Site Details */}
        <div className="p-4 space-y-3">
          {/* Site Name */}
          <div>
            <div className="text-sm text-gray-900 mb-1">Site</div>
            <div className="text-base font-bold text-gray-900">
              {product?.name || "Not Set Site"}
            </div>
          </div>
          {/* Location */}
          <div>
            <div className="text-sm text-gray-900 mb-1">Location</div>
            <div className="text-base font-bold text-gray-800">
              {product?.type?.toLowerCase() === "rental"
                ? product.specs_rental?.location || "Not Set"
                : product.light?.location || "Not Set"}
            </div>
          </div>
          {/* Geopoint */}
          <div>
            <div className="text-sm text-gray-900 mb-1">Geopoint</div>
            <div className="text-base font-bold text-gray-800">
              {product?.specs_rental?.geopoint ? `${product.specs_rental.geopoint[0]}, ${product.specs_rental.geopoint[1]}` : "Not Set"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-900">Type</div>
              <div className="text-base font-bold text-gray-800">
                {Array.isArray(product?.categories) ? (product.categories.length > 0 ? product.categories.join(', ') : "Not Set") : (product?.categories ? product.categories : "Not Set")}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-900">Orientation</div>
              <div className="text-base font-bold text-gray-800">{product?.specs_rental?.land_owner || "Not specified"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-900">Dimension</div>
              <div className="text-base font-bold text-gray-800">
                {product?.specs_rental?.height ? `${product.specs_rental.height} (H) x ${product.specs_rental.width || 'N/A'} (W)` : "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-900">Elevation</div>
              <div className="text-base font-bold text-gray-800">
                {product?.specs_rental?.elevation || "Not specified"}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Average Daily Traffic</div>
            <div className="text-base font-bold text-gray-800">
              {product?.specs_rental?.traffic_count || "Not specified"}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Site Orientation</div>
            <div className="text-base font-bold text-gray-800">{product?.specs_rental?.orientation || "Not specified"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Site Owner</div>
            <div className="text-base font-bold text-gray-800">
              {companyLoading ? "Loading..." : companyName || "Not Set"}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Land Owner</div>
            <div className="text-base font-bold text-gray-800">{product?.specs_rental?.land_owner || "Not specified"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-900">Partner</div>
            <div className="text-base font-bold text-gray-800">{product?.specs_rental?.partner || "Not specified"}</div>
          </div>
            <div>
            <div className="text-sm text-gray-900">Location Visibility: </div>
            <div className="text-base font-bold text-gray-800">{product?.specs_rental?.location_visibility || "Not specified"} {product?.specs_rental?.location_visibility_unit || "Not specified"}</div>
          </div>
        </div>


      </CardContent>
    </Card>
  )
}