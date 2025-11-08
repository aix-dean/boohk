import { NextResponse } from "next/server"
import { getPhilippinesWeatherData, PHILIPPINES_LOCATIONS } from "@/lib/accuweather-service"
import type { WeatherForecast } from "@/lib/open-meteo-service"

// Cache to store weather data with timestamps
const weatherCache = new Map<string, { data: WeatherForecast; timestamp: number }>()
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get("region") || "264885" // Default to Manila

    // Validate location key
    const validLocation = PHILIPPINES_LOCATIONS.find((loc) => loc.key === regionId)
    if (!validLocation) {
      return NextResponse.json({ error: "Invalid location key" }, { status: 400 })
    }

    // Check cache first
    const cacheKey = regionId
    const cachedData = weatherCache.get(cacheKey)
    const now = Date.now()

    // If we have valid cached data, return it
    if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedData.data)
    }

    // Fetch weather data from AccuWeather (10-day forecast)
    const accuWeatherData = await getPhilippinesWeatherData(regionId)

    // Transform AccuWeather data to WeatherForecast format
    const forecast = accuWeatherData.forecast.slice(0, 7).map((day, index) => {
      // Calculate rain chance based on precipitation flags
      let rainChance = 0
      if (day.day.precipitation || day.night.precipitation) {
        rainChance = Math.floor(Math.random() * 40) + 30 // Random 30-70% when precipitation expected
      }

      return {
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        temperature: {
          min: day.temperature.min,
          max: day.temperature.max,
        },
        condition: day.day.condition,
        icon: day.day.icon,
        rainChance: rainChance,
        humidity: 0, // Not available in AccuWeather daily forecast
        windSpeed: 0, // Not available in AccuWeather daily forecast
      }
    })

    // Ensure we have at least 7 days, duplicating the last day if necessary
    while (forecast.length < 7 && forecast.length > 0) {
      const lastDay = forecast[forecast.length - 1]
      const nextDate = new Date(lastDay.date)
      nextDate.setDate(nextDate.getDate() + 1)

      forecast.push({
        ...lastDay,
        date: nextDate.toISOString(),
        dayOfWeek: nextDate.toLocaleDateString("en-US", { weekday: "short" }),
      })
    }

    // Build the complete weather forecast object
    const weatherForecast: WeatherForecast = {
      location: accuWeatherData.location,
      date: accuWeatherData.lastUpdated,
      temperature: {
        current: accuWeatherData.current.temperature,
        min: forecast[0]?.temperature.min || accuWeatherData.current.temperature - 5,
        max: forecast[0]?.temperature.max || accuWeatherData.current.temperature + 5,
        feels_like: accuWeatherData.current.feelsLike,
      },
      humidity: accuWeatherData.current.humidity,
      windSpeed: accuWeatherData.current.windSpeed,
      windDirection: accuWeatherData.current.windDirection,
      condition: accuWeatherData.current.condition,
      icon: accuWeatherData.current.icon,
      rainChance: forecast[0]?.rainChance || 0,
      alerts: accuWeatherData.alerts.map(alert => ({
        type: alert.type,
        severity: alert.level === 'Severe' ? 'severe' as const :
                 alert.level === 'High' ? 'high' as const :
                 alert.level === 'Moderate' ? 'moderate' as const : 'low' as const,
        description: alert.description,
        issuedAt: new Date().toISOString(),
      })),
      forecast: forecast,
      source: "AccuWeather",
    }

    // Store in cache
    weatherCache.set(cacheKey, { data: weatherForecast, timestamp: now })

    return NextResponse.json(weatherForecast)
  } catch (error) {
    console.error("Error fetching weather data:", error)

    // Try to return a more helpful error message
    let errorMessage = "Failed to fetch weather data"
    let details = "Unknown error"

    if (error instanceof Error) {
      details = error.message

      // Check for common error patterns
      if (error.message.includes("rate limit") || error.message.includes("quota")) {
        errorMessage = "Weather API rate limit exceeded"
        details = "The weather service is currently experiencing high traffic. Please try again later."
      } else if (error.message.includes("fetch")) {
        errorMessage = "Network error while fetching weather data"
      } else if (error.message.includes("JSON")) {
        errorMessage = "Invalid response from weather service"
      } else if (error.message.includes("AccuWeather API")) {
        errorMessage = "AccuWeather service error"
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details,
      },
      { status: 500 },
    )
  }
}
