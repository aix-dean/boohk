"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MapPin, Loader2 } from "lucide-react"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import { GeoPoint } from "firebase/firestore"

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onGeopointChange?: (geopoint: GeoPoint | null) => void
  placeholder?: string
  className?: string
  enableMap?: boolean
  mapHeight?: string
}

interface GooglePlaceResult {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onGeopointChange,
  placeholder = "Enter location...",
  className,
  enableMap = false,
  mapHeight = "200px",
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [suggestions, setSuggestions] = useState<GooglePlaceResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false)
  const [autocompleteService, setAutocompleteService] = useState<any>(null)
  const [placesService, setPlacesService] = useState<any>(null)
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)
  const [mapsConfig, setMapsConfig] = useState<{ apiKey: string; mapId?: string } | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load Google Maps
  useEffect(() => {
    if (enableMap) {
      loadGoogleMaps()
        .then((config) => {
          setMapsConfig(config)
          setGoogleMapsLoaded(true)
          if (window.google && window.google.maps) {
            const autoCompleteService = new window.google.maps.places.AutocompleteService()
            const placesService = new window.google.maps.places.PlacesService(document.createElement('div'))
            setAutocompleteService(autoCompleteService)
            setPlacesService(placesService)
          }
        })
        .catch((error) => {
          console.error("Failed to load Google Maps:", error)
        })
    }
  }, [enableMap])

  // Initialize map when enabled
  useEffect(() => {
    if (enableMap && googleMapsLoaded && mapsConfig && mapRef.current && window.google) {
      const mapOptions: google.maps.MapOptions = {
        center: { lat: 14.5995, lng: 120.9842 }, // Manila coordinates
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }

      if (mapsConfig.mapId) {
        mapOptions.mapId = mapsConfig.mapId
      }

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions)
      setMap(newMap)

      // Add marker
      const newMarker = new window.google.maps.Marker({
        position: mapOptions.center,
        map: newMap,
        draggable: true,
      })
      setMarker(newMarker)

      // Update location when marker is dragged
      newMarker.addListener('dragend', (event: any) => {
        const lat = event.latLng.lat()
        const lng = event.latLng.lng()
        if (onGeopointChange) {
          onGeopointChange(new GeoPoint(lat, lng))
        }
        // Reverse geocode to get address
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            onChange(results[0].formatted_address)
          }
        })
      })
    }
  }, [enableMap, googleMapsLoaded, mapsConfig, onChange, onGeopointChange])

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || !autocompleteService) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const request = {
        input: query,
        componentRestrictions: { country: 'ph' },
        fields: ['place_id', 'description', 'structured_formatting'],
      }

      autocompleteService.getPlacePredictions(request, (predictions: GooglePlaceResult[] | null, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions)
        } else {
          setSuggestions([])
        }
        setIsLoading(false)
      })
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
      setSuggestions([])
      setIsLoading(false)
    }
  }, [autocompleteService])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setShowSuggestions(true)

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  const handleSuggestionClick = (suggestion: GooglePlaceResult) => {
    const address = suggestion.description

    // Update the value first
    onChange(address)

    // Get place details to get coordinates
    if (placesService && onGeopointChange) {
      const request = {
        placeId: suggestion.place_id,
        fields: ['geometry'],
      }

      placesService.getDetails(request, (place: any, status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          onGeopointChange(new GeoPoint(lat, lng))

          // Update map marker if map is enabled
          if (map && marker) {
            const newPosition = { lat, lng }
            marker.setPosition(newPosition)
            map.setCenter(newPosition)
            map.setZoom(15)
          }
        }
      })
    }

    // Hide suggestions after a small delay to allow parent component state to update
    setTimeout(() => {
      setShowSuggestions(false)
      setSuggestions([])
    }, 100)

    // Use requestAnimationFrame for better React rendering cycle integration
    // Wait for parent component to update the value prop before focusing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          // Set cursor position at the end of the address
          inputRef.current.setSelectionRange(address.length, address.length)
        }
      })
    })
  }

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding to allow click on suggestions
    setTimeout(() => {
      setShowSuggestions(false)
      setSuggestions([])
    }, 150)
  }

  return (
    <div className="space-y-3">
      <div className={cn("relative", className)}>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          className="pr-10"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="absolute right-8 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 bg-background border border-input rounded-md shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.place_id}
                  className="px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSuggestionClick(suggestion)
                  }}
                >
                  {suggestion.description}
                </div>
              ))}
            </div>
          )}
      </div>

      {enableMap && (
        <div className="space-y-2">
          <div
            ref={mapRef}
            className="w-full rounded-md border bg-gray-100"
            style={{ height: mapHeight }}
          >
            {!googleMapsLoaded && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Loading Google Maps...</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            
          </p>
        </div>
      )}
    </div>
  )
}
