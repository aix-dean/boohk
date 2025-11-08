"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Search, MoreVertical, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { getReports, type ReportData } from "@/lib/report-service"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Pagination } from "@/components/ui/pagination"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function ServiceReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [pageLastDocs, setPageLastDocs] = useState<{ [page: number]: any }>({})
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [totalOverall, setTotalOverall] = useState(0)
  const itemsPerPage = 10

  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString())

  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()

  // Function to get total count of reports
  const getTotalCount = async () => {
    try {
      const reportsRef = collection(db, "reports")
      let q = query(reportsRef, where("status", "!=", "draft"))

      if (userData?.company_id) {
        q = query(q, where("companyId", "==", userData.company_id))
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.size
    } catch (error) {
      console.error("Error getting total count:", error)
      return 0
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString())
    }, 60000) // update every minute
    return () => clearInterval(interval)
  }, [])

  // Effect to fetch total count for non-search mode
  useEffect(() => {
    if (!searchQuery.trim() && userData?.company_id) {
      getTotalCount().then(setTotalOverall).catch(console.error)
    }
  }, [userData?.company_id, searchQuery])

  // Single useEffect to handle all data fetching
  useEffect(() => {
    fetchReports(currentPage)
  }, [currentPage, searchQuery])

  // Separate effect to reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1)
    setLastDoc(null)
    setPageLastDocs({})
    setIsSearchMode(false)
    if (searchQuery.trim()) {
      // For search mode, total will be set by fetchReports
      setTotalOverall(0)
    }
  }, [searchQuery])


  const fetchReports = async (page: number = 1) => {
    setLoading(true)
    try {
      const hasSearch = !!(searchQuery && searchQuery.trim())
      setIsSearchMode(hasSearch)

      const result = await getReports({
        page,
        limit: itemsPerPage,
        companyId: userData?.company_id || undefined,
        status: "published", // Only show published reports
        searchQuery: hasSearch ? searchQuery.trim() : undefined,
        lastDoc: page > 1 ? pageLastDocs[page - 1] || lastDoc : undefined
      })

      // Update cursor for next page (only when going forward)
      if (page >= currentPage && result.hasNextPage && result.lastDoc) {
        setLastDoc(result.lastDoc)
        setPageLastDocs(prev => ({
          ...prev,
          [page]: result.lastDoc
        }))
      }

      setReports(result.reports)
      setHasNextPage(result.hasNextPage)
      setCurrentPage(page)

      // Set total overall count for search mode
      if (result.total !== undefined) {
        setTotalOverall(result.total)
      }
    } catch (error) {
      console.error("Error fetching reports:", error)
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      })
      setReports([])
      setHasNextPage(false)
      setTotalOverall(0)
    } finally {
      setLoading(false)
    }
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
    router.push(`/logistics/reports/${reportId}`)
  }

  const handleEditReport = (reportId: string) => {
    router.push(`/logistics/reports/${reportId}/edit`)
  }

  const handleDeleteReport = (reportId: string) => {
    // Implement delete functionality
    toast({
      title: "Delete Report",
      description: "Delete functionality will be implemented",
    })
  }

  // Pagination handlers
  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">



      {/* Reports Title */}
      <div className="px-6 py-6">
        <h2 className="text-2xl font-semibold text-gray-900">Reports</h2>
      </div>

      {/* Search */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <div className="bg-white rounded-[15px] border-2 border-gray-300 px-4 flex items-center h-10">
              <Search className="h-4 w-4 text-gray-400 mr-2 border-none" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 p-0 focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-transparent text-gray-400 h-[90%] rounded-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white mx-6 rounded-t-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Report ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Site</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  Campaign Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Sender
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  Attachments
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading reports...</span>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No reports found
                  </td>
                </tr>
              ) : (
                reports.map((report, index) => (
                  <>
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-20">
                        {formatDate(report.date || report.created)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-24">
                        {generateReportNumber(report.id || "")}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-32 truncate">
                        {report.siteName || "Unknown Site"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-40 truncate">
                        {report.client || "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-28 truncate">
                        {getReportTypeDisplay(report.reportType)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-32 truncate">
                        LOG- {report.createdByName || "Unknown User"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 w-40">
                        {report.attachments.length > 0 ? (
                          <a
                            href={report.attachments[0].fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline truncate block max-w-full"
                          >
                            {report.attachments[0].fileName}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 w-20">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-1">
                              <div className="w-6 h-6 flex items-center justify-center">
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full ml-1"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full ml-1"></div>
                              </div>
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
                    {index < reports.length - 1 && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <hr className="border-gray-200 mx-4" />
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {reports.length > 0 && (
        <Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={reports.length}
          totalOverall={totalOverall}
          onNextPage={handleNextPage}
          onPreviousPage={handlePreviousPage}
          hasMore={hasNextPage}
        />
      )}

    </div>
  )
}
