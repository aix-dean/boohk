"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowLeft, CalendarIcon, FileText, Loader2, Save, Send, Printer, Download, Eye } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getProposalById } from "@/lib/proposal-service"
import { createQuotation, generateQuotationNumber, calculateQuotationTotal } from "@/lib/quotation-service"
import type { Proposal } from "@/lib/types/proposal"
import { useToast } from "@/hooks/use-toast"

export default function GenerateQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Form state
  const [quotationNumber] = useState(generateQuotationNumber())
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [customPrice, setCustomPrice] = useState<string>("")
  const [useCustomPrice, setUseCustomPrice] = useState(false)
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<"draft" | "sent">("draft")

  useEffect(() => {
    async function fetchProposal() {
      if (params.id) {
        try {
          const proposalData = await getProposalById(params.id as string)
          setProposal(proposalData)

          // Set default values
          if (proposalData.products.length > 0) {
            setSelectedProductIds(proposalData.products.map((p) => p.id))
            // Set custom price for first product as reference
            setCustomPrice(proposalData.products[0].price.toString())
          }

          // Set default dates (30 days from now)
          const start = new Date()
          const end = new Date()
          end.setDate(start.getDate() + 30)
          setStartDate(start)
          setEndDate(end)

          // Set default notes from proposal
          if (proposalData.notes || proposalData.customMessage) {
            const combinedNotes = [
              proposalData.notes && `Internal Notes: ${proposalData.notes}`,
              proposalData.customMessage && `Custom Message: ${proposalData.customMessage}`,
            ]
              .filter(Boolean)
              .join("\n\n")
            setNotes(combinedNotes)
          }
        } catch (error) {
          console.error("Error fetching proposal:", error)
          toast({
            title: "Error",
            description: "Failed to load proposal details",
            variant: "destructive",
          })
        } finally {
          setLoading(false)
        }
      }
    }

    fetchProposal()
  }, [params.id, toast])

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId)
      } else {
        return [...prev, productId]
      }
    })
  }

  const selectedProducts = proposal?.products.filter((p) => selectedProductIds.includes(p.id)) || []

  const { durationDays, totalAmount } =
    startDate && endDate
      ? calculateQuotationTotal(startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0], 1)
      : { durationDays: 0, totalAmount: 0 }

  const finalPrice = useCustomPrice
    ? Number.parseFloat(customPrice) || 0
    : selectedProducts.length > 0
      ? selectedProducts[0].price
      : 0

  const grandTotal = selectedProducts.reduce((total, product) => {
    const productPrice = useCustomPrice ? Number.parseFloat(customPrice) || 0 : product.price
    return total + durationDays * productPrice
  }, 0)

  const handleGenerate = async () => {
    if (!proposal || selectedProductIds.length === 0 || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select at least one product and fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setGenerating(true)
    try {
      const quotationPromises = selectedProducts.map(async (product) => {
        const productPrice = useCustomPrice ? Number.parseFloat(customPrice) || 0 : product.price
        const productTotal = durationDays * productPrice

        const quotationData = {
          quotation_number: `${quotationNumber}-${product.id.slice(-4)}`,
          product_id: product.id,
          product_name: product.name,
          product_location: product.location,
          site_code: product.site_code,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          price: productPrice,
          total_amount: productTotal,
          duration_days: durationDays,
          notes: notes,
          status: status,
          created_by: "current_user",
          client_name: proposal.client.contactPerson,
          client_email: proposal.client.email,
          campaignId: proposal.campaignId, // Include campaign ID from proposal
          proposalId: proposal.id, // Include proposal ID
        }

        return await createQuotation(quotationData)
      })

      await Promise.all(quotationPromises)

      toast({
        title: "Quotations Generated Successfully!",
        description: `${selectedProducts.length} quotation(s) have been created.`,
      })

      // Navigate back to proposals
      router.push(`/sales/proposals/${params.id}`)
    } catch (error) {
      console.error("Error generating quotations:", error)
      toast({
        title: "Error",
        description: "Failed to generate quotations. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="bg-white rounded-lg shadow-sm p-8 space-y-4">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Proposal Not Found</h1>
          <p className="text-gray-600 mb-6">The proposal you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => router.push("/sales/proposals")} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Proposals
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Word-style Toolbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/sales/proposals/${params.id}`)}
                className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="h-4 sm:h-6 w-px bg-gray-300" />
              <div className="hidden md:flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 text-xs">
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 text-xs">
                  <Printer className="h-3 w-3 mr-1" />
                  Print
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Select value={status} onValueChange={(value: "draft" | "sent") => setStatus(value)}>
                <SelectTrigger className="w-20 sm:w-32 h-7 sm:h-8 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Send</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerate}
                disabled={generating || selectedProductIds.length === 0 || !startDate || !endDate}
                className="bg-blue-600 hover:bg-blue-700 h-7 sm:h-8 px-2 sm:px-4 text-xs sm:text-sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span className="hidden sm:inline">Generating...</span>
                    <span className="sm:hidden">Gen...</span>
                  </>
                ) : status === "sent" ? (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Generate & Send</span>
                    <span className="sm:hidden">Send</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Generate</span>
                    <span className="sm:hidden">Gen</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Container */}
      <div className="max-w-5xl mx-auto p-2 sm:p-4 lg:p-8">
        <div
          className="bg-white rounded-lg shadow-lg min-h-screen sm:min-h-[11in] p-4 sm:p-8 lg:p-12"
          style={{ fontFamily: "Calibri, sans-serif" }}
        >
          {/* Document Header */}
          <div className="text-center mb-6 sm:mb-8 pb-4 sm:pb-6 border-b-2 border-blue-600">
            <div className="flex items-center justify-center mb-3 sm:mb-4">
              <img src="/oh-plus-logo.png" alt="OH Plus Logo" className="h-8 sm:h-10 lg:h-12 w-auto" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">QUOTATION</h1>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600">Digital Billboard Rental Services</p>
          </div>

          {/* Quotation Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 border-b border-gray-300 pb-2">
                Quotation Details
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-gray-700 sm:w-32 text-sm sm:text-base">Quotation No:</span>
                  <span className="text-gray-900 font-mono text-sm sm:text-base">{quotationNumber}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-gray-700 sm:w-32 text-sm sm:text-base">Date:</span>
                  <span className="text-gray-900 text-sm sm:text-base">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-gray-700 sm:w-32 text-sm sm:text-base">Valid Until:</span>
                  <span className="text-gray-900 text-sm sm:text-base">{proposal.validUntil.toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-gray-700 sm:w-32 text-sm sm:text-base">Reference:</span>
                  <span className="text-gray-900 text-sm sm:text-base break-words">{proposal.title}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 border-b border-gray-300 pb-2">
                Bill To
              </h3>
              <div className="space-y-1 sm:space-y-2">
                <div className="font-semibold text-gray-900 text-sm sm:text-base">{proposal.client.company}</div>
                <div className="text-gray-700 text-sm sm:text-base">{proposal.client.contactPerson}</div>
                <div className="text-gray-700 text-sm sm:text-base break-words">{proposal.client.email}</div>
                <div className="text-gray-700 text-sm sm:text-base">{proposal.client.phone}</div>
                {proposal.client.address && (
                  <div className="text-gray-700 text-sm sm:text-base">{proposal.client.address}</div>
                )}
              </div>
            </div>
          </div>

          {/* Product Selection Section */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 border-b border-gray-300 pb-2">
              Available Products
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Please select a product for this quotation:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {proposal.products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => toggleProductSelection(product.id)}
                  className={cn(
                    "border-2 rounded-lg p-3 sm:p-4 cursor-pointer transition-all duration-200",
                    selectedProductIds.includes(product.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
                  )}
                >
                  {/* Selection indicator */}
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{product.name}</h4>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{product.location}</p>
                    </div>
                    <div className="text-right ml-2 sm:ml-4 flex-shrink-0">
                      <div className="text-sm sm:text-lg font-bold text-gray-900">
                        ₱{product.price.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">per day</div>
                    </div>
                    {selectedProductIds.includes(product.id) && (
                      <div className="ml-1 sm:ml-2 w-4 h-4 sm:w-5 sm:h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Product media */}
                  {product.media && product.media.length > 0 && (
                    <div className="mb-2 sm:mb-3">
                      <div className="w-full h-20 sm:h-24 bg-gray-100 rounded overflow-hidden">
                        {product.media[0].isVideo ? (
                          <video src={product.media[0].url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img
                            src={product.media[0].url || "/placeholder.svg"}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Product specs */}
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="flex items-center flex-wrap gap-1">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {product.type}
                      </span>
                      {product.site_code && <span className="text-gray-500 text-xs">Site: {product.site_code}</span>}
                    </div>

                    {product.specs_rental?.traffic_count && (
                      <div className="text-gray-600 text-xs">
                        Traffic: {product.specs_rental.traffic_count.toLocaleString()}/day
                      </div>
                    )}

                    {product.specs_rental?.height && product.specs_rental?.width && (
                      <div className="text-gray-600 text-xs">
                        Size: {product.specs_rental.height}m × {product.specs_rental.width}m
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Product Details */}
            {selectedProducts.length > 0 && (
              <div className="border border-gray-300 rounded-lg p-4 sm:p-6 bg-gray-50">
                <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">
                  Selected Product Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Product Name</div>
                    <div className="text-gray-900 break-words">{selectedProducts[0].name}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Type</div>
                    <div className="text-gray-900">{selectedProducts[0].type}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Location</div>
                    <div className="text-gray-900 break-words">{selectedProducts[0].location}</div>
                  </div>
                  {selectedProducts[0].site_code && (
                    <div>
                      <div className="font-medium text-gray-700">Site Code</div>
                      <div className="text-gray-900">{selectedProducts[0].site_code}</div>
                    </div>
                  )}
                </div>

                {selectedProducts[0].description && (
                  <div className="mt-3 sm:mt-4">
                    <div className="font-medium text-gray-700 mb-1 text-xs sm:text-sm">Description</div>
                    <div className="text-gray-900 text-xs sm:text-sm leading-relaxed">
                      {selectedProducts[0].description}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rental Period */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 border-b border-gray-300 pb-2">
              Rental Period & Pricing
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1 h-8 sm:h-10 text-xs sm:text-sm",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      {startDate ? format(startDate, "MMM dd, yyyy") : <span>Pick date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1 h-8 sm:h-10 text-xs sm:text-sm",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      {endDate ? format(endDate, "MMM dd, yyyy") : <span>Pick date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Duration</Label>
                <Input
                  value={`${durationDays} days`}
                  disabled
                  className="bg-gray-100 mt-1 h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Price per Day</Label>
                <div className="flex space-x-1 mt-1">
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={(e) => {
                      setCustomPrice(e.target.value)
                      setUseCustomPrice(true)
                    }}
                    className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedProducts.length > 0) {
                        setCustomPrice(selectedProducts[0].price.toString())
                        setUseCustomPrice(false)
                      }
                    }}
                    className="h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Summary Table */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 border-b border-gray-300 pb-2">
              Quotation Summary
            </h3>

            {/* Mobile Table */}
            <div className="block sm:hidden space-y-3">
              {proposal.products
                .filter((product) => selectedProductIds.includes(product.id))
                .map((product) => {
                  const productPrice = useCustomPrice ? Number.parseFloat(customPrice) || 0 : product.price
                  const productTotal = durationDays * productPrice
                  return (
                    <div key={product.id} className="border border-gray-300 rounded-lg p-3 bg-white">
                      <div className="font-medium text-gray-900 text-sm mb-1">{product.name}</div>
                      <div className="text-xs text-gray-600 mb-2">{product.location}</div>
                      {product.site_code && (
                        <div className="text-xs text-gray-500 mb-2">Site Code: {product.site_code}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-1 font-medium">{durationDays} days</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Rate/Day:</span>
                          <span className="ml-1 font-medium">₱{productPrice.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Total:</span>
                          <span className="font-bold text-sm">₱{productTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900 text-sm">TOTAL AMOUNT:</span>
                  <span className="font-bold text-lg text-blue-900">₱{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold text-gray-900 text-xs sm:text-sm">
                      Description
                    </th>
                    <th className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-900 text-xs sm:text-sm">
                      Duration
                    </th>
                    <th className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">
                      Rate/Day
                    </th>
                    <th className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-900 text-xs sm:text-sm">
                      Total Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.products
                    .filter((product) => selectedProductIds.includes(product.id))
                    .map((product) => {
                      const productPrice = useCustomPrice ? Number.parseFloat(customPrice) || 0 : product.price
                      const productTotal = durationDays * productPrice
                      return (
                        <tr key={product.id}>
                          <td className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3">
                            <div className="font-medium text-gray-900 text-xs sm:text-sm">{product.name}</div>
                            <div className="text-xs text-gray-600">{product.location}</div>
                            {product.site_code && (
                              <div className="text-xs text-gray-500">Site Code: {product.site_code}</div>
                            )}
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm">
                            {durationDays} days
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm">
                            ₱{productPrice.toLocaleString()}
                          </td>
                          <td className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-xs sm:text-sm">
                            ₱{productTotal.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50">
                    <td
                      colSpan={3}
                      className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-gray-900 text-xs sm:text-sm"
                    >
                      TOTAL AMOUNT:
                    </td>
                    <td className="border border-gray-300 px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-sm sm:text-xl text-blue-900">
                      ₱{grandTotal.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Terms and Notes */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 border-b border-gray-300 pb-2">
              Terms and Conditions
            </h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter terms, conditions, and additional notes..."
              rows={4}
              className="w-full border border-gray-300 rounded p-2 sm:p-3 text-xs sm:text-sm leading-relaxed"
              style={{ fontFamily: "Calibri, sans-serif" }}
            />
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-4 sm:pt-6 mt-8 sm:mt-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Contact Information</h4>
                <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                  <div>OH Plus Digital Solutions</div>
                  <div>Email: sales@ohplus.com</div>
                  <div>Phone: +63 (02) 8123-4567</div>
                  <div>Website: www.ohplus.com</div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Authorized By</h4>
                <div className="mt-4 sm:mt-8 border-b border-gray-400 w-32 sm:w-48 sm:ml-auto"></div>
                <div className="text-xs sm:text-sm text-gray-700 mt-2">Sales Manager</div>
                <div className="text-xs text-gray-500 mt-1">Date: {new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
