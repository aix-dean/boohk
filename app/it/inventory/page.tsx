"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  HardDrive,
  Monitor,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Wrench,
  QrCode,
  Download,
  History,
  Copy,
  Printer,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, getDocs, doc, updateDoc, orderBy, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface InventoryItem {
  id: string
  name: string
  type: "hardware" | "software"
  category: string
  brand: string
  department: string
  assignedTo: string
  condition: "excellent" | "good" | "fair" | "poor" | "damaged"
  status: "active" | "inactive" | "maintenance" | "retired"
  cost: number
  currency: string
  purchaseDate: string
  warrantyExpiry: string
  serialNumber?: string
  licenseKey?: string
  version?: string
  description: string
  created_at: any
  updated_at: any
  created_by: string
  company_id: string
  deleted: boolean
}

interface User {
  id: string
  uid: string
  first_name: string
  last_name: string
  email: string
  company_id?: string
}

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200",
  maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  retired: "bg-red-100 text-red-800 border-red-200",
}

const conditionColors = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  fair: "bg-yellow-100 text-yellow-800 border-yellow-200",
  poor: "bg-orange-100 text-orange-800 border-orange-200",
  damaged: "bg-red-100 text-red-800 border-red-200",
}

const ITEMS_PER_PAGE = 10

export default function ITInventoryPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<string>("assets")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const fetchItems = async () => {
      if (!userData?.company_id) return

      try {
        const itemsRef = collection(db, "itInventory")
        const q = query(
          itemsRef,
          where("company_id", "==", userData.company_id),
          where("deleted", "==", false),
          orderBy("created_at", "desc"),
        )
        const querySnapshot = await getDocs(q)

        const fetchedItems: InventoryItem[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          fetchedItems.push({
            id: doc.id,
            name: data.name || "",
            type: data.type || "hardware",
            category: data.category || "",
            brand: data.brand || "",
            department: data.department || "",
            assignedTo: data.assignedTo || "unassigned",
            condition: data.condition || "excellent",
            status: data.status || "active",
            cost: data.cost || 0,
            currency: data.currency || "USD",
            purchaseDate: data.purchaseDate || "",
            warrantyExpiry: data.warrantyExpiry || "",
            serialNumber: data.serialNumber || "",
            licenseKey: data.licenseKey || "",
            version: data.version || "",
            description: data.description || "",
            created_at: data.created_at,
            updated_at: data.updated_at,
            created_by: data.created_by || "",
            company_id: data.company_id || "",
            deleted: data.deleted || false,
          })
        })

        setItems(fetchedItems)
      } catch (error) {
        console.error("Error fetching items:", error)
        toast({
          title: "Error",
          description: "Failed to load inventory items",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [userData?.company_id])

  useEffect(() => {
    const fetchUsers = async () => {
      if (!userData?.company_id) return

      try {
        const usersRef = collection(db, "iboard_users")
        const q = query(usersRef, where("company_id", "==", userData.company_id))
        const querySnapshot = await getDocs(q)

        const fetchedUsers: User[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          fetchedUsers.push({
            id: doc.id,
            uid: data.uid,
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            email: data.email || "",
            company_id: data.company_id,
          })
        })

        setUsers(fetchedUsers)
      } catch (error) {
        console.error("Error fetching users:", error)
      }
    }

    fetchUsers()
  }, [userData?.company_id])

  const getUserDisplayName = (uid: string) => {
    if (uid === "unassigned") return "Unassigned"
    const user = users.find((u) => u.uid === uid)
    if (!user) return "Unknown User"
    return `${user.first_name} ${user.last_name}`.trim() || user.email
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === "all" || item.type === typeFilter
    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    const matchesDepartment = departmentFilter === "all" || item.department === departmentFilter

    let matchesCategory = true
    if (activeTab === "assets") {
      matchesCategory =
        item.category.toLowerCase().includes("asset") ||
        item.category.toLowerCase().includes("computer") ||
        item.category.toLowerCase().includes("laptop") ||
        item.category.toLowerCase().includes("desktop") ||
        item.category.toLowerCase().includes("server") ||
        item.category.toLowerCase().includes("monitor") ||
        item.category.toLowerCase().includes("printer")
    } else if (activeTab === "consumables") {
      matchesCategory =
        item.category.toLowerCase().includes("consumable") ||
        item.category.toLowerCase().includes("cartridge") ||
        item.category.toLowerCase().includes("toner") ||
        item.category.toLowerCase().includes("paper") ||
        item.category.toLowerCase().includes("cable") ||
        item.category.toLowerCase().includes("battery")
    } else if (activeTab === "tools") {
      matchesCategory =
        item.category.toLowerCase().includes("tool") ||
        item.category.toLowerCase().includes("software") ||
        item.category.toLowerCase().includes("license") ||
        item.category.toLowerCase().includes("utility") ||
        item.category.toLowerCase().includes("application")
    }

    return matchesSearch && matchesType && matchesStatus && matchesDepartment && matchesCategory
  })

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, typeFilter, statusFilter, departmentFilter, activeTab])

  const handleEdit = useCallback(
    (item: InventoryItem) => {
      router.push(`/it/inventory/edit/${item.id}`)
    },
    [router],
  )

  const handleView = useCallback(
    (item: InventoryItem) => {
      router.push(`/it/inventory/details/${item.id}`)
    },
    [router],
  )

  const handleDelete = useCallback((item: InventoryItem) => {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }, [])

  const resetDeleteState = useCallback(() => {
    setDeleteDialogOpen(false)
    setItemToDelete(null)
    setIsDeleting(false)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!itemToDelete || isDeleting) return

    setIsDeleting(true)

    try {
      const itemRef = doc(db, "itInventory", itemToDelete.id)
      await updateDoc(itemRef, {
        deleted: true,
        deleted_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })

      setItems((prevItems) => prevItems.filter((item) => item.id !== itemToDelete.id))

      const deletedItemName = itemToDelete.name

      resetDeleteState()

      toast({
        title: "Item Deleted",
        description: `${deletedItemName} has been deleted from inventory`,
      })
    } catch (error) {
      console.error("Error deleting item:", error)

      resetDeleteState()

      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive",
      })
    }
  }, [itemToDelete, isDeleting, resetDeleteState])

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isDeleting) {
        resetDeleteState()
      }
    },
    [isDeleting, resetDeleteState],
  )

  const handleAddNew = useCallback(() => {
    router.push("/it/inventory/new")
  }, [router])

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const handlePageClick = (page: number) => {
    setCurrentPage(page)
  }

  const handleAssign = useCallback(
    (item: InventoryItem) => {
      // Navigate to assignment page or open assignment modal
      router.push(`/it/inventory/assign/${item.id}`)
    },
    [router],
  )

  const handleMaintenance = useCallback(async (item: InventoryItem) => {
    try {
      const itemRef = doc(db, "itInventory", item.id)
      const newStatus = item.status === "maintenance" ? "active" : "maintenance"

      await updateDoc(itemRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      })

      setItems((prevItems) =>
        prevItems.map((prevItem) => (prevItem.id === item.id ? { ...prevItem, status: newStatus } : prevItem)),
      )

      toast({
        title: "Status Updated",
        description: `Item marked as ${newStatus}`,
      })
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update item status",
        variant: "destructive",
      })
    }
  }, [])

  const handleGenerateQR = useCallback((item: InventoryItem) => {
    // Generate QR code for the item
    const qrData = JSON.stringify({
      id: item.id,
      name: item.name,
      serialNumber: item.serialNumber,
      category: item.category,
    })

    // Open QR code in new window or modal
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
    window.open(qrUrl, "_blank")

    toast({
      title: "QR Code Generated",
      description: "QR code opened in new tab",
    })
  }, [])

  const handleExport = useCallback(
    (item: InventoryItem) => {
      const exportData = {
        name: item.name,
        type: item.type,
        category: item.category,
        brand: item.brand,
        department: item.department,
        assignedTo: getUserDisplayName(item.assignedTo),
        condition: item.condition,
        status: item.status,
        cost: `${item.currency} ${item.cost}`,
        serialNumber: item.serialNumber,
        purchaseDate: item.purchaseDate,
        warrantyExpiry: item.warrantyExpiry,
        description: item.description,
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${item.name.replace(/\s+/g, "_")}_details.json`
      link.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Export Complete",
        description: "Item details exported successfully",
      })
    },
    [users],
  ) // Removed getUserDisplayName from dependencies

  const handleViewHistory = useCallback(
    (item: InventoryItem) => {
      router.push(`/it/inventory/history/${item.id}`)
    },
    [router],
  )

  const handleDuplicate = useCallback(
    (item: InventoryItem) => {
      router.push(`/it/inventory/new?duplicate=${item.id}`)
    },
    [router],
  )

  const handlePrintLabel = useCallback((item: InventoryItem) => {
    // Create a simple print-friendly label
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Asset Label - ${item.name}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .label { border: 2px solid #000; padding: 15px; width: 300px; }
              .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .info { margin: 5px 0; }
              .serial { font-family: monospace; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="title">${item.name}</div>
              <div class="info">Category: ${item.category}</div>
              <div class="info">Brand: ${item.brand}</div>
              <div class="info">Department: ${item.department}</div>
              <div class="info">Serial: <span class="serial">${item.serialNumber || "N/A"}</span></div>
              <div class="info">Status: ${item.status}</div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }

    toast({
      title: "Label Ready",
      description: "Asset label opened for printing",
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto p-6">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">Loading inventory...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">IT Inventory</h1>
            <p className="text-slate-600">Manage your IT assets and equipment</p>
          </div>
          <Button onClick={handleAddNew} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Add New Item
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items by name, brand, category, or serial number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="IT">IT Department</SelectItem>
                    <SelectItem value="HR">Human Resources</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Administration">Administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
          </p>
          {(searchTerm || typeFilter !== "all" || statusFilter !== "all" || departmentFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setTypeFilter("all")
                setStatusFilter("all")
                setDepartmentFilter("all")
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="consumables">Consumables</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">No items found</h3>
                      <p className="text-muted-foreground">
                        {items.length === 0
                          ? "Get started by adding your first inventory item"
                          : "Try adjusting your search or filter criteria"}
                      </p>
                    </div>
                    {items.length === 0 && (
                      <Button onClick={handleAddNew}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Item
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              {item.type === "hardware" ? (
                                <HardDrive className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Monitor className="h-4 w-4 text-green-600" />
                              )}
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {item.brand} • {item.category}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(statusColors[item.status])}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(conditionColors[item.condition])}>
                              {item.condition}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.department}</TableCell>
                          <TableCell>
                            <div className="max-w-[150px] truncate">{getUserDisplayName(item.assignedTo)}</div>
                          </TableCell>
                          <TableCell>
                            {item.cost > 0 ? (
                              <span>
                                {item.currency} {item.cost.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.serialNumber ? (
                              <span className="font-mono text-xs">{item.serialNumber}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleView(item)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(item)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAssign(item)}>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Assign/Reassign
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMaintenance(item)}>
                                  <Wrench className="h-4 w-4 mr-2" />
                                  {item.status === "maintenance" ? "Mark Active" : "Mark Maintenance"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleGenerateQR(item)}>
                                  <QrCode className="h-4 w-4 mr-2" />
                                  Generate QR Code
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport(item)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Export Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewHistory(item)}>
                                  <History className="h-4 w-4 mr-2" />
                                  View History
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate Item
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePrintLabel(item)}>
                                  <Printer className="h-4 w-4 mr-2" />
                                  Print Label
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(item)} className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {filteredItems.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber
                      if (totalPages <= 5) {
                        pageNumber = i + 1
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i
                      } else {
                        pageNumber = currentPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageClick(pageNumber)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNumber}
                        </Button>
                      )
                    })}
                  </div>

                  <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span>Delete Inventory Item</span>
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{itemToDelete?.name}"? This action will move the item to trash and it
                won't be visible in your inventory list.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
