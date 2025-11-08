"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  User,
  Building,
  Phone,
  Mail,
  FileText,
  Calculator,
  Receipt,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  Activity,
  Eye,
  TrendingUp,
  Users,
  ChevronRight,
} from "lucide-react"
import { getCampaignById, getCampaignTimeline } from "@/lib/campaign-service"
import { getQuotationsByCampaignId } from "@/lib/quotation-service"
import type { Campaign } from "@/lib/types/campaign"
import type { Quotation } from "@/lib/quotation-service"
import { useToast } from "@/hooks/use-toast"

export default function CampaignDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaign()
  }, [params.id])

  const fetchCampaign = async () => {
    if (!params.id) return

    try {
      const campaignData = await getCampaignById(params.id as string)
      setCampaign(campaignData)

      // Fetch combined timeline
      if (campaignData) {
        const timeline = await getCampaignTimeline(params.id as string)
        setCampaign((prev) => (prev ? { ...prev, timeline } : null))

        // Fetch quotations
        const quotationsData = await getQuotationsByCampaignId(params.id as string)
        setQuotations(quotationsData)
      }
    } catch (error) {
      console.error("Error fetching campaign:", error)
      toast({
        title: "Error",
        description: "Failed to load campaign details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status: Campaign["status"]) => {
    switch (status) {
      case "proposal_draft":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText, label: "Draft" }
      case "proposal_sent":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Eye, label: "Proposal Sent" }
      case "proposal_accepted":
        return { color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle, label: "Proposal Accepted" }
      case "cost_estimate_pending":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Calculator, label: "Cost Estimate Pending" }
      case "cost_estimate_approved":
        return {
          color: "bg-green-100 text-green-700 border-green-200",
          icon: CheckCircle,
          label: "Cost Estimate Approved",
        }
      case "quotation_pending":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Receipt, label: "Quotation Pending" }
      case "quotation_sent":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: Receipt, label: "Quotation Sent" }
      case "quotation_accepted":
        return { color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle, label: "Quotation Accepted" }
      case "booking_confirmed":
        return {
          color: "bg-green-100 text-green-700 border-green-200",
          icon: BookOpen,
          label: "Booking Confirmed",
        }
      case "campaign_active":
        return { color: "bg-blue-100 text-blue-700 border-blue-200", icon: TrendingUp, label: "Active" }
      case "campaign_completed":
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: CheckCircle, label: "Completed" }
      case "campaign_cancelled":
        return { color: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle, label: "Cancelled" }
      default:
        return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle, label: "Unknown" }
    }
  }

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      const dateObj = date instanceof Date ? date : new Date(date)
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(dateObj)
    } catch (error) {
      return "Invalid Date"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-200 rounded-lg w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded-xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-48 bg-gray-200 rounded-lg"></div>
                <div className="h-64 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Campaign Not Found</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              The project campaign you're looking for doesn't exist or has been removed.
            </p>
            <Button
              onClick={() => router.push("/sales/project-campaigns")}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project Campaigns
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(campaign.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-500 hover:text-gray-900"
            onClick={() => router.push("/sales/project-campaigns")}
          >
            Project Campaigns
          </Button>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-gray-900">Project Campaign Details</span>
        </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start hover:bg-gray-50 hover:border-gray-200 transition-colors mb-2"
                  onClick={() => router.push("/sales/project-campaigns")}
                >
                  <ArrowLeft className="h-3 w-3 mr-2" />
                  Back to Project Campaigns
                </Button>
        {/* Header Card */}
        <Card className="border shadow-sm mb-6 overflow-hidden">
          <div className="bg-blue-600 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white mb-1">{campaign.title}</h1>
                <div className="flex items-center gap-2 text-sm text-blue-100">
                  <Calendar className="h-3 w-3" />
                  <span>Created {formatDate(campaign.createdAt)}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Badge className={`${statusConfig.color} border font-medium px-3 py-1 text-xs`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {campaign.proposalId && (
                  <Button
                    size="sm"
                    onClick={() => router.push(`/sales/proposals/${campaign.proposalId}`)}
                    className="bg-white text-blue-700 hover:bg-blue-50 h-8"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    View Proposal
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Key Campaign Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Total Value</p>
                <p className="text-base font-bold text-green-600">₱{(campaign.totalAmount || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Client</p>
                <p className="text-sm font-bold text-gray-900">{campaign.client?.name || "N/A"}</p>
                <p className="text-xs text-gray-600">{campaign.client?.company || "N/A"}</p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Last Updated</p>
                <p className="text-sm font-bold text-gray-900">{formatDate(campaign.updatedAt).split(",")[0]}</p>
                <p className="text-xs text-gray-600">by {campaign.createdBy || "Unknown"}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Overview */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Project Campaign Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700">{campaign.notes}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-2">
                      <DollarSign className="h-3 w-3 text-green-600" />
                      Total Amount
                    </h4>
                    <p className="text-lg font-bold text-green-600">₱{(campaign.totalAmount || 0).toLocaleString()}</p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-2">
                      <Activity className="h-3 w-3 text-blue-600" />
                      Current Status
                    </h4>
                    <Badge variant="outline" className={`${statusConfig.color} text-xs font-medium px-2 py-0.5`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client Information */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-600" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{campaign.client?.name || "N/A"}</h4>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {campaign.client?.company || "N/A"}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span>{campaign.client?.email || "N/A"}</span>
                    </div>
                    {campaign.client?.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <span>{campaign.client.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  Project Campaign Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaign.timeline && campaign.timeline.length > 0 ? (
                    campaign.timeline.map((event, index) => (
                      <div
                        key={event.id || index}
                        className="relative flex items-start gap-3 pb-4 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="w-3 h-3 bg-blue-500 rounded-full mt-1 flex-shrink-0 shadow-md"></div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <p className="text-xs font-medium text-gray-900 truncate">{event.title}</p>
                              {event.metadata?.source === "proposal_activity" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 px-1"
                                >
                                  Proposal
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 mb-2">{event.description}</p>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-2 w-2" />
                                {formatDate(event.timestamp)}
                              </span>
                              {event.userName && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-2 w-2" />
                                  {event.userName}
                                </span>
                              )}
                              {event.metadata?.location?.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-2 w-2" />
                                  {event.metadata.location.city}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Clock className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">No timeline events yet</p>
                      <p className="text-xs text-gray-400 mt-1">Activities will appear here as they happen</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Campaign Details */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900">Project Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                  <div>
                    <span className="text-xs font-medium text-gray-600">Created:</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(campaign.createdAt)}</p>
                  </div>
                  <Separator className="my-2" />
                  <div>
                    <span className="text-xs font-medium text-gray-600">Last Updated:</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(campaign.updatedAt)}</p>
                  </div>
                  <Separator className="my-2" />
                  <div>
                    <span className="text-xs font-medium text-gray-600">Created By:</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{campaign.createdBy || "Unknown"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Related Documents */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900">Related Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaign.proposalId ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">Proposal</span>
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Document
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">ID: {campaign.proposalId}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7"
                        onClick={() => router.push(`/sales/proposals/${campaign.proposalId}`)}
                      >
                        View Document
                      </Button>
                    </div>
                  ) : null}

                  {quotations.length > 0
                    ? quotations.map((quotation) => (
                        <div key={quotation.id} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-gray-900">Quotation</span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                quotation.status === "accepted"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-700 border-gray-200"
                              }`}
                            >
                              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            <p>Number: {quotation.quotation_number}</p>
                            <p>Product: {quotation.product_name}</p>
                            <p>Amount: ₱{quotation.total_amount.toLocaleString()}</p>
                          </div>
                          {/* Add a button to view quotation details when that page exists */}
                        </div>
                      ))
                    : null}

                  {!campaign.proposalId && quotations.length === 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">No related documents found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
