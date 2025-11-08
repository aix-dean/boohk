"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getJobOrderById } from "@/lib/job-order-service"
import { generateJobOrderPDF } from "@/lib/job-order-pdf-generator"
import type { JobOrder } from "@/lib/types/job-order"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar, User, MapPin, FileText, Download, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { Timestamp } from "firebase/firestore"

// Helper function to safely parse date values (copied from app/sales/job-orders/page.tsx)
const safeParseDate = (dateValue: string | Date | Timestamp | undefined): Date | null => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export default function JobOrderDetailsPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchJobOrder = async () => {
      if (!user?.uid || !id) {
        setError("User not authenticated or Job Order ID is missing.")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const fetchedJobOrder = await getJobOrderById(id as string)
        if (fetchedJobOrder) {
          setJobOrder(fetchedJobOrder)
        } else {
          setError("Job Order not found.")
        }
      } catch (err: any) { // Explicitly type error
        console.error("Failed to fetch job order:", err)
        setError("Failed to load job order details. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchJobOrder()
  }, [user?.uid, id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Job Orders
          </Button>
          <Card className="border-gray-200 shadow-sm rounded-xl">
            <CardHeader>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="grid gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-red-500">
        <p>{error}</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Job Orders
        </Button>
      </div>
    )
  }

  if (!jobOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-gray-600">
        <p>Job Order not found.</p>
        <Button onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Job Orders
        </Button>
      </div>
    )
  }

  const dateRequested = safeParseDate(jobOrder.dateRequested);
  const deadline = safeParseDate(jobOrder.deadline);

  const handleDownloadPDF = async () => {
    try {
      await generateJobOrderPDF(jobOrder, 'download')
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200"
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      {/* Sticky Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sales/job-orders")}
          className="text-black hover:bg-gray-100 p-1 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-black font-medium">Job Order Details</span>
        <span className="text-black italic ml-2">{jobOrder.joNumber}</span>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className={getStatusColor(jobOrder.status || "")}
          >
            {jobOrder.status?.toUpperCase() || "PENDING"}
          </Badge>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div className="w-full max-w-4xl">
            {/* Document Container */}
            <div className="bg-white shadow-lg print:shadow-none print:mx-0 print:my-0 relative overflow-hidden">
              {/* Document Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">Job Order Details</h1>
                    <p className="text-blue-100 mt-1">Job Order: {jobOrder.joNumber}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-3 py-1 ${
                      jobOrder.status?.toLowerCase() === "approved"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : jobOrder.status?.toLowerCase() === "completed"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-800 border-gray-300"
                    }`}
                  >
                    {jobOrder.status?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
              </div>

              {/* Document Content */}
              <div className="p-6 space-y-8">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Basic Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Job Order Number</label>
                      <p className="text-base text-gray-900">{jobOrder.joNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Job Type</label>
                      <p className="text-base text-gray-900">{jobOrder.joType}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Site Name</label>
                      <p className="text-base text-gray-900">{jobOrder.siteName}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Site Location</label>
                      <p className="text-base text-gray-900">{jobOrder.siteLocation || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Requested By</label>
                      <p className="text-base text-gray-900">{jobOrder.requestedBy}</p>
                    </div>
                    <div className="space-y-1">
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Date Requested</label>
                      <p className="text-base text-gray-900">{dateRequested ? format(dateRequested, "PPP") : "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Deadline</label>
                      <p className="text-base text-gray-900">{deadline ? format(deadline, "PPP") : "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Job Description Section */}
                {jobOrder.jobDescription && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Job Description
                    </h2>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700">{jobOrder.jobDescription}</p>
                    </div>
                  </div>
                )}

                {/* Client Information Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Client Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Client Name</label>
                      <p className="text-base text-gray-900">{jobOrder.clientName || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Client Company</label>
                      <p className="text-base text-gray-900">{jobOrder.clientCompany || "N/A"}</p>
                    </div>
                    {jobOrder.quotationNumber && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Quotation Number</label>
                        <p className="text-base text-gray-900">{jobOrder.quotationNumber}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Information Section */}
                {(jobOrder.message || jobOrder.remarks) && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Additional Information
                    </h2>
                    {jobOrder.message && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Message</label>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700">{jobOrder.message}</p>
                        </div>
                      </div>
                    )}
                    {jobOrder.remarks && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Remarks</label>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700">{jobOrder.remarks}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments Section */}
                {jobOrder.attachments && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      Attachments
                    </h2>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <a
                          href={jobOrder.attachments.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex-1"
                        >
                          {jobOrder.attachments.name}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Timeline
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-base font-semibold text-gray-900">Job Order Created</p>
                        <p className="text-sm text-gray-600">{dateRequested ? format(dateRequested, "PPP") : "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                        jobOrder.status?.toLowerCase() === "completed" ? "bg-green-500" :
                        jobOrder.status?.toLowerCase() === "approved" ? "bg-blue-500" : "bg-gray-400"
                      }`}></div>
                      <div>
                        <p className="text-base font-semibold text-gray-900">Current Status</p>
                        <p className="text-sm text-gray-600">{jobOrder.status || "Pending"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 p-6 overflow-y-auto bg-gray-50">
          {/* Document Info */}
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Document Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">Job Order</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-mono text-xs">{jobOrder.joNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">{dateRequested ? format(dateRequested, "PPP") : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deadline:</span>
                  <span className="font-medium">{deadline ? format(deadline, "PPP") : "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Status Overview */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Status Overview</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    jobOrder.status?.toLowerCase() === "approved" ? "bg-green-500" :
                    jobOrder.status?.toLowerCase() === "completed" ? "bg-green-500" :
                    jobOrder.status?.toLowerCase() === "pending" ? "bg-blue-500" : "bg-gray-400"
                  }`}></div>
                  <span className="text-sm font-medium">{jobOrder.status || "Pending"}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Last updated: {dateRequested ? format(dateRequested, "PPP") : "N/A"}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleDownloadPDF}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/sales/job-orders")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to List
                </Button>
              </div>
            </div>

            {/* Job Details Summary */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{jobOrder.joType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Site:</span>
                  <span className="font-medium">{jobOrder.siteName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned:</span>
                  <span className="font-medium">{jobOrder.assignTo || "Unassigned"}</span>
                </div>
                {jobOrder.attachments && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Attachments:</span>
                    <span className="font-medium">{jobOrder.attachments ? 1 : 0}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
