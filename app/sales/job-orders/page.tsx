"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Search, Plus, MoreHorizontal, X, Loader2, Printer } from "lucide-react" // Added X for clear search
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card" // Added Card and CardContent
import { Skeleton } from "@/components/ui/skeleton" // Added Skeleton
import { useAuth } from "@/contexts/auth-context"
import { getJobOrders } from "@/lib/job-order-service"
import type { JobOrder } from "@/lib/types/job-order"
import { useRouter, useSearchParams } from "next/navigation" // Added useRouter and useSearchParams
import { Timestamp } from "firebase/firestore" // Import Timestamp type
import { JobOrderCreatedSuccessDialog } from "@/components/job-order-created-success-dialog"
import { generateJobOrderPDF } from "@/lib/job-order-pdf-generator"

// Helper function to safely parse date values
const safeParseDate = (dateValue: string | Date | Timestamp | undefined): Date | null => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  // Check if it's a Firebase Timestamp object
  if (typeof dateValue === 'object' && dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  // Attempt to parse as a string
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export default function JobOrdersPage() {
  const { user,userData } = useAuth()
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const router = useRouter() // Initialize useRouter
  const searchParams = useSearchParams() // Initialize useSearchParams

  // Success dialog states
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successJoIds, setSuccessJoIds] = useState<string[]>([])

  // Print function for job orders
  const handlePrint = async (jobOrder: JobOrder, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent row click navigation

    try {
      await generateJobOrderPDF(jobOrder, "print", false)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  useEffect(() => {
    const fetchJOs = async () => {
      if (!user?.uid) {
        setError("User not authenticated.")
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const fetchedJOs = await getJobOrders(userData?.company_id || "")
        setJobOrders(fetchedJOs.jobOrders)
      } catch (err) {
        console.error("Failed to fetch job orders:", err)
        setError("Failed to load job orders. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    fetchJOs()
  }, [user?.uid])

  // Check for success query parameters on mount
  useEffect(() => {
    const success = searchParams.get("success")
    const joIds = searchParams.get("joIds")

    if (success === "true" && joIds) {
      setSuccessJoIds(joIds.split(","))
      setShowSuccessDialog(true)

      // Clear the query parameters from the URL
      const url = new URL(window.location.href)
      url.searchParams.delete("success")
      url.searchParams.delete("joIds")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])


  const filteredJobOrders = useMemo(() => {
    if (!searchTerm) {
      return jobOrders
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase()
    return jobOrders.filter(
      (jo) =>
        jo.joNumber.toLowerCase().includes(lowerCaseSearchTerm) ||
        jo.siteName.toLowerCase().includes(lowerCaseSearchTerm) ||
        jo.joType.toLowerCase().includes(lowerCaseSearchTerm) ||
        jo.requestedBy.toLowerCase().includes(lowerCaseSearchTerm) ||
        (jo.assignTo && jo.assignTo.toLowerCase().includes(lowerCaseSearchTerm)),
    )
  }, [jobOrders, searchTerm])

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
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto p-2 sm:p-4 lg:p-6">
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
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 py-3">JO #</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Site</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Date Requested</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">JO Type</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Deadline</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Requested By</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3">Assigned To</TableHead>
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
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-8 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full text-red-500 p-2 sm:p-4 lg:p-6">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto p-2 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Job Orders</h1>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="relative">
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
          <Button
            onClick={() => {
              setIsCreating(true);
              router.push("/sales/job-orders/select-booking");
            }}
            size="sm"
            className="flex items-center gap-2"
            disabled={isCreating}
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isCreating ? "Navigating..." : "Create JO"}
          </Button>
        </div>

        {filteredJobOrders.length === 0 ? (
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
                {filteredJobOrders.map((jo) => {
                  const dateRequested = safeParseDate(jo.dateRequested);
                  const deadline = safeParseDate(jo.deadline);
                  return (
                    <TableRow
                      key={jo.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                      onClick={() => router.push(`/sales/job-orders/${jo.id}`)} // Placeholder navigation
                    >
                      <TableCell className="font-medium py-3">{jo.joNumber}</TableCell>
                      <TableCell className="py-3">{jo.siteName || "N/A"}</TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="border font-medium bg-gray-100 text-gray-800 border-gray-200">
                          {dateRequested ? format(dateRequested, "MMM d, yyyy") : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`${getJoTypeColor(jo.joType)} border font-medium`}>
                          {jo.joType}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="border font-medium bg-gray-100 text-gray-800 border-gray-200">
                          {deadline ? format(deadline, "MMM d, yyyy") : "N/A"}
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
                            <DropdownMenuItem onClick={(event) => handlePrint(jo, event)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/sales/job-orders/${jo.id}`)}>
                              View
                            </DropdownMenuItem>
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
      </div>

      {/* Success Dialog */}
      <JobOrderCreatedSuccessDialog
        isOpen={showSuccessDialog}
        onClose={() => setShowSuccessDialog(false)}
        joIds={successJoIds}
        isMultiple={successJoIds.length > 1}
      />
    </div>
  )
}
