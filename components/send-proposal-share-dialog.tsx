"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import type { Proposal } from "@/lib/types/proposal"
import { generateProposalPDFBlob } from "@/lib/proposal-service"

// IndexedDB utility for storing large PDF blobs
const openPDFDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProposalPDFs', 1)

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

const storePDFInIndexedDB = async (key: string, pdfData: { blob: Blob; filename: string; timestamp: number }): Promise<void> => {
  const db = await openPDFDB()
  const transaction = db.transaction(['pdfs'], 'readwrite')
  const store = transaction.objectStore('pdfs')
  await new Promise<void>((resolve, reject) => {
    const request = store.put(pdfData, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

const getPDFFromIndexedDB = async (key: string): Promise<{ blob: Blob; filename: string; timestamp: number } | null> => {
  const db = await openPDFDB()
  const transaction = db.transaction(['pdfs'], 'readonly')
  const store = transaction.objectStore('pdfs')
  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => {
      resolve(request.result || null)
    }
    request.onerror = () => reject(request.error)
  })
}

const deletePDFFromIndexedDB = async (key: string): Promise<void> => {
  const db = await openPDFDB()
  const transaction = db.transaction(['pdfs'], 'readwrite')
  const store = transaction.objectStore('pdfs')
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}
interface SendProposalShareDialogProps {
  isOpen: boolean
  onClose: () => void
  proposal: Proposal
  templateSettings?: {
    size: string
    orientation: string
    layout: string
    background: string
  }
}

export function SendProposalShareDialog({ isOpen, onClose, proposal, templateSettings }: SendProposalShareDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [proposalUrl] = useState(`https://mrk.ohplus.ph/pr/${proposal.id}`)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(proposalUrl)
      setCopied(true)
      toast({
        title: "Link copied!",
        description: "The proposal link has been copied to your clipboard.",
      })
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the link to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleEmailShare = async () => {
    setIsGeneratingPDF(true)

    try {
      // First ensure PDF is generated and saved to the document if not already done
      if (!proposal.pdf || proposal.pdf.trim() === "") {
        // Import the service functions here to avoid circular dependencies
        const { generateAndUploadProposalPDF } = await import('@/lib/proposal-service')
        const { updateProposal } = await import('@/lib/proposal-service')

        const { pdfUrl, password } = await generateAndUploadProposalPDF(
          proposal,
          templateSettings?.size || 'A4',
          templateSettings?.orientation || 'Portrait'
        )

        // Update proposal with PDF URL and password
        console.log("Updating proposal with PDF URL:", pdfUrl, "and password:", password)
        await updateProposal(
          proposal.id,
          { pdf: pdfUrl, password: password },
          "system",
          "System"
        )

        console.log("PDF generated and uploaded successfully:", pdfUrl)
        console.log("Proposal document updated with PDF URL and password")
      }

      // Generate PDF blob with current template settings (same as download)
      const { blob, filename } = await generateProposalPDFBlob(
        proposal,
        templateSettings?.size || 'A4',
        templateSettings?.orientation || 'Portrait'
      )

      // Store PDF blob in IndexedDB with unique key
      const storageKey = `proposal_pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const pdfData = {
        blob,
        filename,
        timestamp: Date.now()
      }

      await storePDFInIndexedDB(storageKey, pdfData)

      // Close dialog and navigate with localStorage key
      onClose()
      const composeUrl = `/sales/proposals/compose/${proposal.id}?pdfKey=${storageKey}`
      router.push(composeUrl)

    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`Please review our proposal: ${proposalUrl}`)
    window.open(`https://wa.me/?text=${message}`)
  }

  const handleViberShare = () => {
    const message = encodeURIComponent(`Please review our proposal: ${proposalUrl}`)
    window.open(`viber://forward?text=${message}`)
  }

  const handleMessengerShare = () => {
    const message = encodeURIComponent(`Please review our proposal: ${proposalUrl}`)
    window.open(`https://m.me/?text=${message}`)
  }
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0">
        <DialogTitle className="sr-only">Send Proposal</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Send Proposal To</h2>
        </div>

        {/* Proposal Preview */}
        <div className="px-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              {proposal.products &&
              proposal.products.length > 0 &&
              proposal.products[0].media &&
              proposal.products[0].media.length > 0 ? (
                <img
                  src={proposal.products[0].media[0].url || "/placeholder.svg"}
                  alt={proposal.products[0].name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-white text-xs font-bold">{proposal.proposalNumber || "PROP"}</div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-400 mb-1">{proposal.client?.company || "Client"}</div>
              <div className="text-sm font-semibold text-gray-900">
                {proposal.products && proposal.products.length > 0
                  ? `${proposal.products[0].name} (${proposal.products.length} Site${proposal.products.length !== 1 ? "s" : ""})`
                  : proposal.title}
              </div>
            </div>
          </div>
        </div>

        {/* URL Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
            <Input
              value={proposalUrl}
              readOnly
              className="flex-1 bg-transparent border-none text-sm text-gray-600 p-0 focus-visible:ring-0"
            />
            <Button
              onClick={handleCopyLink}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
            >
              {copied ? "Copied!" : "Copy Link"}
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
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                ) : (
                  <Image src="/icons/email.png" alt="Email" width={74} height={74} />
                )}
              </div>
              <span className="text-xs font-medium text-gray-700">
                {isGeneratingPDF ? 'Generating...' : 'Email'}
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
              <div className="w-12 h-12  rounded-full flex items-center justify-center">
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
