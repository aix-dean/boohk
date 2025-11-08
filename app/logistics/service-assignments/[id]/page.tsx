"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import Image from "next/image"
import { generateServiceAssignmentPDF } from "@/lib/pdf-service"

interface ServiceAssignment {
  id: string
  saNumber: string
  projectSiteId: string
  projectSiteName: string
  projectSiteLocation: string
  serviceType: string
  assignedTo: string
  crew?: string
  message: string
  campaignName?: string
  coveredDateStart: any
  coveredDateEnd: any
  alarmDate?: any
  alarmTime?: string
  status: string
  created: any
  updated?: any
  attachments?: Array<{
    name: string
    type: string
  }>
  requestedBy: {
    id: string
    name: string
    department: string
  }
  remarks?: string
  materialSpecs?: string
  illuminationNits?: string
  gondola?: string
  technology?: string
  sales?: string
  serviceCost?: {
    crewFee: string
    mealAllowance: string
    overtimeFee: string
    tollFee: string
    transpo: string
    total: number
    otherFees?: any[]
  }
  serviceDuration?: string
  equipmentRequired?: string
  priority?: string
  project_key?: string
}

export default function ServiceAssignmentDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [assignment, setAssignment] = useState<ServiceAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const assignmentId = params.id as string

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!assignmentId || !user?.uid) return

      try {
        setLoading(true)
        const assignmentDoc = await getDoc(doc(db, "service_assignments", assignmentId))

        if (assignmentDoc.exists()) {
          const data = assignmentDoc.data()
          setAssignment({
            id: assignmentDoc.id,
            ...data,
          } as ServiceAssignment)
        } else {
          toast({
            title: "Assignment not found",
            description: "The requested service assignment could not be found.",
            variant: "destructive",
          })
          router.push("/logistics/assignments")
        }
      } catch (error) {
        console.error("Error fetching assignment:", error)
        toast({
          title: "Error",
          description: "Failed to load service assignment details.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAssignment()
  }, [assignmentId, user?.uid, router, toast])

  const handleMarkComplete = async () => {
    if (!assignment) return

    try {
      setUpdating(true)
      await updateDoc(doc(db, "service_assignments", assignment.id), {
        status: "Completed",
        updated: new Date(),
      })

      setAssignment({
        ...assignment,
        status: "Completed",
        updated: new Date(),
      })

      toast({
        title: "Assignment completed",
        description: "The service assignment has been marked as complete.",
      })
    } catch (error) {
      console.error("Error updating assignment:", error)
      toast({
        title: "Error",
        description: "Failed to update assignment status.",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      // Prepare the service assignment data for PDF generation
      const serviceAssignmentData = {
        saNumber: assignment.saNumber || assignment.id.substring(0, 8),
        projectSiteName: assignment.projectSiteName || "N/A",
        projectSiteLocation: assignment.projectSiteLocation || "N/A",
        serviceType: assignment.serviceType || "N/A",
        assignedTo: assignment.assignedTo || "N/A",
        serviceDuration: assignment.serviceDuration || "N/A",
        priority: assignment.priority || "Normal",
        equipmentRequired: assignment.equipmentRequired || "N/A",
        materialSpecs: assignment.materialSpecs || "N/A",
        crew: assignment.crew || assignment.assignedTo || "N/A",
        illuminationNits: assignment.illuminationNits || "N/A",
        gondola: assignment.gondola || "N/A",
        technology: assignment.technology || "N/A",
        sales: assignment.sales || "N/A",
        remarks: assignment.remarks || assignment.message || "No remarks provided.",
        requestedBy: {
          name: assignment.requestedBy?.name || "Unknown User",
          department: assignment.requestedBy?.department || "Department not specified",
        },
        startDate: assignment.coveredDateStart
          ? assignment.coveredDateStart.toDate
            ? assignment.coveredDateStart.toDate()
            : new Date(assignment.coveredDateStart)
          : null,
        endDate: assignment.coveredDateEnd
          ? assignment.coveredDateEnd.toDate
            ? assignment.coveredDateEnd.toDate()
            : new Date(assignment.coveredDateEnd)
          : null,
        alarmDate: assignment.alarmDate
          ? assignment.alarmDate.toDate
            ? assignment.alarmDate.toDate()
            : new Date(assignment.alarmDate)
          : null,
        alarmTime: assignment.alarmTime || "N/A",
        attachments: assignment.attachments || [],
        serviceCost: {
          crewFee: assignment.serviceCost?.crewFee || "0",
          overtimeFee: assignment.serviceCost?.overtimeFee || "0",
          transpo: assignment.serviceCost?.transpo || "0",
          tollFee: assignment.serviceCost?.tollFee || "0",
          mealAllowance: assignment.serviceCost?.mealAllowance || "0",
          otherFees: assignment.serviceCost?.otherFees || [],
          total: assignment.serviceCost?.total || 0,
        },
        status: assignment.status || "Pending",
        created: assignment.created
          ? assignment.created.toDate
            ? assignment.created.toDate()
            : new Date(assignment.created)
          : new Date(),
      }

      // Generate and download the PDF
      await generateServiceAssignmentPDF(serviceAssignmentData, false)

      toast({
        title: "PDF Downloaded",
        description: "Service assignment PDF has been generated and downloaded successfully.",
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDate = (date: any) => {
    if (!date) return "Not specified"
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date)
      return format(dateObj, "MMM d, yyyy")
    } catch (error) {
      return "Invalid date"
    }
  }

  const formatDateTime = (date: any) => {
    if (!date) return "Not specified"
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date)
      return format(dateObj, "MMM d, yyyy h:mm a")
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in progress":
        return "bg-yellow-100 text-yellow-800"
      case "pending":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  const calculateDuration = () => {
    if (!assignment?.coveredDateStart || !assignment?.coveredDateEnd) return "Not specified"

    try {
      const startDate = assignment.coveredDateStart.toDate
        ? assignment.coveredDateStart.toDate()
        : new Date(assignment.coveredDateStart)
      const endDate = assignment.coveredDateEnd.toDate
        ? assignment.coveredDateEnd.toDate()
        : new Date(assignment.coveredDateEnd)
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return `${diffDays} day${diffDays !== 1 ? "s" : ""}`
    } catch (error) {
      return assignment.serviceDuration || "Not specified"
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading assignment details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Assignment not found</h2>
          <p className="text-gray-600 mb-4">The requested service assignment could not be found.</p>
          <Button onClick={() => router.push("/logistics/assignments")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/logistics/assignments")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Service Assignment
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 bg-transparent"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Type and Tagged To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Service Type:</label>
              <p className="text-lg font-semibold text-red-600">{assignment.serviceType || "Not specified"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Tagged to:</label>
              <p className="text-lg font-semibold">{assignment.projectSiteId || "Not specified"}</p>
            </div>
          </div>

          {/* Project Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Project Information</h3>
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src="/placeholder.svg?height=80&width=80"
                      alt="Site"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">{assignment.projectSiteId}</div>
                    <h4 className="font-semibold text-lg">{assignment.projectSiteName || "Not specified"}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {assignment.projectSiteLocation || "Location not specified"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Information */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">SA#:</label>
                <p className="font-semibold">{assignment.saNumber || assignment.id.substring(0, 8)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Start Date:</label>
                <p className="font-semibold">{formatDate(assignment.coveredDateStart)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">End Date:</label>
                <p className="font-semibold">{formatDate(assignment.coveredDateEnd)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Service Duration:</label>
                <p className="font-semibold">{calculateDuration()}</p>
              </div>
              {assignment.project_key && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Project Key:</label>
                  <p className="font-semibold">{assignment.project_key}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Material Specs:</label>
                <p className="font-semibold">{assignment.materialSpecs || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Crew:</label>
                <p className="font-semibold">{assignment.assignedTo || assignment.crew || "Not assigned"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Illumination/ Nits:</label>
                <p className="font-semibold">{assignment.illuminationNits || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Gondola:</label>
                <p className="font-semibold">{assignment.gondola || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Technology:</label>
                <p className="font-semibold">{assignment.technology || "Not specified"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Sales:</label>
                <p className="font-semibold">{assignment.sales || "Not specified"}</p>
              </div>
              {assignment.priority && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Priority:</label>
                  <Badge variant={assignment.priority.toLowerCase() === "high" ? "destructive" : "default"}>
                    {assignment.priority}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Equipment Required */}
          {assignment.equipmentRequired && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Equipment Required:</label>
              <Card>
                <CardContent className="p-4">
                  <p className="text-gray-700">{assignment.equipmentRequired}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Service Cost */}
          {assignment.serviceCost && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Service Cost Breakdown:</label>
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Crew Fee:</span>
                      <span className="ml-2 font-medium">₱{assignment.serviceCost.crewFee || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Meal Allowance:</span>
                      <span className="ml-2 font-medium">₱{assignment.serviceCost.mealAllowance || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Overtime Fee:</span>
                      <span className="ml-2 font-medium">₱{assignment.serviceCost.overtimeFee || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Toll Fee:</span>
                      <span className="ml-2 font-medium">₱{assignment.serviceCost.tollFee || "0"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Transportation:</span>
                      <span className="ml-2 font-medium">₱{assignment.serviceCost.transpo || "0"}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t">
                      <span className="text-gray-600 font-medium">Total:</span>
                      <span className="ml-2 font-bold text-lg">₱{assignment.serviceCost.total || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Remarks:</label>
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-700">{assignment.remarks || assignment.message || "No remarks provided."}</p>
              </CardContent>
            </Card>
          </div>

          {/* Alarm Information */}
          {assignment.alarmDate && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Alarm Settings:</label>
              <Card>
                <CardContent className="p-4">
                  <p className="text-gray-700">
                    <strong>Date:</strong> {formatDate(assignment.alarmDate)}
                    {assignment.alarmTime && (
                      <>
                        <br />
                        <strong>Time:</strong> {assignment.alarmTime}
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">Attachments:</label>
            {assignment.attachments && assignment.attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignment.attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="border rounded-md p-2 w-[100px] h-[100px] flex flex-col items-center justify-center"
                  >
                    <div className="w-12 h-12 bg-gray-200 flex items-center justify-center rounded-md mb-2">
                      <span className="text-xs">{attachment.type.toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-center truncate w-full">{attachment.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No attachments.</p>
            )}
          </div>

          {/* Requested By */}
          <div>
            <label className="text-sm font-medium text-gray-600">Requested By:</label>
            <div className="flex items-center mt-2">
              <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs mr-2">
                {assignment.requestedBy?.name?.[0] || "U"}
              </div>
              <div>
                <p className="font-semibold">{assignment.requestedBy?.name || "Unknown User"}</p>
                <p className="text-sm text-gray-500">
                  {assignment.requestedBy?.department || "Department not specified"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tracker Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Status Tracker</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Current Status</label>
                  <Badge className={`${getStatusColor(assignment.status)} mt-1`}>
                    {assignment.status || "Pending"}
                  </Badge>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="text-sm text-gray-500">{formatDateTime(assignment.created)}</p>
                </div>

                {assignment.updated && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Last Updated</label>
                    <p className="text-sm text-gray-500">{formatDateTime(assignment.updated)}</p>
                  </div>
                )}

                <Button
                  onClick={handleMarkComplete}
                  disabled={updating || assignment.status?.toLowerCase() === "completed"}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {updating
                    ? "Updating..."
                    : assignment.status?.toLowerCase() === "completed"
                      ? "Completed"
                      : "Mark as Complete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
