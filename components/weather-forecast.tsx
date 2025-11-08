"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { fetchWeatherForecast, getRegions, type PhilippineRegion, type WeatherForecast } from "@/lib/weather-service"
import { Skeleton } from "@/components/ui/skeleton"
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
  CloudSnow,
  CloudFog,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function WeatherForecast({ defaultRegion = "NCR" }: { defaultRegion?: string }) {
  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<PhilippineRegion[]>([])
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion)
  const [refreshing, setRefreshing] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)

  // Fetch available regions
  useEffect(() => {
    async function loadRegions() {
      try {
        const regionsData = await getRegions()
        setRegions(regionsData)
      } catch (err) {
        console.error("Failed to load regions:", err)
        setError("Failed to load regions. Please try again later.")
      }
    }

    loadRegions()
  }, [])

  // Fetch weather data
  useEffect(() => {
    let isMounted = true

    async function loadWeatherData() {
      try {
        setLoading(true)
        const data = await fetchWeatherForecast(selectedRegion)

        if (isMounted) {
          setWeather(data)
          setError(null)
        }
      } catch (err) {
        console.error("Error loading weather data:", err)

        if (isMounted) {
          setError("Failed to load weather data. The service may be temporarily unavailable.")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadWeatherData()

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false
    }
  }, [selectedRegion])

  // Handle region change
  const handleRegionChange = (value: string) => {
    setSelectedRegion(value)
  }

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await fetchWeatherForecast(selectedRegion)
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "moderate":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "severe":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (loading && !weather) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle>Weather Forecast</CardTitle>
            <CardDescription>Weather Data for Philippines</CardDescription>
            {weather && (
              <p className="text-sm font-medium mt-1">
                Selected Region: {regions.find((r) => r.id === selectedRegion)?.name || selectedRegion}
              </p>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <Select value={selectedRegion} onValueChange={handleRegionChange}>
              <SelectTrigger className="w-[180px]">
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

            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing || loading}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {weather && (
          <div className="space-y-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                <span className="font-medium">
                  {regions.find((r) => r.id === selectedRegion)?.name || weather.location}
                </span>{" "}
                • Last updated: {new Date(weather.date).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">Source: {weather.source}</p>
            </div>

            {/* Current Weather Section */}
            <div className="flex flex-col md:flex-row gap-4 items-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{getWeatherIcon(weather.icon, 64)}</div>
                <div>
                  <h3 className="text-4xl font-bold">{Math.round(weather.temperature.current)}°C</h3>
                  <p className="text-lg capitalize">{weather.condition}</p>
                  <p className="text-sm text-gray-500">Feels like {Math.round(weather.temperature.feels_like)}°C</p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 md:mt-0">
                <div className="flex flex-col items-center p-2 bg-white rounded-md shadow-sm">
                  <span className="text-sm text-gray-500">Min/Max</span>
                  <div className="flex items-center gap-1">
                    <Thermometer className="h-4 w-4 text-blue-500" />
                    <span>{Math.round(weather.temperature.min)}°</span>
                    <span>/</span>
                    <span>{Math.round(weather.temperature.max)}°</span>
                  </div>
                </div>

                <div className="flex flex-col items-center p-2 bg-white rounded-md shadow-sm">
                  <span className="text-sm text-gray-500">Humidity</span>
                  <div className="flex items-center gap-1">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span>{weather.humidity}%</span>
                  </div>
                </div>

                <div className="flex flex-col items-center p-2 bg-white rounded-md shadow-sm">
                  <span className="text-sm text-gray-500">Wind</span>
                  <div className="flex items-center gap-1">
                    <Wind className="h-4 w-4 text-gray-500" />
                    <span>
                      {Math.round(weather.windSpeed)} km/h {weather.windDirection}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center p-2 bg-white rounded-md shadow-sm">
                  <span className="text-sm text-gray-500">Rain Chance</span>
                  <div className="flex items-center gap-1">
                    <CloudRain className="h-4 w-4 text-blue-500" />
                    <span>{weather.rainChance}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Forecast Section */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">7-Day Forecast</h3>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {weather.forecast.map((day, index) => (
                  <div key={index} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">{day.dayOfWeek}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <div className="my-2">{getWeatherIcon(day.icon, 36)}</div>
                    <p className="text-sm capitalize">{day.condition}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-sm font-medium">{Math.round(day.temperature.max)}°</span>
                      <span className="text-sm text-gray-500">{Math.round(day.temperature.min)}°</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <CloudRain className="h-3 w-3 text-blue-500" />
                      <span className="text-xs">{day.rainChance}%</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Wind className="h-3 w-3 text-gray-500" />
                      <span className="text-xs">{Math.round(day.windSpeed)} km/h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weather Alerts Section */}
            {weather.alerts.length > 0 && (
              <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen} className="mt-6 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Weather Alerts</h3>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {alertsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="sr-only">Toggle alerts</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="mt-2 space-y-3">
                  {weather.alerts.map((alert, index) => (
                    <Alert key={index} className={getSeverityColor(alert.severity)}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center gap-2">
                        {alert.type}
                        <Badge variant="outline" className={`${getSeverityColor(alert.severity)} border`}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription>
                        <p>{alert.description}</p>
                        <p className="text-xs mt-1">Issued: {new Date(alert.issuedAt).toLocaleString()}</p>
                      </AlertDescription>
                    </Alert>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
