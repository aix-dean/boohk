"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  Video,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  PenToolIcon as Tool,
  MoreHorizontal,
  Building,
  Mail,
  Users,
  Wrench,
  Lightbulb,
  Target,
  MessageSquare,
  Paperclip,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { format, isValid } from "date-fns"
import { doc, getDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

interface ServiceAssignmentDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignmentId?: string | null
  assignment?: ServiceAssignment | null
  onStatusChange?: () => void
}

interface ServiceAssignment {
  id: string
  saNumber?: string
  sa_number?: string
  projectSiteId?: string
  project_site_id?: string
  projectSiteName?: string
  project_site_name?: string
  projectSiteLocation?: string
  project_site_location?: string
  serviceType?: string
  service_type?: string
  assignedTo?: string
  assigned_to?: string
  jobDescription?: string
  job_description?: string
  requestedBy?:
    | {
        id: string
        name: string
        department: string
      }
    | string
  requested_by?:
    | {
        id: string
        name: string
        department: string
      }
    | string
  message?: string
  campaignName?: string
  coveredDateStart?: any
  covered_date_start?: any
  start_date?: any
  coveredDateEnd?: any
  covered_date_end?: any
  end_date?: any
  alarmDate?: any
  alarm_date?: any
  alarmTime?: string
  alarm_time?: string
  status?: string
  created?: any
  created_at?: any
  updated?: any
  updated_at?: any
  attachments?: Array<{
    name: string
    type: string
    url?: string
  }>
  company_id?: string
  content?: string
  material_specs?: string
  crew?: string
  illumination?: string
  gondola?: string
  technology?: string
  sales?: string
  remarks?: string
  priority?: string
  estimated_duration?: string | number
  actual_duration?: string | number
  cost_estimate?: number
  completion_percentage?: number
  [key: string]: any // Allow for additional dynamic fields
}

export function ServiceAssignmentDetailsDialog({
  open,
  onOpenChange,
  assignmentId,
  assignment: initialAssignment,
  onStatusChange,
}: ServiceAssignmentDetailsDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [assignment, setAssignment] = useState<ServiceAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Fetch service assignment details
  useEffect(() => {
    const fetchAssignment = async () => {
      if (initialAssignment) {
        setAssignment(initialAssignment)
        setLoading(false)
        return
      }

      if (!assignmentId || !open) {
        setAssignment(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const assignmentDoc = await getDoc(doc(db, "service_assignments", assignmentId))

        if (!assignmentDoc.exists()) {
          setError("Service assignment not found")
          setAssignment(null)
        } else {
          const data = assignmentDoc.data()
          setAssignment({
            id: assignmentDoc.id,
            ...data,
          } as ServiceAssignment)
        }
      } catch (err) {
        console.error("Error fetching service assignment:", err)
        setError("Failed to load service assignment details")
      } finally {
        setLoading(false)
      }
    }

    fetchAssignment()
  }, [assignmentId, initialAssignment, open])

  // Update service assignment status
  const updateStatus = async (newStatus: string) => {
    if (!assignment || !user) return

    try {
      setUpdating(true)

      await updateDoc(doc(db, "service_assignments", assignment.id), {
        status: newStatus,
        updated: new Date(),
        updated_at: new Date(),
      })

      // Update local state
      setAssignment({
        ...assignment,
        status: newStatus,
        updated: new Date(),
        updated_at: new Date(),
      })

      // Notify parent component
      if (onStatusChange) {
        onStatusChange()
      }

      toast({
        title: "Status Updated",
        description: `Service assignment status changed to ${newStatus}`,
      })
    } catch (err) {
      console.error("Error updating service assignment status:", err)
      setError("Failed to update status")
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  // Delete service assignment
  const deleteAssignment = async () => {
    if (!assignment || !user) return

    if (!confirm("Are you sure you want to delete this service assignment? This action cannot be undone.")) {
      return
    }

    try {
      setDeleting(true)

      await deleteDoc(doc(db, "service_assignments", assignment.id))

      // Close dialog and notify parent component
      onOpenChange(false)
      if (onStatusChange) {
        onStatusChange()
      }

      toast({
        title: "Assignment Deleted",
        description: "Service assignment has been deleted successfully",
      })
    } catch (err) {
      console.error("Error deleting service assignment:", err)
      setError("Failed to delete service assignment")
      toast({
        title: "Error",
        description: "Failed to delete service assignment",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Helper function to safely format dates
  const formatDate = (date: any, includeTime = false): string => {
    if (!date) return "Not specified"

    try {
      let dateObj: Date

      if (date instanceof Timestamp) {
        dateObj = date.toDate()
      } else if (date instanceof Date) {
        dateObj = date
      } else if (typeof date === "string" || typeof date === "number") {
        dateObj = new Date(date)
      } else if (date && typeof date.toDate === "function") {
        dateObj = date.toDate()
      } else {
        return "Invalid date"
      }

      if (!isValid(dateObj)) {
        return "Invalid date"
      }

      if (includeTime) {
        return format(dateObj, "MMM d, yyyy h:mm a")
      } else {
        return format(dateObj, "MMM d, yyyy")
      }
    } catch (err) {
      console.error("Error formatting date:", err)
      return "Invalid date"
    }
  }

  // Helper function to get field value with fallbacks
  const getFieldValue = (assignment: ServiceAssignment, ...fieldNames: string[]): any => {
    for (const fieldName of fieldNames) {
      if (assignment[fieldName] !== undefined && assignment[fieldName] !== null) {
        return assignment[fieldName]
      }
    }
    return null
  }

  // Helper function to format nested objects
  const formatNestedObject = (obj: any): string => {
    if (!obj) return "Not specified"

    if (typeof obj === "string") return obj

    if (typeof obj === "object") {
      if (obj.name) return obj.name
      if (obj.id && obj.name) return `${obj.name} (${obj.id})`
      return JSON.stringify(obj, null, 2)
    }

    return String(obj)
  }

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || ""
    switch (statusLower) {
      case "completed":
      case "done":
        return "bg-green-100 text-green-800 border-green-200"
      case "in progress":
      case "ongoing":
      case "active":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "pending":
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
      case "canceled":
        return "bg-red-100 text-red-800 border-red-200"
      case "paused":
      case "on hold":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  // Helper function to get service type icon
  const getServiceTypeIcon = (type: string) => {
    const typeLower = type?.toLowerCase() || ""
    if (typeLower.includes("repair") || typeLower.includes("maintenance")) {
      return <Wrench className="h-4 w-4 text-blue-600" />
    } else if (typeLower.includes("inspection") || typeLower.includes("monitoring")) {
      return <FileText className="h-4 w-4 text-green-600" />
    } else if (typeLower.includes("emergency")) {
      return <AlertTriangle className="h-4 w-4 text-red-600" />
    } else if (typeLower.includes("installation")) {
      return <Tool className="h-4 w-4 text-purple-600" />
    }
    return <User className="h-4 w-4 text-blue-600" />
  }

  // Helper function to render field value based on type
  const renderFieldValue = (value: any, fieldName: string) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">Not specified</span>
    }

    // Handle dates
    if (fieldName.toLowerCase().includes("date") || fieldName.toLowerCase().includes("time")) {
      return <span>{formatDate(value, fieldName.toLowerCase().includes("time"))}</span>
    }

    // Handle numbers
    if (typeof value === "number") {
      if (fieldName.toLowerCase().includes("cost") || fieldName.toLowerCase().includes("price")) {
        return <span>₱{value.toLocaleString()}</span>
      }
      if (fieldName.toLowerCase().includes("percentage")) {
        return <span>{value}%</span>
      }
      return <span>{value.toLocaleString()}</span>
    }

    // Handle booleans
    if (typeof value === "boolean") {
      return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500 italic">None</span>
      }
      return (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div key={index} className="text-sm">
              {typeof item === "object" ? formatNestedObject(item) : String(item)}
            </div>
          ))}
        </div>
      )
    }

    // Handle objects
    if (typeof value === "object") {
      return <span>{formatNestedObject(value)}</span>
    }

    // Handle strings
    return <span>{String(value)}</span>
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500">Loading service assignment details...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Alert variant="destructive" className="max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-4">
              Close
            </Button>
          </div>
        ) : assignment ? (
          <>
            <DialogHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-semibold">Service Assignment Details</DialogTitle>
                  <DialogDescription className="mt-1">
                    SA#{getFieldValue(assignment, "saNumber", "sa_number", "id")?.toString().slice(-8) || "Unknown"} •
                    Created {formatDate(getFieldValue(assignment, "created", "created_at"), true)}
                  </DialogDescription>
                </div>
                <Badge className={getStatusColor(getFieldValue(assignment, "status") || "pending")}>
                  {getFieldValue(assignment, "status") || "Pending"}
                </Badge>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Project Site Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building className="h-5 w-5 text-blue-600" />
                      Project Site Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Site Name</label>
                        <div className="text-sm font-semibold">
                          {renderFieldValue(
                            getFieldValue(assignment, "projectSiteName", "project_site_name"),
                            "siteName",
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Site ID</label>
                        <div className="text-sm">
                          {renderFieldValue(getFieldValue(assignment, "projectSiteId", "project_site_id"), "siteId")}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Location</label>
                      <div className="flex items-start text-sm mt-1">
                        <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-gray-500" />
                        {renderFieldValue(
                          getFieldValue(assignment, "projectSiteLocation", "project_site_location"),
                          "location",
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Service Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Tool className="h-5 w-5 text-green-600" />
                      Service Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Service Type</label>
                        <div className="flex items-center text-sm mt-1">
                          {getServiceTypeIcon(getFieldValue(assignment, "serviceType", "service_type") || "")}
                          <span className="ml-2">
                            {renderFieldValue(getFieldValue(assignment, "serviceType", "service_type"), "serviceType")}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Assigned To</label>
                        <div className="flex items-center text-sm mt-1">
                          <Users className="h-4 w-4 mr-2 text-gray-500" />
                          {renderFieldValue(
                            getFieldValue(assignment, "assignedTo", "assigned_to", "crew"),
                            "assignedTo",
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Priority</label>
                        <div className="text-sm mt-1">
                          {renderFieldValue(getFieldValue(assignment, "priority"), "priority")}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Completion</label>
                        <div className="text-sm mt-1">
                          {renderFieldValue(
                            getFieldValue(assignment, "completion_percentage"),
                            "completion_percentage",
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Job Description</label>
                      <div className="text-sm mt-1 whitespace-pre-line bg-gray-50 p-3 rounded-md">
                        {renderFieldValue(
                          getFieldValue(assignment, "jobDescription", "job_description"),
                          "jobDescription",
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Schedule Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-600" />
                      Schedule Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Start Date</label>
                        <div className="flex items-center text-sm mt-1">
                          <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                          {renderFieldValue(
                            getFieldValue(assignment, "coveredDateStart", "covered_date_start", "start_date"),
                            "startDate",
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">End Date</label>
                        <div className="flex items-center text-sm mt-1">
                          <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                          {renderFieldValue(
                            getFieldValue(assignment, "coveredDateEnd", "covered_date_end", "end_date"),
                            "endDate",
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Estimated Duration</label>
                        <div className="flex items-center text-sm mt-1">
                          <Clock className="h-4 w-4 mr-2 text-gray-500" />
                          {renderFieldValue(getFieldValue(assignment, "estimated_duration"), "estimated_duration")}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Actual Duration</label>
                        <div className="flex items-center text-sm mt-1">
                          <Clock className="h-4 w-4 mr-2 text-gray-500" />
                          {renderFieldValue(getFieldValue(assignment, "actual_duration"), "actual_duration")}
                        </div>
                      </div>
                    </div>
                    {getFieldValue(assignment, "alarmDate", "alarm_date") && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Alarm</label>
                        <div className="flex items-center text-sm mt-1">
                          <Clock className="h-4 w-4 mr-2 text-red-500" />
                          {formatDate(getFieldValue(assignment, "alarmDate", "alarm_date"))}{" "}
                          {getFieldValue(assignment, "alarmTime", "alarm_time") || ""}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Technical Specifications */}
                {(getFieldValue(assignment, "content") ||
                  getFieldValue(assignment, "material_specs") ||
                  getFieldValue(assignment, "illumination") ||
                  getFieldValue(assignment, "gondola") ||
                  getFieldValue(assignment, "technology")) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-orange-600" />
                        Technical Specifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getFieldValue(assignment, "content") && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Content</label>
                            <div className="text-sm mt-1">
                              {renderFieldValue(getFieldValue(assignment, "content"), "content")}
                            </div>
                          </div>
                        )}
                        {getFieldValue(assignment, "material_specs") && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Material Specs</label>
                            <div className="text-sm mt-1">
                              {renderFieldValue(getFieldValue(assignment, "material_specs"), "material_specs")}
                            </div>
                          </div>
                        )}
                        {getFieldValue(assignment, "illumination") && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Illumination</label>
                            <div className="flex items-center text-sm mt-1">
                              <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
                              {renderFieldValue(getFieldValue(assignment, "illumination"), "illumination")}
                            </div>
                          </div>
                        )}
                        {getFieldValue(assignment, "gondola") && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Gondola</label>
                            <div className="text-sm mt-1">
                              {renderFieldValue(getFieldValue(assignment, "gondola"), "gondola")}
                            </div>
                          </div>
                        )}
                        {getFieldValue(assignment, "technology") && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Technology</label>
                            <div className="text-sm mt-1">
                              {renderFieldValue(getFieldValue(assignment, "technology"), "technology")}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Requester Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5 text-indigo-600" />
                      Requester Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                        {(() => {
                          const requester = getFieldValue(assignment, "requestedBy", "requested_by")
                          if (typeof requester === "object" && requester?.name) {
                            return requester.name[0]?.toUpperCase() || "U"
                          } else if (typeof requester === "string") {
                            return requester[0]?.toUpperCase() || "U"
                          }
                          return "U"
                        })()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {(() => {
                            const requester = getFieldValue(assignment, "requestedBy", "requested_by")
                            if (typeof requester === "object" && requester?.name) {
                              return requester.name
                            } else if (typeof requester === "string") {
                              return requester
                            }
                            return "Unknown User"
                          })()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(() => {
                            const requester = getFieldValue(assignment, "requestedBy", "requested_by")
                            if (typeof requester === "object" && requester?.department) {
                              return requester.department
                            }
                            return "Department not specified"
                          })()}
                        </div>
                      </div>
                    </div>
                    {getFieldValue(assignment, "sales") && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Sales Contact</label>
                        <div className="flex items-center text-sm mt-1">
                          <Mail className="h-4 w-4 mr-2 text-gray-500" />
                          {renderFieldValue(getFieldValue(assignment, "sales"), "sales")}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Message & Remarks */}
                {(getFieldValue(assignment, "message") || getFieldValue(assignment, "remarks")) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-teal-600" />
                        Message & Remarks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {getFieldValue(assignment, "message") && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Message</label>
                          <div className="text-sm mt-1 bg-gray-50 p-3 rounded-md whitespace-pre-line">
                            {renderFieldValue(getFieldValue(assignment, "message"), "message")}
                          </div>
                        </div>
                      )}
                      {getFieldValue(assignment, "remarks") && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Remarks</label>
                          <div className="text-sm mt-1 bg-gray-50 p-3 rounded-md whitespace-pre-line">
                            {renderFieldValue(getFieldValue(assignment, "remarks"), "remarks")}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Attachments */}
                {assignment.attachments && assignment.attachments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Paperclip className="h-5 w-5 text-gray-600" />
                        Attachments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {assignment.attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="border rounded-lg p-3 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors"
                          >
                            {attachment.type === "pdf" ? (
                              <FileText className="h-8 w-8 text-red-500 mb-2" />
                            ) : attachment.type?.includes("image") ? (
                              <div className="h-8 w-8 bg-blue-500 rounded mb-2 flex items-center justify-center">
                                <span className="text-white text-xs">IMG</span>
                              </div>
                            ) : (
                              <Video className="h-8 w-8 text-purple-500 mb-2" />
                            )}
                            <span className="text-xs text-center truncate w-full" title={attachment.name}>
                              {attachment.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Cost Information */}
                {getFieldValue(assignment, "cost_estimate") && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-green-600" />
                        Cost Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Cost Estimate</label>
                        <div className="text-lg font-semibold text-green-600 mt-1">
                          {renderFieldValue(getFieldValue(assignment, "cost_estimate"), "cost_estimate")}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Timestamps */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-600" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs text-gray-500">
                      <div>Created: {formatDate(getFieldValue(assignment, "created", "created_at"), true)}</div>
                      {getFieldValue(assignment, "updated", "updated_at") && (
                        <div>Last updated: {formatDate(getFieldValue(assignment, "updated", "updated_at"), true)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>

            <Separator className="my-4" />

            <DialogFooter className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {getFieldValue(assignment, "status")?.toLowerCase() !== "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-green-600 border-green-200 hover:bg-green-50 bg-transparent"
                    onClick={() => updateStatus("Completed")}
                    disabled={updating}
                  >
                    {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    <span>Mark Complete</span>
                  </Button>
                )}
                {getFieldValue(assignment, "status")?.toLowerCase() !== "in progress" &&
                  getFieldValue(assignment, "status")?.toLowerCase() !== "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 bg-transparent"
                      onClick={() => updateStatus("In Progress")}
                      disabled={updating}
                    >
                      <Clock className="h-3 w-3" />
                      <span>Start</span>
                    </Button>
                  )}
                {getFieldValue(assignment, "status")?.toLowerCase() !== "cancelled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
                    onClick={() => updateStatus("Cancelled")}
                    disabled={updating}
                  >
                    <XCircle className="h-3 w-3" />
                    <span>Cancel</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Close
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/logistics/assignments/edit/${assignment.id}`)}>
                      Edit Assignment
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={deleteAssignment} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete Assignment"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p>No service assignment selected</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
