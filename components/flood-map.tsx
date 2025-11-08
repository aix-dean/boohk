"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Droplets, AlertTriangle, Info } from "lucide-react"

interface FloodArea {
  id: string
  name: string
  region: string
  severity: "low" | "moderate" | "high" | "extreme"
  waterLevel: number
  lastUpdated: string
  coordinates: { lat: number; lng: number }
  affectedPopulation?: number
  evacuationStatus?: string
}

interface FloodMapProps {
  locationKey: string
}

export function FloodMap({ locationKey }: FloodMapProps) {
  const [floodData, setFloodData] = useState<FloodArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mock flood data based on common flood-prone areas in Philippines
  const getMockFloodData = (locationKey: string): FloodArea[] => {
    const baseFloodAreas: FloodArea[] = [
      {
        id: "metro-manila-1",
        name: "Marikina River Basin",
        region: "Metro Manila",
        severity: "high",
        waterLevel: 18.5,
        lastUpdated: new Date().toISOString(),
        coordinates: { lat: 14.676, lng: 121.1 },
        affectedPopulation: 25000,
        evacuationStatus: "Preemptive evacuation ongoing",
      },
      {
        id: "metro-manila-2",
        name: "Pasig River",
        region: "Metro Manila",
        severity: "moderate",
        waterLevel: 12.3,
        lastUpdated: new Date().toISOString(),
        coordinates: { lat: 14.5995, lng: 120.9842 },
        affectedPopulation: 15000,
        evacuationStatus: "Monitoring",
      },
      {
        id: "central-luzon-1",
        name: "Pampanga River",
        region: "Central Luzon",
        severity: "moderate",
        waterLevel: 15.2,
        lastUpdated: new Date().toISOString(),
        coordinates: { lat: 15.0794, lng: 120.62 },
        affectedPopulation: 8000,
        evacuationStatus: "Alert level 2",
      },
      {
        id: "bicol-1",
        name: "Bicol River Basin",
        region: "Bicol",
        severity: "low",
        waterLevel: 8.1,
        lastUpdated: new Date().toISOString(),
        coordinates: { lat: 13.6218, lng: 123.1948 },
        affectedPopulation: 3000,
        evacuationStatus: "Normal monitoring",
      },
      {
        id: "mindanao-1",
        name: "Cagayan de Oro River",
        region: "Northern Mindanao",
        severity: "moderate",
        waterLevel: 11.8,
        lastUpdated: new Date().toISOString(),
        coordinates: { lat: 8.4542, lng: 124.6319 },
        affectedPopulation: 12000,
        evacuationStatus: "Alert level 1",
      },
    ]

    // Filter based on location - show relevant flood areas
    if (locationKey === "264885") {
      // Manila
      return baseFloodAreas.filter((area) => area.region === "Metro Manila")
    } else if (locationKey === "264679") {
      // Cebu
      return baseFloodAreas.filter((area) => area.region === "Central Visayas" || area.region === "Bicol")
    } else if (locationKey === "264678") {
      // Davao
      return baseFloodAreas.filter((area) => area.region === "Northern Mindanao")
    }

    return baseFloodAreas.slice(0, 3) // Show top 3 for other locations
  }

  useEffect(() => {
    const loadFloodData = async () => {
      try {
        setLoading(true)

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // In a real implementation, this would call AccuWeather's flood/severe weather API
        // For now, we'll use mock data based on the location
        const mockData = getMockFloodData(locationKey)
        setFloodData(mockData)
        setError(null)
      } catch (err) {
        console.error("Error loading flood data:", err)
        setError("Failed to load flood data. Using cached information.")
        // Fallback to mock data even on error
        setFloodData(getMockFloodData(locationKey))
      } finally {
        setLoading(false)
      }
    }

    loadFloodData()
  }, [locationKey])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "extreme":
        return "bg-red-100 text-red-800 border-red-200"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "moderate":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "extreme":
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case "moderate":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "low":
        return <Info className="h-4 w-4 text-blue-600" />
      default:
        return <Droplets className="h-4 w-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          Flood Affected Areas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {floodData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Droplets className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No flood alerts in this area</p>
            <p className="text-sm">All monitored areas are at normal levels</p>
          </div>
        ) : (
          <div className="space-y-4">
            {floodData.map((area) => (
              <div key={area.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <h4 className="font-medium">{area.name}</h4>
                      <p className="text-sm text-gray-500">{area.region}</p>
                    </div>
                  </div>
                  <Badge className={getSeverityColor(area.severity)}>
                    {getSeverityIcon(area.severity)}
                    <span className="ml-1 capitalize">{area.severity}</span>
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Water Level</p>
                    <p className="font-medium">{area.waterLevel}m</p>
                  </div>

                  {area.affectedPopulation && (
                    <div>
                      <p className="text-gray-500">Affected Population</p>
                      <p className="font-medium">{area.affectedPopulation.toLocaleString()}</p>
                    </div>
                  )}

                  {area.evacuationStatus && (
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium">{area.evacuationStatus}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-gray-500">Last Updated</p>
                    <p className="font-medium">
                      {new Date(area.lastUpdated).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Simple visual representation of flood severity */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      area.severity === "extreme"
                        ? "bg-red-500"
                        : area.severity === "high"
                          ? "bg-orange-500"
                          : area.severity === "moderate"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                    }`}
                    style={{
                      width: `${Math.min((area.waterLevel / 25) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <Info className="h-4 w-4 inline mr-1" />
                Flood data is updated every 30 minutes. For emergency situations, contact local authorities immediately.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
