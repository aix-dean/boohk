"use client"

import { useState, useEffect } from "react"
import { collection, query, where, orderBy, getDocs, limit, startAfter } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { type ServiceAssignment } from "@/lib/firebase-service"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Pagination } from "@/components/ui/pagination"

interface SiteServiceAssignmentsTableProps {
    projectSiteId: string
    companyId: string
}

export function SiteServiceAssignmentsTable({ projectSiteId, companyId }: SiteServiceAssignmentsTableProps) {
   const [assignments, setAssignments] = useState<ServiceAssignment[]>([])
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)

   // Pagination state
   const [currentPage, setCurrentPage] = useState(1)
   const [totalPages, setTotalPages] = useState(1)
   const [hasMore, setHasMore] = useState(false)
   const [totalItems, setTotalItems] = useState(0)
   const [lastDoc, setLastDoc] = useState<any>(null)
   const itemsPerPage = 10

   // Function to get total count of assignments
   const getTotalCount = async () => {
     try {
       const assignmentsRef = collection(db, "service_assignments")
       const q = query(
         assignmentsRef,
         where("projectSiteId", "==", projectSiteId),
         where("company_id", "==", companyId)
       )
       const querySnapshot = await getDocs(q)
       return querySnapshot.size
     } catch (error) {
       console.error("Error getting total count:", error)
       return 0
     }
   }

  // Function to fetch assignments with server-side pagination
  const fetchAssignments = async (page: number = 1) => {
     setLoading(true)
     try {
       setError(null)

       // Get total count (only on first load or when site/company changes)
       if (page === 1) {
         const total = await getTotalCount()
         setTotalItems(total)
       }

       let q = query(
         collection(db, "service_assignments"),
         where("projectSiteId", "==", projectSiteId),
         where("company_id", "==", companyId),
         orderBy("coveredDateStart", "desc"),
         limit(itemsPerPage + 1)
       )

       // Handle pagination cursor
       if (page > 1) {
         if (lastDoc && page > currentPage) {
           // Going forward: use cursor
           q = query(q, startAfter(lastDoc))
         } else {
           // Going backward or jumping: refetch from beginning and slice
           q = query(
             collection(db, "service_assignments"),
             where("projectSiteId", "==", projectSiteId),
             where("company_id", "==", companyId),
             orderBy("coveredDateStart", "desc"),
             limit(page * itemsPerPage + 1)
           )
         }
       } else {
         // Page 1: reset cursor
         setLastDoc(null)
       }

       const querySnapshot = await getDocs(q)
       const docs = querySnapshot.docs

       let pageDocs: any[]
       let hasMorePages: boolean

       if (page > 1 && page <= currentPage) {
         // Going backward: slice the fetched documents
         const startIndex = (page - 1) * itemsPerPage
         const endIndex = Math.min(startIndex + itemsPerPage, docs.length)
         pageDocs = docs.slice(startIndex, endIndex)
         hasMorePages = docs.length > endIndex
       } else {
         // Going forward or page 1: use the first itemsPerPage documents
         hasMorePages = docs.length > itemsPerPage
         pageDocs = hasMorePages ? docs.slice(0, itemsPerPage) : docs
       }

       // Convert to assignments data
       const assignmentsData: ServiceAssignment[] = pageDocs.map(doc => {
         const data = doc.data()
         return {
           id: doc.id,
           ...data,
           coveredDateStart: data.coveredDateStart,
           coveredDateEnd: data.coveredDateEnd,
           created: data.created,
           updated: data.updated,
         } as ServiceAssignment
       })

       // Update cursor for next page (only when going forward)
       if (page >= currentPage && hasMorePages && pageDocs.length > 0) {
         setLastDoc(pageDocs[pageDocs.length - 1])
       }

       setAssignments(assignmentsData)
       setHasMore(hasMorePages)
       setTotalPages(hasMorePages ? page + 1 : page) // Estimate based on current page
     } catch (err) {
       console.error("Error fetching service assignments:", err)
       setError("Failed to load service assignments")
       setAssignments([])
       setHasMore(false)
       setTotalPages(1)
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

  // Effect to fetch assignments when page changes
  useEffect(() => {
    if (projectSiteId && companyId) {
      fetchAssignments(currentPage)
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
          <div className="font-semibold text-gray-900 text-start w-24">Date</div>
          <div className="font-semibold text-gray-900 text-start w-24">S.A. ID</div>
          <div className="font-semibold text-gray-900 text-start w-20">Type</div>
          <div className="font-semibold text-gray-900 text-start w-56">Campaign</div>
          <div className="font-semibold text-gray-900 text-start w-24">Status</div>
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
        <div className="font-semibold text-gray-900 text-start w-24">Date</div>
        <div className="font-semibold text-gray-900 text-start w-24">S.A. ID</div>
        <div className="font-semibold text-gray-900 text-start w-20">Type</div>
        <div className="font-semibold text-gray-900 text-start w-56">Campaign</div>
        <div className="font-semibold text-gray-900 text-start w-24">Status</div>
      </div>
      <div className="border-b border-gray-200"></div>

      {/* Content */}
      {assignments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No service assignments found for this site.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex justify-around items-center p-4 w-full" style={{height: '45px', background: '#F6F9FF', borderRadius: '10px', border: '2px #B8D9FF solid'}}>
              <div className="text-start w-24" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {formatDate(assignment.coveredDateStart)}
              </div>
              <div className="text-start w-24" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {assignment.saNumber}
              </div>
              <div className="text-start w-20" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {assignment.serviceType}
              </div>
              <div className="text-start w-56" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {assignment.campaignName || "N/A"}
              </div>
              <div className="text-start w-24" style={{color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 400, lineHeight: '132%'}}>
                {assignment.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {assignments.length > 0 && (
        <Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={assignments.length}
          totalOverall={totalItems}
          onNextPage={handleNextPage}
          onPreviousPage={handlePreviousPage}
          hasMore={hasMore}
        />
      )}
    </div>
  )
}