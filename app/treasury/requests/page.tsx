"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pagination } from "@/components/ui/pagination"
import { ResponsiveTable } from "@/components/responsive-table"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { bookingService, type Booking } from "@/lib/booking-service"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit, startAfter, updateDoc, serverTimestamp } from "firebase/firestore"
import Link from "next/link"
import type { Invoice } from "@/lib/types/invoice"
import { PDFViewer } from "@/components/ui/pdf-viewer"
import { useToast } from "@/hooks/use-toast"

export default function RequestsPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [isAmountDialogOpen, setIsAmountDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | undefined>(undefined)
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false)
  const [selectedContractUrl, setSelectedContractUrl] = useState<string | undefined>(undefined)

  // Collectibles state
  const [collectibles, setCollectibles] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({})

  // Invoices state
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [invoicesCurrentPage, setInvoicesCurrentPage] = useState(1)
  const [invoicesPageSize] = useState(5)
  const [invoicesTotalCount, setInvoicesTotalCount] = useState(0)
  const [invoicesHasNextPage, setInvoicesHasNextPage] = useState(false)
  const [invoicesLastDoc, setInvoicesLastDoc] = useState<any>(null)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)

  const handleClientClick = async (clientName: string, invoice?: Invoice) => {
    if (invoice) {
      try {
        // Fetch the actual booking document using booking_id from invoice
        const booking = await bookingService.getBookingById(invoice.booking_id)
        if (booking) {
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

          const clientData = {
            reservationId: booking.reservation_id,
            projectName: booking.project_name || "N/A",
            client: booking.client.name,
            site: booking.product_name || "N/A",
            dimension: dimension,
            contractDuration: duration,
            bookingDates: booking.start_date && booking.end_date ?
              `${formatDate(booking.start_date)} to ${formatDate(booking.end_date)}` : "N/A",
            illumination: "N/A", // Not available in booking data
            leaseRatePerMonth: booking.costDetails ? booking.costDetails.pricePerMonth.toLocaleString() : "N/A",
            totalLease: booking.cost ? booking.cost.toLocaleString() : "N/A",
            duration: duration,
            subtotal: booking.costDetails ? booking.costDetails.total.toLocaleString() : "N/A",
            vat: booking.total_cost ? (booking.total_cost * 0.12).toLocaleString() : "N/A",
            total: booking.total_cost ? (booking.total_cost * 1.12).toLocaleString() : "N/A",
            sales: "N/A", // Not available in booking data
          }
          setSelectedClient(clientData)
        } else {
          // Fallback to invoice data if booking not found
          const clientData = {
            reservationId: invoice.booking.reservation_id,
            projectName: invoice.booking.project_name || "N/A",
            client: invoice.client.name,
            site: "N/A",
            dimension: "N/A",
            contractDuration: `${invoice.total_months} months`,
            bookingDates: formatCoverDates(invoice),
            illumination: "N/A",
            leaseRatePerMonth: invoice.rate.toLocaleString(),
            totalLease: (invoice.rate * invoice.total_months).toLocaleString(),
            duration: `${invoice.total_months} months`,
            subtotal: (invoice.rate * invoice.total_months).toLocaleString(),
            vat: invoice.vat_amount.toLocaleString(),
            total: (invoice.amount + invoice.vat_amount).toLocaleString(),
            sales: "N/A",
          }
          setSelectedClient(clientData)
        }
      } catch (error) {
        console.error("Error fetching booking for client details:", error)
        // Fallback to invoice data on error
        const clientData = {
          reservationId: invoice.booking.reservation_id,
          projectName: invoice.booking.project_name || "N/A",
          client: invoice.client.name,
          site: "N/A",
          dimension: "N/A",
          contractDuration: `${invoice.total_months} months`,
          bookingDates: formatCoverDates(invoice),
          illumination: "N/A",
          leaseRatePerMonth: invoice.rate.toLocaleString(),
          totalLease: (invoice.rate * invoice.total_months).toLocaleString(),
          duration: `${invoice.total_months} months`,
          subtotal: (invoice.rate * invoice.total_months).toLocaleString(),
          vat: invoice.vat_amount.toLocaleString(),
          total: (invoice.amount + invoice.vat_amount).toLocaleString(),
          sales: "N/A",
        }
        setSelectedClient(clientData)
      }
    } else {
      // Fallback for hardcoded data if needed
      const fallbackData = {
        "Summit Media": {
          reservationId: "RV00432",
          projectName: "Lilo and Stitch",
          client: "Summit Media",
          site: "Petplans Tower",
          dimension: "100ft (H) x 60ft (W)",
          contractDuration: "3 months",
          bookingDates: "Oct 31 '25 to Jan 31 '26",
          illumination: "10 units of 1000 watts metal halide",
          leaseRatePerMonth: "290,000",
          totalLease: "870,000",
          duration: "3 months",
          subtotal: "870,000",
          vat: "104,400",
          total: "974,400",
          sales: "Noemi Abellanada",
        },
      }
      setSelectedClient(fallbackData[clientName as keyof typeof fallbackData])
    }
    setIsDialogOpen(true)
  }

  const handleAmountClick = (invoice?: Invoice) => {
    setSelectedInvoice(invoice)
    setIsAmountDialogOpen(true)
  }

  const handleViewContract = (invoice: Invoice) => {
    setSelectedContractUrl(invoice.contract_pdf_url)
    setIsContractDialogOpen(true)
  }

  // Fetch seller names for bookings
  const fetchSellerNames = async (sellerIds: string[]) => {
    const uniqueIds = [...new Set(sellerIds)]
    const names: Record<string, string> = {}

    for (const sellerId of uniqueIds) {
      if (sellerNames[sellerId]) {
        names[sellerId] = sellerNames[sellerId]
        continue
      }

      try {
        const userDocRef = doc(db, "boohk_users", sellerId)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data()
          const fullName = `${userData.first_name || ""} ${userData.last_name || ""}`.trim()
          names[sellerId] = fullName || sellerId
        } else {
          names[sellerId] = sellerId
        }
      } catch (error) {
        console.error("Error fetching seller name:", error)
        names[sellerId] = sellerId
      }
    }

    setSellerNames(prev => ({ ...prev, ...names }))
    return names
  }

  // Fetch collectibles data
  const fetchCollectibles = async () => {
    if (!userData?.company_id) return

    setLoading(true)
    try {
      const result = await bookingService.getPaginatedCollectibles(
        userData.company_id,
        {
          page: currentPage,
          pageSize,
          lastDoc: currentPage > 1 ? lastDoc : undefined,
        }
      )

      setCollectibles(result.data)
      setTotalCount(result.totalCount)
      setHasNextPage(result.hasNextPage)
      setLastDoc(result.lastDoc)

      // Fetch seller names
      const sellerIds = result.data.map(booking => booking.seller_id).filter(Boolean)
      if (sellerIds.length > 0) {
        await fetchSellerNames(sellerIds)
      }
    } catch (error) {
      console.error("Error fetching collectibles:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch invoices data with pagination
  const fetchInvoices = async () => {
    if (!userData?.company_id) return

    setInvoicesLoading(true)
    try {
      const invoicesRef = collection(db, "invoices")
      let q = query(
        invoicesRef,
        where("company_id", "==", userData.company_id),
        orderBy("created", "desc")
      )

      // Add pagination
      if (invoicesLastDoc && invoicesCurrentPage > 1) {
        q = query(q, startAfter(invoicesLastDoc))
      }
      q = query(q, limit(invoicesPageSize + 1)) // +1 to check if there's a next page

      const querySnapshot = await getDocs(q)
      const invoicesData: Invoice[] = []
      let lastDoc = null

      const docs = querySnapshot.docs
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        if (i < invoicesPageSize) {
          invoicesData.push({
            id: doc.id,
            ...doc.data(),
          } as Invoice)
        }
        if (i === invoicesPageSize - 1) {
          lastDoc = doc
        }
      }

      // Check if there's a next page
      const hasNext = docs.length > invoicesPageSize

      setInvoices(invoicesData)
      setInvoicesHasNextPage(hasNext)
      setInvoicesLastDoc(lastDoc)

      // For total count, we'd need a separate query or maintain it separately
      // For now, we'll estimate it based on current data
      setInvoicesTotalCount(prev => {
        if (invoicesCurrentPage === 1) {
          return hasNext ? invoicesData.length + 1 : invoicesData.length
        }
        return prev
      })
    } catch (error) {
      console.error("Error fetching invoices:", error)
    } finally {
      setInvoicesLoading(false)
    }
  }

  // Handle pagination
  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Handle invoice pagination
  const handleInvoicesNextPage = () => {
    if (invoicesHasNextPage) {
      setInvoicesCurrentPage(prev => prev + 1)
    }
  }

  const handleInvoicesPreviousPage = () => {
    if (invoicesCurrentPage > 1) {
      // For simplicity, reset to page 1 when going back
      // This avoids complex cursor management
      setInvoicesCurrentPage(1)
      setInvoicesLastDoc(null)
    }
  }

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Format cover dates for invoice
  const formatCoverDates = (invoice: Invoice) => {
    const startDate = invoice.booking.start_date
    const endDate = invoice.booking.end_date

    if (!startDate || !endDate) return "N/A"

    const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate)

    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  }

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

  // Handle generate invoice
  const handleGenerateInvoice = async (invoice: Invoice) => {
    if (!userData?.company_id) {
      toast({
        title: "Error",
        description: "Company information not available",
        variant: "destructive",
      })
      return
    }

    setGeneratingInvoiceId(invoice.id!)
    try {
      // Generate next invoice number
      const invoiceNumber = await generateNextInvoiceNumber(userData.company_id)

      // Update the invoice document
      const invoiceRef = doc(db, "invoices", invoice.id!)
      await updateDoc(invoiceRef, {
        invoice_number: invoiceNumber,
        invoice_date: serverTimestamp(),
        updated: serverTimestamp(),
      })

      // Update the corresponding collectible document with the invoice_number
      if (invoice.collectible_id) {
        const collectibleRef = doc(db, "collectibles", invoice.collectible_id)
        await updateDoc(collectibleRef, {
          invoice_number: invoiceNumber,
          updated: serverTimestamp(),
        })
      }

      // Show success toast
      toast({
        title: "Success",
        description: `Invoice ${invoiceNumber} generated successfully`,
      })

      // Refresh the invoices list
      fetchInvoices()
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

  // Effect to fetch data when component mounts or pagination changes
  useEffect(() => {
    fetchCollectibles()
  }, [userData?.company_id, currentPage])

  // Effect to fetch invoices when component mounts or pagination changes
  useEffect(() => {
    fetchInvoices()
  }, [userData?.company_id, invoicesCurrentPage])

  const invoiceColumns = [
    {
      header: "Client",
      cell: (invoice: Invoice) => (
        <Button
          variant="outline"
          className="shadow-md pt-2 h-auto font-normal w-full sm:w-[150px]"
          onClick={() => handleClientClick(invoice.client.name, invoice)}
        >
          {invoice.client.name}
        </Button>
      ),
    },
    {
      header: "Cover Dates",
      accessorKey: (invoice: Invoice) => formatCoverDates(invoice),
    },
    {
      header: "Amount",
      cell: (invoice: Invoice) => (
        <div className="text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => handleAmountClick(invoice)}>
          {invoice.amount.toLocaleString()}
        </div>
      ),
    },
    {
      header: "Due date",
      accessorKey: (invoice: Invoice) => formatDate(invoice.due_date),
      hideOnMobile: true,
    },
    {
      header: "Actions",
      cell: (invoice: Invoice) => {
        const isGenerating = generatingInvoiceId === invoice.id
        const isDisabled = !!invoice.invoice_number || isGenerating

        return (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="text-sm"
              onClick={() => handleGenerateInvoice(invoice)}
              disabled={isDisabled}
            >
              {isGenerating ? "Generating..." : "Generate Invoice"}
            </Button>
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent text-sm"
              onClick={() => handleViewContract(invoice)}
              disabled={isGenerating}
            >
              View Contract
            </Button>
          </div>
        )
      },
      hideOnMobile: true,
    },
  ]

  const collectibleColumns = [
    {
      header: "Date",
      accessorKey: (booking: Booking) => formatDate(booking.start_date),
    },
    {
      header: "Reservation",
      accessorKey: (booking: Booking) => booking.reservation_id,
    },
    {
      header: "Project Name",
      accessorKey: (booking: Booking) => booking.project_name || "N/A",
    },
    {
      header: "Client Name",
      accessorKey: (booking: Booking) => booking.client?.name || booking.client?.company_name || "N/A",
    },
    {
      header: "Sales",
      accessorKey: (booking: Booking) => sellerNames[booking.seller_id] || booking.seller_id,
      hideOnMobile: true,
    },
    {
      header: "Actions",
      cell: (booking: Booking) => (
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/treasury/requests/create-collectibles/${booking.id}`}>
            <Button
              variant="outline"
              className="text-sm w-full sm:w-auto"
              disabled={booking.isCollectibles}
            >
              Create collectibles
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 text-sm bg-transparent w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      ),
      hideOnMobile: true,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">Requests</h1>
          <Button variant="outline" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 w-full sm:w-auto">
            History
          </Button>
        </div>

        {/* For Sales Invoice Section */}
        <div className="mb-6 md:mb-8">
          <h2 className="text-base md:text-lg font-medium text-gray-900 mb-4">For Sales Invoice</h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            {invoicesLoading ? (
              <p className="text-gray-700">Loading invoices...</p>
            ) : (
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <ResponsiveTable
                  data={invoices}
                  columns={invoiceColumns}
                  emptyState={<p className="text-gray-700">No invoices found.</p>}
                />
              </div>
            )}

            {/* Pagination for Invoices */}
            {!invoicesLoading && invoices.length > 0 && (
              <div className="mt-4">
                <Pagination
                  currentPage={invoicesCurrentPage}
                  itemsPerPage={invoicesPageSize}
                  totalItems={invoices.length}
                  totalOverall={invoicesTotalCount}
                  onNextPage={handleInvoicesNextPage}
                  onPreviousPage={handleInvoicesPreviousPage}
                  hasMore={invoicesHasNextPage}
                />
              </div>
            )}
          </div>
        </div>

        {/* For Collectibles Section */}
        <div>
          <h2 className="text-base md:text-lg font-medium text-gray-900 mb-4">For Collectibles</h2>
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <ResponsiveTable
              data={collectibles}
              columns={collectibleColumns}
              isLoading={loading}
              emptyState={<div className="p-4 text-center text-gray-500">No collectibles found</div>}
            />
          </div>

          {/* Pagination */}
          {!loading && collectibles.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                itemsPerPage={pageSize}
                totalItems={collectibles.length}
                totalOverall={totalCount}
                onNextPage={handleNextPage}
                onPreviousPage={handlePreviousPage}
                hasMore={hasNextPage}
              />
            </div>
          )}
        </div>

        {/* Client Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-left">
                <div className="text-sm text-gray-500 mb-1">Reservation ID</div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900">{selectedClient?.reservationId}</div>
              </DialogTitle>
            </DialogHeader>

            {selectedClient && (
              <div className="space-y-6 pt-4">
                {/* Project Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Project Name:</div>
                    <div className="text-gray-700">{selectedClient.projectName}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Client:</div>
                    <div className="text-gray-700">{selectedClient.client}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Site:</div>
                    <div className="text-gray-700">{selectedClient.site}</div>
                  </div>
                  <div className="flex justify-center md:justify-start">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-700 text-xs md:text-sm font-medium">
                        Site
                        <br />
                        Photo
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contract Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  <div>
                    <span className="font-semibold text-gray-900">Dimension: </span>
                    <span className="text-gray-700">{selectedClient.dimension}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Contract Duration: </span>
                    <span className="text-gray-700">{selectedClient.contractDuration}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Booking Dates: </span>
                    <span className="text-gray-700">{selectedClient.bookingDates}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Illumination: </span>
                    <span className="text-gray-700">{selectedClient.illumination}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Lease Rate/month: </span>
                    <span className="text-gray-700">{selectedClient.leaseRatePerMonth}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Total lease: </span>
                    <span className="text-gray-700">{selectedClient.totalLease}</span>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div>
                      <span className="font-semibold text-gray-900">Lease rate per month: </span>
                      <span className="text-gray-700">{selectedClient.leaseRatePerMonth}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Duration: </span>
                      <span className="text-gray-700">{selectedClient.duration}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Subtotal: </span>
                      <span className="text-gray-700">{selectedClient.subtotal}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">12% VAT: </span>
                      <span className="text-gray-700">{selectedClient.vat}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900 text-lg">TOTAL: </span>
                      <span className="text-gray-700 text-lg font-semibold">{selectedClient.total}</span>
                    </div>
                  </div>
                </div>

                {/* Sales Person */}
                <div className="border-t border-gray-200 pt-4">
                  <div>
                    <span className="font-semibold text-gray-900">Sales: </span>
                    <span className="text-gray-700">{selectedClient.sales}</span>
                  </div>
                </div>

                {/* OK Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setIsDialogOpen(false)}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 md:px-12 py-2 w-full sm:w-auto"
                    variant="outline"
                  >
                    OK
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Amount Breakdown Dialog */}
        <Dialog open={isAmountDialogOpen} onOpenChange={setIsAmountDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-lg h-[95vh] sm:max-h-[90vh] bg-white overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-left text-xl md:text-2xl font-semibold text-gray-900">Breakdown:</DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6 pt-4">
                {/* Item Breakdown */}
                <div className="space-y-4">
                  <div className="flex justify-between font-medium text-gray-900">
                    <div>Item</div>
                    <div>Amount</div>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <div>{formatCoverDates(selectedInvoice)}</div>
                    <div>{selectedInvoice.amount.toLocaleString()}</div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">VATable Sales:</div>
                    <div className="text-gray-700">{(selectedInvoice.amount / 1.12).toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">VAT (12%):</div>
                    <div className="text-gray-700">{selectedInvoice.vat_amount.toLocaleString()}</div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">Total Sales (VAT Inclusive):</div>
                    <div className="text-gray-700">{selectedInvoice.amount.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">Less VAT:</div>
                    <div className="text-gray-700">{selectedInvoice.vat_amount.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">Amount Net of VAT:</div>
                    <div className="text-gray-700">{(selectedInvoice.amount / 1.12).toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">Add VAT:</div>
                    <div className="text-gray-700">{selectedInvoice.vat_amount.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-gray-700 font-medium">Less Withholding Tax:</div>
                    <div className="text-gray-700">{(selectedInvoice.with_holding_tax || 0).toLocaleString()}</div>
                  </div>
                </div>

                {/* Total Amount Due */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="bg-green-100 rounded-lg p-4">
                    <div className="flex justify-between">
                      <div className="text-gray-900 font-bold text-base md:text-lg">TOTAL AMOUNT DUE:</div>
                      <div className="text-gray-900 font-bold text-base md:text-lg">
                        {(selectedInvoice.amount - (selectedInvoice.with_holding_tax || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* OK Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setIsAmountDialogOpen(false)}
                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 md:px-12 py-2 w-full sm:w-auto"
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
          <DialogContent className="w-[95vw] sm:max-w-4xl bg-white max-h-[90vh] overflow-y-auto">

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
    </div>
  )
}