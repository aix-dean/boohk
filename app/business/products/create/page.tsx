"use client"

import { useEffect, useState } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { createProduct, getUserProductsCount } from "@/lib/firebase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  ChevronDown,
  Upload,
  Trash2,
  ImageIcon,
  Film,
  X,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { subscriptionService } from "@/lib/subscription-service"
import { Timestamp, GeoPoint } from "firebase/firestore"

// Audience types for the dropdown
const AUDIENCE_TYPES = [
  "General Public",
  "Commuters",
  "Pedestrians",
  "Shoppers",
  "Business Professionals",
  "Tourists",
  "Students",
  "Mixed",
]

// Category interface
interface Category {
  id: string
  name: string
  type: string
  position: number
  photo_url?: string
}

// Step definitions
const getSteps = (contentType: string) => {
  const baseSteps = [
    { id: 1, title: "Site Data", description: "Basic product information and type" },
  ]

  // Only add Settings step for Dynamic content type
  if (contentType === "Dynamic") {
    baseSteps.push({
      id: 2,
      title: "Settings",
      description: "Configure dynamic content settings",
    })
  }

  // Add remaining steps
  const remainingSteps = [
    { id: contentType === "Dynamic" ? 3 : 2, title: "Location Information", description: "Site location and audience details" },
    { id: contentType === "Dynamic" ? 4 : 3, title: "Media", description: "Upload product media files" },
  ]

  return [...baseSteps, ...remainingSteps]
}

export default function BusinessProductCreatePage() {
  const router = useRouter()
  const { user, userData, subscriptionData } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [productName, setProductName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([])
  const [mediaDistances, setMediaDistances] = useState<string[]>([])
  const [mediaTypes, setMediaTypes] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  // Selected categories and audience types
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedAudienceTypes, setSelectedAudienceTypes] = useState<string[]>([])
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showAudienceDropdown, setShowAudienceDropdown] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    content_type: "Static",
    cms: {
      start_time: "",
      end_time: "",
      spot_duration: "",
      loops_per_day: "", // Fixed: was spot_per_loop, now consistent with validation
    },
    specs_rental: {
      audience_type: "",
      audience_types: [] as string[],
      geopoint: null as GeoPoint | null,
      location: "",
      traffic_count: "",
      elevation: "",
      height: "",
      width: "",
      site_orientation: "",
      land_owner: "",
      structure_color: "",
      structure_contractor: "",
      structure_condition: "",
      structure_last_maintenance: "",
      illumination_total_wattage: "",
      illumination_control_system: "",
      illumination_upper_count: "0",
      illumination_left_count: "0",
      illumination_bottom_count: "0",
      illumination_right_count: "0",
      illumination_upper_rows: "1",
      illumination_upper_cols: "1",
      illumination_left_rows: "1",
      illumination_left_cols: "1",
      illumination_bottom_rows: "1",
      illumination_bottom_cols: "1",
      illumination_right_rows: "1",
      illumination_right_cols: "1",
      quadrant_layout: "2x2",
      display_rows: "2",
      display_cols: "2",
      power_consumption_monthly: "",
      average_power_consumption_3months: "",
      illumination_upper_lighting_specs: "",
      illumination_left_lighting_specs: "",
      illumination_bottom_lighting_specs: "",
      illumination_right_lighting_specs: "",
      security: "",
      caretaker: "",
      lights_on_time: "",
    },
    type: "RENTAL",
    status: "PENDING",
  })

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const categoriesRef = collection(db, "categories")
        const q = query(categoriesRef, where("active", "==", true), where("deleted", "==", false))

        const querySnapshot = await getDocs(q)
        const categoriesData: Category[] = []

        querySnapshot.forEach((doc) => {
          const data = doc.data()
          categoriesData.push({
            id: doc.id,
            name: data.name,
            type: data.type,
            position: data.position || 0,
            photo_url: data.photo_url,
          })
        })

        // Sort categories by position
        categoriesData.sort((a, b) => a.position - b.position)
        setCategories(categoriesData)
      } catch (error) {
        console.error("Error fetching categories:", error)
        toast({
          title: "Error",
          description: "Failed to load categories. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    if (formData.content_type === "Dynamic") {
      validateDynamicContent()
    }
  }, [
    formData.cms.start_time,
    formData.cms.end_time,
    formData.cms.spot_duration,
    formData.cms.loops_per_day,
    formData.content_type,
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const safeValue = value || "" // Ensure value is never undefined

    if (name.includes(".")) {
      const [parent, child] = name.split(".")
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
          [child]: safeValue,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: safeValue,
      }))
    }
  }

  const handleLocationChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      specs_rental: {
        ...prev.specs_rental,
        location: value,
      },
    }))
  }

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId)
      } else {
        return [...prev, categoryId]
      }
    })
  }

  const toggleAudienceType = (audienceType: string) => {
    setSelectedAudienceTypes((prev) => {
      if (prev.includes(audienceType)) {
        return prev.filter((type) => type !== audienceType)
      } else {
        return [...prev, audienceType]
      }
    })

    setFormData((prev) => ({
      ...prev,
      specs_rental: {
        ...prev.specs_rental,
        audience_types: !selectedAudienceTypes.includes(audienceType)
          ? [...prev.specs_rental.audience_types, audienceType]
          : prev.specs_rental.audience_types.filter((type) => type !== audienceType),
      },
    }))
  }

  const handleGeopointChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = Number.parseFloat(e.target.value) || 0
    const currentGeopoint = formData.specs_rental.geopoint
    if (!currentGeopoint) return

    const lat = index === 0 ? value : currentGeopoint.latitude
    const lng = index === 1 ? value : currentGeopoint.longitude
    const newGeopoint = new GeoPoint(lat, lng)

    setFormData((prev) => ({
      ...prev,
      specs_rental: {
        ...prev.specs_rental,
        geopoint: newGeopoint,
      },
    }))
  }

  const handleContentTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      content_type: value,
    }))
    // Clear validation error when content type changes
    setValidationError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)

      // Create preview URLs for the new files
      const newPreviewUrls = newFiles.map((file) => URL.createObjectURL(file))

      // Automatically detect file types (image or video)
      const newTypes = newFiles.map((file) => (file.type.startsWith("video/") ? "Video" : "Photo"))

      // Add new files and previews
      setMediaFiles((prev) => [...prev, ...newFiles])
      setMediaPreviewUrls((prev) => [...prev, ...newPreviewUrls])
      setMediaTypes((prev) => [...prev, ...newTypes])

      // Initialize distances for new files
      setMediaDistances((prev) => [...prev, ...newFiles.map(() => "")])
    }
  }

  const handleMediaDistanceChange = (index: number, value: string) => {
    const newDistances = [...mediaDistances]
    newDistances[index] = value
    setMediaDistances(newDistances)
  }

  const handleRemoveMedia = (index: number) => {
    // Release the object URL to avoid memory leaks
    URL.revokeObjectURL(mediaPreviewUrls[index])

    // Remove the file and its associated data
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
    setMediaPreviewUrls((prev) => prev.filter((_, i) => i !== index))
    setMediaDistances((prev) => prev.filter((_, i) => i !== index))
    setMediaTypes((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadMediaFiles = async () => {
    if (mediaFiles.length === 0) {
      return [] // Return empty array if no media files
    }

    const storage = getStorage()
    const mediaData = []

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i]
      const isVideo = file.type.startsWith("video/")

      try {
        // Create a unique filename to avoid conflicts
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 15)
        const fileExtension = file.name.split(".").pop()
        const uniqueFileName = `${timestamp}_${randomString}.${fileExtension}`

        // Create a reference to the file in Firebase Storage
        const fileRef = ref(storage, `products/${uniqueFileName}`)

        console.log(`Uploading file ${i + 1}/${mediaFiles.length}:`, file.name)

        // Upload the file
        const snapshot = await uploadBytes(fileRef, file)
        console.log(`File ${i + 1} uploaded successfully`)

        // Get the download URL
        const url = await getDownloadURL(snapshot.ref)
        console.log(`Download URL obtained for file ${i + 1}:`, url)

        // Add the media data
        mediaData.push({
          url,
          distance: mediaDistances[i] || "Not specified",
          type: mediaTypes[i],
          isVideo,
        })
      } catch (error) {
        console.error(`Error uploading file ${i + 1}:`, error)
        throw new Error(`Failed to upload media file "${file.name}". Please try again.`)
      }
    }

    console.log("All media files uploaded successfully:", mediaData)
    return mediaData
  }

  const getCategoryNames = () => {
    return selectedCategories
      .map((id) => {
        const category = categories.find((cat) => cat.id === id)
        return category ? category.name : ""
      })
      .filter(Boolean)
  }

  // Enhanced validation function for dynamic content with detailed calculations
  const validateDynamicContent = () => {
    if (formData.content_type !== "Dynamic") {
      setValidationError(null)
      return true
    }

    const { start_time, end_time, spot_duration, loops_per_day } = formData.cms

    if (!start_time || !end_time || !spot_duration || !loops_per_day) {
      setValidationError("All dynamic content fields are required.")
      return false
    }

    try {
      // Parse start and end times
      const [startHour, startMinute] = start_time.split(":").map(Number)
      const [endHour, endMinute] = end_time.split(":").map(Number)

      // Validate time format
      if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
        setValidationError("Invalid time format.")
        return false
      }

      // Convert to total minutes
      const startTotalMinutes = startHour * 60 + startMinute
      let endTotalMinutes = endHour * 60 + endMinute

      // Handle next day scenario (e.g., 22:00 to 06:00)
      if (endTotalMinutes <= startTotalMinutes) {
        endTotalMinutes += 24 * 60 // Add 24 hours
      }

      // Calculate duration in minutes, then convert to seconds
      const durationMinutes = endTotalMinutes - startTotalMinutes
      const durationSeconds = durationMinutes * 60

      // Parse numeric values
      const spotDurationNum = Number.parseInt(spot_duration)
      const spotsPerLoopNum = Number.parseInt(loops_per_day)

      if (isNaN(spotDurationNum) || isNaN(spotsPerLoopNum) || spotDurationNum <= 0 || spotsPerLoopNum <= 0) {
        setValidationError("Spot duration and spots per loop must be positive numbers.")
        return false
      }

      // Calculate total spot time needed per loop
      const totalSpotTimePerLoop = spotDurationNum * spotsPerLoopNum

      // Calculate how many complete loops can fit in the time duration
      const loopsResult = durationSeconds / totalSpotTimePerLoop

      // Check if the division results in a whole number (integer)
      if (!Number.isInteger(loopsResult)) {
        // Calculate suggested values for correction
        const floorResult = Math.floor(loopsResult)
        const ceilResult = Math.ceil(loopsResult)

        // Calculate suggested spot durations for current spots per loop
        const suggestedSpotDurationFloor = Math.floor(durationSeconds / spotsPerLoopNum / floorResult)
        const suggestedSpotDurationCeil = Math.floor(durationSeconds / spotsPerLoopNum / ceilResult)

        // Calculate suggested spots per loop for current spot duration
        const suggestedSpotsPerLoopFloor = Math.floor(durationSeconds / spotDurationNum / floorResult)
        const suggestedSpotsPerLoopCeil = Math.floor(durationSeconds / spotDurationNum / ceilResult)

        // Format duration for display
        const durationHours = Math.floor(durationMinutes / 60)
        const remainingMinutes = durationMinutes % 60
        const durationDisplay = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`

        setValidationError(
          `Invalid Input: The current configuration results in ${loopsResult.toFixed(2)} loops, which is not a whole number. ` +
            `\n\nTime Duration: ${durationDisplay} (${durationSeconds} seconds)` +
            `\nCurrent Configuration: ${spotDurationNum}s × ${spotsPerLoopNum} spots = ${totalSpotTimePerLoop}s per loop` +
            `\nResult: ${durationSeconds}s ÷ ${totalSpotTimePerLoop}s = ${loopsResult.toFixed(2)} loops` +
            `\n\nSuggested corrections:` +
            `\n• Option 1: Change spot duration to ${suggestedSpotDurationFloor}s (for ${floorResult} complete loops)` +
            `\n• Option 2: Change spot duration to ${suggestedSpotDurationCeil}s (for ${ceilResult} complete loops)` +
            `\n• Option 3: Change spots per loop to ${suggestedSpotsPerLoopFloor} (for ${floorResult} complete loops)` +
            `\n• Option 4: Change spots per loop to ${suggestedSpotsPerLoopCeil} (for ${ceilResult} complete loops)`,
        )
        return false
      }

      // Success case - show calculation details
      const durationHours = Math.floor(durationMinutes / 60)
      const remainingMinutes = durationMinutes % 60
      const durationDisplay = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`

      setValidationError(
        `✓ Valid Configuration: ${Math.floor(loopsResult)} complete loops will fit in the ${durationDisplay} time period. ` +
          `Each loop uses ${totalSpotTimePerLoop}s (${spotDurationNum}s × ${spotsPerLoopNum} spots).`,
      )
      return true
    } catch (error) {
      console.error("Validation error:", error)
      setValidationError("Invalid time format or values.")
      return false
    }
  }

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: // Site Data
        if (!productName.trim()) {
          toast({
            title: "Validation Error",
            description: "Product name is required.",
            variant: "destructive",
          })
          return false
        }
        if (!price || Number.parseFloat(price) <= 0) {
          toast({
            title: "Validation Error",
            description: "Price must be a positive number.",
            variant: "destructive",
          })
          return false
        }
        return true

      case 2: // Dynamic Settings (only if Dynamic type)
        if (formData.content_type === "Dynamic") {
          return validateDynamicContent()
        }
        return true

      case 3: // Location Information
        if (!formData.specs_rental.location.trim()) {
          toast({
            title: "Validation Error",
            description: "Location is required.",
            variant: "destructive",
          })
          return false
        }
        return true

      case 4: // Media
        if (mediaFiles.length === 0) {
          toast({
            title: "Validation Error",
            description: "At least one media file is required.",
            variant: "destructive",
          })
          return false
        }
        return true

      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return
    }

    // Check if user is authenticated and has license key
    if (!user || !userData?.license_key) {
      toast({
        title: "Authentication Error",
        description: "User not authenticated or license key not found.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log("Starting product creation process...")
      console.log("User ID:", user.uid)
      console.log("User license key:", userData.license_key)

      // Check subscription limits before creating a product
      if (!subscriptionData) {
        console.log("No subscription data found, fetching...")
        const subscription = await subscriptionService.getSubscriptionByLicenseKey(userData.license_key)
        if (!subscription) {
          throw new Error("No active subscription found for this project.")
        }
        console.log("Subscription found:", subscription)
      }

      // Get the current count of non-deleted products for the user
      const currentProductsCount = await getUserProductsCount(user.uid, { deleted: false })
      console.log("Current products count:", currentProductsCount)

      if (subscriptionData?.maxProducts !== null && currentProductsCount >= subscriptionData.maxProducts) {
        throw new Error(
          `Product limit reached. Your current plan allows up to ${subscriptionData.maxProducts} products.`,
        )
      }

      // Upload media files first
      console.log("Uploading media files...")
      const mediaData = await uploadMediaFiles()
      console.log("Media upload completed:", mediaData)

      const contentType = formData.content_type === "Dynamic(LED)" ? "Dynamic" : formData.content_type

      // Get user display name
      const userName = userData.displayName || user.displayName || user.email || "Unknown User"

      const productData = {
        name: productName,
        description,
        price: Number.parseFloat(price),
        content_type: contentType,
        media: mediaData,
        categories: selectedCategories,
        category_names: getCategoryNames(),
        company_id: userData?.company_id || null,
        seller_id: user?.uid || "",
        seller_name:
          userData?.first_name && userData?.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : user?.email || "",
        site_owner:
          userData?.first_name && userData?.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : user?.displayName || user?.email || "Unknown Owner",
        active: true,
        deleted: false,
        seller_id: user.uid,
        seller_name: userName,
        status: formData.status,
        type: formData.type,
        position: 0,
        cms:
          contentType === "Dynamic"
            ? {
                start_time: formData.cms.start_time,
                end_time: formData.cms.end_time,
                spot_duration: Number.parseInt(formData.cms.spot_duration) || 0,
                loops_per_day: Number.parseInt(formData.cms.loops_per_day) || 0,
              }
            : null,
        specs_rental: {
          audience_types: selectedAudienceTypes,
          geopoint: formData.specs_rental.geopoint,
          location: formData.specs_rental.location,
          traffic_count: formData.specs_rental.traffic_count
            ? Number.parseInt(formData.specs_rental.traffic_count)
            : null,
          elevation: formData.specs_rental.elevation ? Number.parseFloat(formData.specs_rental.elevation) : null,
          height: formData.specs_rental.height ? Number.parseFloat(formData.specs_rental.height) : null,
          width: formData.specs_rental.width ? Number.parseFloat(formData.specs_rental.width) : null,
          site_orientation: formData.specs_rental.site_orientation || null,
          land_owner: formData.specs_rental.land_owner || null,
          structure_color: formData.specs_rental.structure_color || null,
          structure_contractor: formData.specs_rental.structure_contractor || null,
          structure_condition: formData.specs_rental.structure_condition || null,
          structure_last_maintenance: formData.specs_rental.structure_last_maintenance
            ? Timestamp.fromDate(new Date(formData.specs_rental.structure_last_maintenance))
            : null,
          quadrant_layout: formData.specs_rental.quadrant_layout,
          display_rows: formData.specs_rental.display_rows,
          display_cols: formData.specs_rental.display_cols,
          power_consumption_monthly: formData.specs_rental.power_consumption_monthly || null,
          average_power_consumption_3months: formData.specs_rental.average_power_consumption_3months || null,
          // Add the individual count fields
          illumination_upper_count: formData.specs_rental.illumination_upper_count || "0",
          illumination_left_count: formData.specs_rental.illumination_left_count || "0",
          illumination_bottom_count: formData.specs_rental.illumination_bottom_count || "0",
          illumination_right_count: formData.specs_rental.illumination_right_count || "0",
          // Keep the lighting specs as well
          illumination_upper_lighting_specs: formData.specs_rental.illumination_upper_lighting_specs || null,
          illumination_left_lighting_specs: formData.specs_rental.illumination_left_lighting_specs || null,
          illumination_bottom_lighting_specs: formData.specs_rental.illumination_bottom_lighting_specs || null,
          illumination_right_lighting_specs: formData.specs_rental.illumination_right_lighting_specs || null,
          security: formData.specs_rental.security || null,
          caretaker: formData.specs_rental.caretaker || null,
          lights_on_time: formData.specs_rental.lights_on_time || null,
        },
      }

      console.log("Creating product with data:", productData)
      await createProduct(productData)

      toast({
        title: "Product created",
        description: "Your product has been created successfully.",
      })

      // Clean up object URLs to prevent memory leaks
      mediaPreviewUrls.forEach((url) => URL.revokeObjectURL(url))

      router.push("/business/inventory")
    } catch (error) {
      console.error("Error creating product:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to create product. Please try again."
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const removeCategory = (categoryId: string) => {
    setSelectedCategories((prev) => prev.filter((id) => id !== categoryId))
  }

  const removeAudienceType = (audienceType: string) => {
    setSelectedAudienceTypes((prev) => prev.filter((type) => type !== audienceType))

    setFormData((prev) => ({
      ...prev,
      specs_rental: {
        ...prev.specs_rental,
        audience_types: prev.specs_rental.audience_types.filter((type) => type !== audienceType),
      },
    }))
  }

  const getStepTitle = () => {
    const step = getSteps(formData.content_type).find((s) => s.id === currentStep)
    return step ? step.title : "Unknown Step"
  }

  const getStepDescription = () => {
    const step = getSteps(formData.content_type).find((s) => s.id === currentStep)
    return step ? step.description : ""
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Site Data
        return (
          <div className="grid gap-6">
            {/* Basic Product Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-800">Basic Information</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    type="text"
                    placeholder="e.g., LED Billboard 10x20"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="A brief description of the product..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    step="0.01"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Content Type</Label>
                  <Select value={formData.content_type} onValueChange={handleContentTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Static">Static</SelectItem>
                      <SelectItem value="Dynamic">Dynamic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )

      case 2: // Settings (Dynamic) or Location Information (Static)
        if (formData.content_type === "Dynamic") {
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Content Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    name="cms.start_time"
                    type="time"
                    value={formData.cms.start_time || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    name="cms.end_time"
                    type="time"
                    value={formData.cms.end_time || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spot_duration">Spot Duration (seconds)</Label>
                  <Input
                    id="spot_duration"
                    name="cms.spot_duration"
                    type="number"
                    value={formData.cms.spot_duration || ""}
                    onChange={handleInputChange}
                    placeholder="Enter duration in seconds"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spot_per_loop">Spots Per Loop</Label>
                  <Input
                    id="loops_per_day"
                    name="cms.loops_per_day"
                    type="number"
                    value={formData.cms.loops_per_day || ""}
                    onChange={handleInputChange}
                    placeholder="Enter spots per loop"
                    required
                  />
                </div>
              </div>

              {/* Validation feedback display */}
              {validationError && (
                <div
                  className={`p-4 rounded-lg border ${
                    validationError.startsWith("✓")
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <div className="text-sm font-medium mb-2">
                    {validationError.startsWith("✓") ? "Configuration Valid" : "Configuration Error"}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono">{validationError}</pre>
                </div>
              )}
            </div>
          )
        } else {
          // Static content type - Location Information
          return (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-800">Location Information</h3>

              <div className="space-y-2">
                <Label htmlFor="specs_rental.location">
                  Location <span className="text-red-500">*</span>
                </Label>
                <GooglePlacesAutocomplete
                  value={formData.specs_rental.location}
                  onChange={handleLocationChange}
                  placeholder="Enter site location"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience_types">Audience Types (Multiple)</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between bg-transparent"
                    onClick={() => setShowAudienceDropdown(!showAudienceDropdown)}
                    disabled={loading}
                  >
                    <span>
                      {selectedAudienceTypes.length > 0
                        ? `${selectedAudienceTypes.length} audience types selected`
                        : "Select audience types"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAudienceDropdown ? "rotate-180" : "rotate-0"}`}
                    />
                  </Button>
                  {showAudienceDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {AUDIENCE_TYPES.map((type) => (
                        <div
                          key={type}
                          className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => toggleAudienceType(type)}
                        >
                          <div className="flex-1">{type}</div>
                          {selectedAudienceTypes.includes(type) ? <Check className="h-4 w-4 text-green-500" /> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedAudienceTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedAudienceTypes.map((type) => (
                      <Badge key={type} variant="secondary" className="flex items-center gap-1 pr-1">
                        {type}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => removeAudienceType(type)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="specs_rental.traffic_count">Traffic Count (Daily)</Label>
                  <Input
                    id="specs_rental.traffic_count"
                    name="specs_rental.traffic_count"
                    type="number"
                    value={formData.specs_rental.traffic_count || ""}
                    onChange={handleInputChange}
                    placeholder="Enter average daily traffic count"
                    min="0"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specs_rental.elevation">Elevation (ft)</Label>
                  <Input
                    id="specs_rental.elevation"
                    name="specs_rental.elevation"
                    type="number"
                    value={formData.specs_rental.elevation || ""}
                    onChange={handleInputChange}
                    placeholder="Enter elevation from ground level in feet"
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="specs_rental.height">Height (ft)</Label>
                  <Input
                    id="specs_rental.height"
                    name="specs_rental.height"
                    type="number"
                    value={formData.specs_rental.height || ""}
                    onChange={handleInputChange}
                    placeholder="Enter height in feet"
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specs_rental.width">Width (ft)</Label>
                  <Input
                    id="specs_rental.width"
                    name="specs_rental.width"
                    type="number"
                    value={formData.specs_rental.width || ""}
                    onChange={handleInputChange}
                    placeholder="Enter width in feet"
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    value={formData.specs_rental.geopoint?.latitude || ""}
                    onChange={(e) => handleGeopointChange(e, 0)}
                    placeholder="Enter latitude"
                    step="0.000001"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    value={formData.specs_rental.geopoint?.longitude || ""}
                    onChange={(e) => handleGeopointChange(e, 1)}
                    placeholder="Enter longitude"
                    step="0.000001"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )
        }

      case 3: // Location Information (Dynamic) or Media (Static)
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Location Information</h3>

            <div className="space-y-2">
              <Label htmlFor="specs_rental.location">
                Location <span className="text-red-500">*</span>
              </Label>
              <GooglePlacesAutocomplete
                value={formData.specs_rental.location}
                onChange={handleLocationChange}
                placeholder="Enter site location"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience_types">Audience Types (Multiple)</Label>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between bg-transparent"
                  onClick={() => setShowAudienceDropdown(!showAudienceDropdown)}
                  disabled={loading}
                >
                  <span>
                    {selectedAudienceTypes.length > 0
                      ? `${selectedAudienceTypes.length} audience types selected`
                      : "Select audience types"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAudienceDropdown ? "rotate-180" : "rotate-0"}`}
                  />
                </Button>
                {showAudienceDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {AUDIENCE_TYPES.map((type) => (
                      <div
                        key={type}
                        className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => toggleAudienceType(type)}
                      >
                        <div className="flex-1">{type}</div>
                        {selectedAudienceTypes.includes(type) ? <Check className="h-4 w-4 text-green-500" /> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedAudienceTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAudienceTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="flex items-center gap-1 pr-1">
                      {type}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => removeAudienceType(type)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="specs_rental.traffic_count">Traffic Count (Daily)</Label>
                <Input
                  id="specs_rental.traffic_count"
                  name="specs_rental.traffic_count"
                  type="number"
                  value={formData.specs_rental.traffic_count || ""}
                  onChange={handleInputChange}
                  placeholder="Enter average daily traffic count"
                  min="0"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specs_rental.elevation">Elevation (ft)</Label>
                <Input
                  id="specs_rental.elevation"
                  name="specs_rental.elevation"
                  type="number"
                  value={formData.specs_rental.elevation || ""}
                  onChange={handleInputChange}
                  placeholder="Enter elevation from ground level in feet"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="specs_rental.height">Height (ft)</Label>
                <Input
                  id="specs_rental.height"
                  name="specs_rental.height"
                  type="number"
                  value={formData.specs_rental.height || ""}
                  onChange={handleInputChange}
                  placeholder="Enter height in feet"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specs_rental.width">Width (ft)</Label>
                <Input
                  id="specs_rental.width"
                  name="specs_rental.width"
                  type="number"
                  value={formData.specs_rental.width || ""}
                  onChange={handleInputChange}
                  placeholder="Enter width in feet"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  value={formData.specs_rental.geopoint?.latitude || ""}
                  onChange={(e) => handleGeopointChange(e, 0)}
                  placeholder="Enter latitude"
                  step="0.000001"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  value={formData.specs_rental.geopoint?.longitude || ""}
                  onChange={(e) => handleGeopointChange(e, 1)}
                  placeholder="Enter longitude"
                  step="0.000001"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )

      case 4: // Media
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">
              Media <span className="text-red-500">*</span>
            </h3>

            <div
              className={`border-2 border-dashed ${
                mediaFiles.length === 0 ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"
              } rounded-lg p-8 text-center transition-colors duration-200`}
            >
              <input
                type="file"
                id="media-upload"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileChange}
                required={mediaFiles.length === 0}
                disabled={loading}
              />
              <label htmlFor="media-upload" className="flex flex-col items-center justify-center cursor-pointer">
                <Upload className={`h-12 w-12 ${mediaFiles.length === 0 ? "text-red-500" : "text-gray-500"} mb-3`} />
                <p className="text-base font-medium text-gray-700 mb-1">Click to upload or drag and drop</p>
                <p className="text-sm text-gray-500">Images or videos (max 10MB each)</p>
                {mediaFiles.length === 0 && (
                  <p className="text-sm text-red-600 mt-3 font-medium">At least one media file is required</p>
                )}
              </label>
            </div>

            {mediaPreviewUrls.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-base font-medium text-gray-700">Uploaded Media</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mediaPreviewUrls.map((url, index) => {
                    const isVideo = mediaTypes[index] === "Video"
                    return (
                      <Card key={index} className="relative group overflow-hidden">
                        <CardContent className="p-0">
                          <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                            {isVideo ? (
                              <video src={url} controls className="w-full h-full object-contain" />
                            ) : (
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex items-center text-sm font-medium text-gray-700">
                              {isVideo ? (
                                <Film className="h-4 w-4 mr-2 text-blue-500" />
                              ) : (
                                <ImageIcon className="h-4 w-4 mr-2 text-green-500" />
                              )}
                              <span>
                                {isVideo ? "Video" : "Image"} {index + 1}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`media-distance-${index}`} className="text-xs text-gray-600">
                                Viewing Distance
                              </Label>
                              <Input
                                id={`media-distance-${index}`}
                                value={mediaDistances[index]}
                                onChange={(e) => handleMediaDistanceChange(index, e.target.value)}
                                placeholder="e.g., 100m"
                                className="h-9 text-sm"
                                disabled={loading}
                              />
                            </div>
                          </div>
                        </CardContent>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMedia(index)}
                          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/80 text-red-500 hover:bg-white hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                          aria-label="Remove media"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const getMaxStep = () => {
    return 4 // Always 4 steps now
  }

  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
      <div className="mx-auto grid w-full max-w-6xl gap-2">
        <h1 className="text-3xl font-semibold">Create New Product</h1>
        <p className="text-muted-foreground">Fill in the details to add a new product to your inventory.</p>
      </div>

      {/* Step Indicator */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          {getSteps(formData.content_type).map((step, index, filteredSteps) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep === step.id
                    ? "bg-blue-600 border-blue-600 text-white"
                    : currentStep > step.id
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white border-gray-300 text-gray-500"
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
              {index < filteredSteps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className="h-0.5 bg-gray-300"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex justify-center">
        <div className="grid gap-6 w-full max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>{getStepTitle()}</CardTitle>
              <CardDescription>{getStepDescription()}</CardDescription>
            </CardHeader>
            <CardContent>{renderStepContent()}</CardContent>
            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentStep === getMaxStep() ? (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Product"
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
