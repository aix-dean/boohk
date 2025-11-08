"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import type { ReportData } from "@/lib/report-service"
import { getProductById } from "@/lib/firebase-service"
import { generateReportPDF } from "@/lib/report-pdf-service"

// IndexedDB utility for storing PDF blobs
const openPDFDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ReportPDFs', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs')
      }
    }
  })
}

const storePDFFromIndexedDB = async (key: string, blob: Blob, filename: string): Promise<void> => {
  const db = await openPDFDB()
  const transaction = db.transaction(['pdfs'], 'readwrite')
  const store = transaction.objectStore('pdfs')
  const data = {
    blob,
    filename,
    timestamp: Date.now()
  }
  await new Promise<void>((resolve, reject) => {
    const request = store.put(data, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

interface SendReportDialogProps {
  isOpen: boolean
  onClose: () => void
  report: ReportData
  onSelectOption: (option: "email" | "whatsapp" | "viber" | "messenger") => void
  companyLogo?: string
}

export function SendReportDialog({ isOpen, onClose, report, onSelectOption, companyLogo }: SendReportDialogProps) {
    const { toast } = useToast()
    const router = useRouter()
    const pathname = usePathname()
    const [reportUrl, setReportUrl] = useState<string>("")
    const [productImageUrl, setProductImageUrl] = useState<string>("")
    const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false)
    const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false)

    useEffect(() => {
      if (isOpen && report?.id) {
        setReportUrl(`${window.location.origin}/public/reports/${report.id}`)
      }
    }, [isOpen, report?.id])

   useEffect(() => {
      const fetchProductImage = async () => {
        if (!isOpen || !report?.product?.id) {
          setProductImageUrl("")
          setIsLoadingImage(false)
          return
        }

        setIsLoadingImage(true)
        try {
          const product = await getProductById(report.product.id)
          if (product?.media && product.media.length > 0) {
            // Use the first media item that has a URL
            const firstMedia = product.media.find((media: any) => media.url)
            setProductImageUrl(firstMedia?.url || "")
          } else {
            setProductImageUrl("")
          }
        } catch (error) {
          console.error("Error fetching product image:", error)
          setProductImageUrl("")
        } finally {
          setIsLoadingImage(false)
        }
      }

      fetchProductImage()
    }, [isOpen, report?.product?.id])

    useEffect(() => {
      if (isOpen && report?.id) {
        setReportUrl(`${window.location.origin}/public/reports/${report.id}`)
      }
    }, [isOpen, report?.id])


   const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(reportUrl)
      toast({
        title: "Link copied!",
        description: "The report link has been copied to your clipboard.",
      })
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the link to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleEmailShare = () => {
    // Close dialog and navigate to compose page
    onClose()
    const queryParams = report?.client_email
      ? `?to=${encodeURIComponent(report.client_email)}`
      : ''
    router.push(`/sales/reports/compose/${report?.id}${queryParams}`)
  }

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`Please review this report: ${reportUrl}`)
    window.open(`https://wa.me/?text=${message}`)
  }

  const handleViberShare = () => {
    const message = encodeURIComponent(`Please review this report: ${reportUrl}`)
    window.open(`viber://forward?text=${message}`)
  }

  const handleMessengerShare = () => {
    const message = encodeURIComponent(`Please review this report: ${reportUrl}`)
    window.open(`https://m.me/?text=${message}`)
  }

  // Generate report filename
  const getReportTypeDisplay = (type: string) => {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const reportFileName = report?.siteName ? `${report.siteName.replace(/\s+/g, "_")}.pdf` : "report.pdf"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-gray-900">Send Report To</DialogTitle>
        </div>

        {/* Report Preview */}
        <div className="px-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              {isOpen && (productImageUrl ? (
                <img
                  src={productImageUrl || "/placeholder.svg"}
                  alt="Product image"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error("Product image failed to load:", productImageUrl)
                    setProductImageUrl("")
                  }}
                />
              ) : !isLoadingImage ? (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-white text-xs font-bold">REPORT</div>
                </div>
              ) : null)}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-400 mb-1">{report?.id?.slice(0, 8) || "N/A"}...</div>
              <div className="text-sm font-medium text-gray-500 break-words max-w-full">{reportFileName}</div>
            </div>
          </div>
        </div>

        {/* URL Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
            <Input
              value={reportUrl}
              readOnly
              className="flex-1 bg-transparent border-none text-sm text-gray-600 p-0 focus-visible:ring-0"
            />
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
            >
              COPY LINK
            </Button>
          </div>
        </div>

        {/* Sharing Options */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-4 gap-4">
            <button
              onClick={handleEmailShare}
              disabled={isGeneratingPDF}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                {isGeneratingPDF ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                ) : (
                  <Image src="/icons/email.png" alt="Email" width={74} height={74} />
                )}
              </div>
              <span className="text-xs font-medium text-gray-700">
                {isGeneratingPDF ? "Generating..." : "Email"}
              </span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <Image src="/icons/whatsapp.png" alt="WhatsApp" width={74} height={74} />
              </div>
              <span className="text-xs font-medium text-gray-700">Whatsapp</span>
            </button>

            <button
              onClick={handleViberShare}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <Image src="/icons/viber.png" alt="Viber" width={74} height={74} />
              </div>
              <span className="text-xs font-medium text-gray-700">Viber</span>
            </button>

            <button
              onClick={handleMessengerShare}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <Image src="/icons/messenger.png" alt="Messenger" width={74} height={74} />
              </div>
              <span className="text-xs font-medium text-gray-700">Messenger</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
