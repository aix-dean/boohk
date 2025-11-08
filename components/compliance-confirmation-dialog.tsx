"use client"

import { useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, FileText, X, Upload } from "lucide-react"

interface ComplianceConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onSkip: () => void
  onProceed?: () => void
  complianceItems: ComplianceItem[];
  onFileUpload?: (complianceType: string, file: File) => void
  uploadingFiles?: Set<string>
  quotationId?: string
  onItemUpdate?: (index: number, updates: Partial<ComplianceItem>) => void
}

interface ComplianceItem {
  name: string;
  completed: boolean;
  type: "upload" | "confirmation";
  key?: string;
  file?: string;
  fileUrl?: string;
}

export function ComplianceConfirmationDialog({
  isOpen,
  onClose,
  onSkip,
  complianceItems,
  onFileUpload,
  uploadingFiles = new Set(),
  quotationId,
  onItemUpdate,
}: ComplianceConfirmationDialogProps) {
  // Auto-proceed when all items are completed
  useEffect(() => {
    if (isOpen && complianceItems.length > 0) {
      const allCompleted = complianceItems.every(item => item.completed || item.file)
      if (allCompleted) {
        // Auto-proceed after a brief delay to show completion
        const timer = setTimeout(() => {
          onSkip()
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [isOpen, complianceItems, onSkip])
  const handleFileUpload = (complianceType: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".pdf"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file && onFileUpload) {
        onFileUpload(complianceType, file)
      }
    }
    input.click()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-5 rounded-lg">
        {/* Header */}
        <DialogHeader className="pb-2">
          <div className="flex justify-between items-start">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Project Compliance
            </DialogTitle>
            <Button
              variant="ghost"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-400" />
            </Button>
          </div>
          <DialogDescription className="text-gray-600 text-sm mt-1">
            This client has some missing project compliance requirements:
          </DialogDescription>
        </DialogHeader>

        {/* Items */}
        <div className="space-y-4 py-4">
          {complianceItems.filter(item => !item.completed && !item.file).map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center">
                {/* Custom circle instead of radio */}
                <span
                  className={`h-4 w-4 rounded-full border mr-2 ${item.completed ? "border-blue-600 bg-blue-600" : "border-gray-400"
                    }`}
                />
                <label className="text-sm text-gray-800">{item.name}</label>
              </div>

              {item.type === "upload" && item.file && (
                <div className="flex items-center text-green-600 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {item.file}
                </div>
              )}

              {item.type === "upload" && !item.file && (
                <Button
                  onClick={() => handleFileUpload(item.key || item.name.toLowerCase().replace(/\s+/g, ''))}
                  disabled={uploadingFiles.has(`${quotationId}-${item.key || item.name.toLowerCase().replace(/\s+/g, '')}`)}
                  variant="outline"
                  size="sm"
                  className="text-gray-700 border-gray-300 bg-white hover:bg-gray-50 px-3 py-1 text-xs rounded-md"
                >
                  {uploadingFiles.has(`${quotationId}-${item.key || item.name.toLowerCase().replace(/\s+/g, '')}`) ? (
                    "Uploading..."
                  ) : (
                    <>
                      <Upload className="w-3 h-3 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
              )}

              {item.type === "confirmation" && (
                <span className="text-gray-500 text-xs italic ml-2">
                  For Treasury's confirmation
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3">
          <Button
            onClick={onSkip}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm rounded-md"
          >
            Acknowledge and Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
