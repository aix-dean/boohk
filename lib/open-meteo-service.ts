// Open-Meteo API Service
// This service fetches weather data from the Open-Meteo API (completely free, no API key required)

export type WeatherForecast = {
  location: string
  date: string
  temperature: {
    current: number
    min: number
    max: number
    feels_like: number
  }
  humidity: number
  windSpeed: number
  windDirection: string
  condition: string
  icon: string
  rainChance: number
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

export interface DailyForecast {
  date: string
  dayOfWeek: string
  temperature: {
    min: number
    max: number
  }
  condition: string
  icon: string
  rainChance: number
  humidity: number
  windSpeed: number // Add this line
}

export type PhilippineRegion = {
  id: string
  name: string
  lat: number
  lon: number
}

// Philippine regions with coordinates
export const philippineRegions: PhilippineRegion[] = [
  { id: "NCR", name: "Metro Manila", lat: 14.6091, lon: 120.9822 },
  { id: "REGION_I", name: "Ilocos Region", lat: 16.0797, lon: 120.6199 },
  { id: "REGION_II", name: "Cagayan Valley", lat: 17.6132, lon: 121.727 },
  { id: "REGION_III", name: "Central Luzon", lat: 15.4827, lon: 120.712 },
  { id: "REGION_IV_A", name: "CALABARZON", lat: 14.1008, lon: 121.0794 },
  { id: "REGION_IV_B", name: "MIMAROPA", lat: 13.0765, lon: 121.418 },
  { id: "REGION_V", name: "Bicol Region", lat: 13.4213, lon: 123.4136 },
  { id: "REGION_VI", name: "Western Visayas", lat: 10.7202, lon: 122.5621 },
  { id: "REGION_VII", name: "Central Visayas", lat: 10.3157, lon: 123.8854 },
  { id: "REGION_VIII", name: "Eastern Visayas", lat: 11.2543, lon: 125.0037 },
  { id: "REGION_IX", name: "Zamboanga Peninsula", lat: 8.1527, lon: 123.266 },
  { id: "REGION_X", name: "Northern Mindanao", lat: 8.0223, lon: 124.6852 },
  { id: "REGION_XI", name: "Davao Region", lat: 7.0707, lon: 125.6087 },
  { id: "REGION_XII", name: "SOCCSKSARGEN", lat: 6.2706, lon: 125.0879 },
  { id: "REGION_XIII", name: "Caraga", lat: 8.8014, lon: 125.7407 },
  { id: "CAR", name: "Cordillera Administrative Region", lat: 17.3484, lon: 121.1169 },
  { id: "BARMM", name: "Bangsamoro Autonomous Region in Muslim Mindanao", lat: 7.3236, lon: 124.2798 },
]

// Get region by ID
export function getRegionById(id: string): PhilippineRegion | undefined {
  return philippineRegions.find((region) => region.id === id)
}

// Map WMO weather codes to our icon set
// WMO codes: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
export function mapWeatherCode(wmoCode: number): string {
  // Clear
  if (wmoCode === 0) return "sun"

  // Mainly clear, partly cloudy
  if (wmoCode === 1 || wmoCode === 2) return "cloud-sun"

  // Overcast
  if (wmoCode === 3) return "cloud"

  // Fog
  if (wmoCode >= 45 && wmoCode <= 48) return "cloud"

  // Drizzle
  if (wmoCode >= 51 && wmoCode <= 57) return "cloud-rain"

  // Rain
  if ((wmoCode >= 61 && wmoCode <= 67) || (wmoCode >= 80 && wmoCode <= 82)) return "cloud-rain"

  // Snow
  if ((wmoCode >= 71 && wmoCode <= 77) || (wmoCode >= 85 && wmoCode <= 86)) return "cloud-snow"

  // Thunderstorm
  if (wmoCode >= 95 && wmoCode <= 99) return "cloud-lightning"

  // Default
  return "cloud"
}

// Map WMO weather codes to condition descriptions
export function mapWeatherCondition(wmoCode: number): string {
  // Clear
  if (wmoCode === 0) return "Clear sky"

  // Mainly clear, partly cloudy
  if (wmoCode === 1) return "Mainly clear"
  if (wmoCode === 2) return "Partly cloudy"

  // Overcast
  if (wmoCode === 3) return "Overcast"

  // Fog
  if (wmoCode >= 45 && wmoCode <= 48) return "Fog"

  // Drizzle
  if (wmoCode >= 51 && wmoCode <= 57) return "Drizzle"

  // Rain
  if (wmoCode >= 61 && wmoCode <= 65) return "Rain"
  if (wmoCode === 66 || wmoCode === 67) return "Freezing rain"
  if (wmoCode >= 80 && wmoCode <= 82) return "Rain showers"

  // Snow
  if (wmoCode >= 71 && wmoCode <= 77) return "Snow"
  if (wmoCode >= 85 && wmoCode <= 86) return "Snow showers"

  // Thunderstorm
  if (wmoCode >= 95 && wmoCode <= 99) return "Thunderstorm"

  // Default
  return "Unknown"
}

// Convert wind degrees to direction
export function degreesToDirection(degrees: number): string {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ]
  const index = Math.round(degrees / 22.5) % 16
  return directions[index]
}

// Calculate feels like temperature
export function calculateFeelsLike(temp: number, humidity: number, windSpeed: number): number {
  // Simple approximation of feels like temperature
  if (temp > 27) {
    // Heat index for hot temperatures
    return temp + 0.1 * humidity - 0.2 * windSpeed
  } else if (temp < 10) {
    // Wind chill for cold temperatures
    return temp - 0.5 * windSpeed
  }
  return temp
}

// Get weather alerts from PAGASA website (simplified)
export async function getWeatherAlerts(): Promise<WeatherAlert[]> {
  try {
    // In a real implementation, you would scrape or use an API to get actual alerts
    // For now, we'll return an empty array
    return []
  } catch (error) {
    console.error("Error fetching weather alerts:", error)
    return []
  }
}
