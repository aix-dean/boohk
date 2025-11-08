"use client"
import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, CalendarIcon, Plus, Loader2, FileText, ImageIcon, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { createJobOrder, generatePersonalizedJONumber } from "@/lib/job-order-service"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { JobOrderType } from "@/lib/types/job-order"
import { cn } from "@/lib/utils"

const joTypes = ["Installation", "Maintenance", "Repair", "Dismantling", "Other"]

interface JobOrderFormData {
  joType: JobOrderType | ""
  dateRequested: Date | undefined
  deadline: Date | undefined
  remarks: string
  assignTo: string
  attachmentFile: File | null
  attachmentUrl: string | null
  uploadingAttachment: boolean
  attachmentError: string | null
  joTypeError: boolean
  dateRequestedError: boolean
}

export default function CreateJobOrderPage() {
  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [siteName, setSiteName] = useState("")
  const [siteLocation, setSiteLocation] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [siteNameError, setSiteNameError] = useState(false)
  const [jobDescriptionError, setJobDescriptionError] = useState(false)

  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string }>>([])

  const [jobOrderForm, setJobOrderForm] = useState<JobOrderFormData>({
    joType: "",
    dateRequested: new Date(),
    deadline: undefined,
    remarks: "",
    assignTo: userData?.uid || "",
    attachmentFile: null,
    attachmentUrl: null,
    uploadingAttachment: false,
    attachmentError: null,
    joTypeError: false,
    dateRequestedError: false,
  })

  const handleFormUpdate = useCallback((field: keyof JobOrderFormData, value: any) => {
    setJobOrderForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleAttachmentUpload = useCallback(
    async (file: File) => {
      handleFormUpdate("uploadingAttachment", true)
      handleFormUpdate("attachmentError", null)
      handleFormUpdate("attachmentUrl", null)

      const allowedTypes = ["image/jpeg", "image/png", "image/gif"]
      const maxSize = 5 * 1024 * 1024 // 5MB

      if (file.size > maxSize) {
        handleFormUpdate("attachmentError", "File size exceeds 5MB limit.")
        handleFormUpdate("uploadingAttachment", false)
        return
      }

      if (!allowedTypes.includes(file.type)) {
        handleFormUpdate("attachmentError", "Invalid file type. Only JPG, PNG, GIF are allowed.")
        handleFormUpdate("uploadingAttachment", false)
        return
      }

      try {
        const downloadURL = await uploadFileToFirebaseStorage(file, "attachments/job-orders/")
        handleFormUpdate("attachmentUrl", downloadURL)
        handleFormUpdate("attachmentFile", file)
        toast({
          title: "Upload Successful",
          description: `${file.name} uploaded successfully.`,
        })
      } catch (error: any) {
        console.error("Upload failed:", error)
        handleFormUpdate("attachmentError", `Upload failed: ${error.message || "Unknown error"}`)
        toast({
          title: "Upload Failed",
          description: `Could not upload ${file.name}. ${error.message || "Please try again."}`,
          variant: "destructive",
        })
      } finally {
        handleFormUpdate("uploadingAttachment", false)
      }
    },
    [handleFormUpdate, toast],
  )

  const validateForm = useCallback((): boolean => {
    let hasError = false

    if (!siteName.trim()) {
      setSiteNameError(true)
      hasError = true
    } else {
      setSiteNameError(false)
    }

    if (!jobDescription.trim()) {
      setJobDescriptionError(true)
      hasError = true
    } else {
      setJobDescriptionError(false)
    }

    if (!jobOrderForm.joType) {
      handleFormUpdate("joTypeError", true)
      hasError = true
    } else {
      handleFormUpdate("joTypeError", false)
    }

    if (!jobOrderForm.dateRequested) {
      handleFormUpdate("dateRequestedError", true)
      hasError = true
    } else {
      handleFormUpdate("dateRequestedError", false)
    }

    if (!jobOrderForm.deadline) {
      hasError = true
    }

    return !hasError
  }, [siteName, jobDescription, jobOrderForm, handleFormUpdate])

  const handleCreateJobOrder = useCallback(async () => {
    if (!user?.uid || !userData?.company_id) {
      toast({
        title: "Missing Information",
        description: "Cannot create Job Order due to missing data or user authentication.",
        variant: "destructive",
      })
      return
    }

    if (!validateForm()) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const jobOrderData = {
        joNumber: await generatePersonalizedJONumber(userData), // Replace generateJONumber() with personalized number generation
        dateRequested: jobOrderForm.dateRequested!.toISOString(),
        joType: jobOrderForm.joType as JobOrderType,
        deadline: jobOrderForm.deadline!.toISOString(),
        requestedBy: userData?.first_name || "Auto-Generated",
        remarks: jobOrderForm.remarks,
        assignTo: jobOrderForm.assignTo,
        attachments: jobOrderForm.attachmentUrl
          ? {
              url: jobOrderForm.attachmentUrl,
              name: jobOrderForm.attachmentFile?.name || "Attachment",
              type: jobOrderForm.attachmentFile?.type || "image",
            }
          : null,
        siteName: siteName,
        siteLocation: siteLocation,
        jobDescription: jobDescription,
        company_id: userData?.company_id || "",
        created_by: user.uid,
        status: "pending" as const,
        quotation_id: "",
      }

      const joId = await createJobOrder(jobOrderData)

      toast({
        title: "Success",
        description: "Job Order created successfully!",
      })

      router.push(`/logistics/job-orders/${joId}`)
    } catch (error: any) {
      console.error("Error creating job order:", error)
      toast({
        title: "Error",
        description: `Failed to create Job Order: ${error.message || "Unknown error"}. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [user, userData, validateForm, jobOrderForm, siteName, siteLocation, jobDescription, toast, router])

  const fetchCompanyUsers = useCallback(async () => {
    if (!userData?.company_id) return

    try {
      // For now, we'll just add the current user. In a real app, you'd fetch all company users
      const currentUser = {
        id: userData.uid || "",
        name: userData.first_name || "Current User",
      }
      setAvailableUsers([currentUser])
    } catch (error) {
      console.error("Error fetching company users:", error)
    }
  }, [userData])

  useEffect(() => {
    fetchCompanyUsers()
  }, [fetchCompanyUsers])

  return (
    <div className="flex flex-col min-h-screen bg-white p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Create Job Order</h1>
        <Badge variant="secondary">
          <Package className="h-3 w-3 mr-1" />
          Logistics
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto w-full">
        {/* Left Column: Job Information */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Job Information</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-800">Site Name *</Label>
              <Input
                value={siteName}
                onChange={(e) => {
                  setSiteName(e.target.value)
                  setSiteNameError(false)
                }}
                placeholder="Enter site name"
                className={cn(
                  "bg-white text-gray-800 border-gray-300 text-sm h-9",
                  siteNameError && "border-red-500 focus-visible:ring-red-500",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-800">Site Location</Label>
              <Input
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="Enter site location"
                className="bg-white text-gray-800 border-gray-300 text-sm h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-800">Job Description *</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value)
                  setJobDescriptionError(false)
                }}
                placeholder="Describe the job requirements and specifications"
                className={cn(
                  "bg-white text-gray-800 border-gray-300 placeholder:text-gray-500 text-sm h-24",
                  jobDescriptionError && "border-red-500 focus-visible:ring-red-500",
                )}
              />
            </div>

            {/* Site Preview Card */}
            <div className="space-y-1 mt-3">
              <p className="text-sm font-semibold">Site Preview:</p>
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-md">
                <Image
                  src="/placeholder.svg?height=48&width=48"
                  alt="Site preview"
                  width={48}
                  height={48}
                  className="rounded-md object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{siteName || "Site Name"}</p>
                  <p className="text-xs text-gray-600">{siteLocation || "Location not specified"}</p>
                  <p className="text-xs text-gray-500">{jobDescription || "No description provided"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-200 mt-6">
              <p className="text-sm font-semibold mb-2">Company Information:</p>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">Company:</span> {userData?.company_name || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Created By:</span> {userData?.first_name || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Date:</span> {format(new Date(), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Job Order Form */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Job Order Details</h2>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Job Order Form
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-gray-800">JO #</Label>
                <Input value="Will be auto-generated" disabled className="bg-gray-100 text-gray-600 text-sm h-9" />{" "}
                {/* Updated placeholder text since number is now generated dynamically */}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">Date Requested</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-white text-gray-800 border-gray-300 hover:bg-gray-50 text-sm h-9",
                        !jobOrderForm.dateRequested && "text-gray-500",
                        jobOrderForm.dateRequestedError && "border-red-500 focus-visible:ring-red-500",
                      )}
                      onClick={() => handleFormUpdate("dateRequestedError", false)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                      {jobOrderForm.dateRequested ? format(jobOrderForm.dateRequested, "PPP") : <span>Date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={jobOrderForm.dateRequested}
                      onSelect={(date) => {
                        handleFormUpdate("dateRequested", date)
                        handleFormUpdate("dateRequestedError", false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">JO Type</Label>
                <Select
                  onValueChange={(value: JobOrderType) => {
                    handleFormUpdate("joType", value)
                    handleFormUpdate("joTypeError", false)
                  }}
                  value={jobOrderForm.joType}
                >
                  <SelectTrigger
                    className={cn(
                      "bg-white text-gray-800 border-gray-300 hover:bg-gray-50 text-sm h-9",
                      jobOrderForm.joTypeError && "border-red-500 focus-visible:ring-red-500",
                    )}
                  >
                    <SelectValue placeholder="Choose JO Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {joTypes.map((type) => (
                      <SelectItem key={type} value={type} className="text-sm">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">Deadline</Label>
                <Input
                  type="date"
                  value={jobOrderForm.deadline ? format(jobOrderForm.deadline, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined
                    handleFormUpdate("deadline", date)
                  }}
                  className="bg-white text-gray-800 border-gray-300 hover:bg-gray-50 text-sm h-9"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">Requested By</Label>
                <Input
                  value={userData?.first_name || userData?.name || "(Auto-Generated)"}
                  disabled
                  className="bg-gray-100 text-gray-600 text-sm h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">Remarks</Label>
                <Textarea
                  placeholder="Remarks..."
                  value={jobOrderForm.remarks}
                  onChange={(e) => handleFormUpdate("remarks", e.target.value)}
                  className="bg-white text-gray-800 border-gray-300 placeholder:text-gray-500 text-sm h-24"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">Attachments</Label>
                <input
                  type="file"
                  id="attachment-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files && event.target.files[0]) {
                      handleAttachmentUpload(event.target.files[0])
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-24 h-24 flex flex-col items-center justify-center text-gray-500 border-dashed border-2 border-gray-300 bg-gray-100 hover:bg-gray-200"
                  onClick={() => document.getElementById("attachment-upload")?.click()}
                  disabled={jobOrderForm.uploadingAttachment}
                >
                  {jobOrderForm.uploadingAttachment ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Plus className="h-6 w-6" />
                  )}
                  <span className="text-xs mt-1">{jobOrderForm.uploadingAttachment ? "Uploading..." : "Upload"}</span>
                </Button>
                {jobOrderForm.attachmentFile && !jobOrderForm.uploadingAttachment && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="h-4 w-4" />
                    <span>{jobOrderForm.attachmentFile.name}</span>
                  </div>
                )}
                {jobOrderForm.attachmentError && (
                  <p className="text-xs text-red-500 mt-1">{jobOrderForm.attachmentError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-800">Assign to</Label>
                <Select onValueChange={(value) => handleFormUpdate("assignTo", value)} value={jobOrderForm.assignTo}>
                  <SelectTrigger className="bg-white text-gray-800 border-gray-300 hover:bg-gray-50 text-sm h-9">
                    <SelectValue placeholder="Choose Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="text-sm">
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="flex-1 bg-transparent text-gray-800 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJobOrder}
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Create Job Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
