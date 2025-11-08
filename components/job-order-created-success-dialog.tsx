"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PartyPopper, FileText, Package, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { getJobOrderById } from "@/lib/job-order-service"
import type { JobOrder } from "@/lib/types/job-order"
import { useState, useEffect, useRef } from "react"
import { generateJobOrderPDF } from "@/lib/job-order-pdf-generator"

interface JobOrderCreatedSuccessDialogProps {
  isOpen: boolean
  onClose: () => void
  joIds?: string[]
  isMultiple?: boolean
  title?: string
  message?: string
  showPrintButton?: boolean
  onPrint?: () => void
  onConfirm?: () => void
  confirmButtonText?: string
}

export function JobOrderCreatedSuccessDialog({
  isOpen,
  onClose,
  joIds = [],
  isMultiple = false,
  title = "Congratulations!",
  message = "You have successfully created a JO!",
  showPrintButton = true,
  onPrint,
  onConfirm,
  confirmButtonText = "OK",
}: JobOrderCreatedSuccessDialogProps) {
  const { userData } = useAuth()
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [isLoadingPrint, setIsLoadingPrint] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const notificationsSentRef = useRef<Set<string>>(new Set())

  // Fetch job order data when dialog opens (only if joIds provided)
  useEffect(() => {
    if (isOpen && joIds.length > 0) {
      const fetchJobOrders = async () => {
        setIsLoadingData(true)
        try {
          const fetchedJobOrders: JobOrder[] = []
          for (const joId of joIds) {
            const jobOrder = await getJobOrderById(joId)
            if (jobOrder) {
              fetchedJobOrders.push(jobOrder)
            }
          }
          setJobOrders(fetchedJobOrders)
        } catch (error) {
          console.error("Error fetching job orders:", error)
        } finally {
          setIsLoadingData(false)
        }
      }
      fetchJobOrders()
    }
  }, [isOpen, joIds])

  const generateAndPrintPDF = async () => {
    if (jobOrders.length === 0) return

    setIsLoadingPrint(true)
    try {
      // Generate PDF for each job order
      for (const jobOrder of jobOrders) {
        await generateJobOrderPDF(jobOrder, "print",false)
      }
      onClose()
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsLoadingPrint(false)
    }
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    } else {
      onClose()
    }
  }


  // Fetch job order data when dialog opens
  useEffect(() => {
    if (isOpen && joIds.length > 0) {
      const fetchJobOrders = async () => {
        setIsLoadingData(true)
        try {
          const fetchedJobOrders: JobOrder[] = []
          for (const joId of joIds) {
            const jobOrder = await getJobOrderById(joId)
            if (jobOrder) {
              fetchedJobOrders.push(jobOrder)
            }
          }
          setJobOrders(fetchedJobOrders)

        } catch (error) {
          console.error("Error fetching job orders:", error)
        } finally {
          setIsLoadingData(false)
        }
      }
      fetchJobOrders()
    }
  }, [isOpen, joIds, userData])




  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
           <DialogTitle className="text-center text-xl font-semibold text-gray-900">
             {title}
           </DialogTitle>
         </DialogHeader>
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full">
            <PartyPopper className="w-8 h-8 text-yellow-600" />
          </div>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            {isMultiple && (
              <Badge variant="secondary">
                <Package className="h-3 w-3 mr-1" />
                {joIds.length} Job Orders
              </Badge>
            )}
          </div>
          <p className="text-gray-600">
            {message}
          </p>
          <div className="space-y-2">
          </div>
          <div className="flex gap-2 w-full">
            {showPrintButton && joIds.length > 0 && (
              <Button
                variant="outline"
                onClick={onPrint || generateAndPrintPDF}
                disabled={isLoadingData || isLoadingPrint || jobOrders.length === 0}
                className="w-full"
              >
                {isLoadingPrint ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Print"
                )}
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              className="w-full"
            >
              {confirmButtonText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
