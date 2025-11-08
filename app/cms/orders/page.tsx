"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  Clock,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  AlertCircle,
  FileText,
  ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data for demonstration
const mockOrders = [
  {
    id: "ORD-001",
    title: "Summer Sale Billboard Campaign",
    advertiser: "Fashion Outlet",
    requestedBy: "John Smith",
    requestedDate: "2023-05-15",
    status: "pending",
    priority: "high",
    type: "billboard",
    location: "Downtown Main Street",
    duration: "2 weeks",
    startDate: "2023-06-01",
    endDate: "2023-06-15",
    thumbnail: "/led-billboard-1.png",
    approvals: {
      admin: null,
      sales: null,
    },
  },
  {
    id: "ORD-002",
    title: "New Product Launch Digital Display",
    advertiser: "Tech Innovations",
    requestedBy: "Sarah Johnson",
    requestedDate: "2023-05-18",
    status: "approved",
    priority: "medium",
    type: "digital",
    location: "Shopping Mall",
    duration: "1 month",
    startDate: "2023-06-01",
    endDate: "2023-07-01",
    thumbnail: "/led-billboard-2.png",
    approvals: {
      admin: {
        by: "Admin User",
        date: "2023-05-20",
      },
      sales: {
        by: "Sales Manager",
        date: "2023-05-19",
      },
    },
  },
  {
    id: "ORD-003",
    title: "Holiday Special Promotion",
    advertiser: "Retail Chain",
    requestedBy: "Michael Brown",
    requestedDate: "2023-05-20",
    status: "rejected",
    priority: "low",
    type: "billboard",
    location: "Highway Exit 42",
    duration: "3 weeks",
    startDate: "2023-12-01",
    endDate: "2023-12-21",
    thumbnail: "/led-billboard-3.png",
    approvals: {
      admin: {
        by: "Admin User",
        date: "2023-05-22",
        reason: "Content does not meet guidelines",
      },
      sales: null,
    },
  },
  {
    id: "ORD-004",
    title: "Grand Opening Announcement",
    advertiser: "New Restaurant",
    requestedBy: "Emily Davis",
    requestedDate: "2023-05-22",
    status: "pending",
    priority: "high",
    type: "digital",
    location: "Business District",
    duration: "2 weeks",
    startDate: "2023-06-15",
    endDate: "2023-06-29",
    thumbnail: "/led-billboard-4.png",
    approvals: {
      admin: null,
      sales: {
        by: "Sales Manager",
        date: "2023-05-23",
      },
    },
  },
  {
    id: "ORD-005",
    title: "Annual Sale Campaign",
    advertiser: "Department Store",
    requestedBy: "Robert Wilson",
    requestedDate: "2023-05-25",
    status: "pending",
    priority: "medium",
    type: "billboard",
    location: "City Center",
    duration: "1 month",
    startDate: "2023-07-01",
    endDate: "2023-07-31",
    thumbnail: "/roadside-billboard.png",
    approvals: {
      admin: {
        by: "Admin User",
        date: "2023-05-26",
      },
      sales: null,
    },
  },
  {
    id: "ORD-006",
    title: "Summer Festival Promotion",
    advertiser: "Event Company",
    requestedBy: "Lisa Johnson",
    requestedDate: "2023-05-28",
    status: "ongoing",
    priority: "high",
    type: "digital",
    location: "Festival Grounds",
    duration: "1 week",
    startDate: "2023-06-10",
    endDate: "2023-06-17",
    thumbnail: "/led-billboard-1.png",
    approvals: {
      admin: {
        by: "Admin User",
        date: "2023-05-29",
      },
      sales: {
        by: "Sales Manager",
        date: "2023-05-30",
      },
    },
  },
  {
    id: "ORD-007",
    title: "Holiday Season Campaign",
    advertiser: "Retail Store",
    requestedBy: "Mark Wilson",
    requestedDate: "2023-05-15",
    status: "completed",
    priority: "medium",
    type: "billboard",
    location: "Shopping District",
    duration: "1 month",
    startDate: "2023-05-01",
    endDate: "2023-05-31",
    thumbnail: "/led-billboard-2.png",
    approvals: {
      admin: {
        by: "Admin User",
        date: "2023-05-16",
      },
      sales: {
        by: "Sales Manager",
        date: "2023-05-16",
      },
    },
  },
  {
    id: "ORD-008",
    title: "Product Launch Campaign",
    advertiser: "Tech Company",
    requestedBy: "Sarah Brown",
    requestedDate: "2023-05-10",
    status: "canceled",
    priority: "high",
    type: "digital",
    location: "Tech Conference",
    duration: "2 weeks",
    startDate: "2023-06-15",
    endDate: "2023-06-29",
    thumbnail: "/led-billboard-3.png",
    approvals: {
      admin: {
        by: "Admin User",
        date: "2023-05-12",
      },
      sales: {
        by: "Sales Manager",
        date: "2023-05-11",
      },
    },
  },
]

type Order = (typeof mockOrders)[0]

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders)
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(mockOrders)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortField, setSortField] = useState<keyof Order>("requestedDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null)
  const [approvalRole, setApprovalRole] = useState<"admin" | "sales" | null>(null)
  const [processingApproval, setProcessingApproval] = useState(false)

  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Filter and sort orders
  useEffect(() => {
    let result = [...orders]

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (order) =>
          order.title.toLowerCase().includes(term) ||
          order.id.toLowerCase().includes(term) ||
          order.advertiser.toLowerCase().includes(term),
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter)
    }

    // Apply type filter
    if (typeFilter !== "all") {
      result = result.filter((order) => order.type === typeFilter)
    }

    // Sort results
    result.sort((a, b) => {
      const fieldA = a[sortField]
      const fieldB = b[sortField]

      if (typeof fieldA === "string" && typeof fieldB === "string") {
        return sortDirection === "asc" ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA)
      }

      return 0
    })

    setFilteredOrders(result)
  }, [orders, searchTerm, statusFilter, typeFilter, sortField, sortDirection])

  // Add status count calculation after the useEffect hook for filtering orders

  // Calculate counts for each status
  const getStatusCounts = () => {
    const counts = {
      all: orders.length,
      pending: 0,
      ongoing: 0,
      completed: 0,
      canceled: 0,
    }

    orders.forEach((order) => {
      if (counts[order.status as keyof typeof counts] !== undefined) {
        counts[order.status as keyof typeof counts]++
      }
    })

    return counts
  }

  const statusCounts = getStatusCounts()

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Search is already handled by the useEffect
  }

  // Handle sort
  const handleSort = (field: keyof Order) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // View order details
  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setDetailsOpen(true)
  }

  // Open approval dialog
  const handleApprovalAction = (order: Order, action: "approve" | "reject", role: "admin" | "sales") => {
    setSelectedOrder(order)
    setApprovalAction(action)
    setApprovalRole(role)
    setRejectionReason("")
    setApprovalDialogOpen(true)
  }

  // Process approval or rejection
  const processApprovalAction = async () => {
    if (!selectedOrder || !approvalAction || !approvalRole) return

    setProcessingApproval(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update order in state
      const updatedOrders = orders.map((order) => {
        if (order.id === selectedOrder.id) {
          const updatedOrder = { ...order }

          // Update approval status
          if (approvalAction === "approve") {
            updatedOrder.approvals[approvalRole] = {
              by: user?.displayName || "Current User",
              date: new Date().toISOString().split("T")[0],
            }
          } else {
            updatedOrder.approvals[approvalRole] = {
              by: user?.displayName || "Current User",
              date: new Date().toISOString().split("T")[0],
              reason: rejectionReason,
            }
          }

          // Update overall status if both approvals are complete
          if (
            updatedOrder.approvals.admin &&
            updatedOrder.approvals.sales &&
            !updatedOrder.approvals.admin.reason &&
            !updatedOrder.approvals.sales.reason
          ) {
            updatedOrder.status = "ongoing" // Changed from "approved" to "ongoing"
          } else if (
            (updatedOrder.approvals.admin && updatedOrder.approvals.admin.reason) ||
            (updatedOrder.approvals.sales && updatedOrder.approvals.sales.reason)
          ) {
            updatedOrder.status = "canceled" // Changed from "rejected" to "canceled"
          }

          return updatedOrder
        }
        return order
      })

      setOrders(updatedOrders)

      toast({
        title: `Order ${approvalAction === "approve" ? "Approved" : "Rejected"}`,
        description: `You have successfully ${approvalAction === "approve" ? "approved" : "rejected"} the order.`,
      })

      setApprovalDialogOpen(false)
      setSelectedOrder(null)
      setApprovalAction(null)
      setApprovalRole(null)
    } catch (error) {
      console.error("Error processing approval:", error)
      toast({
        title: "Error",
        description: "Failed to process your action. Please try again.",
        variant: "destructive",
      })
    } finally {
      setProcessingApproval(false)
    }
  }

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "rejected":
      case "canceled":
        return "bg-red-100 text-red-800 border-red-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "ongoing":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  // Get priority badge variant
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex flex-col gap-6">
        {/* Header with title and actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Advertising Orders</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Filter size={16} />
              Filters
            </Button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col gap-4">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="all">
                All
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium">
                  {statusCounts.all}
                </span>
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-100 text-yellow-800 px-1.5 text-xs font-medium">
                  {statusCounts.pending}
                </span>
              </TabsTrigger>
              <TabsTrigger value="ongoing">
                Ongoing
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 text-blue-800 px-1.5 text-xs font-medium">
                  {statusCounts.ongoing}
                </span>
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-100 text-green-800 px-1.5 text-xs font-medium">
                  {statusCounts.completed}
                </span>
              </TabsTrigger>
              <TabsTrigger value="canceled">
                Canceled
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 text-red-800 px-1.5 text-xs font-medium">
                  {statusCounts.canceled}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex w-full md:max-w-sm items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search orders..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button type="submit">Search</Button>
            </form>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="billboard">Billboard</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading orders...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No orders found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Orders table */}
        {!loading && filteredOrders.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Thumbnail</TableHead>
                  <TableHead>
                    <div className="flex items-center cursor-pointer" onClick={() => handleSort("title")}>
                      Order Details
                      {sortField === "title" && (
                        <ArrowUpDown
                          size={16}
                          className={`ml-1 ${sortDirection === "desc" ? "rotate-180" : ""} transition-transform`}
                        />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center cursor-pointer" onClick={() => handleSort("requestedDate")}>
                      Date
                      {sortField === "requestedDate" && (
                        <ArrowUpDown
                          size={16}
                          className={`ml-1 ${sortDirection === "desc" ? "rotate-180" : ""} transition-transform`}
                        />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewDetails(order)}
                  >
                    <TableCell>
                      <div className="h-12 w-12 bg-gray-200 rounded overflow-hidden relative">
                        <Image
                          src={order.thumbnail || "/placeholder.svg"}
                          alt={order.title || "Order thumbnail"}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/abstract-geometric-sculpture.png"
                            target.className = "opacity-50"
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.title}</div>
                        <div className="text-sm text-gray-500">
                          {order.id} • {order.advertiser}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">Requested: {order.requestedDate}</span>
                        <span className="text-sm text-gray-500">
                          {order.startDate} - {order.endDate}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadge(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                      <div className="mt-1">
                        <Badge variant="outline" className={getPriorityBadge(order.priority)}>
                          {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)} Priority
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">Admin:</span>
                          {order.approvals.admin ? (
                            order.approvals.admin.reason ? (
                              <XCircle size={16} className="text-red-500" />
                            ) : (
                              <CheckCircle2 size={16} className="text-green-500" />
                            )
                          ) : (
                            <Clock size={16} className="text-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">Sales:</span>
                          {order.approvals.sales ? (
                            order.approvals.sales.reason ? (
                              <XCircle size={16} className="text-red-500" />
                            ) : (
                              <CheckCircle2 size={16} className="text-green-500" />
                            )
                          ) : (
                            <Clock size={16} className="text-yellow-500" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(order)}>
                          <Eye size={16} className="mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedOrder.title}</DialogTitle>
                <DialogDescription>
                  Order ID: {selectedOrder.id} • Requested by: {selectedOrder.requestedBy}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 my-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Content Preview Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium border-b pb-2">Content Preview</h3>
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative h-48">
                    <Image
                      src={selectedOrder.thumbnail || "/placeholder.svg"}
                      alt={selectedOrder.title}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="text-gray-700">
                      {selectedOrder.title} - Advertising campaign for {selectedOrder.advertiser} to be displayed at{" "}
                      {selectedOrder.location} from {selectedOrder.startDate} to {selectedOrder.endDate}.
                    </p>
                  </div>
                </div>

                {/* Order Details Section */}
                <div>
                  <h3 className="text-lg font-medium border-b pb-2">Order Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Advertiser:</span>
                        <span className="font-medium">{selectedOrder.advertiser}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Type:</span>
                        <span className="font-medium capitalize">{selectedOrder.type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Location:</span>
                        <span className="font-medium">{selectedOrder.location}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Duration:</span>
                        <span className="font-medium">{selectedOrder.duration}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Priority:</span>
                        <Badge variant="outline" className={getPriorityBadge(selectedOrder.priority)}>
                          {selectedOrder.priority.charAt(0).toUpperCase() + selectedOrder.priority.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Requested Date:</span>
                        <span className="font-medium">{selectedOrder.requestedDate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Start Date:</span>
                        <span className="font-medium">{selectedOrder.startDate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">End Date:</span>
                        <span className="font-medium">{selectedOrder.endDate}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status:</span>
                        <Badge variant="outline" className={getStatusBadge(selectedOrder.status)}>
                          {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approvals Section */}
                <div>
                  <h3 className="text-lg font-medium border-b pb-2">Approvals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-3">Admin Approval</h4>
                        {selectedOrder.approvals.admin ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Status:</span>
                              {selectedOrder.approvals.admin.reason ? (
                                <div className="flex items-center text-red-600">
                                  <XCircle size={14} className="mr-1" />
                                  Rejected
                                </div>
                              ) : (
                                <div className="flex items-center text-green-600">
                                  <CheckCircle2 size={14} className="mr-1" />
                                  Approved
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">By:</span>
                              <span className="font-medium">{selectedOrder.approvals.admin.by}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Date:</span>
                              <span className="font-medium">{selectedOrder.approvals.admin.date}</span>
                            </div>
                            {selectedOrder.approvals.admin.reason && (
                              <div className="mt-1">
                                <span className="text-gray-500">Reason:</span>
                                <p className="mt-1 text-red-600 bg-red-50 p-2 rounded text-xs">
                                  {selectedOrder.approvals.admin.reason}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center text-yellow-600 mb-3 text-sm">
                              <Clock size={14} className="mr-1" />
                              Pending Approval
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApprovalAction(selectedOrder, "approve", "admin")}
                                className="flex-1 py-1 h-8 text-xs"
                                size="sm"
                              >
                                <CheckCircle2 size={14} className="mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleApprovalAction(selectedOrder, "reject", "admin")}
                                className="flex-1 py-1 h-8 text-xs"
                                size="sm"
                              >
                                <XCircle size={14} className="mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-3">Sales Approval</h4>
                        {selectedOrder.approvals.sales ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Status:</span>
                              {selectedOrder.approvals.sales.reason ? (
                                <div className="flex items-center text-red-600">
                                  <XCircle size={14} className="mr-1" />
                                  Rejected
                                </div>
                              ) : (
                                <div className="flex items-center text-green-600">
                                  <CheckCircle2 size={14} className="mr-1" />
                                  Approved
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">By:</span>
                              <span className="font-medium">{selectedOrder.approvals.sales.by}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Date:</span>
                              <span className="font-medium">{selectedOrder.approvals.sales.date}</span>
                            </div>
                            {selectedOrder.approvals.sales.reason && (
                              <div className="mt-1">
                                <span className="text-gray-500">Reason:</span>
                                <p className="mt-1 text-red-600 bg-red-50 p-2 rounded text-xs">
                                  {selectedOrder.approvals.sales.reason}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center text-yellow-600 mb-3 text-sm">
                              <Clock size={14} className="mr-1" />
                              Pending Approval
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApprovalAction(selectedOrder, "approve", "sales")}
                                className="flex-1 py-1 h-8 text-xs"
                                size="sm"
                              >
                                <CheckCircle2 size={14} className="mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleApprovalAction(selectedOrder, "reject", "sales")}
                                className="flex-1 py-1 h-8 text-xs"
                                size="sm"
                              >
                                <XCircle size={14} className="mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm">
                    {selectedOrder.status === "approved" || selectedOrder.status === "ongoing" ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle2 size={16} className="mr-2 flex-shrink-0" />
                        <span>This order has been fully approved and is ready for scheduling.</span>
                      </div>
                    ) : selectedOrder.status === "rejected" || selectedOrder.status === "canceled" ? (
                      <div className="flex items-center text-red-600">
                        <XCircle size={16} className="mr-2 flex-shrink-0" />
                        <span>This order has been rejected. Please review the rejection reasons.</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-yellow-600">
                        <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                        <span>This order requires approval from both Admin and Sales before it can be scheduled.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval/Rejection Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          {selectedOrder && approvalAction && approvalRole && (
            <>
              <DialogHeader>
                <DialogTitle>{approvalAction === "approve" ? "Approve" : "Reject"} Order</DialogTitle>
                <DialogDescription>
                  {approvalAction === "approve"
                    ? "Confirm that you want to approve this order."
                    : "Please provide a reason for rejecting this order."}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <h3 className="font-medium mb-2">{selectedOrder.title}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Order ID: {selectedOrder.id} • Advertiser: {selectedOrder.advertiser}
                </p>

                {approvalAction === "reject" && (
                  <div className="mt-4">
                    <label htmlFor="rejection-reason" className="block text-sm font-medium mb-2">
                      Reason for Rejection
                    </label>
                    <textarea
                      id="rejection-reason"
                      className="w-full p-2 border rounded-md"
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please explain why you are rejecting this order..."
                      required
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processApprovalAction}
                  disabled={(approvalAction === "reject" && !rejectionReason.trim()) || processingApproval}
                  className={
                    approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }
                >
                  {processingApproval && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {approvalAction === "approve" ? "Approve" : "Reject"} as{" "}
                  {approvalRole.charAt(0).toUpperCase() + approvalRole.slice(1)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
