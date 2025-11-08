"use client"

import { notFound, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Calendar,
  FileText,
  User,
  ArrowLeft,
  Loader2,
  Paperclip,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getJobOrderById } from "@/lib/job-order-service"
import type { JobOrder } from "@/lib/types/job-order"
import { useAuth } from "@/contexts/auth-context"

// Helper function to convert Firebase timestamp to readable date
export const formatFirebaseDate = (timestamp: any): string => {
  if (!timestamp) return ""

  try {
    // Check if it's a Firebase Timestamp object
    if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    }

    // If it's already a string or Date, handle accordingly
    if (typeof timestamp === "string") {
      return timestamp
    }

    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    }

    return ""
  } catch (error) {
    console.error("Error formatting date:", error)
    return ""
  }
}

type Props = {
  params: { id: string }
}

export default function JobOrderDetailsPage({ params }: Props) {
  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()
  const { userData } = useAuth()

  // Fetch job order data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getJobOrderById(params.id)
        if (!data) {
          notFound()
        }
        setJobOrder(data)
      } catch (err) {
        setError(err as Error)
        console.error("Error fetching job order:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "approved":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-purple-100 text-purple-800 border-purple-200"
    }
  }

  // Helper function to get type color
  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case "installation":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "repair":
        return "bg-red-100 text-red-800 border-red-200"
      case "dismantling":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-purple-100 text-purple-800 border-purple-200"
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-4 space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Job Order</h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!jobOrder) {
    notFound()
  }

  return (
    <div className="container mx-auto py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/logistics/job-orders")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Job Orders
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Job Order Details</h1>
          <p className="text-gray-600">{jobOrder.joNumber}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">JO Number</label>
                  <p className="text-lg font-semibold">{jobOrder.joNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  <div className="mt-1">
                    <Badge variant="outline" className={getTypeColor(jobOrder.joType)}>
                      {jobOrder.joType}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">
                    <Badge variant="outline" className={getStatusColor(jobOrder.status)}>
                      {jobOrder.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Site</label>
                  <p className="text-sm">{jobOrder.siteName}</p>
                </div>
              </div>

              {jobOrder.siteLocation && (
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Location
                  </label>
                  <p className="text-sm">{jobOrder.siteLocation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Date Requested</label>
                  <p className="text-sm">{formatFirebaseDate(jobOrder.dateRequested) || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Deadline</label>
                  <p className="text-sm">{formatFirebaseDate(jobOrder.deadline) || "N/A"}</p>
                </div>
              </div>

              {jobOrder.contractPeriodStart && jobOrder.contractPeriodEnd && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Contract Period</label>
                  <p className="text-sm">
                    {formatFirebaseDate(jobOrder.contractPeriodStart)} - {formatFirebaseDate(jobOrder.contractPeriodEnd)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Requested By</label>
                <p className="text-sm">{jobOrder.requestedBy}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Assigned To</label>
                <p className="text-sm">{jobOrder.assignTo || "Unassigned"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {jobOrder.jobDescription || "No description provided."}
              </p>
            </CardContent>
          </Card>

          {/* Message */}
          {jobOrder.message && (
            <Card>
              <CardHeader>
                <CardTitle>Message</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{jobOrder.message}</p>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          {jobOrder.attachments && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{jobOrder.attachments.name}</p>
                      <p className="text-xs text-gray-500">{jobOrder.attachments.type}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(jobOrder.attachments!.url, "_blank")}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Details */}
          {(jobOrder.materialSpec || jobOrder.illumination) && (
            <Card>
              <CardHeader>
                <CardTitle>Technical Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {jobOrder.materialSpec && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Material Specification</label>
                    <p className="text-sm">{jobOrder.materialSpec}</p>
                  </div>
                )}
                {jobOrder.illumination && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Illumination</label>
                    <p className="text-sm">{jobOrder.illumination}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
