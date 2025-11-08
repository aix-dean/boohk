"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, User, FileText, ExternalLink, Plus } from "lucide-react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

interface JobOrder {
  id: string
  joNumber: string
  joType: string
  status: string
  siteName: string
  clientName: string
  clientCompany: string
  dateRequested: string
  deadline: string
  totalAmount: number
  remarks: string
  assignTo: string
  createdAt: any
}

interface JobOrdersListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  siteName: string
  companyId: string
}

export function JobOrdersListDialog({ open, onOpenChange, siteId, siteName, companyId }: JobOrdersListDialogProps) {
   const router = useRouter()
   const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

  const fetchJobOrders = async () => {
    if (!companyId) {
      console.log("[JobOrdersListDialog] Missing required params - companyId:", companyId)
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log("[JobOrdersListDialog] Fetching job orders for companyId:", companyId)
      console.log("[JobOrdersListDialog] Current query will filter by: company_id==", companyId, "- this shows all job orders for the company")
      const jobOrdersRef = collection(db, "job_orders")
      const q = query(jobOrdersRef, where("company_id", "==", companyId))
      console.log("[JobOrdersListDialog] Query created with collection 'job_orders', filters: company_id==", companyId)

      const querySnapshot = await getDocs(q)
      console.log("[JobOrdersListDialog] Query returned", querySnapshot.size, "documents")

      const orders: JobOrder[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        console.log("[JobOrdersListDialog] Processing doc", doc.id, "with data keys:", Object.keys(data))
        console.log("[JobOrdersListDialog] Doc data sample:", {
          joNumber: data.joNumber,
          product_id: data.product_id,
          company_id: data.company_id,
          status: data.status
        })
        orders.push({
          id: doc.id,
          joNumber: data.joNumber || "N/A",
          joType: data.joType || "N/A",
          status: data.status || "unknown",
          siteName: data.siteName || siteName,
          clientName: data.clientName || "N/A",
          clientCompany: data.clientCompany || "N/A",
          dateRequested: data.dateRequested || "",
          deadline: data.deadline || "",
          totalAmount: data.totalAmount || 0,
          remarks: data.remarks || "",
          assignTo: data.assignTo || "",
          createdAt: data.createdAt,
        })
      })

      // Sort by creation date (newest first)
      orders.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toDate() - a.createdAt.toDate()
        }
        return 0
      })

      setJobOrders(orders)
      console.log("[JobOrdersListDialog] Successfully processed", orders.length, "job orders")
    } catch (err) {
      console.error("[JobOrdersListDialog] Error fetching job orders:", err)
      const error = err as Error
      console.error("[JobOrdersListDialog] Error details:", {
        message: error.message,
        stack: error.stack
      })
      setError("Failed to load job orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && siteId && companyId) {
      fetchJobOrders()
    }
  }, [open, siteId, companyId])

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

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      return format(new Date(dateString), "MMM dd, yyyy")
    } catch {
      return "Invalid date"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Orders for {siteName}
          </DialogTitle>
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
              <Button onClick={fetchJobOrders} variant="outline">
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
            <div className="space-y-4">
              {jobOrders.map((jo) => (
                <div key={jo.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{jo.joNumber}</h3>
                      <p className="text-sm text-gray-600">{jo.joType}</p>
                    </div>
                    <Badge className={getStatusColor(jo.status)}>
                      {jo.status.charAt(0).toUpperCase() + jo.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Client:</span>
                      </div>
                      <p className="text-sm text-gray-900">
                        {jo.clientName}
                        {jo.clientCompany && jo.clientCompany !== jo.clientName && (
                          <span className="text-gray-600"> ({jo.clientCompany})</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">Deadline:</span>
                      </div>
                      <p className="text-sm text-gray-900">{formatDate(jo.deadline)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Total Amount:</span>
                      <p className="text-sm text-gray-900 font-semibold">{formatCurrency(jo.totalAmount)}</p>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-gray-600">Date Requested:</span>
                      <p className="text-sm text-gray-900">{formatDate(jo.dateRequested)}</p>
                    </div>
                  </div>

                  {jo.remarks && jo.remarks !== "n/a" && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-600">Remarks:</span>
                      <p className="text-sm text-gray-900 mt-1">{jo.remarks}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/logistics/assignments/create?jobOrderId=${jo.id}`)
                      }}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create SA
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to job order details page
                        router.push(`/logistics/job-orders/${jo.id}`)
                      }}
                      className="flex items-center gap-2"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
