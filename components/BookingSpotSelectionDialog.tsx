import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { any } from "zod"
import { updateDoc, doc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Booking } from "@/lib/booking-service"

interface BookingSpotSelectionDialogProps {
   open: boolean
   onOpenChange: (open: boolean) => void
   retailSpotNumbers: number[]
   totalSpots: number
   takenSpotNumbers: number[]
   onSpotSelect: (spotNumber: number) => void
   activePages: any[]
   booking: Booking | null
   productId?: string
 }

export function BookingSpotSelectionDialog({
   open,
   onOpenChange,
   retailSpotNumbers,
   totalSpots,
   onSpotSelect,
   activePages,
   booking,
   productId
}: BookingSpotSelectionDialogProps) {
   const [selectedSpot, setSelectedSpot] = useState<number | null>(null)
   const [playlistPages, setPlaylistPages] = useState<any[]>([])

   const datesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
      console.log("Checking overlap between", start1, end1, "and", start2, end2 ,"result:",  start1 <= end2 && start2 <= end1);
      console.log("result:", start1 <= end2 && start2 <= end1);
     return start2 <= end1
   }

   useEffect(() => {
     if (!productId) return

     const fetchPlaylist = async () => {
       try {
         const playlistQuery = query(
           collection(db, "playlist"),
           where("product_id", "==", productId),
           orderBy("created", "desc"),
           limit(1)
         )
         const playlistSnap = await getDocs(playlistQuery)
         if (!playlistSnap.empty) {
           const latestPlaylist = playlistSnap.docs[0].data()
           const allPages = latestPlaylist.pages || []

           // Filter pages to only include those with schedules that are not expired
           const today = new Date()
           today.setHours(0, 0, 0, 0)
           const futurePages = allPages.filter((page: any) =>
             page.schedules?.some((schedule: any) => {
               let scheduleEndDate = schedule.endDate?.toDate
                 ? schedule.endDate.toDate()
                 : new Date(schedule.endDate)
               scheduleEndDate.setHours(0, 0, 0, 0)
               return scheduleEndDate >= today
             })
           )
           setPlaylistPages(futurePages)
         } else {
           setPlaylistPages([])
         }
       } catch (error) {
         console.error("Error fetching playlist:", error)
         setPlaylistPages([])
       }
     }

     fetchPlaylist()
   }, [productId])

   const handleSpotClick = (spotNumber: number) => {
    if (retailSpotNumbers.includes(spotNumber) && !activePages.some((page: any) => page.spot_number === spotNumber)) {
      setSelectedSpot(spotNumber)
    }
  }
  const generateSpots = (totalSpots: number) => {
    const spots = []

    // Fill the array with a placeholder value until the length equals totalSpots
    for (let i = 1; i <= totalSpots; i++) {
      const isRetail = retailSpotNumbers.includes(i)
      const isTaken = activePages.some((page: any) => page.spot_number === i)

      // Check for schedule overlap
      let hasOverlap = false
      if (booking && booking.start_date && booking.end_date) {
        const bookingStart = booking.start_date.toDate()
        const bookingEnd = booking.end_date.toDate()

        // Check all pages for this spot in the playlist
        const spotPages = playlistPages.filter((page: any) => page.spot_number === i)
        for (const page of spotPages) {
          if (page.schedules) {
            for (const schedule of page.schedules) {
              if (schedule.startDate && schedule.endDate) {
                const scheduleStart = schedule.startDate.toDate ? schedule.startDate.toDate() : new Date(schedule.startDate)
                const scheduleEnd = schedule.endDate.toDate ? schedule.endDate.toDate() : new Date(schedule.endDate)
                if (datesOverlap(bookingStart, bookingEnd, scheduleStart, scheduleEnd)) {
                  hasOverlap = true
                  break
                }
              }
            }
          }
        }
      }

      spots.push({
        spot_number: i ,
        isRetail,
        isTaken,
        hasScheduleOverlap: hasOverlap
      })
    }

    return spots
  }


  const handleNext = async () => {
    if (selectedSpot) {
      // Update the booking document with spot_number
      if (booking) {
        try {
          await updateDoc(doc(db, "booking", booking.id), {
            spot_number: selectedSpot,
            status: 'ongoing',
            updated: new Date()
          })
          setSelectedSpot(null)
        } catch (error) {
          console.error("Error updating booking with spot_number:", error)
        }
      }
      onSpotSelect(selectedSpot)
      onOpenChange(false)
    }
  }


  const spotPositions = generateSpots(totalSpots)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[740px] h-[439px]">
        <DialogHeader className="relative">
          <DialogTitle className="text-[22px] font-bold">Select a spot for this booking</DialogTitle>
          <DialogClose className="absolute top-[-10px] right-0">
            <X className="w-4 h-4"/>
          </DialogClose>
        </DialogHeader>
        <div className="text-xs">
          Choose from available Retail Spots.
        </div>

      <div className="grid grid-cols-5 gap-2 overflow-y-auto">
              {/* Spots */}
        {spotPositions.map((spot) => {
          const isSelected = selectedSpot === spot.spot_number
          const isAvailable = spot.isRetail && !spot.isTaken && !spot.hasScheduleOverlap

          return (
            <div
              key={spot.spot_number}
              className={`w-[60px] h-[60px] rounded-md text-xs flex items-center justify-center ${isSelected
                  ? 'bg-indigo-300 shadow-lg'
                  : spot.isTaken || spot.hasScheduleOverlap
                    ?'bg-gray-400 cursor-not-allowed opacity-50 shadow-md'
                    : spot.isRetail 
                      ? 'bg-[#f0f1fd] cursor-pointer shadow-lg'
                      : 'bg-gray-100 cursor-not-allowed opacity-10'
                }`}
              onClick={() => isAvailable && handleSpotClick(spot.spot_number)}
            >
              <div>
              {spot.spot_number}/{spotPositions.length}</div>
            </div>
          )
        })}
      </div>


        <DialogFooter>
          <Button
            onClick={handleNext}
            disabled={!selectedSpot}
            className="w-[90px] h-6 rounded-[6px] bg-blue-600 text-white"
          >
            Next →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}