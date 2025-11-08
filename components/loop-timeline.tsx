"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Clock, Play, Eye } from "lucide-react"
import { useState, useEffect } from "react"
import VideoUploadDialog from "./video-upload-dialog"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface CMSData {
  end_time: string
  loops_per_day: number
  spot_duration: number
  start_time: string
}

interface LoopTimelineProps {
  cmsData: CMSData
  productId?: string
  companyId?: string
  sellerId?: string
}

interface TimelineSpot {
  id: string
  name: string
  startTime: Date
  endTime: Date
  duration: number
  status: "active" | "pending" | "available"
  isScheduled: boolean
}

export function LoopTimeline({ cmsData, productId, companyId, sellerId }: LoopTimelineProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedSpotNumber, setSelectedSpotNumber] = useState<number | null>(null)
  const [screenSchedules, setScreenSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch screen schedules on component mount
  useEffect(() => {
    const fetchScreenSchedules = async () => {
      if (!productId) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const q = query(
          collection(db, "screen_schedule"),
          where("product_id", "==", productId),
          where("deleted", "==", false),
        )
        const querySnapshot = await getDocs(q)
        const schedules = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setScreenSchedules(schedules)
      } catch (error) {
        console.error("Error fetching screen schedules:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchScreenSchedules()
  }, [productId])

  // Extract CMS configuration from database structure
  const startTimeStr = cmsData.start_time // "16:44"
  const endTimeStr = cmsData.end_time // "18:44"
  const spotDuration = cmsData.spot_duration // 15 seconds
  const loopsPerDay = cmsData.loops_per_day // 20

  // Calculate spots per loop based on time difference
  const calculateSpotsPerLoop = () => {
    const [startHour, startMinute] = startTimeStr.split(":").map(Number)
    const [endHour, endMinute] = endTimeStr.split(":").map(Number)

    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    const loopDurationMinutes = endTotalMinutes - startTotalMinutes
    const loopDurationSeconds = loopDurationMinutes * 60

    return Math.floor(loopDurationSeconds / spotDuration)
  }

  const spotsPerLoop = calculateSpotsPerLoop()

  // Convert military time to 12-hour format
  const convertTo12Hour = (militaryTime: string) => {
    const [hours, minutes] = militaryTime.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`
  }

  // Parse start and end times
  const [startHour, startMinute] = startTimeStr.split(":").map(Number)
  const [endHour, endMinute] = endTimeStr.split(":").map(Number)

  const loopStartTime = new Date()
  loopStartTime.setHours(startHour, startMinute, 0, 0)

  const loopEndTime = new Date()
  loopEndTime.setHours(endHour, endMinute, 0, 0)

  // Calculate total loop duration in seconds
  const totalLoopDuration = spotsPerLoop * spotDuration

  // Generate timeline spots based on calculated spots per loop
  const generateTimelineSpots = (): TimelineSpot[] => {
    const spots: TimelineSpot[] = []
    let currentTime = new Date(loopStartTime)

    for (let i = 0; i < loopsPerDay; i++) {
      const spotEndTime = new Date(currentTime.getTime() + spotDuration * 1000)
      const spotNumber = i + 1

      // Check if this spot has scheduled content
      const hasScheduledContent = screenSchedules.some(
        (schedule) => schedule.spot_number === spotNumber && schedule.active,
      )

      spots.push({
        id: `SPOT${String(spotNumber).padStart(3, "0")}`,
        name: `Spot ${spotNumber}`,
        startTime: new Date(currentTime),
        endTime: new Date(spotEndTime),
        duration: spotDuration,
        status: hasScheduledContent ? "active" : "available",
        isScheduled: hasScheduledContent,
      })

      currentTime = new Date(spotEndTime)
    }

    return spots
  }

  const timelineSpots = generateTimelineSpots()

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "available":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const handleAddSpot = (spotNumber: number) => {
    setSelectedSpotNumber(spotNumber)
    setUploadDialogOpen(true)
  }

  const handleViewSpot = (spotNumber: number) => {
    // Find the scheduled content for this spot
    const scheduledContent = screenSchedules.find((schedule) => schedule.spot_number === spotNumber && schedule.active)

    if (scheduledContent && scheduledContent.media) {
      // Open the video in a new tab/window
      window.open(scheduledContent.media, "_blank")
    }
  }

  const handleUploadSuccess = async () => {
    setUploadDialogOpen(false)
    setSelectedSpotNumber(null)

    // Refresh screen schedules
    if (productId) {
      try {
        const q = query(
          collection(db, "screen_schedule"),
          where("product_id", "==", productId),
          where("deleted", "==", false),
        )
        const querySnapshot = await getDocs(q)
        const schedules = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setScreenSchedules(schedules)
      } catch (error) {
        console.error("Error refreshing screen schedules:", error)
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading timeline...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Loop Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={18} />
            First Loop Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Spots per Loop:</span>
              <div className="text-lg font-semibold">{loopsPerDay}</div>
            </div>
            <div>
              <span className="font-medium text-gray-500">Spot Duration:</span>
              <div className="text-lg font-semibold">{spotDuration}s</div>
            </div>
            <div>
              <span className="font-medium text-gray-500">Loop Time:</span>
              <div className="text-lg font-semibold">
                {convertTo12Hour(startTimeStr)} - {convertTo12Hour(endTimeStr)}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-500">Total Loop Duration:</span>
              <div className="text-lg font-semibold">{formatDuration(totalLoopDuration)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play size={18} />
            First Loop Timeline ({loopsPerDay} Spots)
          </CardTitle>
          <div className="text-sm text-gray-500">
            Loop runs from {convertTo12Hour(startTimeStr)} to {convertTo12Hour(endTimeStr)} (
            {formatDuration(totalLoopDuration)} total)
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Timeline Header */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <span className="font-medium">Start: {convertTo12Hour(startTimeStr)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <span className="font-medium">End: {convertTo12Hour(endTimeStr)}</span>
              </div>
            </div>

            {/* Timeline Spots */}
            <div className="space-y-3">
              {timelineSpots.map((spot, index) => (
                <div
                  key={spot.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Spot Number */}
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="font-semibold text-blue-700">{index + 1}</span>
                  </div>

                  {/* Spot Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{spot.name}</h3>
                      <Badge variant="outline" className={getStatusColor(spot.status)}>
                        {spot.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-mono">
                        {formatTime(spot.startTime)} - {formatTime(spot.endTime)}
                      </span>
                      <span className="ml-2">({spot.duration}s duration)</span>
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div className="flex-1 max-w-xs">
                    <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          spot.status === "active"
                            ? "bg-green-500"
                            : spot.status === "pending"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                        }`}
                        style={{
                          width: `${(spot.duration / totalLoopDuration) * 100}%`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-white mix-blend-difference">{spot.duration}s</span>
                      </div>
                    </div>
                  </div>

                  {/* Add/View Button */}
                  {spot.isScheduled ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-shrink-0"
                      onClick={() => handleViewSpot(index + 1)}
                    >
                      <Eye size={16} />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 bg-transparent"
                      onClick={() => handleAddSpot(index + 1)}
                    >
                      <Plus size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Timeline Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">First Loop Summary</h4>
                  <p className="text-sm text-blue-700">
                    This loop contains {spotsPerLoop} advertising spots and will repeat {loopsPerDay} times throughout
                    the day
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-blue-900">{formatDuration(totalLoopDuration)}</div>
                  <div className="text-sm text-blue-700">Loop Duration</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Active Spots:</span>
                  <span className="ml-1">{timelineSpots.filter((s) => s.status === "active").length}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Pending Spots:</span>
                  <span className="ml-1">{timelineSpots.filter((s) => s.status === "pending").length}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Available Spots:</span>
                  <span className="ml-1">{timelineSpots.filter((s) => s.status === "available").length}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Upload Dialog */}
      <VideoUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadSuccess={handleUploadSuccess}
        productId={productId}
        spotNumber={selectedSpotNumber}
        companyId={companyId}
        sellerId={sellerId}
      />
    </div>
  )
}

export default LoopTimeline
