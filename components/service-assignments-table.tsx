"use client"

import { useState, useEffect } from "react"
import { collection, query, orderBy, onSnapshot, where, doc, getDoc, getDocs, limit, startAfter } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { generateServiceAssignmentDetailsPDF } from "@/lib/pdf-service"
import { teamsService } from "@/lib/teams-service"
import { searchServiceAssignments } from "@/lib/algolia-service"
import type { Product } from "@/lib/firebase-service"
import type { JobOrder } from "@/lib/types/job-order"
import type { Team } from "@/lib/types/team"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Pagination } from "@/components/ui/pagination"
import { MoreVertical, Printer, X, Bell, FileText } from "lucide-react"
import { CreateReportDialog } from "@/components/create-report-dialog"

interface ServiceAssignment {
  id: string
  saNumber: string
  projectSiteId: string
  projectSiteName: string
  projectSiteLocation: string
  serviceType: string
  assignedTo: string
  jobDescription: string
  message: string
  campaignName?: string
  joNumber?: string
  requestedBy: {
    id: string
    name: string
    department: string
  }
  status: string
  coveredDateStart: any
  coveredDateEnd: any
  created: any
  updated: any
  company_id?: string | null
}

interface ServiceAssignmentSearchResult {
  objectID: string
  saNumber?: string
  projectSiteId?: string
  projectSiteName?: string
  projectSiteLocation?: string
  serviceType?: string
  assignedTo?: string
  jobDescription?: string
  message?: string
  joNumber?: string
  requestedBy?: {
    id: string
    name: string
    department: string
  }
  status?: string
  coveredDateStart?: any
  coveredDateEnd?: any
  created?: any
  updated?: any
  company_id?: string
}

interface ServiceAssignmentsTableProps {
  onSelectAssignment?: (id: string) => void
  companyId?: string
  searchQuery?: string
}

export function ServiceAssignmentsTable({ onSelectAssignment, companyId, searchQuery }: ServiceAssignmentsTableProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<ServiceAssignment[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [createReportDialog, setCreateReportDialog] = useState<{
    open: boolean
    assignmentId?: string
    projectSiteId?: string
  }>({ open: false })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalItems, setTotalItems] = useState(0)
  const [totalOverall, setTotalOverall] = useState(0)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [allFetchedDocs, setAllFetchedDocs] = useState<any[]>([])
  const [isSearchMode, setIsSearchMode] = useState(false)
  const itemsPerPage = 10

  // Function to get total count of assignments
  const getTotalCount = async () => {
    try {
      const assignmentsRef = collection(db, "service_assignments")
      let q = query(assignmentsRef)

      if (companyId) {
        q = query(q, where("company_id", "==", companyId))
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.size
    } catch (error) {
      console.error("Error getting total count:", error)
      return 0
    }
  }

  const handlePrint = async (assignment: ServiceAssignment) => {
    try {
      // Fetch full assignment data
      const assignmentDoc = await getDoc(doc(db, "service_assignments", assignment.id))
      if (!assignmentDoc.exists()) {
        console.error("Assignment not found")
        return
      }
      const fullAssignmentData: any = { id: assignmentDoc.id, ...assignmentDoc.data() }

      // Fetch job order if present
      let jobOrderData = null
      if (fullAssignmentData.jobOrderId) {
        const jobOrderDoc = await getDoc(doc(db, "job_orders", fullAssignmentData.jobOrderId))
        if (jobOrderDoc.exists()) {
          jobOrderData = { id: jobOrderDoc.id, ...jobOrderDoc.data() }
        }
      }

      // Fetch products
      const productsRef = collection(db, "products")
      const q = query(productsRef, where("deleted", "==", false), orderBy("name", "asc"), limit(100))
      const querySnapshot = await getDocs(q)
      const products: Product[] = []
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() } as Product)
      })

      // Fetch teams
      const teamsData = await teamsService.getAllTeams()
      const teams = teamsData.filter((team) => team.status === "active")

      // Generate PDF
      await generateServiceAssignmentDetailsPDF(fullAssignmentData, jobOrderData, products, teams)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  // Function to fetch team data for assignments
  const fetchTeamsForAssignments = async (assignmentsData: ServiceAssignment[]) => {
    const teamIds = assignmentsData
      .map(assignment => assignment.assignedTo)
      .filter(teamId => teamId && !teams[teamId])

    console.log("Team IDs to fetch:", teamIds)

    if (teamIds.length === 0) return

    const teamPromises = teamIds.map(async (teamId) => {
      try {
        console.log(`Fetching team ${teamId}`)
        const teamDoc = await getDoc(doc(db, "logistics_teams", teamId))
        if (teamDoc.exists()) {
          console.log(`Team ${teamId} found:`, teamDoc.data())
          return { id: teamId, data: teamDoc.data() as Team }
        } else {
          console.log(`Team ${teamId} not found in logistics_teams collection`)
        }
      } catch (error) {
        console.error(`Error fetching team ${teamId}:`, error)
      }
      return null
    })

    const teamResults = await Promise.all(teamPromises)
    const newTeams: Record<string, Team> = {}

    teamResults.forEach(result => {
      if (result) {
        newTeams[result.id] = { ...result.data, id: result.id }
      }
    })

    console.log("New teams fetched:", newTeams)
    setTeams(prev => ({ ...prev, ...newTeams }))
  }

  // Function to fetch assignments from Firestore with server-side pagination
  const fetchAssignmentsFromFirestore = async (page: number = 1) => {
    setLoading(true)
    try {
      const hasSearch = !!(searchQuery && searchQuery.trim())
      setIsSearchMode(hasSearch)

      if (hasSearch) {
        // For search: fetch all data for client-side filtering and pagination
        console.log(`Fetching all data for search: "${searchQuery.trim()}"`)
        let q = query(collection(db, "service_assignments"), orderBy("created", "desc"))

        if (companyId) {
          q = query(q, where("company_id", "==", companyId))
        }

        const querySnapshot = await getDocs(q)
        const allDocs = querySnapshot.docs

        // Convert to assignments data
        let allAssignments: ServiceAssignment[] = allDocs.map(doc => {
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

        // Apply search filtering
        const searchTerm = searchQuery.trim().toLowerCase()
        allAssignments = allAssignments.filter(assignment =>
          assignment.saNumber.toLowerCase().includes(searchTerm) ||
          assignment.projectSiteName.toLowerCase().includes(searchTerm) ||
          assignment.serviceType.toLowerCase().includes(searchTerm) ||
          (assignment.message && assignment.message.toLowerCase().includes(searchTerm))
        )

        // Client-side pagination for search results
        const startIndex = (page - 1) * itemsPerPage
        const endIndex = Math.min(startIndex + itemsPerPage, allAssignments.length)
        const pageAssignments = allAssignments.slice(startIndex, endIndex)

        setAssignments(pageAssignments)
        setHasMore(allAssignments.length > endIndex)
        setTotalPages(Math.ceil(allAssignments.length / itemsPerPage))
        setTotalItems(pageAssignments.length)
        setTotalOverall(allAssignments.length)
        setAllFetchedDocs(allDocs)

        await fetchTeamsForAssignments(pageAssignments)
      } else {
        // For non-search: use server-side pagination
        // Get total count on first page
        if (page === 1) {
          const total = await getTotalCount()
          setTotalOverall(total)
        }

        let q = query(collection(db, "service_assignments"), orderBy("created", "desc"), limit(itemsPerPage + 1))

        if (companyId) {
          q = query(q, where("company_id", "==", companyId))
        }

        // Handle pagination cursor
        if (page > 1) {
          if (lastDoc && page > currentPage) {
            // Going forward: use cursor
            q = query(q, startAfter(lastDoc))
          } else {
            // Going backward or jumping: refetch from beginning and slice
            q = query(collection(db, "service_assignments"), orderBy("created", "desc"), limit(page * itemsPerPage + 1))
            if (companyId) {
              q = query(q, where("company_id", "==", companyId))
            }
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
        const pageAssignments: ServiceAssignment[] = pageDocs.map(doc => {
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

        setAssignments(pageAssignments)
        setHasMore(hasMorePages)
        setTotalPages(hasMorePages ? page + 1 : page) // Estimate based on current page
        setTotalItems(pageAssignments.length) // Number of items on current page
        setAllFetchedDocs(docs)

        await fetchTeamsForAssignments(pageAssignments)
      }
    } catch (error) {
      console.error("Error fetching assignments:", error)
      setAssignments([])
      setHasMore(false)
      setTotalPages(1)
      setTotalItems(0)
      setTotalOverall(0)
    } finally {
      setLoading(false)
    }
  }

  // Function to fetch assignments using Algolia search
  const fetchAssignmentsFromAlgolia = async (query: string, page: number = 1) => {
    setLoading(true)
    try {
      const searchResult = await searchServiceAssignments(query, companyId || undefined, page - 1, itemsPerPage) // Algolia uses 0-based indexing

      if (searchResult.error) {
        console.error("Algolia search error:", searchResult.error)
        setAssignments([])
        setTotalPages(1)
        setHasMore(false)
        setTotalItems(0)
        return
      }

      // Convert Algolia hits to ServiceAssignment format
      const assignmentsData: ServiceAssignment[] = searchResult.hits.map(hit => {
        const saHit = hit as any // Cast to any to access service assignment fields
        return {
          id: hit.objectID,
          saNumber: saHit.saNumber || '',
          projectSiteId: saHit.projectSiteId || '',
          projectSiteName: saHit.projectSiteName || '',
          projectSiteLocation: saHit.projectSiteLocation || '',
          serviceType: saHit.serviceType || '',
          assignedTo: saHit.assignedTo || '',
          jobDescription: saHit.jobDescription || '',
          message: saHit.message || '',
          campaignName: saHit.campaignName || '',
          joNumber: saHit.joNumber || '',
          requestedBy: saHit.requestedBy || { id: '', name: '', department: '' },
          status: saHit.status || '',
          coveredDateStart: saHit.coveredDateStart ? new Date(saHit.coveredDateStart) : null,
          coveredDateEnd: saHit.coveredDateEnd ? new Date(saHit.coveredDateEnd) : null,
          created: saHit.created ? new Date(saHit.created) : null,
          updated: saHit.updated ? new Date(saHit.updated) : null,
          company_id: saHit.company_id
        }
      })

      setAssignments(assignmentsData)
      setTotalPages(searchResult.nbPages)
      setHasMore(page < searchResult.nbPages)
      setTotalItems(searchResult.nbHits)

      // Fetch team data for the assignments
      await fetchTeamsForAssignments(assignmentsData)
    } catch (error) {
      console.error("Error searching assignments:", error)
      setAssignments([])
      setTotalPages(1)
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

  // Single useEffect to handle all data fetching
  useEffect(() => {
    // Use Firestore for all data fetching
    fetchAssignmentsFromFirestore(currentPage)
  }, [currentPage, searchQuery, companyId])

  // Separate effect to reset pagination when search/filter changes
  useEffect(() => {
    setCurrentPage(1)
    setLastDoc(null)
    setAllFetchedDocs([])
    setTotalOverall(0)
    setIsSearchMode(false)
  }, [searchQuery, companyId])

  // Fallback function using real-time Firestore listener (original implementation)
  const fetchAssignmentsFromFirestoreRealtime = () => {
    setLoading(true)

    let realtimeQuery = query(collection(db, "service_assignments"), orderBy("created", "desc"))

    // Filter by company_id if provided
    if (companyId) {
      realtimeQuery = query(realtimeQuery, where("company_id", "==", companyId))
    }

    const unsubscribe = onSnapshot(realtimeQuery, async (querySnapshot) => {
      const assignmentsData: ServiceAssignment[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        assignmentsData.push({
          id: doc.id,
          ...data,
        } as ServiceAssignment)
      })

      // Apply pagination client-side for real-time data
      const startIndex = (currentPage - 1) * itemsPerPage
      const endIndex = startIndex + itemsPerPage
      const paginatedData = assignmentsData.slice(startIndex, endIndex)

      setAssignments(paginatedData)
      setHasMore(assignmentsData.length > endIndex)
      setTotalPages(Math.ceil(assignmentsData.length / itemsPerPage))

      // Fetch team data for the assignments
      await fetchTeamsForAssignments(paginatedData)

      setLoading(false)
    })

    return unsubscribe
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-50 text-green-700 border border-green-200"
      case "in progress":
        return "bg-blue-50 text-blue-700 border border-blue-200"
      case "pending":
        return "bg-yellow-50 text-yellow-700 border border-yellow-200"
      case "cancelled":
        return "bg-red-50 text-red-700 border border-red-200"
      case "draft":
        return "bg-orange-50 text-orange-700 border border-orange-200"
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200"
    }
  }

  // Filter assignments based on status (search is now handled server-side)
  const filteredAssignments = assignments.filter(assignment => {
    return statusFilter === "all" || assignment.status.toLowerCase() === statusFilter.toLowerCase()
  })

  if (loading) {
    return <div className="flex justify-center p-8">Loading assignments...</div>
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-full">
        {/* Header Row */}
        <div className="hidden md:grid md:gap-4 bg-white p-4 font-semibold text-gray-900" style={{ gridTemplateColumns: '1fr 1fr 1fr 1.2fr 2fr 1fr 2fr 1fr 1fr 1fr' }}>
          <div>Date</div>
          <div>SA I.D.</div>
          <div>Type</div>
          <div>Campaign Name</div>
          <div>Site</div>
          <div>Created</div>
          <div>Crew</div>
          <div>Deadline</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {/* Mobile Header - Hidden on desktop */}
        <div className="md:hidden bg-white p-4 font-semibold text-gray-900 text-center">
          Service Assignments
        </div>
        {/* Data Rows Container */}
        <div className="space-y-5">
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <div className="text-gray-400 text-sm">No service assignments found</div>
                <div className="text-xs text-gray-400">Create your first assignment to get started</div>
              </div>
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div key={assignment.id}>
                {/* Desktop Grid Layout */}
                <div
                  className="hidden md:grid md:gap-4 p-4 cursor-pointer rounded-[10px] border-2 border-[#B8D9FF] bg-[#F6F9FF] transition-colors hover:bg-[#F0F4FF]"
                  onClick={() => router.push(`/logistics/assignments/${assignment.id}`)}
                  style={{ marginBottom: '5px', gridTemplateColumns: '1fr 1fr 1fr 1.2fr 2fr 1fr 2fr 1fr 1fr 1fr' }}
                >
                  <div className="text-gray-600 truncate">
                    {assignment.coveredDateStart ? (
                      format(
                        assignment.coveredDateStart instanceof Date
                          ? assignment.coveredDateStart
                          : assignment.coveredDateStart.toDate
                            ? assignment.coveredDateStart.toDate()
                            : new Date(assignment.coveredDateStart),
                        "MMM d, yyyy"
                      )
                    ) : (
                      "Not set"
                    )}
                  </div>
                  <div className="font-medium text-gray-900 truncate">{assignment.saNumber}</div>
                  <div className="font-medium text-gray-900 truncate">{assignment.serviceType}</div>
                  <div className="text-gray-700 truncate">{assignment.campaignName || "N/A"}</div>
                  <div className="text-gray-700 truncate">{assignment.projectSiteName}</div>
                  <div className="text-gray-600 truncate">
                    {assignment.created ? (
                      format(
                        assignment.created instanceof Date
                          ? assignment.created
                          : assignment.created.toDate
                            ? assignment.created.toDate()
                            : new Date(assignment.created),
                        "MMM d, yyyy"
                      )
                    ) : (
                      "Not set"
                    )}
                  </div>
                  <div className="text-gray-700 truncate">{assignment.assignedTo ? (teams[assignment.assignedTo]?.name || assignment.assignedTo) : "Unassigned"}</div>
                  <div className="text-gray-600 truncate">
                    {assignment.coveredDateEnd ? (
                      format(
                        assignment.coveredDateEnd instanceof Date
                          ? assignment.coveredDateEnd
                          : assignment.coveredDateEnd.toDate
                            ? assignment.coveredDateEnd.toDate()
                            : new Date(assignment.coveredDateEnd),
                        "MMM d, yyyy"
                      )
                    ) : (
                      "Not set"
                    )}
                  </div>
                  <div className="text-gray-900 font-bold truncate">
                    {assignment.status}
                  </div>
                  <div className="truncate" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => router.push(`/logistics/assignments/${assignment.id}`)}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrint(assignment)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => console.log("Edit assignment", assignment.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => console.log("Duplicate assignment", assignment.id)}>
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setCreateReportDialog({
                                open: true,
                                assignmentId: assignment.id,
                                projectSiteId: assignment.projectSiteId
                              });
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Create Report
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => console.log("Cancel assignment", assignment.id)}>
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Mobile Card Layout */}
                <div
                  className="md:hidden p-4 cursor-pointer rounded-[10px] border-2 border-[#B8D9FF] bg-[#F6F9FF] transition-colors hover:bg-[#F0F4FF]"
                  onClick={() => router.push(`/logistics/assignments/${assignment.id}`)}
                  style={{ marginBottom: '5px' }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{assignment.saNumber}</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => router.push(`/logistics/assignments/${assignment.id}`)}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrint(assignment)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => console.log("Edit assignment", assignment.id)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => console.log("Duplicate assignment", assignment.id)}>
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCreateReportDialog({
                                  open: true,
                                  assignmentId: assignment.id,
                                  projectSiteId: assignment.projectSiteId
                                });
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Create Report
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => console.log("Cancel assignment", assignment.id)}>
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-medium">Date:</span> {assignment.coveredDateStart ? format(assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart : assignment.coveredDateStart.toDate ? assignment.coveredDateStart.toDate() : new Date(assignment.coveredDateStart), "MMM d, yyyy") : "Not set"}</div>
                      <div><span className="font-medium">Type:</span> {assignment.serviceType}</div>
                      <div className="col-span-2"><span className="font-medium">Site:</span> {assignment.projectSiteName}</div>
                      <div className="col-span-2"><span className="font-medium">Campaign:</span> {assignment.campaignName || "N/A"}</div>
                      <div><span className="font-medium">Crew:</span> {assignment.assignedTo ? (teams[assignment.assignedTo]?.name || assignment.assignedTo) : "Unassigned"}</div>
                      <div><span className="font-medium">Deadline:</span> {assignment.coveredDateEnd ? format(assignment.coveredDateEnd instanceof Date ? assignment.coveredDateEnd : assignment.coveredDateEnd.toDate ? assignment.coveredDateEnd.toDate() : new Date(assignment.coveredDateEnd), "MMM d, yyyy") : "Not set"}</div>
                      <div className="col-span-2"><span className="font-medium">Status:</span> {assignment.status}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {assignments.length > 0 && (
        <div className="bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} assignments
            </div>
            <Pagination
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalItems={totalItems}
              onNextPage={handleNextPage}
              onPreviousPage={handlePreviousPage}
              hasMore={hasMore}
            />
          </div>
        </div>
      )}

      {/* Create Report Dialog */}
      {createReportDialog.open && createReportDialog.projectSiteId && (
        <CreateReportDialog
          open={createReportDialog.open}
          onOpenChange={(open) => setCreateReportDialog({ open })}
          siteId={createReportDialog.projectSiteId}
          module="logistics"
          hideJobOrderSelection={false}
        />
      )}
    </div>
  )
}
