"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, ChevronLeft, ChevronRight, X } from "lucide-react"
import { createProduct, uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { serverTimestamp } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { GeoPoint } from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

// Category options based on site type
const STATIC_CATEGORIES = [
  "Billboard",
  "Wallboard",
  "Transit Ads",
  "Column",
  "Bridgeway billboard",
  "Banner",
  "Lampost",
  "Lightbox",
  "Building Wrap",
  "Gantry",
  "Toll Plaza"
]

const DIGITAL_CATEGORIES = [
  "Digital Billboard",
  "LED Poster",
  "Digital Transit Ads"
]

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
  return num.toFixed(2);
};

const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, setPrice: (value: string) => void) => {
  let value = e.target.value.replace(/,/g, '');
  if (validatePriceInput(value)) {
    setPrice(value === '' ? '' : Number(value).toLocaleString());
  }
};

const handleFormattedNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setValue: (value: string) => void) => {
  let value = e.target.value.replace(/,/g, '');
  if (value === '' || /^\d*\.?\d*$/.test(value)) {
    setValue(value === '' ? '' : Number(value).toLocaleString());
  }
};

const handlePriceBlur = (e: React.FocusEvent<HTMLInputElement>, setPrice: (value: string) => void) => {
  const value = e.target.value;
  const formatted = formatPriceOnBlur(value);
  setPrice(formatted);
};

// Type for CMS data
type CmsData = {
  start_time: string
  end_time: string
  spot_duration: string
  loops_per_day: string
}

// Enhanced validation function for dynamic content with detailed calculations
const validateDynamicContent = (cms: CmsData, siteType: string, setValidationError: (error: string | null) => void) => {
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

interface AddSiteDialogProps {
  isOpen: boolean
  onClose: () => void
  userData: any
  refreshData?: () => void
}

export default function AddSiteDialog({ isOpen, onClose, userData, refreshData }: AddSiteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Form state
  const [siteType, setSiteType] = useState<"static" | "digital">("digital")
  const [cms, setCms] = useState<CmsData>({
    start_time: "06:00",
    end_time: "22:00",
    spot_duration: "",
    loops_per_day: ""
  })
  const [validationError, setValidationError] = useState<string | null>(null)
  const [category, setCategory] = useState(DIGITAL_CATEGORIES[0])
  const [siteName, setSiteName] = useState("")
  const [location, setLocation] = useState("")
  const [locationLabel, setLocationLabel] = useState("")
  const [geopoint, setGeopoint] = useState<GeoPoint | null>(null)
  const [height, setHeight] = useState("")
  const [width, setWidth] = useState("")
  const [dimensionUnit, setDimensionUnit] = useState<"ft" | "m">("ft")
  const [elevation, setElevation] = useState("")
  const [elevationUnit, setElevationUnit] = useState<"ft" | "m">("ft")
  const [description, setDescription] = useState("")
  const [selectedAudience, setSelectedAudience] = useState<string[]>([])
  const [dailyTraffic, setDailyTraffic] = useState("")
  const [price, setPrice] = useState("0")
  const [priceUnit, setPriceUnit] = useState<"per spot" | "per day" | "per month">("per month")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [landOwner, setLandOwner] = useState("")
  const [partner, setPartner] = useState("")
  const [orientation, setOrientation] = useState("")
  const [locationVisibility, setLocationVisibility] = useState("")
  const [locationVisibilityUnit, setLocationVisibilityUnit] = useState<string>("ft")

  const [playerId, setPlayerId] = useState("")
  const [spotInputs, setSpotInputs] = useState<string[]>([])
  const [selectedRetailSpots, setSelectedRetailSpots] = useState<number[]>([])

  // Update price unit based on site type
  useEffect(() => {
    if (siteType === "static") {
      setPriceUnit("per month")
    } else if (siteType === "digital") {
      setPriceUnit("per spot")
    }
  }, [siteType])

  // Update category based on site type
  useEffect(() => {
    if (siteType === "static") {
      setCategory(STATIC_CATEGORIES[0])
    } else if (siteType === "digital") {
      setCategory(DIGITAL_CATEGORIES[0])
    }
  }, [siteType])

  // Set default values when site type changes to digital
  useEffect(() => {
    if (siteType === "digital") {
      setCms({
        start_time: "06:00",
        end_time: "22:00",
        spot_duration: "10",
        loops_per_day: "",
      })
    }
  }, [siteType])

  // Validate dynamic content when fields change
  useEffect(() => {
    if (siteType === "digital") {
      validateDynamicContent(cms, siteType, setValidationError)
    } else {
      setValidationError(null)
    }
  }, [cms.start_time, cms.end_time, cms.spot_duration, cms.loops_per_day, siteType])

  // Update spot inputs when loops_per_day changes for digital sites
  useEffect(() => {
    if (siteType === "digital") {
      const spots = parseInt(cms.loops_per_day) || 0
      setSpotInputs(prev => {
        if (prev.length !== spots) {
          return new Array(spots).fill("")
        }
        return prev
      })
    } else {
      setSpotInputs([])
    }
  }, [siteType, cms.loops_per_day])

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

  const handleAddSubmit = async () => {
    if (!userData?.company_id || !userData?.user?.uid) return

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

    if (locationVisibility.trim() && isNaN(Number(locationVisibility.replace(/,/g, '')))) {
      toast({
        title: "Validation Error",
        description: "Location Visibility must be a valid number.",
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
      // Upload files to Firebase Storage
      const mediaUrls: Array<{ url: string; distance: string; type: string; isVideo: boolean }> = []
      for (const file of uploadedFiles) {
        const url = await uploadFileToFirebaseStorage(file, `products/${userData.company_id}`)
        mediaUrls.push({
          url,
          distance: "0",
          type: file.type,
          isVideo: file.type.startsWith('video/')
        })
      }

      // Create product data
      const productData: any = {
        name: siteName,
        description,
        price: parseFloat(price.replace(/,/g, '')) || 0,
        content_type: siteType,
        categories: [category],
        company_id: userData.company_id,
        seller_id: userData.user?.uid,
        seller_name: userData.user?.displayName || userData.user?.email || "",
        cms: siteType === "digital" ? {
          start_time: cms.start_time,
          end_time: cms.end_time,
          spot_duration: parseInt(cms.spot_duration) || 0,
          loops_per_day: parseInt(cms.loops_per_day) || 0,
        } : null,
        pages: siteType === "digital" ? [
          {
            "name": "a-page",
            "widgets": [
              {
                "zIndex": 1,
                "type": "STREAM_MEDIA",
                "size": 143046,
                "md5": "726F13D3B7B68F2C25400EE5B014CDB2",
                "duration": 10000,
                "layout": {
                  "x": "0%",
                  "y": "0%",
                  "width": "100%",
                  "height": "100%"
                }
              }
            ]
          }
        ] : null,
        playerIds: siteType === "digital" ? [playerId || ""] : undefined,
        spotUrls: siteType === "digital" ? spotInputs : undefined,
        specs_rental: {
          audience_types: selectedAudience,
          location,
          location_label: locationLabel,
          land_owner: landOwner,
          partner,
          orientation,
          location_visibility: parseFloat(locationVisibility.replace(/,/g, '')) || null,
          location_visibility_unit: locationVisibilityUnit,
          ...(geopoint && { geopoint }),
          traffic_count: parseInt(dailyTraffic.replace(/,/g, '')) || null,
          height: parseFloat(height.replace(/,/g, '')) || null,
          width: parseFloat(width.replace(/,/g, '')) || null,
          elevation: parseFloat(elevation.replace(/,/g, '')) || null,
          dimension_unit: dimensionUnit,
          elevation_unit: elevationUnit,
          structure: {
            color: null,
            condition: null,
            contractor: null,
            last_maintenance: null,
          },
          illumination: {
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
        ...(siteType === "digital" && { retail_spot: { spot_number: selectedRetailSpots } }),
        media: mediaUrls,
        type: "RENTAL",
        active: true,
      }

      await createProduct(productData)

      // Reset form
      setSiteType("digital")
      setCategory(DIGITAL_CATEGORIES[0])
      setSiteName("")
      setLocation("")
      setLocationLabel("")
      setGeopoint(null)
      setHeight("")
      setWidth("")
      setDimensionUnit("ft")
      setElevation("")
      setElevationUnit("ft")
      setDescription("")
      setSelectedAudience([])
      setDailyTraffic("")
      setPrice("0")
      setPriceUnit("per month")
      setUploadedFiles([])
      setCurrentImageIndex(0)
      setLandOwner("")
      setPartner("")
      setOrientation("")
      setLocationVisibility("")
      setLocationVisibilityUnit("ft")
      setPlayerId("")
      setSpotInputs([])
      setSelectedRetailSpots([])

      onClose()

      toast({
        title: "Site added successfully",
        description: `${siteName} has been added to your inventory.`,
      })

      if (refreshData) {
        refreshData()
      }
    } catch (error) {
      console.error("Error creating product:", error)
      toast({
        title: "Error",
        description: "Failed to add site. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[20px] py-0 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
        <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b px-6 mb-0 min-h-[4rem] flex items-start pt-6">
          <DialogTitle className="text-2xl font-semibold text-[#333333]">Add site</DialogTitle>
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
            {/* Category */}
            <div>
              <Label className="text-[#4e4e4e] font-medium mb-3 block">Category:</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-[#c4c4c4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIGITAL_CATEGORIES.map((cat) => (
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
                placeholder="e.g., Near Mall, Highway Side"
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
                    placeholder="e.g., 10"
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
                    placeholder="e.g., 20"
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
                  placeholder="e.g., 5"
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
                placeholder="Describe the site location, visibility, and any special features..."
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
                    className={`w-12 h-10 ${selectedAudience.includes(type)
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
              <Label className="text-[#4e4e4e] font-medium mb-3 block">Monthly Traffic Count:</Label>
              <Input
                type="text"
                placeholder="e.g., 50000"
                className="border-[#c4c4c4]"
                value={dailyTraffic}
                onChange={(e) => handleFormattedNumberInput(e, setDailyTraffic)}
              />
            </div>

            {/* Photo Upload */}
            <div>
              <Label className="text-[#4e4e4e] font-medium mb-3 block">
                Photo: <span className="text-[#c4c4c4]">(can upload multiple)</span>
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
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                          onClick={handleNextImage}
                        >
                          <ChevronRight className="h-4 w-4" />
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
                          className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${index === currentImageIndex ? 'border-blue-500' : 'border-gray-300'
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
                  id="add-file-upload"
                />
                <label htmlFor="add-file-upload" className="cursor-pointer">
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
                  placeholder="e.g., 15000"
                  className="flex-1 border-[#c4c4c4]"
                  value={price}
                  onChange={(e) => handlePriceChange(e, setPrice)}
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
                  <div className="space-y-2 mb-2">
                    <Label className="text-[#4e4e4e] font-medium mb-3 block">Player ID:</Label>
                    <Input
                      placeholder="Enter player ID"
                      className="border-[#c4c4c4]"
                      value={playerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                    />
                 </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Player ID */}

                  <div className="space-y-2">
                    <Label htmlFor="add-start_time" className="text-[#4e4e4e] font-medium mb-3 block">Start Time</Label>
                    <Input
                      id="add-start_time"
                      type="time"
                      className="border-[#c4c4c4]"
                      value={cms.start_time}
                      onChange={(e) => setCms(prev => ({ ...prev, start_time: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-end_time" className="text-[#4e4e4e] font-medium mb-3 block">End Time</Label>
                    <Input
                      id="add-end_time"
                      type="time"
                      className="border-[#c4c4c4]"
                      value={cms.end_time}
                      onChange={(e) => setCms(prev => ({ ...prev, end_time: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-spot_duration" className="text-[#4e4e4e] font-medium mb-3 block">Spot Duration (seconds)</Label>
                    <Input
                      id="add-spot_duration"
                      type="number"
                      className="border-[#c4c4c4]"
                      value={cms.spot_duration}
                      onChange={(e) => setCms(prev => ({ ...prev, spot_duration: e.target.value }))}
                      placeholder="Enter duration in seconds"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-loops_per_day" className="text-[#4e4e4e] font-medium mb-3 block">Spots Per Loop</Label>
                    <Input
                      id="add-loops_per_day"
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
                    className={`mt-4 p-4 rounded-lg border ${validationError.startsWith("✓")
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

            {/* Spot Inputs for Digital Sites */}
            {siteType === "digital" && spotInputs.length > 0 && (
              <div>
                <Label className="text-[#4e4e4e] font-medium mb-3 block">Spot Configuration:</Label>
                <div className="grid grid-cols-5 gap-4">
                  {spotInputs.map((input, index) => (
                    <div
                      key={index}
                      className={`flex flex-col h-[70px] w-[70px] items-center justify-center shadow-md rounded-[10px] px-3 py-2 cursor-pointer ${selectedRetailSpots.includes(index + 1) ? 'bg-indigo-100' : 'bg-white'}`}
                      onClick={() => {
                        if (selectedRetailSpots.includes(index + 1)) {
                          setSelectedRetailSpots(prev => prev.filter(id => id !== index + 1))
                        } else {
                          setSelectedRetailSpots(prev => [...prev, index + 1])
                        }
                      }}
                    >
                      <span className="text-xs text-center font-semibold">
                        {index + 1} / {spotInputs.length}
                      </span>
                    </div>
                  ))}
                </div>
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
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="px-8 bg-[#1d0beb] hover:bg-[#1508d1] text-white"
              onClick={handleAddSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}