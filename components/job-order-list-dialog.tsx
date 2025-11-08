import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import { collection, query, where, orderBy, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { JobOrder } from "@/lib/types/job-order"
import { format } from "date-fns"

interface JobOrderListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  onSelectJobOrder: (jobOrder: JobOrder) => void
}

export function JobOrderListDialog({ open, onOpenChange, companyId, onSelectJobOrder }: JobOrderListDialogProps) {
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (open && companyId) {
      const fetchJobOrders = async () => {
        setLoading(true)
        try {
          const q = query(
            collection(db, "job_orders"),
            where("company_id", "==", companyId),
            orderBy("created", "desc")
          )
          const querySnapshot = await getDocs(q)
          const fetchedJobOrders: JobOrder[] = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as JobOrder[]
          setJobOrders(fetchedJobOrders)
        } catch (error) {
          console.error("Error fetching job orders:", error)
        } finally {
          setLoading(false)
        }
      }
      fetchJobOrders()
    }
  }, [open, companyId])

  const filteredJobOrders = jobOrders.filter((jo) =>
    jo.joNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    jo.campaignName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    jo.joType.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle>Select Job Order</DialogTitle>
          <DialogDescription>
            Choose a job order from the list below to pre-fill service assignment details.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by JO#, Campaign Name, or Type"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading Job Orders...</span>
          </div>
        ) : (
          <ScrollArea className="h-80 w-full rounded-md border">
            <div className="p-4">
              {filteredJobOrders.length > 0 ? (
                filteredJobOrders.map((jo) => (
                  <div
                    key={jo.id}
                    className="flex items-center justify-between p-3 mb-2 border rounded-md hover:bg-gray-50 cursor-pointer"
                    onClick={() => onSelectJobOrder(jo)}
                  >
                    <div>
                      <p className="font-semibold text-sm text-blue-600">JO#: {jo.joNumber}</p>
                      <p className="text-xs text-gray-700">{jo.campaignName || "N/A"}</p>
                      <p className="text-xs text-gray-500">{jo.joType}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {jo.dateRequested ? format(new Date(jo.dateRequested), "MMM d, yyyy") : "N/A"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No job orders found.</p>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
