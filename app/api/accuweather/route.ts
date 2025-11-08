import { NextResponse } from "next/server"
import { getPhilippinesWeatherData, PHILIPPINES_LOCATIONS } from "@/lib/accuweather-service"

// Cache to store weather data with timestamps
const weatherCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

async function getWeatherByCoordinates(lat: number, lng: number, address: string) {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    throw new Error("OpenWeatherMap API key not configured")
  }

  try {
    // Get current weather
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`,
    )

    if (!currentResponse.ok) {
      throw new Error(`OpenWeatherMap API error: ${currentResponse.status}`)
    }

    const currentData = await currentResponse.json()

    // Get 5-day forecast
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`,
    )

    if (!forecastResponse.ok) {
      throw new Error(`OpenWeatherMap forecast API error: ${forecastResponse.status}`)
    }

    const forecastData = await forecastResponse.json()

    // Transform OpenWeatherMap data to match our interface
    const transformedData = {
      location: address,
      locationKey: "custom",
      current: {
        temperature: Math.round(currentData.main.temp),
        feelsLike: Math.round(currentData.main.feels_like),
        condition: currentData.weather[0].description,
        icon: mapOpenWeatherIcon(currentData.weather[0].icon),
        humidity: currentData.main.humidity,
        windSpeed: Math.round(currentData.wind.speed * 3.6), // Convert m/s to km/h
        windDirection: getWindDirection(currentData.wind.deg),
        uvIndex: 0, // OpenWeatherMap doesn't provide UV in free tier
        visibility: currentData.visibility ? Math.round(currentData.visibility / 1000) : 10,
        cloudCover: currentData.clouds.all,
        isDayTime: isDay(currentData.dt, currentData.sys.sunrise, currentData.sys.sunset),
        lastUpdated: new Date(currentData.dt * 1000).toISOString(),
      },
      forecast: transformForecastData(forecastData.list),
      alerts: [], // OpenWeatherMap alerts require paid plan
      lastUpdated: new Date().toISOString(),
    }

    return transformedData
  } catch (error) {
    console.error("Error fetching weather by coordinates:", error)
    throw error
  }
}

function mapOpenWeatherIcon(iconCode: string): string {
  const iconMap: { [key: string]: string } = {
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
  return iconMap[iconCode] || "cloud"
}

function getWindDirection(degrees: number): string {
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

function isDay(currentTime: number, sunrise: number, sunset: number): boolean {
  return currentTime >= sunrise && currentTime <= sunset
}

function transformForecastData(forecastList: any[]) {
  const dailyForecasts: { [key: string]: any } = {}

  // Group forecasts by date
  forecastList.forEach((item) => {
    const date = new Date(item.dt * 1000).toDateString()
    if (!dailyForecasts[date]) {
      dailyForecasts[date] = {
        date: new Date(item.dt * 1000).toISOString(),
        dayOfWeek: new Date(item.dt * 1000).toLocaleDateString("en-US", { weekday: "long" }),
        temperatures: [],
        conditions: [],
        icons: [],
        precipitation: false,
      }
    }

    dailyForecasts[date].temperatures.push(item.main.temp)
    dailyForecasts[date].conditions.push(item.weather[0].description)
    dailyForecasts[date].icons.push(mapOpenWeatherIcon(item.weather[0].icon))
    if (item.weather[0].main.includes("Rain") || item.weather[0].main.includes("Drizzle")) {
      dailyForecasts[date].precipitation = true
    }
  })

  // Transform to our format (take first 5 days)
  return Object.values(dailyForecasts)
    .slice(0, 5)
    .map((day: any) => ({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      temperature: {
        min: Math.round(Math.min(...day.temperatures)),
        max: Math.round(Math.max(...day.temperatures)),
      },
      day: {
        condition: day.conditions[0],
        icon: day.icons[0],
        precipitation: day.precipitation,
      },
      night: {
        condition: day.conditions[day.conditions.length - 1] || day.conditions[0],
        icon: day.icons[day.icons.length - 1] || day.icons[0],
        precipitation: day.precipitation,
      },
    }))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationKey = searchParams.get("location")
    const lat = searchParams.get("lat")
    const lng = searchParams.get("lng")
    const address = searchParams.get("address")

    if (lat && lng && address) {
      const latitude = Number.parseFloat(lat)
      const longitude = Number.parseFloat(lng)

      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
      }

      // Check cache for coordinate-based requests
      const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
      const cachedData = weatherCache.get(cacheKey)
      const now = Date.now()

      if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
        return NextResponse.json(cachedData.data)
      }

      // Fetch weather data using coordinates
      const weatherData = await getWeatherByCoordinates(latitude, longitude, decodeURIComponent(address))

      // Store in cache
      weatherCache.set(cacheKey, { data: weatherData, timestamp: now })

      return NextResponse.json(weatherData)
    }

    const selectedLocationKey = locationKey || "264885" // Default to Manila

    // Validate location key
    const validLocation = PHILIPPINES_LOCATIONS.find((loc) => loc.key === selectedLocationKey)
    if (!validLocation) {
      return NextResponse.json({ error: "Invalid location key" }, { status: 400 })
    }

    // Check cache first
    const cacheKey = selectedLocationKey
    const cachedData = weatherCache.get(cacheKey)
    const now = Date.now()

    // If we have valid cached data, return it
    if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedData.data)
    }

    // Fetch fresh data from AccuWeather
    const weatherData = await getPhilippinesWeatherData(selectedLocationKey)

    // Store in cache
    weatherCache.set(cacheKey, { data: weatherData, timestamp: now })

    return NextResponse.json(weatherData)
  } catch (error) {
    console.error("Error in AccuWeather API route:", error)

    let errorMessage = "Failed to fetch weather data"
    let statusCode = 500

    if (error instanceof Error) {
      console.error("Detailed error:", {
        message: error.message,
        stack: error.stack,
      })

      if (error.message.includes("Invalid API key") || error.message.includes("API key not configured")) {
        errorMessage = "Weather service configuration error"
        statusCode = 503
      } else if (error.message.includes("rate limit")) {
        errorMessage = "Weather service rate limit exceeded"
        statusCode = 429
      } else if (
        error.message.includes("AccuWeather API error") ||
        error.message.includes("OpenWeatherMap API error")
      ) {
        errorMessage = "Weather service temporarily unavailable"
        statusCode = 503
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: statusCode },
    )
  }
}
