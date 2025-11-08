// PAGASA Parser Service
// This service fetches weather data from our internal API routes that use the pagasa-parser npm package

export type WeatherForecast = {
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
}

export type WeatherAlert = {
  type: string
  severity: "low" | "moderate" | "high" | "severe"
  description: string
  issuedAt: string
}

export type DailyForecast = {
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

export type PagasaRegion = {
  id: string
  name: string
}

// Get available regions from our API route
export async function getRegions(): Promise<PagasaRegion[]> {
  const response = await fetch("/api/pagasa/regions", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch regions: ${response.status}`)
  }

  return await response.json()
}

// Get weather forecast for a specific region from our API route
export async function fetchWeatherForecast(regionId = "NCR"): Promise<WeatherForecast> {
  const response = await fetch(`/api/pagasa/weather?region=${regionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch weather data: ${response.status}`)
  }

  return await response.json()
}
