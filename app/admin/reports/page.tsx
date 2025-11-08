"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Search, MoreVertical, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { getReportsLegacy as getReports, type ReportData } from "@/lib/report-service"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ReportPostSuccessDialog } from "@/components/report-post-success-dialog"

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [filteredReports, setFilteredReports] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("All")
  const [activeTab, setActiveTab] = useState("From Admin")
  const [showDrafts, setShowDrafts] = useState(false)

  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [postedReportId, setPostedReportId] = useState<string>("")

  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchReports()
  }, [])

  useEffect(() => {
    filterReports()
  }, [reports, searchQuery, filterType, activeTab, showDrafts])

  useEffect(() => {
    // Check if we just posted a report
    const lastPostedReportId = sessionStorage.getItem("lastPostedReportId")
    if (lastPostedReportId) {
      setPostedReportId(lastPostedReportId)
      setShowSuccessDialog(true)
      // Clear the session storage
      sessionStorage.removeItem("lastPostedReportId")
    }
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const reportsData = await getReports()
      console.log("Fetched reports data:", reportsData)
      setReports(reportsData)
    } catch (error) {
      console.error("Error fetching reports:", error)
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterReports = () => {
    let filtered = [...reports]

    // Filter by company ID - only show reports from the same company
    if (userData?.company_id) {
      filtered = filtered.filter((report) => report.companyId === userData.company_id)
    }

    // Filter by tab (department)
    if (activeTab === "From Sales") {
      filtered = filtered.filter((report) => report.category === "sales")
    } else if (activeTab === "From Management") {
      filtered = filtered.filter((report) => report.category === "management")
    } else if (activeTab === "From Admin") {
      filtered = filtered.filter((report) => report.category === "admin")
    }

    // Filter by drafts
    if (showDrafts) {
      filtered = filtered.filter((report) => report.status === "draft")
    } else {
      filtered = filtered.filter((report) => report.status !== "draft")
    }

    // Filter by report type
    if (filterType !== "All") {
      filtered = filtered.filter((report) => report.reportType === filterType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (report) =>
          report.siteName?.toLowerCase().includes(query) ||
          report.reportType?.toLowerCase().includes(query) ||
          report.createdByName?.toLowerCase().includes(query) ||
          report.id?.toLowerCase().includes(query),
      )
    }

    setFilteredReports(filtered)
  }

  const formatDate = (date: any) => {
    if (!date) return "N/A"

    let dateObj: Date
    if (date.toDate) {
      dateObj = date.toDate()
    } else if (date instanceof Date) {
      dateObj = date
    } else {
      dateObj = new Date(date)
    }

    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getReportTypeDisplay = (reportType: string) => {
    switch (reportType) {
      case "completion-report":
        return "Completion Report"
      case "monitoring-report":
        return "Monitoring Report"
      case "installation-report":
        return "Installation Report"
      case "roll-down":
        return "Roll Down"
      default:
        return reportType
    }
  }

  const generateReportNumber = (id: string) => {
    return id ? `000${id.slice(-3)}` : "000000"
  }

  const handleViewReport = (reportId: string) => {
    router.push(`/admin/reports/${reportId}`)
  }

  const handleEditReport = (reportId: string) => {
    router.push(`/admin/reports/${reportId}/edit`)
  }

  const handleDeleteReport = (reportId: string) => {
    // Implement delete functionality
    toast({
      title: "Delete Report",
      description: "Delete functionality will be implemented",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">Admin Reports</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center gap-6">
          {["From Sales", "From Management", "From Admin"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="completion-report">Completion</SelectItem>
                <SelectItem value="monitoring-report">Monitoring</SelectItem>
                <SelectItem value="installation-report">Installation</SelectItem>
                <SelectItem value="roll-down">Roll Down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={showDrafts ? "default" : "outline"}
            onClick={() => setShowDrafts(!showDrafts)}
            className="px-4"
          >
            Drafts
          </Button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white mx-6 mt-6 rounded-lg border border-gray-200 overflow-hidden">
        <div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date of Report
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reported By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading reports...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No reports found
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {generateReportNumber(report.id || "")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.siteName || "Unknown Site"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {formatDate(report.date || report.created)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getReportTypeDisplay(report.reportType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.createdByName || "Unknown User"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewReport(report.id!)}>View Report</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditReport(report.id!)}>Edit Report</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteReport(report.id!)} className="text-red-600">
                            Delete Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Report Button */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={() => router.push("/admin/assets")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create New Report
        </Button>
      </div>

      {/* Report Post Success Dialog */}
      <ReportPostSuccessDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog} reportId={postedReportId} />
    </div>
  )
}