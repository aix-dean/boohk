"use client"

import { useState, useEffect, use } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Calendar, Trash2, Upload, X, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { Product } from "@/lib/firebase-service"
import { Skeleton } from "@/components/ui/skeleton"
import { softDeleteProduct } from "@/lib/firebase-service"
import { useToast } from "@/hooks/use-toast"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import SiteInformation from "@/components/SiteInformation"
// Price validation functions
const validatePriceInput = (value: string): boolean => {
  // Allow empty string, numbers, and decimal point
  const regex = /^(\d*\.?\d{0,2}|\d+\.)$/;
  return regex.test(value);
};

const formatPriceOnBlur = (value: string): string => {
  if (!value || value === '') return '0';
  const num = parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setPrice: (value: string) => void) => {
  const value = e.target.value;
  if (validatePriceInput(value)) {
    setPrice(value);
  }
};

const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, setPrice: (value: string) => void) => {
  const value = e.target.value;
  const formatted = formatPriceOnBlur(value);
  setPrice(formatted);
};

const handleFormattedNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setValue: (value: string) => void) => {
  let value = e.target.value.replace(/,/g, '');
  if (value === '' || /^\d*\.?\d*$/.test(value)) {
    setValue(value === '' ? '' : Number(value).toLocaleString());
  }
};

// Enhanced validation function for dynamic content with detailed calculations
const validateDynamicContent = (cms: { start_time: string; end_time: string; spot_duration: string; loops_per_day: string }, siteType: string, setValidationError: (error: string | null) => void) => {
  if (siteType !== "digital") {
    setValidationError(null)
    return true
  }

  const { start_time, end_time, spot_duration, loops_per_day } = cms

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
      // Find suggested values that result in whole number of loops
      const findWorkingValues = (currentValue: number, isSpotDuration: boolean) => {
        const suggestions: number[] = []
        const maxOffset = 5 // Look for values within ±5 of current value

        for (let offset = 1; offset <= maxOffset; offset++) {
          // Try values above current
          const higher = currentValue + offset
          const lower = Math.max(1, currentValue - offset)

          // Check if higher value works
          const higherTotal = isSpotDuration
            ? higher * spotsPerLoopNum
            : spotDurationNum * higher
          if (durationSeconds % higherTotal === 0) {
            suggestions.push(higher)
            if (suggestions.length >= 2) break
          }

          // Check if lower value works
          const lowerTotal = isSpotDuration
            ? lower * spotsPerLoopNum
            : spotDurationNum * lower
          if (durationSeconds % lowerTotal === 0) {
            suggestions.push(lower)
            if (suggestions.length >= 2) break
          }
        }

        return suggestions
      }

      const spotDurationSuggestions = findWorkingValues(spotDurationNum, true)
      const spotsPerLoopSuggestions = findWorkingValues(spotsPerLoopNum, false)

      // Format duration for display
      const durationHours = Math.floor(durationMinutes / 60)
      const remainingMinutes = durationMinutes % 60
      const durationDisplay = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`

      // Build suggestions message
      let suggestionsText = "Suggested corrections:\n"
      let optionCount = 1

      if (spotDurationSuggestions.length > 0) {
        spotDurationSuggestions.forEach(suggestion => {
          const loops = Math.floor(durationSeconds / (suggestion * spotsPerLoopNum))
          suggestionsText += `• Option ${optionCount}: Change spot duration to ${suggestion}s (${loops} complete loops)\n`
          optionCount++
        })
      }

      if (spotsPerLoopSuggestions.length > 0) {
        spotsPerLoopSuggestions.forEach(suggestion => {
          const loops = Math.floor(durationSeconds / (spotDurationNum * suggestion))
          suggestionsText += `• Option ${optionCount}: Change spots per loop to ${suggestion} (${loops} complete loops)\n`
          optionCount++
        })
      }

      if (optionCount === 1) {
        // Fallback if no good suggestions found
        suggestionsText += "• Try adjusting spot duration or spots per loop to values that divide evenly into the total time"
      }

      setValidationError(
        `Invalid Input: The current configuration results in ${loopsResult.toFixed(2)} loops, which is not a whole number. \n\nTime Duration: ${durationDisplay} (${durationSeconds} seconds)\nCurrent Configuration: ${spotDurationNum}s × ${spotsPerLoopNum} spots = ${totalSpotTimePerLoop}s per loop\nResult: ${durationSeconds}s ÷ ${totalSpotTimePerLoop}s = ${loopsResult.toFixed(2)} loops\n\n${suggestionsText}`,
      )
      return false
    }

    // Success case - show calculation details
    const durationHours = Math.floor(durationMinutes / 60)
    const remainingMinutes = durationMinutes % 60
    const durationDisplay = durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`

    setValidationError(
      `✓ Valid Configuration: ${Math.floor(loopsResult)} complete loops will fit in the ${durationDisplay} time period. Each loop uses ${totalSpotTimePerLoop}s (${spotDurationNum}s × ${spotsPerLoopNum} spots).`,
    )
    return true
  } catch (error) {
    console.error("Validation error:", error)
    setValidationError("Invalid time format or values.")
    return false
  }
}


export default function BusinessProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Edit form state
  const [siteType, setSiteType] = useState<"static" | "digital">("static")
  const [category, setCategory] = useState("")
  const [siteName, setSiteName] = useState("")
  const [location, setLocation] = useState("")
   const [geopoint, setGeopoint] = useState<[number, number] | null>(null)
  const [locationLabel, setLocationLabel] = useState("")
  const [height, setHeight] = useState("")
  const [width, setWidth] = useState("")
  const [dimensionUnit, setDimensionUnit] = useState<"ft" | "m">("ft")
  const [elevation, setElevation] = useState("")
  const [elevationUnit, setElevationUnit] = useState<"ft" | "m">("ft")
  const [description, setDescription] = useState("")
  const [selectedAudience, setSelectedAudience] = useState<string[]>([])
  const [dailyTraffic, setDailyTraffic] = useState("")
  const [trafficUnit, setTrafficUnit] = useState<"daily" | "weekly" | "monthly">("monthly")
  const [price, setPrice] = useState("")
  const [priceUnit, setPriceUnit] = useState<"per spot" | "per day" | "per month">("per month")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([])

  // Dynamic settings state
  const [cms, setCms] = useState({
    start_time: "",
    end_time: "",
    spot_duration: "",
    loops_per_day: "",
  })
  const [validationError, setValidationError] = useState<string | null>(null)
   const [landOwner, setLandOwner] = useState("")
   const [partner, setPartner] = useState("")
   const [orientation, setOrientation] = useState("")
   const [locationVisibility, setLocationVisibility] = useState("")
   const [locationVisibilityUnit, setLocationVisibilityUnit] = useState<string>("ft")
   // SiteInformation component states
   const [activeImageIndex, setActiveImageIndex] = useState(0)
   const [imageViewerOpen, setImageViewerOpen] = useState(false)
   const [companyName, setCompanyName] = useState("")
   const [companyLoading, setCompanyLoading] = useState(false)
   const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  useEffect(() => {
    async function fetchProduct() {
      if (!params.id) return

      setLoading(true)
      try {
        const productId = Array.isArray(params.id) ? params.id[0] : params.id

        const productDoc = await getDoc(doc(db, "products", productId))

        if (productDoc.exists()) {
          setProduct({ id: productDoc.id, ...productDoc.data() } as Product)
        } else {
          console.error("Product not found")
        }
      } catch (error) {
        console.error("Error fetching product:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [params])

  // Update price unit based on site type
  useEffect(() => {
    setPriceUnit(siteType === "static" ? "per month" : "per spot")
  }, [siteType])


  // Validate dynamic content when fields change
  useEffect(() => {
    if (siteType === "digital") {
      validateDynamicContent(cms, siteType, setValidationError)
    } else {
      setValidationError(null)
    }
  }, [cms.start_time, cms.end_time, cms.spot_duration, cms.loops_per_day, siteType])
  const handleCalendarOpen = () => {
    setIsCalendarOpen(true)
  }

  const handleBack = () => {
    router.back()
  }

  // Form handlers
  const toggleAudience = (type: string) => {
    setSelectedAudience(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)])
    }
  }

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : uploadedFiles.length - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex(prev => (prev < uploadedFiles.length - 1 ? prev + 1 : 0))
  }

  const handleRemoveImage = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    if (currentImageIndex >= index && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1)
    }
  }

  const handleRemoveExistingImage = (imageUrl: string) => {
    setImagesToRemove(prev => [...prev, imageUrl])
  }

  const handleRestoreExistingImage = (imageUrl: string) => {
    setImagesToRemove(prev => prev.filter(url => url !== imageUrl))
  }

  const handleDelete = async () => {
    if (!product || !product.id) return

    try {
      await softDeleteProduct(product.id)
      toast({
        title: "Product deleted",
        description: `${product.name} has been successfully deleted.`,
      })
      // Update the product in the UI to show it as deleted
      setProduct({
        ...product,
        deleted: true,
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: "Error",
        description: "Failed to delete the product. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async () => {
    if (!product || !product.id) return

    setIsSubmitting(true)

    // Clear previous validation errors
    setValidationErrors([])

    // Validation - collect all errors
    const errors: string[] = []

    if (!siteName.trim()) {
      errors.push("Site name")
    }

    if (!location.trim()) {
      errors.push("Location")
    }

    if (!price.trim()) {
      errors.push("Price")
    } else if (isNaN(Number(price.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Price must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    // Validate dynamic content if digital site type
    if (siteType === "digital" && !validateDynamicContent(cms, siteType, setValidationError)) {
      toast({
        title: "Validation Error",
        description: "Please fix the dynamic content configuration errors.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (locationVisibility.trim() && isNaN(Number(locationVisibility.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Location Visibility must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (height.trim() && isNaN(Number(height.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Height must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (width.trim() && isNaN(Number(width.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Width must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (elevation.trim() && isNaN(Number(elevation.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Elevation must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    // Show validation error for missing required fields
    if (errors.length > 0) {
      setValidationErrors(errors)
      const errorMessage = errors.length === 1
        ? `${errors[0]} is required.`
        : `The following fields are required: ${errors.join(", ")}.`

      toast({
        title: "Required Fields Missing",
        description: errorMessage,
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Upload new files to Firebase Storage
      const mediaUrls: Array<{ url: string; distance: string; type: string; isVideo: boolean }> = []
      for (const file of uploadedFiles) {
        const url = await uploadFileToFirebaseStorage(file, `products/${product.company_id}`)
        mediaUrls.push({
          url,
          distance: "0",
          type: file.type,
          isVideo: file.type.startsWith('video/')
        })
      }

      // Filter out removed images and combine with new media
      const existingMedia = (product.media || []).filter(mediaItem => !imagesToRemove.includes(mediaItem.url))
      const allMedia = [...existingMedia, ...mediaUrls]

      // Create update data
      const updateData = {
        name: siteName,
        description,
        price: parseFloat(price.replace(/,/g, '')) || 0,
        content_type: siteType,
        categories: [category],
        cms: siteType === "digital" ? {
          start_time: cms.start_time,
          end_time: cms.end_time,
          spot_duration: parseInt(cms.spot_duration) || 0,
          loops_per_day: parseInt(cms.loops_per_day) || 0,
        } : null,
        specs_rental: {
          audience_types: selectedAudience,
          location,
          location_label: locationLabel,
          land_owner: landOwner,
           ...(geopoint && { geopoint }),
          partner,
          orientation,
          location_visibility: parseFloat(locationVisibility.replace(/,/g, '')) || null,
          location_visibility_unit: locationVisibilityUnit,
          traffic_count: parseInt(dailyTraffic) || null,
          traffic_unit: trafficUnit,
          height: parseFloat(height.replace(/,/g, '')) || null,
          width: parseFloat(width.replace(/,/g, '')) || null,
          elevation: parseFloat(elevation.replace(/,/g, '')) || null,
          dimension_unit: dimensionUnit,
          elevation_unit: elevationUnit,
          structure: product.specs_rental?.structure || {
            color: null,
            condition: null,
            contractor: null,
            last_maintenance: null,
          },
          illumination: product.specs_rental?.illumination || {
            bottom_count: null,
            bottom_lighting_specs: null,
            left_count: null,
            left_lighting_specs: null,
            right_count: null,
            right_lighting_specs: null,
            upper_count: null,
            upper_lighting_specs: null,
            power_consumption_monthly: null,
          },
        },
        media: allMedia,
        type: "RENTAL",
        updated: serverTimestamp(),
      }

      // Update in Firestore
      await updateDoc(doc(db, "products", product.id), updateData)

      // Update local state
      setProduct({
        ...product,
        ...updateData,
      })

      setEditDialogOpen(false)

      toast({
        title: "Site updated successfully",
        description: `${siteName} has been updated.`,
      })
    } catch (error) {
      console.error("Error updating product:", error)
      toast({
        title: "Error",
        description: "Failed to update site. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = () => {
    if (product) {
      // Populate form with existing product data
      const currentSiteType = product.content_type === "static" ? "static" : "digital"
      setSiteType(currentSiteType)
      setCategory(product.categories?.[0] || "")
      setSiteName(product.name || "")
       setGeopoint(product.specs_rental?.geopoint || null)
      setLocation(product.specs_rental?.location || "")
      setLocationLabel(product.specs_rental?.location_label || "")
      setHeight(product.specs_rental?.height ? Number(product.specs_rental.height).toLocaleString() : "")
      setWidth(product.specs_rental?.width ? Number(product.specs_rental.width).toLocaleString() : "")
      setDimensionUnit(product.specs_rental?.dimension_unit || "ft")
      setElevation(product.specs_rental?.elevation ? Number(product.specs_rental.elevation).toLocaleString() : "")
      setElevationUnit(product.specs_rental?.elevation_unit || "ft")
      setDescription(product.description || "")
      setSelectedAudience(product.specs_rental?.audience_types || [])
      setDailyTraffic(product.specs_rental?.traffic_count ? Number(product.specs_rental.traffic_count).toLocaleString() : "")
      setTrafficUnit(product.specs_rental?.traffic_unit || "monthly")
      setPrice(product.price ? formatPriceOnBlur(String(product.price)) : "0")
      setPriceUnit(currentSiteType === "static" ? "per month" : "per spot")
      setUploadedFiles([])
      setCurrentImageIndex(0)
      setImagesToRemove([])

      // Set CMS data if it exists
      if (product.cms) {
        setCms({
          start_time: product.cms.start_time || "06:00",
          end_time: product.cms.end_time || "22:00",
          spot_duration: product.cms.spot_duration ? String(product.cms.spot_duration) : "10",
          loops_per_day: product.cms.loops_per_day ? String(product.cms.loops_per_day) : "18",
        })
      } else {
        // Set defaults for new digital sites
        setCms({
          start_time: "06:00",
          end_time: "22:00",
          spot_duration: "10",
          loops_per_day: "18",
        })
      }
       setLandOwner(product.specs_rental?.land_owner || "")
       setPartner(product.specs_rental?.partner || "")
       setOrientation(product.specs_rental?.orientation || "")
       setLocationVisibility(product.specs_rental?.location_visibility ? Number(product.specs_rental.location_visibility).toLocaleString() : "")
       setLocationVisibilityUnit(product.specs_rental?.location_visibility_unit || "ft")

      setEditDialogOpen(true)
      setValidationErrors([])
      setValidationError(null)

      // Show info about required fields
      // setTimeout(() => {
      //   toast({
      //     title: "Required Fields",
      //     description: "Fields marked with * are required: Site Name, Location, and Price.",
      //   })
      // }, 500)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-xs">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-[300px] w-full mb-6 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="max-w-xs text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-xs">
        <div className="space-y-4">
          <div className="flex flex-row items-center">
            <Link href="/business/inventory" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2
              className="text-lg"
              style={{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '24px',
                lineHeight: '120%',
                letterSpacing: '0%',
                color: '#000000'
              }}
            >
              Site Information
            </h2>
          </div>

          <SiteInformation
            product={product}
            activeImageIndex={activeImageIndex}
            setActiveImageIndex={setActiveImageIndex}
            setImageViewerOpen={setImageViewerOpen}
            handleCalendarOpen={handleCalendarOpen}
            companyName={companyName}
            companyLoading={companyLoading}
          />

          {/* Action Buttons */}
          <div className="border-t pt-4 space-y-2">
            {!product.deleted && (
              <>
                <Button onClick={handleEdit} className="w-full bg-blue-600 hover:bg-blue-700">
                  Edit Site
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10 bg-transparent"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Site
                </Button>
              </>
            )}
            <Button variant="outline" className="w-full bg-transparent">
              View Contract
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Site Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[20px] py-0 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b px-6 mb-0 min-h-[4rem] flex items-start pt-6">
            <DialogTitle className="text-2xl font-semibold text-[#333333]">Edit Site</DialogTitle>
          </DialogHeader>

          {/* Validation Errors Display */}
          {validationErrors.length > 0 && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Please fill in the required fields:
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul role="list" className="list-disc pl-5 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Site Type */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Site Type:</Label>
                <div className="flex gap-2">
                  <Button
                    variant={siteType === "static" ? "default" : "outline"}
                    onClick={() => {
                      setSiteType("static")
                      setCms({
                        start_time: "",
                        end_time: "",
                        spot_duration: "",
                        loops_per_day: "",
                      })
                    }}
                    className={`flex-1 ${
                      siteType === "static"
                        ? "bg-[#30c71d] hover:bg-[#28a819] text-white border-[#30c71d]"
                        : "bg-white border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                    }`}
                  >
                    Static
                  </Button>
                  <Button
                    variant={siteType === "digital" ? "default" : "outline"}
                    onClick={() => {
                      setSiteType("digital")
                      setCms({
                        start_time: "06:00",
                        end_time: "22:00",
                        spot_duration: "10",
                        loops_per_day: "18",
                      })
                    }}
                    className={`flex-1 ${
                      siteType === "digital"
                        ? "bg-[#30c71d] hover:bg-[#28a819] text-white border-[#30c71d]"
                        : "bg-white border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                    }`}
                  >
                    Digital
                  </Button>
                </div>
              </div>

              {/* Category */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Category:</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="border-[#c4c4c4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(siteType === "static" ? ["Billboard", "Wallboard", "Transit Ads", "Column", "Bridgeway billboard", "Banner", "Lampost", "Lightbox", "Building Wrap", "Gantry", "Toll Plaza"] : ["Digital Billboard", "LED Poster", "Digital Transit Ads"]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Site Name */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Site Name: <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Site Name"
                  className="border-[#c4c4c4]"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>

              {/* Location */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Location: <span className="text-red-500">*</span>
                </Label>
                <GooglePlacesAutocomplete
                  value={location}
                  onChange={setLocation}
                  onGeopointChange={setGeopoint}
                  placeholder="Enter street address or search location..."
                  enableMap={true}
                  mapHeight="250px"
                />
              </div>

              {/* Location Label */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Location Label:</Label>
                <Input
                  className="border-[#c4c4c4]"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                />
              </div>

              {/* Location Visibility */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Location Visibility:</Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    placeholder="e.g., 100"
                    className="flex-1 border-[#c4c4c4]"
                    value={locationVisibility}
                    onChange={(e) => handleFormattedNumberInput(e, setLocationVisibility)}
                  />
                  <Select value={locationVisibilityUnit} onValueChange={(value: string) => setLocationVisibilityUnit(value)}>
                    <SelectTrigger className="w-20 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Land Owner */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Land Owner:</Label>
                <Input
                  placeholder="Enter land owner name"
                  className="border-[#c4c4c4]"
                  value={landOwner}
                  onChange={(e) => setLandOwner(e.target.value)}
                />
              </div>

              {/* Partner */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Partner:</Label>
                <Input
                  placeholder="Enter partner name"
                  className="border-[#c4c4c4]"
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                />
              </div>

              {/* Orientation */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Orientation:</Label>
                <Input
                  placeholder="e.g., North, South, East, West"
                  className="border-[#c4c4c4]"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                />
              </div>

              {/* Dimension */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Dimension:</Label>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-[#4e4e4e] text-sm mb-1 block">Height:</Label>
                    <Input
                      type="text"
                      className="border-[#c4c4c4]"
                      value={height}
                      onChange={(e) => handleFormattedNumberInput(e, setHeight)}
                    />
                  </div>
                  <span className="text-[#4e4e4e]">x</span>
                  <div className="flex-1">
                    <Label className="text-[#4e4e4e] text-sm mb-1 block">Width:</Label>
                    <Input
                      type="text"
                      className="border-[#c4c4c4]"
                      value={width}
                      onChange={(e) => handleFormattedNumberInput(e, setWidth)}
                    />
                  </div>
                  <Select value={dimensionUnit} onValueChange={(value: "ft" | "m") => setDimensionUnit(value)}>
                    <SelectTrigger className="w-20 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Elevation from ground */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Elevation from ground: <span className="text-[#c4c4c4]">(Optional)</span>
                </Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    className="flex-1 border-[#c4c4c4]"
                    value={elevation}
                    onChange={(e) => handleFormattedNumberInput(e, setElevation)}
                  />
                  <Select value={elevationUnit} onValueChange={(value: "ft" | "m") => setElevationUnit(value)}>
                    <SelectTrigger className="w-20 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="m">m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Description */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Description:</Label>
                <Textarea
                  className="min-h-[120px] border-[#c4c4c4] resize-none"
                  placeholder=""
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Audience Type */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Audience Type: <span className="text-[#c4c4c4]">(can choose multiple)</span>
                </Label>
                <div className="flex gap-2">
                  {["A", "B", "C", "D", "E"].map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      onClick={() => toggleAudience(type)}
                      className={`w-12 h-10 ${
                        selectedAudience.includes(type)
                          ? "bg-[#30c71d] hover:bg-[#28a819] text-white border-[#30c71d]"
                          : "bg-white border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                      }`}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Traffic */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Traffic:</Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    className="flex-1 border-[#c4c4c4]"
                    value={dailyTraffic}
                    onChange={(e) => handleFormattedNumberInput(e, setDailyTraffic)}
                  />
                  <Select value={trafficUnit} onValueChange={(value: "daily" | "weekly" | "monthly") => setTrafficUnit(value)}>
                    <SelectTrigger className="w-24 border-[#c4c4c4]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">daily</SelectItem>
                      <SelectItem value="weekly">weekly</SelectItem>
                      <SelectItem value="monthly">monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Current Images */}
              {product?.media && product.media.length > 0 && (
                <div>
                  <Label className="text-[#4e4e4e] font-medium mb-3 block">Current Images:</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {product.media
                      .filter(mediaItem => !imagesToRemove.includes(mediaItem.url))
                      .map((mediaItem, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                          <img
                            src={mediaItem.url || "/placeholder.svg"}
                            alt={`Current image ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/abstract-geometric-sculpture.png"
                            }}
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveExistingImage(mediaItem.url)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                  </div>
                  {imagesToRemove.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-[#4e4e4e] font-medium mb-2 block text-sm">Images marked for removal:</Label>
                      <div className="flex flex-wrap gap-2">
                        {imagesToRemove.map((url, index) => {
                          const mediaItem = product.media?.find(m => m.url === url)
                          return (
                            <div key={index} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-2 py-1">
                              <span className="text-sm text-red-700">Image {index + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                                onClick={() => handleRestoreExistingImage(url)}
                              >
                                ↺
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Photo Upload */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Add New Photos: <span className="text-[#c4c4c4]">(can upload multiple)</span>
                </Label>

                {/* Image Preview/Carousel */}
                {uploadedFiles.length > 0 && (
                  <div className="mb-4">
                    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                      {/* Main Image Display */}
                      <div className="aspect-video relative">
                        <img
                          src={URL.createObjectURL(uploadedFiles[currentImageIndex])}
                          alt={`Preview ${currentImageIndex + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Remove Button */}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          onClick={() => handleRemoveImage(currentImageIndex)}
                        >
                          ×
                        </Button>
                      </div>

                      {/* Navigation Arrows (only show if multiple images) */}
                      {uploadedFiles.length > 1 && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                            onClick={handlePrevImage}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                            onClick={handleNextImage}
                          >
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                        </>
                      )}

                      {/* Image Counter */}
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                        {currentImageIndex + 1} / {uploadedFiles.length}
                      </div>
                    </div>

                    {/* Thumbnail Strip */}
                    {uploadedFiles.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {uploadedFiles.map((file, index) => (
                          <button
                            key={index}
                            className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                              index === currentImageIndex ? 'border-blue-500' : 'border-gray-300'
                            }`}
                            onClick={() => setCurrentImageIndex(index)}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Area */}
                <div className="border-2 border-dashed border-[#c4c4c4] rounded-lg p-8 text-center bg-gray-50">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-[#c4c4c4] mx-auto mb-2" />
                    <p className="text-[#c4c4c4] font-medium">Upload</p>
                  </label>
                  {uploadedFiles.length === 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Click to select images
                    </p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">
                  Price: <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    className="flex-1 border-[#c4c4c4]"
                    value={price}
                    onChange={(e) => handleFormattedNumberInput(e, setPrice)}
                    onBlur={(e) => handlePriceBlur(e, setPrice)}
                  />
                  <Select value={priceUnit} disabled>
                    <SelectTrigger className="w-28 border-[#c4c4c4] bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per spot">per spot</SelectItem>
                      <SelectItem value="per day">per day</SelectItem>
                      <SelectItem value="per month">per month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Settings - Only show for digital site type */}
              {siteType === "digital" && (
                <div>
                  <Label className="text-[#4e4e4e] font-medium mb-3 block">Digital Content Settings:</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-start_time" className="text-[#4e4e4e] font-medium mb-3 block">Start Time</Label>
                      <Input
                        id="edit-detail-start_time"
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.start_time}
                        onChange={(e) => setCms(prev => ({ ...prev, start_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-end_time" className="text-[#4e4e4e] font-medium mb-3 block">End Time</Label>
                      <Input
                        id="edit-detail-end_time"
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.end_time}
                        onChange={(e) => setCms(prev => ({ ...prev, end_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-spot_duration" className="text-[#4e4e4e] font-medium mb-3 block">Spot Duration (seconds)</Label>
                      <Input
                        id="edit-detail-spot_duration"
                        type="number"
                        className="border-[#c4c4c4]"
                        value={cms.spot_duration}
                        onChange={(e) => setCms(prev => ({ ...prev, spot_duration: e.target.value }))}
                        placeholder="Enter duration in seconds"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-detail-loops_per_day" className="text-[#4e4e4e] font-medium mb-3 block">Spots Per Loop</Label>
                      <Input
                        id="edit-detail-loops_per_day"
                        type="number"
                        className="border-[#c4c4c4]"
                        value={cms.loops_per_day}
                        onChange={(e) => setCms(prev => ({ ...prev, loops_per_day: e.target.value }))}
                        placeholder="Enter spots per loop"
                        required
                      />
                    </div>
                  </div>

                  {/* Validation feedback display */}
                  {validationError && (
                    <div
                      className={`mt-4 p-4 rounded-lg border ${
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
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-white border-t border-[#c4c4c4] mt-8 pt-6 pb-6 -mb-6">
            <div className="flex justify-end gap-4 px-6">
              <Button
                variant="outline"
                className="px-8 border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50 bg-transparent"
                onClick={() => setEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="px-8 bg-[#1d0beb] hover:bg-[#1508d1] text-white"
                onClick={handleUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update Site"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatDate(dateValue?: string | any): string {
  if (!dateValue) return "Unknown"

  try {
    let date: Date

    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue === "object" && "toDate" in dateValue) {
      date = dateValue.toDate()
    }
    // Handle ISO string dates
    else if (typeof dateValue === "string") {
      date = new Date(dateValue)
    }
    // Handle any other date-like input
    else {
      date = new Date(dateValue)
    }

    return date.toLocaleDateString()
  } catch (error) {
    console.error("Error formatting date:", error)
    return String(dateValue)
  }
}
