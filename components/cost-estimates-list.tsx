"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calculator, FileText, Eye, CheckCircle, XCircle, Clock, Mail } from "lucide-react"
import { getCostEstimatesByProposalId, getCostEstimatesByCreatedBy } from "@/lib/cost-estimate-service"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import { useToast } from "@/hooks/use-toast"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface CostEstimatesListProps {
  proposalId?: string
  userId?: string
}

export function CostEstimatesList({ proposalId, userId }: CostEstimatesListProps) {
  const [costEstimates, setCostEstimates] = useState<CostEstimate[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    async function fetchCostEstimates() {
      try {
        setLoading(true)
        let estimates: CostEstimate[] = []
        if (proposalId) {
          estimates = await getCostEstimatesByProposalId(proposalId)
        } else if (userId) {
          estimates = await getCostEstimatesByCreatedBy(userId)
        }
        setCostEstimates(estimates)
      } catch (error) {
        console.error("Error fetching cost estimates:", error)
        toast({
          title: "Error",
          description: "Failed to load cost estimates",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (proposalId || userId) {
      fetchCostEstimates()
    }
  }, [proposalId, userId, toast])

  const getStatusConfig = (status: CostEstimate["status"]) => {
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
          icon: <Mail className="h-3.5 w-3.5" />,
          label: "Sent",
        }
      case "viewed":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: <Eye className="h-3.5 w-3.5" />,
          label: "Viewed",
        }
      case "approved":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Approved",
        }
      case "rejected":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: "Rejected",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <Clock className="h-3.5 w-3.5" />,
          label: "Unknown",
        }
    }
  }

  const formatDate = (date: Date | string | any) => {
    if (!date) return "N/A"
    try {
      if (date instanceof Date) {
        return format(date, "MMM d, yyyy")
      }
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "MMM d, yyyy")
      }
      if (typeof date === "string") {
        return format(new Date(date), "MMM d, yyyy")
      }
      return "Invalid date"
    } catch (error) {
      return "Invalid date"
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="border-gray-200 shadow-sm rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3">Title</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Total Amount</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Status</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Line Items</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i} className="border-b border-gray-100">
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      ) : costEstimates.length === 0 ? (
        <Card className="border-gray-200 shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Calculator className="h-5 w-5 mr-2" />
              Cost Estimates
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calculator className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Cost Estimates</h3>
            <p className="text-gray-600 mb-4">No cost estimates have been created yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 shadow-sm overflow-hidden rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3">Title</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Date</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Total Amount</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Status</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Line Items</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costEstimates.map((estimate) => {
                const statusConfig = getStatusConfig(estimate.status)
                return (
                  <TableRow
                    key={estimate.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    onClick={() => router.push(`/sales/cost-estimates/${estimate.id}`)}
                  >
                    <TableCell className="font-medium py-3">{estimate.title}</TableCell>
                    <TableCell className="py-3">{formatDate(estimate.createdAt)}</TableCell>
                    <TableCell className="py-3">₱{estimate.totalAmount?.toLocaleString() || "N/A"}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`${statusConfig.color} border font-medium`}>
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">{estimate.lineItems.length}</TableCell>
                    <TableCell className="max-w-[200px] truncate py-3">{estimate.notes || "N/A"}</TableCell>
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
