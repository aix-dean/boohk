"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton" // Import Skeleton
import {
  MoreVertical,
  FileText,
  Eye,
  Download,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Printer,
  Share,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { format } from "date-fns"
import { getPaginatedProposalsByUserId, getProposalsCountByUserId, downloadProposalPDF } from "@/lib/proposal-service"
import { searchProposals } from "@/lib/algolia-service"
import { createMultipleCostEstimates } from "@/lib/cost-estimate-service"
import type { Proposal } from "@/lib/types/proposal"
import { useResponsive } from "@/hooks/use-responsive"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { SentHistoryDialog } from "@/components/sent-history-dialog"
import { SendProposalShareDialog } from "@/components/send-proposal-share-dialog"

function ProposalsPageContent() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const itemsPerPage = 10
  const { user, userData } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isMobile } = useResponsive()
  const { toast } = useToast()
  const [isSearching, setIsSearching] = useState(false)
  const [showSentHistoryDialog, setShowSentHistoryDialog] = useState(false)
  const [selectedProposalForHistory, setSelectedProposalForHistory] = useState<Proposal | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [selectedProposalForShare, setSelectedProposalForShare] = useState<Proposal | null>(null)
  const [expandedProposals, setExpandedProposals] = useState<Set<string>>(new Set())

  let content;
  if (loading) {
    content = (
      <Card className="bg-white overflow-hidden rounded-t-lg">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200">
              <TableHead className="font-semibold text-gray-900 border-0">Date</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Proposal ID</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Company</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Contact Person</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Site</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-b border-gray-200">
                <TableCell className="py-3">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell className="py-3">
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell className="py-3">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell className="py-3">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell className="py-3">
                  <Skeleton className="h-5 w-24" />
                </TableCell>
                <TableCell className="text-right py-3">
                  <Skeleton className="h-8 w-8 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    )
  } else if (filteredProposals.length === 0) {
    content = (
      <Card className="bg-white rounded-xl">
        <CardContent className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm ? "No proposals found" : "No proposals yet"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm
              ? "Try adjusting your search criteria"
              : "Create your first proposal to get started"}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => router.push("/sales/proposals/create")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Proposal
            </Button>
          )}
        </CardContent>
      </Card>
    )
  } else {
    content = (
      <Card className="bg-white overflow-hidden rounded-t-lg">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-gray-200">
              <TableHead className="font-semibold text-gray-900 border-0">Date</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Proposal ID</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Company</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Contact Person</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Site</TableHead>
              <TableHead className="font-semibold text-gray-900 border-0">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProposals.map((proposal) => (
              <>
                <TableRow
                  key={proposal.id}
                  className="cursor-pointer border-b border-gray-200"
                  onClick={() => handleViewProposal(proposal.id)}
                >
                  <TableCell className="py-3">
                    <div className="text-sm text-gray-600">
                      {(() => {
                        if (!proposal.createdAt || !(proposal.createdAt instanceof Date) || isNaN(proposal.createdAt.getTime())) {
                          return "N/A"
                        }
                        return format(proposal.createdAt, "MMM d, yyyy")
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="font-medium text-gray-900">{proposal.proposalNumber}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="font-medium text-gray-900">{proposal.client.company}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-gray-600">{proposal.client.contactPerson}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{proposal.products?.length || 0} sites</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(proposal.id)
                          }}
                          className="h-6 w-6 p-0"
                        >
                          {expandedProposals.has(proposal.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {expandedProposals.has(proposal.id) && (
                        <div className="mt-2 text-sm text-gray-700">
                          <ul className="list-disc list-inside">
                            {proposal.products?.map((product, index) => (
                              <li key={index}>{product.name || product.name}</li>
                            )) || <li key={`no-sites-${proposal.id}`}>No sites</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleViewProposal(proposal.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDownloadPDF(proposal)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleShareProposal(proposal)}>
                          <Share className="mr-2 h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCreateCostEstimate(proposal)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create CE
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCreateQuotation(proposal)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Quotation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleViewSentHistory(proposal)}>
                          <History className="mr-2 h-4 w-4" />
                          View Sent History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handlePrintProposal(proposal)}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
      </Card>
    )
  }

  useEffect(() => {
    if (user?.uid) {
      loadProposals(1) // Reset to first page when user changes
    }
  }, [user])

  useEffect(() => {
    if (user?.uid) {
      loadProposals(1) // Reset to first page when search changes
    }
  }, [searchTerm])

  useEffect(() => {
    const success = searchParams.get("success")
    if (success === "email-sent") {
      setShowSuccessDialog(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("success")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  const loadProposals = async (page = 1) => {
    if (!user?.uid) return

    setLoading(true)
    try {
      // Try Algolia search first
      const algoliaPage = page - 1 // Algolia uses 0-based pagination
      const result = await searchProposals(
        searchTerm,
        userData?.company_id || "",
        algoliaPage,
        itemsPerPage
      )

      console.log("Algolia search result:", result)

      // If Algolia returns results and they look like proposal data, use them
      if (result.nbHits > 0 && result.hits.length > 0 && result.hits[0].proposalNumber) {
        // Transform Algolia hits to Proposal objects
        const transformedProposals: Proposal[] = result.hits.map((hit: any) => ({
          id: hit.id || hit.objectID,
          proposalNumber: hit.proposalNumber || hit.proposal_number || hit.proposalNumber,
          title: hit.title,
          client: {
            id: hit.id || hit.objectID, // Using proposal id as client id for now
            company: hit.client_company || hit.clientCompany || hit['client.company'] || '',
            contactPerson: hit.client_contactPerson || hit.clientContactPerson || hit['client.contactPerson'] || '',
            name: hit.client_name || hit.clientName || hit['client.name'] || '',
            email: hit.client_email || hit.clientEmail || hit['client.email'] || '',
            phone: '',
            address: '',
            industry: '',
            designation: '',
          },
          products: hit.products || [],
          totalAmount: hit.totalAmount || hit.total_amount || 0,
          validUntil: new Date(), // Default value
          createdBy: user.uid,
          companyId: hit.company_id || hit.companyId,
          status: hit.status || 'draft',
          createdAt: hit.createdAt || hit.created_at ? new Date(hit.createdAt || hit.created_at) : new Date(),
          updatedAt: new Date(),
        }))

        setProposals(transformedProposals)
        setFilteredProposals(transformedProposals)
        setCurrentPage(page)
        setTotalCount(result.nbHits)
        setTotalPages(result.nbPages)
      } else {
        // Fallback to local search if Algolia has no results
        console.log("No results from Algolia, falling back to local search")
        const lastDocToUse = null // Reset for fallback
        const result = await getPaginatedProposalsByUserId(
          userData?.company_id || "",
          itemsPerPage,
          lastDocToUse,
          searchTerm,
          null
        )

        setProposals(result.items)
        setFilteredProposals(result.items)
        setLastDoc(result.lastDoc)
        setHasMore(result.hasMore)
        setCurrentPage(page)

        // Get total count for display
        const count = await getProposalsCountByUserId(
          user.uid,
          searchTerm,
          null
        )
        setTotalCount(count)
        setTotalPages(Math.ceil(count / itemsPerPage))
      }
    } catch (error) {
      console.error("Error loading proposals with Algolia, trying local search:", error)
      // Fallback to local search on error
      try {
        const lastDocToUse = null
        const result = await getPaginatedProposalsByUserId(
          userData?.company_id || "",
          itemsPerPage,
          lastDocToUse,
          searchTerm,
          null
        )

        setProposals(result.items)
        setFilteredProposals(result.items)
        setLastDoc(result.lastDoc)
        setHasMore(result.hasMore)
        setCurrentPage(page)

        const count = await getProposalsCountByUserId(
          user.uid,
          searchTerm,
          null
        )
        setTotalCount(count)
        setTotalPages(Math.ceil(count / itemsPerPage))
      } catch (localError) {
        console.error("Error with local search as well:", localError)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      loadProposals(currentPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      loadProposals(currentPage - 1)
    }
  }

  const getStatusConfig = (status: Proposal["status"]) => {
    switch (status) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: Clock,
          label: "Draft",
        }
      case "sent":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Send,
          label: "Sent",
        }
      case "viewed":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: Eye,
          label: "Viewed",
        }
      case "accepted":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: CheckCircle,
          label: "Accepted",
        }
      case "declined":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: XCircle,
          label: "Declined",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: Clock,
          label: "Unknown",
        }
    }
  }

  const handleViewProposal = (proposalId: string) => {
    router.push(`/sales/proposals/${proposalId}`)
  }

  const handleDownloadPDF = async (proposal: Proposal) => {
    // Navigate to detail page and trigger download there
    // This ensures the proposal is rendered and can be captured by html2canvas
    router.push(`/sales/proposals/${proposal.id}?action=download`)
  }

  const handlePrintProposal = (proposal: Proposal) => {
    // Navigate to detail page and trigger print there
    // This ensures the proposal is rendered and can be printed
    router.push(`/sales/proposals/${proposal.id}?action=print`)
  }

  const handleShareProposal = (proposal: Proposal) => {
    // Navigate to detail page and trigger share there
    // This ensures the proposal is rendered and can be shared properly
    router.push(`/sales/proposals/${proposal.id}?action=share`)
  }

  const handleCreateCostEstimate = async (proposal: Proposal) => {
    if (!user?.uid) return

    try {
      // Map proposal client to CostEstimateClientData
      const clientData = {
        id: proposal.client.id,
        name: proposal.client.name,
        email: proposal.client.email,
        company: proposal.client.company,
        phone: proposal.client.phone || "",
        address: proposal.client.address || "",
        designation: proposal.client.designation || "",
        industry: proposal.client.industry || "",
      }

      // Map proposal products to CostEstimateSiteData[]
      const sitesData = proposal.products.map((product) => ({
        id: product.id,
        name: product.name,
        location: product.location,
        price: product.price,
        type: product.type,
        image: product.media?.[0]?.url || undefined,
        specs_rental: product.specs_rental,
      }))

      const costEstimateIds = await createMultipleCostEstimates(clientData, sitesData, user.uid, {
        company_id: userData?.company_id || "",
      })

      toast({
        title: "Cost Estimates Created",
        description: `${costEstimateIds.length} individual cost estimates have been created successfully from the proposal.`,
      })

      // Navigate to the cost estimates page or the first created CE
      router.push(`/sales/cost-estimates/${costEstimateIds[0]}`)
    } catch (error) {
      console.error("Error creating cost estimates from proposal:", error)
      toast({
        title: "Error",
        description: "Failed to create cost estimates from proposal. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCreateQuotation = (proposal: Proposal) => {
    // Navigate to the date selection page with proposal data
    const siteIdsParam = encodeURIComponent(JSON.stringify(proposal.products.map(site => site.id)))
    const clientIdParam = encodeURIComponent(proposal.client.id)
    router.push(`/sales/quotations/select-dates?sites=${siteIdsParam}&clientId=${clientIdParam}`)
  }

  const handleViewSentHistory = (proposal: Proposal) => {
    setSelectedProposalForHistory(proposal)
    setShowSentHistoryDialog(true)
  }

  const toggleExpanded = (proposalId: string) => {
    setExpandedProposals(prev => {
      const newSet = new Set(prev)
      if (newSet.has(proposalId)) {
        newSet.delete(proposalId)
      } else {
        newSet.add(proposalId)
      }
      return newSet
    })
  }


  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Proposals</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 opacity-30" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-96 border-gray-300 rounded-full"
                />
              </div>
            </div>
            <Button
              onClick={() => router.push("/sales/dashboard?action=create-proposal")}
              className="bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-900 font-medium rounded-lg px-6 py-2"
            >
              Create Proposal
            </Button>
          </div>
        </div>

        {content}

        {/* Pagination Controls */}
        {!loading && filteredProposals.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="text-sm text-gray-600">
              Page {currentPage}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm mx-auto text-center border-0 shadow-lg">
          <DialogTitle className="sr-only">Success</DialogTitle>
          <div className="py-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Congratulations!</h2>
              <div className="flex justify-center mb-4">
                <div className="text-6xl">🎉</div>
              </div>
              <p className="text-gray-600">You have successfully sent a proposal!</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SentHistoryDialog
        open={showSentHistoryDialog}
        onOpenChange={setShowSentHistoryDialog}
        proposalId={selectedProposalForHistory?.id || ""}
      />

      {selectedProposalForShare && (
        <SendProposalShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          proposal={selectedProposalForShare}
        />
      )}
    </>
  )
}

export default function ProposalsPage() {
  return <ProposalsPageContent />
}
