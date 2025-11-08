"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, User, FileText, Check } from "lucide-react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import type { JobOrder } from "@/lib/types/job-order"

interface JobOrderSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  companyId: string
  onSelectJobOrder: (jobOrder: JobOrder) => void
  selectedJobOrderId?: string | null
}

export function JobOrderSelectionDialog({
  open,
  onOpenChange,
  productId,
  companyId,
  onSelectJobOrder,
  selectedJobOrderId,
}: JobOrderSelectionDialogProps) {
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSelectedJobOrderId, setCurrentSelectedJobOrderId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{
    hasNextPage: boolean
    hasPrevPage: boolean
    lastDocId: string | null
  } | null>(null)

  const fetchJobOrders = async (page: number = 1, lastDocId?: string | null) => {
    if (!productId || !companyId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        productId,
        page: page.toString(),
      })

      // Only add companyId if it's provided (for backward compatibility)
      if (companyId) {
        params.append("companyId", companyId)
      }

      if (lastDocId) {
        params.append("lastDocId", lastDocId)
      }

      console.log('API Call:', `/api/logistics/assignments/job-orders?${params}`)
      const response = await fetch(`/api/logistics/assignments/job-orders?${params}`)
      const data = await response.json()
      console.log('API Response:', data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch job orders")
      }

      // The API already returns the correct number of items (10 + 1 for pagination check)
      // Just use what the API returns, it handles the pagination logic
      setJobOrders(data.jobOrders)
      setPagination(data.pagination)
      setCurrentPage(page)

      // Debug info
      console.log('Job Orders Debug:', data.debug)
      console.log('Job Orders:', data.jobOrders.length, 'items')
    } catch (err) {
      console.error("Error fetching job orders:", err)
      setError("Failed to load job orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && productId) {
      console.log('Opening dialog with productId:', productId, 'companyId:', companyId)
      fetchJobOrders(1)
      setCurrentSelectedJobOrderId(selectedJobOrderId || null) // Reset selection when dialog opens
      setCurrentPage(1) // Reset page when dialog opens
    }
  }, [open, productId])

  const handleNextPage = () => {
    if (pagination?.hasNextPage && pagination.lastDocId) {
      fetchJobOrders(currentPage + 1, pagination.lastDocId)
    }
  }

  const handlePrevPage = () => {
    if (pagination?.hasPrevPage) {
      fetchJobOrders(currentPage - 1)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
      case "in progress":
        return "bg-blue-100 text-blue-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateValue: string | Date) => {
    if (!dateValue) return "N/A"
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
      return format(date, "MMM dd, yyyy")
    } catch {
      return "Invalid date"
    }
  }

  const handleSelectJobOrder = () => {
    if (currentSelectedJobOrderId) {
      const selectedJobOrder = jobOrders.find(jo => jo.id === currentSelectedJobOrderId)
      if (selectedJobOrder) {
        onSelectJobOrder(selectedJobOrder)
        onOpenChange(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Job Order
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Choose a job order to associate with this service assignment
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading job orders...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => fetchJobOrders(1)} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {!loading && !error && jobOrders.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No job orders found for this site.</p>
            </div>
          )}

          {!loading && !error && jobOrders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jobOrders.map((jo) => (
                <div
                  key={jo.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    currentSelectedJobOrderId === jo.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:shadow-md hover:border-gray-300"
                  }`}
                  onClick={() => setCurrentSelectedJobOrderId(jo.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        currentSelectedJobOrderId === jo.id
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}>
                        {currentSelectedJobOrderId === jo.id && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900">{jo.joNumber}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                            {jo.joType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(jo.status)} text-xs px-1.5 py-0.5`}>
                      {jo.status.charAt(0).toUpperCase() + jo.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="space-y-1 mb-2">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <User className="h-3 w-3" />
                      <span className="font-medium">Client:</span>
                      <span className="text-gray-900 truncate">
                        {jo.clientName}
                        {jo.clientCompany && jo.clientCompany !== jo.clientName && (
                          <span className="text-gray-600"> ({jo.clientCompany})</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar className="h-3 w-3" />
                      <span className="font-medium">Deadline:</span>
                      <span className="text-gray-900">{formatDate(jo.deadline)}</span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="font-medium">Requested:</span>
                      <span className="text-gray-900">{formatDate(jo.dateRequested)}</span>
                    </div>
                  </div>

                  {jo.remarks && jo.remarks !== "n/a" && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Remarks:</span>
                      <p className="text-gray-900 mt-0.5 truncate">{jo.remarks}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {(pagination?.hasPrevPage || pagination?.hasNextPage) && (
          <div className="flex justify-center items-center gap-2 py-4 border-t">
            <Button
              onClick={handlePrevPage}
              disabled={!pagination?.hasPrevPage}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={!pagination?.hasNextPage}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={handleSelectJobOrder}
            disabled={!currentSelectedJobOrderId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Select Job Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
