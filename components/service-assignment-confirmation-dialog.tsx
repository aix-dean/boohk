"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle } from "lucide-react"

interface ServiceAssignmentConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  formData: {
    projectSite: string
    serviceType: string
    assignedTo: string
    crew: string
    campaignName?: string
    startDate?: Date | null
    endDate?: Date | null
  }
  selectedProductName?: string
  selectedTeamName?: string
  isSubmitting?: boolean
}

export function ServiceAssignmentConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  formData,
  selectedProductName,
  selectedTeamName,
  isSubmitting = false
}: ServiceAssignmentConfirmationDialogProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "Not set"
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Confirm Service Assignment Details
          </DialogTitle>
          <DialogDescription className="text-base">
            Please review the information below carefully. Once submitted, this service assignment will be created and cannot be easily modified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Site Information */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Site Information
            </h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Site:</span> {selectedProductName || "Not selected"}</p>
              <p><span className="font-medium">Service Type:</span> {formData.serviceType || "Not specified"}</p>
            </div>
          </div>

          {/* Assignment Details */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Assignment Details
            </h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Assigned Team:</span> {selectedTeamName || formData.crew || "Not assigned"}</p>
              <p><span className="font-medium">Campaign Name:</span> {formData.campaignName || "Not specified"}</p>
            </div>
          </div>

          {/* Schedule Information */}
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Schedule Information
            </h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Start Date:</span> {formatDate(formData.startDate)}</p>
              <p><span className="font-medium">End Date:</span> {formatDate(formData.endDate)}</p>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Important Notice
            </h3>
            <p className="text-sm text-amber-800">
              This action will create a new service assignment. Please ensure all details are correct before proceeding.
              The assignment will be sent to the logistics team for approval and scheduling.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Review Details
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm & Create
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}