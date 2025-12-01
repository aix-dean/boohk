"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Upload, Trash2 } from "lucide-react"
import { getPaginatedUserProducts, updateProduct, createProduct, uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { Product } from "oh-db-models/dist/products/types"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { serverTimestamp, Timestamp } from "firebase/firestore"
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

// Number of items to display per page
const ITEMS_PER_PAGE = 12

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

interface AddEditSiteDialogProps {
  isOpen: boolean
  onClose: () => void
  editingProduct?: Product | null
  userData: any
  user: any
  onSuccess: () => void
}

export function AddEditSiteDialog({
  isOpen,
  onClose,
  editingProduct,
  userData,
  user,
  onSuccess
}: AddEditSiteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Form state
  const [siteType, setSiteType] = useState<"static" | "digital">("digital")
  const [cms, setCms] = useState<CmsData>({
    start_time: "07:00",
    end_time: "23:00",
    spot_duration: "",
    loops_per_day: ""
  })
  const [validationError, setValidationError] = useState<string | null>(null)
  const [category, setCategory] = useState(DIGITAL_CATEGORIES[0])
  const [siteName, setSiteName] = useState("")
  const [location, setLocation] = useState("")
  const [locationLabel, setLocationLabel] = useState("")
  const [geopoint, setGeopoint] = useState<GeoPoint | null>(null)
  const [height, setHeight] = useState("50")
  const [width, setWidth] = useState("50")
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
  const [orientation, setOrientation] = useState("North")
  const [locationVisibility, setLocationVisibility] = useState("")
  const [locationVisibilityUnit, setLocationVisibilityUnit] = useState<string>("ft")

  const [playerId, setPlayerId] = useState("")
  const [spotInputs, setSpotInputs] = useState<string[]>([])
  const [selectedRetailSpots, setSelectedRetailSpots] = useState<number[]>([])
  // New fields from Figma design
  const [resolutionWidth, setResolutionWidth] = useState("")
  const [resolutionHeight, setResolutionHeight] = useState("")
  const [brightness, setBrightness] = useState("")
  const [notableCampaigns, setNotableCampaigns] = useState<File[]>([])
  const [specialRateEnabled, setSpecialRateEnabled] = useState(false)
  const [specialRateType, setSpecialRateType] = useState<"multiplier" | "amount">("multiplier")
  const [specialRateMultiplier, setSpecialRateMultiplier] = useState("")
  const [specialRateAmount, setSpecialRateAmount] = useState("")
  const [triggers, setTriggers] = useState({
    manualToggle: false,
    autoTrigger: false,
    autoTriggerPercentage: "50"
  })
  // New state for multiple image uploads
  const [displayPhotos, setDisplayPhotos] = useState<Array<{ file: File | null; caption: string; url?: string }>>([
    { file: null, caption: "" }
  ])
  const [campaignPhotos, setCampaignPhotos] = useState<Array<{ file: File | null; caption: string; url?: string }>>([
    { file: null, caption: "" }
  ])

  // Refs for required fields to enable auto-scrolling
  const siteNameRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const widthRef = useRef<HTMLInputElement>(null)
  const heightRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const endTimeRef = useRef<HTMLInputElement>(null)
  const spotDurationRef = useRef<HTMLInputElement>(null)
  const loopsPerDayRef = useRef<HTMLInputElement>(null)

  // Scroll to field utility function
  const scrollToField = (ref: React.RefObject<any>) => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
      // Focus the field after scrolling
      setTimeout(() => {
        if (ref.current && 'focus' in ref.current) {
          ref.current.focus()
        }
      }, 500)
    }
  }

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

  // Handlers for multiple image uploads
  const handleDisplayPhotoUpload = (index: number, file: File | null) => {
    setDisplayPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, file } : photo
    ))
  }

  const handleDisplayPhotoCaptionChange = (index: number, caption: string) => {
    setDisplayPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, caption } : photo
    ))
  }

  const addDisplayPhotoRow = () => {
    setDisplayPhotos(prev => [...prev, { file: null, caption: "" }])
  }

  const removeDisplayPhotoRow = (index: number) => {
    if (displayPhotos.length > 1) {
      setDisplayPhotos(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleCampaignPhotoUpload = (index: number, file: File | null) => {
    setCampaignPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, file } : photo
    ))
  }

  const handleCampaignPhotoCaptionChange = (index: number, caption: string) => {
    setCampaignPhotos(prev => prev.map((photo, i) =>
      i === index ? { ...photo, caption } : photo
    ))
  }

  const addCampaignPhotoRow = () => {
    setCampaignPhotos(prev => [...prev, { file: null, caption: "" }])
  }

  const removeCampaignPhotoRow = (index: number) => {
    if (campaignPhotos.length > 1) {
      setCampaignPhotos(prev => prev.filter((_, i) => i !== index))
    }
  }
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

  // Initialize form when dialog opens or editing product changes
  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        // Edit mode - populate with existing data
        setSiteType(editingProduct.content_type || "digital")
        setCategory(editingProduct.categories?.[0] || DIGITAL_CATEGORIES[0])
        setSiteName(editingProduct.name || "")
        setLocation(editingProduct.specs_rental?.location || "")
        setLocationLabel(editingProduct.specs_rental?.location_label || "")
        setGeopoint(editingProduct.specs_rental?.geopoint || null)
        setHeight(editingProduct.specs_rental?.height ? String(editingProduct.specs_rental.height) : "")
        setWidth(editingProduct.specs_rental?.width ? String(editingProduct.specs_rental.width) : "")
        setDimensionUnit("ft")
        setElevation(editingProduct.specs_rental?.elevation ? String(editingProduct.specs_rental.elevation) : "")
        setElevationUnit("ft")
        setDescription(editingProduct.description || "")
        setSelectedAudience(editingProduct.specs_rental?.audience_profile || editingProduct.specs_rental?.audience_type || [])
        setDailyTraffic(editingProduct.specs_rental?.traffic_count ? String(editingProduct.specs_rental.traffic_count) : "")
        setPrice(editingProduct.price ? formatPriceOnBlur(String(editingProduct.price)) : "0")
        setPriceUnit("per spot")
        setUploadedFiles([])
        setCurrentImageIndex(0)

        // Set CMS data if it exists
        if (editingProduct.cms) {
          setCms({
            start_time: editingProduct.cms.start_time || "06:00",
            end_time: editingProduct.cms.end_time || "22:00",
            spot_duration: editingProduct.cms.spot_duration ? String(editingProduct.cms.spot_duration) : "",
            loops_per_day: editingProduct.cms.loops_per_day ? String(editingProduct.cms.loops_per_day) : "",
          })
        } else {
          // Set defaults for new digital sites
          setCms({
            start_time: "06:00",
            end_time: "22:00",
            spot_duration: "",
            loops_per_day: "",
          })
        }

        setPlayerId(editingProduct.playerIds?.[0] || "")
        setSpotInputs(new Array(parseInt(editingProduct.cms?.loops_per_day || "0") || 0).fill("")) // Initialize based on CMS
        setSelectedRetailSpots(editingProduct.retail_spot?.spot_number || [])
        setResolutionWidth(editingProduct.specs_rental?.resolution?.width ? String(editingProduct.specs_rental.resolution.width) : "")
        setResolutionHeight(editingProduct.specs_rental?.resolution?.height ? String(editingProduct.specs_rental.resolution.height) : "")
        setBrightness(editingProduct.specs_rental?.brightness || "")
        setLandOwner(editingProduct.specs_rental?.land_owner || "")
        setPartner(editingProduct.specs_rental?.partner || "")
        setLocationVisibility(editingProduct.specs_rental?.location_visibility ? String(editingProduct.specs_rental.location_visibility) : "")
        setLocationVisibilityUnit(editingProduct.specs_rental?.location_visibility_unit || "ft")
        setDimensionUnit((editingProduct.specs_rental?.dimension_unit as "ft" | "m") || "ft")
        setElevationUnit("ft") // Default, as it's not saved
        setSpecialRateEnabled(editingProduct.enable_special_rate || false)
        setSpecialRateType("multiplier") // Default
        setSpecialRateMultiplier("") // Default
        setSpecialRateAmount("") // Default
        setTriggers({
          manualToggle: editingProduct.cms?.triggers?.manual || false,
          autoTrigger: editingProduct.cms?.triggers?.auto || false,
          autoTriggerPercentage: editingProduct.cms?.triggers?.occupancy_percentage ? String(editingProduct.cms.triggers.occupancy_percentage) : "50"
        })
        // Initialize display photos from existing media
        if (editingProduct.media && editingProduct.media.length > 0) {
          const displayPhotosData = editingProduct.media.map(media => ({
            file: null,
            caption: media.description || "",
            url: media.url
          }))
          setDisplayPhotos(displayPhotosData)
        } else {
          setDisplayPhotos([{ file: null, caption: "" }])
        }
        // Initialize campaign photos from notable campaigns
        if (editingProduct.specs_rental?.notable_campaigns && editingProduct.specs_rental.notable_campaigns.length > 0) {
          const campaignPhotosData = editingProduct.specs_rental.notable_campaigns.map(campaign => ({
            file: null,
            caption: campaign.caption || "",
            url: campaign.image_url
          }))
          setCampaignPhotos(campaignPhotosData)
        } else {
          setCampaignPhotos([{ file: null, caption: "" }])
        }
        setValidationError(null)
      } else {
        // Add mode - reset to defaults
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
        setPrice("")
        setPriceUnit("per month")
        setUploadedFiles([])
        setCurrentImageIndex(0)
        setLandOwner("")
        setPartner("")
        setOrientation("North")
        setLocationVisibility("")
        setLocationVisibilityUnit("ft")
        setPlayerId("")
        setSpotInputs([])
        setSelectedRetailSpots([])
        setDisplayPhotos([{ file: null, caption: "" }])
        setCampaignPhotos([{ file: null, caption: "" }])

        setResolutionWidth("")
        setResolutionHeight("")
        setBrightness("")
        setNotableCampaigns([])
        setSpecialRateEnabled(false)
        setSpecialRateType("multiplier")
        setSpecialRateMultiplier("")
        setSpecialRateAmount("")
        setTriggers({
          manualToggle: false,
          autoTrigger: false,
          autoTriggerPercentage: "50"
        })

        setValidationErrors([])
        setValidationError(null)

        // Set default CMS values for new sites
        setCms({
          start_time: "07:00",
          end_time: "23:00",
          spot_duration: "",
          loops_per_day: "",
        })
        // Clear spot inputs
        setSpotInputs([])
      }
    }
  }, [isOpen, editingProduct])

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
        loops_per_day: "18",
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
      if (spotInputs.length !== spots) {
        setSpotInputs(new Array(spots).fill(""))
        setSelectedRetailSpots([])
      }
    } else {
      setSpotInputs([])
      setSelectedRetailSpots([])
    }
  }, [siteType, cms.loops_per_day, spotInputs.length])

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

  const handleSubmit = async () => {
    if (!userData?.company_id || !user?.uid) return

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

    if (!width.trim()) {
      errors.push("Width")
    }

    if (!height.trim()) {
      errors.push("Height")
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

    // Validate digital site specific fields
    if (siteType === "digital") {
      if (!cms.start_time) {
        errors.push("Start Time")
      }
      if (!cms.end_time) {
        errors.push("End Time")
      }
      if (!cms.spot_duration) {
        errors.push("Spot Duration")
      }
      if (!cms.loops_per_day) {
        errors.push("Number of Spots")
      }
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
      // Scroll to the dynamic content section (start time field)
      scrollToField(startTimeRef)
      setIsSubmitting(false)
      return
    }

    // Validate new Figma fields
    if (resolutionWidth.trim() && isNaN(Number(resolutionWidth))) {
      toast({
        title: "Validation Error",
        description: "Resolution Width must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (resolutionHeight.trim() && isNaN(Number(resolutionHeight))) {
      toast({
        title: "Validation Error",
        description: "Resolution Height must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (brightness.trim() && isNaN(Number(brightness))) {
      toast({
        title: "Validation Error",
        description: "Brightness must be a valid number.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (specialRateEnabled) {
      if (specialRateType === "multiplier" && specialRateMultiplier.trim() && isNaN(Number(specialRateMultiplier))) {
        toast({
          title: "Validation Error",
          description: "Special Rate Multiplier must be a valid number.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      if (specialRateType === "amount" && specialRateAmount.trim() && isNaN(Number(specialRateAmount))) {
        toast({
          title: "Validation Error",
          description: "Special Rate Amount must be a valid number.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }
    }

    if (triggers.autoTrigger && triggers.autoTriggerPercentage.trim() && isNaN(Number(triggers.autoTriggerPercentage))) {
      toast({
        title: "Validation Error",
        description: "Auto Trigger Percentage must be a valid number.",
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

      // Scroll to first missing required field
      if (!siteName.trim()) {
        scrollToField(siteNameRef)
      } else if (!location.trim()) {
        scrollToField(locationRef)
      } else if (!width.trim()) {
        scrollToField(widthRef)
      } else if (!height.trim()) {
        scrollToField(heightRef)
      } else if (!price.trim()) {
        scrollToField(priceRef)
      } else if (siteType === "digital") {
        if (!cms.start_time) {
          scrollToField(startTimeRef)
        } else if (!cms.end_time) {
          scrollToField(endTimeRef)
        } else if (!cms.spot_duration || isNaN(Number(cms.spot_duration)) || Number(cms.spot_duration) <= 0) {
          scrollToField(spotDurationRef)
        } else if (!cms.loops_per_day || isNaN(Number(cms.loops_per_day)) || Number(cms.loops_per_day) <= 0) {
          scrollToField(loopsPerDayRef)
        }
      }

      setIsSubmitting(false)
      return
    }

    try {
      // Upload files to Firebase Storage
      const mediaUrls: Array<{ url: string; distance: string; type: string; isVideo: boolean; description: string }> = []
      for (const file of uploadedFiles) {
        const url = await uploadFileToFirebaseStorage(file, `products/${userData.company_id}`)
        mediaUrls.push({
          url,
          distance: "0",
          type: file.type,
          isVideo: file.type.startsWith('video/'),
          description: ""
        })
      }
      // Upload display photos
      const displayPhotoUrls: Array<{ url: string; caption: string }> = []
      for (const photo of displayPhotos) {
        if (photo.file) {
          const url = await uploadFileToFirebaseStorage(photo.file, `products/${userData.company_id}`)
          displayPhotoUrls.push({
            url,
            caption: photo.caption
          })
          // Also add to media for gallery
          mediaUrls.push({
            url,
            distance: "0",
            type: photo.file.type,
            isVideo: photo.file.type.startsWith('video/'),
            description: photo.caption
          })
        }
      }

      // Upload campaign photos
      const campaignPhotoUrls: Array<{ url: string; caption: string }> = []
      for (const photo of campaignPhotos) {
        if (photo.file) {
          const url = await uploadFileToFirebaseStorage(photo.file, `products/${userData.company_id}`)
          campaignPhotoUrls.push({
            url,
            caption: photo.caption
          })
        }
      }

      if (editingProduct) {
        // Edit mode
        // Combine with existing media
        const allMedia = [...(editingProduct.media || []), ...mediaUrls]

        // Create update data
        const updateData: any = {
          name: siteName,
          description,
          price: parseFloat(price.replace(/,/g, '')) || 0,
          content_type: siteType,
          categories: [category],
          ...(siteType === "digital" && {
            cms: {
              start_time: cms.start_time,
              end_time: cms.end_time,
              spot_duration: parseInt(cms.spot_duration) || 0,
              loops_per_day: parseInt(cms.loops_per_day) || 0,
              serial_number: playerId || "",
              triggers: {
                manual: triggers.manualToggle,
                auto: triggers.autoTrigger,
                occupancy_percentage: parseInt(triggers.autoTriggerPercentage) || 50
              }
            }
          }),
          playerIds: siteType === "digital" ? [playerId || ""] : [],
          specs_rental: {
            audience_type: selectedAudience,
            location,
            location_label: locationLabel,
            land_owner: landOwner,
            partner,
            orientation,
            location_visibility: parseFloat(locationVisibility.replace(/,/g, '')) || 0,
            location_visibility_unit: locationVisibilityUnit,
            traffic_count: parseInt(dailyTraffic.replace(/,/g, '')) || 0,
            height: parseFloat(height.replace(/,/g, '')) || 0,
            width: parseFloat(width.replace(/,/g, '')) || 0,
            elevation: parseFloat(elevation.replace(/,/g, '')) || 0,
            dimension_unit: dimensionUnit,
            elevation_unit: elevationUnit,
            resolution: {
              width: parseInt(resolutionWidth) || 0,
              height: parseInt(resolutionHeight) || 0,
            },
            audience_profile: selectedAudience,
            brightness: brightness || "",
            facing_direction: orientation,
            viewability_distance: locationVisibility || "",
            notable_campaigns: [],
            illumination: {
              bottom_count: 0,
              upper_count: 0,
              left_count: 0,
              right_count: 0,
              bottom_lighting_specs: "",
              upper_lighting_specs: "",
              left_lighting_specs: "",
              right_lighting_specs: "",
            },
            structure: {
              color: "",
              condition: "",
              contractor: "",
              last_maintenance: serverTimestamp(),
            },
          },
          retail_spot: { spot_number: selectedRetailSpots },
          media: allMedia,
          updated: serverTimestamp(),
        }

        if (geopoint) {
          updateData.specs_rental.geopoint = geopoint
        }

        // Update in Firestore
        await updateProduct(editingProduct.id, updateData)

        toast({
          title: "Site updated successfully",
          description: `${siteName} has been updated.`,
        })
      } else {
        // Add mode
        // Create product data
        const productData: Partial<Product> = {
          name: siteName,
          description,
          price: parseFloat(price.replace(/,/g, '')) || 0,
          content_type: siteType,
          categories: [category],
          company_id: userData.company_id,
          seller_id: user?.uid,
          seller_name: user?.displayName || user?.email || "",
          type: "RENTAL",
          ...(siteType === "digital" && {
            cms: {
              start_time: cms.start_time,
              end_time: cms.end_time,
              spot_duration: parseInt(cms.spot_duration) || 0,
              loops_per_day: parseInt(cms.loops_per_day) || 0,
              serial_number: playerId || "",
              triggers: {
                manual: triggers.manualToggle,
                auto: triggers.autoTrigger,
                occupancy_percentage: parseInt(triggers.autoTriggerPercentage) || 50
              }
            }
          }),
          playerIds: siteType === "digital" ? [playerId || ""] : [],
          specs_rental: {
            audience_type: selectedAudience,
            location,
            location_label: locationLabel,
            land_owner: landOwner,
            partner,
            orientation,
            location_visibility: parseFloat(locationVisibility.replace(/,/g, '')) || 0,
            location_visibility_unit: locationVisibilityUnit,
            ...(geopoint && { geopoint }),
            traffic_count: parseInt(dailyTraffic.replace(/,/g, '')) || 0,
            height: parseFloat(height.replace(/,/g, '')) || 0,
            width: parseFloat(width.replace(/,/g, '')) || 0,
            elevation: parseFloat(elevation.replace(/,/g, '')) || 0,
            dimension_unit: dimensionUnit,
            elevation_unit: elevationUnit,
            resolution: {
              width: parseInt(resolutionWidth) || 0,
              height: parseInt(resolutionHeight) || 0,
            },
            audience_profile: selectedAudience,
            brightness: brightness || "",
            facing_direction: orientation,
            viewability_distance: locationVisibility || "",
            notable_campaigns: campaignPhotoUrls.map(photo => ({
              image_url: photo.url,
              caption: photo.caption,
              uploaded_date: Timestamp.fromDate(new Date())
            })),
            illumination: {
              bottom_count: 0,
              upper_count: 0,
              left_count: 0,
              right_count: 0,
              bottom_lighting_specs: "",
              upper_lighting_specs: "",
              left_lighting_specs: "",
              right_lighting_specs: "",
            },
            structure: {
              color: "",
              condition: "",
              contractor: "",
              last_maintenance: serverTimestamp(),
            },
          },
          retail_spot: { spot_number: selectedRetailSpots },
          media: mediaUrls,
          active: true,
          rating: 0,
          enable_special_rate: specialRateEnabled,
          position: 0,
          status: "PENDING",
          created: serverTimestamp(),
        }

        await createProduct(productData)

        toast({
          title: "Site added successfully",
          description: `${siteName} has been added to your inventory.`,
        })
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error saving product:", error)
      toast({
        title: "Error",
        description: editingProduct ? "Failed to update site. Please try again." : "Failed to add site. Please try again.",
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
          <DialogTitle className="text-2xl font-semibold text-[#333333]">{editingProduct ? "Edit site" : "Add site"}</DialogTitle>
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
            {/* Basic Information */}
            <div>
              <h3 className="text-[16px] font-semibold leading-[20px] text-[#333333] mb-4">Basic Information</h3>
              <div className="space-y-4">
                {/* Display Name */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Display Name: <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    ref={siteNameRef}
                    placeholder="Display Name"
                    className="border-[#c4c4c4]"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                  />
                </div>

                {/* Location */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Location: <span className="text-red-500">*</span>
                  </Label>
                  <div ref={locationRef}>
                    <GooglePlacesAutocomplete
                      value={location}
                      onChange={setLocation}
                      onGeopointChange={setGeopoint}
                      placeholder="Location"
                      enableMap={true}
                      mapHeight="250px"
                    />
                  </div>
                </div>

                {/* Display Type */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Display Type: <span className="text-red-500">*</span>
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="border-[#c4c4c4]">
                      <SelectValue placeholder="-- select one --" />
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

                {/* Facing Direction */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Facing Direction: <span className="text-red-500">*</span>
                  </Label>
                  <Select value={orientation} onValueChange={setOrientation}>
                    <SelectTrigger className="border-[#c4c4c4]">
                      <SelectValue placeholder="Select facing direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="North">North</SelectItem>
                      <SelectItem value="South">South</SelectItem>
                      <SelectItem value="East">East</SelectItem>
                      <SelectItem value="West">West</SelectItem>
                      <SelectItem value="Northeast">Northeast</SelectItem>
                      <SelectItem value="Northwest">Northwest</SelectItem>
                      <SelectItem value="Southeast">Southeast</SelectItem>
                      <SelectItem value="Southwest">Southwest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Short Description */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Short Description: <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="Max of 500 characters"
                    className="border-[#c4c4c4] h-[72px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div>
              <h3 className="text-[16px] font-semibold leading-[20px] text-[#333333] mb-4">Technical Specifications</h3>
              <div className="space-y-4">
                {/* Dimensions */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Dimensions</Label>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-[#4e4e4e] text-[12px] mb-1 block">
                        Width (ft): <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={widthRef}
                        type="text"
                        placeholder="Width"
                        className="border-[#c4c4c4]"
                        value={width}
                        onChange={(e) => handleFormattedNumberInput(e, setWidth)}
                      />
                    </div>
                    <span className="text-[#4e4e4e]">X</span>
                    <div className="flex-1">
                      <Label className="text-[#4e4e4e] text-[12px] mb-1 block">
                        Height (ft): <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={heightRef}
                        type="text"
                        placeholder="Height"
                        className="border-[#c4c4c4]"
                        value={height}
                        onChange={(e) => handleFormattedNumberInput(e, setHeight)}
                      />
                    </div>
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Resolution</Label>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-[#4e4e4e] text-[12px] mb-1 block">
                        Width (ft): <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="Width"
                        className="border-[#c4c4c4]"
                        value={resolutionWidth}
                        onChange={(e) => setResolutionWidth(e.target.value)}
                      />
                    </div>
                    <span className="text-[#4e4e4e]">X</span>
                    <div className="flex-1">
                      <Label className="text-[#4e4e4e] text-[12px] mb-1 block">
                        Height (ft): <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="Height"
                        className="border-[#c4c4c4]"
                        value={resolutionHeight}
                        onChange={(e) => setResolutionHeight(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Preview</Label>
                  <div className="bg-[#c6c6c6] h-[250px] rounded-lg flex flex-col items-center justify-center p-4">
                    {(() => {
                      const widthNum = parseFloat(width.replace(/,/g, '')) || 0;
                      const heightNum = parseFloat(height.replace(/,/g, '')) || 0;

                      if (widthNum > 0 && heightNum > 0) {
                        // Display actual dimensions with reasonable maximum constraints
                        const maxDisplayWidth = 140;
                        const maxDisplayHeight = 140;
                        const aspectRatio = widthNum / heightNum;

                        let displayWidth = widthNum;
                        let displayHeight = heightNum;

                        // Scale down if dimensions exceed maximum display size
                        if (displayWidth > maxDisplayWidth) {
                          displayWidth = maxDisplayWidth;
                          displayHeight = maxDisplayWidth / aspectRatio;
                        }

                                                // Ensure minimum display size for small dimensions
                        const minDisplaySize = 60;
                        if (displayWidth < minDisplaySize) {
                          displayWidth = minDisplaySize;
                          displayHeight = minDisplaySize / aspectRatio;
                        }
                        if (displayHeight < minDisplaySize) {
                          displayHeight = minDisplaySize;
                          displayWidth = minDisplaySize * aspectRatio;
                        }

                        if (displayWidth > maxDisplayWidth) {
                          displayWidth = maxDisplayWidth;
                          displayHeight = maxDisplayWidth / aspectRatio;
                        }

                        if (displayHeight > maxDisplayHeight) {
                          displayHeight = maxDisplayHeight;
                          displayWidth = maxDisplayHeight * aspectRatio;
                        }

                        return (
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className="bg-white border-2 border-gray-400 rounded shadow-sm relative"
                              style={{
                                width: `${displayWidth}px`,
                                height: `${displayHeight}px`,
                                
                                minHeight: '5px'
                              }}
                            >
                            </div>
                            <span className="text-xs text-gray-600">
                              {widthNum} ft × {heightNum} ft
                            </span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="w-[120px] h-[80px] bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400">
                            <span className="text-gray-500 text-sm">Enter dimensions</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>

                {/* Brightness */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Brightness</Label>
                  <Input
                    type="text"
                    placeholder="Brightness"
                    className="border-[#c4c4c4]"
                    value={brightness}
                    onChange={(e) => setBrightness(e.target.value)}
                  />
                </div>

                {/* Operating Hours */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Operating Hours</Label>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-[#4e4e4e] text-[12px] mb-1 block">
                        Start Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={startTimeRef}
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.start_time}
                        onChange={(e) => setCms(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                    </div>
                    <span className="text-[#4e4e4e]">-</span>
                    <div className="flex-1">
                      <Label className="text-[#4e4e4e] text-[12px] mb-1 block">
                        End Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        ref={endTimeRef}
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.end_time}
                        onChange={(e) => setCms(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Spot Duration and No. of Spots */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                      Spot Duration (seconds) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      ref={spotDurationRef}
                      type="number"
                      placeholder="Spot Duration"
                      className="border-[#c4c4c4]"
                      value={cms.spot_duration}
                      onChange={(e) => setCms(prev => ({ ...prev, spot_duration: e.target.value }))}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                      Number of Spots <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      ref={loopsPerDayRef}
                      type="number"
                      placeholder="No. of Spots"
                      className="border-[#c4c4c4]"
                      value={cms.loops_per_day}
                      onChange={(e) => setCms(prev => ({ ...prev, loops_per_day: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Total Spots and Spot Grid */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[#4e4e4e] text-[8px]">Total Spots: {spotInputs.length}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
                      <span className="text-[#4e4e4e] text-[8px]">Operator's Program: {spotInputs.length - selectedRetailSpots.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-[#c1bcf9] rounded"></div>
                      <span className="text-[#4e4e4e] text-[8px]">Retail Spots: {selectedRetailSpots.length}</span>
                    </div>
                  </div>
                  <div className="text-[#4e4e4e] text-[8px]">
                    Select the spots that you want to open for retail booking:
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

                  <div className="grid grid-cols-5 gap-4">
                    {spotInputs.map((_, index) => (
                      <div
                        key={index}
                        className={`flex flex-col h-[52px] w-[52px] items-center justify-center rounded-lg shadow-md cursor-pointer ${
                          selectedRetailSpots.includes(index + 1) ? 'bg-indigo-100' : 'bg-white'
                        }`}
                        onClick={() => {
                          if (selectedRetailSpots.includes(index + 1)) {
                            setSelectedRetailSpots(prev => prev.filter(id => id !== index + 1))
                          } else {
                            setSelectedRetailSpots(prev => [...prev, index + 1])
                          }
                        }}
                      >
                        <span className="text-xs text-center font-semibold">
                          {index + 1}/{spotInputs.length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Visual Asset */}
            <div>
              <h3 className="text-[16px] font-semibold leading-[20px] text-[#333333] mb-4">Visual Asset</h3>
              <div className="space-y-4">
                {/* Display Photos */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Display Photos
                  </Label>
                  <p className="text-[#666666] text-[8px] mb-2">Site gallery for listings, multiple photos can be uploaded</p>
                  <div className="space-y-3">
                    {displayPhotos.map((photo, index) => (
                      <div key={index} className="flex gap-4 items-center">
                        <label htmlFor={`display-photo-${index}`} className="bg-[#dedede] border border-[#c4c4c4] rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors w-[80px] h-[80px]">
                          {photo.file || photo.url ? (
                            <img
                              src={photo.file ? URL.createObjectURL(photo.file) : photo.url}
                              alt="Preview"
                              className="max-w-full max-h-full object-cover rounded"
                            />
                          ) : (
                            <Upload className="w-6 h-6 text-black" />
                          )}
                          <input
                            id={`display-photo-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleDisplayPhotoUpload(index, file)
                            }}
                          />
                        </label>
                        <div className="flex-1">
                          <Input
                            placeholder="add a caption"
                            className="border-[#c4c4c4]"
                            value={photo.caption}
                            onChange={(e) => handleDisplayPhotoCaptionChange(index, e.target.value)}
                          />
                        </div>
                        {displayPhotos.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDisplayPhotoRow(index)}
                            className="p-1 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addDisplayPhotoRow}
                      className="w-full border-dashed border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                    >
                      + Add another photo
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance and Reach */}
            <div>
              <h3 className="text-[16px] font-semibold leading-[20px] text-[#333333] mb-4">Performance and Reach</h3>
              <div className="space-y-4">
                {/* Average Daily Traffic */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Average Daily Traffic
                  </Label>
                  <Input
                    type="text"
                    placeholder="Traffic data"
                    className="border-[#c4c4c4]"
                    value={dailyTraffic}
                    onChange={(e) => handleFormattedNumberInput(e, setDailyTraffic)}
                  />
                </div>

                {/* Audience Profile */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Audience Profile</Label>
                  <p className="text-[8px] mb-2">Multiple profiles can be selected</p>
                  <div className="flex gap-2">
                    {["A", "B", "C", "D", "E"].map((type) => (
                      <Button
                        key={`${type}-${selectedAudience.includes(type)}`}
                        variant="outline"
                        onClick={() => toggleAudience(type)}
                        className={`w-12 h-10 rounded-lg border-[#c4c4c4] ${
                          selectedAudience.includes(type)
                            ? "bg-[#4a9a40] text-white border-[#4a9a40]"
                            : "bg-white text-[#1a1a1a] hover:bg-gray-50"
                        }`}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Viewability Distance */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Viewability Distance</Label>
                  <p className="text-[#666666] text-[8px] mb-2">How far away can the audience see the site</p>
                  <Input
                    type="text"
                    placeholder="Viewability distance"
                    className="border-[#c4c4c4]"
                    value={locationVisibility}
                    onChange={(e) => handleFormattedNumberInput(e, setLocationVisibility)}
                  />
                </div>

                {/* Notable Campaigns */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Notable Campaigns</Label>
                  <p className="text-[#666666] text-[8px] mb-2">Multiple campaign photos can be uploaded</p>
                  <div className="space-y-3">
                    {campaignPhotos.map((photo, index) => (
                      <div key={index} className="flex gap-4 items-center">
                        <label htmlFor={`campaign-photo-${index}`} className="bg-[#dedede] border border-[#c4c4c4] rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors w-[80px] h-[80px]">
                          {photo.file || photo.url ? (
                            <img
                              src={photo.file ? URL.createObjectURL(photo.file) : photo.url}
                              alt="Preview"
                              className="max-w-full max-h-full object-cover rounded"
                            />
                          ) : (
                            <Upload className="w-6 h-6 text-black" />
                          )}
                          <input
                            id={`campaign-photo-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              handleCampaignPhotoUpload(index, file)
                            }}
                          />
                        </label>
                        <div className="flex-1">
                          <Input
                            placeholder="add a caption"
                            className="border-[#c4c4c4]"
                            value={photo.caption}
                            onChange={(e) => handleCampaignPhotoCaptionChange(index, e.target.value)}
                          />
                        </div>
                        {campaignPhotos.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCampaignPhotoRow(index)}
                            className="p-1 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCampaignPhotoRow}
                      className="w-full border-dashed border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
                    >
                      + Add another campaign photo
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-[16px] font-semibold leading-[20px] text-[#333333] mb-4">Pricing</h3>
              <div className="space-y-4">
                {/* Regular Rate */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Regular Rate (per spot per day): <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    ref={priceRef}
                    type="text"
                    placeholder="Regular rate"
                    className="border-[#c4c4c4]"
                    value={price}
                    onChange={(e) => handlePriceChange(e, setPrice)}
                    onBlur={(e) => handlePriceBlur(e, setPrice)}
                  />
                </div>

                {/* Special Rate */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Special Rate</Label>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={specialRateEnabled}
                      onChange={(e) => setSpecialRateEnabled(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-[#4e4e4e] text-[12px]">Enable special rate</span>
                  </div>
                  {specialRateEnabled && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="specialRateType"
                          checked={specialRateType === "multiplier"}
                          onChange={() => setSpecialRateType("multiplier")}
                          className="w-4 h-4"
                        />
                        <span className="text-[#4e4e4e] text-[12px]">Option A: Multiplier</span>
                      </div>
                      <p className="text-[#666666] text-[8px]">% increase from regular rate</p>
                      <Input
                        type="text"
                        placeholder="20%"
                        className="border-[#c4c4c4]"
                        value={specialRateMultiplier}
                        onChange={(e) => setSpecialRateMultiplier(e.target.value)}
                      />

                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="specialRateType"
                          checked={specialRateType === "amount"}
                          onChange={() => setSpecialRateType("amount")}
                          className="w-4 h-4 mt-1"
                        />
                        <div className="flex-1">
                          <span className="text-[#4e4e4e] text-[12px]">Option B: Specific Amount (per spot per day)</span>
                          <Input
                            type="text"
                            placeholder="15,000.00"
                            className="border-[#c4c4c4] mt-2"
                            value={specialRateAmount}
                            onChange={(e) => setSpecialRateAmount(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CMS */}
            <div>
              <h3 className="text-[16px] font-semibold leading-[20px] text-[#333333] mb-4">Content Management System (CMS)</h3>
              <div className="space-y-4">
                {/* Controller Serial Number */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">
                    Controller Serial Number: <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-[#666666] text-[8px] mb-2">Warning: Content will not be published automatically if site has no controller is connected</p>
                  <Input
                    placeholder="Controller serial number"
                    className="border-[#c4c4c4]"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                  />
                </div>

                {/* Triggers */}
                <div>
                  <Label className="text-[12px] font-normal leading-[16px] text-[#4e4e4e] mb-3 block">Triggers</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={triggers.manualToggle}
                        onChange={(e) => setTriggers(prev => ({ ...prev, manualToggle: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-[#4e4e4e] text-[12px]">Manual Toggle</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={triggers.autoTrigger}
                        onChange={(e) => setTriggers(prev => ({ ...prev, autoTrigger: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-[#4e4e4e] text-[12px]">Auto-trigger when site exceeds 50% occupancy</span>
                      <Button variant="link" className="text-[#3131fd] text-[12px] p-0 h-auto">
                        Set percentage
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {editingProduct ? "Updating..." : "Adding..."}
                </>
              ) : (
                editingProduct ? "Update" : "Add"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}