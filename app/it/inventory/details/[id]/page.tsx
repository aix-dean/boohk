"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ArrowLeft, Edit, Trash2, Package, MapPin, DollarSign, Settings, Calendar, User, Building, Image, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface InventoryItem {
  id: string
  productNumber: string
  name: string
  type: "hardware" | "software"
  category: string
  brand: string
  department: string
  assignedTo: string
  condition: "excellent" | "good" | "fair" | "poor" | "damaged"
  vendorType: "physical" | "online"
  storeName: string
  storeLocation: string
  websiteName: string
  websiteUrl: string
  purchaseDate: string
  warrantyExpiry: string
  cost: number
  currency: string
  stock: number
  description: string
  serialNumber?: string
  specifications?: string
  licenseKey?: string
  version?: string
  categorySpecs?: Record<string, any>
  imageUrls: string[]
  status: "active" | "inactive" | "maintenance" | "retired"
  company_id: string
  created_by: string
  created_at: any
  updated_at: any
}

interface User {
  id: string
  uid: string
  first_name: string
  last_name: string
  email: string
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

export default function InventoryDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { userData } = useAuth()
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const itemId = params.id as string

  // Fetch users by company_id
  useEffect(() => {
    const fetchUsers = async () => {
      if (!userData?.company_id) return

      try {
        const usersRef = collection(db, "boohk_users")
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
          })
        })

        setUsers(fetchedUsers)
      } catch (error) {
        console.error("Error fetching users:", error)
      }
    }

    fetchUsers()
  }, [userData?.company_id])

  // Fetch item details
  useEffect(() => {
    const fetchItem = async () => {
      if (!itemId) return

      setLoading(true)
      try {
        const docRef = doc(db, "itInventory", itemId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          setItem({
            id: docSnap.id,
            productNumber: data.productNumber || "",
            name: data.name || "",
            type: data.type || "hardware",
            category: data.category || "",
            brand: data.brand || "",
            department: data.department || "",
            assignedTo: data.assignedTo || "unassigned",
            condition: data.condition || "excellent",
            vendorType: data.vendorType || "physical",
            storeName: data.storeName || "",
            storeLocation: data.storeLocation || "",
            websiteName: data.websiteName || "",
            websiteUrl: data.websiteUrl || "",
            purchaseDate: data.purchaseDate || "",
            warrantyExpiry: data.warrantyExpiry || "",
            cost: data.cost || 0,
            currency: data.currency || "USD",
            stock: data.stock || 0,
            description: data.description || "",
            serialNumber: data.serialNumber || "",
            specifications: data.specifications || "",
            licenseKey: data.licenseKey || "",
            version: data.version || "",
            categorySpecs: data.categorySpecs || {},
            imageUrls: data.imageUrls || [],
            status: data.status || "active",
            company_id: data.company_id || "",
            created_by: data.created_by || "",
            created_at: data.created_at,
            updated_at: data.updated_at,
          })
        } else {
          toast({
            title: "Item Not Found",
            description: "The requested inventory item could not be found.",
            variant: "destructive",
          })
          router.push("/it/inventory")
        }
      } catch (error) {
        console.error("Error fetching item:", error)
        toast({
          title: "Error",
          description: "Failed to load inventory item details.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchItem()
  }, [itemId, router])

  // Helper function to get user display name from uid
  const getUserDisplayName = (uid: string) => {
    if (uid === "unassigned") return "Unassigned"
    const user = users.find((u) => u.uid === uid)
    if (!user) return "Unknown User"
    return `${user.first_name} ${user.last_name}`.trim() || user.email
  }

  // Handle fullscreen image navigation
  const openFullscreen = (imageUrl: string, index: number) => {
    setFullscreenImage(imageUrl)
    setCurrentImageIndex(index)
  }

  const closeFullscreen = () => {
    setFullscreenImage(null)
    setCurrentImageIndex(0)
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!item?.imageUrls.length) return
    
    let newIndex = currentImageIndex
    if (direction === 'prev') {
      newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : item.imageUrls.length - 1
    } else {
      newIndex = currentImageIndex < item.imageUrls.length - 1 ? currentImageIndex + 1 : 0
    }
    
    setCurrentImageIndex(newIndex)
    setFullscreenImage(item.imageUrls[newIndex])
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!fullscreenImage) return
      
      switch (event.key) {
        case 'Escape':
          closeFullscreen()
          break
        case 'ArrowLeft':
          navigateImage('prev')
          break
        case 'ArrowRight':
          navigateImage('next')
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenImage, currentImageIndex, item?.imageUrls.length])

  const handleEdit = () => {
    setShowEditDialog(true)
  }

  const handleDelete = () => {
    // TODO: Implement delete functionality
    toast({
      title: "Delete Item",
      description: "Delete functionality will be implemented soon.",
    })
  }

  const handleBack = () => {
    router.push("/it/inventory")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Item Not Found</h2>
            <p className="text-gray-600 mb-6">The requested inventory item could not be found.</p>
            <Button onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleBack} className="shadow-sm bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{item.name}</h1>
              <p className="text-slate-600">Product #{item.productNumber}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge
              variant="outline"
              className={cn("text-sm px-3 py-1", statusColors[item.status])}
            >
              {item.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Item Type</label>
                    <p className="text-base font-medium capitalize">{item.type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="text-base font-medium">{item.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Brand</label>
                    <p className="text-base font-medium">{item.brand}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                    <p className="text-base font-medium">{item.department}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Condition</label>
                    <Badge
                      variant="outline"
                      className={cn("text-sm", conditionColors[item.condition])}
                    >
                      {item.condition}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Stock Quantity</label>
                    <p className="text-base font-medium">{item.stock} units</p>
                  </div>
                </div>
                {item.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-base mt-1">{item.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vendor Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Vendor Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Store Type</label>
                    <p className="text-base font-medium capitalize">
                      {item.vendorType === "physical" ? "Physical Store" : "Online Store"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Store Name</label>
                    <p className="text-base font-medium">{item.storeName || "Not specified"}</p>
                  </div>
                  {item.vendorType === "physical" && item.storeLocation && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Store Location</label>
                      <p className="text-base font-medium">{item.storeLocation}</p>
                    </div>
                  )}
                  {item.vendorType === "online" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Website Name</label>
                        <p className="text-base font-medium">{item.websiteName || "Not specified"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Website URL</label>
                        {item.websiteUrl ? (
                          <a
                            href={item.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-medium text-blue-600 hover:text-blue-800 underline break-all"
                          >
                            {item.websiteUrl}
                          </a>
                        ) : (
                          <p className="text-base font-medium">Not specified</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Financial & Warranty</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Purchase Cost</label>
                    <p className="text-base font-medium">
                      {item.cost > 0
                        ? `${item.currency} ${item.cost.toLocaleString()}`
                        : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Purchase Date</label>
                    <p className="text-base font-medium">
                      {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Warranty Expiry</label>
                    <p className="text-base font-medium">
                      {item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString() : "Not specified"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Technical Specifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Technical Specifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {item.type === "hardware" ? (
                    <>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Serial Number</label>
                        <p className="text-base font-medium font-mono">{item.serialNumber || "Not specified"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Specifications</label>
                        <p className="text-base font-medium">{item.specifications || "Not specified"}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">License Key</label>
                        <p className="text-base font-medium font-mono">{item.licenseKey || "Not specified"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Version</label>
                        <p className="text-base font-medium">{item.version || "Not specified"}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Category-specific specifications */}
                {item.categorySpecs && Object.keys(item.categorySpecs).length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold mb-4">Category Specifications</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(item.categorySpecs).map(([key, value]) => {
                        if (!value) return null
                        return (
                          <div key={key}>
                            <label className="text-sm font-medium text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                            <p className="text-base font-medium">{value}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Media Section */}
            {item.imageUrls && item.imageUrls.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Image className="h-5 w-5" />
                    <span>Media ({item.imageUrls.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {item.imageUrls.map((imageUrl, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity group relative"
                        onClick={() => openFullscreen(imageUrl, index)}
                      >
                        <img
                          src={imageUrl || "/placeholder.svg"}
                          alt={`${item.name} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white rounded-full p-2">
                              <Image className="h-4 w-4 text-gray-700" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Assignment & Metadata */}
          <div className="space-y-6">
            {/* Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Assignment</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                  <p className="text-base font-medium">{getUserDisplayName(item.assignedTo)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Department</label>
                  <p className="text-base font-medium">{item.department}</p>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Metadata</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-base font-medium">
                    {item.created_at ? new Date(item.created_at.toDate()).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-base font-medium">
                    {item.updated_at ? new Date(item.updated_at.toDate()).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created By</label>
                  <p className="text-base font-medium">{getUserDisplayName(item.created_by)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Company */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>Organization</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Company ID</label>
                  <p className="text-base font-medium font-mono">{item.company_id}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Fullscreen Image Dialog */}
        <Dialog open={!!fullscreenImage} onOpenChange={closeFullscreen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close Button */}
              <button
                onClick={closeFullscreen}
                className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Navigation Buttons */}
              {item && item.imageUrls.length > 1 && (
                <>
                  <button
                    onClick={() => navigateImage('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => navigateImage('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {item && item.imageUrls.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1} of {item.imageUrls.length}
                </div>
              )}

              {/* Instructions */}
              <div className="absolute bottom-4 right-4 z-50 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                Press ESC to close • Use arrow keys to navigate
              </div>

              {/* Main Image */}
              {fullscreenImage && (
                <img
                  src={fullscreenImage || "/placeholder.svg"}
                  alt={`${item?.name} - Fullscreen view`}
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Inventory Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Basic fields for editing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Item Name</Label>
                  <Input
                    id="edit-name"
                    defaultValue={item?.name || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-brand">Brand</Label>
                  <Input
                    id="edit-brand"
                    defaultValue={item?.brand || ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  defaultValue={item?.description || ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                // Handle save
                setIsEditing(true)
                // Simulate save
                setTimeout(() => {
                  setIsEditing(false)
                  setShowEditDialog(false)
                  toast({
                    title: "Item Updated",
                    description: "The item has been updated successfully.",
                  })
                }, 1000)
              }} disabled={isEditing}>
                {isEditing ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
