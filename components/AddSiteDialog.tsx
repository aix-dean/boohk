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

  // New fields from Figma design
  const [resolution, setResolution] = useState("")
  const [brightness, setBrightness] = useState("")
  const [viewability, setViewability] = useState("")
  const [notableCampaigns, setNotableCampaigns] = useState("")
  const [controllerSerialNumber, setControllerSerialNumber] = useState("")
  const [triggers, setTriggers] = useState({
    manualToggle: false,
    autoTriggerEnabled: false,
    autoTriggerPercentage: 50
  })
  const [specialRateEnabled, setSpecialRateEnabled] = useState(false)
  const [specialRateType, setSpecialRateType] = useState<"multiplier" | "amount">("multiplier")
  const [specialRateValue, setSpecialRateValue] = useState("")

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
      setResolution("")
      setBrightness("")
      setViewability("")
      setNotableCampaigns("")
      setControllerSerialNumber("")
      setTriggers({
        manualToggle: false,
        autoTriggerEnabled: false,
        autoTriggerPercentage: 50
      })
      setSpecialRateEnabled(false)
      setSpecialRateType("multiplier")
      setSpecialRateValue("")

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

        {/* Dialog content removed */}
        <div className="p-6">
          <p>Dialog content has been removed</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}