"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { CalendarIcon, MapPin, Repeat } from "lucide-react"
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
import { type SalesEvent, type RecurrenceType, createSalesEvent, updateSalesEvent } from "@/lib/planner-service"
import { cn } from "@/lib/utils"

interface SalesEventDialogProps {
  isOpen: boolean
  onClose: () => void
  event?: Partial<SalesEvent>
  userId: string
  onEventSaved: (eventId: string) => void
}

export function SalesEventDialog({ isOpen, onClose, event, userId, onEventSaved }: SalesEventDialogProps) {
  const isEditing = !!event?.id
  const [startDate, setStartDate] = useState<Date | undefined>(event?.start instanceof Date ? event.start : new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(
    event?.end instanceof Date ? event.end : new Date(Date.now() + 60 * 60 * 1000), // Default to 1 hour later
  )
  const [startTime, setStartTime] = useState(
    event?.start instanceof Date ? format(event.start, "HH:mm") : format(new Date(), "HH:mm"),
  )
  const [endTime, setEndTime] = useState(
    event?.end instanceof Date ? format(event.end, "HH:mm") : format(new Date(Date.now() + 60 * 60 * 1000), "HH:mm"),
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
      clientName: event?.clientName || "",
      clientId: event?.clientId || "",
      type: event?.type || "meeting",
      status: event?.status || "scheduled",
      description: event?.description || "",
      color: event?.color || "#3b82f6", // Default blue
    },
  })

  // Reset form when event changes
  useEffect(() => {
    if (isOpen) {
      reset({
        title: event?.title || "",
        location: event?.location || "",
        clientName: event?.clientName || "",
        clientId: event?.clientId || "",
        type: event?.type || "meeting",
        status: event?.status || "scheduled",
        description: event?.description || "",
        color: event?.color || "#3b82f6",
      })

      setStartDate(event?.start instanceof Date ? event.start : new Date())
      setEndDate(event?.end instanceof Date ? event.end : new Date(Date.now() + 60 * 60 * 1000))
      setStartTime(event?.start instanceof Date ? format(event.start, "HH:mm") : format(new Date(), "HH:mm"))
      setEndTime(
        event?.end instanceof Date
          ? format(event.end, "HH:mm")
          : format(new Date(Date.now() + 60 * 60 * 1000), "HH:mm"),
      )
      setIsAllDay(event?.allDay || false)

      // Reset recurrence settings - just the type
      setRecurrenceType(event?.recurrence?.type || "none")
    }
  }, [isOpen, event, reset])

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true)

      // Combine date and time
      const startDateTime = new Date(startDate!)
      const [startHours, startMinutes] = startTime.split(":").map(Number)
      startDateTime.setHours(startHours, startMinutes, 0, 0)

      const endDateTime = new Date(endDate!)
      const [endHours, endMinutes] = endTime.split(":").map(Number)
      endDateTime.setHours(endHours, endMinutes, 0, 0)

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
        // Update existing event
        await updateSalesEvent(event.id, eventData, userId)
        eventId = event.id
      } else {
        // Create new event
        eventId = await createSalesEvent(userId, eventData as any)
      }

      onEventSaved(eventId)
      onClose()
    } catch (error) {
      console.error("Error saving event:", error)
      // Handle error (show toast, etc.)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "Create New Event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Event Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter event title"
              {...register("title", { required: "Title is required" })}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && <p className="text-red-500 text-sm">{errors.title.message as string}</p>}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date)
                      // If end date is before start date, update it
                      if (endDate && date && date > endDate) {
                        setEndDate(date)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="startTime">Start Time</Label>
                <div className="flex items-center space-x-2">
                  <Switch id="allDay" checked={isAllDay} onCheckedChange={setIsAllDay} />
                  <Label htmlFor="allDay" className="text-sm">
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
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => (startDate ? date < startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isAllDay}
              />
            </div>
          </div>

          {/* Type and Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="type">Event Type</Label>
              <Select
                defaultValue={watch("type")}
                onValueChange={(value) => setValue("type", value as SalesEvent["type"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="presentation">Presentation</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="location" placeholder="Enter location" className="pl-8" {...register("location")} />
              </div>
            </div>
          </div>

          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name</Label>
            <Input id="clientName" placeholder="Enter client name" {...register("clientName")} />
            <Input id="clientId" type="hidden" {...register("clientId")} />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter event description"
              className="min-h-[80px]"
              {...register("description")}
            />
          </div>

          {/* Recurrence - Simplified */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center space-x-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="recurrenceType">Repeat</Label>
            </div>
            <Select value={recurrenceType} onValueChange={(value) => setRecurrenceType(value as RecurrenceType)}>
              <SelectTrigger>
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

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
