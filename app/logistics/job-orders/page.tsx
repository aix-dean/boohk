"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { Search, MoreHorizontal, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { useAuth } from "@/contexts/auth-context"
import { getJobOrders } from "@/lib/job-order-service"
import type { JobOrder } from "@/lib/types/job-order"
import { useRouter } from "next/navigation"
import { CreateReportDialog } from "@/components/create-report-dialog"

const isValidDate = (dateValue: any): boolean => {
  if (!dateValue) return false;

  try {
    let date: Date;

    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        if (!isNaN(Number(dateValue))) {
          date = new Date(Number(dateValue) * 1000);
        } else {
          return false;
        }
      }
    } else if (typeof dateValue === 'number') {
      date = new Date(dateValue * 1000);
    } else if (dateValue && typeof dateValue === 'object' && (dateValue as any).seconds) {
      // Handle Firestore Timestamp
      date = new Date((dateValue as any).seconds * 1000);
    } else {
      return false;
    }

    return !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
};

const parseDateSafely = (dateValue: any): Date | null => {
  if (!dateValue) return null;

  try {
    if (dateValue instanceof Date) {
      return dateValue;
    } else if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
      if (!isNaN(Number(dateValue))) {
        return new Date(Number(dateValue) * 1000);
      }
    } else if (typeof dateValue === 'number') {
      return new Date(dateValue * 1000);
    } else if (dateValue && typeof dateValue === 'object' && (dateValue as any).seconds) {
      return new Date((dateValue as any).seconds * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
};

export default function JobOrdersPage() {
    const { user, userData } = useAuth()
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [lastDoc, setLastDoc] = useState<any>(null)
    const [totalItems, setTotalItems] = useState(0)
    const itemsPerPage = 10

    // Report dialog state
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [selectedSiteId, setSelectedSiteId] = useState<string>("")
    const [preSelectedJobOrder, setPreSelectedJobOrder] = useState<string>("")

    const router = useRouter()

   // Function to fetch job orders with pagination
   const fetchJobOrders = async (page: number = 1) => {
     if (!userData?.company_id) {
       setError("Company ID not found. Please contact support.")
       setLoading(false)
       return
     }
     try {
       setLoading(true)
       setError(null)
       const hasSearch = !!(searchTerm && searchTerm.trim())
       const result = await getJobOrders(userData.company_id, {
         page,
         limit: itemsPerPage,
         searchQuery: hasSearch ? searchTerm.trim() : undefined,
         lastDoc: page > 1 ? lastDoc : undefined
       })

       setJobOrders(result.jobOrders)
       setHasNextPage(result.hasNextPage)
       setLastDoc(result.lastDoc)
       if (result.totalItems !== undefined) {
         setTotalItems(result.totalItems)
       }
       setCurrentPage(page)
     } catch (err) {
       console.error("Failed to fetch job orders:", err)
       setError("Failed to load job orders. Please try again.")
     } finally {
       setLoading(false)
     }
   }

   useEffect(() => {
     fetchJobOrders(currentPage)
   }, [currentPage, searchTerm, userData?.company_id])

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

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1)
    setLastDoc(null)
  }, [searchTerm])

  // Helper function to get status color (using joType for now, as no 'status' field exists)
  const getJoTypeColor = (joType: string) => {
    switch (joType?.toLowerCase()) {
      case "installation":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "repair":
        return "bg-red-100 text-red-800 border-red-200"
      case "dismantling":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-purple-100 text-purple-800 border-purple-200"
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Job Orders</h1>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search job orders..."
              className="pl-10 pr-8 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-full max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Card className="border-gray-200 shadow-sm rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 py-3">JO #</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Date Requested</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">JO Type</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Deadline</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Requested By</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 w-[50px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i} className="border-b border-gray-100">
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-8 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-red-500">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Job Orders</h1>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search job orders..."
            className="pl-10 pr-8 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-full max-w-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-500 hover:bg-gray-100"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {jobOrders.length === 0 ? (
          <Card className="border-gray-200 shadow-sm rounded-xl">
            <CardContent className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-gray-400"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No job orders yet</h3>
              <p className="text-gray-600 mb-6">Create your first job order to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-200 shadow-sm overflow-hidden rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 py-3">JO #</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Date Requested</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">JO Type</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Deadline</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Requested By</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 w-[50px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobOrders.map((jo) => {
                  return (
                    <TableRow
                      key={jo.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                      onClick={() => router.push(`/logistics/job-orders/${jo.id}`)}
                    >
                    <TableCell className="font-medium py-3">{jo.joNumber}</TableCell>
                    <TableCell className="py-3">{jo.siteName}</TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="border font-medium bg-gray-100 text-gray-800 border-gray-200">
                        {(() => {
                          const date = parseDateSafely(jo.dateRequested);
                          return date ? format(date, "MMM d, yyyy") : "N/A";
                        })()}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`${getJoTypeColor(jo.joType)} border font-medium`}>
                        {jo.joType}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="border font-medium bg-gray-100 text-gray-800 border-gray-200">
                        {(() => {
                          const date = parseDateSafely(jo.deadline);
                          return date ? format(date, "MMM d, yyyy") : "N/A";
                        })()}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">{jo.requestedBy}</TableCell>
                    <TableCell className="text-right py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/logistics/job-orders/${jo.id}`)
                          }}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              if (jo.product_id) {
                                setSelectedSiteId(jo.product_id)
                                setPreSelectedJobOrder(jo.joNumber)
                                setReportDialogOpen(true)
                              } else {
                                alert("No site associated with this job order")
                              }
                            }}
                          >
                            Create Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            alert(`Edit JO ${jo.joNumber}`)
                          }}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            alert(`Delete JO ${jo.joNumber}`)
                          }}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                    );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Pagination Controls */}
        {jobOrders.length > 0 && (
          <Pagination
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={jobOrders.length}
            totalOverall={totalItems}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            hasMore={hasNextPage}
          />
        )}

        {/* Report Dialog */}
        <CreateReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          siteId={selectedSiteId}
          preSelectedJobOrder={preSelectedJobOrder}
        />
      </div>
    </div>
  )
}
