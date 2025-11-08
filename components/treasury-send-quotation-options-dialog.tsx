"use client"

import { Input } from "@/components/ui/input"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Copy, Mail, MessageCircle, Phone, Facebook } from "lucide-react"
import Image from "next/image"
import type { Quotation } from "@/lib/quotation-service"

interface TreasurySendQuotationOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  quotation: Quotation | null
  onEmailClick: () => void
}

export function TreasurySendQuotationOptionsDialog({
  isOpen,
  onClose,
  quotation,
  onEmailClick,
}: TreasurySendQuotationOptionsDialogProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const publicViewUrl = quotation?.id ? `https://ohplus.aix.ph/treasury/quotations/view/${quotation.id}` : ""

  const handleCopyLink = () => {
    if (publicViewUrl) {
      navigator.clipboard.writeText(publicViewUrl)
      setCopied(true)
      toast({
        title: "Link Copied!",
        description: "The public view link has been copied to your clipboard.",
      })
    } else {
      toast({
        title: "Error",
        description: "Treasury quotation link is not available.",
        variant: "destructive",
      })
    }
  }

  const handleSocialShare = (platform: string) => {
    toast({
      title: "Not Implemented",
      description: `Sharing via ${platform} is not yet implemented.`,
      variant: "destructive",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold">Send Treasury Quotation</DialogTitle>
          <DialogDescription className="sr-only">Choose how to send this treasury quotation.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {quotation && (
            <div className="flex items-center gap-4 mb-2">
              <div className="relative w-20 h-20 flex-shrink-0">
                <Image
                  src={quotation.image_url || "/placeholder.svg?height=80&width=80&text=Treasury+Quote"}
                  alt="Treasury Quotation Image"
                  width={80}
                  height={80}
                  className="rounded-md object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold">
                  {quotation.quotation_number || "Untitled Treasury Quotation"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {quotation.title || quotation.product_name}
                </span>
              </div>
            </div>
          )}

          {/* Changed to Input component for the link */}
          <div className="flex items-center space-x-2">
            <Input value={publicViewUrl || "Link not available"} readOnly className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex-shrink-0 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Copy className="mr-1 h-3 w-3" />
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={onEmailClick}>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
              >
                <Mail className="h-5 w-5" />
              </Button>
              <span className="text-xs text-gray-700 dark:text-gray-300">Email</span>
            </div>
            <div
              className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={() => handleSocialShare("WhatsApp")}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              <span className="text-xs text-gray-700 dark:text-gray-300">Whatsapp</span>
            </div>
            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleSocialShare("Viber")}>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"
              >
                <Phone className="h-5 w-5" />
              </Button>
              <span className="text-xs text-gray-700 dark:text-gray-300">Viber</span>
            </div>
            <div
              className="flex flex-col items-center gap-1 cursor-pointer"
              onClick={() => handleSocialShare("Messenger")}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
              >
                <Facebook className="h-5 w-5" />
              </Button>
              <span className="text-xs text-gray-700 dark:text-gray-300">Messenger</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
