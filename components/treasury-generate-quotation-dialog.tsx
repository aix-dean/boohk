"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import {
  createQuotation,
  generateQuotationNumber,
  calculateQuotationTotal,
  type QuotationProduct,
} from "@/lib/quotation-service"
import { getAllClients, type Client } from "@/lib/client-service"
import { getProducts, type Product } from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface TreasuryGenerateQuotationDialogProps {
  isOpen: boolean
  onClose: () => void
  onQuotationCreated: (quotationId: string) => void
  initialClientId?: string
  initialProductIds?: string[]
}

export function TreasuryGenerateQuotationDialog({
  isOpen,
  onClose,
  onQuotationCreated,
  initialClientId,
  initialProductIds,
}: TreasuryGenerateQuotationDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds || [])
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [validUntil, setValidUntil] = useState<Date | undefined>(() => {
    const today = new Date()
    today.setDate(today.getDate() + 5) // Default to 5 days from now
    return today
  })
  const [notes, setNotes] = useState("")
  const [totalAmount, setTotalAmount] = useState(0)
  const [durationDays, setDurationDays] = useState(0)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const fetchedClients = await getAllClients()
        setClients(fetchedClients)

        const fetchedProducts = await getProducts()
        setProducts(fetchedProducts)

        if (initialClientId) {
          const client = fetchedClients.find((c) => c.id === initialClientId)
          if (client) {
            setSelectedClient(client)
          }
        }
      } catch (error) {
        console.error("Error fetching data for quotation dialog:", error)
        toast({
          title: "Error",
          description: "Failed to load clients or products.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, initialClientId, toast])

  useEffect(() => {
    if (startDate && endDate && selectedProductIds.length > 0) {
      const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id))
      const quotationProducts: QuotationProduct[] = selectedProducts.map((p) => ({
        product_id: p.id,
        name: p.name,
        location: p.location,
        price: p.price || 0,
        site_code: p.site_code,
        type: p.type,
        description: p.description,
        health_percentage: p.health_percentage,
        light: p.light,
        media: p.media,
        specs_rental: p.specs_rental,
        media_url: p.media && p.media.length > 0 ? p.media[0].url : undefined,
        duration_days: 0, // Will be calculated by service
        item_total_amount: 0, // Will be calculated by service
      }))

      const { durationDays, totalAmount } = calculateQuotationTotal(
        startDate.toISOString(),
        endDate.toISOString(),
        quotationProducts,
      )
      setDurationDays(durationDays)
      setTotalAmount(totalAmount)
    } else {
      setDurationDays(0)
      setTotalAmount(0)
    }
  }, [startDate, endDate, selectedProductIds, products])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient || selectedProductIds.length === 0 || !startDate || !endDate || !validUntil) {
      toast({
        title: "Missing Information",
        description: "Please select a client, at least one product, and valid dates.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const quotationNumber = generateQuotationNumber()
      const selectedProducts = products.filter((p) => selectedProductIds.includes(p.id))

      const quotationProducts: QuotationProduct[] = selectedProducts.map((p) => ({
        product_id: p.id,
        name: p.name,
        location: p.location,
        price: p.price || 0,
        site_code: p.site_code,
        type: p.type,
        description: p.description,
        health_percentage: p.health_percentage,
        light: p.light,
        media: p.media,
        specs_rental: p.specs_rental,
        media_url: p.media && p.media.length > 0 ? p.media[0].url : undefined,
        duration_days: 0, // Will be calculated by service
        item_total_amount: 0, // Will be calculated by service
      }))

      const { durationDays: calculatedDurationDays, totalAmount: calculatedTotalAmount } = calculateQuotationTotal(
        startDate.toISOString(),
        endDate.toISOString(),
        quotationProducts,
      )

      const newQuotationData = {
        quotation_number: quotationNumber,
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_designation: selectedClient.designation || "",
        client_address: selectedClient.address || "",
        client_phone: selectedClient.phone || "",
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        valid_until: validUntil.toISOString(),
        total_amount: calculatedTotalAmount,
        duration_days: calculatedDurationDays,
        notes: notes,
        status: "draft", // Default status
        created_by: user?.uid || "unknown",
        created_by_first_name: user?.displayName?.split(" ")[0] || "Unknown",
        created_by_last_name: user?.displayName?.split(" ").slice(1).join(" ") || "",
        seller_id: user?.uid || "unknown",
        items: quotationProducts,
      }

      const quotationId = await createQuotation(newQuotationData)
      toast({
        title: "Success",
        description: `Treasury quotation ${quotationNumber} created successfully!`,
      })
      onQuotationCreated(quotationId)
      onClose()
    } catch (error) {
      console.error("Error creating treasury quotation:", error)
      toast({
        title: "Error",
        description: "Failed to create treasury quotation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate New Treasury Quotation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="client" className="text-right">
              Client
            </Label>
            <Select
              onValueChange={(clientId) => setSelectedClient(clients.find((c) => c.id === clientId) || null)}
              value={selectedClient?.id || ""}
              disabled={loading}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company} ({client.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="products" className="text-right">
              Products
            </Label>
            <Select
              onValueChange={(productId) => {
                setSelectedProductIds((prev) =>
                  prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
                )
              }}
              value={selectedProductIds[0] || ""}
              disabled={loading}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select products" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.location})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedProductIds.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-span-1"></div>
              <div className="col-span-3 flex flex-wrap gap-2">
                {selectedProductIds.map((id) => {
                  const product = products.find((p) => p.id === id)
                  return (
                    <Badge key={id} variant="secondary" className="flex items-center gap-1">
                      {product?.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0.5"
                        onClick={() => setSelectedProductIds((prev) => prev.filter((pid) => pid !== id))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startDate" className="text-right">
              Start Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endDate" className="text-right">
              End Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("col-span-3 justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="validUntil" className="text-right">
              Valid Until
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !validUntil && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {validUntil ? format(validUntil, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={validUntil} onSelect={setValidUntil} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3"
              placeholder="Any additional notes for the quotation"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Duration</Label>
            <div className="col-span-3 text-lg font-semibold">{durationDays} day(s)</div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Total Amount</Label>
            <div className="col-span-3 text-xl font-bold text-blue-600">₱{totalAmount.toLocaleString()}</div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                "Generate Treasury Quotation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
