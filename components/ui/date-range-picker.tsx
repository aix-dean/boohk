"use client"

import * as React from "react"
import { format, addDays } from "date-fns"
import { CalendarIcon, ChevronDown, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxDays?: number
  showClearButton?: boolean
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
  disabled = false,
  maxDays = 5,
  showClearButton = true,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(value)
  const [open, setOpen] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  React.useEffect(() => {
    setDate(value)
  }, [value])

  const handleSelect = (range: DateRange | undefined) => {
    console.log('DateRangePicker: handleSelect called with range:', range, 'current date:', date)
    if (date?.from && !date?.to && range?.from) {
      // Only start date selected, treat any date click as selecting new start date
      console.log('DateRangePicker: Changing start date to:', range.from)
      const newDate = { from: range.from }
      setDate(newDate)
      onChange?.(newDate)
    } else {
      // Normal range selection or initial selection
      setDate(range)
      if (range?.from && range?.to) {
        console.log('DateRangePicker: Both dates selected, calling onChange and closing popover')
        onChange?.(range)
        setOpen(false)
      } else {
        console.log('DateRangePicker: Only start date selected, keeping popover open')
        // Keep popover open when only start date is selected, allowing user to complete date range
        // Update onChange even if only one date is selected for partial updates
        onChange?.(range)
      }
    }
  }

  const handleClear = () => {
    setDate(undefined)
    onChange?.(undefined)
    setOpen(false)
  }

  const formatDateRange = (from: Date, to: Date) => {
    const fromMonth = format(from, 'MMM')
    const fromDay = format(from, 'dd')
    const toDay = format(to, 'dd')
    const year = format(from, 'yyyy')
    if (format(from, 'yyyy-MM') === format(to, 'yyyy-MM')) {
      return `${fromMonth} ${fromDay}-${toDay}, ${year}`
    } else {
      const toMonth = format(to, 'MMM')
      return `${fromMonth} ${fromDay} - ${toMonth} ${toDay}, ${year}`
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={(newOpen) => {
        console.log('DateRangePicker: onOpenChange called with newOpen:', newOpen, 'current date:', date)
        if (!newOpen && open && (!date?.from || !date?.to)) {
          console.log('DateRangePicker: Preventing close - date range is incomplete')
          // Don't close if the popover is currently open and the range is not complete (missing from or to)
          return;
        }
        console.log('DateRangePicker: Setting open to:', newOpen)
        setOpen(newOpen);
      }}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-between text-left font-normal text-gray-700 text-xs leading-none border border-gray-300 bg-gray-50 rounded-lg px-4 py-2.5 h-10 transition-all duration-200 hover:border-gray-400 hover:bg-gray-100 hover:shadow-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400",
              className,
              !date && "text-gray-500",
              isHovered && "border-gray-400 bg-gray-100 shadow-md",
              open && "ring-2 ring-blue-400 border-blue-400 bg-white"
            )}
            disabled={disabled}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="Select date range"
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span className="flex-1 truncate">
              {date?.from ? (
                date.to ? (
                  formatDateRange(date.from, date.to)
                ) : (
                  format(date.from, "MMM dd, yyyy")
                )
              ) : (
                placeholder
              )}
            </span>
            <div className="flex items-center gap-1 ml-2">
              {showClearButton && date && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-gray-200 hover:text-gray-700 rounded-full transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear()
                  }}
                  aria-label="Clear date range"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 shadow-xl border border-gray-300 bg-white rounded-xl overflow-hidden"
          align="start"
          sideOffset={6}
        >
          <div className="p-5 bg-gray-50">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
              className="rounded-md"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-semibold text-gray-700",
                nav: "space-x-1 flex items-center",
                nav_button: "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-gray-200 rounded-lg transition-all duration-200",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-gray-500 rounded-md w-9 font-medium text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-50 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
                day: "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-blue-100 hover:text-blue-900 focus:bg-blue-100 focus:text-blue-900 rounded-lg transition-all duration-200",
                day_selected: "bg-blue-500 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                day_today: "bg-blue-50 text-blue-900 font-semibold",
                day_outside: "text-gray-400 opacity-50",
                day_disabled: "text-gray-400 opacity-50",
                day_range_middle: "aria-selected:bg-blue-100 aria-selected:text-blue-900",
                day_hidden: "invisible",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
