"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Loader2 } from "lucide-react"
import { formatBookingDates } from "@/lib/booking-service"
import type { Booking } from "@/lib/booking-service"

interface BookingDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking | null
  mode?: 'view' | 'manage' // 'view' for read-only, 'manage' for accept/reject
  onAccept?: () => void
  onReject?: () => void
  isAccepting?: boolean
  title?: string
}

export function BookingDetailsDialog({
  open,
  onOpenChange,
  booking,
  mode = 'view',
  onAccept,
  onReject,
  isAccepting = false,
  title = mode === 'view' ? 'Booking Details' : 'Booking Request'
}: BookingDetailsDialogProps) {
  if (!booking) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="relative">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose className="absolute top-0 right-0">
            <X width="24.007" height="31.209" />
          </DialogClose>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="flex-1 space-y-4">
            <div>
              <label className="text-sm font-medium">Dates</label>
              <p className="text-sm">{formatBookingDates(booking.start_date, booking.end_date)}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Display Name</label>
              <p className="text-sm">{booking.product_name || booking.project_name || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{mode === 'view' ? 'Total Cost' : 'Total Payout'}</label>
              <p className="text-sm">₱{booking.total_cost?.toLocaleString() || booking.cost?.toLocaleString() || "0"}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Booking Code</label>
              <p className="text-sm">BK#{booking.reservation_id || booking.id.slice(-8)}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Client</label>
              <p className="text-sm">{booking.client?.name || 'N/A'}</p>
            </div>
            {mode === 'view' && (
              <div>
                <label className="text-sm font-medium">Status</label>
                <p className="text-sm">{booking.status || 'N/A'}</p>
              </div>
            )}
          </div>
          <div className="w-[320px] space-y-2">
            <label className="text-sm font-medium">Content</label>
            <div className="h-[320px] flex-shrink-0 rounded-[10px] bg-gray-100 flex items-center justify-center">
              {booking.url ? (
                booking.url.includes('.mp4') || booking.url.includes('video') ? (
                  <video src={booking.url} className="w-full h-full object-cover rounded-[10px]" controls />
                ) : (
                  <img src={booking.url} alt="Content preview" className="w-full h-full object-cover rounded-[10px]" />
                )
              ) : (
                <div className="w-full h-full bg-gray-300 flex items-center justify-center rounded-[10px]">
                  <span className="text-gray-500 text-xs">No Media</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={mode === 'manage' ? onReject : undefined}
            disabled={mode === 'view'}
            className="w-[90px] h-[24px] px-[29px] rounded-[6px] border-[1.5px] border-[#C4C4C4] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </Button>
          <Button
            onClick={mode === 'manage' ? onAccept : undefined}
            disabled={mode === 'view' || isAccepting}
            className="w-[120px] h-[24px] rounded-[6.024px] bg-[#30C71D] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAccepting ? <><Loader2 className="animate-spin mr-1 h-4 w-4" />Accepting...</> : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}