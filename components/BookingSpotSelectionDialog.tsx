import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { any } from "zod"
import { updateDoc, doc } from "firebase/firestore"
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
}

export function BookingSpotSelectionDialog({
  open,
  onOpenChange,
  retailSpotNumbers,
  totalSpots,
  onSpotSelect,
  activePages,
  booking
}: BookingSpotSelectionDialogProps) {
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null)

  const handleSpotClick = (spotNumber: number) => {
    if (retailSpotNumbers.includes(spotNumber) && !activePages.some((page: any) => page.spot_number === spotNumber)) {
      setSelectedSpot(spotNumber)
    }
  }
  const generateSpots = (totalSpots: number) => {
    const spots = []

    // Fill the array with a placeholder value until the length equals totalSpots
    for (let i = 1; i <= totalSpots; i++) {
      // You can use any value here, like null, 0, or an object,
      // depending on what you intend the "spots" to represent.
      spots.push({
        spot_number: i ,
        isRetail: retailSpotNumbers.includes(i),
        isTaken: activePages.some((page: any) => page.spot_number === i)
      }) // Using (i + 1) to generate sequential numbers (1, 2, 3, ...)
      console.log(`Generated spot: ${activePages.some((page: any) => page.spot_number === i)} spot number: ${i}`)
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
          const isAvailable = spot.isRetail

          return (
            <div
              key={spot.spot_number}
              className={`w-[60px] h-[60px] rounded-md text-xs flex items-center justify-center ${isSelected
                  ? 'bg-indigo-300 shadow-lg'
                  : spot.isTaken
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