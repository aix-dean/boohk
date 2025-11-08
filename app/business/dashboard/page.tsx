"use client"

import { Bell, MessageSquare, User, ChevronDown, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { getSalesEvents } from "@/lib/planner-service"
import type { SalesEvent } from "@/lib/planner-service"
import { getTodosByUser } from "@/lib/todo-service"
import type { Todo } from "@/lib/types/todo"
import { bookingService } from "@/lib/booking-service"
import type { Booking } from "@/lib/booking-service"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface SitePerformanceData {
  bestPerforming: {
    name: string
    percentage: number
  }
  worstPerforming: {
    name: string
    percentage: number
  }
}

interface ConversionRateData {
  quotations: number
  bookings: number
  rate: number
}

interface OccupancyPerformanceData {
  monthlyData: { [month: number]: number }
  bestMonth: {
    name: string
    percentage: number
  }
  worstMonth: {
    name: string
    percentage: number
  }
}

export default function Dashboard() {
  const { userData } = useAuth()
  const [sitePerformance, setSitePerformance] = useState<SitePerformanceData>({
    bestPerforming: { name: "Loading...", percentage: 0 },
    worstPerforming: { name: "Loading...", percentage: 0 }
  })
  const [conversionRate, setConversionRate] = useState<ConversionRateData>({
    quotations: 0,
    bookings: 0,
    rate: 0
  })
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [conversionYear, setConversionYear] = useState("2025")
  const [conversionDateRange, setConversionDateRange] = useState<DateRange | undefined>()
  const [occupancyYear, setOccupancyYear] = useState("2025")
  const [calendarEvents, setCalendarEvents] = useState<SalesEvent[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [serviceAssignments, setServiceAssignments] = useState<any[]>([])
  const [occupancy, setOccupancy] = useState({
    staticUnavailable: 0,
    staticTotal: 0,
    dynamicUnavailable: 0,
    dynamicTotal: 0
  })
  const [occupancyPerformance, setOccupancyPerformance] = useState<OccupancyPerformanceData>({
    monthlyData: {},
    bestMonth: { name: "Dec", percentage: 20 },
    worstMonth: { name: "Sep", percentage: 5 }
  })

  useEffect(() => {
    if (userData?.company_id) {
      fetchSitePerformance()
    }
  }, [userData?.company_id, dateRange])

  useEffect(() => {
    if (userData?.company_id) {
      fetchConversionRate()
    }
  }, [userData?.company_id, conversionYear, conversionDateRange])

  useEffect(() => {
    if (userData?.company_id) {
      fetchOccupancyPerformance()
    }
  }, [userData?.company_id, occupancyYear])

  useEffect(() => {
    if (userData?.company_id) {
      fetchCalendarEvents()
      fetchTodos()
      fetchBookings()
      fetchServiceAssignments()
    }
  }, [userData?.company_id])

  const fetchSitePerformance = async () => {
    try {
      const params = new URLSearchParams({
        companyId: userData!.company_id!
      })
      if (dateRange?.from) params.append("startDate", format(dateRange.from, "yyyy-MM-dd"))
      if (dateRange?.to) params.append("endDate", format(dateRange.to, "yyyy-MM-dd"))

      const response = await fetch(`/api/business/dashboard?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSitePerformance(data)
        setOccupancy(data.occupancy)
      } else {
        console.error("Failed to fetch site performance")
      }
    } catch (error) {
      console.error("Error fetching site performance:", error)
    }
  }

  const fetchConversionRate = async () => {
    try {
      const params = new URLSearchParams({
        companyId: userData!.company_id!
      })

      if (conversionDateRange?.from) {
        params.append("startDate", format(conversionDateRange.from, "yyyy-MM-dd"))
      }
      if (conversionDateRange?.to) {
        params.append("endDate", format(conversionDateRange.to, "yyyy-MM-dd"))
      } else {
        params.append("year", conversionYear)
      }

      const response = await fetch(`/api/business/dashboard?${params}`)
      if (response.ok) {
        const data = await response.json()
        const conversionData = data.conversionRate
        const calculatedRate = conversionData.quotations > 0 ? Math.round((conversionData.bookings / conversionData.quotations) * 100) : 0
        setConversionRate({ ...conversionData, rate: calculatedRate })
      } else {
        console.error("Failed to fetch conversion rate")
      }
    } catch (error) {
      console.error("Error fetching conversion rate:", error)
    }
  }

  const fetchOccupancyPerformance = async () => {
    try {
      const params = new URLSearchParams({
        companyId: userData!.company_id!,
        year: occupancyYear
      })

      const response = await fetch(`/api/business/dashboard?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.occupancyPerformance) {
          setOccupancyPerformance(data.occupancyPerformance)
        }
        setOccupancy(data.occupancy)
      } else {
        console.error("Failed to fetch occupancy performance")
      }
    } catch (error) {
      console.error("Error fetching occupancy performance:", error)
    }
  }

  const fetchCalendarEvents = async () => {
    if (!userData?.company_id) return

    try {
      const isAdmin = userData.role === "admin"
      const userDepartment = "business-dev"
      const events = await getSalesEvents(isAdmin, userDepartment)
      setCalendarEvents(events)
    } catch (error) {
      console.error("Error fetching calendar events:", error)
      setCalendarEvents([])
    }
  }

  const fetchTodos = async () => {
    if (!userData?.company_id) {
      setTodos([])
      return
    }

    try {
      const fetchedTodos = await getTodosByUser("", userData.company_id, "business-dev")
      // Filter to ensure only non-deleted todos that are not completed are displayed
      const activeTodos = fetchedTodos.filter(todo => !todo.isDeleted && (todo.status === "todo" || todo.status === "in-progress"))
      setTodos(activeTodos)
    } catch (error) {
      console.error("Error fetching todos:", error)
      setTodos([])
    }
  }

  const fetchBookings = async () => {
    if (!userData?.company_id) {
      setBookings([])
      return
    }

    try {
      // Get both completed and collectible (reserved) bookings for the company
      const [completedBookings, reservedBookings] = await Promise.all([
        bookingService.getCompletedBookings(userData.company_id),
        bookingService.getCollectiblesBookings(userData.company_id)
      ])

      // Combine and deduplicate bookings
      const allBookings = [...completedBookings, ...reservedBookings]
      const uniqueBookings = allBookings.filter((booking, index, self) =>
        index === self.findIndex(b => b.id === booking.id)
      )

      setBookings(uniqueBookings)
    } catch (error) {
      console.error("Error fetching bookings:", error)
      setBookings([])
    }
  }

  const fetchServiceAssignments = async () => {
    if (!userData?.company_id) {
      setServiceAssignments([])
      return
    }

    try {
      // Query service assignments from Firestore using company_id
      const assignmentsRef = collection(db, "service_assignments")

      // Try with orderBy first
      let q = query(assignmentsRef, where("company_id", "==", userData.company_id), orderBy("created", "desc"))

      let querySnapshot
      try {
        querySnapshot = await getDocs(q)
      } catch (orderByError) {
        // If orderBy fails (likely due to missing index), try without orderBy
        q = query(assignmentsRef, where("company_id", "==", userData.company_id))
        querySnapshot = await getDocs(q)
      }

      const fetchedAssignments: any[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const assignment = {
          id: doc.id,
          ...data,
        }
        fetchedAssignments.push(assignment)
      })

      setServiceAssignments(fetchedAssignments)
    } catch (error) {
      console.error("Error fetching service assignments:", error)
      setServiceAssignments([])
    }
  }

  const generateLineGraph = () => {
    const { monthlyData } = occupancyPerformance
    const elements: React.JSX.Element[] = []
    const width = 300
    const height = 120
    const chartHeight = 60 // Available height for chart (from 80 to 20)
    const baseY = 80 // Base Y position

    // Find max percentage for scaling
    const maxPercentage = Math.max(...Object.values(monthlyData), 1)

    // Generate data points
    const points: { x: number; y: number; percentage: number }[] = []
    for (let month = 0; month < 12; month++) {
      const percentage = monthlyData[month] || 0
      const x = (month / 11) * (width - 40) + 20 // Add padding
      const y = baseY - (percentage / maxPercentage) * chartHeight
      points.push({ x, y, percentage })
    }

    // Create smooth curve path
    let pathData = ''
    points.forEach((point, index) => {
      if (index === 0) {
        pathData += `M ${point.x} ${point.y}`
      } else {
        const prevPoint = points[index - 1]
        const controlX1 = prevPoint.x + (point.x - prevPoint.x) / 3
        const controlX2 = point.x - (point.x - prevPoint.x) / 3
        pathData += ` C ${controlX1} ${prevPoint.y}, ${controlX2} ${point.y}, ${point.x} ${point.y}`
      }
    })

    // Create area fill path
    const areaPathData = pathData + ` L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`

    // Add grid lines
    for (let i = 0; i <= 4; i++) {
      const y = baseY - (i / 4) * chartHeight
      elements.push(
        <line
          key={`grid-${i}`}
          x1="20"
          y1={y}
          x2={width - 20}
          y2={y}
          stroke="#e5e7eb"
          strokeWidth="0.5"
          opacity="0.3"
        />
      )
    }

    // Add area fill
    elements.push(
      <path
        key="area"
        d={areaPathData}
        fill="url(#lineGradient)"
        opacity="0.3"
      />
    )

    // Add line
    elements.push(
      <path
        key="line"
        d={pathData}
        fill="none"
        stroke="#4169e1"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )

    // Add data points
    points.forEach((point, index) => {
      elements.push(
        <circle
          key={`point-${index}`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#4169e1"
          stroke="white"
          strokeWidth="2"
        />
      )
    })

    return elements
  }

  return (
    <div className="min-h-screen">
        {/* Main Content */}
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold text-[#333333] mb-6">{userData?.first_name ? `${userData.first_name}'s Dashboard` : 'Dashboard'}</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Today Calendar */}
            <Card className="bg-[#ffffee] border-[#ffdea2] border-2">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#333333]">
                  Today <span className="text-sm font-normal">{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const today = new Date()

                  // Filter events
                  const todayEvents = calendarEvents.filter(event => {
                    const eventDate = event.start instanceof Date ? event.start : new Date(event.start.seconds * 1000)
                    return eventDate.toDateString() === today.toDateString()
                  })

                  // Filter todos for today
                  const todayTodos = todos.filter(todo => {
                    if (todo.start_date) {
                      let todoDate: Date
                      if (todo.start_date instanceof Date) {
                        todoDate = todo.start_date
                      } else if (typeof todo.start_date === 'string') {
                        todoDate = new Date(todo.start_date)
                      } else {
                        todoDate = todo.start_date.toDate()
                      }
                      return todoDate.toDateString() === today.toDateString()
                    }
                    return false
                  })

                  // Filter bookings for today
                  const todayBookings = bookings.filter(booking => {
                    if (booking.start_date) {
                      const bookingDate = booking.start_date instanceof Date ? booking.start_date : new Date(booking.start_date.seconds * 1000)
                      return bookingDate.toDateString() === today.toDateString()
                    }
                    return false
                  })

                  // Filter service assignments for today
                  const todayAssignments = serviceAssignments.filter(assignment => {
                    if (assignment.coveredDateStart) {
                      const assignmentDate = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart : new Date(assignment.coveredDateStart.seconds * 1000)
                      return assignmentDate.toDateString() === today.toDateString()
                    }
                    return false
                  })

                  const tomorrow = new Date(today)
                  tomorrow.setDate(today.getDate() + 1)

                  // Filter events for tomorrow
                  const tomorrowEvents = calendarEvents.filter(event => {
                    const eventDate = event.start instanceof Date ? event.start : new Date(event.start.seconds * 1000)
                    return eventDate.toDateString() === tomorrow.toDateString()
                  })

                  // Filter todos for tomorrow
                  const tomorrowTodos = todos.filter(todo => {
                    if (todo.start_date) {
                      let todoDate: Date
                      if (todo.start_date instanceof Date) {
                        todoDate = todo.start_date
                      } else if (typeof todo.start_date === 'string') {
                        todoDate = new Date(todo.start_date)
                      } else {
                        todoDate = todo.start_date.toDate()
                      }
                      return todoDate.toDateString() === tomorrow.toDateString()
                    }
                    return false
                  })

                  // Filter bookings for tomorrow
                  const tomorrowBookings = bookings.filter(booking => {
                    if (booking.start_date) {
                      const bookingDate = booking.start_date instanceof Date ? booking.start_date : new Date(booking.start_date.seconds * 1000)
                      return bookingDate.toDateString() === tomorrow.toDateString()
                    }
                    return false
                  })

                  // Filter service assignments for tomorrow
                  const tomorrowAssignments = serviceAssignments.filter(assignment => {
                    if (assignment.coveredDateStart) {
                      const assignmentDate = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart : new Date(assignment.coveredDateStart.seconds * 1000)
                      return assignmentDate.toDateString() === tomorrow.toDateString()
                    }
                    return false
                  })

                  const dayAfterTomorrow = new Date(today)
                  dayAfterTomorrow.setDate(today.getDate() + 2)

                  // Filter events for day after tomorrow
                  const dayAfterEvents = calendarEvents.filter(event => {
                    const eventDate = event.start instanceof Date ? event.start : new Date(event.start.seconds * 1000)
                    return eventDate.toDateString() === dayAfterTomorrow.toDateString()
                  })

                  // Filter todos for day after tomorrow
                  const dayAfterTodos = todos.filter(todo => {
                    if (todo.start_date) {
                      let todoDate: Date
                      if (todo.start_date instanceof Date) {
                        todoDate = todo.start_date
                      } else if (typeof todo.start_date === 'string') {
                        todoDate = new Date(todo.start_date)
                      } else {
                        todoDate = todo.start_date.toDate()
                      }
                      return todoDate.toDateString() === dayAfterTomorrow.toDateString()
                    }
                    return false
                  })

                  // Filter bookings for day after tomorrow
                  const dayAfterBookings = bookings.filter(booking => {
                    if (booking.start_date) {
                      const bookingDate = booking.start_date instanceof Date ? booking.start_date : new Date(booking.start_date.seconds * 1000)
                      return bookingDate.toDateString() === dayAfterTomorrow.toDateString()
                    }
                    return false
                  })

                  // Filter service assignments for day after tomorrow
                  const dayAfterAssignments = serviceAssignments.filter(assignment => {
                    if (assignment.coveredDateStart) {
                      const assignmentDate = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart : new Date(assignment.coveredDateStart.seconds * 1000)
                      return assignmentDate.toDateString() === dayAfterTomorrow.toDateString()
                    }
                    return false
                  })

                  return (
                    <>
                      <div className="space-y-2">
                        {/* Events */}
                        {todayEvents.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-gray-700 mb-1">Events:</div>
                            {todayEvents.slice(0, 2).map((event, index) => (
                              <div key={event.id} className={`p-2 rounded text-xs ${
                                event.type === 'meeting' ? 'bg-[#73bbff]/30' :
                                event.type === 'holiday' ? 'bg-[#ff9696]/30' :
                                event.type === 'party' ? 'bg-[#ffe522]/30' :
                                'bg-[#7fdb97]/30'
                              }`}>
                                <div className="font-medium">{event.title}</div>
                                <div className="text-[10px] text-gray-600 truncate">{event.location}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Todos */}
                        {todayTodos.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-gray-700 mb-1">Todos:</div>
                            {todayTodos.slice(0, 2).map((todo, index) => (
                              <div key={todo.id} className="p-2 rounded text-xs bg-[#ffe522]/30">
                                <div className="font-medium">{todo.title}</div>
                                <div className="text-[10px] text-gray-600 truncate">{todo.description}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Bookings */}
                        {todayBookings.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-gray-700 mb-1">Bookings:</div>
                            {todayBookings.slice(0, 2).map((booking, index) => (
                              <div key={booking.id} className="p-2 rounded text-xs bg-[#7fdb97]/30">
                                <div className="font-medium">{booking.reservation_id || booking.id.slice(-8)}</div>
                                <div className="text-[10px] text-gray-600 truncate">{booking.client?.name || "Unknown Client"}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Service Assignments */}
                        {todayAssignments.length > 0 && (
                          <>
                            <div className="text-xs font-medium text-gray-700 mb-1">Service Assignments:</div>
                            {todayAssignments.slice(0, 2).map((assignment, index) => (
                              <div key={assignment.id} className="p-2 rounded text-xs bg-[#73bbff]/30">
                                <div className="font-medium">{assignment.saNumber}</div>
                                <div className="text-[10px] text-gray-600 truncate">{assignment.projectSiteName}</div>
                              </div>
                            ))}
                          </>
                        )}

                        {todayEvents.length === 0 && todayTodos.length === 0 && todayBookings.length === 0 && todayAssignments.length === 0 && (
                          <div className="text-sm text-gray-600">No items for today.</div>
                        )}
                      </div>

                      <div className="pt-4 border-t">
                        <div className="font-medium text-[#333333] mb-2">{tomorrow.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                        <div className="space-y-1">
                          {/* Events */}
                          {tomorrowEvents.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Events:</div>
                              {tomorrowEvents.slice(0, 1).map((event, index) => (
                                <div key={event.id} className={`p-2 rounded text-xs mb-1 ${
                                  event.type === 'meeting' ? 'bg-[#73bbff]/30' :
                                  event.type === 'holiday' ? 'bg-[#ff9696]/30' :
                                  event.type === 'party' ? 'bg-[#ffe522]/30' :
                                  'bg-[#7fdb97]/30'
                                }`}>
                                  <div className="font-medium">{event.title}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Todos */}
                          {tomorrowTodos.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Todos:</div>
                              {tomorrowTodos.slice(0, 1).map((todo, index) => (
                                <div key={todo.id} className="p-2 rounded text-xs mb-1 bg-[#ffe522]/30">
                                  <div className="font-medium">{todo.title}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Bookings */}
                          {tomorrowBookings.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Bookings:</div>
                              {tomorrowBookings.slice(0, 1).map((booking, index) => (
                                <div key={booking.id} className="p-2 rounded text-xs mb-1 bg-[#7fdb97]/30">
                                  <div className="font-medium">{booking.reservation_id || booking.id.slice(-8)}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Service Assignments */}
                          {tomorrowAssignments.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Service Assignments:</div>
                              {tomorrowAssignments.slice(0, 1).map((assignment, index) => (
                                <div key={assignment.id} className="p-2 rounded text-xs mb-1 bg-[#73bbff]/30">
                                  <div className="font-medium">{assignment.saNumber}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {tomorrowEvents.length === 0 && tomorrowTodos.length === 0 && tomorrowBookings.length === 0 && tomorrowAssignments.length === 0 && (
                            <div className="text-sm text-gray-600">No items for this day.</div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="font-medium text-[#333333] mb-2">{dayAfterTomorrow.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                        <div className="space-y-1">
                          {/* Events */}
                          {dayAfterEvents.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Events:</div>
                              {dayAfterEvents.slice(0, 1).map((event, index) => (
                                <div key={event.id} className={`p-2 rounded text-xs mb-1 ${
                                  event.type === 'meeting' ? 'bg-[#73bbff]/30' :
                                  event.type === 'holiday' ? 'bg-[#ff9696]/30' :
                                  event.type === 'party' ? 'bg-[#ffe522]/30' :
                                  'bg-[#7fdb97]/30'
                                }`}>
                                  <div className="font-medium">{event.title}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Todos */}
                          {dayAfterTodos.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Todos:</div>
                              {dayAfterTodos.slice(0, 1).map((todo, index) => (
                                <div key={todo.id} className="p-2 rounded text-xs mb-1 bg-[#ffe522]/30">
                                  <div className="font-medium">{todo.title}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Bookings */}
                          {dayAfterBookings.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Bookings:</div>
                              {dayAfterBookings.slice(0, 1).map((booking, index) => (
                                <div key={booking.id} className="p-2 rounded text-xs mb-1 bg-[#7fdb97]/30">
                                  <div className="font-medium">{booking.reservation_id || booking.id.slice(-8)}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Service Assignments */}
                          {dayAfterAssignments.length > 0 && (
                            <>
                              <div className="text-xs font-medium text-gray-700 mb-1">Service Assignments:</div>
                              {dayAfterAssignments.slice(0, 1).map((assignment, index) => (
                                <div key={assignment.id} className="p-2 rounded text-xs mb-1 bg-[#73bbff]/30">
                                  <div className="font-medium">{assignment.saNumber}</div>
                                </div>
                              ))}
                            </>
                          )}

                          {dayAfterEvents.length === 0 && dayAfterTodos.length === 0 && dayAfterBookings.length === 0 && dayAfterAssignments.length === 0 && (
                            <div className="text-sm text-gray-600">No items for this day.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Occupancy Index */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-[#333333]">Occupancy Index</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Static BB</span>
                    <span className="font-semibold">{occupancy.staticUnavailable}/{occupancy.staticTotal}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">LED BB</span>
                    <span className="font-semibold">{occupancy.dynamicUnavailable}/{occupancy.dynamicTotal}</span>
                  </div>

                  <div className="flex items-center justify-center mt-6">
                    <div className="relative w-32 h-32">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#18da69"
                          strokeWidth="3"
                          strokeDasharray={`${occupancy.staticTotal + occupancy.dynamicTotal > 0 ? Math.round(((occupancy.staticUnavailable + occupancy.dynamicUnavailable) / (occupancy.staticTotal + occupancy.dynamicTotal)) * 100) : 0}, ${100 - (occupancy.staticTotal + occupancy.dynamicTotal > 0 ? Math.round(((occupancy.staticUnavailable + occupancy.dynamicUnavailable) / (occupancy.staticTotal + occupancy.dynamicTotal)) * 100) : 0)}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-[#333333]">{occupancy.staticTotal + occupancy.dynamicTotal > 0 ? Math.round(((occupancy.staticUnavailable + occupancy.dynamicUnavailable) / (occupancy.staticTotal + occupancy.dynamicTotal)) * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-[#18da69] rounded-full"></div>
                      <span>Occupied</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      <span>Vacant</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Occupancy Performance */}
            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold text-[#333333]">Occupancy Performance</CardTitle>
                <Select value={occupancyYear} onValueChange={setOccupancyYear}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-gradient-to-t from-[#4169e1] to-[#73bbff] rounded mb-4 relative">
                  <svg className="w-full h-full" viewBox="0 0 300 120">
                    {generateLineGraph()}
                    <defs>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#4169e1" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#73bbff" stopOpacity="0.2" />
                      </linearGradient>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#73bbff" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#4169e1" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm">
                    <span className="text-gray-600">Best month:</span>
                    <br />
                    <span className="font-semibold">{occupancyPerformance.bestMonth.name}- {occupancyPerformance.bestMonth.percentage}%</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Worst month:</span>
                    <br />
                    <span className="font-semibold">{occupancyPerformance.worstMonth.name}- {occupancyPerformance.worstMonth.percentage}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rate */}
            <Card className="bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-[#333333]">Conversion Rate</CardTitle>
                  <Select value={conversionYear} onValueChange={setConversionYear}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DateRangePicker
                  value={conversionDateRange}
                  onChange={setConversionDateRange}
                  placeholder="Select custom date range"
                  className="w-full mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#4169e1]">{conversionRate.quotations}</div>
                    <div className="text-sm text-gray-600">Quotations</div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#4169e1]">{conversionRate.bookings}</div>
                    <div className="text-sm text-gray-600">Reservations</div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#18da69"
                        strokeWidth="3"
                        strokeDasharray={`${conversionRate.rate}, ${100 - conversionRate.rate}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-[#333333]">{conversionRate.rate}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-2">
                  <span className="text-xs text-gray-600">conversion rate</span>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-[#18da69] rounded-full"></div>
                    <span>Reserved</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span>Pending</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Site Performance */}
            <Card className="bg-white lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold text-[#333333]">Site Performance</CardTitle>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Select date range"
                  className="w-64"
                />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-sm text-[#18da69] mb-2">Best performing</div>
                    <div className="text-lg font-semibold text-[#333333] mb-2">{sitePerformance.bestPerforming.name}</div>
                    <div className="text-4xl font-bold text-[#18da69]">{sitePerformance.bestPerforming.percentage}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-[#ff5252] mb-2">Worst performing</div>
                    <div className="text-lg font-semibold text-[#333333] mb-2">{sitePerformance.worstPerforming.name}</div>
                    <div className="text-4xl font-bold text-[#ff5252]">{sitePerformance.worstPerforming.percentage}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
    </div>
  )
}