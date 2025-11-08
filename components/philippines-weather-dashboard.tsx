"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Cloud,
  CloudRain,
  CloudLightning,
  Sun,
  CloudSun,
  Droplets,
  Wind,
  AlertTriangle,
  RefreshCw,
  Thermometer,
  Eye,
  MapPin,
  Calendar,
  CloudSnow,
  CloudFog,
} from "lucide-react"
import type { PhilippinesWeatherData } from "@/lib/accuweather-service"
import { FloodMap } from "@/components/flood-map"
import { EnhancedLocationSelector } from "@/components/enhanced-location-selector"

interface CustomLocation {
  lat: number
  lng: number
  address: string
  placeId?: string
}

export function PhilippinesWeatherDashboard({ defaultLocation = "264885" }: { defaultLocation?: string }) {
  const [weather, setWeather] = useState<PhilippinesWeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState("custom")
  const [customLocation, setCustomLocation] = useState<CustomLocation | null>({
    lat: 14.5995,
    lng: 120.9842,
    address: "Manila, Metro Manila, Philippines",
  })
  const [refreshing, setRefreshing] = useState(false)

  // Fetch weather data
  useEffect(() => {
    let isMounted = true

    async function loadWeatherData() {
      if (!customLocation) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const apiUrl = `/api/accuweather?lat=${customLocation.lat}&lng=${customLocation.lng}&address=${encodeURIComponent(customLocation.address)}`

        const response = await fetch(apiUrl)

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()

        if (isMounted) {
          setWeather(data)
          setError(null)
        }
      } catch (err) {
        console.error("Error loading weather data:", err)

        if (isMounted) {
          setError("Failed to load weather data from AccuWeather. Please try again later.")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadWeatherData()

    return () => {
      isMounted = false
    }
  }, [customLocation])

  const handleLocationChange = (locationKey: string, customLoc?: CustomLocation) => {
    setSelectedLocation(locationKey)
    if (locationKey === "custom" && customLoc) {
      setCustomLocation(customLoc)
    }
  }

  // Handle refresh
  const handleRefresh = async () => {
    if (!customLocation) return

    setRefreshing(true)
    try {
      const apiUrl = `/api/accuweather?lat=${customLocation.lat}&lng=${customLocation.lng}&address=${encodeURIComponent(customLocation.address)}`

      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      setWeather(data)
      setError(null)
    } catch (err) {
      setError("Failed to refresh weather data")
      console.error(err)
    } finally {
      setRefreshing(false)
    }
  }

  const getWeatherIcon = (iconName: string, size = 24) => {
    switch (iconName) {
      case "sun":
        return <Sun size={size} className="text-yellow-500" />
      case "cloud-sun":
        return <CloudSun size={size} className="text-gray-500" />
      case "cloud":
        return <Cloud size={size} className="text-gray-500" />
      case "cloud-rain":
        return <CloudRain size={size} className="text-blue-500" />
      case "cloud-lightning":
        return <CloudLightning size={size} className="text-purple-500" />
      case "cloud-snow":
        return <CloudSnow size={size} className="text-blue-300" />
      case "cloud-fog":
        return <CloudFog size={size} className="text-gray-400" />
      default:
        return <Cloud size={size} className="text-gray-500" />
    }
  }

  const getSeverityColor = (priority: number) => {
    if (priority >= 8) return "bg-red-100 text-red-800 border-red-200"
    if (priority >= 6) return "bg-orange-100 text-orange-800 border-orange-200"
    if (priority >= 4) return "bg-yellow-100 text-yellow-800 border-yellow-200"
    return "bg-blue-100 text-blue-800 border-blue-200"
  }

  if (!customLocation && !loading) {
    return (
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Philippines Weather</h1>
            <p className="text-sm text-gray-500">Powered by AccuWeather</p>
          </div>

          <div className="flex items-center gap-2">
            <EnhancedLocationSelector onLocationChange={handleLocationChange} customLocation={customLocation} />
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Location</h3>
            <p className="text-gray-500 text-center">
              Click "Select Location" to choose a location on the map and view weather information.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading && !weather) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Philippines Weather</h1>
          <p className="text-sm text-gray-500">Powered by AccuWeather</p>
        </div>

        <div className="flex items-center gap-2">
          <EnhancedLocationSelector onLocationChange={handleLocationChange} customLocation={customLocation} />

          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {weather && (
        <>
          {/* 5-Day Forecast */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                5-Day Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {weather.forecast.map((day, index) => (
                  <div key={index} className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-medium text-sm">{day.dayOfWeek}</p>
                    <p className="text-xs text-gray-500 mb-2">
                      {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>

                    {/* Day Weather */}
                    <div className="flex flex-col items-center mb-2">
                      <div className="mb-1">{getWeatherIcon(day.day.icon, 32)}</div>
                      <p className="text-xs text-center text-gray-600">{day.day.condition}</p>
                      {day.day.precipitation && (
                        <Badge variant="outline" className="text-xs mt-1 bg-blue-50 text-blue-700">
                          Rain
                        </Badge>
                      )}
                    </div>

                    {/* Temperature */}
                    <div className="flex gap-2 text-sm">
                      <span className="font-semibold">{day.temperature.max}°</span>
                      <span className="text-gray-500">{day.temperature.min}°</span>
                    </div>

                    {/* Night conditions */}
                    <div className="flex flex-col items-center mt-2 pt-2 border-t border-gray-200">
                      <div className="mb-1">{getWeatherIcon(day.night.icon, 20)}</div>
                      <p className="text-xs text-center text-gray-500">Night: {day.night.condition}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Weather Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>{weather.location}</CardTitle>
              </div>
              <CardDescription>
                Current conditions • Last updated: {new Date(weather.current.lastUpdated).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Main Weather Display */}
                <div className="flex items-center gap-6">
                  <div className="text-6xl">{getWeatherIcon(weather.current.icon, 80)}</div>
                  <div>
                    <div className="text-5xl font-bold">{weather.current.temperature}°C</div>
                    <div className="text-lg text-gray-600 capitalize">{weather.current.condition}</div>
                    <div className="text-sm text-gray-500">Feels like {weather.current.feelsLike}°C</div>
                    <Badge variant={weather.current.isDayTime ? "default" : "secondary"} className="mt-2">
                      {weather.current.isDayTime ? "Day" : "Night"}
                    </Badge>
                  </div>
                </div>

                <Separator orientation="vertical" className="hidden lg:block" />

                {/* Weather Details Grid */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <Droplets className="h-5 w-5 text-blue-500 mb-1" />
                    <span className="text-sm text-gray-500">Humidity</span>
                    <span className="font-semibold">{weather.current.humidity}%</span>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <Wind className="h-5 w-5 text-gray-500 mb-1" />
                    <span className="text-sm text-gray-500">Wind</span>
                    <span className="font-semibold">{weather.current.windSpeed} km/h</span>
                    <span className="text-xs text-gray-400">{weather.current.windDirection}</span>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <Sun className="h-5 w-5 text-yellow-500 mb-1" />
                    <span className="text-sm text-gray-500">UV Index</span>
                    <span className="font-semibold">{weather.current.uvIndex}</span>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <Eye className="h-5 w-5 text-gray-500 mb-1" />
                    <span className="text-sm text-gray-500">Visibility</span>
                    <span className="font-semibold">{weather.current.visibility} km</span>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <Cloud className="h-5 w-5 text-gray-500 mb-1" />
                    <span className="text-sm text-gray-500">Cloud Cover</span>
                    <span className="font-semibold">{weather.current.cloudCover}%</span>
                  </div>

                  <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <Thermometer className="h-5 w-5 text-red-500 mb-1" />
                    <span className="text-sm text-gray-500">Feels Like</span>
                    <span className="font-semibold">{weather.current.feelsLike}°C</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Flood Map */}
          <FloodMap locationKey={customLocation ? `${customLocation.lat},${customLocation.lng}` : selectedLocation} />

          {/* Weather Alerts */}
          {weather.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Weather Alerts
                </CardTitle>
                <CardDescription>Active weather warnings and advisories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weather.alerts.map((alert) => (
                    <Alert key={alert.id} className={getSeverityColor(alert.priority)}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center gap-2">
                        {alert.type}
                        <Badge variant="outline" className={`${getSeverityColor(alert.priority)} border`}>
                          {alert.level}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription>
                        <p>{alert.description}</p>
                        <p className="text-xs mt-1">
                          Area: {alert.area} • Category: {alert.category}
                        </p>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
