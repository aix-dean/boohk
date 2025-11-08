"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Clock, XCircle, Info, Loader2, BookOpen, Briefcase, Calendar } from "lucide-react"
import { bookingService, type Booking } from "@/lib/booking-service"
import { getJobOrdersByCompanyId, type JobOrder } from "@/lib/job-order-service"
import { getSalesEvents, type SalesEvent } from "@/lib/planner-service"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface BulletinBoardActivity {
  id: string
  title: string
  description: string
  timestamp: Date
  user: { name: string; avatar: string }
  type: "booking" | "job_order" | "planner"
  status?: string
  badge?: string
  metadata?: any
}

const formatDateTime = (date: Date) => {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const getStatusBadgeVariant = (status: string, type: BulletinBoardActivity["type"]) => {
  if (type === "booking") {
    switch (status?.toLowerCase()) {
      case "completed":
        return "default"
      case "pending":
        return "secondary"
      case "cancelled":
        return "destructive"
      default:
        return "outline"
    }
  } else if (type === "job_order") {
    switch (status?.toLowerCase()) {
      case "completed":
        return "default"
      case "in_progress":
        return "secondary"
      case "pending":
        return "outline"
      case "cancelled":
        return "destructive"
      default:
        return "outline"
    }
  } else if (type === "planner") {
    switch (status?.toLowerCase()) {
      case "completed":
        return "default"
      case "scheduled":
        return "secondary"
      case "cancelled":
        return "destructive"
      default:
        return "outline"
    }
  }
  return "outline"
}

const getActivityIcon = (type: BulletinBoardActivity["type"]) => {
  switch (type) {
    case "booking":
      return <BookOpen className="h-4 w-4 text-blue-500" />
    case "job_order":
      return <Briefcase className="h-4 w-4 text-purple-500" />
    case "planner":
      return <Calendar className="h-4 w-4 text-green-500" />
    default:
      return <Info className="h-4 w-4 text-gray-500" />
  }
}

export default function SalesBulletinBoardPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<BulletinBoardActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLatestActivities = async () => {
      if (!user?.uid) return

      try {
        setLoading(true)
        const allActivities: BulletinBoardActivity[] = []

        const today = new Date()
        const fiveDaysAgo = new Date()
        fiveDaysAgo.setDate(today.getDate() - 4) // 5 days including today
        fiveDaysAgo.setHours(0, 0, 0, 0) // Start of day
        today.setHours(23, 59, 59, 999) // End of day

        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(today.getDate() - 2) // 3 days including today
        threeDaysAgo.setHours(0, 0, 0, 0) // Start of day

        // Fetch latest bookings
        try {
          const bookings = await bookingService.getCompletedBookings(user.company_id || user.uid, {
            page: 1,
            pageSize: 50, // Increased to get more data for filtering
          })

          bookings.forEach((booking: Booking) => {
            const createdDate = booking.created?.toDate ? booking.created.toDate() : new Date(booking.created)
            if (createdDate >= fiveDaysAgo && createdDate <= today) {
              allActivities.push({
                id: `booking-${booking.id}`,
                title: `Booking: ${booking.username}`,
                description: `${booking.type} - ${booking.product_owner} (₱${booking.total_cost?.toLocaleString()})`,
                timestamp: createdDate,
                user: {
                  name: booking.username || "Unknown Client",
                  avatar: `/placeholder.svg?height=32&width=32&query=${encodeURIComponent(booking.username || "Client")}`,
                },
                type: "booking",
                status: booking.status,
                badge: booking.status?.replace(/_/g, " "),
                metadata: booking,
              })
            }
          })
        } catch (bookingError) {
          console.error("Error fetching bookings:", bookingError)
        }

        // Fetch latest job orders
        try {
          const jobOrders = await getJobOrdersByCompanyId(user.company_id || user.uid)

          jobOrders.forEach((jobOrder: JobOrder) => {
            const createdDate = jobOrder.createdAt?.toDate ? jobOrder.createdAt.toDate() : new Date(jobOrder.createdAt)
            if (createdDate >= threeDaysAgo && createdDate <= today) {
              allActivities.push({
                id: `job_order-${jobOrder.id}`,
                title: `Job Order: ${jobOrder.joNumber}`,
                description: `${jobOrder.joType} - ${jobOrder.siteName} (Assigned to: ${jobOrder.assignTo})`,
                timestamp: createdDate,
                user: {
                  name: jobOrder.requestedBy || "Unknown User",
                  avatar: `/placeholder.svg?height=32&width=32&query=${encodeURIComponent(jobOrder.requestedBy || "User")}`,
                },
                type: "job_order",
                status: jobOrder.status,
                badge: jobOrder.status?.replace(/_/g, " "),
                metadata: jobOrder,
              })
            }
          })
        } catch (jobOrderError) {
          console.error("Error fetching job orders:", jobOrderError)
        }

        try {
          const plannerEvents = await getSalesEvents(user.company_id || user.uid)

          const currentDate = new Date()
          const sortedPlannerEvents = plannerEvents
            .filter((event: SalesEvent) => {
              const endDate = event.end?.toDate ? event.end.toDate() : new Date(event.end)
              return endDate >= currentDate // Only show events that haven't ended yet
            })
            .sort((a, b) => {
              const dateA = a.created?.toDate ? a.created.toDate() : new Date(a.created)
              const dateB = b.created?.toDate ? b.created.toDate() : new Date(b.created)
              return dateB.getTime() - dateA.getTime()
            })
            .slice(0, 5)

          sortedPlannerEvents.forEach((event: SalesEvent) => {
            const createdDate = event.created?.toDate ? event.created.toDate() : new Date(event.created)
            allActivities.push({
              id: `planner-${event.id}`,
              title: `Event: ${event.title}`,
              description: `${event.type} with ${event.clientName} at ${event.location}`,
              timestamp: createdDate,
              user: {
                name: event.clientName || "Unknown Client",
                avatar: `/placeholder.svg?height=32&width=32&query=${encodeURIComponent(event.clientName || "Client")}`,
              },
              type: "planner",
              status: event.status,
              badge: event.status?.replace(/_/g, " "),
              metadata: event,
            })
          })
        } catch (plannerError) {
          console.error("Error fetching planner events:", plannerError)
        }

        // Sort activities by timestamp in descending order (latest first)
        allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

        setActivities(allActivities)
      } catch (err) {
        console.error("Failed to fetch bulletin board activities:", err)
        setError("Failed to load bulletin board. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchLatestActivities()
  }, [user])

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:gap-6">
        <h1 className="text-xl md:text-2xl font-bold">Sales Bulletin Board</h1>
        <p className="text-gray-600">Stay updated with activities from the last 5 days.</p>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Latest Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">Loading activities...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <XCircle className="h-6 w-6 mr-2" />
                <span>{error}</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <span>No activities found.</span>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)] pr-4">
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4">
                      <div className="flex-shrink-0 pt-1">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{activity.title}</h3>
                          {activity.badge && (
                            <Badge variant={getStatusBadgeVariant(activity.status || "", activity.type)}>
                              {activity.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{activity.description}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-2">
                          <Avatar className="h-4 w-4 mr-1">
                            <AvatarImage src={activity.user.avatar || "/placeholder.svg"} alt={activity.user.name} />
                            <AvatarFallback className="bg-gray-200 text-gray-700 text-[0.6rem]">
                              {activity.user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span>{activity.user.name}</span>
                          <Separator orientation="vertical" className="h-3 mx-2" />
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{formatDateTime(activity.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
