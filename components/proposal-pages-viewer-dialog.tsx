"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import type { Proposal } from "@/lib/types/proposal"

const GoogleMap: React.FC<{ location: string; className?: string }> = ({ location, className }) => {
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

        geocoder.geocode({ address: location }, (results, status) => {
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
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}

interface ProposalPagesViewerDialogProps {
  proposal: Proposal | null
  isOpen: boolean
  onClose: () => void
}

export function ProposalPagesViewerDialog({ proposal, isOpen, onClose }: ProposalPagesViewerDialogProps) {
  const [currentPage, setCurrentPage] = useState(1)

  if (!proposal) return null

  const totalPages = Math.max(1, proposal.products?.length || 0)

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleClose = () => {
    setCurrentPage(1)
    onClose()
  }

  const currentProduct = proposal.products?.[currentPage - 1]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div className="space-y-1">
            <div className="text-sm text-gray-500 font-medium">
              {proposal.proposalNumber || proposal.id?.slice(0, 8).toUpperCase()}
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">{proposal.client?.company || "Client Name"}</h2>
            <div className="text-sm text-gray-500">{format(proposal.createdAt, "MMMM d, yyyy")}</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 min-h-[500px]">
          <div className="relative w-full max-w-3xl">
            {/* Document Pages Stack */}
            <div className="relative">
              {/* Background pages for subtle stack effect */}
              <div
                className="absolute inset-0 bg-gray-200 rounded-sm transform translate-x-2 translate-y-2"
                style={{ height: "450px" }}
              />
              <div
                className="absolute inset-0 bg-gray-300 rounded-sm transform translate-x-1 translate-y-1"
                style={{ height: "450px" }}
              />

              <div className="relative bg-white rounded-sm shadow-lg border" style={{ height: "450px" }}>
                <div className="h-full p-6 flex flex-col relative overflow-hidden">
                  {currentProduct ? (
                    <>
                      {/* Product header */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {currentProduct.name || currentProduct.site_code}
                        </h3>
                        <div className="h-px bg-gray-200 w-full" />
                      </div>

                      {/* Product content layout matching main page */}
                      <div className="flex-1 flex gap-4">
                        {/* Product image */}
                        <div className="flex-shrink-0">
                          <div className="w-40 h-48 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                            {currentProduct.media && currentProduct.media.length > 0 ? (
                              <img
                                src={currentProduct.media[0].url || "/placeholder.svg"}
                                alt={currentProduct.name || "Product image"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="text-gray-400 h-10 w-10" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Product details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 mb-2">Location Map:</h4>

                          {/* Location map */}
                          {currentProduct.specs_rental?.location ? (
                            <GoogleMap
                              location={currentProduct.specs_rental.location}
                              className="w-full h-28 rounded-lg mb-3"
                            />
                          ) : (
                            <div className="w-full h-28 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                              <p className="text-gray-500 text-sm">Location not specified</p>
                            </div>
                          )}

                          {/* Product specifications */}
                          <div className="space-y-2 text-sm text-gray-800">
                            {currentProduct.specs_rental?.location && (
                              <p>
                                <span className="font-semibold">Location:</span> {currentProduct.specs_rental.location}
                              </p>
                            )}
                            {currentProduct.specs_rental?.traffic_count && (
                              <p>
                                <span className="font-semibold">Traffic Count:</span>{" "}
                                {currentProduct.specs_rental.traffic_count.toLocaleString()} vehicles
                              </p>
                            )}
                            {currentProduct.specs_rental?.elevation !== undefined && (
                              <p>
                                <span className="font-semibold">Visibility:</span>{" "}
                                {currentProduct.specs_rental.elevation} meters
                              </p>
                            )}
                            {currentProduct.specs_rental?.height && currentProduct.specs_rental?.width && (
                              <p>
                                <span className="font-semibold">Dimension:</span> {currentProduct.specs_rental.height}ft
                                x {currentProduct.specs_rental.width}ft
                              </p>
                            )}
                            <p>
                              <span className="font-semibold">Type:</span> {currentProduct.type || "Advertising Space"}
                            </p>
                            {currentProduct.description && (
                              <p>
                                <span className="font-semibold">Description:</span> {currentProduct.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-gray-500">No product data available</p>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-4 right-4">
                  <div className="bg-gray-700 text-white text-xs px-3 py-1 rounded shadow-sm font-medium">
                    Page {currentPage}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-2 left-0 right-2 h-4 bg-gray-200 rounded-sm" />
          </div>

          {/* Navigation controls */}
          <div className="flex items-center gap-6 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={currentPage === 1}
              className="h-9 w-9 p-0 rounded-full border-gray-300 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm text-gray-600 min-w-[100px] text-center font-medium">
              {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="h-9 w-9 p-0 rounded-full border-gray-300 bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
