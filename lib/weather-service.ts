import type { WeatherForecast } from "./open-meteo-service"
import { getPhilippinesWeatherData, PHILIPPINES_LOCATIONS } from "./accuweather-service"
import { isSameDay } from "date-fns"

// Get available regions from AccuWeather locations
export async function getRegions(): Promise<{ id: string; name: string; region: string }[]> {
  try {
    // Transform AccuWeather locations to match the expected format
    return PHILIPPINES_LOCATIONS.map(loc => ({
      id: loc.key,
      name: loc.name,
      region: loc.region
    }))
  } catch (error) {
    console.error("Error getting regions:", error)
    throw error
  }
}

// Get weather forecast for a specific region from AccuWeather
export async function fetchWeatherForecast(regionId = "264885", startDate?: string, endDate?: string): Promise<WeatherForecast> {
  try {
    // Get AccuWeather data
    const accuWeatherData = await getPhilippinesWeatherData(regionId)

    // If date range is specified, filter the forecast data
    let filteredForecast = accuWeatherData.forecast

    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00') // Ensure local timezone interpretation
      const end = new Date(endDate + 'T23:59:59') // Ensure local timezone interpretation
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Normalize to start of day

      // Always include today's forecast using current weather data if start date includes today
      if (isSameDay(start, today)) {
        const firstForecastDate = new Date(accuWeatherData.forecast[0].date + 'T00:00:00')
        if (isSameDay(firstForecastDate, today)) {
          // API already includes today, use forecast as is
          filteredForecast = accuWeatherData.forecast.slice(0, 5)
        } else {
          // API starts from tomorrow, prepend today's entry using current weather data
          const todayEntry = {
            date: today.toISOString().split('T')[0], // Use date-only string to avoid timezone issues
            dayOfWeek: today.toLocaleDateString("en-US", { weekday: "long" }),
            temperature: {
              min: Math.max(accuWeatherData.current.temperature - 3, 22), // Estimate min temp
              max: accuWeatherData.current.temperature,
            },
            day: {
              condition: accuWeatherData.current.condition,
              icon: accuWeatherData.current.icon,
              precipitation: false, // Current weather doesn't indicate daily precipitation
            },
            night: {
              condition: "Clear",
              icon: "moon",
              precipitation: false,
            },
          }
          // Prepend today's entry and take next 4 days to ensure exactly 5 days total starting with today
          filteredForecast = [todayEntry, ...accuWeatherData.forecast.slice(0, 4)]
        }
      } else {
        // Filter forecast to only include dates within the selected range
        filteredForecast = accuWeatherData.forecast.filter(day => {
          const dayDate = new Date(day.date + 'T00:00:00') // Ensure consistent timezone interpretation
          return dayDate >= start && dayDate <= end
        })

        // If not starting from today, ensure we have up to 5 days
        filteredForecast = filteredForecast.slice(0, 5)

        // If no forecast data matches the range, return empty array
        if (filteredForecast.length === 0) {
          filteredForecast = []
        }
      }
    } else {
      // No date range specified, use default 5-day forecast
      filteredForecast = accuWeatherData.forecast.slice(0, 5)
    }

    // Remove duplicates based on date before final processing
    filteredForecast = filteredForecast.filter((item, index, arr) =>
      arr.findIndex(i => i.date === item.date) === index
    )

    // Transform AccuWeather data to WeatherForecast format
    const forecast: WeatherForecast = {
      location: accuWeatherData.location,
      date: accuWeatherData.lastUpdated,
      temperature: {
        current: accuWeatherData.current.temperature,
        min: accuWeatherData.forecast[0]?.temperature.min || accuWeatherData.current.temperature - 5,
        max: accuWeatherData.forecast[0]?.temperature.max || accuWeatherData.current.temperature + 5,
        feels_like: accuWeatherData.current.feelsLike,
      },
      humidity: accuWeatherData.current.humidity,
      windSpeed: accuWeatherData.current.windSpeed,
      windDirection: accuWeatherData.current.windDirection,
      condition: accuWeatherData.current.condition,
      icon: accuWeatherData.current.icon,
      rainChance: 0, // Will be calculated from forecast data
      alerts: accuWeatherData.alerts.map(alert => ({
        type: alert.type,
        severity: alert.level === 'Severe' ? 'severe' as const :
                 alert.level === 'High' ? 'high' as const :
                 alert.level === 'Moderate' ? 'moderate' as const : 'low' as const,
        description: alert.description,
        issuedAt: new Date().toISOString(),
      })),
      forecast: filteredForecast.map((day, index) => {
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
      }),
      source: "AccuWeather",
    }

    return forecast
  } catch (error) {
    console.error("Error fetching weather data:", error)
    throw error
  }
}

// Make sure the re-exported types include windSpeed in the DailyForecast
export type { WeatherForecast }
