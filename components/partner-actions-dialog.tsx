"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Phone, Mail, Globe } from "lucide-react"

interface Partner {
  id: string
  name: string
  logo: string
  lastActivity: string
}

interface PartnerActionsDialogProps {
  isOpen: boolean
  onClose: () => void
  partner: Partner | null
  onActionClick: () => void // Added callback to trigger under construction dialog
}

export function PartnerActionsDialog({ isOpen, onClose, partner, onActionClick }: PartnerActionsDialogProps) {
  if (!partner) return null

  const handleCall = () => {
    console.log(`Calling ${partner.name}`)
    onClose()
    setTimeout(() => {
      onActionClick()
    }, 100)
  }

  const handleEmail = () => {
    console.log(`Emailing ${partner.name}`)
    onClose()
    setTimeout(() => {
      onActionClick()
    }, 100)
  }

  const handleVisitWebsite = () => {
    console.log(`Visiting ${partner.name} website`)
    onClose()
    setTimeout(() => {
      onActionClick()
    }, 100)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[280px] p-0 gap-0">
        <div className="p-6">
          <div className="space-y-3">
            <Button
              onClick={handleCall}
              className="w-full bg-green-500 hover:bg-green-600 text-white rounded-full py-3 h-auto"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>

            <Button
              onClick={handleEmail}
              variant="secondary"
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full py-3 h-auto"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>

            <Button
              onClick={handleVisitWebsite}
              variant="secondary"
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full py-3 h-auto"
            >
              <Globe className="h-4 w-4 mr-2" />
              Visit Website
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
