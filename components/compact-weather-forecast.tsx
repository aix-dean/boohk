"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchWeatherForecast, getRegions, type PhilippineRegion, type WeatherForecast } from "@/lib/weather-service"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Cloud,
  CloudRain,
  CloudLightning,
  Sun,
  CloudSun,
  RefreshCw,
  CloudSnow,
  CloudFog,
  MapPin,
  Loader2,
  Wind,
  AlertTriangle,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function CompactWeatherForecast({ defaultRegion = "NCR" }: { defaultRegion?: string }) {
  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<PhilippineRegion[]>([])
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion)
  const [refreshing, setRefreshing] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastFetchTime, setLastFetchTime] = useState(0)

  // Fetch available regions
  useEffect(() => {
    async function loadRegions() {
      try {
        const regionsData = await getRegions()
        setRegions(regionsData)
      } catch (err) {
        console.error("Failed to load regions:", err)
        setError("Failed to load regions")
      }
    }

    loadRegions()
  }, [])

  // Fetch weather data
  useEffect(() => {
    let isMounted = true
    const now = Date.now()

    // Implement a simple rate limiting to avoid hitting the API too frequently
    // Only fetch if it's been at least 1 minute since the last fetch
    if (now - lastFetchTime < 60000 && retryCount > 0) {
      return
    }

    async function loadWeatherData() {
      try {
        setLoading(true)
        const data = await fetchWeatherForecast(selectedRegion)

        if (isMounted) {
          setWeather(data)
          setError(null)
          setLastFetchTime(Date.now())
        }
      } catch (err) {
        console.error("Error loading weather data:", err)

        if (isMounted) {
          // If we have previous weather data, keep showing it
          if (!weather) {
            setError("Failed to load weather data. Please try again later.")
          } else {
            // Show a warning but keep the old data
            setError("Could not update weather data. Showing last available data.")
          }
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
  }, [selectedRegion, retryCount])

  // Handle region change
  const handleRegionChange = (value: string) => {
    setSelectedRegion(value)
  }

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    setRetryCount((prev) => prev + 1)
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

  const isToday = (dateString: string) => {
    const today = new Date()
    const forecastDate = new Date(dateString)
    return (
      today.getDate() === forecastDate.getDate() &&
      today.getMonth() === forecastDate.getMonth() &&
      today.getFullYear() === forecastDate.getFullYear()
    )
  }

  if (loading && !weather) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            <span className="font-medium">{regions.find((r) => r.id === selectedRegion)?.name || selectedRegion}</span>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedRegion} onValueChange={handleRegionChange}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing || Date.now() - lastFetchTime < 60000}
              className="h-8 w-8"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </div>

        {error && !weather && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {error && weather && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {weather && weather.warning && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{weather.warning}</AlertDescription>
          </Alert>
        )}

        {weather ? (
          <div className="grid grid-cols-7 gap-2">
            {weather.forecast.map((day, index) => (
              <div
                key={index}
                className={`flex flex-col items-center p-2 rounded-lg text-center ${
                  isToday(day.date) ? "bg-primary/10 border border-primary/30 shadow-sm" : "bg-gray-50"
                }`}
              >
                <p className={`text-xs font-medium ${isToday(day.date) ? "text-primary" : ""}`}>
                  {day.dayOfWeek.substring(0, 3)}
                </p>
                <p className="text-[10px] text-gray-500">
                  {new Date(day.date).toLocaleDateString("en-US", { day: "numeric", month: "numeric" })}
                </p>
                <div className="my-1">{getWeatherIcon(day.icon, 24)}</div>
                <div className="flex gap-1 text-xs">
                  <span className="font-medium">{Math.round(day.temperature.max)}°</span>
                  <span className="text-gray-500">{Math.round(day.temperature.min)}°</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-600">
                  <Wind size={10} />
                  <span>{day.windSpeed} km/h</span>
                </div>
                <Badge variant="outline" className="mt-1 text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700">
                  {day.rainChance}%
                </Badge>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-gray-500">
            <CloudRain className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p>Weather data unavailable</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleRefresh}
              disabled={refreshing || Date.now() - lastFetchTime < 60000}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Try again
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
