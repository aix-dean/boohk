"use client"

import { Skeleton } from "@/components/ui/skeleton"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Upload, Trash2, AlertCircle, ImageIcon, Film, X, Check, Loader2 } from "lucide-react"
import { getProductById, updateProduct } from "@/lib/firebase-service"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { Product } from "@/lib/firebase-service"

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

export default function AdminEditProductPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([])
  const [mediaDistances, setMediaDistances] = useState<string[]>([])
  const [mediaTypes, setMediaTypes] = useState<string[]>([])
  const [existingMedia, setExistingMedia] = useState<Product["media"]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)

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
      spots_per_loop: "",
      loops_per_day: "",
    },
    specs_rental: {
      audience_type: "",
      audience_types: [] as string[],
      geopoint: [0, 0] as [number, number],
      location: "",
      traffic_count: "",
      elevation: "",
      height: "",
      width: "",
    },
    type: "RENTAL", // Default type
    status: "PENDING", // Default status
  })

  // Fetch product data
  useEffect(() => {
    async function fetchProductData() {
      if (!params.id) return

      const productId = Array.isArray(params.id) ? params.id[0] : params.id

      try {
        setIsLoading(true)
        const productData = await getProductById(productId)

        if (!productData) {
          setError("Product not found")
          return
        }

        setProduct(productData)

        // Initialize form data with product data
        setFormData({
          name: productData.name || "",
          description: productData.description || "",
          price: productData.price ? String(productData.price) : "",
          content_type: productData.content_type === "Dynamic" ? "Dynamic(LED)" : productData.content_type || "Static",
          cms: {
            spots_per_loop: productData.cms?.spots_per_loop ? String(productData.cms.spots_per_loop) : "",
            loops_per_day: productData.cms?.loops_per_day ? String(productData.cms.loops_per_day) : "",
          },
          specs_rental: {
            audience_type: productData.specs_rental?.audience_type || "",
            audience_types: productData.specs_rental?.audience_types || [],
            geopoint: productData.specs_rental?.geopoint || [0, 0],
            location: productData.specs_rental?.location || "",
            traffic_count: productData.specs_rental?.traffic_count
              ? String(productData.specs_rental.traffic_count)
              : "",
            elevation: productData.specs_rental?.elevation ? String(productData.specs_rental.elevation) : "",
            height: productData.specs_rental?.height ? String(productData.specs_rental.height) : "",
            width: productData.specs_rental?.width ? String(productData.specs_rental.width) : "",
          },
          type: productData.type || "RENTAL",
          status: productData.status || "PENDING",
        })

        // Set existing media
        if (productData.media && productData.media.length > 0) {
          setExistingMedia(productData.media)
        }

        // Set selected categories
        if (productData.categories && productData.categories.length > 0) {
          setSelectedCategories(productData.categories)
        }

        // Set selected audience types
        if (productData.specs_rental?.audience_types && productData.specs_rental.audience_types.length > 0) {
          setSelectedAudienceTypes(productData.specs_rental.audience_types)
        }
      } catch (error) {
        console.error("Error fetching product:", error)
        setError("Failed to load product data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProductData()
  }, [params.id])

  // Fetch categories on component mount
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
      } finally {
        setIsLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target

    if (name.includes(".")) {
      const [parent, child] = name.split(".")
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
          [child]: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  // Handle location change from GooglePlacesAutocomplete
  const handleLocationChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      specs_rental: {
        ...prev.specs_rental,
        location: value,
      },
    }))
  }

  // Handle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId)
      } else {
        return [...prev, categoryId]
      }
    })
  }

  // Handle audience type selection
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
        audience_types: selectedAudienceTypes.includes(audienceType)
          ? prev.specs_rental.audience_types.filter((type) => type !== audienceType)
          : [...prev.specs_rental.audience_types, audienceType],
      },
    }))
  }

  // Handle geopoint changes
  const handleGeopointChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = Number.parseFloat(e.target.value) || 0
    const newGeopoint = [...formData.specs_rental.geopoint]
    newGeopoint[index] = value

    setFormData((prev) => ({
      ...prev,
      specs_rental: {
        ...prev.specs_rental,
        geopoint: newGeopoint as [number, number],
      },
    }))
  }

  // Handle media file selection
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

  // Handle media distance change
  const handleMediaDistanceChange = (index: number, value: string) => {
    const newDistances = [...mediaDistances]
    newDistances[index] = value
    setMediaDistances(newDistances)
  }

  // Remove a media file
  const handleRemoveMedia = (index: number) => {
    // Release the object URL to avoid memory leaks
    URL.revokeObjectURL(mediaPreviewUrls[index])

    // Remove the file and its associated data
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
    setMediaPreviewUrls((prev) => prev.filter((_, i) => i !== index))
    setMediaDistances((prev) => prev.filter((_, i) => i !== index))
    setMediaTypes((prev) => prev.filter((_, i) => i !== index))
  }

  // Remove existing media
  const handleRemoveExistingMedia = (index: number) => {
    setExistingMedia((prev) => (prev ? prev.filter((_, i) => i !== index) : []))
  }

  // Upload media files to Firebase Storage
  const uploadMediaFiles = async () => {
    if (!user || !product) return []

    const storage = getStorage()
    const mediaData = []

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i]
      const isVideo = file.type.startsWith("video/")

      // Create a reference to the file in Firebase Storage
      const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_${file.name}`)

      // Upload the file
      await uploadBytes(fileRef, file)

      // Get the download URL
      const url = await getDownloadURL(fileRef)

      // Add the media data
      mediaData.push({
        url,
        distance: mediaDistances[i] || "Not specified",
        type: mediaTypes[i],
        isVideo,
      })
    }

    return mediaData
  }

  // Get category names from selected IDs
  const getCategoryNames = () => {
    return selectedCategories
      .map((id) => {
        const category = categories.find((cat) => cat.id === id)
        return category ? category.name : ""
      })
      .filter(Boolean)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !product) {
      setError("You must be logged in to update a product")
      return
    }

    // Validate required fields
    if (!formData.name) {
      setError("Name is required")
      return
    }

    if (!formData.description) {
      setError("Description is required")
      return
    }

    if (selectedCategories.length === 0) {
      setError("At least one category must be selected")
      return
    }

    if (!formData.specs_rental.location) {
      setError("Location is required")
      return
    }

    if (existingMedia.length === 0 && mediaFiles.length === 0) {
      setError("At least one media file must be uploaded")
      return
    }

    // Validate Dynamic content type specific fields
    if (formData.content_type === "Dynamic(LED)") {
      if (!formData.cms.spots_per_loop) {
        setError("Spots per loop is required for Dynamic content")
        return
      }
      if (!formData.cms.loops_per_day) {
        setError("Loops per day is required for Dynamic content")
        return
      }
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // Upload new media files and get their data
      const newMediaData = await uploadMediaFiles()

      // Combine existing and new media
      const combinedMedia = [...(existingMedia || []), ...newMediaData]

      // Strip "(LED)" from content_type if present
      const contentType = formData.content_type === "Dynamic(LED)" ? "Dynamic" : formData.content_type

      // Create the product update data
      const productData = {
        ...formData,
        content_type: contentType, // Use the cleaned content type
        price: formData.price ? Number.parseFloat(formData.price) : null,
        media: combinedMedia,
        categories: selectedCategories,
        category_names: getCategoryNames(),
        cms:
          contentType === "Dynamic"
            ? {
                spots_per_loop: Number.parseInt(formData.cms.spots_per_loop) || 0,
                loops_per_day: Number.parseInt(formData.cms.loops_per_day) || 0,
              }
            : null,
        specs_rental: {
          ...formData.specs_rental,
          audience_types: selectedAudienceTypes,
          traffic_count: formData.specs_rental.traffic_count
            ? Number.parseInt(formData.specs_rental.traffic_count)
            : null,
          elevation: formData.specs_rental.elevation ? Number.parseFloat(formData.specs_rental.elevation) : null,
          height: formData.specs_rental.height ? Number.parseFloat(formData.specs_rental.height) : null,
          width: formData.specs_rental.width ? Number.parseFloat(formData.specs_rental.width) : null,
        },
      }

      // Update the product
      await updateProduct(product.id, productData)

      toast({
        title: "Product updated",
        description: "The product has been successfully updated.",
      })

      // Navigate to the product page
      router.push(`/admin/inventory/${product.id}`)
    } catch (error) {
      console.error("Error updating product:", error)
      setError("Failed to update product. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  // Remove a selected category
  const removeCategory = (categoryId: string) => {
    setSelectedCategories((prev) => prev.filter((id) => id !== categoryId))
  }

  // Remove a selected audience type
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

  // Check if content type is Dynamic
  const isDynamicContent = formData.content_type === "Dynamic(LED)"

  if (!user) {
    return (
      <div className="flex-1 p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-gray-500 mb-6">Please log in to edit a product.</p>
          <Button onClick={() => router.push("/login")}>Log In</Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading Product Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Product Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-6">The product you're trying to edit could not be found.</p>
              <Button onClick={() => router.push("/admin/inventory")}>Return to Inventory</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Edit Site: {product.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter site name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter site description"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Price per Month (₱)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="Enter price per month"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content_type">Content Type</Label>
                    <select
                      id="content_type"
                      name="content_type"
                      value={formData.content_type}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="Static">Static</option>
                      <option value="Dynamic(LED)">Dynamic(LED)</option>
                    </select>
                  </div>

                  {/* Dynamic content specific fields */}
                  {isDynamicContent && (
                    <div className="space-y-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium">Dynamic Content Settings</h4>

                      <div className="space-y-2">
                        <Label htmlFor="cms.spots_per_loop">
                          Spots per Loop <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="cms.spots_per_loop"
                          name="cms.spots_per_loop"
                          type="number"
                          value={formData.cms.spots_per_loop}
                          onChange={handleInputChange}
                          placeholder="Enter number of spots per loop"
                          min="1"
                          required={isDynamicContent}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cms.loops_per_day">
                          Loops per Day <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="cms.loops_per_day"
                          name="cms.loops_per_day"
                          type="number"
                          value={formData.cms.loops_per_day}
                          onChange={handleInputChange}
                          placeholder="Enter number of loops per day"
                          min="1"
                          required={isDynamicContent}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="categories">
                      Categories <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-between ${selectedCategories.length === 0 ? "border-red-300" : ""}`}
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        disabled={isLoadingCategories || categories.length === 0}
                      >
                        <span>
                          {isLoadingCategories
                            ? "Loading categories..."
                            : selectedCategories.length > 0
                              ? `${selectedCategories.length} categories selected`
                              : "Select categories"}
                        </span>
                        <ArrowLeft
                          className={`h-4 w-4 transition-transform ${showCategoryDropdown ? "rotate-90" : "-rotate-90"}`}
                        />
                      </Button>

                      {showCategoryDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                          {categories.map((category) => (
                            <div
                              key={category.id}
                              className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => toggleCategory(category.id)}
                            >
                              <div className="flex-1">{category.name}</div>
                              {selectedCategories.includes(category.id) ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected categories */}
                    {selectedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedCategories.map((categoryId) => {
                          const category = categories.find((c) => c.id === categoryId)
                          return category ? (
                            <Badge key={categoryId} variant="secondary" className="flex items-center gap-1">
                              {category.name}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => removeCategory(categoryId)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}

                    {categories.length === 0 && !isLoadingCategories && (
                      <p className="text-xs text-amber-600 mt-1">No active categories found</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Location Information</h3>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="specs_rental.location">
                      Location <span className="text-red-500">*</span>
                    </Label>
                    <GooglePlacesAutocomplete
                      value={formData.specs_rental.location}
                      onChange={handleLocationChange}
                      placeholder="Enter site location"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audience_types">Audience Types (Multiple)</Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => setShowAudienceDropdown(!showAudienceDropdown)}
                      >
                        <span>
                          {selectedAudienceTypes.length > 0
                            ? `${selectedAudienceTypes.length} audience types selected`
                            : "Select audience types"}
                        </span>
                        <ArrowLeft
                          className={`h-4 w-4 transition-transform ${showAudienceDropdown ? "rotate-90" : "-rotate-90"}`}
                        />
                      </Button>

                      {showAudienceDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                          {AUDIENCE_TYPES.map((type) => (
                            <div
                              key={type}
                              className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => toggleAudienceType(type)}
                            >
                              <div className="flex-1">{type}</div>
                              {selectedAudienceTypes.includes(type) ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected audience types */}
                    {selectedAudienceTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedAudienceTypes.map((type) => (
                          <Badge key={type} variant="secondary" className="flex items-center gap-1">
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

                  <div className="space-y-2">
                    <Label htmlFor="specs_rental.traffic_count">Traffic Count (Daily)</Label>
                    <Input
                      id="specs_rental.traffic_count"
                      name="specs_rental.traffic_count"
                      type="number"
                      value={formData.specs_rental.traffic_count}
                      onChange={handleInputChange}
                      placeholder="Enter average daily traffic count"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specs_rental.elevation">Elevation (ft)</Label>
                    <Input
                      id="specs_rental.elevation"
                      name="specs_rental.elevation"
                      type="number"
                      value={formData.specs_rental.elevation}
                      onChange={handleInputChange}
                      placeholder="Enter elevation from ground level in feet"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="specs_rental.height">Height (ft)</Label>
                      <Input
                        id="specs_rental.height"
                        name="specs_rental.height"
                        type="number"
                        value={formData.specs_rental.height}
                        onChange={handleInputChange}
                        placeholder="Enter height in feet"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="specs_rental.width">Width (ft)</Label>
                      <Input
                        id="specs_rental.width"
                        name="specs_rental.width"
                        type="number"
                        value={formData.specs_rental.width}
                        onChange={handleInputChange}
                        placeholder="Enter width in feet"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        value={formData.specs_rental.geopoint[0]}
                        onChange={(e) => handleGeopointChange(e, 0)}
                        placeholder="Enter latitude"
                        step="0.000001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        type="number"
                        value={formData.specs_rental.geopoint[1]}
                        onChange={(e) => handleGeopointChange(e, 1)}
                        placeholder="Enter longitude"
                        step="0.000001"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Media Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">
                  Media <span className="text-red-500">*</span>
                </h3>

                {/* Existing Media */}
                {existingMedia && existingMedia.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Existing Media</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {existingMedia.map((item, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center">
                              {item.isVideo ? (
                                <Film className="h-3 w-3 mr-1 text-blue-500" />
                              ) : (
                                <ImageIcon className="h-3 w-3 mr-1 text-green-500" />
                              )}
                              <h5 className="text-xs font-medium">
                                {item.isVideo ? "Video" : "Image"} {index + 1}
                              </h5>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveExistingMedia(index)}
                              className="h-6 w-6 p-0 text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="aspect-video bg-gray-100 rounded-md overflow-hidden">
                            {item.isVideo ? (
                              <video src={item.url} controls className="w-full h-full object-contain" />
                            ) : (
                              <img
                                src={item.url || "/placeholder.svg"}
                                alt={`Media ${index + 1}`}
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>

                          <div className="text-xs text-gray-500">Distance: {item.distance || "Not specified"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`border-2 border-dashed ${
                    existingMedia.length === 0 && mediaFiles.length === 0 ? "border-red-300" : "border-gray-300"
                  } rounded-lg p-6 text-center`}
                >
                  <input
                    type="file"
                    id="media-upload"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                    required={existingMedia.length === 0 && mediaFiles.length === 0}
                  />
                  <label htmlFor="media-upload" className="flex flex-col items-center justify-center cursor-pointer">
                    <Upload
                      className={`h-10 w-10 ${
                        existingMedia.length === 0 && mediaFiles.length === 0 ? "text-red-400" : "text-gray-400"
                      } mb-2`}
                    />
                    <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500">Images or videos (max 10MB each)</p>
                    {existingMedia.length === 0 && mediaFiles.length === 0 && (
                      <p className="text-xs text-red-500 mt-2">At least one media file is required</p>
                    )}
                  </label>
                </div>

                {/* New Media Preview - Grid Layout */}
                {mediaPreviewUrls.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">New Media</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {mediaPreviewUrls.map((url, index) => {
                        const isVideo = mediaTypes[index] === "Video"
                        return (
                          <div key={index} className="border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center">
                                {isVideo ? (
                                  <Film className="h-3 w-3 mr-1 text-blue-500" />
                                ) : (
                                  <ImageIcon className="h-3 w-3 mr-1 text-green-500" />
                                )}
                                <h5 className="text-xs font-medium">
                                  {isVideo ? "Video" : "Image"} {index + 1}
                                </h5>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMedia(index)}
                                className="h-6 w-6 p-0 text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="aspect-video bg-gray-100 rounded-md overflow-hidden">
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

                            <div className="space-y-1">
                              <Label htmlFor={`media-distance-${index}`} className="text-xs">
                                Viewing Distance
                              </Label>
                              <Input
                                id={`media-distance-${index}`}
                                value={mediaDistances[index]}
                                onChange={(e) => handleMediaDistanceChange(index, e.target.value)}
                                placeholder="e.g., 100m"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Site"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
