"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, FileText, Video, Loader2 } from "lucide-react"
import { format } from "date-fns"
import type { Product } from "@/lib/firebase-service"
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { ServiceAssignmentSuccessDialog } from "@/components/service-assignment-success-dialog"

// Service types as provided
const SERVICE_TYPES = ["Roll Up", "Roll Down", "Monitoring", "Change Material", "Maintenance"]

interface ServiceAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialProjectSite?: string
  department: string
}

export function ServiceAssignmentDialog({
  open,
  onOpenChange,
  onSuccess,
  initialProjectSite,
  department,
}: ServiceAssignmentDialogProps) {
  const { user, userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [fetchingProducts, setFetchingProducts] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [saNumber, setSaNumber] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [createdSaNumber, setCreatedSaNumber] = useState("")

  // Form data state
  const [formData, setFormData] = useState({
    projectSite: initialProjectSite || "",
    serviceType: "",
    assignedTo: "",
    jobDescription: "",
    message: "",
    startDate: null as Date | null,
    endDate: null as Date | null,
    alarmDate: null as Date | null,
    alarmTime: "",
    attachments: [] as { name: string; type: string; file?: File }[],
  })

  // Date input strings for direct input
  const [startDateInput, setStartDateInput] = useState("")
  const [endDateInput, setEndDateInput] = useState("")
  const [alarmDateInput, setAlarmDateInput] = useState("")

  // Generate a random SA number on open
  useEffect(() => {
    if (open) {
      const randomNum = Math.floor(100000 + Math.random() * 900000)
      setSaNumber(randomNum.toString())
    }
  }, [open])

  // Fetch products when dialog opens
  useEffect(() => {
    const fetchProducts = async () => {
      if (!open) return

      try {
        setFetchingProducts(true)
        const productsRef = collection(db, "products")
        const q = query(productsRef, where("deleted", "==", false), orderBy("name", "asc"), limit(100))
        const querySnapshot = await getDocs(q)

        const fetchedProducts: Product[] = []
        querySnapshot.forEach((doc) => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as Product)
        })

        setProducts(fetchedProducts)
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setFetchingProducts(false)
      }
    }

    fetchProducts()
  }, [open])

  // Handle form input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Handle date input changes and convert to Date objects
  const handleDateInputChange = (type: "start" | "end" | "alarm", value: string) => {
    try {
      // Only attempt to parse if we have a value
      if (value) {
        const date = new Date(value)

        // Check if date is valid
        if (!isNaN(date.getTime())) {
          if (type === "start") {
            setStartDateInput(value)
            handleInputChange("startDate", date)
          } else if (type === "end") {
            setEndDateInput(value)
            handleInputChange("endDate", date)
          } else if (type === "alarm") {
            setAlarmDateInput(value)
            handleInputChange("alarmDate", date)
          }
        }
      } else {
        // If input is cleared, clear the date
        if (type === "start") {
          setStartDateInput("")
          handleInputChange("startDate", null)
        } else if (type === "end") {
          setEndDateInput("")
          handleInputChange("endDate", null)
        } else if (type === "alarm") {
          setAlarmDateInput("")
          handleInputChange("alarmDate", null)
        }
      }
    } catch (error) {
      console.error(`Error parsing date for ${type}:`, error)
    }
  }

  // Convert attachments to Firestore-compatible format
  const convertAttachmentsForFirestore = (attachments: { name: string; type: string; file?: File }[]) => {
    return attachments.map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      // Remove the file object as it's not serializable
      size: attachment.file?.size || 0,
      lastModified: attachment.file?.lastModified || Date.now(),
    }))
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!user) return

    try {
      setLoading(true)
      const selectedProduct = products.find((p) => p.id === formData.projectSite)

      await addDoc(collection(db, "service_assignments"), {
        saNumber,
        projectSiteId: formData.projectSite,
        projectSiteName: selectedProduct?.name || "",
        projectSiteLocation: selectedProduct?.light?.location || selectedProduct?.specs_rental?.location || "",
        serviceType: formData.serviceType,
        assignedTo: formData.assignedTo,
        jobDescription: formData.jobDescription,
        requestedBy: {
          id: user.uid,
          name: user.displayName || "Unknown User",
          department: department,
        },
        message: formData.message,
        coveredDateStart: formData.startDate,
        coveredDateEnd: formData.endDate,
        alarmDate: formData.alarmDate,
        alarmTime: formData.alarmTime,
        attachments: convertAttachmentsForFirestore(formData.attachments),
        status: "Pending",
        created: serverTimestamp(),
        updated: serverTimestamp(),
        project_key: userData?.license_key || "",
        company_id: userData?.company_id || null, // Add company_id from userData
      })

      // Show success dialog instead of closing immediately
      setCreatedSaNumber(saNumber)
      setShowSuccessDialog(true)
    } catch (error) {
      console.error("Error creating service assignment:", error)
    } finally {
      setLoading(false)
    }
  }

  // Add this import at the top with other imports

  // Replace the addAttachment function with this:
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newAttachments = Array.from(files).map((file) => ({
      name: file.name,
      type: file.type.includes("pdf") ? "pdf" : file.type.includes("video") ? "video" : "file",
      file: file, // Store the actual file object
    }))

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
    }))

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  // Generate time options
  const timeOptions = useMemo(() => {
    const options = []
    for (let hour = 0; hour < 24; hour++) {
      options.push({
        value: `${hour}:00`,
        label: `${hour.toString().padStart(2, "0")}:00`,
      })
    }
    return options
  }, [])

  // Format date for display
  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return ""
    try {
      return format(date, "PPP")
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid date"
    }
  }

  // Handle success dialog actions
  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false)

    // Reset form and close main dialog
    setFormData({
      projectSite: "",
      serviceType: "",
      assignedTo: "",
      jobDescription: "",
      message: "",
      startDate: null,
      endDate: null,
      alarmDate: null,
      alarmTime: "",
      attachments: [],
    })
    setStartDateInput("")
    setEndDateInput("")
    setAlarmDateInput("")

    onOpenChange(false)
    if (onSuccess) onSuccess()
  }

  const handleCreateAnother = () => {
    setShowSuccessDialog(false)

    // Reset form but keep main dialog open
    setFormData({
      projectSite: "",
      serviceType: "",
      assignedTo: "",
      jobDescription: "",
      message: "",
      startDate: null,
      endDate: null,
      alarmDate: null,
      alarmTime: "",
      attachments: [],
    })
    setStartDateInput("")
    setEndDateInput("")
    setAlarmDateInput("")

    // Generate new SA number
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    setSaNumber(randomNum.toString())
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Create Service Assignment</DialogTitle>
          </DialogHeader>

          {fetchingProducts ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading products...</span>
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="saNumber" className="text-right text-sm font-medium">
                  SA#:
                </Label>
                <div className="col-span-3">
                  <Input id="saNumber" value={saNumber} readOnly className="bg-gray-100" />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="projectSite" className="text-right text-sm font-medium">
                  Project Site:
                </Label>
                <div className="col-span-3">
                  <Select
                    value={formData.projectSite}
                    onValueChange={(value) => handleInputChange("projectSite", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.light?.location || product.specs_rental?.location || "No location"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="serviceType" className="text-right text-sm font-medium">
                  Service Type:
                </Label>
                <div className="col-span-3">
                  <Select
                    value={formData.serviceType}
                    onValueChange={(value) => handleInputChange("serviceType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="-Select-" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="assignedTo" className="text-right text-sm font-medium">
                  Assigned To:
                </Label>
                <div className="col-span-3">
                  <Select value={formData.assignedTo} onValueChange={(value) => handleInputChange("assignedTo", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="-Select-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team1">Operations Team 1</SelectItem>
                      <SelectItem value="team2">Operations Team 2</SelectItem>
                      <SelectItem value="team3">Maintenance Team</SelectItem>
                      <SelectItem value="contractor">External Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="jobDescription" className="text-right text-sm font-medium">
                  Job Description:
                </Label>
                <div className="col-span-3">
                  <Textarea
                    id="jobDescription"
                    value={formData.jobDescription}
                    onChange={(e) => handleInputChange("jobDescription", e.target.value)}
                    placeholder="Enter job description"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label className="text-right text-sm font-medium">Requested By:</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <span>({department}) {user?.displayName || "Current User"}</span>
                  <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
                    {user?.displayName?.[0] || "U"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="message" className="text-right text-sm font-medium">
                  Message:
                </Label>
                <div className="col-span-3">
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    placeholder="Enter additional message"
                  />
                </div>
              </div>

              {/* Covered Date - Start Date */}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="startDate" className="text-right text-sm font-medium">
                  Start Date:
                </Label>
                <div className="col-span-3">
                  <Input
                    id="startDate"
                    type="date"
                    value={startDateInput}
                    onChange={(e) => handleDateInputChange("start", e.target.value)}
                    className="w-full"
                  />
                  {formData.startDate && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {formatDateForDisplay(formData.startDate)}</p>
                  )}
                </div>
              </div>

              {/* Covered Date - End Date */}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="endDate" className="text-right text-sm font-medium">
                  End Date:
                </Label>
                <div className="col-span-3">
                  <Input
                    id="endDate"
                    type="date"
                    value={endDateInput}
                    onChange={(e) => handleDateInputChange("end", e.target.value)}
                    className="w-full"
                  />
                  {formData.endDate && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {formatDateForDisplay(formData.endDate)}</p>
                  )}
                </div>
              </div>

              {/* Alarm Date */}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="alarmDate" className="text-right text-sm font-medium">
                  Alarm Date:
                </Label>
                <div className="col-span-3">
                  <Input
                    id="alarmDate"
                    type="date"
                    value={alarmDateInput}
                    onChange={(e) => handleDateInputChange("alarm", e.target.value)}
                    className="w-full"
                  />
                  {formData.alarmDate && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {formatDateForDisplay(formData.alarmDate)}</p>
                  )}
                </div>
              </div>

              {/* Alarm Time */}
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="alarmTime" className="text-right text-sm font-medium">
                  Alarm Time:
                </Label>
                <div className="col-span-3">
                  <Select value={formData.alarmTime} onValueChange={(value) => handleInputChange("alarmTime", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Replace the entire attachments section in the form with: */}
              <div className="grid grid-cols-4 items-start gap-3">
                <Label className="text-right text-sm font-medium pt-2">Attachments:</Label>
                <div className="col-span-3">
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="border rounded-md p-2 w-[100px] h-[100px] flex flex-col items-center justify-center relative group"
                      >
                        {attachment.type === "pdf" ? (
                          <>
                            <div className="w-12 h-12 bg-red-500 text-white flex items-center justify-center rounded-md mb-2">
                              <FileText size={24} />
                            </div>
                            <span className="text-xs text-center truncate w-full" title={attachment.name}>
                              {attachment.name}
                            </span>
                          </>
                        ) : attachment.type === "video" ? (
                          <>
                            <div className="w-12 h-12 bg-gray-200 flex items-center justify-center rounded-md mb-2">
                              <Video size={24} className="text-gray-500" />
                            </div>
                            <span className="text-xs text-center truncate w-full" title={attachment.name}>
                              {attachment.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-blue-500 text-white flex items-center justify-center rounded-md mb-2">
                              <FileText size={24} />
                            </div>
                            <span className="text-xs text-center truncate w-full" title={attachment.name}>
                              {attachment.name}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-md p-2 w-[100px] h-[100px] flex flex-col items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-colors"
                    >
                      <Plus size={24} className="text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500">Add File</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.mp4,.mov,.avi,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <p className="text-xs text-gray-500 mt-2">Supported formats: PDF, Video files, Images, Documents</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || fetchingProducts} variant="default" type="button">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <ServiceAssignmentSuccessDialog
        open={showSuccessDialog}
        onOpenChange={handleSuccessDialogClose}
        saNumber={createdSaNumber}
        onViewAssignments={handleSuccessDialogClose}
        onCreateAnother={handleCreateAnother}
      />
    </>
  )
}
