"use client"

import React, { useEffect, useRef, useState } from "react"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import { Loader2 } from "lucide-react"

const GoogleMap = React.memo(({ location, geopoint, className }: { location: string; geopoint?: { latitude: number; longitude: number }; className?: string }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const initializeMaps = async () => {
      try {
        const config = await loadGoogleMaps()
        await initializeMap(config)
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        setMapError(true)
      }
    }

    const initializeMap = async (config: { apiKey: string; mapId?: string }) => {
      if (!mapRef.current || !window.google) return

      try {
        let center: google.maps.LatLngLiteral
        if (geopoint) {
          center = { lat: geopoint.latitude, lng: geopoint.longitude }
        } else {
          const geocoder = new window.google.maps.Geocoder()
          const geocodePromise = new Promise<{ results: google.maps.GeocoderResult[] | null; status: google.maps.GeocoderStatus }>((resolve) => {
            geocoder.geocode({ address: location }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
              resolve({ results, status })
            })
          })
          const { results, status } = await geocodePromise

          if (status !== "OK" || !results || !results[0]) {
            console.error("Geocoding failed:", status)
            setMapError(true)
            return
          }
          center = { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() }
        }

        const mapOptions: google.maps.MapOptions = {
          center,
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
        }

        if (config.mapId) {
          mapOptions.mapId = config.mapId
        }

        const map = new window.google.maps.Map(mapRef.current!, mapOptions)

        // Trigger resize to ensure map fills container properly
        window.google.maps.event.trigger(map, 'resize')
      
        // Override Google Maps default borders and padding
        mapRef.current!.style.border = 'none'
        mapRef.current!.style.padding = '0'
        mapRef.current!.style.margin = '0'

        // Add marker
        const markerElement = document.createElement('img')
        markerElement.src = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
          </svg>
        `)
        markerElement.style.width = '32px'
        markerElement.style.height = '32px'

        new window.google.maps.marker.AdvancedMarkerElement({
          map: map,
          position: center,
          title: location,
          content: markerElement,
        })

        setMapLoaded(true)
        setMapCenter(center)
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError(true)
      }
    }

    initializeMaps()
  }, [location, geopoint])

  const getMapUrl = () => {
    if (mapCenter) {
      return `https://www.google.com/maps/search/?api=1&query=${mapCenter.lat},${mapCenter.lng}`
    }
    if (geopoint) {
      return `https://www.google.com/maps/search/?api=1&query=${geopoint.latitude},${geopoint.longitude}`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
  }

  if (mapError) {
    return (
      <a
        href={getMapUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
      >
        <div className="text-center text-gray-500">
          <p className="text-sm">Map unavailable</p>
          <p className="text-xs mt-1">{location}</p>
        </div>
      </a>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full border-none" />
      <a
        href={getMapUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10"
      />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center border-none z-5">
          <div className="text-center border-none">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
})

export { GoogleMap }