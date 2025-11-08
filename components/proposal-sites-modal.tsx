"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Copy } from "lucide-react"
import { format } from "date-fns"
import type { Proposal, ProposalClient } from "@/lib/types/proposal"
import type { Product } from "@/lib/firebase-service"
import { toast } from "sonner"
import { ProposalPagesViewerDialog } from "./proposal-pages-viewer-dialog"

interface ProposalSitesModalProps {
  proposal: Proposal | null
  isOpen: boolean
  onClose: () => void
  onCopySites?: (sites: Product[], client?: any) => void
  useProposalViewer?: boolean
}

export function ProposalSitesModal({
  proposal,
  isOpen,
  onClose,
  onCopySites,
  useProposalViewer = false,
}: ProposalSitesModalProps) {
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  if (!proposal) return null

  if (useProposalViewer) {
    return <ProposalPagesViewerDialog proposal={proposal} isOpen={isOpen} onClose={onClose} />
  }

  const handleSiteToggle = (siteId: string) => {
    setSelectedSites((prev) => (prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]))
  }

  const handleSelectAll = () => {
    if (selectedSites.length === proposal.products.length) {
      setSelectedSites([])
    } else {
      setSelectedSites(proposal.products.map((product) => product.id))
    }
  }

  const handleCopySites = async () => {
    if (selectedSites.length === 0) {
      toast.error("Please select at least one site to copy")
      return
    }

    const selectedProducts = proposal.products.filter((product) => selectedSites.includes(product.id))

    if (onCopySites) {
      const dashboardProducts: Product[] = selectedProducts.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description || "",
        type: product.type || "rental",
        price: product.price || 0,
        media: (product.media || []).map(mediaItem => ({
          url: mediaItem.url,
          distance: mediaItem.distance || "",
          type: mediaItem.type || "",
          isVideo: mediaItem.isVideo,
        })),
        specs_rental: product.specs_rental || null,
        light: product.light || null,
        site_code: product.site_code || "",
        created: product.created || new Date(),
        updated: product.updated || new Date(),
        uploaded_by: product.uploaded_by || "",
        company_id: product.company_id || "",
        active: product.active !== undefined ? product.active : true,
        deleted: product.deleted !== undefined ? product.deleted : false,
        seller_id: product.seller_id || "",
        seller_name: product.seller_name || "",
        categories: product.categories || [],
        category_names: product.category_names || [],
        content_type: product.content_type || "",
        cms: product.cms || null,
        status: product.status || "",
        health_percentage: product.health_percentage || 0,
        location: product.location || "",
        address: product.address || "",
        position: product.position || 0,
      }))

      onCopySites(dashboardProducts, proposal.client)
      handleClose()
      return
    }

    const siteData = selectedProducts.map((product) => ({
      id: product.id,
      name: product.name,
      location: product.location,
      site_code: product.site_code,
      type: product.type,
      price: product.price,
    }))

    try {
      await navigator.clipboard.writeText(JSON.stringify(siteData, null, 2))
      setCopied(true)
      toast.success(`${selectedSites.length} sites copied to clipboard`)

      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy sites:", error)
      toast.error("Failed to copy sites")
    }
  }

  const handleClose = () => {
    setSelectedSites([])
    setCopied(false)
    onClose()
  }

  const handleCopySitesFromProposal = (sites: Product[]) => {
    if (onCopySites) {
      onCopySites(sites, proposal.client);
      toast.success(`${sites.length} sites copied from proposal history.`);
    }
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-xl font-semibold">{proposal.proposalNumber || proposal.title}</DialogTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-sm">
            <div>
              <div className="font-medium text-gray-700 mb-2">Prepared for:</div>
              <div className="space-y-1 text-gray-600">
                <div className="font-medium">{proposal.client?.contactPerson || "N/A"}</div>
                <div>{proposal.client?.designation || "N/A"}</div>
                <div>{proposal.client?.company || "N/A"}</div>
                <div>{proposal.client?.address || "N/A"}</div>
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-700 mb-2">Date Sent:</div>
              <div className="text-gray-600">{format(proposal.createdAt, "MMMM d, yyyy")}</div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Sites ({proposal.products.length})</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="text-blue-600 border-blue-600 hover:bg-blue-50 bg-transparent"
          >
            {selectedSites.length === proposal.products.length ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
            {proposal.products.map((product) => (
              <div
                key={product.id}
                className={`relative border rounded-lg p-3 cursor-pointer transition-all w-48 flex-shrink-0 ${
                  selectedSites.includes(product.id)
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => handleSiteToggle(product.id)}
              >
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={selectedSites.includes(product.id)}
                    onChange={() => handleSiteToggle(product.id)}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                </div>

                <div className="aspect-video bg-gray-100 rounded-md mb-3 overflow-hidden">
                  {product.media && product.media.length > 0 ? (
                    <img
                      src={product.media[0].url || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-xs">No Image</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-500 font-medium">{product.site_code || product.id}</div>
                  <div className="font-medium text-sm line-clamp-2">{product.name}</div>
                  {product.specs_rental?.audience_type === "vacant" && (
                    <Badge className="text-xs bg-blue-600 text-white">VACANT</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            {selectedSites.length} of {proposal.products.length} sites selected
          </div>
          <Button
            onClick={handleCopySites}
            disabled={selectedSites.length === 0}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Sites
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
