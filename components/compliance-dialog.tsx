"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PDFViewer } from "@/components/ui/pdf-viewer"
import { X, Upload, CheckCircle } from "lucide-react"
import { format } from "date-fns"
import { getProjectCompliance } from "@/lib/utils"
import { ComplianceConfirmationDialog } from "@/components/compliance-confirmation-dialog"

interface ComplianceItem {
  key: string
  name: string
  status: "accepted" | "declined" | "uploaded" | "confirmation"
  file?: string
  fileUrl?: string
  note?: string
  uploadedBy?: string
  uploadedAt?: string
  completed?: boolean
}

interface ComplianceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quotation: any
  onFileUpload: (quotationId: string, complianceType: string, file: File) => void
  uploadingFiles: Set<string>
  onAccept?: (quotationId: string, complianceType: string) => void
  onDecline?: (quotationId: string, complianceType: string) => void
  onMarkAsReserved?: (quotation: any) => void
  userEmail?: string
  viewOnly?: boolean
}

export function ComplianceDialog({
  open,
  onOpenChange,
  quotation,
  onFileUpload,
  uploadingFiles,
  onAccept = () => {},
  onDecline = () => {},
  onMarkAsReserved,
  userEmail,
  viewOnly = false
}: ComplianceDialogProps) {
  const [fileViewerOpen, setFileViewerOpen] = useState(false)
  const [selectedFileUrl, setSelectedFileUrl] = useState<string>("")
  const [selectedItemKey, setSelectedItemKey] = useState<string>("")
  const [acceptedItems, setAcceptedItems] = useState<Set<string>>(new Set())
  
  const [declinedItems, setDeclinedItems] = useState<Set<string>>(new Set())

  const compliance = quotation?.projectCompliance || {}

  const getDisplayFilename = (key: string) => {
    switch (key) {
      case "signedContract":
        return "signed-contract.pdf"
      case "paymentAsDeposit":
        return "payment-deposit.pdf"
      case "irrevocablePo":
        return "irrevocable-po.pdf"
      case "finalArtwork":
        return "final-artwork.pdf"
      case "signedQuotation":
        return "signed-quotation.pdf"
      default:
        return "document.pdf"
    }
  }

  const toReserveItems: ComplianceItem[] = [
    {
      key: "signedContract",
      name: "Signed Contract",
      status: acceptedItems.has("signedContract") ? "accepted" : declinedItems.has("signedContract") ? "declined" : (compliance.signedContract?.status === "accepted" || compliance.signedContract?.status === "completed") ? "accepted" : compliance.signedContract?.status === "declined" ? "declined" : compliance.signedContract?.fileUrl ? "uploaded" : "uploaded",
      file: compliance.signedContract?.fileName,
      fileUrl: compliance.signedContract?.fileUrl,
      uploadedBy: compliance.signedContract?.uploadedBy,
      uploadedAt: compliance.signedContract?.uploadedAt,
      completed: compliance.signedContract?.completed,
    },
    {
      key: "paymentAsDeposit",
      name: "Payment as Deposit",
      status: acceptedItems.has("paymentAsDeposit") ? "accepted" : declinedItems.has("paymentAsDeposit") ? "declined" : (compliance.paymentAsDeposit?.status === "accepted" || compliance.paymentAsDeposit?.status === "completed") ? "accepted" : compliance.paymentAsDeposit?.status === "declined" ? "declined" : compliance.paymentAsDeposit?.fileUrl ? "uploaded" : "confirmation",
      file: compliance.paymentAsDeposit?.fileName,
      fileUrl: compliance.paymentAsDeposit?.fileUrl,
      uploadedBy: compliance.paymentAsDeposit?.uploadedBy,
      uploadedAt: compliance.paymentAsDeposit?.uploadedAt,
      completed: compliance.paymentAsDeposit?.completed,
    },
    {
      key: "irrevocablePo",
      name: "Irrevocable PO/MO",
      status: acceptedItems.has("irrevocablePo") ? "accepted" : declinedItems.has("irrevocablePo") ? "declined" : (compliance.irrevocablePo?.status === "accepted" || compliance.irrevocablePo?.status === "completed") ? "accepted" : compliance.irrevocablePo?.status === "declined" ? "declined" : compliance.irrevocablePo?.fileUrl ? "uploaded" : "uploaded",
      file: compliance.irrevocablePo?.fileName,
      fileUrl: compliance.irrevocablePo?.fileUrl,
      uploadedBy: compliance.irrevocablePo?.uploadedBy,
      uploadedAt: compliance.irrevocablePo?.uploadedAt,
      completed: compliance.irrevocablePo?.completed,
    },
    {
      key: "finalArtwork",
      name: "Final Artwork",
      status: acceptedItems.has("finalArtwork") ? "accepted" : declinedItems.has("finalArtwork") ? "declined" : (compliance.finalArtwork?.status === "accepted" || compliance.finalArtwork?.status === "completed") ? "accepted" : compliance.finalArtwork?.status === "declined" ? "declined" : compliance.finalArtwork?.fileUrl ? "uploaded" : "uploaded",
      file: compliance.finalArtwork?.fileName,
      fileUrl: compliance.finalArtwork?.fileUrl,
      uploadedBy: compliance.finalArtwork?.uploadedBy,
      uploadedAt: compliance.finalArtwork?.uploadedAt,
      completed: compliance.finalArtwork?.completed,
    },
    {
      key: "signedQuotation",
      name: "Signed Quotation",
      status: acceptedItems.has("signedQuotation") ? "accepted" : declinedItems.has("signedQuotation") ? "declined" : (compliance.signedQuotation?.status === "accepted" || compliance.signedQuotation?.status === "completed") ? "accepted" : compliance.signedQuotation?.status === "declined" ? "declined" : compliance.signedQuotation?.fileUrl ? "uploaded" : "uploaded",
      file: compliance.signedQuotation?.fileName,
      fileUrl: compliance.signedQuotation?.fileUrl,
      uploadedBy: compliance.signedQuotation?.uploadedBy,
      uploadedAt: compliance.signedQuotation?.uploadedAt,
      completed: compliance.signedQuotation?.completed,
    },
  ]

  const complianceData = getProjectCompliance(quotation)
  const completed = complianceData.completed
  const total = complianceData.total

  const handleFileUpload = (complianceType: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".pdf"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file && quotation?.id) {
        onFileUpload(quotation.id, complianceType, file)
      }
    }
    input.click()
  }

  const getStatusIcon = (status: string) => {
    if (status === "completed") {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
  }

  const handleViewFile = (fileUrl: string, itemKey: string) => {
    setSelectedFileUrl(fileUrl)
    setSelectedItemKey(itemKey)
    setFileViewerOpen(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] p-0 bg-white rounded-[20px]">
        <DialogHeader className="flex flex-row items-center justify-between p-4 pb-3">
          <DialogTitle className="text-[20px] font-bold text-[#333333]">
            Compliance <span className="font-light">({completed}/{total})</span>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 text-[#333333] hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="px-4 pb-3">
          <p className="text-[12px] text-[#a1a1a1] italic">
            *Upload/approve at least (1) of 5 documents to "Reserve"
          </p>
        </div>

        <div className="px-4">
          {/* Header */}
          <div className="grid grid-cols-[120px_1fr_80px] gap-2 mb-2">
            <div className="text-[12px] font-bold text-[#333333]">Document</div>
            <div className="text-[12px] font-bold text-[#333333] text-center">File</div>
            <div className="text-[12px] font-bold text-[#333333] text-center">Action</div>
          </div>

          {/* Separator line */}
          <div className="h-px bg-gray-300 mb-3" />

          {/* Compliance Items */}
          <div className="mb-4">
            {toReserveItems.map((item, index) => (
              <div key={item.key} className="mb-2">
                <div className="grid grid-cols-[120px_1fr_80px] gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#333333]">{item.name}</span>
                  </div>
                  <div className="text-center">
                    {item.file ? (
                      <span
                        className="text-[12px] text-[#2d3fff] cursor-pointer flex items-center justify-center gap-1"
                        onClick={() => item.fileUrl && handleViewFile(item.fileUrl, item.key)}
                      >
                        {item.file}
                        <img src={item.status === "accepted" ? "/approve_sign.png" : "/exclamation_sign.png"} alt={item.status === "accepted" ? "approved" : "warning"} className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#333333]">-</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {viewOnly ? (
                      item.fileUrl ? (
                        <Button
                          onClick={() => handleViewFile(item.fileUrl!, item.key)}
                          className="bg-white border-2 border-[#c4c4c4] text-[#333333] hover:bg-gray-50 rounded-[6px] h-[24px] px-2 text-[10px]"
                          variant="outline"
                        >
                          View
                        </Button>
                      ) : (
                        <span className="text-[12px] text-[#333333]">-</span>
                      )
                    ) : (
                      <Button
                        onClick={() => handleFileUpload(item.key)}
                        disabled={uploadingFiles.has(`${quotation?.id}-${item.key}`)}
                        className="bg-white border-2 border-[#c4c4c4] text-[#333333] hover:bg-gray-50 rounded-[6px] h-[24px] px-2 text-[10px]"
                        variant="outline"
                      >
                        {uploadingFiles.has(`${quotation?.id}-${item.key}`) ? (
                          "Uploading..."
                        ) : (
                          <>
                            <Upload className="w-3 h-3 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {item.note && (
                  <p className="text-[10px] text-[#a1a1a1] mt-1 ml-6">{item.note}</p>
                )}
                {/* Separator line */}
                {index < toReserveItems.length - 1 && <div className="h-px bg-gray-300 mt-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Mark as Reserved Button */}
        {!viewOnly && (
          <div className="flex justify-end pb-4 pr-4">
            <Button
              disabled={quotation?.status === "reserved"}
              onClick={() => {
                if (onMarkAsReserved) {
                  onMarkAsReserved(quotation)
                }
              }}
              className="bg-[#48b02c] hover:bg-[#3d8f24] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-[12px] rounded-[6px] h-[28px] px-4"
            >
              Mark as Reserved
            </Button>
          </div>
        )}
      </DialogContent>

      {/* File Viewer Dialog */}
      <Dialog open={fileViewerOpen} onOpenChange={setFileViewerOpen}>
        <DialogContent className="w-[95vw] max-w-6xl h-[95vh] p-0 flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between p-4 pb-0 shrink-0">
            <DialogTitle>File Viewer</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFileViewerOpen(false)}
              className="h-6 w-6 text-[#333333] hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          {/* PDF Viewer */}
          <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
            <PDFViewer
              fileUrl={selectedFileUrl}
              className="w-full h-full rounded-lg border"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-between items-center p-4 pt-0 shrink-0 gap-4 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              {(() => {
                const compliance = quotation?.projectCompliance?.[selectedItemKey]
                return (
                  <>
                    <p className="mb-0">
                      <span className="font-bold">Sent from:</span> {compliance?.sent_from || "OH! Plus"}
                    </p>
                    {compliance?.sent_by && (
                      <p className="mb-0">
                        <span className="font-bold">Sent by:</span> {compliance.sent_by}
                      </p>
                    )}
                  </>
                )
              })()}
              {(() => {
                const compliance = quotation?.projectCompliance?.[selectedItemKey]
                const uploadedAt = compliance?.uploadedAt
                if (uploadedAt) {
                  let date: Date
                  try {
                    if (uploadedAt && typeof uploadedAt.toDate === 'function') {
                      date = uploadedAt.toDate()
                    } else if (uploadedAt instanceof Date) {
                      date = uploadedAt
                    } else if (typeof uploadedAt === 'string' || typeof uploadedAt === 'number') {
                      date = new Date(uploadedAt)
                    } else {
                      throw new Error('Invalid date format')
                    }
                    // Validate the date
                    if (isNaN(date.getTime())) {
                      throw new Error('Invalid date')
                    }
                    return (
                      <>
                        <p className="mb-0">
                          <span className="font-bold">Date:</span> {format(date, "MMM d, yyyy")}
                        </p>
                        <p className="mb-0">
                          <span className="font-bold">Time:</span> {date.toLocaleTimeString()} GMT
                        </p>
                      </>
                    )
                  } catch (error) {
                    console.error('Error formatting date:', error, uploadedAt)
                    return (
                      <>
                        <p className="mb-0">
                          <span className="font-bold">Date:</span> Invalid Date
                        </p>
                        <p className="mb-0">
                          <span className="font-bold">Time:</span> Invalid Time
                        </p>
                      </>
                    )
                  }
                }
                return (
                  <>
                    <p className="mb-0">
                      <span className="font-bold">Date:</span> N/A
                    </p>
                    <p className="mb-0">
                      <span className="font-bold">Time:</span> N/A
                    </p>
                  </>
                )
              })()}
            </div>
            {!viewOnly && (() => {
              const currentItem = toReserveItems.find(item => item.key === selectedItemKey)
              return currentItem?.status !== "accepted" ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setDeclinedItems(prev => new Set(prev).add(selectedItemKey))
                      setAcceptedItems(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(selectedItemKey)
                        return newSet
                      })
                      onDecline(quotation.id, selectedItemKey)
                      setFileViewerOpen(false)
                    }}
                    className="bg-white border border-[#c4c4c4] text-black rounded-[10px] h-10 sm:h-[47px] font-medium text-sm sm:text-[20px] px-3 sm:px-6 hover:bg-gray-50"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={() => {
                      setAcceptedItems(prev => new Set(prev).add(selectedItemKey))
                      setDeclinedItems(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(selectedItemKey)
                        return newSet
                      })
                      onAccept(quotation.id, selectedItemKey)
                      setFileViewerOpen(false)
                    }}
                    className="bg-[#1d0beb] hover:bg-[#1d0beb]/90 text-white rounded-[10px] h-10 sm:h-[47px] font-semibold text-sm sm:text-[20px] px-3 sm:px-6"
                  >
                    Accept
                  </Button>
                </div>
              ) : null
            })()}
          </div>
        </DialogContent>
      </Dialog>

      
    </Dialog>
  )
}