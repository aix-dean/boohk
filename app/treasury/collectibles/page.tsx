"use client"

import { Search, Grid3X3, List, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useEffect, useCallback } from "react"
import { RouteProtection } from "@/components/route-protection"
import { useAuth } from "@/contexts/auth-context"
import { searchCollectibles } from "@/lib/algolia-service"
import { useDebounce } from "@/hooks/use-debounce"
import { PDFViewer } from "@/components/ui/pdf-viewer"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import type { Collectible } from "@/lib/types/collectible"
import type { SearchResponse } from "@/lib/algolia-service"

// Generate next invoice number for the company
const generateNextInvoiceNumber = async (companyId: string): Promise<string> => {
  try {
    const invoicesRef = collection(db, "invoices")
    const q = query(
      invoicesRef,
      where("company_id", "==", companyId)
    )

    const querySnapshot = await getDocs(q)
    let maxNumber = 0

    querySnapshot.forEach((doc) => {
      const invoice = doc.data()
      const invoiceNumber = invoice.invoice_number
      if (invoiceNumber) {
        const parsed = parseInt(invoiceNumber, 10)
        if (!isNaN(parsed) && parsed > maxNumber) {
          maxNumber = parsed
        }
      }
    })

    const nextNumber = maxNumber + 1
    return nextNumber.toString().padStart(4, '0')
  } catch (error) {
    console.error("Error generating next invoice number:", error)
    // Fallback: start with 0001 if we can't query
    return "0001"
  }
}

function CollectiblesTable({
  collectibles,
  loading,
  onClientClick,
  onAmountClick,
  onViewContract,
  onGenerateInvoice,
  selectedCollectible,
  isModalOpen,
  setIsModalOpen,
  formatDate,
  searchQuery,
  onSearchChange,
  searchResponse,
  currentPage,
  onPageChange,
  generatingInvoiceId,
  selectedClientData
}: {
  collectibles: Collectible[]
  loading: boolean
  onClientClick: (collectible: Collectible) => void
  onAmountClick: (collectible: Collectible) => void
  onViewContract: (item: any) => void
  onGenerateInvoice: (item: any) => void
  selectedCollectible: Collectible | null
  isModalOpen: boolean
  setIsModalOpen: (open: boolean) => void
  formatDate: (timestamp: any) => string
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResponse: SearchResponse | null
  currentPage: number
  onPageChange: (page: number) => void
  generatingInvoiceId: string | null
  selectedClientData: any
}) {
  return (
    <div className="bg-[#ffffff] rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-[#d9d9d9]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-[#333333]">Collectibles</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-[#b7b7b7]">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-[#b7b7b7]">
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#b7b7b7]" />
          <Input
            placeholder="Search collectibles..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value)
            }}
            className="pl-10 bg-[#fafafa] border-[#d9d9d9] text-[#333333] placeholder:text-[#b7b7b7]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#d9d9d9]">
              <th className="text-left p-4 font-medium text-[#333333]">Sales Invoice #</th>
              <th className="text-left p-4 font-medium text-[#333333]">Client</th>
              <th className="text-left p-4 font-medium text-[#333333]">Cover Dates</th>
              <th className="text-left p-4 font-medium text-[#333333]">Amount</th>
              <th className="text-left p-4 font-medium text-[#333333]">Due date</th>
              <th className="text-left p-4 font-medium text-[#333333]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 10 }).map((_, index) => (
                <tr key={index} className="border-b border-[#d9d9d9]">
                  <td className="p-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="p-4">
                    <Skeleton className="h-6 w-32 rounded-full" />
                  </td>
                  <td className="p-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="p-4">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="p-4">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="p-4">
                    <Skeleton className="h-8 w-8 rounded" />
                  </td>
                </tr>
              ))
            ) : collectibles.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-[#b7b7b7]">No collectibles found</td>
              </tr>
            ) : (
              collectibles.map((item, index) => (
                <tr key={item.id || index} className="border-b border-[#d9d9d9] hover:bg-[#fafafa]">
                  <td className="p-4">
                    <span className="text-[#2d3fff] cursor-pointer">{item.invoice_number || "—"}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className="bg-[#d9d9d9] px-3 py-1 rounded-full text-sm text-[#333333] cursor-pointer hover:bg-[#c4c4c4] transition-colors"
                      onClick={() => onClientClick(item)}
                    >
                      {item.client?.name || "N/A"}
                    </span>
                  </td>
                  <td className="p-4 text-[#333333]">{item.period || "N/A"}</td>
                  <td className="p-4">
                    <span
                      className="text-[#2d3fff] font-medium cursor-pointer hover:underline"
                      onClick={() => onAmountClick(item)}
                    >
                      {item.amount?.toLocaleString() || "N/A"}
                    </span>
                  </td>
                  <td className="p-4 text-[#333333]">{item.due_date ? formatDate(item.due_date) : "N/A"}</td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#b7b7b7] hover:text-[#333333] hover:bg-[#fafafa] p-1 h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white border border-[#d9d9d9] shadow-lg">
                        <DropdownMenuItem
                          onClick={() => onViewContract(item)}
                          className="text-[#333333] hover:bg-[#fafafa] cursor-pointer px-3 py-2"
                        >
                          View Contract
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onGenerateInvoice(item)}
                          disabled={!!item.invoice_number || generatingInvoiceId === item.id}
                          className="text-[#333333] hover:bg-[#fafafa] cursor-pointer px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingInvoiceId === item.id ? "Generating..." : "Generate Invoice"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {searchResponse && searchResponse.nbPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t border-[#d9d9d9]">
          <div className="text-sm text-[#b7b7b7]">
            Showing {collectibles.length > 0 ? currentPage * 10 + 1 : 0} to {Math.min((currentPage + 1) * 10, searchResponse.nbHits)} of {searchResponse.nbHits} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="border-[#d9d9d9] text-[#333333] hover:bg-[#fafafa]"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-[#333333]">
              Page {currentPage + 1} of {searchResponse.nbPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= searchResponse.nbPages - 1}
              className="border-[#d9d9d9] text-[#333333] hover:bg-[#fafafa]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Reservation Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md mx-auto bg-white p-6 overflow-y-auto max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-center">Reservation Details</DialogTitle>
            <DialogDescription className="sr-only">
              Detailed client information and booking details
            </DialogDescription>
          </DialogHeader>
          {selectedClientData && (
            
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-[#b7b7b7] mb-1">Reservation ID</p>
                <h2 className="text-3xl font-bold text-[#000000]">{selectedClientData.reservationId}</h2>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Project Name:</span>
                  <span className="text-[#333333]">{selectedClientData.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Client:</span>
                  <span className="text-[#333333]">{selectedClientData.client}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Site:</span>
                  <span className="text-[#333333]">{selectedClientData.site}</span>
                </div>
              </div>

              <div className="flex justify-center my-6">
                <div className="w-24 h-24 bg-[#d9d9d9] rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#000000]">Site</p>
                    <p className="text-sm font-medium text-[#000000]">Photo</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Dimension:</span>
                  <span className="text-[#333333]">{selectedClientData.dimension}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Contract Duration:</span>
                  <span className="text-[#333333]">{selectedClientData.contractDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Booking Dates:</span>
                  <span className="text-[#333333]">{selectedClientData.bookingDates}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Illumination:</span>
                  <span className="text-[#333333]">{selectedClientData.illumination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Lease Rate/month:</span>
                  <span className="text-[#333333]">{selectedClientData.leaseRatePerMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Total lease:</span>
                  <span className="text-[#333333]">{selectedClientData.totalLease}</span>
                </div>
              </div>

              <div className="border-t border-[#d9d9d9] pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Lease rate per month:</span>
                  <span className="text-[#333333]">{selectedClientData.leaseRatePerMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Duration:</span>
                  <span className="text-[#333333]">{selectedClientData.contractDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">Subtotal:</span>
                  <span className="text-[#333333]">{selectedClientData.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#000000]">12% VAT:</span>
                  <span className="text-[#333333]">{selectedClientData.vat}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-[#000000]">TOTAL:</span>
                  <span className="text-[#000000]">{selectedClientData.total}</span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <span className="font-medium text-[#000000]">Sales:</span>
                <span className="text-[#333333]">{selectedClientData.sales}</span>
              </div>

              <div className="pt-6">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-white border border-[#d9d9d9] text-[#000000] hover:bg-[#fafafa]"
                >
                  OK
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CollectiblesPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [collectibles, setCollectibles] = useState<Collectible[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCollectible, setSelectedCollectible] = useState<Collectible | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClientData, setSelectedClientData] = useState<any>(null)
  const [isAmountDialogOpen, setIsAmountDialogOpen] = useState(false)
  const [selectedAmountCollectible, setSelectedAmountCollectible] = useState<Collectible | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(0)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false)
  const [selectedContractUrl, setSelectedContractUrl] = useState<string | undefined>(undefined)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)

  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  // Fetch collectibles data using Algolia search
  const fetchCollectibles = useCallback(async (query: string = "", page: number = 0) => {
    if (!userData?.company_id) return

    setLoading(true)
    try {
      const response = await searchCollectibles(query, userData.company_id, page, 10)
      setSearchResponse(response)

      // Transform hits to Collectible format
      const collectiblesData: Collectible[] = response.hits.map(hit => ({
        id: hit.objectID,
        ...(hit as any), // Cast to any since the hit structure matches Collectible
      } as Collectible))

      setCollectibles(collectiblesData)
    } catch (error) {
      console.error("Error fetching collectibles:", error)
      setCollectibles([])
      setSearchResponse(null)
    } finally {
      setLoading(false)
    }
  }, [userData?.company_id])

  useEffect(() => {
    fetchCollectibles(debouncedSearchQuery, currentPage)
  }, [fetchCollectibles, debouncedSearchQuery, currentPage])

  // Fetch client data when selectedCollectible changes
  useEffect(() => {
    const fetchClientData = async () => {
      if (!selectedCollectible || !selectedCollectible.booking?.id) {
        console.log("No booking id available for the selected collectible.")
        setSelectedClientData(null)
        return
      }

      try {
        // Fetch booking data for complete information
        const bookingDoc = await getDoc(doc(db, "booking", selectedCollectible.booking.id))
        if (bookingDoc.exists()) {
          const booking = bookingDoc.data()

          // Calculate duration from start_date and end_date
          let duration = "N/A"
          if (booking.start_date && booking.end_date) {
            const startDate = booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date)
            const endDate = booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date)
            const months = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
            duration = `${months} month${months !== 1 ? 's' : ''}`
          }

          // Fetch quotation to get dimensions
          let dimension = "N/A"
          if (booking.quotation_id) {
            try {
              const quotationDoc = await getDoc(doc(db, "quotations", booking.quotation_id))
              if (quotationDoc.exists()) {
                const quotationData = quotationDoc.data()
                if (quotationData.items?.height && quotationData.items?.width) {
                  dimension = `${quotationData.items.height}ft (H) x ${quotationData.items.width}ft (W)`
                }
              }
            } catch (error) {
              console.error("Error fetching quotation for dimensions:", error)
            }
          }

          setSelectedClientData({
            reservationId: booking.reservation_id,
            projectName: booking.project_name || "N/A",
            client: booking.client?.name || "N/A",
            site: booking.product_name || "N/A",
            dimension: dimension,
            contractDuration: duration,
            bookingDates: booking.start_date && booking.end_date ?
              `${formatDate(booking.start_date)} to ${formatDate(booking.end_date)}` : "N/A",
            illumination: "N/A", // Not available in booking data
            leaseRatePerMonth: booking.costDetails ? booking.costDetails.pricePerMonth.toLocaleString() : selectedCollectible.rate?.toLocaleString() || "N/A",
            totalLease: booking.cost ? booking.cost.toLocaleString() : (selectedCollectible.rate && selectedCollectible.total_months ? (selectedCollectible.rate * selectedCollectible.total_months).toLocaleString() : "N/A"),
            duration: duration,
            subtotal: booking.costDetails ? booking.costDetails.total.toLocaleString() : (selectedCollectible.rate && selectedCollectible.total_months ? (selectedCollectible.rate * selectedCollectible.total_months).toLocaleString() : "N/A"),
            vat: booking.total_cost ? (booking.total_cost * 0.12).toLocaleString() : selectedCollectible.vat_amount?.toLocaleString() || "N/A",
            total: booking.total_cost ? (booking.total_cost * 1.12).toLocaleString() : (selectedCollectible.amount && selectedCollectible.vat_amount ? (selectedCollectible.amount + selectedCollectible.vat_amount).toLocaleString() : "N/A"),
            sales: "N/A", // Not available in booking data
          })
        } else {
          // Fallback to collectible data
          let duration = "N/A"
          if (selectedCollectible.booking?.start_date && selectedCollectible.booking?.end_date) {
            const startDate = selectedCollectible.booking.start_date.toDate ? selectedCollectible.booking.start_date.toDate() : new Date(selectedCollectible.booking.start_date)
            const endDate = selectedCollectible.booking.end_date.toDate ? selectedCollectible.booking.end_date.toDate() : new Date(selectedCollectible.booking.end_date)
            const months = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
            duration = `${months} month${months !== 1 ? 's' : ''}`
          }

          setSelectedClientData({
            reservationId: selectedCollectible.booking?.reservation_id || "N/A",
            projectName: selectedCollectible.booking?.project_name || "N/A",
            client: selectedCollectible.client?.name || "N/A",
            site: selectedCollectible.product?.name || "N/A",
            dimension: "N/A",
            contractDuration: duration,
            bookingDates: selectedCollectible.booking?.start_date && selectedCollectible.booking?.end_date ?
              `${formatDate(selectedCollectible.booking.start_date)} to ${formatDate(selectedCollectible.booking.end_date)}` : "N/A",
            illumination: "N/A",
            leaseRatePerMonth: selectedCollectible.rate?.toLocaleString() || "N/A",
            totalLease: selectedCollectible.rate && selectedCollectible.total_months ? (selectedCollectible.rate * selectedCollectible.total_months).toLocaleString() : "N/A",
            duration: duration,
            subtotal: selectedCollectible.rate && selectedCollectible.total_months ? (selectedCollectible.rate * selectedCollectible.total_months).toLocaleString() : "N/A",
            vat: selectedCollectible.vat_amount?.toLocaleString() || "N/A",
            total: selectedCollectible.amount && selectedCollectible.vat_amount ? (selectedCollectible.amount + selectedCollectible.vat_amount).toLocaleString() : "N/A",
            sales: "N/A",
          })
        }
      } catch (error) {
        console.error("Error fetching client data:", error)
        setSelectedClientData(null)
      }
    }

    fetchClientData()
  }, [selectedCollectible])

  // Format date helper
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const handleClientClick = (collectible: Collectible) => {
    setSelectedCollectible(collectible)
    setIsModalOpen(true)
  }

  const handleAmountClick = (collectible: Collectible) => {
    setSelectedAmountCollectible(collectible)
    setIsAmountDialogOpen(true)
  }

  const handleViewContract = async (collectible: Collectible) => {
    // First try to get contract from collectible document
    if (collectible.contract_pdf_url) {
      setSelectedContractUrl(collectible.contract_pdf_url)
      setIsContractDialogOpen(true)
      return
    }


    try {
      const invoiceDoc = await getDoc(doc(db, "invoices", collectible.invoice_id!))
      if (invoiceDoc.exists()) {
        const invoiceData = invoiceDoc.data()
        setSelectedContractUrl(invoiceData.contract_pdf_url)
        setIsContractDialogOpen(true)
      } else {
        toast({
          title: "Error",
          description: "Invoice not found",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching invoice:", error)
      toast({
        title: "Error",
        description: "Failed to load contract",
        variant: "destructive",
      })
    }
  }

  const handleGenerateInvoice = async (collectible: Collectible) => {
    if (!userData?.company_id) {
      toast({
        title: "Error",
        description: "Company information not available",
        variant: "destructive",
      })
      return
    }

    if (collectible.invoice_number) {
      toast({
        title: "Error",
        description: "Invoice already generated for this collectible",
        variant: "destructive",
      })
      return
    }

    setGeneratingInvoiceId(collectible.id!)
    try {
      // Generate next invoice number
      const invoiceNumber = await generateNextInvoiceNumber(userData.company_id)

      // Update the collectible document
      const collectibleRef = doc(db, "collectibles", collectible.id!)
      await updateDoc(collectibleRef, {
        invoice_number: invoiceNumber,
        invoice_date: serverTimestamp(),
        updated: serverTimestamp(),
      })

      // Show success toast
      toast({
        title: "Success",
        description: `Invoice ${invoiceNumber} generated successfully`,
      })

      // Refresh the collectibles list
      fetchCollectibles(debouncedSearchQuery, currentPage)
    } catch (error) {
      console.error("Error generating invoice:", error)
      toast({
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingInvoiceId(null)
    }
  }

  return (
    <RouteProtection requiredRoles="treasury">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <CollectiblesTable
          collectibles={collectibles}
          loading={loading}
          onClientClick={handleClientClick}
          onAmountClick={handleAmountClick}
          onViewContract={handleViewContract}
          onGenerateInvoice={handleGenerateInvoice}
          selectedCollectible={selectedCollectible}
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          formatDate={formatDate}
          searchQuery={searchQuery}
          onSearchChange={(query) => {
            setSearchQuery(query)
            setCurrentPage(0)
          }}
          searchResponse={searchResponse}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          generatingInvoiceId={generatingInvoiceId}
          selectedClientData={selectedClientData}
        />

        {/* Amount Breakdown Dialog */}
        <Dialog open={isAmountDialogOpen} onOpenChange={setIsAmountDialogOpen}>
          <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-left text-xl md:text-2xl font-semibold text-gray-900">Breakdown:</DialogTitle>
              <DialogDescription className="sr-only">
                Detailed financial breakdown of the collectible amount
              </DialogDescription>
            </DialogHeader>

            {selectedAmountCollectible && (
              <div className="space-y-6 pt-4">
                {/* Item Breakdown */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 font-medium text-gray-900">
                    <div>Item</div>
                    <div className="text-right">Amount</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-gray-700">
                    <div>{selectedAmountCollectible.period || "N/A"}</div>
                    <div className="text-right">{selectedAmountCollectible.amount?.toLocaleString() || "N/A"}</div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">VATable Sales:</div>
                    <div className="text-right text-gray-700">{((selectedAmountCollectible.amount || 0) / 1.12).toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">VAT (12%):</div>
                    <div className="text-right text-gray-700">{selectedAmountCollectible.vat_amount?.toLocaleString() || "N/A"}</div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">Total Sales (VAT Inclusive):</div>
                    <div className="text-right text-gray-700">{selectedAmountCollectible.amount?.toLocaleString() || "N/A"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">Less VAT:</div>
                    <div className="text-right text-gray-700">{selectedAmountCollectible.vat_amount?.toLocaleString() || "N/A"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">Amount Net of VAT:</div>
                    <div className="text-right text-gray-700">{((selectedAmountCollectible.amount || 0) / 1.12).toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">Add VAT:</div>
                    <div className="text-right text-gray-700">{selectedAmountCollectible.vat_amount?.toLocaleString() || "N/A"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-gray-700 font-medium">Less Withholding Tax:</div>
                    <div className="text-right text-gray-700">{(selectedAmountCollectible.with_holding_tax || 0).toLocaleString()}</div>
                  </div>
                </div>

                {/* Total Amount Due */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="bg-green-100 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-gray-900 font-bold text-base md:text-lg">TOTAL AMOUNT DUE:</div>
                      <div className="text-right text-gray-900 font-bold text-base md:text-lg">
                        {((selectedAmountCollectible.amount || 0) - (selectedAmountCollectible.with_holding_tax || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* OK Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setIsAmountDialogOpen(false)}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 md:px-12 py-2"
                    variant="outline"
                  >
                    OK
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Contract PDF Dialog */}
        <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
          <DialogContent className="">
            <DialogHeader>
              <DialogTitle className="text-center">Contract Preview</DialogTitle>
              <DialogDescription className="sr-only">
                Preview of the signed contract document
              </DialogDescription>
            </DialogHeader>

            <div className="">
              {selectedContractUrl ? (
                <div className="h-[700px]">
                  <PDFViewer
                    fileUrl={selectedContractUrl}
                    className="w-full h-[700px]"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center text-gray-500">
                    <div className="mb-4">
                      <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-lg font-medium mb-2">No Contract Available</div>
                    <div className="text-sm">The signed contract will be displayed here</div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteProtection>
  )
}
