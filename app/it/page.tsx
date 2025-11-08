"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, User } from "lucide-react"
import { RouteProtection } from "@/components/route-protection"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, onSnapshot, getDocs, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getUserRoles, type RoleType } from "@/lib/hardcoded-access-service"
import { getSalesEvents, type SalesEvent } from "@/lib/planner-service"
import { getTodosByUser } from "@/lib/todo-service"
import type { Todo } from "@/lib/types/todo"
import { bookingService } from "@/lib/booking-service"
import type { Booking } from "@/lib/booking-service"

interface User {
  id: string
  email: string
  displayName: string
  role: string
  status: string
  lastLogin: Date | null
  created: Date
}

export default function ITPage() {
  const { userData } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [departmentCounts, setDepartmentCounts] = useState<Record<string, number>>({})
  const [events, setEvents] = useState<SalesEvent[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [serviceAssignments, setServiceAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [departmentLoading, setDepartmentLoading] = useState(true)

  // Role to department mapping
  const roleToDepartment: Record<string, string> = {
    admin: "Admin",
    sales: "Sales",
    logistics: "Logistics",
    cms: "Content Management",
    it: "Soft Admin (I.T.)",
    business: "Business Dev.",
    treasury: "Treasury",
  }

  useEffect(() => {
    if (!userData?.company_id) {
      setLoading(false)
      return
    }

    const q = query(collection(db, "iboard_users"), where("company_id", "==", userData.company_id))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          email: data.email || "",
          displayName:
            data.first_name && data.last_name
              ? `${data.first_name} ${data.last_name}`
              : data.display_name || data.displayName || "Unknown User",
          role: String(data.role || "user"),
          status: data.active === false ? "inactive" : "active",
          lastLogin: data.lastLogin?.toDate() || null,
          created: data.created?.toDate() || new Date(),
        }
      })
      setUsers(usersData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [userData?.company_id])

  // Calculate department counts
  useEffect(() => {
    const calculateDepartmentCounts = async () => {
      setDepartmentLoading(true)
      if (users.length === 0) {
        setDepartmentCounts({})
        setDepartmentLoading(false)
        return
      }

      const counts: Record<string, number> = {}
      // Initialize departments
      Object.values(roleToDepartment).forEach((dept) => {
        counts[dept] = 0
      })

      // Count users per department
      for (const user of users) {
        try {
          const userRoles = await getUserRoles(user.id)
          userRoles.forEach((roleId) => {
            const dept = roleToDepartment[roleId]
            if (dept) counts[dept]++
          })
        } catch (error) {
          console.error(`Error getting roles for user ${user.id}:`, error)
        }
      }

      setDepartmentCounts(counts)
      setDepartmentLoading(false)
    }

    calculateDepartmentCounts()
  }, [users])

  // Fetch events for IT department
  const fetchEvents = async () => {
    if (!userData?.company_id) {
      setEvents([])
      return
    }

    try {
      const isAdmin = userData.role === "admin"
      const userDepartment = "it"
      const fetchedEvents = await getSalesEvents(isAdmin, userDepartment, userData.company_id)
      setEvents(fetchedEvents)
    } catch (error) {
      console.error("Error fetching events:", error)
      setEvents([])
    }
  }

  const fetchTodos = async () => {
    if (!userData?.company_id) {
      setTodos([])
      return
    }

    try {
      const fetchedTodos = await getTodosByUser("", userData.company_id, "it")
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

  useEffect(() => {
    fetchEvents()
    fetchTodos()
    fetchBookings()
    fetchServiceAssignments()
  }, [userData])

  return (
    <RouteProtection requiredRoles="it">
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 pt-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{userData?.first_name || 'User'}'s Dashboard</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Schedule Card */}
          <Card className="bg-[#ffffee] border-[#ffdea2] border-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#333333]">
                Today <span className="text-sm font-normal">{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Today's events */}
              <div className="space-y-2">
                {(() => {
                  const today = new Date()

                  // Filter events
                  const todayEvents = events.filter(event => {
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

                  return (
                    <>
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
                    </>
                  )
                })()}
              </div>

              <div className="pt-4 border-t">
                <div className="font-medium text-[#333333] mb-2">{(() => {
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  return tomorrow.toLocaleDateString([], { month: 'short', day: 'numeric' })
                })()}</div>
                {(() => {
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 1)

                  // Filter events for tomorrow
                  const tomorrowEvents = events.filter(event => {
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

                  return (
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
                  )
                })()}
              </div>

              <div className="pt-4 border-t">
                <div className="font-medium text-[#333333] mb-2">{(() => {
                  const dayAfter = new Date()
                  dayAfter.setDate(dayAfter.getDate() + 2)
                  return dayAfter.toLocaleDateString([], { month: 'short', day: 'numeric' })
                })()}</div>
                {(() => {
                  const dayAfter = new Date()
                  dayAfter.setDate(dayAfter.getDate() + 2)

                  // Filter events for day after tomorrow
                  const dayAfterEvents = events.filter(event => {
                    const eventDate = event.start instanceof Date ? event.start : new Date(event.start.seconds * 1000)
                    return eventDate.toDateString() === dayAfter.toDateString()
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
                      return todoDate.toDateString() === dayAfter.toDateString()
                    }
                    return false
                  })

                  // Filter bookings for day after tomorrow
                  const dayAfterBookings = bookings.filter(booking => {
                    if (booking.start_date) {
                      const bookingDate = booking.start_date instanceof Date ? booking.start_date : new Date(booking.start_date.seconds * 1000)
                      return bookingDate.toDateString() === dayAfter.toDateString()
                    }
                    return false
                  })

                  // Filter service assignments for day after tomorrow
                  const dayAfterAssignments = serviceAssignments.filter(assignment => {
                    if (assignment.coveredDateStart) {
                      const assignmentDate = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart : new Date(assignment.coveredDateStart.seconds * 1000)
                      return assignmentDate.toDateString() === dayAfter.toDateString()
                    }
                    return false
                  })

                  return (
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
                  )
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Total Users Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  {departmentLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-6" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    Object.entries(departmentCounts).map(([dept, count]) => (
                      <div key={dept} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 mr-2">{dept}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="text-center">
                  <div className="text-6xl font-bold text-gray-900 mb-2">{loading ? "..." : users.length}</div>
                  <div className="text-sm text-gray-600">Total users</div>
                </div>
              </div>
              <Link href="/it/user-management">
                <Button variant="outline" className="w-full bg-transparent">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Teammates
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* User Activity Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">User Activity</CardTitle>
              <Select defaultValue="last7days">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">last 7 days</SelectItem>
                  <SelectItem value="last30days">last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sales</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: "0%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Logistics</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: "0%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Treasury</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: "0%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Business Dev.</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: "0%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Admin</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: "0%" }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Soft Admin (I.T.)</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gray-400 h-2 rounded-full" style={{ width: "0%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-4">
                  <span>Hours</span>
                  <div className="flex gap-8">
                    <span>0</span>
                    <span>10</span>
                    <span>20</span>
                    <span>30</span>
                    <span>40</span>
                    <span>50</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Devices Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Total LED Screens</div>
                  <div className="text-2xl font-bold">0</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Online</span>
                      <span className="font-medium">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Offline</span>
                      <span className="font-medium">0</span>
                    </div>
                  </div>
                </div>
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-200"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${0 * 2.51} ${100 * 2.51}`}
                      className="text-gray-400"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">0%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <span className="text-gray-600">Offline</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Integration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-gray-600 text-center">Coming soon.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </RouteProtection>
  )
}
