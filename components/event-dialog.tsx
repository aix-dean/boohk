"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { CalendarIcon, MapPin, Repeat, X } from "lucide-react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { type SalesEvent, type RecurrenceType, createEvent } from "@/lib/planner-service"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"

interface EventDialogProps {
  isOpen: boolean
  onClose: () => void
  event?: Partial<SalesEvent>
  onEventSaved: (eventId: string) => void
  department: string
  companyId?: string
}

export function EventDialog({ isOpen, onClose, event, onEventSaved, department, companyId }: EventDialogProps) {
  const { user, userData } = useAuth()
  const isEditing = !!event?.id
  const [startDate, setStartDate] = useState<Date | undefined>(event?.start instanceof Date ? event.start : new Date())
  const [startTime, setStartTime] = useState(
    event?.start instanceof Date ? format(event.start, "HH:mm") : format(new Date(), "HH:mm"),
  )
  const [isAllDay, setIsAllDay] = useState(event?.allDay || false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Simplified recurrence state - just the type
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(event?.recurrence?.type || "none")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: event?.title || "",
      location: event?.location || "",
      type: event?.type || "meeting",
      status: event?.status || "scheduled",
      description: event?.description || "",
      color: event?.color || "#3b82f6", // Default blue
      department: department || "admin", // Default to current department
    },
  })

  // Reset form when event changes
  useEffect(() => {
    if (isOpen) {
      reset({
        title: event?.title || "",
        location: event?.location || "",
        type: event?.type || "meeting",
        status: event?.status || "scheduled",
        description: event?.description || "",
        color: event?.color || "#3b82f6",
        department: department || "admin",
      })

      setStartDate(event?.start instanceof Date ? event.start : new Date())
      setStartTime(event?.start instanceof Date ? format(event.start, "HH:mm") : format(new Date(), "HH:mm"))
      setIsAllDay(event?.allDay || false)

      // Reset recurrence settings - just the type
      setRecurrenceType(event?.recurrence?.type || "none")
    }
  }, [isOpen, event, reset])

  const onSubmit = async (data: any) => {
    if (!user?.uid || !userData) return

    try {
      setIsSubmitting(true)

      // Combine date and time for start
      const startDateTime = new Date(startDate!)
      if (!isAllDay) {
        const [startHours, startMinutes] = startTime.split(":").map(Number)
        startDateTime.setHours(startHours, startMinutes, 0, 0)
      }

      // For events without end date/time, set end to same as start (or 1 hour later if not all day)
      const endDateTime = new Date(startDateTime)
      if (!isAllDay) {
        endDateTime.setHours(endDateTime.getHours() + 1) // Default to 1 hour duration
      }

      // Prepare recurrence data - simplified
      let recurrence = undefined
      if (recurrenceType !== "none") {
        recurrence = {
          type: recurrenceType,
          interval: 1, // Always set to 1
        }
      }

      // Prepare event data
      const eventData = {
        ...data,
        start: startDateTime,
        end: endDateTime,
        allDay: isAllDay,
        recurrence,
      }

      let eventId: string

      if (isEditing && event?.id) {
        // For now, only creation is supported
        throw new Error("Event editing not implemented yet")
      } else {
        // Create new event
        eventId = await createEvent(
          user.uid,
          data.department || department, // Use selected department from form
          userData.role === "admin", // isAdmin
          data.department || department, // userDepartment - use selected department
          eventData as any,
          companyId || ""
        )
      }

      onEventSaved(eventId)
      onClose()
    } catch (error) {
      console.error("Error saving event:", error)
      alert("Error saving event: " + (error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 bg-white rounded-2xl border border-[#c4c4c4]">
        <div className="p-8">
          <DialogTitle className="text-2xl font-bold text-black mb-6">{isEditing ? "Edit Event" : "Create Event"}</DialogTitle>

          <div className="max-h-[60vh] overflow-y-auto space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div className="space-y-3">
                <Label htmlFor="title" className="text-base font-semibold text-black">
                  Event Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter event title"
                  {...register("title", { required: "Title is required" })}
                  className="h-11 text-base border-[#c4c4c4] focus:border-[#333333]"
                />
                {errors.title && <p className="text-red-500 text-sm">{errors.title.message as string}</p>}
              </div>
  
              {/* Department Selection */}
              <div className="space-y-3">
                <Label htmlFor="department" className="text-base font-semibold text-black">Department</Label>
                <Select
                  defaultValue={watch("department")}
                  onValueChange={(value) => setValue("department", value)}
                >
                  <SelectTrigger className="h-11 text-base border-[#c4c4c4]">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="treasury">Treasury</SelectItem>
                    <SelectItem value="business-dev">Business Dev</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
  
              {/* Start Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-black">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal h-11 text-base border-[#c4c4c4]", !startDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
  
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="startTime" className="text-base font-semibold text-black">Start Time</Label>
                    <div className="flex items-center space-x-2">
                      <Switch id="allDay" checked={isAllDay} onCheckedChange={setIsAllDay} />
                      <Label htmlFor="allDay" className="text-sm text-gray-600">
                        All day
                      </Label>
                    </div>
                  </div>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isAllDay}
                    className="h-11 text-base border-[#c4c4c4]"
                  />
                </div>
              </div>

            {/* Type and Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="type" className="text-base font-semibold text-black">Event Type</Label>
                <Select
                  defaultValue={watch("type")}
                  onValueChange={(value) => setValue("type", value as SalesEvent["type"])}
                >
                  <SelectTrigger className="h-11 text-base border-[#c4c4c4]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="location" className="text-base font-semibold text-black">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input id="location" placeholder="Enter location" className="pl-11 h-11 text-base border-[#c4c4c4]" {...register("location")} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <Label htmlFor="description" className="text-base font-semibold text-black">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter event description"
                className="min-h-[100px] text-base border-[#c4c4c4] resize-y"
                {...register("description")}
              />
            </div>

            {/* Recurrence - Simplified */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Repeat className="h-5 w-5 text-gray-400" />
                <Label htmlFor="recurrenceType" className="text-base font-semibold text-black">Repeat</Label>
              </div>
              <Select value={recurrenceType} onValueChange={(value) => setRecurrenceType(value as RecurrenceType)}>
                <SelectTrigger className="h-11 text-base border-[#c4c4c4]">
                  <SelectValue placeholder="Select recurrence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="px-6 py-3 text-base font-medium border-[#c4c4c4] text-black hover:bg-[#f0f0f0]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 text-base font-medium bg-[#30c71d] hover:bg-[#30c71d]/90 text-white"
              >
                {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  )
}