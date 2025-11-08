"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, FileText, CheckCircle, ArrowLeft, Package } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { getQuotationsForSelection } from "@/lib/job-order-service"
import type { Quotation } from "@/lib/types/quotation"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function SelectQuotationPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get("productId")

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchQuotations = async () => {
      if (!userData?.uid) {
        toast({
          title: "Authentication Required",
          description: "Please log in to view quotations.",
          variant: "destructive",
        })
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const fetchedQuotations = await getQuotationsForSelection(userData.uid, userData.company_id || undefined, "reserved")
        const filteredByProduct = productId
          ? fetchedQuotations.filter((quotation) => {
              if (quotation.product_id === productId) return true
              if (quotation.items && quotation.items.product_id === productId) {
                return true
              }
              return false
            })
          : fetchedQuotations
        setQuotations(filteredByProduct)
      } catch (error) {
        console.error("Error fetching quotations:", error)
        toast({
          title: "Error",
          description: "Failed to load quotations. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchQuotations()
  }, [userData?.uid, userData?.company_id, toast, productId])

  const filteredQuotations = quotations.filter(
    (q) =>
      q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.items?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.items?.site_code?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSelect = (quotation: Quotation) => {
    router.push(`/sales/job-orders/create?quotationId=${quotation.id}`)
  }

  const getProductCount = (quotation: Quotation): number => {
    return 1 // Single product
  }

  const getProductNames = (quotation: Quotation): string => {
    if (quotation.items && quotation.items.name) {
      return quotation.items.name
    }
    return "N/A"
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {productId ? "Select Quotation for This Product" : "Select Quotation for Job Order"}
        </h1>
      </div>

      <Card className="flex-1 flex flex-col p-6">
        <div className="relative mb-4">
          <Input
            placeholder="Search quotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No quotations found.
            {searchTerm && ` for "${searchTerm}"`}
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Products/Site</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotations.map((quotation) => (
                  <TableRow
                    key={quotation.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSelect(quotation)}
                  >
                    <TableCell className="font-semibold">
                      {quotation.quotation_number}
                    </TableCell>
                    <TableCell>{quotation.client_name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      Site: {getProductNames(quotation)}
                    </TableCell>
                    <TableCell>
                      {quotation.created_by_first_name || quotation.created_by_last_name
                        ? `${quotation.created_by_first_name || ""} ${quotation.created_by_last_name || ""}`.trim()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={quotation.status === "reserved" ? "default" : "secondary"}>
                        {quotation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {quotation.created ? new Date(quotation.created.seconds * 1000).toLocaleDateString() : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </Card>
    </div>
  )
}
