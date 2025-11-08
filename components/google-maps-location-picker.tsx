"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Map, Search, MapPin, Loader2 } from "lucide-react"
import { loadGoogleMaps } from "@/lib/google-maps-loader"

interface Location {
  lat: number
  lng: number
  address: string
  placeId?: string
}

interface GoogleMapsLocationPickerProps {
  onLocationSelect: (location: Location) => void
  currentLocation?: Location | null
  children: React.ReactNode
  inline?: boolean
}

declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

export function GoogleMapsLocationPicker({
  onLocationSelect,
  currentLocation,
  children,
  inline = false,
}: GoogleMapsLocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(currentLocation || null)
  const [searchResults, setSearchResults] = useState<Location[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Initialize Google Maps
  const initializeMap = useCallback(async () => {
    if (!window.google || !mapRef.current) return

    const { Map } = window.google.maps
    const { Marker } = window.google.maps
    const { places } = window.google.maps

    // Default to Manila, Philippines
    const defaultCenter = currentLocation || { lat: 14.5995, lng: 120.9842 }

    // Create map
    mapInstanceRef.current = new Map(mapRef.current, {
      center: defaultCenter,
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })

    // Create marker
    markerRef.current = new Marker({
      position: defaultCenter,
      map: mapInstanceRef.current,
      draggable: true,
      title: "Selected Location",
    })

    // Handle marker drag
    markerRef.current.addListener("dragend", async () => {
      const position = markerRef.current.getPosition()
      const location = {
        lat: position.lat(),
        lng: position.lng(),
        address: "Custom Location",
      }

      // Try to get address from coordinates
      try {
        const geocoder = new window.google.maps.Geocoder()
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ location: position }, (results: any, status: any) => {
            if (status === "OK" && results[0]) {
              resolve(results[0])
            } else {
              reject(status)
            }
          })
        })

        location.address = (result as any).formatted_address
      } catch (error) {
        console.warn("Could not get address for coordinates:", error)
      }

      setSelectedLocation(location)

      if (inline) {
        onLocationSelect(location)
      }
    })

    // Handle map click
    mapInstanceRef.current.addListener("click", async (event: any) => {
      const location = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        address: "Custom Location",
      }

      // Update marker position
      markerRef.current.setPosition(event.latLng)

      // Try to get address from coordinates
      try {
        const geocoder = new window.google.maps.Geocoder()
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ location: event.latLng }, (results: any, status: any) => {
            if (status === "OK" && results[0]) {
              resolve(results[0])
            } else {
              reject(status)
            }
          })
        })

        location.address = (result as any).formatted_address
      } catch (error) {
        console.warn("Could not get address for coordinates:", error)
      }

      setSelectedLocation(location)

      if (inline) {
        onLocationSelect(location)
      }
    })

    // Initialize autocomplete for search
    if (searchInputRef.current) {
      autocompleteRef.current = new places.Autocomplete(searchInputRef.current, {
        componentRestrictions: { country: "ph" }, // Restrict to Philippines
        fields: ["place_id", "geometry", "name", "formatted_address"],
      })

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace()
        if (place.geometry && place.geometry.location) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || place.name,
            placeId: place.place_id,
          }

          // Update map and marker
          mapInstanceRef.current.setCenter(place.geometry.location)
          mapInstanceRef.current.setZoom(15)
          markerRef.current.setPosition(place.geometry.location)

          setSelectedLocation(location)

          if (inline) {
            onLocationSelect(location)
          }
        }
      })
    }
  }, [currentLocation])

  // Load Google Maps script
  useEffect(() => {
    if (!inline && !isOpen) return

    const initializeMaps = async () => {
      try {
        setIsLoading(true)
        await loadGoogleMaps()
        await initializeMap()
        setIsLoading(false)
      } catch (error) {
        console.error("Failed to load Google Maps:", error)
        setIsLoading(false)
      }
    }

    initializeMaps()
  }, [inline, isOpen, initializeMap])

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim() || !window.google) return

    setIsSearching(true)
    try {
      const service = new window.google.maps.places.PlacesService(mapInstanceRef.current)

      const request = {
        query: searchQuery,
        fields: ["place_id", "geometry", "name", "formatted_address"],
        locationBias: { lat: 14.5995, lng: 120.9842 }, // Bias towards Philippines
      }

      service.textSearch(request, (results: any, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          const locations = results.slice(0, 5).map((place: any) => ({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address || place.name,
            placeId: place.place_id,
          }))
          setSearchResults(locations)
        }
        setIsSearching(false)
      })
    } catch (error) {
      console.error("Search error:", error)
      setIsSearching(false)
    }
  }

  // Handle search result selection
  const handleSearchResultSelect = (location: Location) => {
    if (mapInstanceRef.current && markerRef.current) {
      const position = new window.google.maps.LatLng(location.lat, location.lng)
      mapInstanceRef.current.setCenter(position)
      mapInstanceRef.current.setZoom(15)
      markerRef.current.setPosition(position)
    }
    setSelectedLocation(location)
    setSearchResults([])
    setSearchQuery("")

    if (inline) {
      onLocationSelect(location)
    }
  }

  // Handle location confirmation
  const handleConfirmLocation = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation)
      setIsOpen(false)
    }
  }

  if (inline) {
    return (
      <div className="relative">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            {children}
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-4 space-y-2">
              {/* Search Section */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={searchInputRef}
                    placeholder="Search address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="h-8"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} size="sm">
                  {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
                      onClick={() => handleSearchResultSelect(result)}
                    >
                      <span className="truncate">{result.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Select Location on Map
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 h-[70vh]">
          {/* Search Section */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={searchInputRef}
                  placeholder="Search for a location in Philippines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="max-h-32 overflow-y-auto border rounded-md">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
                    onClick={() => handleSearchResultSelect(result)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{result.address}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="flex-1 relative border rounded-lg overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading map...</span>
                </div>
              </div>
            )}
            <div ref={mapRef} className="w-full h-full min-h-[400px]" />
          </div>

          {/* Selected Location Info */}
          {selectedLocation && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">Selected Location</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{selectedLocation.address}</p>
              <div className="flex gap-4 text-xs text-gray-500">
                <Badge variant="outline">Lat: {selectedLocation.lat.toFixed(6)}</Badge>
                <Badge variant="outline">Lng: {selectedLocation.lng.toFixed(6)}</Badge>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmLocation} disabled={!selectedLocation}>
              Use This Location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
