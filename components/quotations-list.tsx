"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { FileText, Eye, CheckCircle, XCircle, Clock, Send } from "lucide-react"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton" // Import Skeleton component
import { getQuotationsByCreatedBy, type Quotation } from "@/lib/quotation-service"
import { useToast } from "@/hooks/use-toast"

interface QuotationsListProps {
  userId: string
}

export function QuotationsList({ userId }: QuotationsListProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchQuotations() {
      if (!userId) return

      try {
        setLoading(true)
        const fetchedQuotations = await getQuotationsByCreatedBy(userId)
        setQuotations(fetchedQuotations)
      } catch (error) {
        console.error("Error fetching quotations:", error)
        toast({
          title: "Error",
          description: "Failed to load quotations.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchQuotations()
  }, [userId, toast])

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "MMM d, yyyy")
      }
      if (typeof date === "string" || typeof date === "number") {
        return format(new Date(date), "MMM d, yyyy")
      }
      return "Invalid date"
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusConfig = (status: Quotation["status"]) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Draft",
        }
      case "sent":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Send className="h-3.5 w-3.5" />,
          label: "Sent",
        }
      case "viewed":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Eye className="h-3.5 w-3.5" />,
          label: "Viewed",
        }
      case "accepted":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Accepted",
        }
      case "rejected":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: "Rejected",
        }
      case "expired":
        return {
          color: "bg-orange-100 text-orange-800 border-orange-200",
          icon: <Clock className="h-3.5 w-3.5" />,
          label: "Expired",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Unknown",
        }
    }
  }

  return (
    <div className="overflow-x-auto">
      {loading ? (
        <Card className="border-gray-200 shadow-sm rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3">Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Quotation No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Client</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Product</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Duration</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Status</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(5) // Display 5 skeleton rows
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i} className="border-b border-gray-100">
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      ) : quotations.length === 0 ? (
        <Card className="border-gray-200 shadow-sm rounded-xl">
          <CardContent className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No quotations yet</h3>
            <p className="text-gray-600 mb-6">Create your first quotation to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 shadow-sm overflow-hidden rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3">Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Quotation No.</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Client</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Product</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Duration</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Status</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((quotation) => {
                const statusConfig = getStatusConfig(quotation.status)
                return (
                  <TableRow
                    key={quotation.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    onClick={() => {
                      console.log("Navigating to quotation:", `/sales/quotations/${quotation.id}`)
                      router.push(`/sales/quotations/${quotation.id}`)
                    }}
                  >
                    <TableCell className="font-medium py-3">{formatDate(quotation.created)}</TableCell>
                    <TableCell className="py-3">{quotation.quotation_number}</TableCell>
                    <TableCell className="py-3">{quotation.client_name}</TableCell>
                    <TableCell className="py-3">
                      {quotation.product_name} ({quotation.product_location})
                    </TableCell>
                    <TableCell className="py-3">
                      {formatDate(quotation.start_date)} - {formatDate(quotation.end_date)}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`${statusConfig.color} border font-medium`}>
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">₱{quotation.total_amount?.toLocaleString() || "N/A"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
