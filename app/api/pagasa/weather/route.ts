import { NextResponse } from "next/server"

// Define types for our response
type WeatherResponse = {
  location: string
  date: string
  temperature: {
    current: number | null
    min: number | null
    max: number | null
  }
  humidity: number | null
  windSpeed: number | null
  windDirection: string | null
  condition: string | null
  icon: string
  rainChance: number | null
  alerts: WeatherAlert[]
  forecast: DailyForecast[]
  source: string
  raw?: any
}

type WeatherAlert = {
  type: string
  severity: "low" | "moderate" | "high" | "severe"
  description: string
  issuedAt: string
}

type DailyForecast = {
  date: string
  dayOfWeek: string
  temperature: {
    min: number | null
    max: number | null
  }
  condition: string | null
  icon: string
  rainChance: number | null
}

// Map region IDs to PAGASA region names
const regionMapping: Record<string, string> = {
  NCR: "Metro Manila",
  REGION_I: "Ilocos Region",
  REGION_II: "Cagayan Valley",
  REGION_III: "Central Luzon",
  REGION_IV_A: "CALABARZON",
  REGION_IV_B: "MIMAROPA",
  REGION_V: "Bicol Region",
  REGION_VI: "Western Visayas",
  REGION_VII: "Central Visayas",
  REGION_VIII: "Eastern Visayas",
  REGION_IX: "Zamboanga Peninsula",
  REGION_X: "Northern Mindanao",
  REGION_XI: "Davao Region",
  REGION_XII: "SOCCSKSARGEN",
  REGION_XIII: "Caraga",
  CAR: "Cordillera Administrative Region",
  BARMM: "Bangsamoro Autonomous Region in Muslim Mindanao",
}

// Map weather condition to icon
function getIconFromCondition(condition: string | null): string {
  if (!condition) return "cloud"

  const lowerCondition = condition.toLowerCase()
  if (lowerCondition.includes("rain") || lowerCondition.includes("shower")) {
    return "cloud-rain"
  } else if (lowerCondition.includes("thunder") || lowerCondition.includes("storm")) {
    return "cloud-lightning"
  } else if (lowerCondition.includes("cloud")) {
    return lowerCondition.includes("partly") ? "cloud-sun" : "cloud"
  } else if (lowerCondition.includes("clear") || lowerCondition.includes("sunny")) {
    return "sun"
  } else {
    return "cloud"
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get("region") || "NCR"
    const regionName = regionMapping[regionId] || "Philippines"

    // According to the pagasa-parser documentation, it's primarily a type definitions package
    // We need to use a different approach to get the actual data

    // For tropical cyclone data, we'll use the PAGASA API directly
    const pagasaApiUrl = "https://bagong.pagasa.dost.gov.ph/tropical-cyclone/api"

    let cycloneData = []
    try {
      const cycloneResponse = await fetch(pagasaApiUrl, {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 1800 }, // Cache for 30 minutes
      })

      if (cycloneResponse.ok) {
        cycloneData = await cycloneResponse.json()
      }
    } catch (cycloneError) {
      console.error("Error fetching cyclone data:", cycloneError)
    }

    // Process alerts from cyclone data
    const alerts: WeatherAlert[] = []

    if (cycloneData && cycloneData.length > 0) {
      for (const cyclone of cycloneData) {
        if (cyclone) {
          // Determine severity based on cyclone category
          let severity: "low" | "moderate" | "high" | "severe" = "low"
          const category = cyclone.category || ""

          if (category.includes("Super Typhoon")) {
            severity = "severe"
          } else if (category.includes("Typhoon")) {
            severity = "high"
          } else if (category.includes("Storm")) {
            severity = "moderate"
          }

          alerts.push({
            type: `Tropical Cyclone: ${cyclone.name || "Unnamed"}`,
            severity,
            description: cyclone.details || "Tropical cyclone detected in the Philippine Area of Responsibility",
            issuedAt: new Date().toISOString(),
          })
        }
      }
    }

    // For regional weather data, we'll use the PAGASA regional forecast API
    // This is a simplified approach as PAGASA doesn't have a public API for this
    // In a production environment, you would need to integrate with PAGASA's official data sources

    const weatherResponse: WeatherResponse = {
      location: regionName,
      date: new Date().toISOString(),
      temperature: {
        current: null,
        min: null,
        max: null,
      },
      humidity: null,
      windSpeed: null,
      windDirection: null,
      condition: null,
      icon: "cloud", // Default icon
      rainChance: null,
      alerts,
      forecast: [],
      source: "PAGASA Tropical Cyclone Data",
      raw: cycloneData,
    }

    return NextResponse.json(weatherResponse)
  } catch (error) {
    console.error("Error processing PAGASA data:", error)

    // Return an error response without dummy data
    return NextResponse.json(
      {
        error: "Failed to fetch weather data from PAGASA. The service may be temporarily unavailable.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }, // Service Unavailable
    )
  }
}
