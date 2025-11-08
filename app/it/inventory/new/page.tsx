"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  Package,
  MapPin,
  DollarSign,
  Settings,
  Eye,
  HardDrive,
  Monitor,
  Globe,
  Upload,
  X,
  ImageIcon,
  Wrench,
  Key,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"

// Initialize Firebase Storage
const storage = getStorage()

interface FormData {
  productNumber: string
  name: string
  type: "assets" | "consumables" | "tools" | "license"
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
  cost: string
  currency?: string
  stock: string
  description: string
  serialNumber?: string
  specifications?: string
  licenseKey?: string
  version?: string
  // Category-specific fields
  categorySpecs?: Record<string, any>
  // Media fields
  images: File[]
  imageUrls: string[]
}

interface User {
  id: string
  uid: string
  first_name: string
  last_name: string
  email: string
  company_id?: string
  license_key?: string
}

const hardwareCategories = [
  "Desktop Computer",
  "Laptop",
  "Server",
  "Printer",
  "Network Switch",
  "Router",
  "Firewall",
  "Monitor",
  "Smartphone",
  "Tablet",
  "Storage Device",
  "Keyboard",
  "Mouse",
  "Webcam",
  "Headset",
  "Projector",
  "Scanner",
  "UPS",
  "Cable",
  "Docking Station",
]

const softwareCategories = [
  "Operating System",
  "Productivity Suite",
  "Design Software",
  "Security Software",
  "Database Software",
  "Development Tools",
  "Antivirus",
  "Backup Software",
  "Communication Software",
  "Project Management",
  "Accounting Software",
  "CRM Software",
  "ERP Software",
  "Media Software",
  "Browser",
  "Utility Software",
]

const consumablesCategories = ["Papers", "Photo Papers", "Sticker Papers", "Printer Ink", "Keyboards", "Mouse"]

// Helper function to get categories based on item type
const getCategoriesForType = (type: "hardware" | "software" | "consumables") => {
  if (type === "hardware") return hardwareCategories
  if (type === "software") return softwareCategories
  if (type === "consumables") return consumablesCategories
  return hardwareCategories
}

const getCategoryTypeForItemType = (
  itemType: "assets" | "consumables" | "tools" | "license",
): "hardware" | "software" | "consumables" => {
  // License items should show software categories since they're typically for software/OS
  if (itemType === "license") return "software"
  // Consumables should show consumables categories
  if (itemType === "consumables") return "consumables"
  // Assets are typically hardware items
  if (itemType === "assets") return "hardware"
  // Default to hardware for other types
  return "hardware"
}

// Generate product number
const generateProductNumber = () => {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `IT-${timestamp.slice(-6)}-${random}`
}

// Replace the static steps array with this dynamic one
const getAllSteps = () => [
  {
    id: 1,
    title: "Basic Info",
    description: "Item details",
    icon: Package,
    color: "bg-blue-500",
  },
  {
    id: 2,
    title: "Vendor Information",
    description: "Store details",
    icon: MapPin,
    color: "bg-green-500",
  },
  {
    id: 3,
    title: "Financial",
    description: "Cost & warranty",
    icon: DollarSign,
    color: "bg-yellow-500",
  },
  {
    id: 4,
    title: "Media",
    description: "Images",
    icon: ImageIcon,
    color: "bg-pink-500",
  },
  {
    id: 5,
    title: "Technical",
    description: "Specifications",
    icon: Settings,
    color: "bg-purple-500",
    showFor: "hardware", // Only show for hardware
  },
  {
    id: 6,
    title: "Review",
    description: "Final check",
    icon: Eye,
    color: "bg-indigo-500",
  },
]

const getVisibleSteps = (itemType: "hardware" | "software") => {
  return getAllSteps()
    .filter((step) => !step.showFor || step.showFor === itemType)
    .map((step, index) => ({ ...step, id: index + 1 })) // Renumber steps
}

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200",
  maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  retired: "bg-red-100 text-red-800 border-red-200",
}

export default function NewInventoryItemPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    productNumber: generateProductNumber(),
    name: "",
    type: "assets",
    category: "",
    brand: "",
    department: "",
    assignedTo: "",
    condition: "excellent",
    vendorType: "physical",
    storeName: "",
    storeLocation: "",
    websiteName: "",
    websiteUrl: "",
    purchaseDate: "",
    warrantyExpiry: "",
    cost: "",
    currency: "USD",
    stock: "",
    description: "",
    serialNumber: "",
    specifications: "",
    licenseKey: "",
    version: "",
    categorySpecs: {},
    images: [],
    imageUrls: [],
  })

  const visibleSteps = getVisibleSteps(formData.type)

  // Fetch users by company_id
  useEffect(() => {
    const fetchUsers = async () => {
      if (!userData?.company_id) return

      setLoadingUsers(true)
      try {
        console.log("Fetching users for company_id:", userData.company_id)

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
            license_key: data.license_key,
          })
        })

        console.log("Fetched users:", fetchedUsers)
        setUsers(fetchedUsers)
      } catch (error) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        })
      } finally {
        setLoadingUsers(false)
      }
    }

    fetchUsers()
  }, [userData?.company_id])

  // Add this useEffect after the existing useEffect
  useEffect(() => {
    // Reset to step 1 when item type changes to avoid being on a non-existent step
    if (currentStep > getVisibleSteps(formData.type).length) {
      setCurrentStep(1)
    }
  }, [formData.type, currentStep])

  // Helper function to get user display name from uid
  const getUserDisplayName = (uid: string) => {
    if (uid === "unassigned") return "Unassigned"
    const user = users.find((u) => u.uid === uid)
    if (!user) return "Unknown User"
    return `${user.first_name} ${user.last_name}`.trim() || user.email
  }

  // Helper function to update category-specific specs
  const updateCategorySpec = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      categorySpecs: {
        ...prev.categorySpecs,
        [field]: value,
      },
    }))
  }

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"))

    if (imageFiles.length !== files.length) {
      toast({
        title: "Invalid Files",
        description: "Only image files are allowed",
        variant: "destructive",
      })
    }

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...imageFiles],
    }))
  }

  // Remove image
  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
  }

  // Upload images to Firebase Storage
  const uploadImages = async (): Promise<string[]> => {
    if (formData.images.length === 0) return []

    setUploadingImages(true)
    const uploadPromises = formData.images.map(async (file) => {
      const fileName = `${Date.now()}-${file.name}`
      const storageRef = ref(storage, `inventory-images/${fileName}`)
      const snapshot = await uploadBytes(storageRef, file)
      return await getDownloadURL(snapshot.ref)
    })

    try {
      const urls = await Promise.all(uploadPromises)
      setUploadingImages(false)
      return urls
    } catch (error) {
      setUploadingImages(false)
      throw error
    }
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.name && formData.category && formData.brand && formData.department)
      case 2:
        return true // Optional fields
      case 3:
        return true // Optional fields
      case 4:
        return true // Optional fields
      case 5:
        return true // Optional fields
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields before proceeding",
        variant: "destructive",
      })
      return
    }

    if (currentStep < visibleSteps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(1)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Category, Brand, Department)",
        variant: "destructive",
      })
      return
    }

    if (!userData?.company_id) {
      toast({
        title: "Error",
        description: "User company information not found",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Upload images first
      const imageUrls = await uploadImages()

      // Prepare the data to be saved
      const itemData = {
        productNumber: formData.productNumber,
        name: formData.name,
        type: formData.type,
        category: formData.category,
        brand: formData.brand,
        department: formData.department,
        assignedTo: formData.assignedTo || "unassigned",
        condition: formData.condition,
        vendorType: formData.vendorType,
        storeName: formData.storeName || "",
        storeLocation: formData.storeLocation || "",
        websiteName: formData.websiteName || "",
        websiteUrl: formData.websiteUrl || "",
        purchaseDate: formData.purchaseDate || "",
        warrantyExpiry: formData.warrantyExpiry || "",
        cost: formData.cost ? Number.parseFloat(formData.cost) : 0,
        currency: formData.currency || "USD",
        stock: formData.stock ? Number.parseInt(formData.stock) : 0,
        description: formData.description || "",
        serialNumber: formData.serialNumber || "",
        specifications: formData.specifications || "",
        licenseKey: formData.licenseKey || "",
        version: formData.version || "",
        categorySpecs: formData.categorySpecs || {},
        imageUrls: imageUrls,
        status: "active", // Default status
        company_id: userData.company_id,
        created_by: userData.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        deleted: false, // Add deleted field set to false by default
      }

      console.log("Saving item data:", itemData)

      // Save to Firestore
      const docRef = await addDoc(collection(db, "itInventory"), itemData)

      console.log("Document written with ID: ", docRef.id)

      toast({
        title: "Item Created Successfully",
        description: `${formData.name} has been added to the inventory`,
      })

      router.push("/it/inventory")
    } catch (error) {
      console.error("Error adding document: ", error)
      toast({
        title: "Error",
        description: "Failed to create inventory item. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push("/it/inventory")
  }

  const renderStepContent = () => {
    const currentStepData = visibleSteps[currentStep - 1]
    if (!currentStepData) return null

    // Map the step title to the appropriate content
    switch (currentStepData.title) {
      case "Basic Info":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold">Basic Information</h2>
              <p className="text-muted-foreground">Let's start with the essential details of your inventory item</p>
            </div>

            <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="productNumber" className="text-base font-medium">
                      Product Number *
                    </Label>
                    <Input
                      id="productNumber"
                      value={formData.productNumber}
                      readOnly
                      className="h-12 text-base bg-gray-50 font-mono"
                    />
                    <p className="text-sm text-muted-foreground">Auto-generated product number</p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-base font-medium">
                      Item Name *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Dell OptiPlex 7090"
                      className="h-12 text-base"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="type" className="text-base font-medium">
                      Item Type *
                    </Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "assets" | "consumables" | "tools" | "license") =>
                        setFormData({ ...formData, type: value, category: "", categorySpecs: {} })
                      }
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assets">
                          <div className="flex items-center space-x-2">
                            <HardDrive className="h-4 w-4" />
                            <span>Assets</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="consumables">
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4" />
                            <span>Consumables</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="tools">
                          <div className="flex items-center space-x-2">
                            <Wrench className="h-4 w-4" />
                            <span>Tools</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="license">
                          <div className="flex items-center space-x-2">
                            <Key className="h-4 w-4" />
                            <span>License</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="category" className="text-base font-medium">
                      Category *
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value, categorySpecs: {} })}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder={`Select a ${formData.type} category`} />
                      </SelectTrigger>
                      <SelectContent>
                        {getCategoriesForType(getCategoryTypeForItemType(formData.type)).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">Choose from {formData.type} specific categories</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="brand" className="text-base font-medium">
                      Brand *
                    </Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g., Dell, Microsoft, Apple"
                      className="h-12 text-base"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="department" className="text-base font-medium">
                      Department *
                    </Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) => setFormData({ ...formData, department: value })}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="assignedTo" className="text-base font-medium">
                      Assigned To
                    </Label>
                    <Select
                      value={formData.assignedTo}
                      onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                      disabled={loadingUsers}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.uid} value={user.uid}>
                            <div className="flex flex-col">
                              <span>{`${user.first_name} ${user.last_name}`.trim() || user.email}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="condition" className="text-base font-medium">
                      Condition
                    </Label>
                    <Select
                      value={formData.condition}
                      onValueChange={(value: "excellent" | "good" | "fair" | "poor" | "damaged") =>
                        setFormData({ ...formData, condition: value })
                      }
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                            Excellent
                          </Badge>
                        </SelectItem>
                        <SelectItem value="good">
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                            Good
                          </Badge>
                        </SelectItem>
                        <SelectItem value="fair">
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            Fair
                          </Badge>
                        </SelectItem>
                        <SelectItem value="poor">
                          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                            Poor
                          </Badge>
                        </SelectItem>
                        <SelectItem value="damaged">
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                            Damaged
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="description" className="text-base font-medium">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide additional details about this item..."
                    rows={4}
                    className="text-base resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "Vendor Information":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <MapPin className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Vendor Information</h2>
              <p className="text-muted-foreground">Where did you purchase this item from?</p>
            </div>

            <Card className="border-2 border-dashed border-green-200 bg-green-50/30">
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="vendorType" className="text-base font-medium">
                      Store Type
                    </Label>
                    <Select
                      value={formData.vendorType}
                      onValueChange={(value: "physical" | "online") =>
                        setFormData({
                          ...formData,
                          vendorType: value,
                          storeLocation: value === "online" ? "" : formData.storeLocation,
                          websiteName: value === "physical" ? "" : formData.websiteName,
                          websiteUrl: value === "physical" ? "" : formData.websiteUrl,
                        })
                      }
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span>Physical Store</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="online">
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4" />
                            <span>Online Store</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose whether you purchased from a physical or online store
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="storeName" className="text-base font-medium">
                      Store Name
                    </Label>
                    <Input
                      id="storeName"
                      value={formData.storeName}
                      onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                      placeholder="e.g., Best Buy, Amazon, CDR King"
                      className="h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">Name of the store or vendor</p>
                  </div>
                </div>

                {formData.vendorType === "physical" && (
                  <div className="space-y-3">
                    <Label htmlFor="storeLocation" className="text-base font-medium">
                      Store Location
                    </Label>
                    <div className="space-y-2">
                      <GooglePlacesAutocomplete
                        value={formData.storeLocation}
                        onChange={(value) => setFormData({ ...formData, storeLocation: value })}
                        placeholder="Search for store location..."
                        className="h-12 text-base"
                        enableMap={true}
                        mapHeight="300px"
                      />
                      <p className="text-sm text-muted-foreground">
                        Search and select the exact location of the store on the map
                      </p>
                    </div>
                  </div>
                )}

                {formData.vendorType === "online" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="websiteName" className="text-base font-medium">
                        Website Name
                      </Label>
                      <Input
                        id="websiteName"
                        value={formData.websiteName}
                        onChange={(e) => setFormData({ ...formData, websiteName: e.target.value })}
                        placeholder="e.g., Amazon, eBay, Shopee"
                        className="h-12 text-base"
                      />
                      <p className="text-sm text-muted-foreground">Name of the online store or marketplace</p>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="websiteUrl" className="text-base font-medium">
                        Website URL
                      </Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="websiteUrl"
                          type="url"
                          value={formData.websiteUrl}
                          onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                          placeholder="https://www.example.com"
                          className="h-12 text-base pl-10"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">Full URL of the online store</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case "Financial":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                <DollarSign className="h-8 w-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold">Financial & Warranty</h2>
              <p className="text-muted-foreground">Track the financial aspects and warranty information</p>
            </div>

            <Card className="border-2 border-dashed border-yellow-200 bg-yellow-50/30">
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="cost" className="text-base font-medium">
                      Purchase Cost
                    </Label>
                    <div className="relative flex">
                      <Select
                        value={formData.currency || "USD"}
                        onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      >
                        <SelectTrigger className="h-12 w-24 rounded-r-none border-r-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="JPY">JPY</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="AUD">AUD</SelectItem>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="CNY">CNY</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="KRW">KRW</SelectItem>
                          <SelectItem value="SGD">SGD</SelectItem>
                          <SelectItem value="HKD">HKD</SelectItem>
                          <SelectItem value="NOK">NOK</SelectItem>
                          <SelectItem value="SEK">SEK</SelectItem>
                          <SelectItem value="DKK">DKK</SelectItem>
                          <SelectItem value="PLN">PLN</SelectItem>
                          <SelectItem value="CZK">CZK</SelectItem>
                          <SelectItem value="HUF">HUF</SelectItem>
                          <SelectItem value="RUB">RUB</SelectItem>
                          <SelectItem value="BRL">BRL</SelectItem>
                          <SelectItem value="MXN">MXN</SelectItem>
                          <SelectItem value="ZAR">ZAR</SelectItem>
                          <SelectItem value="TRY">TRY</SelectItem>
                          <SelectItem value="NZD">NZD</SelectItem>
                          <SelectItem value="PHP">PHP</SelectItem>
                          <SelectItem value="THB">THB</SelectItem>
                          <SelectItem value="MYR">MYR</SelectItem>
                          <SelectItem value="IDR">IDR</SelectItem>
                          <SelectItem value="VND">VND</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        placeholder="0.00"
                        className="h-12 text-base rounded-l-none flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="stock" className="text-base font-medium">
                      Stock Quantity
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="0"
                      className="h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">Number of items in stock</p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="purchaseDate" className="text-base font-medium">
                      Purchase Date
                    </Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="warrantyExpiry" className="text-base font-medium">
                      Warranty Expiry
                    </Label>
                    <Input
                      id="warrantyExpiry"
                      type="date"
                      value={formData.warrantyExpiry}
                      onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                      className="h-12 text-base"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "Media":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-100 mb-4">
                <ImageIcon className="h-8 w-8 text-pink-600" />
              </div>
              <h2 className="text-2xl font-bold">Media Upload</h2>
              <p className="text-muted-foreground">Upload images of your inventory item</p>
            </div>

            <Card className="border-2 border-dashed border-pink-200 bg-pink-50/30">
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium">Item Images</Label>

                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-pink-400 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-700 mb-2">Click to upload images</p>
                      <p className="text-sm text-gray-500">PNG, JPG, JPEG up to 10MB each</p>
                    </label>
                  </div>

                  {/* Image Preview */}
                  {formData.images.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Uploaded Images ({formData.images.length})</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {formData.images.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={URL.createObjectURL(file) || "/placeholder.svg"}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    You can upload multiple images. Only image files (PNG, JPG, JPEG) are allowed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "Technical":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                <Settings className="h-8 w-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold">Technical Specifications</h2>
              <p className="text-muted-foreground">
                Add {formData.type === "hardware" ? "hardware" : "software"}-specific technical details
              </p>
            </div>

            <Card className="border-2 border-dashed border-purple-200 bg-purple-50/30">
              <CardContent className="p-8 space-y-8">
                {formData.type === "hardware" ? (
                  <div className="space-y-8">
                    {/* Basic Hardware Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="serialNumber" className="text-base font-medium">
                          Serial Number
                        </Label>
                        <Input
                          id="serialNumber"
                          value={formData.serialNumber || ""}
                          onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                          placeholder="e.g., SN123456789"
                          className="h-12 text-base font-mono"
                        />
                        <p className="text-sm text-muted-foreground">Unique identifier for this hardware</p>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="specifications" className="text-base font-medium">
                          General Specifications
                        </Label>
                        <Input
                          id="specifications"
                          value={formData.specifications || ""}
                          onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                          placeholder="e.g., Intel i7, 16GB RAM, 512GB SSD"
                          className="h-12 text-base"
                        />
                        <p className="text-sm text-muted-foreground">Key technical specifications</p>
                      </div>
                    </div>

                    {/* Category-specific specifications */}
                    {formData.category === "Desktop Computer" && (
                      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Monitor className="h-5 w-5 mr-2" />
                          Desktop Computer Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Processor</Label>
                            <Input
                              placeholder="e.g., Intel Core i7-12700K, 3.6GHz"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.processor || ""}
                              onChange={(e) => updateCategorySpec("processor", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">RAM</Label>
                            <Input
                              placeholder="e.g., 16GB DDR4-3200"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.ram || ""}
                              onChange={(e) => updateCategorySpec("ram", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Storage</Label>
                            <Input
                              placeholder="e.g., 512GB NVMe SSD + 1TB HDD"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.storage || ""}
                              onChange={(e) => updateCategorySpec("storage", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Graphics Card</Label>
                            <Input
                              placeholder="e.g., NVIDIA RTX 3060, 12GB VRAM"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.graphics || ""}
                              onChange={(e) => updateCategorySpec("graphics", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Motherboard</Label>
                            <Input
                              placeholder="e.g., ASUS PRIME B660M-A"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.motherboard || ""}
                              onChange={(e) => updateCategorySpec("motherboard", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Power Supply</Label>
                            <Input
                              placeholder="e.g., 650W 80+ Gold"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.powerSupply || ""}
                              onChange={(e) => updateCategorySpec("powerSupply", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Operating System</Label>
                            <Input
                              placeholder="e.g., Windows 11 Pro 64-bit"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.operatingSystem || ""}
                              onChange={(e) => updateCategorySpec("operatingSystem", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Optical Drive</Label>
                            <Input
                              placeholder="e.g., DVD-RW, Blu-ray, None"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.opticalDrive || ""}
                              onChange={(e) => updateCategorySpec("opticalDrive", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mt-6">
                          <Label className="text-base font-medium">Expansion Slots</Label>
                          <Textarea
                            placeholder="e.g., 2x PCIe x16, 1x PCIe x1, 4x RAM slots"
                            className="mt-2 text-base resize-none"
                            rows={2}
                            value={formData.categorySpecs?.expansionSlots || ""}
                            onChange={(e) => updateCategorySpec("expansionSlots", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {formData.category === "Laptop" && (
                      <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Monitor className="h-5 w-5 mr-2" />
                          Laptop Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Processor</Label>
                            <Input
                              placeholder="e.g., Intel Core i7-1260P, 2.1GHz"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.processor || ""}
                              onChange={(e) => updateCategorySpec("processor", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">RAM</Label>
                            <Input
                              placeholder="e.g., 16GB LPDDR5-4800"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.ram || ""}
                              onChange={(e) => updateCategorySpec("ram", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Storage</Label>
                            <Input
                              placeholder="e.g., 512GB PCIe 4.0 NVMe SSD"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.storage || ""}
                              onChange={(e) => updateCategorySpec("storage", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Display</Label>
                            <Input
                              placeholder="e.g., 14-inch FHD IPS, 1920×1080"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.display || ""}
                              onChange={(e) => updateCategorySpec("display", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Graphics</Label>
                            <Input
                              placeholder="e.g., Intel Iris Xe Graphics"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.graphics || ""}
                              onChange={(e) => updateCategorySpec("graphics", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Battery</Label>
                            <Input
                              placeholder="e.g., 70Wh Li-ion, up to 10 hours"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.battery || ""}
                              onChange={(e) => updateCategorySpec("battery", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Keyboard</Label>
                            <Input
                              placeholder="e.g., Backlit, Full-size, Numeric pad"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.keyboard || ""}
                              onChange={(e) => updateCategorySpec("keyboard", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Webcam</Label>
                            <Input
                              placeholder="e.g., 720p HD, IR for Windows Hello"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.webcam || ""}
                              onChange={(e) => updateCategorySpec("webcam", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mt-6">
                          <Label className="text-base font-medium">Ports & Connectivity</Label>
                          <Textarea
                            placeholder="e.g., 2x USB-A 3.2, 2x USB-C Thunderbolt 4, HDMI 2.0, 3.5mm audio, Wi-Fi 6E, Bluetooth 5.2"
                            className="mt-2 text-base resize-none"
                            rows={2}
                            value={formData.categorySpecs?.connectivity || ""}
                            onChange={(e) => updateCategorySpec("connectivity", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {formData.category === "Monitor" && (
                      <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Monitor className="h-5 w-5 mr-2" />
                          Monitor Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Screen Size</Label>
                            <Input
                              placeholder="e.g., 27 inches (diagonal)"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.screenSize || ""}
                              onChange={(e) => updateCategorySpec("screenSize", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Resolution</Label>
                            <Input
                              placeholder="e.g., 2560×1440 (QHD)"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.resolution || ""}
                              onChange={(e) => updateCategorySpec("resolution", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Panel Type</Label>
                            <Input
                              placeholder="e.g., IPS, VA, TN, OLED"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.panelType || ""}
                              onChange={(e) => updateCategorySpec("panelType", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Refresh Rate</Label>
                            <Input
                              placeholder="e.g., 144Hz, 165Hz, 240Hz"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.refreshRate || ""}
                              onChange={(e) => updateCategorySpec("refreshRate", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Response Time</Label>
                            <Input
                              placeholder="e.g., 1ms GTG, 5ms"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.responseTime || ""}
                              onChange={(e) => updateCategorySpec("responseTime", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Brightness</Label>
                            <Input
                              placeholder="e.g., 400 nits, 1000 nits HDR"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.brightness || ""}
                              onChange={(e) => updateCategorySpec("brightness", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Contrast Ratio</Label>
                            <Input
                              placeholder="e.g., 1000:1, 3000:1"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.contrastRatio || ""}
                              onChange={(e) => updateCategorySpec("contrastRatio", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Color Gamut</Label>
                            <Input
                              placeholder="e.g., 99% sRGB, 95% DCI-P3"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.colorGamut || ""}
                              onChange={(e) => updateCategorySpec("colorGamut", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Connectivity</Label>
                            <Textarea
                              placeholder="e.g., HDMI 2.1, DisplayPort 1.4, USB-C with 90W PD, USB hub"
                              className="text-base resize-none"
                              rows={2}
                              value={formData.categorySpecs?.connectivity || ""}
                              onChange={(e) => updateCategorySpec("connectivity", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Adjustability</Label>
                            <Textarea
                              placeholder="e.g., Height, Tilt, Swivel, Pivot, VESA 100×100"
                              className="text-base resize-none"
                              rows={2}
                              value={formData.categorySpecs?.adjustability || ""}
                              onChange={(e) => updateCategorySpec("adjustability", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.category === "Printer" && (
                      <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Package className="h-5 w-5 mr-2" />
                          Printer Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Print Technology</Label>
                            <Input
                              placeholder="e.g., Laser, Inkjet, Thermal"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.printTechnology || ""}
                              onChange={(e) => updateCategorySpec("printTechnology", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Print Speed (Black)</Label>
                            <Input
                              placeholder="e.g., 30 ppm, 45 ppm"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.printSpeedBlack || ""}
                              onChange={(e) => updateCategorySpec("printSpeedBlack", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Print Speed (Color)</Label>
                            <Input
                              placeholder="e.g., 25 ppm, 40 ppm"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.printSpeedColor || ""}
                              onChange={(e) => updateCategorySpec("printSpeedColor", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Print Resolution</Label>
                            <Input
                              placeholder="e.g., 1200×1200 dpi, 4800×1200 dpi"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.printResolution || ""}
                              onChange={(e) => updateCategorySpec("printResolution", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Paper Capacity</Label>
                            <Input
                              placeholder="e.g., 250 sheets input, 100 sheets output"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.paperCapacity || ""}
                              onChange={(e) => updateCategorySpec("paperCapacity", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Paper Sizes</Label>
                            <Input
                              placeholder="e.g., A4, Letter, Legal, A3"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.paperSizes || ""}
                              onChange={(e) => updateCategorySpec("paperSizes", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Monthly Duty Cycle</Label>
                            <Input
                              placeholder="e.g., 50,000 pages, 100,000 pages"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.dutyCycle || ""}
                              onChange={(e) => updateCategorySpec("dutyCycle", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Memory</Label>
                            <Input
                              placeholder="e.g., 512MB, 1GB RAM"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.memory || ""}
                              onChange={(e) => updateCategorySpec("memory", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mt-6">
                          <Label className="text-base font-medium">Features</Label>
                          <Textarea
                            placeholder="e.g., Duplex printing, Scan, Copy, Fax, ADF, Touchscreen"
                            className="mt-2 text-base resize-none"
                            rows={2}
                            value={formData.categorySpecs?.features || ""}
                            onChange={(e) => updateCategorySpec("features", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {formData.category === "Network Switch" && (
                      <div className="bg-cyan-50 rounded-lg p-6 border border-cyan-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Globe className="h-5 w-5 mr-2" />
                          Network Switch Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Port Count</Label>
                            <Input
                              placeholder="e.g., 24 ports, 48 ports"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.portCount || ""}
                              onChange={(e) => updateCategorySpec("portCount", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Port Speed</Label>
                            <Input
                              placeholder="e.g., Gigabit Ethernet, 10GbE"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.portSpeed || ""}
                              onChange={(e) => updateCategorySpec("portSpeed", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Switching Capacity</Label>
                            <Input
                              placeholder="e.g., 48 Gbps, 176 Gbps"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.switchingCapacity || ""}
                              onChange={(e) => updateCategorySpec("switchingCapacity", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Forwarding Rate</Label>
                            <Input
                              placeholder="e.g., 35.7 Mpps, 130.9 Mpps"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.forwardingRate || ""}
                              onChange={(e) => updateCategorySpec("forwardingRate", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">MAC Address Table</Label>
                            <Input
                              placeholder="e.g., 8K entries, 16K entries"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.macTable || ""}
                              onChange={(e) => updateCategorySpec("macTable", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Power Consumption</Label>
                            <Input
                              placeholder="e.g., 25W, 45W, 180W"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.powerConsumption || ""}
                              onChange={(e) => updateCategorySpec("powerConsumption", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">PoE Support</Label>
                            <Input
                              placeholder="e.g., PoE+, PoE++, 370W budget"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.poeSupport || ""}
                              onChange={(e) => updateCategorySpec("poeSupport", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Management</Label>
                            <Input
                              placeholder="e.g., Managed, Unmanaged, Smart"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.management || ""}
                              onChange={(e) => updateCategorySpec("management", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mt-6">
                          <Label className="text-base font-medium">Features</Label>
                          <Textarea
                            placeholder="e.g., VLAN support, QoS, SNMP, Link aggregation, Spanning tree"
                            className="mt-2 text-base resize-none"
                            rows={2}
                            value={formData.categorySpecs?.features || ""}
                            onChange={(e) => updateCategorySpec("features", e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {formData.category === "Server" && (
                      <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <HardDrive className="h-5 w-5 mr-2" />
                          Server Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Processor</Label>
                            <Input
                              placeholder="e.g., Intel Xeon Silver 4314, 2.4GHz"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.processor || ""}
                              onChange={(e) => updateCategorySpec("processor", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">CPU Sockets</Label>
                            <Input
                              placeholder="e.g., 1 socket, 2 sockets"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.cpuSockets || ""}
                              onChange={(e) => updateCategorySpec("cpuSockets", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">RAM</Label>
                            <Input
                              placeholder="e.g., 64GB DDR4 ECC, 128GB"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.ram || ""}
                              onChange={(e) => updateCategorySpec("ram", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Max RAM Capacity</Label>
                            <Input
                              placeholder="e.g., 512GB, 1TB, 2TB"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.maxRam || ""}
                              onChange={(e) => updateCategorySpec("maxRam", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Storage Bays</Label>
                            <Input
                              placeholder="e.g., 8x 2.5-inch, 4x 3.5-inch"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.storageBays || ""}
                              onChange={(e) => updateCategorySpec("storageBays", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">RAID Controller</Label>
                            <Input
                              placeholder="e.g., Hardware RAID 0/1/5/10"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.raidController || ""}
                              onChange={(e) => updateCategorySpec("raidController", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Network Ports</Label>
                            <Input
                              placeholder="e.g., 4x 1GbE, 2x 10GbE"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.networkPorts || ""}
                              onChange={(e) => updateCategorySpec("networkPorts", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Power Supply</Label>
                            <Input
                              placeholder="e.g., 750W Redundant, 1200W"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.powerSupply || ""}
                              onChange={(e) => updateCategorySpec("powerSupply", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Expansion Slots</Label>
                            <Textarea
                              placeholder="e.g., 3x PCIe 4.0 x16, 2x PCIe 4.0 x8"
                              className="text-base resize-none"
                              rows={2}
                              value={formData.categorySpecs?.expansionSlots || ""}
                              onChange={(e) => updateCategorySpec("expansionSlots", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Management</Label>
                            <Textarea
                              placeholder="e.g., iDRAC, iLO, IPMI, Remote console"
                              className="text-base resize-none"
                              rows={2}
                              value={formData.categorySpecs?.management || ""}
                              onChange={(e) => updateCategorySpec("management", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.category === "Smartphone" && (
                      <div className="bg-pink-50 rounded-lg p-6 border border-pink-200">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <Monitor className="h-5 w-5 mr-2" />
                          Smartphone Specifications
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Processor</Label>
                            <Input
                              placeholder="e.g., Snapdragon 8 Gen 2, A16 Bionic"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.processor || ""}
                              onChange={(e) => updateCategorySpec("processor", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">RAM</Label>
                            <Input
                              placeholder="e.g., 8GB, 12GB LPDDR5"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.ram || ""}
                              onChange={(e) => updateCategorySpec("ram", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Storage</Label>
                            <Input
                              placeholder="e.g., 256GB, 512GB UFS 4.0"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.storage || ""}
                              onChange={(e) => updateCategorySpec("storage", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Display Size</Label>
                            <Input
                              placeholder="e.g., 6.7-inch, 6.1-inch"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.displaySize || ""}
                              onChange={(e) => updateCategorySpec("displaySize", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Display Type</Label>
                            <Input
                              placeholder="e.g., AMOLED, Super Retina XDR"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.displayType || ""}
                              onChange={(e) => updateCategorySpec("displayType", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Resolution</Label>
                            <Input
                              placeholder="e.g., 2796×1290, 1080×2400"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.resolution || ""}
                              onChange={(e) => updateCategorySpec("resolution", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Battery Capacity</Label>
                            <Input
                              placeholder="e.g., 5000mAh, 4323mAh"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.batteryCapacity || ""}
                              onChange={(e) => updateCategorySpec("batteryCapacity", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Charging Speed</Label>
                            <Input
                              placeholder="e.g., 67W fast charging, 20W MagSafe"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.chargingSpeed || ""}
                              onChange={(e) => updateCategorySpec("chargingSpeed", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Camera System</Label>
                            <Textarea
                              placeholder="e.g., 108MP main, 12MP ultrawide, 10MP telephoto, 32MP front"
                              className="text-base resize-none"
                              rows={2}
                              value={formData.categorySpecs?.cameraSystem || ""}
                              onChange={(e) => updateCategorySpec("cameraSystem", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Connectivity</Label>
                            <Textarea
                              placeholder="e.g., 5G, Wi-Fi 6E, Bluetooth 5.3, NFC, USB-C"
                              className="text-base resize-none"
                              rows={2}
                              value={formData.categorySpecs?.connectivity || ""}
                              onChange={(e) => updateCategorySpec("connectivity", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Software specifications
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="licenseKey" className="text-base font-medium">
                          License Key
                        </Label>
                        <Input
                          id="licenseKey"
                          value={formData.licenseKey || ""}
                          onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                          placeholder="e.g., XXXXX-XXXXX-XXXXX-XXXXX"
                          className="h-12 text-base font-mono"
                        />
                        <p className="text-sm text-muted-foreground">Software license or activation key</p>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="version" className="text-base font-medium">
                          Version
                        </Label>
                        <Input
                          id="version"
                          value={formData.version || ""}
                          onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                          placeholder="e.g., 2024.1.0"
                          className="h-12 text-base"
                        />
                        <p className="text-sm text-muted-foreground">Current software version</p>
                      </div>
                    </div>

                    {/* Software Details */}
                    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Monitor className="h-5 w-5 mr-2" />
                        Software Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-base font-medium">License Type</Label>
                          <Input
                            placeholder="e.g., Perpetual, Subscription, Volume"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.licenseType || ""}
                            onChange={(e) => updateCategorySpec("licenseType", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">User Licenses</Label>
                          <Input
                            placeholder="e.g., Single user, 5 users, Unlimited"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.userLicenses || ""}
                            onChange={(e) => updateCategorySpec("userLicenses", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Installation Media</Label>
                          <Input
                            placeholder="e.g., Download, DVD, USB, Cloud"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.installationMedia || ""}
                            onChange={(e) => updateCategorySpec("installationMedia", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Language</Label>
                          <Input
                            placeholder="e.g., English, Multi-language"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.language || ""}
                            onChange={(e) => updateCategorySpec("language", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Architecture</Label>
                          <Input
                            placeholder="e.g., 64-bit, 32-bit, Universal"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.architecture || ""}
                            onChange={(e) => updateCategorySpec("architecture", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">File Size</Label>
                          <Input
                            placeholder="e.g., 2.5 GB, 500 MB"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.fileSize || ""}
                            onChange={(e) => updateCategorySpec("fileSize", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* System Requirements */}
                    <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Settings className="h-5 w-5 mr-2" />
                        System Requirements
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Operating System</Label>
                          <Input
                            placeholder="e.g., Windows 10/11, macOS 12+, Linux"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.operatingSystem || ""}
                            onChange={(e) => updateCategorySpec("operatingSystem", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Minimum RAM</Label>
                          <Input
                            placeholder="e.g., 4GB, 8GB, 16GB"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.minRam || ""}
                            onChange={(e) => updateCategorySpec("minRam", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Recommended RAM</Label>
                          <Input
                            placeholder="e.g., 8GB, 16GB, 32GB"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.recommendedRam || ""}
                            onChange={(e) => updateCategorySpec("recommendedRam", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Storage Space</Label>
                          <Input
                            placeholder="e.g., 2GB, 10GB, 50GB available"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.storageSpace || ""}
                            onChange={(e) => updateCategorySpec("storageSpace", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Processor</Label>
                          <Input
                            placeholder="e.g., Intel i5 or equivalent, M1 chip"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.processor || ""}
                            onChange={(e) => updateCategorySpec("processor", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Graphics</Label>
                          <Input
                            placeholder="e.g., DirectX 11, OpenGL 4.0"
                            className="h-12 text-base"
                            value={formData.categorySpecs?.graphics || ""}
                            onChange={(e) => updateCategorySpec("graphics", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-6">
                        <Label className="text-base font-medium">Additional Requirements</Label>
                        <Textarea
                          placeholder="e.g., Internet connection for activation, .NET Framework 4.8, specific drivers"
                          className="mt-2 text-base resize-none"
                          rows={2}
                          value={formData.categorySpecs?.additionalRequirements || ""}
                          onChange={(e) => updateCategorySpec("additionalRequirements", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Features & Modules */}
                    <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Package className="h-5 w-5 mr-2" />
                        Features & Modules
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Included Features</Label>
                          <Textarea
                            placeholder="e.g., Document editing, Cloud sync, Collaboration tools, Advanced analytics"
                            className="text-base resize-none"
                            rows={3}
                            value={formData.categorySpecs?.includedFeatures || ""}
                            onChange={(e) => updateCategorySpec("includedFeatures", e.target.value)}
                          />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-base font-medium">Optional Modules/Add-ons</Label>
                          <Textarea
                            placeholder="e.g., Premium templates, Advanced reporting, API access, Mobile app"
                            className="text-base resize-none"
                            rows={2}
                            value={formData.categorySpecs?.optionalModules || ""}
                            onChange={(e) => updateCategorySpec("optionalModules", e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Support Level</Label>
                            <Input
                              placeholder="e.g., Basic, Premium, Enterprise"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.supportLevel || ""}
                              onChange={(e) => updateCategorySpec("supportLevel", e.target.value)}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Update Policy</Label>
                            <Input
                              placeholder="e.g., Free updates, Paid upgrades"
                              className="h-12 text-base"
                              value={formData.categorySpecs?.updatePolicy || ""}
                              onChange={(e) => updateCategorySpec("updatePolicy", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case "Review":
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                <Eye className="h-8 w-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold">Review & Submit</h2>
              <p className="text-muted-foreground">Please review all information before creating the inventory item</p>
            </div>

            <Card className="border-2 border-indigo-200">
              <CardHeader className="bg-indigo-50">
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>{formData.name || "Unnamed Item"}</span>
                </CardTitle>
                <CardDescription>{formData.description || "No description provided"}</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                        Basic Information
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Product Number:</span>
                          <span className="text-sm text-muted-foreground font-mono">{formData.productNumber}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Type:</span>
                          <Badge variant="secondary" className="capitalize">
                            {formData.type}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Category:</span>
                          <span className="text-sm text-muted-foreground">{formData.category || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Brand:</span>
                          <span className="text-sm text-muted-foreground">{formData.brand || "Not specified"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Department:</span>
                          <span className="text-sm text-muted-foreground">
                            {formData.department || "Not specified"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Condition:</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              formData.condition === "excellent" && "bg-green-100 text-green-800 border-green-200",
                              formData.condition === "good" && "bg-blue-100 text-blue-800 border-blue-200",
                              formData.condition === "fair" && "bg-yellow-100 text-yellow-800 border-yellow-200",
                              formData.condition === "poor" && "bg-orange-100 text-orange-800 border-orange-200",
                              formData.condition === "damaged" && "bg-red-100 text-red-800 border-red-200",
                            )}
                          >
                            {formData.condition}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                        Vendor & Assignment
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Store Type:</span>
                          <Badge variant="secondary" className="capitalize">
                            {formData.vendorType === "physical" ? "Physical Store" : "Online Store"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Store Name:</span>
                          <span className="text-sm text-muted-foreground">{formData.storeName || "Not specified"}</span>
                        </div>
                        {formData.vendorType === "physical" && (
                          <div className="flex justify-between items-start py-2 border-b border-muted">
                            <span className="text-sm font-medium">Store Location:</span>
                            <span className="text-sm text-muted-foreground text-right max-w-xs">
                              {formData.storeLocation || "Not specified"}
                            </span>
                          </div>
                        )}
                        {formData.vendorType === "online" && (
                          <>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                              <span className="text-sm font-medium">Website Name:</span>
                              <span className="text-sm text-muted-foreground">
                                {formData.websiteName || "Not specified"}
                              </span>
                            </div>
                            <div className="flex justify-between items-start py-2 border-b border-muted">
                              <span className="text-sm font-medium">Website URL:</span>
                              <span className="text-sm text-muted-foreground text-right max-w-xs break-all">
                                {formData.websiteUrl ? (
                                  <a
                                    href={formData.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline"
                                  >
                                    {formData.websiteUrl}
                                  </a>
                                ) : (
                                  "Not specified"
                                )}
                              </span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Assigned To:</span>
                          <span className="text-sm text-muted-foreground">
                            {getUserDisplayName(formData.assignedTo) || "Unassigned"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                        Financial & Warranty
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Cost:</span>
                          <span className="text-sm text-muted-foreground">
                            {formData.cost
                              ? `${formData.currency || "USD"} ${Number.parseFloat(formData.cost).toLocaleString()}`
                              : "Not specified"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Stock:</span>
                          <span className="text-sm text-muted-foreground">
                            {formData.stock ? `${formData.stock} units` : "Not specified"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Purchase Date:</span>
                          <span className="text-sm text-muted-foreground">
                            {formData.purchaseDate || "Not specified"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-muted">
                          <span className="text-sm font-medium">Warranty Expiry:</span>
                          <span className="text-sm text-muted-foreground">
                            {formData.warrantyExpiry || "Not specified"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Media Preview */}
                    {formData.images.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                          Media ({formData.images.length} images)
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {formData.images.slice(0, 6).map((file, index) => (
                            <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={URL.createObjectURL(file) || "/placeholder.svg"}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {formData.images.length > 6 && (
                            <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                              <span className="text-sm text-gray-500">+{formData.images.length - 6} more</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                        Technical Details
                      </h4>
                      <div className="space-y-3">
                        {formData.type === "hardware" ? (
                          <>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                              <span className="text-sm font-medium">Serial Number:</span>
                              <span className="text-sm text-muted-foreground font-mono">
                                {formData.serialNumber || "Not specified"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                              <span className="text-sm font-medium">Specifications:</span>
                              <span className="text-sm text-muted-foreground">
                                {formData.specifications || "Not specified"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                              <span className="text-sm font-medium">License Key:</span>
                              <span className="text-sm text-muted-foreground font-mono">
                                {formData.licenseKey || "Not specified"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                              <span className="text-sm font-medium">Version:</span>
                              <span className="text-sm text-muted-foreground">
                                {formData.version || "Not specified"}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Category-specific specs preview */}
                    {formData.categorySpecs && Object.keys(formData.categorySpecs).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                          Category Specifications
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(formData.categorySpecs).map(([key, value]) => {
                            if (!value) return null
                            return (
                              <div key={key} className="flex justify-between items-start py-2 border-b border-muted">
                                <span className="text-sm font-medium capitalize">
                                  {key.replace(/([A-Z])/g, " $1").trim()}:
                                </span>
                                <span className="text-sm text-muted-foreground text-right max-w-xs">{value}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleCancel} className="shadow-sm bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Add New Item</h1>
              <p className="text-slate-600">Create a new inventory item in {visibleSteps.length} simple steps</p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Step {currentStep} of {visibleSteps.length}
          </Badge>
        </div>

        {/* Modern Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-8 left-8 right-8 h-0.5 bg-slate-200 -z-10">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${((currentStep - 1) / (visibleSteps.length - 1)) * 100}%` }}
              />
            </div>

            {visibleSteps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id
              const isUpcoming = currentStep < step.id

              return (
                <div key={step.id} className="flex flex-col items-center relative">
                  <div
                    className={cn(
                      "flex items-center justify-center w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-lg",
                      isCompleted && "bg-gradient-to-r from-green-500 to-emerald-500 border-green-500 text-white",
                      isCurrent && `${step.color} border-white text-white shadow-xl scale-110`,
                      isUpcoming && "bg-white border-slate-300 text-slate-400",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-7 w-7" />
                    ) : (
                      <Icon className={cn("h-7 w-7", isCurrent && "animate-pulse")} />
                    )}
                  </div>
                  <div className="mt-4 text-center max-w-24">
                    <p
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        (isCompleted || isCurrent) && "text-slate-900",
                        isUpcoming && "text-slate-500",
                      )}
                    >
                      {step.title}
                    </p>
                    <p
                      className={cn(
                        "text-xs mt-1 transition-colors",
                        (isCompleted || isCurrent) && "text-slate-600",
                        isUpcoming && "text-slate-400",
                      )}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">{renderStepContent()}</div>

        {/* Navigation */}
        <div className="flex justify-between items-center bg-white rounded-lg p-6 shadow-sm border">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="shadow-sm bg-transparent"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center space-x-3">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            {currentStep < visibleSteps.length ? (
              <Button type="button" onClick={handleNext} className="shadow-sm">
                Next Step
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || uploadingImages}
                className="shadow-sm bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Creating..." : uploadingImages ? "Uploading..." : "Create Item"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
