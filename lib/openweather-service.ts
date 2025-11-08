// OpenWeatherMap API Service
// This service fetches weather data from the OpenWeatherMap API

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

export type DailyForecast = {
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
  windSpeed: number
}

export type PhilippineRegion = {
  id: string
  name: string
  lat: number
  lon: number
}

// Philippine regions with coordinates for OpenWeatherMap API
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

// Map OpenWeatherMap icon to our icon set
export function mapWeatherIcon(owmIcon: string): string {
  const iconMap: Record<string, string> = {
    "01d": "sun",
    "01n": "sun",
    "02d": "cloud-sun",
    "02n": "cloud-sun",
    "03d": "cloud",
    "03n": "cloud",
    "04d": "cloud",
    "04n": "cloud",
    "09d": "cloud-rain",
    "09n": "cloud-rain",
    "10d": "cloud-rain",
    "10n": "cloud-rain",
    "11d": "cloud-lightning",
    "11n": "cloud-lightning",
    "13d": "cloud-snow",
    "13n": "cloud-snow",
    "50d": "cloud-fog",
    "50n": "cloud-fog",
  }

  return iconMap[owmIcon] || "cloud"
}

// Map OpenWeatherMap alert severity to our severity levels
export function mapAlertSeverity(owmSeverity: string): "low" | "moderate" | "high" | "severe" {
  const severityMap: Record<string, "low" | "moderate" | "high" | "severe"> = {
    Minor: "low",
    Moderate: "moderate",
    Severe: "high",
    Extreme: "severe",
  }

  return severityMap[owmSeverity] || "moderate"
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
