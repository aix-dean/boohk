"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, CalendarIcon, Clock, ZoomIn, ZoomOut, Filter, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Types for our calendar data
type AdSpot = {
  id: string
  title: string
  start: Date
  end: Date
  location: string
  status: "scheduled" | "playing" | "completed" | "cancelled"
  type: "static" | "video" | "interactive"
  siteId: string
  siteName: string
}

type CalendarViewType = "month" | "week" | "day" | "hour" | "minute"

// Mock data generator
const generateMockAdSpots = (count: number): AdSpot[] => {
  const statuses: AdSpot["status"][] = ["scheduled", "playing", "completed", "cancelled"]
  const types: AdSpot["type"][] = ["static", "video", "interactive"]
  const siteIds = ["site-001", "site-002", "site-003", "site-004", "site-005"]
  const siteNames = [
    "Downtown Billboard",
    "Highway 95 Display",
    "Mall Entrance Screen",
    "Airport Terminal",
    "Convention Center",
  ]

  const spots: AdSpot[] = []

  // Current date
  const now = new Date()

  for (let i = 0; i < count; i++) {
    // Random day in current month (-15 to +15 days from today)
    const dayOffset = Math.floor(Math.random() * 31) - 15
    const startDate = new Date(now)
    startDate.setDate(now.getDate() + dayOffset)

    // Random duration (15 minutes to 3 hours)
    const durationMinutes = Math.floor(Math.random() * (180 - 15 + 1)) + 15
    const endDate = new Date(startDate)
    endDate.setMinutes(startDate.getMinutes() + durationMinutes)

    // Random site
    const siteIndex = Math.floor(Math.random() * siteIds.length)

    spots.push({
      id: `ad-${i + 1}`,
      title: `Ad Campaign ${i + 1}`,
      start: startDate,
      end: endDate,
      location: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"][Math.floor(Math.random() * 5)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      type: types[Math.floor(Math.random() * types.length)],
      siteId: siteIds[siteIndex],
      siteName: siteNames[siteIndex],
    })
  }

  return spots
}

// Helper functions for date manipulation
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate()
}

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay()
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
}

export default function CMSPlannerPage() {
  const router = useRouter()
  const [adSpots, setAdSpots] = useState<AdSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarViewType>("month")
  const [searchTerm, setSearchTerm] = useState("")

  // Load mock data
  useEffect(() => {
    setLoading(true)
    // Simulate API call delay
    setTimeout(() => {
      setAdSpots(generateMockAdSpots(50))
      setLoading(false)
    }, 800)
  }, [])

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    switch (view) {
      case "month":
        newDate.setMonth(currentDate.getMonth() - 1)
        break
      case "week":
        newDate.setDate(currentDate.getDate() - 7)
        break
      case "day":
        newDate.setDate(currentDate.getDate() - 1)
        break
      case "hour":
        newDate.setHours(currentDate.getHours() - 1)
        break
      case "minute":
        newDate.setMinutes(currentDate.getMinutes() - 15)
        break
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    switch (view) {
      case "month":
        newDate.setMonth(currentDate.getMonth() + 1)
        break
      case "week":
        newDate.setDate(currentDate.getDate() + 7)
        break
      case "day":
        newDate.setDate(currentDate.getDate() + 1)
        break
      case "hour":
        newDate.setHours(currentDate.getHours() + 1)
        break
      case "minute":
        newDate.setMinutes(currentDate.getMinutes() + 15)
        break
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // View title based on current view and date
  const getViewTitle = () => {
    const options: Intl.DateTimeFormatOptions = {}

    switch (view) {
      case "month":
        options.month = "long"
        options.year = "numeric"
        break
      case "week":
        const weekStart = new Date(currentDate)
        weekStart.setDate(currentDate.getDate() - currentDate.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)

        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${weekStart.toLocaleDateString([], { month: "long" })} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
        } else {
          return `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
        }
      case "day":
        options.weekday = "long"
        options.month = "long"
        options.day = "numeric"
        options.year = "numeric"
        break
      case "hour":
        options.weekday = "short"
        options.month = "short"
        options.day = "numeric"
        options.hour = "numeric"
        options.minute = "numeric"
        break
      case "minute":
        options.hour = "numeric"
        options.minute = "numeric"
        options.second = "numeric"
        return `${currentDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${currentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    }

    return currentDate.toLocaleDateString([], options)
  }

  // Filter ad spots based on current view
  const getFilteredAdSpots = () => {
    if (!adSpots.length) return []

    let filtered = [...adSpots]

    // Apply search filter if any
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (spot) =>
          spot.title.toLowerCase().includes(term) ||
          spot.siteName.toLowerCase().includes(term) ||
          spot.location.toLowerCase().includes(term),
      )
    }

    // Filter based on current view
    switch (view) {
      case "month":
        return filtered.filter(
          (spot) =>
            spot.start.getMonth() === currentDate.getMonth() && spot.start.getFullYear() === currentDate.getFullYear(),
        )
      case "week":
        const weekStart = new Date(currentDate)
        weekStart.setDate(currentDate.getDate() - currentDate.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7)
        weekEnd.setHours(23, 59, 59, 999)

        return filtered.filter((spot) => spot.start >= weekStart && spot.start < weekEnd)
      case "day":
        const dayStart = new Date(currentDate)
        dayStart.setHours(0, 0, 0, 0)

        const dayEnd = new Date(currentDate)
        dayEnd.setHours(23, 59, 59, 999)

        return filtered.filter((spot) => spot.start >= dayStart && spot.start < dayEnd)
      case "hour":
        const hourStart = new Date(currentDate)
        hourStart.setMinutes(0, 0, 0)

        const hourEnd = new Date(hourStart)
        hourEnd.setHours(hourStart.getHours() + 1)

        return filtered.filter(
          (spot) =>
            (spot.start >= hourStart && spot.start < hourEnd) || (spot.start < hourStart && spot.end > hourStart),
        )
      case "minute":
        const minuteStart = new Date(currentDate)
        minuteStart.setSeconds(0, 0)

        const minuteEnd = new Date(minuteStart)
        minuteEnd.setMinutes(minuteStart.getMinutes() + 15)

        return filtered.filter(
          (spot) =>
            (spot.start >= minuteStart && spot.start < minuteEnd) ||
            (spot.start < minuteStart && spot.end > minuteStart),
        )
    }

    // Default return empty array if no match (should never reach here)
    return []
  }

  // Get status color based on ad spot status
  const getStatusColor = (status: AdSpot["status"]) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "playing":
        return "bg-green-100 text-green-800 border-green-200"
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  // Get type icon based on ad spot type
  const getTypeIcon = (type: AdSpot["type"]) => {
    switch (type) {
      case "static":
        return "📷"
      case "video":
        return "🎬"
      case "interactive":
        return "🖱️"
      default:
        return "📄"
    }
  }

  // Render calendar based on current view
  const renderCalendar = () => {
    const filteredSpots = getFilteredAdSpots()

    switch (view) {
      case "month":
        return renderMonthView(filteredSpots)
      case "week":
        return renderWeekView(filteredSpots)
      case "day":
        return renderDayView(filteredSpots)
      case "hour":
        return renderHourView(filteredSpots)
      case "minute":
        return renderMinuteView(filteredSpots)
    }
  }

  // Month view renderer
  const renderMonthView = (spots: AdSpot[]) => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    // Create array of day numbers with empty slots for the first week
    const days = Array(firstDay)
      .fill(null)
      .concat([...Array(daysInMonth)].map((_, i) => i + 1))

    // Group spots by day
    const spotsByDay: { [key: number]: AdSpot[] } = {}
    spots.forEach((spot) => {
      const day = spot.start.getDate()
      if (!spotsByDay[day]) spotsByDay[day] = []
      spotsByDay[day].push(spot)
    })

    return (
      <div className="grid grid-cols-7 gap-1 mt-4">
        {/* Day headers */}
        {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
          <div key={`header-${i}`} className="text-center font-medium p-1 sm:p-2 text-gray-500 text-xs sm:text-sm">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, i) => {
          const isToday =
            day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year

          const daySpots = day ? spotsByDay[day] || [] : []

          return (
            <div
              key={`day-${i}`}
              className={`min-h-[80px] sm:min-h-[120px] border rounded-md p-1 ${
                day ? "bg-white" : "bg-gray-50"
              } ${isToday ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200"}`}
            >
              {day && (
                <>
                  <div className={`text-right p-1 text-xs sm:text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>
                    {day}
                  </div>
                  <div className="overflow-y-auto max-h-[50px] sm:max-h-[80px]">
                    {daySpots.slice(0, 2).map((spot, j) => (
                      <div
                        key={`spot-${day}-${j}`}
                        className="text-[10px] sm:text-xs p-1 mb-1 rounded bg-gray-50 truncate cursor-pointer hover:bg-gray-100"
                        onClick={() => router.push(`/cms/details/${spot.id}`)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{getTypeIcon(spot.type)}</span>
                          <span className="truncate">{spot.title}</span>
                        </div>
                      </div>
                    ))}
                    {daySpots.length > 2 && (
                      <div className="text-[10px] sm:text-xs text-center text-blue-600 font-medium">
                        +{daySpots.length - 2} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Week view renderer
  const renderWeekView = (spots: AdSpot[]) => {
    const weekStart = new Date(currentDate)
    weekStart.setDate(currentDate.getDate() - currentDate.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const days = Array(7)
      .fill(null)
      .map((_, i) => {
        const day = new Date(weekStart)
        day.setDate(weekStart.getDate() + i)
        return day
      })

    // Group spots by day
    const spotsByDay: { [key: string]: AdSpot[] } = {}
    spots.forEach((spot) => {
      const day = spot.start.toDateString()
      if (!spotsByDay[day]) spotsByDay[day] = []
      spotsByDay[day].push(spot)
    })

    return (
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mt-4">
        {/* Day headers */}
        {days.map((day, i) => {
          const isToday = day.toDateString() === new Date().toDateString()

          return (
            <div
              key={`header-${i}`}
              className={`text-center p-1 sm:p-2 ${isToday ? "font-bold text-blue-600" : "text-gray-700"}`}
            >
              <div className="text-[10px] sm:text-sm">{day.toLocaleDateString([], { weekday: "short" }).charAt(0)}</div>
              <div
                className={`text-sm sm:text-lg ${isToday ? "bg-blue-100 rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center mx-auto" : ""}`}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}

        {/* Week content */}
        {days.map((day, i) => {
          const isToday = day.toDateString() === new Date().toDateString()
          const daySpots = spotsByDay[day.toDateString()] || []

          return (
            <div
              key={`day-${i}`}
              className={`border rounded-md overflow-hidden ${isToday ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200"}`}
            >
              <div className="overflow-y-auto h-[250px] sm:h-[400px] p-1">
                {daySpots.map((spot, j) => (
                  <div
                    key={`spot-${i}-${j}`}
                    className="p-1 sm:p-2 mb-1 sm:mb-2 rounded bg-white border border-gray-200 text-[10px] sm:text-sm cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/cms/details/${spot.id}`)}
                  >
                    <div className="font-medium truncate">{spot.title}</div>
                    <div className="text-[8px] sm:text-xs text-gray-500 mt-1">
                      {formatTime(spot.start)} - {formatTime(spot.end)}
                    </div>
                    <div className="flex items-center justify-between mt-1 sm:mt-2">
                      <Badge variant="outline" className={`${getStatusColor(spot.status)} text-[8px] sm:text-xs px-1`}>
                        {spot.status}
                      </Badge>
                      <span className="text-[8px] sm:text-xs truncate max-w-[60px] sm:max-w-none">{spot.siteName}</span>
                    </div>
                  </div>
                ))}
                {daySpots.length === 0 && (
                  <div className="h-full flex items-center justify-center text-gray-400 text-[10px] sm:text-sm">
                    No ads scheduled
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Day view renderer
  const renderDayView = (spots: AdSpot[]) => {
    // Create array of hours
    const hours = Array(24)
      .fill(null)
      .map((_, i) => i)

    // Group spots by hour
    const spotsByHour: { [key: number]: AdSpot[] } = {}
    spots.forEach((spot) => {
      const hour = spot.start.getHours()
      if (!spotsByHour[hour]) spotsByHour[hour] = []
      spotsByHour[hour].push(spot)
    })

    return (
      <div className="mt-4 border rounded-md overflow-hidden">
        <div className="grid grid-cols-[50px_1fr] sm:grid-cols-[80px_1fr] divide-x">
          {/* Time column */}
          <div className="bg-gray-50">
            {hours.map((hour) => (
              <div
                key={`hour-${hour}`}
                className="h-16 sm:h-20 border-b border-gray-200 p-1 sm:p-2 text-right text-[10px] sm:text-sm text-gray-500"
              >
                {hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`}
              </div>
            ))}
          </div>

          {/* Content column */}
          <div>
            {hours.map((hour) => {
              const hourSpots = spotsByHour[hour] || []
              const currentHour = new Date().getHours()
              const isCurrentHour =
                hour === currentHour &&
                currentDate.getDate() === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear()

              return (
                <div
                  key={`content-${hour}`}
                  className={`h-16 sm:h-20 border-b border-gray-200 p-1 relative ${isCurrentHour ? "bg-blue-50" : ""}`}
                >
                  {hourSpots.map((spot, i) => (
                    <div
                      key={`spot-${hour}-${i}`}
                      className="absolute left-1 right-1 p-1 rounded bg-white border border-gray-200 shadow-sm text-[8px] sm:text-xs cursor-pointer hover:bg-gray-50"
                      style={{
                        top: `${(spot.start.getMinutes() / 60) * 100}%`,
                        height: `${Math.max(10, ((spot.end.getTime() - spot.start.getTime()) / (60 * 60 * 1000)) * 100)}%`,
                        maxHeight: "95%",
                        zIndex: i + 1,
                      }}
                      onClick={() => router.push(`/cms/details/${spot.id}`)}
                    >
                      <div className="font-medium truncate">{spot.title}</div>
                      <div className="flex items-center justify-between mt-0 sm:mt-1">
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(spot.status)} text-[8px] sm:text-[10px] px-1`}
                        >
                          {spot.status}
                        </Badge>
                        <span className="text-[8px] sm:text-[10px]">{getTypeIcon(spot.type)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Hour view renderer
  const renderHourView = (spots: AdSpot[]) => {
    // Create array of 5-minute intervals
    const intervals = Array(12)
      .fill(null)
      .map((_, i) => i * 5)

    return (
      <div className="mt-4 border rounded-md overflow-hidden">
        <div className="grid grid-cols-[50px_1fr] sm:grid-cols-[80px_1fr] divide-x">
          {/* Time column */}
          <div className="bg-gray-50">
            {intervals.map((interval) => {
              const time = new Date(currentDate)
              time.setMinutes(interval, 0, 0)

              return (
                <div
                  key={`interval-${interval}`}
                  className="h-12 sm:h-16 border-b border-gray-200 p-1 sm:p-2 text-right text-[8px] sm:text-sm text-gray-500"
                >
                  {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              )
            })}
          </div>

          {/* Content column */}
          <div>
            {intervals.map((interval) => {
              const time = new Date(currentDate)
              time.setMinutes(interval, 0, 0)

              const intervalSpots = spots.filter((spot) => {
                const intervalEnd = new Date(time)
                intervalEnd.setMinutes(time.getMinutes() + 5)

                return (spot.start >= time && spot.start < intervalEnd) || (spot.start < time && spot.end > time)
              })

              const isCurrentInterval =
                new Date().getHours() === time.getHours() &&
                Math.floor(new Date().getMinutes() / 5) * 5 === interval &&
                new Date().getDate() === time.getDate() &&
                new Date().getMonth() === time.getMonth() &&
                new Date().getFullYear() === time.getFullYear()

              return (
                <div
                  key={`content-${interval}`}
                  className={`h-12 sm:h-16 border-b border-gray-200 p-1 ${isCurrentInterval ? "bg-blue-50" : ""}`}
                >
                  <div className="flex flex-wrap gap-1">
                    {intervalSpots.map((spot, i) => (
                      <div
                        key={`spot-${interval}-${i}`}
                        className="flex-1 min-w-[80px] sm:min-w-[150px] p-1 sm:p-2 rounded bg-white border border-gray-200 shadow-sm text-[8px] sm:text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/cms/details/${spot.id}`)}
                      >
                        <div className="font-medium truncate">{spot.title}</div>
                        <div className="flex items-center justify-between mt-0 sm:mt-1">
                          <Badge
                            variant="outline"
                            className={`${getStatusColor(spot.status)} text-[8px] sm:text-[10px] px-1`}
                          >
                            {spot.status}
                          </Badge>
                          <span className="text-[8px] sm:text-[10px]">{formatTime(spot.start)}</span>
                        </div>
                      </div>
                    ))}
                    {intervalSpots.length === 0 && (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-[8px] sm:text-xs">
                        No ads in this time slot
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Minute view renderer
  const renderMinuteView = (spots: AdSpot[]) => {
    // Create array of 1-minute intervals for a 15-minute window
    const baseMinute = Math.floor(currentDate.getMinutes() / 15) * 15
    const intervals = Array(15)
      .fill(null)
      .map((_, i) => baseMinute + i)

    return (
      <div className="mt-4 border rounded-md overflow-hidden">
        <div className="grid grid-cols-[50px_1fr] sm:grid-cols-[80px_1fr] divide-x">
          {/* Time column */}
          <div className="bg-gray-50">
            {intervals.map((minute) => {
              const time = new Date(currentDate)
              time.setMinutes(minute, 0, 0)

              return (
                <div
                  key={`minute-${minute}`}
                  className="h-10 sm:h-12 border-b border-gray-200 p-1 sm:p-2 text-right text-[8px] sm:text-sm text-gray-500"
                >
                  {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
              )
            })}
          </div>

          {/* Content column */}
          <div>
            {intervals.map((minute) => {
              const time = new Date(currentDate)
              time.setMinutes(minute, 0, 0)

              const minuteSpots = spots.filter((spot) => {
                const minuteEnd = new Date(time)
                minuteEnd.setMinutes(time.getMinutes() + 1)

                return (spot.start >= time && spot.start < minuteEnd) || (spot.start < time && spot.end > time)
              })

              const isCurrentMinute =
                new Date().getHours() === time.getHours() &&
                new Date().getMinutes() === minute &&
                new Date().getDate() === time.getDate() &&
                new Date().getMonth() === time.getMonth() &&
                new Date().getFullYear() === time.getFullYear()

              return (
                <div
                  key={`content-${minute}`}
                  className={`h-10 sm:h-12 border-b border-gray-200 p-1 ${isCurrentMinute ? "bg-blue-50" : ""}`}
                >
                  <div className="flex flex-wrap gap-1">
                    {minuteSpots.map((spot, i) => (
                      <div
                        key={`spot-${minute}-${i}`}
                        className="flex-1 min-w-[70px] sm:min-w-[120px] p-1 rounded bg-white border border-gray-200 shadow-sm text-[8px] sm:text-[10px] cursor-pointer hover:bg-gray-50"
                        onClick={() => router.push(`/cms/details/${spot.id}`)}
                      >
                        <div className="font-medium truncate">{spot.title}</div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`${getStatusColor(spot.status)} text-[6px] sm:text-[8px] px-1`}
                          >
                            {spot.status}
                          </Badge>
                          <span className="text-[6px] sm:text-[8px]">{formatTime(spot.start)}</span>
                        </div>
                      </div>
                    ))}
                    {minuteSpots.length === 0 && (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-[8px] sm:text-[10px]">
                        No ads at this time
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header with title and actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">CMS Planner</h1>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              onClick={() => router.push("/cms/content/new")}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Plus size={16} />
              Add Ad Spot
            </Button>
          </div>
        </div>

        {/* Calendar controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              {/* Navigation controls */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPrevious}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="outline" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={goToNext}>
                  <ChevronRight size={16} />
                </Button>
                <h2 className="text-lg font-medium ml-2 truncate">{getViewTitle()}</h2>
              </div>

              {/* View controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <form className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search ad spots..."
                      className="pl-8 w-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </form>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Filter size={16} />
                        <span className="hidden sm:inline">Filter</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>All Ad Spots</DropdownMenuItem>
                      <DropdownMenuItem>Static Ads</DropdownMenuItem>
                      <DropdownMenuItem>Video Ads</DropdownMenuItem>
                      <DropdownMenuItem>Interactive Ads</DropdownMenuItem>
                      <DropdownMenuItem>Scheduled</DropdownMenuItem>
                      <DropdownMenuItem>Playing</DropdownMenuItem>
                      <DropdownMenuItem>Completed</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Tabs
                    defaultValue="month"
                    value={view}
                    onValueChange={(v) => setView(v as CalendarViewType)}
                    className="flex-1"
                  >
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="month" className="text-xs">
                        <CalendarIcon size={14} className="mr-1 hidden sm:inline" />
                        <span className="sm:hidden">M</span>
                        <span className="hidden sm:inline">Month</span>
                      </TabsTrigger>
                      <TabsTrigger value="week" className="text-xs">
                        <CalendarIcon size={14} className="mr-1 hidden sm:inline" />
                        <span className="sm:hidden">W</span>
                        <span className="hidden sm:inline">Week</span>
                      </TabsTrigger>
                      <TabsTrigger value="day" className="text-xs">
                        <CalendarIcon size={14} className="mr-1 hidden sm:inline" />
                        <span className="sm:hidden">D</span>
                        <span className="hidden sm:inline">Day</span>
                      </TabsTrigger>
                      <TabsTrigger value="hour" className="text-xs">
                        <Clock size={14} className="mr-1 hidden sm:inline" />
                        <span className="sm:hidden">H</span>
                        <span className="hidden sm:inline">Hour</span>
                      </TabsTrigger>
                      <TabsTrigger value="minute" className="text-xs">
                        <Clock size={14} className="mr-1 hidden sm:inline" />
                        <span className="sm:hidden">Min</span>
                        <span className="hidden sm:inline">Minute</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setView(
                          view === "month"
                            ? "week"
                            : view === "week"
                              ? "day"
                              : view === "day"
                                ? "hour"
                                : view === "hour"
                                  ? "minute"
                                  : "minute",
                        )
                      }
                    >
                      <ZoomIn size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setView(
                          view === "minute"
                            ? "hour"
                            : view === "hour"
                              ? "day"
                              : view === "day"
                                ? "week"
                                : view === "week"
                                  ? "month"
                                  : "month",
                        )
                      }
                    >
                      <ZoomOut size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar view */}
        <div className="bg-white border rounded-lg p-2 sm:p-4 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-base sm:text-lg">Loading calendar...</span>
            </div>
          ) : (
            <div className="min-w-[640px]">{renderCalendar()}</div>
          )}
        </div>
      </div>
    </div>
  )
}
