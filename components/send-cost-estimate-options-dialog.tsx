"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Copy } from "lucide-react"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import Image from "next/image"

interface SendCostEstimateOptionsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  costEstimate: CostEstimate
  onEmailClick: () => void
  companyData?: {
    photo_url?: string
    name?: string
  } | null
}

export function SendCostEstimateOptionsDialog({
  isOpen,
  onOpenChange,
  costEstimate,
  onEmailClick,
  companyData,
}: SendCostEstimateOptionsDialogProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const publicViewUrl = `https://mrk.ohplus.ph/ce/${costEstimate.id}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicViewUrl)
    setCopied(true)
    toast({
      title: "Link Copied!",
      description: "The public view link has been copied to your clipboard.",
    })
  }

  const handleNotImplemented = (platform: string) => {
    toast({
      title: "Feature Not Implemented",
      description: `Sending via ${platform} is not yet available.`,
      variant: "destructive",
    })
  }
  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(`Please review our proposal: ${publicViewUrl}`)
    window.open(`https://wa.me/?text=${message}`)
  }

  const handleViberShare = () => {
    const message = encodeURIComponent(`Please review our proposal: ${publicViewUrl}`)
    window.open(`viber://forward?text=${message}`)
  }

  const handleMessengerShare = () => {
    const message = encodeURIComponent(`Please review our proposal: ${publicViewUrl}`)
    window.open(`https://m.me/?text=${message}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTitle></DialogTitle>
      <DialogContent className="sm:max-w-[400px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Send Cost Estimate To</h2>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={
                  costEstimate?.lineItems[0].image || "/placeholder.svg?height=80&width=80&query=company logo"
                }
                alt="Cost Estimate thumbnail"
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="flex-1">
              <div className="text-md font-semibold">{costEstimate.costEstimateNumber}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{costEstimate.title || "Untitled Cost Estimate"}</div>
            </div>
          </div>
        </div>
        {/* URL Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
            <Input
              value={publicViewUrl}
              readOnly
              className="flex-1 bg-transparent border-none text-sm text-gray-600 p-0 focus-visible:ring-0" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyLink}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
            >
              <Copy className="mr-1 h-3 w-3" />
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
        {/* Share button section */}
        <div className="px-6 pb-6">
          <div className="grid  grid-cols-4 gap-4">
            <button
              onClick={onEmailClick}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <Image src="/icons/email.png" alt="Email" width={74} height={74} />
              </div>
              <span className="text-xs font-medium text-gray-700">Email</span>
            </button>
            <button
              onClick={() => handleWhatsAppShare()}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <Image src="/icons/whatsapp.png" alt="Whatsapp" width={74} height={74} />
              </div>
              <span className="text-xs font-medium text-gray-700">Whatsapp</span>
            </button>
            <button
              onClick={() => handleViberShare()}
              className="flex flex-col items-center space-y-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center">
                <Image src="/icons/viber.png" alt="Viber" width={74} height={74} />
              </div>
              <span className="text-xs font-medium text-gray-700">Viber</span>
            </button>
            <button

              onClick={() => handleMessengerShare()}
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
