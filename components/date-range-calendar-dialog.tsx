"use client"
import { useState } from "react"
import { format, addMonths, subMonths, isSameDay, isWithinInterval, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface DateRangeCalendarDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectDates: (startDate: Date, endDate: Date) => void
  onSkipDates?: () => void
  selectedSiteIds: string[] // To potentially fetch reserved dates for these sites
  selectedClientId?: string // To potentially fetch reserved dates for this client
  showSkipButton?: boolean // Controls whether Skip button is shown (default: true)
}

// Mock reserved dates for demonstration purposes
// In a real application, you would fetch these from your backend based on selectedSiteIds
const MOCK_RESERVED_DATES: Date[] = [
  parseISO("2025-04-15"),
  parseISO("2025-04-16"),
  parseISO("2025-04-17"),
  parseISO("2025-04-18"),
  parseISO("2025-04-19"),
  parseISO("2025-04-20"),
  parseISO("2025-04-21"),
  parseISO("2025-04-22"),
  parseISO("2025-04-23"),
  parseISO("2025-04-24"),
  parseISO("2025-04-25"),
  parseISO("2025-04-26"),
  parseISO("2025-04-27"),
  parseISO("2025-04-28"),
  parseISO("2025-04-29"),
  parseISO("2025-04-30"),
  parseISO("2025-05-01"),
  parseISO("2025-05-02"),
  parseISO("2025-05-03"),
  parseISO("2025-05-04"),
  parseISO("2025-05-05"),
  parseISO("2025-05-06"),
  parseISO("2025-05-07"),
  parseISO("2025-05-08"),
  parseISO("2025-05-09"),
  parseISO("2025-05-10"),
  parseISO("2025-05-11"),
  parseISO("2025-05-12"),
  parseISO("2025-05-13"),
  parseISO("2025-05-14"),
  parseISO("2025-05-15"),
  parseISO("2025-05-16"),
  parseISO("2025-05-17"),
  parseISO("2025-05-18"),
  parseISO("2025-05-19"),
  parseISO("2025-05-20"),
  parseISO("2025-05-21"),
  parseISO("2025-05-22"),
  parseISO("2025-05-23"),
  parseISO("2025-05-24"),
  parseISO("2025-05-25"),
  parseISO("2025-05-26"),
  parseISO("2025-05-27"),
  parseISO("2025-05-28"),
  parseISO("2025-05-29"),
  parseISO("2025-05-30"),
  parseISO("2025-05-31"),
  parseISO("2025-06-01"),
  parseISO("2025-06-02"),
  parseISO("2025-06-03"),
  parseISO("2025-06-04"),
  parseISO("2025-06-05"),
  parseISO("2025-06-06"),
  parseISO("2025-06-07"),
  parseISO("2025-06-08"),
  parseISO("2025-06-09"),
  parseISO("2025-06-10"),
  parseISO("2025-06-11"),
  parseISO("2025-06-12"),
  parseISO("2025-06-13"),
  parseISO("2025-06-14"),
  parseISO("2025-06-15"),
  parseISO("2025-06-16"),
  parseISO("2025-06-17"),
  parseISO("2025-06-18"),
  parseISO("2025-06-19"),
  parseISO("2025-06-20"),
  parseISO("2025-06-21"),
]

export function DateRangeCalendarDialog({
  isOpen,
  onClose,
  onSelectDates,
  onSkipDates,
  selectedSiteIds,
  selectedClientId,
  showSkipButton = true,
}: DateRangeCalendarDialogProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined)
  const { toast } = useToast()

  // In a real app, you'd fetch reserved dates based on selectedSiteIds and selectedClientId
  // For now, we use mock data.
  const reservedDates = MOCK_RESERVED_DATES

  const handleDayClick = (day: Date) => {
    if (reservedDates.some((reservedDay) => isSameDay(reservedDay, day))) {
      toast({
        title: "Date Reserved",
        description: "This date is already reserved and cannot be selected.",
        variant: "destructive",
      })
      return
    }

    if (!startDate || (startDate && endDate)) {
      // Start a new selection
      setStartDate(day)
      setEndDate(undefined)
      setHoveredDate(undefined)
    } else if (day < startDate) {
      // If new day is before start date, make it the new start date
      setStartDate(day)
      setEndDate(undefined)
      setHoveredDate(undefined)
    } else {
      // Select end date
      setEndDate(day)
    }
  }

  const handleMouseEnter = (day: Date) => {
    if (startDate && !endDate) {
      setHoveredDate(day)
    }
  }

  const handleMouseLeave = () => {
    setHoveredDate(undefined)
  }

  const isDateSelected = (day: Date) => {
    if (startDate && endDate) {
      return isWithinInterval(day, { start: startDate, end: endDate })
    }
    if (startDate && hoveredDate) {
      const start = startDate < hoveredDate ? startDate : hoveredDate
      const end = startDate < hoveredDate ? hoveredDate : startDate
      return isWithinInterval(day, { start, end })
    }
    return isSameDay(day, startDate || new Date(0)) || isSameDay(day, endDate || new Date(0))
  }

  const isDateReserved = (day: Date) => {
    return reservedDates.some((reservedDay) => isSameDay(reservedDay, day))
  }

  const renderMonth = (date: Date) => {
    const startDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const endDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    const daysInMonth = endDay.getDate()

    const firstDayOfWeek = startDay.getDay() // 0 for Sunday, 1 for Monday, etc.

    const days = []
    // Add empty cells for days before the 1st of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="w-full h-10" />)
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(date.getFullYear(), date.getMonth(), i)
      const isToday = isSameDay(day, new Date())
      const isSelected = isDateSelected(day)
      const isReserved = isDateReserved(day)

      days.push(
        <div
          key={i}
          className={cn(
            "w-full h-10 flex items-center justify-center rounded-md text-sm font-medium cursor-pointer transition-colors duration-100",
            "hover:bg-gray-100",
            isToday && "border border-blue-500",
            isReserved && "bg-red-100 text-red-800 cursor-not-allowed opacity-70",
            isSelected && !isReserved && "bg-blue-500 text-white hover:bg-blue-600",
            startDate && isSameDay(day, startDate) && !isReserved && "rounded-l-md",
            endDate && isSameDay(day, endDate) && !isReserved && "rounded-r-md",
            startDate &&
              endDate &&
              isWithinInterval(day, { start: startDate, end: endDate }) &&
              !isReserved &&
              "rounded-none",
            startDate &&
              hoveredDate &&
              isWithinInterval(day, { start: startDate, end: hoveredDate }) &&
              !isReserved &&
              "bg-blue-200",
            startDate &&
              hoveredDate &&
              isWithinInterval(day, { start: hoveredDate, end: startDate }) &&
              !isReserved &&
              "bg-blue-200",
          )}
          onClick={() => handleDayClick(day)}
          onMouseEnter={() => handleMouseEnter(day)}
          onMouseLeave={handleMouseLeave}
        >
          {i}
        </div>,
      )
    }

    return (
      <div className="flex-1 min-w-[280px] max-w-[320px] p-4 border rounded-lg shadow-sm bg-white">
        <div className="text-center font-semibold text-lg mb-4">{format(date, "MMMM yyyy")}</div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    )
  }

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1))
  }

  const handleConfirm = () => {
    if (startDate && endDate) {
      if (startDate > endDate) {
        toast({
          title: "Invalid Date Range",
          description: "Start date cannot be after end date.",
          variant: "destructive",
        })
        return
      }
      onSelectDates(startDate, endDate)
      onClose()
    } else {
      toast({
        title: "Select Dates",
        description: "Please select both a start and an end date.",
        variant: "destructive",
      })
    }
  }

  const handleSkip = () => {
    if (onSkipDates) {
      onSkipDates()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-xl font-semibold">Select Dates</DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Selected Dates Display */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">
                Start Date:
              </Label>
              <Input
                id="startDate"
                value={startDate ? format(startDate, "MMM dd, yyyy") : "-Select Date-"}
                readOnly
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="endDate" className="text-sm font-medium text-gray-700">
                End Date:
              </Label>
              <Input
                id="endDate"
                value={endDate ? format(endDate, "MMM dd, yyyy") : "-Select Date-"}
                readOnly
                className="mt-1"
              />
            </div>
          </div>

          {/* Calendar View */}
          <div className="relative flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="absolute left-0 z-10">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div className="flex flex-wrap justify-center gap-4">
              {renderMonth(subMonths(currentMonth, 1))}
              {renderMonth(currentMonth)}
              {renderMonth(addMonths(currentMonth, 1))}
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="absolute right-0 z-10">
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-red-100 border border-red-300" />
              <span className="text-sm text-gray-700">Reserved</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm bg-white border border-gray-300" />
              <span className="text-sm text-gray-700">Vacant</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          {showSkipButton && (
            <Button variant="outline" onClick={handleSkip} className="px-6 py-2 rounded-md bg-transparent">
              Skip
            </Button>
          )}
          <Button onClick={handleConfirm} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md">
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
