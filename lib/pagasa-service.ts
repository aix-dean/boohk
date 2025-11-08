// PAGASA Weather API Service
// This service fetches and parses weather data from PAGASA

type WeatherForecast = {
  location: string
  date: string
  temperature: {
    current: number
    min: number
    max: number
  }
  humidity: number
  windSpeed: number
  windDirection: string
  condition: string
  icon: string
  rainChance: number
  alerts: WeatherAlert[]
  forecast: DailyForecast[]
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
    min: number
    max: number
  }
  condition: string
  icon: string
  rainChance: number
}

// Mock data for demonstration purposes
// In a real implementation, this would fetch from PAGASA API
export async function fetchWeatherForecast(location = "Metro Manila"): Promise<WeatherForecast> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const currentDate = new Date()

  // Generate 5-day forecast
  const forecast: DailyForecast[] = Array.from({ length: 5 }).map((_, index) => {
    const forecastDate = new Date()
    forecastDate.setDate(currentDate.getDate() + index + 1)

    const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Thunderstorms"]
    const icons = ["sun", "cloud-sun", "cloud", "cloud-rain", "cloud-lightning"]
    const conditionIndex = Math.floor(Math.random() * conditions.length)

    return {
      date: forecastDate.toISOString().split("T")[0],
      dayOfWeek: forecastDate.toLocaleDateString("en-US", { weekday: "short" }),
      temperature: {
        min: Math.floor(Math.random() * 5) + 24,
        max: Math.floor(Math.random() * 5) + 30,
      },
      condition: conditions[conditionIndex],
      icon: icons[conditionIndex],
      rainChance: Math.floor(Math.random() * 100),
    }
  })

  // Generate random alerts based on weather conditions
  const alerts: WeatherAlert[] = []
  if (Math.random() > 0.7) {
    alerts.push({
      type: "Rainfall Warning",
      severity: "moderate",
      description: "Moderate to heavy rainfall expected in the next 24 hours",
      issuedAt: new Date().toISOString(),
    })
  }

  if (Math.random() > 0.9) {
    alerts.push({
      type: "Tropical Cyclone Warning",
      severity: "high",
      description: "Tropical depression approaching the Philippine Area of Responsibility",
      issuedAt: new Date().toISOString(),
    })
  }

  return {
    location,
    date: currentDate.toISOString(),
    temperature: {
      current: Math.floor(Math.random() * 5) + 28,
      min: Math.floor(Math.random() * 3) + 24,
      max: Math.floor(Math.random() * 5) + 30,
    },
    humidity: Math.floor(Math.random() * 30) + 60,
    windSpeed: Math.floor(Math.random() * 20) + 5,
    windDirection: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(Math.random() * 8)],
    condition: forecast[0].condition,
    icon: forecast[0].icon,
    rainChance: forecast[0].rainChance,
    alerts,
    forecast,
  }
}
