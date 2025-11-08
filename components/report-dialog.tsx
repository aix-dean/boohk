"use client"

import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { PDFViewer } from "@/components/ui/pdf-viewer"
import { type ReportData } from "@/lib/report-service"

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedReport: ReportData | null
}

export function ReportDialog({ open, onOpenChange, selectedReport }: ReportDialogProps) {
  const router = useRouter()

  const formatDate = (date: any) => {
    if (!date) return "N/A"

    let dateObj: Date
    if (date.toDate) {
      dateObj = date.toDate()
    } else if (date instanceof Date) {
      dateObj = date
    } else {
      dateObj = new Date(date)
    }

    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getReportTypeDisplay = (reportType: string) => {
    switch (reportType) {
      case "completion-report":
        return "Completion Report"
      case "monitoring-report":
        return "Monitoring Report"
      case "installation-report":
        return "Installation Report"
      case "roll-down":
        return "Roll Down"
      default:
        return reportType
    }
  }

  if (!open || !selectedReport) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => onOpenChange(false)} />

      <div className="relative bg-white rounded-[13.681px] w-[95vw] max-w-6xl h-[95vh] px-6 py-2 flex flex-col">

        {/* Close button */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#333333] cursor-pointer hover:bg-gray-100 rounded-full p-1"
          >
            <X size={20} className="font-bold"/>
          </button>
        </div>

        {/* Title */}
        <p className="text-center font-light py-2 text-[#333333] text-[16px]">
          {getReportTypeDisplay(selectedReport.reportType)}_{formatDate(selectedReport.date).replace(/\s+/g, '_').replace(/,/g, '')}.pdf
        </p>

        {/* Content Area - Centered */}
        <div className="flex-1 flex items-start justify-center bg-gray-100 w-full h-full">
          <div className="flex-1 min-h-0 overflow-hidden w-full h-full">
            {(() => {
              const pdfAttachment = selectedReport.logistics_report

              if (pdfAttachment) {
                return (
                  <PDFViewer fileUrl={`${pdfAttachment}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full rounded-lg border"/>
                )
              } else {
                return (
                  <div className="text-center text-gray-500">
                    <p className="text-lg font-medium">No PDF Available</p>
                    <p className="text-sm">The report PDF has not been generated yet.</p>
                  </div>
                )
              }
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-start my-4">
          {/* Prepared By Section */}
          <div className="font-light text-[#333333] text-[12px] w-[273px]">
            <p>
              <span className="font-bold">Prepared By: </span>
              <span className="font-normal">{selectedReport.createdByName || "Unknown"}</span>
            </p>
            <p>
              <span className="font-bold">Date:</span>
              <span> {formatDate(selectedReport.created)}</span>
            </p>
            <p>
              <span className="font-bold">Time: </span>
              {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })} GMT
            </p>
          </div>

          {/* Forward Button */}
          <div className="bg-[#1d0beb] h-[32.15px] rounded-[6.84px] w-[127.23px]">
            <button
              onClick={() => router.push(`/sales/reports/compose/${selectedReport.id}`)}
              className="w-full h-full text-white font-bold text-[13.681px] text-center leading-none"
            >
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}