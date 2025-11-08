"use client"

import { useState, useEffect } from "react"
import { type ReportData, getReports } from "@/lib/report-service"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Pagination } from "@/components/ui/pagination"

interface SiteReportsTableProps {
    projectSiteId: string
    companyId: string
}

export function SiteReportsTable({ projectSiteId, companyId }: SiteReportsTableProps) {
   const [reports, setReports] = useState<ReportData[]>([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)

   // Pagination state
   const [currentPage, setCurrentPage] = useState(1)
   const [hasMore, setHasMore] = useState(false)
   const [totalItems, setTotalItems] = useState(0)
   const [lastDoc, setLastDoc] = useState<any>(null)
   const itemsPerPage = 10

   // Function to get total count of reports for this site
   const getTotalReportsCount = async () => {
     try {
       // Since getReports doesn't return total count, we need to fetch all and filter
       const { reports: allReports } = await getReports({ companyId })
       const filteredReports = allReports.filter(report => report.siteId === projectSiteId)
       return filteredReports.length
     } catch (error) {
       console.error("Error getting total reports count:", error)
       return 0
     }
   }

  // Function to fetch reports with pagination
  const fetchReports = async (page: number = 1) => {
    setLoading(true)
    try {
      setError(null)

      // Get total count (only on first load or when site/company changes)
      if (page === 1) {
        const total = await getTotalReportsCount()
        setTotalItems(total)
      }

      // Fetch reports with pagination parameters
      const { reports: pageReports, hasNextPage, lastDoc: newLastDoc } = await getReports({
        companyId,
        page,
        limit: itemsPerPage,
        lastDoc: page > 1 ? lastDoc : undefined
      })

      // Filter by siteId client-side (since getReports doesn't support siteId filtering server-side)
      const filteredReports = pageReports.filter(report => report.siteId === projectSiteId)

      setReports(filteredReports)
      setHasMore(hasNextPage)
      setLastDoc(newLastDoc)
    } catch (err) {
      console.error("Error fetching reports:", err)
      setError("Failed to load reports")
      setReports([])
      setHasMore(false)
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }

  // Pagination handlers
  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Effect to fetch reports when page changes
  useEffect(() => {
    if (projectSiteId && companyId) {
      fetchReports(currentPage)
    }
  }, [currentPage, projectSiteId, companyId])

  // Effect to reset pagination when site/company changes
  useEffect(() => {
    setCurrentPage(1)
    setLastDoc(null)
  }, [projectSiteId, companyId])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in progress":
        return "bg-blue-100 text-blue-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "draft":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "N/A"

    try {
      let date: Date
      if (dateValue instanceof Date) {
        date = dateValue
      } else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        // Firebase Timestamp
        date = dateValue.toDate()
      } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        date = new Date(dateValue)
      } else {
        return "N/A"
      }

      return format(date, "MMM d, yyyy")
    } catch (error) {
      return "N/A"
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-around items-center">
          <div className="font-semibold text-gray-900 text-start w-24">Date Issued</div>
          <div className="font-semibold text-gray-900 text-start w-24">Report ID</div>
          <div className="font-semibold text-gray-900 text-start w-20">Type</div>
          <div className="font-semibold text-gray-900 text-start w-56">Campaign</div>
          <div className="font-semibold text-gray-900 text-start w-24">Sender</div>
        </div>
        <div className="border-b border-gray-200"></div>

        {/* Loading rows */}
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex justify-around items-center p-4 w-full" style={{height: '45px', background: '#F6F9FF', borderRadius: '10px', border: '2px #B8D9FF solid'}}>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-56"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-around items-center">
        <div className="font-semibold text-gray-900 text-start w-24">Date Issued</div>
        <div className="font-semibold text-gray-900 text-start w-24">Report ID</div>
        <div className="font-semibold text-gray-900 text-start w-20">Type</div>
        <div className="font-semibold text-gray-900 text-start w-56">Campaign</div>
        <div className="font-semibold text-gray-900 text-start w-24">Sender</div>
      </div>
      <div className="border-b border-gray-200"></div>

      {/* Content */}
      {reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No reports found for this site.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="flex justify-around items-center p-4 w-full" style={{height: '45px', background: '#F6F9FF', borderRadius: '10px', border: '2px #B8D9FF solid'}}>
              <div className="text-start w-24 truncate" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {formatDate(report.created)}
              </div>
              <div className="text-start w-24 truncate" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {report.report_id}
              </div>
              <div className="text-start w-20 truncate" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {report.reportType}
              </div>
              <div className="text-start w-56 truncate" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {report.campaignName}
              </div>
              <div className="text-start w-24 truncate" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {report.requestedBy?.name || report.createdByName}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {reports.length > 0 && (
        <Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={reports.length}
          totalOverall={totalItems}
          onNextPage={handleNextPage}
          onPreviousPage={handlePreviousPage}
          hasMore={hasMore}
        />
      )}
    </div>
  )
}