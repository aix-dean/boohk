"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Search, X, MoreVertical } from "lucide-react"
import Image from "next/image"
import { PartnerActionsDialog } from "./partner-actions-dialog"
import { UnderConstructionDialog } from "./under-construction-dialog" // Added import for under construction dialog

interface Partner {
  id: string
  name: string
  logo: string
  lastActivity: string
}

const operators: Partner[] = [
  { id: "op1", name: "Summit Media", logo: "/summit-media-logo.png", lastActivity: "May 28, 2025" },
  { id: "op2", name: "HDI Admix", logo: "/hdi-admix-logo.png", lastActivity: "May 20, 2025" },
  { id: "op3", name: "DOOH", logo: "/dooh-logo.png", lastActivity: "May 28, 2025" },
  { id: "op4", name: "Globaltronics", logo: "/globaltronics-logo.png", lastActivity: "May 28, 2025" },
]

const dsps: Partner[] = [
  { id: "dsp1", name: "OOH!Shop", logo: "/ooh-shop-logo.png", lastActivity: "May 28, 2025" },
  { id: "dsp2", name: "Vistar Media", logo: "/vistar-media-logo.png", lastActivity: "May 28, 2025" },
  { id: "dsp3", name: "Broadsign", logo: "/broadsign-logo.png", lastActivity: "May 28, 2025" },
  { id: "dsp4", name: "Moving Walls", logo: "/moving-walls-logo.png", lastActivity: "May 28, 2025" },
]

interface CollabPartnerDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CollabPartnerDialog({ isOpen, onClose }: CollabPartnerDialogProps) {
  const [operatorSearch, setOperatorSearch] = useState("")
  const [dspSearch, setDspSearch] = useState("")
  const [isPartnerActionsDialogOpen, setIsPartnerActionsDialogOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [isUnderConstructionDialogOpen, setIsUnderConstructionDialogOpen] = useState(false) // Added state for under construction dialog

  const filteredOperators = operators.filter((partner) =>
    partner.name.toLowerCase().includes(operatorSearch.toLowerCase()),
  )

  const filteredDsps = dsps.filter((partner) => partner.name.toLowerCase().includes(dspSearch.toLowerCase()))

  const handlePartnerClick = (partner: Partner) => {
    setSelectedPartner(partner)
    onClose() // Close the partner selection dialog first
    setIsPartnerActionsDialogOpen(true)
  }

  const handleActionClick = () => {
    setIsUnderConstructionDialogOpen(true)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Choose a partner</DialogTitle>
            <DialogDescription>Select an operator or DSP to collaborate with.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Operators Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Operators</h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search operators..."
                  value={operatorSearch}
                  onChange={(e) => setOperatorSearch(e.target.value)}
                  className="pl-9 pr-8"
                />
                {operatorSearch && (
                  <X
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={() => setOperatorSearch("")}
                  />
                )}
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredOperators.length > 0 ? (
                  filteredOperators.map((partner) => (
                    <PartnerCard key={partner.id} partner={partner} onPartnerClick={handlePartnerClick} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No operators found.</p>
                )}
              </div>
            </div>

            {/* DSPs Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">DSPs</h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search DSPs..."
                  value={dspSearch}
                  onChange={(e) => setDspSearch(e.target.value)}
                  className="pl-9 pr-8"
                />
                {dspSearch && (
                  <X
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={() => setDspSearch("")}
                  />
                )}
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredDsps.length > 0 ? (
                  filteredDsps.map((partner) => (
                    <PartnerCard key={partner.id} partner={partner} onPartnerClick={handlePartnerClick} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No DSPs found.</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PartnerActionsDialog
        isOpen={isPartnerActionsDialogOpen}
        onClose={() => setIsPartnerActionsDialogOpen(false)}
        partner={selectedPartner}
        onActionClick={handleActionClick} // Added callback prop
      />

      <UnderConstructionDialog
        isOpen={isUnderConstructionDialogOpen}
        onClose={() => setIsUnderConstructionDialogOpen(false)}
      />
    </>
  )
}

function PartnerCard({
  partner,
  onPartnerClick,
}: {
  partner: Partner
  onPartnerClick: (partner: Partner) => void
}) {
  return (
    <Card
      className="flex items-center p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onPartnerClick(partner)}
    >
      <div className="relative w-12 h-12 flex-shrink-0 mr-4">
        <Image
          src={partner.logo || "/placeholder.svg"}
          alt={`${partner.name} logo`}
          fill
          className="rounded-lg object-contain p-1 bg-white"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/placeholder.svg"
            target.className = "opacity-50 object-contain"
          }}
        />
      </div>
      <div className="flex-grow">
        <h3 className="font-medium text-gray-900">{partner.name}</h3>
        <p className="text-xs text-gray-500">Last Activity: {partner.lastActivity}</p>
      </div>
      <MoreVertical className="h-5 w-5 text-gray-500 ml-4 flex-shrink-0" />
    </Card>
  )
}
