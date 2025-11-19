import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface BookingSpotSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  retailSpotNumbers: number[]
  totalSpots: number
  takenSpotNumbers: number[]
  onSpotSelect: (spotNumber: number) => void
}

export function BookingSpotSelectionDialog({
  open,
  onOpenChange,
  retailSpotNumbers,
  takenSpotNumbers,
  totalSpots,
  onSpotSelect
}: BookingSpotSelectionDialogProps) {
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null)

  const handleSpotClick = (spotNumber: number) => {
    if (retailSpotNumbers.includes(spotNumber)) {
      setSelectedSpot(spotNumber)
    }
  }
  const generateSpots = (totalSpots: number) => {
    const spots = []

    // Fill the array with a placeholder value until the length equals totalSpots
    for (let i = 0; i < totalSpots; i++) {
      // You can use any value here, like null, 0, or an object,
      // depending on what you intend the "spots" to represent.
      spots.push({
        spot_number: i + 1,
        isRetail: retailSpotNumbers.includes(i + 1)
      }) // Using (i + 1) to generate sequential numbers (1, 2, 3, ...)
    }

    return spots
  }


  const handleNext = () => {
    if (selectedSpot) {
      onSpotSelect(selectedSpot)
      onOpenChange(false)
    }
  }


  const spotPositions = generateSpots(totalSpots)
  console.log(`spots ${JSON.stringify(spotPositions)}`)
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
                  : spot.isRetail
                    ? 'bg-[#f0f1fd] cursor-pointer shadow-lg'
                    : 'bg-white cursor-not-allowed opacity-[0.15]'
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