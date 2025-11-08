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
import { getAllClients, type Client } from "@/lib/client-service" // Import getAllClients and Client type
import { getProducts, type Product } from "@/lib/firebase-service" // Import getProducts and Product type
import { useAuth } from "@/contexts/auth-context" // Import useAuth
import { X } from "lucide-react" // Import X for product removal button
import { Badge } from "@/components/ui/badge" // Import Badge for displaying selected products

interface GenerateQuotationDialogProps {
  isOpen: boolean
  onClose: () => void
  onQuotationCreated: (quotationId: string) => void
  initialClientId?: string
  initialProductIds?: string[]
}

export function GenerateQuotationDialog({
  isOpen,
  onClose,
  onQuotationCreated,
  initialClientId,
  initialProductIds,
}: GenerateQuotationDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductIds?.[0] || "")
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
    if (startDate && endDate && selectedProductId) {
      const selectedProduct = products.find((p) => p.id === selectedProductId)
      if (selectedProduct) {
        const quotationProduct: QuotationProduct = {
          product_id: selectedProduct.id!,
          name: selectedProduct.name,
          location: selectedProduct.location || "",
          price: selectedProduct.price || 0,
          site_code: selectedProduct.site_code || "",
          type: selectedProduct.type || "",
          description: selectedProduct.description,
          health_percentage: selectedProduct.health_percentage,
          light: selectedProduct.light,
          media: selectedProduct.media,
          specs_rental: selectedProduct.specs_rental,
          media_url: selectedProduct.media && selectedProduct.media.length > 0 ? selectedProduct.media[0].url : undefined,
          duration_days: 0, // Will be calculated by service
          item_total_amount: 0, // Will be calculated by service
        }

        const { durationDays, totalAmount } = calculateQuotationTotal(
          startDate.toISOString(),
          endDate.toISOString(),
          quotationProduct,
        )
        setDurationDays(durationDays)
        setTotalAmount(totalAmount)
      } else {
        setDurationDays(0)
        setTotalAmount(0)
      }
    } else {
      setDurationDays(0)
      setTotalAmount(0)
    }
  }, [startDate, endDate, selectedProductId, products])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient || !selectedProductId || !startDate || !endDate || !validUntil) {
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
      const selectedProduct = products.find((p) => p.id === selectedProductId)
      if (!selectedProduct) {
        throw new Error("Selected product not found")
      }

      const quotationProduct: QuotationProduct = {
        product_id: selectedProduct.id!,
        name: selectedProduct.name,
        location: selectedProduct.location || "",
        price: selectedProduct.price || 0,
        site_code: selectedProduct.site_code || "",
        type: selectedProduct.type || "",
        description: selectedProduct.description,
        health_percentage: selectedProduct.health_percentage,
        light: selectedProduct.light,
        media: selectedProduct.media,
        specs_rental: selectedProduct.specs_rental,
        media_url: selectedProduct.media && selectedProduct.media.length > 0 ? selectedProduct.media[0].url : undefined,
        duration_days: 0, // Will be calculated by service
        item_total_amount: 0, // Will be calculated by service
      }

      const { durationDays: calculatedDurationDays, totalAmount: calculatedTotalAmount } = calculateQuotationTotal(
        startDate.toISOString(),
        endDate.toISOString(),
        quotationProduct,
      )

      const newQuotationData = {
        quotation_number: quotationNumber,
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        client_designation: selectedClient.designation || "", // Include designation
        client_address: selectedClient.address || "", // Include address
        client_phone: selectedClient.phone || "", // Include phone
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        valid_until: validUntil.toISOString(),
        total_amount: calculatedTotalAmount,
        duration_days: calculatedDurationDays,
        notes: notes,
        status: "draft" as const, // Default status
        created_by: user?.uid || "unknown",
        created_by_first_name: user?.displayName?.split(" ")[0] || "Unknown",
        created_by_last_name: user?.displayName?.split(" ").slice(1).join(" ") || "",
        seller_id: user?.uid || "unknown", // Assuming seller_id is the current user's ID
        items: quotationProduct,
        created: new Date().toISOString(),
      }

      const quotationId = await createQuotation(newQuotationData)
      toast({
        title: "Success",
        description: `Quotation ${quotationNumber} created successfully!`,
      })
      onQuotationCreated(quotationId)
      onClose()
    } catch (error) {
      console.error("Error creating quotation:", error)
      toast({
        title: "Error",
        description: "Failed to create quotation. Please try again.",
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
          <DialogTitle>Generate New Quotation</DialogTitle>
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
              onValueChange={(productId) => setSelectedProductId(productId)}
              value={selectedProductId}
              disabled={loading}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select products" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id!} value={product.id!}>
                    {product.name} ({product.location})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                "Generate Quotation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
