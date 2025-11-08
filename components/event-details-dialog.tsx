"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, MapPin, Clock, User, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { SalesEvent } from "@/lib/planner-service"
import { format } from "date-fns"

interface EventDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  event: SalesEvent | null
}

export function EventDetailsDialog({ isOpen, onClose, event }: EventDetailsDialogProps) {
  if (!event) return null

  const formatEventDate = (date: Date | any) => {
    if (!date) return "N/A"
    const d = date instanceof Date ? date : date.toDate()
    return format(d, "EEEE, MMMM d, yyyy")
  }

  const formatEventTime = (date: Date | any) => {
    if (!date) return ""
    const d = date instanceof Date ? date : date.toDate()
    return format(d, "h:mm a")
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "meeting":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "holiday":
        return "bg-green-100 text-green-800 border-green-200"
      case "party":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md relative sm:max-w-md fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-6">
        <button
          onClick={() => onClose()}
          className="absolute -top-2 -right-2 z-10 bg-gray-500 hover:bg-gray-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold">Event Details</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide space-y-4 px-1">
          {/* Event Title and Status */}
          <div className="bg-gray-100 p-3 rounded-lg space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getEventTypeColor(event.type)}>
                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
              </Badge>
              <Badge variant="outline" className={getStatusColor(event.status)}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Event Details */}
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              {/* Date and Time */}
              <div className="flex items-start gap-3">
                <CalendarIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">Date & Time</div>
                  <div className="text-sm text-gray-600">
                    {formatEventDate(event.start)}
                    {!event.allDay && (
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {formatEventTime(event.start)}
                          {event.end && ` - ${formatEventTime(event.end)}`}
                        </span>
                      </div>
                    )}
                    {event.allDay && <div className="text-sm text-gray-500 mt-1">All day event</div>}
                  </div>
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">Location</div>
                    <div className="text-sm text-gray-600">{event.location}</div>
                  </div>
                </div>
              )}

              {/* Department */}
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-gray-900">Department</div>
                  <div className="text-sm text-gray-600 capitalize">{event.department}</div>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">Description</div>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    {event.description}
                  </div>
                </div>
              )}

              {/* Recurrence */}
              {event.recurrence && event.recurrence.type !== "none" && (
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">Recurrence</div>
                  <div className="text-sm text-gray-600">
                    Repeats {event.recurrence.type}
                    {event.recurrence.interval > 1 && ` every ${event.recurrence.interval} ${event.recurrence.type}s`}
                  </div>
                </div>
              )}

              {/* Created By */}
              {event.createdBy && (
                <div className="text-xs text-gray-500 pt-2 border-t">
                  Created by: {event.clientName || "Unknown"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <style jsx global>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}