"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Copy, Mail, MessageCircle, Phone, Facebook } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Proposal } from "@/lib/types/proposal"
import Image from "next/image"

interface SendProposalOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  proposal: Proposal
  onSelectOption: (option: "email" | "whatsapp" | "viber" | "messenger") => void
}

export function SendProposalOptionsDialog({
  isOpen,
  onClose,
  proposal,
  onSelectOption,
}: SendProposalOptionsDialogProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const proposalViewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposals/view/${proposal.id}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(proposalViewUrl)
    setCopied(true)
    toast({
      title: "Link Copied!",
      description: "The proposal link has been copied to your clipboard.",
    })
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
          <DialogTitle className="text-2xl font-bold">Send Proposal</DialogTitle>
          <DialogDescription className="sr-only">Choose how you want to share this proposal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="relative w-20 h-20 flex-shrink-0">
              <Image
                src={
                  proposal.products[0]?.media?.[0]?.url || "/placeholder.svg?height=80&width=80&query=billboard image"
                }
                alt="Proposal thumbnail"
                width={80}
                height={80}
                className="rounded-md object-cover"
              />
            </div>
            <div className="flex flex-col">
              {/* Displaying proposalNumber as main title, title as secondary */}
              <span className="text-lg font-semibold">{proposal.proposalNumber}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{proposal.title}</span>
            </div>
          </div>

          {/* Link displayed in an Input component */}
          <div className="flex items-center space-x-2">
            <Input value={proposalViewUrl} readOnly className="flex-1" />
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
            <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onSelectOption("email")}>
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
