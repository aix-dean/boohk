"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft,
  Plus,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Calculator,
  FileText,
  Mail,
  Calendar,
  User,
} from "lucide-react"
import { getCostEstimatesByProposalId } from "@/lib/cost-estimate-service"
import { getProposalById } from "@/lib/proposal-service"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import type { Proposal } from "@/lib/types/proposal"
import { useToast } from "@/hooks/use-toast"

export default function ProposalCostEstimatesPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [costEstimates, setCostEstimates] = useState<CostEstimate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (params.id) {
        try {
          const [proposalData, estimates] = await Promise.all([
            getProposalById(params.id as string),
            getCostEstimatesByProposalId(params.id as string),
          ])
          setProposal(proposalData)
          setCostEstimates(estimates)
        } catch (error) {
          console.error("Error fetching data:", error)
          toast({
            title: "Error",
            description: "Failed to load cost estimates",
            variant: "destructive",
          })
        } finally {
          setLoading(false)
        }
      }
    }

    fetchData()
  }, [params.id, toast])

  const getStatusConfig = (status: CostEstimate["status"]) => {
    switch (status) {
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

  const handleViewCostEstimate = (costEstimateId: string) => {
    router.push(`/sales/cost-estimates/${costEstimateId}`)
  }

  const handleCreateCostEstimate = () => {
    router.push(`/sales/proposals/${params.id}/create-cost-estimate`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
              <div className="h-32 bg-gray-200 rounded-lg"></div>
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/sales/proposals/${params.id}`)}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Proposal
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cost Estimates</h1>
                <p className="text-gray-600">{proposal.title}</p>
              </div>
            </div>
            <Button onClick={handleCreateCostEstimate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Cost Estimate
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Estimates</p>
                  <p className="text-2xl font-bold text-gray-900">{costEstimates.length}</p>
                </div>
                <Calculator className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {costEstimates.filter((e) => e.status === "approved").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {costEstimates.filter((e) => e.status === "sent" || e.status === "viewed").length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Latest Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {costEstimates.length > 0 ? `${costEstimates[0].totalAmount.toLocaleString()}` : "0"}
                  </p>
                </div>
                <div className="text-xs text-gray-500 font-medium">AMOUNT</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Estimates List */}
        {costEstimates.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Calculator className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Cost Estimates</h3>
                <p className="text-gray-600 mb-6">No cost estimates have been created for this proposal yet.</p>
                <Button onClick={handleCreateCostEstimate} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Cost Estimate
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {costEstimates.map((estimate) => {
              const statusConfig = getStatusConfig(estimate.status)

              return (
                <Card key={estimate.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">{estimate.title}</h3>
                        <Badge className={`${statusConfig.color} border font-medium px-3 py-1`}>
                          {statusConfig.icon}
                          <span className="ml-1.5">{statusConfig.label}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewCostEstimate(estimate.id)}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-300 hover:bg-gray-50">
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center text-gray-600">
                        <div>
                          <p className="text-sm text-gray-500">Total Amount</p>
                          <p className="font-semibold">{estimate.totalAmount.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Created</p>
                          <p className="font-medium">{estimate.createdAt.toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <FileText className="h-4 w-4 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Line Items</p>
                          <p className="font-medium">{estimate.lineItems.length} items</p>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <User className="h-4 w-4 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Created By</p>
                          <p className="font-medium">{estimate.createdBy || "Unknown"}</p>
                        </div>
                      </div>
                    </div>

                    {estimate.notes && (
                      <div className="mb-4 p-3 bg-gray-50 rounded border">
                        <p className="text-sm text-gray-700">{estimate.notes}</p>
                      </div>
                    )}

                    {estimate.status === "approved" && estimate.approvedAt && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm text-green-700">
                          <CheckCircle className="h-4 w-4 inline mr-1" />
                          Approved on {estimate.approvedAt.toLocaleDateString()}
                          {estimate.approvedBy && ` by ${estimate.approvedBy}`}
                        </p>
                      </div>
                    )}

                    {estimate.status === "rejected" && estimate.rejectedAt && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-700">
                          <XCircle className="h-4 w-4 inline mr-1" />
                          Rejected on {estimate.rejectedAt.toLocaleDateString()}
                          {estimate.rejectedBy && ` by ${estimate.rejectedBy}`}
                        </p>
                        {estimate.rejectionReason && (
                          <p className="text-sm text-red-600 mt-1">
                            <strong>Reason:</strong> {estimate.rejectionReason}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
