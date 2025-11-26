"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { Booking } from "@/lib/booking-service"
import { bookingService } from "@/lib/booking-service"

interface ProgramListTabProps {
  selectedMonth: number
  setSelectedMonth: (month: number) => void
  selectedDay: number
  setSelectedDay: (day: number) => void
  selectedYear: number
  setSelectedYear: (year: number) => void
  activePlaylistPages: any[]
  cms: any
  bookings: Booking[]
  loading?: boolean
  retailSite: number[]
}

const ProgramListTab: React.FC<ProgramListTabProps> = ({
  selectedMonth,
  setSelectedMonth,
  selectedDay,
  setSelectedDay,
  selectedYear,
  setSelectedYear,
  activePlaylistPages,
  cms,
  bookings,
  loading = false,
  retailSite,
}) => {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2020 + 1 }, (_, i) => 2020 + i)
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ]

  const [playlistBooking, setPlaylistBooking] = React.useState<Booking | null>(null)
  const [playlistBookingLoading, setPlaylistBookingLoading] = React.useState(false)

  // Get days in selected month/year
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Calculate occupied spots
  const totalSpots = cms?.loops_per_day || 18
  const occupiedByBoohk = 0
  const occupiedByOperator = new Set(bookings.map(b => b.spot_number).filter(Boolean)).size
  const vacant = totalSpots - occupiedByBoohk - occupiedByOperator

  // Generate spots data for selected date
  const spotsData = []
  for (let i = 1; i <= totalSpots; i++) {
    const booking = bookings.find(b => b.spot_number === i)
    const isOccupied = !!booking
    spotsData.push({
      id: `spot-${i}`,
      number: i,
      status: isOccupied ? "occupied" : "vacant",
      occupiedBy: isOccupied ? "operator" : null,
      imageUrl: null,
      endDate: booking?.end_date || null,
    })
  }


  // Fetch booking from playlist pages
  React.useEffect(() => {
    const fetchPlaylistBooking = async () => {
      if (!activePlaylistPages || activePlaylistPages.length === 0) {
        setPlaylistBooking(null)
        return
      }

      // Find the first page with a booking_id
      const pageWithBookingId = activePlaylistPages.find(page => page.booking_id)
      if (!pageWithBookingId?.booking_id) {
        setPlaylistBooking(null)
        return
      }

      setPlaylistBookingLoading(true)
      try {
        const booking = await bookingService.getBookingById(pageWithBookingId.booking_id)
        setPlaylistBooking(booking)
      } catch (error) {
        console.error("Error fetching playlist booking:", error)
        setPlaylistBooking(null)
      } finally {
        setPlaylistBookingLoading(false)
      }
    }

    fetchPlaylistBooking()
  }, [activePlaylistPages])

  return (
    <Card className="rounded-xl shadow-sm border-none p-4">
      <CardContent className="pb-4 overflow-x-auto">
        <div className="flex justify-between items-start mb-6">
          {/* Left side - Title and Filter */}
          <div className="flex-1">
            <div className="mb-2">
              <label className="text-sm font-medium text-gray-700">Select a Date</label>
            </div>
            <div className="flex gap-2">
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-[100px] text-xs h-[24px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedDay.toString()} onValueChange={(value) => setSelectedDay(parseInt(value))}>
                <SelectTrigger className="w-[70px] text-xs h-[24px]">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map(day => (
                    <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[70px] text-xs h-[24px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Right side - Statistics */}
          <div className="flex-1 justify-end">
            <div className="text-right">
              <div className="flex items-center justify-end">
                <span className="text-xs">Total Spot:</span>
                <span className="text-xs ml-1">{totalSpots}</span>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-xs">Occupied by Operator:</span>
                <span className="text-xs ml-1">{totalSpots - retailSite?.length}</span>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-xs">Occupied by Boohk:</span>
                <span className="text-xs ml-1">{retailSite.length}</span>
              </div>
            </div>
          </div>
        </div>


        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-gray-500">Loading program list...</p>
          </div>
        ) : (
          <div className="w-full h-[500px] overflow-x-auto border-b border-gray-200 bg-white">
            <div className="min-w-[800px]">
              <div className="space-y-3">
                {Array.from({ length: totalSpots }, (_, i) => i + 1).map((spotNumber) => {
                  const booking = bookings.find(b => b.spot_number === spotNumber)
                  const startDate = booking?.start_date?.toDate ? booking.start_date.toDate() : booking?.start_date ? new Date(booking.start_date as any) : null
                  const endDate = booking?.end_date?.toDate ? booking.end_date.toDate() : booking?.end_date ? new Date(booking.end_date as any) : null
                  return (
                    <div key={spotNumber} className={`grid grid-cols-5 gap-4 px-4 py-2 items-center text-xs rounded-[10px] hover:bg-white transition-all duration-200 shadow-lg h-[100px] ${retailSite.includes(spotNumber) ? ' bg-[#f6f9ff] border-4 border-blue-400' : 'bg-white border border-transparent'}`}>
                      <div className="text-center">Spot {spotNumber}</div>
                      <div>{booking?.airing_code || '-'}</div>
                      <div>
                        <div className="w-[76px] h-[80px] bg-gray-200 flex items-center justify-center rounded">
                          <video src={booking?.url} disablePictureInPicture className="w-[76px] h-[80px] object-cover rounded-md"></video>
                        </div>
                      </div>
                      <div>{startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</div>
                      <div>{endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ProgramListTab