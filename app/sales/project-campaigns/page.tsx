"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle,
  Eye,
  Building2,
  Calendar,
  Plus,
  AlertCircle,
  BarChart3,
  DollarSign,
  Activity,
} from "lucide-react"
import { format } from "date-fns"
import { getCampaignsByUserId } from "@/lib/campaign-service"
import type { Campaign } from "@/lib/types/campaign"
import { useResponsive } from "@/hooks/use-responsive"

function CampaignsPageContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { user } = useAuth()
  const router = useRouter()
  const { isMobile } = useResponsive()

  useEffect(() => {
    if (user?.uid) {
      loadCampaigns()
    } else {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    filterCampaigns()
  }, [campaigns, searchTerm, statusFilter])

  const loadCampaigns = async () => {
    if (!user?.uid) return

    setLoading(true)
    try {
      const userCampaigns = await getCampaignsByUserId(user.uid)
      setCampaigns(userCampaigns || [])
    } catch (error) {
      console.error("Error loading campaigns:", error)
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  const filterCampaigns = () => {
    if (!campaigns || campaigns.length === 0) {
      setFilteredCampaigns([])
      return
    }

    let filtered = [...campaigns]

    if (searchTerm) {
      filtered = filtered.filter(
        (campaign) =>
          campaign.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          campaign.client?.company?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((campaign) => campaign.status === statusFilter)
    }

    setFilteredCampaigns(filtered)
  }

  const getStatusConfig = (status: Campaign["status"]) => {
    switch (status) {
      case "proposal_draft":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock, label: "Draft" }
      case "proposal_sent":
        return { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Eye, label: "Proposal Sent" }
      case "proposal_accepted":
        return {
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle,
          label: "Proposal Accepted",
        }
      case "cost_estimate_pending":
        return { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Cost Estimate Pending" }
      case "quotation_sent":
        return { color: "bg-purple-50 text-purple-700 border-purple-200", icon: Eye, label: "Quotation Sent" }
      case "booking_confirmed":
        return { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Booking Confirmed" }
      case "campaign_active":
        return { color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: TrendingUp, label: "Active" }
      case "campaign_completed":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: CheckCircle, label: "Completed" }
      default:
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock, label: "Unknown" }
    }
  }

  const getStats = () => {
    const total = campaigns?.length || 0
    const active =
      campaigns?.filter((c) => ["campaign_active", "booking_confirmed", "proposal_accepted"].includes(c.status))
        ?.length || 0
    const completed = campaigns?.filter((c) => c.status === "campaign_completed")?.length || 0
    const totalValue =
      campaigns?.reduce((sum, c) => {
        const amount = c.finalAmount || c.quotationAmount || c.proposalAmount || c.totalAmount || 0
        return sum + amount
      }, 0) || 0

    return { total, active, completed, totalValue }
  }

  const handleViewCampaign = (campaignId: string) => {
    router.push(`/sales/project-campaigns/${campaignId}`)
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return "N/A"
    try {
      return format(date, "MMM d, yyyy")
    } catch (error) {
      return "Invalid Date"
    }
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Project Campaign Management</h1>
              <p className="text-lg text-gray-600">
                Track and manage your project campaigns from proposal to completion
              </p>
            </div>
          </div>

          {/* Enhanced Filters */}
          <Card className="border shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search project campaigns, clients, or descriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-56 h-12 border-gray-200 bg-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="proposal_draft">Draft</SelectItem>
                      <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                      <SelectItem value="proposal_accepted">Proposal Accepted</SelectItem>
                      <SelectItem value="cost_estimate_pending">Cost Estimate Pending</SelectItem>
                      <SelectItem value="quotation_sent">Quotation Sent</SelectItem>
                      <SelectItem value="booking_confirmed">Booking Confirmed</SelectItem>
                      <SelectItem value="campaign_active">Active</SelectItem>
                      <SelectItem value="campaign_completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns List */}
        {!filteredCampaigns || filteredCampaigns.length === 0 ? (
          <Card className="border shadow-sm bg-white">
            <CardContent className="text-center py-20">
              <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                {searchTerm || statusFilter !== "all" ? "No project campaigns found" : "No project campaigns yet"}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria to find what you're looking for"
                  : "Create your first project campaign to start tracking your sales pipeline"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button
                  onClick={() => router.push("/sales/dashboard")}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
                  size="lg"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Project Campaign
                </Button>
              )}
            </CardContent>
          </Card>
        ) : isMobile ? (
          // Enhanced Mobile Card View
          <div className="space-y-4">
            {filteredCampaigns.map((campaign) => {
              const statusConfig = getStatusConfig(campaign.status)
              const StatusIcon = statusConfig.icon

              return (
                <Card
                  key={campaign.id}
                  className="border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
                >
                  <CardContent className="p-6" onClick={() => handleViewCampaign(campaign.id)}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-1">{campaign.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">{campaign.client?.company || "Unknown Company"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={`${statusConfig.color} border font-medium px-3 py-1`}>
                          <StatusIcon className="mr-2 h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(campaign.createdAt)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">
                          ₱
                          {(
                            campaign.finalAmount ||
                            campaign.quotationAmount ||
                            campaign.proposalAmount ||
                            campaign.totalAmount ||
                            0
                          ).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {campaign.products?.length || 0} product{(campaign.products?.length || 0) !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          // Enhanced Desktop Table View
          <Card className="border shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="font-bold text-gray-900 py-4">Project Campaign</TableHead>
                  <TableHead className="font-bold text-gray-900">Client</TableHead>
                  <TableHead className="font-bold text-gray-900">Status</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Products</TableHead>
                  <TableHead className="font-bold text-gray-900 text-right">Amount</TableHead>
                  <TableHead className="font-bold text-gray-900">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => {
                  const statusConfig = getStatusConfig(campaign.status)
                  const StatusIcon = statusConfig.icon

                  return (
                    <TableRow
                      key={campaign.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 group"
                      onClick={() => handleViewCampaign(campaign.id)}
                    >
                      <TableCell className="py-6">
                        <div>
                          <div className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                            {campaign.title}
                          </div>
                          <div className="text-sm text-gray-500">ID: {campaign.id.slice(0, 8)}...</div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{campaign.client?.company || "Unknown"}</div>
                            <div className="text-sm text-gray-500">
                              {campaign.client?.contactPerson || "Unknown Contact"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <Badge variant="outline" className={`${statusConfig.color} border font-medium px-3 py-1`}>
                          <StatusIcon className="mr-2 h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="font-bold text-gray-900 text-lg">{campaign.products?.length || 0}</div>
                          <div className="text-xs text-gray-500">
                            product{(campaign.products?.length || 0) !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-right">
                        <div className="font-bold text-gray-900 text-lg">
                          ₱
                          {(
                            campaign.finalAmount ||
                            campaign.quotationAmount ||
                            campaign.proposalAmount ||
                            campaign.totalAmount ||
                            0
                          ).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(campaign.createdAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  return <CampaignsPageContent />
}
