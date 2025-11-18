"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { gsap } from "gsap"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, MapPin, ChevronLeft, ChevronRight, Search, List, Grid3X3, Upload, Edit, Trash2, X } from "lucide-react"
import { getPaginatedUserProducts, getUserProductsCount, softDeleteProduct, createProduct, updateProduct, uploadFileToFirebaseStorage, getUserProductsRealtime, type Product } from "@/lib/firebase-service"
import { searchProducts, type SearchResult } from "@/lib/algolia-service"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { serverTimestamp } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { useResponsive } from "@/hooks/use-responsive"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { CompanyRegistrationDialog } from "@/components/company-registration-dialog"
import { CompanyUpdateDialog } from "@/components/company-update-dialog"
import { CompanyService } from "@/lib/company-service"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { subscriptionService } from "@/lib/subscription-service"
import { RouteProtection } from "@/components/route-protection"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import InventoryContent from "@/components/InventoryContent"
import AddSiteDialog from "@/components/AddSiteDialog"
import { GeoPoint } from "firebase/firestore"

// Number of items to display per page
const ITEMS_PER_PAGE = 15

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


export default function BusinessInventoryPage() {
  const router = useRouter()
  const { user, userData, subscriptionData, refreshUserData } = useAuth()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const { isMobile, isTablet } = useResponsive()

  // Company registration dialog state
  const [showCompanyDialog, setShowCompanyDialog] = useState(false)

  // Company update dialog state
  const [showCompanyUpdateDialog, setShowCompanyUpdateDialog] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingCount, setLoadingCount] = useState(false)

  // Search and view mode state
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Animation refs
  const cardsRef = useRef<HTMLDivElement>(null)
  const cardElementsRef = useRef<(HTMLDivElement | null)[]>([])
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  // Subscription limit dialog state
  const [showSubscriptionLimitDialog, setShowSubscriptionLimitDialog] = useState(false)
  const [subscriptionLimitMessage, setSubscriptionLimitMessage] = useState("")

  // Add site dialog state
  const [showAddSiteDialog, setShowAddSiteDialog] = useState(false)

  // Edit site dialog state
  const [showEditSiteDialog, setShowEditSiteDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Form state for edit dialog
  const [siteType, setSiteType] = useState<"static" | "digital">("digital")
  const [cms, setCms] = useState<CmsData>({
    start_time: "06:00",
    end_time: "22:00",
    spot_duration: "",
    loops_per_day: ""
  })
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  // Fetch total count of products
  const fetchTotalCount = useCallback(async () => {
    if (!userData?.company_id) {
      setTotalItems(0)
      setTotalPages(1)
      setLoadingCount(false)
      return
    }

    setLoadingCount(true)
    try {
      const count = await getUserProductsCount(userData?.company_id, { active: true })
      setTotalItems(count)
      setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (error) {
      console.error("Error fetching total count:", error)
      toast({
        title: "Error",
        description: "Failed to load product count. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingCount(false)
    }
  }, [userData, toast])

  // Set up real-time listener for products
  useEffect(() => {
    if (!userData?.company_id) {
      setAllProducts([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = getUserProductsRealtime(userData.company_id, (products) => {
      setAllProducts(products)
      setLoading(false)
    })

    return unsubscribe
  }, [userData?.company_id])

  // Refresh data when page becomes focused (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      if (userData?.company_id) {
        // Force refresh by temporarily setting loading and re-triggering the listener
        setLoading(true)
        const unsubscribe = getUserProductsRealtime(userData.company_id, (products) => {
          setAllProducts(products)
          setLoading(false)
        })

        // Clean up the temporary listener after a short delay
        setTimeout(() => {
          unsubscribe()
        }, 100)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [userData?.company_id])

  // Load total count
  useEffect(() => {
    fetchTotalCount()
  }, [userData?.company_id, fetchTotalCount])

  // Handle search query - use Algolia for search, fallback to client-side filtering
  useEffect(() => {
    const trimmedQuery = searchQuery.trim()

    if (!trimmedQuery) {
      setFilteredProducts(allProducts)
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const performSearch = async () => {
      setIsSearching(true)
      try {
        // Use Algolia search
        const searchResponse = await searchProducts(
          trimmedQuery,
          userData?.company_id || undefined,
          0, // page
          1000 // large number to get all results for client-side pagination
        )

        if (searchResponse.hits && searchResponse.hits.length > 0) {
          // Convert Algolia results back to Product format for consistency
          const productsFromSearch: Product[] = searchResponse.hits.map(hit => ({
            id: hit.objectID,
            name: hit.name,
            type: hit.type,
            price: hit.price,
            specs_rental: hit.specs_rental || {
              location: hit.location
            },
            media: hit.media || [],
            categories: hit.category ? [hit.category] : [],
            seller_id: hit.seller_id,
            company_id: userData?.company_id,
            description: hit.description,
            active: true,
            deleted: false,
            created: new Date(),
            updated: new Date()
          } as Product))

          setFilteredProducts(productsFromSearch)
          setSearchResults(searchResponse.hits)
        } else {
          // Fallback to client-side filtering if Algolia fails
          console.log("Algolia search failed, falling back to client-side filtering")
          const searchLower = trimmedQuery.toLowerCase()
          const filtered = allProducts.filter((product) =>
            product.name?.toLowerCase().includes(searchLower) ||
            product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower)
          )
          setFilteredProducts(filtered)
          setSearchResults([])
        }
      } catch (error) {
        console.error("Search error:", error)
        // Fallback to client-side filtering
        const searchLower = trimmedQuery.toLowerCase()
        const filtered = allProducts.filter((product) =>
          product.name?.toLowerCase().includes(searchLower) ||
          product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower)
        )
        setFilteredProducts(filtered)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    performSearch()
  }, [allProducts, searchQuery, userData?.company_id])

  // Update pagination when filtered products change
  useEffect(() => {
    const totalFilteredItems = filteredProducts.length
    const newTotalPages = Math.max(1, Math.ceil(totalFilteredItems / ITEMS_PER_PAGE))
    setTotalPages(newTotalPages)
    setTotalItems(totalFilteredItems)

    // Reset to page 1 if current page is out of bounds
    if (currentPage > newTotalPages) {
      setCurrentPage(1)
    }
  }, [filteredProducts.length, currentPage])

  // Update displayed products for current page
  useEffect(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    setDisplayedProducts(filteredProducts.slice(startIndex, endIndex))
  }, [filteredProducts, currentPage])

  // Reset card refs when displayed products change
  useEffect(() => {
    cardElementsRef.current = cardElementsRef.current.slice(0, displayedProducts.length)
  }, [displayedProducts.length])

  // Animation logic for grid view only
  const createAnimation = () => {
    const validElements = cardElementsRef.current.filter(el => el !== null)
    if (!validElements.length) return null

    // Set initial state
    gsap.set(validElements, { y: 20, opacity: 0 })

    const tl = gsap.timeline({ paused: true })

    // Animate items in with stagger
    tl.to(validElements, {
      y: 0,
      opacity: 1,
      duration: 0.3,
      ease: "power3.out",
      stagger: 0.05
    })

    return tl
  }

  useLayoutEffect(() => {
    // Only run animation for grid view
    if (viewMode !== "grid") {
      tlRef.current?.kill()
      tlRef.current = null
      return
    }

    // Kill existing animation
    tlRef.current?.kill()

    const tl = createAnimation()
    tlRef.current = tl

    // Play animation if we have items and it's not the initial load
    if (tl && displayedProducts.length > 0 && !loading) {
      // Small delay for smoother experience
      setTimeout(() => {
        tl.play()
      }, 50)
    }

    return () => {
      tl?.kill()
      tlRef.current = null
    }
  }, [displayedProducts, loading, viewMode])

  // Function to set card refs
  const setCardRef = (index: number) => (el: HTMLDivElement | null) => {
    cardElementsRef.current[index] = el
  }

  // Animated list item component using Framer Motion
  const AnimatedListItem = ({ children, delay = 0, index }: { children: React.ReactNode, delay?: number, index: number }) => {
    const ref = useRef(null)
    const inView = useInView(ref, { amount: 0.5, once: false })

    return (
      <motion.div
        ref={ref}
        data-index={index}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.2, delay }}
        style={{ marginBottom: '1rem' }}
      >
        {children}
      </motion.div>
    )
  }


  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      // Scroll to top when changing pages
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const goToPreviousPage = () => goToPage(currentPage - 1)
  const goToNextPage = () => goToPage(currentPage + 1)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // If we have 5 or fewer pages, show all of them
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      // Always include first page
      pageNumbers.push(1)

      // Calculate start and end of page range around current page
      let startPage = Math.max(2, currentPage - 1)
      let endPage = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4)
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3)
      }

      // Add ellipsis if needed before the range
      if (startPage > 2) {
        pageNumbers.push("...")
      }

      // Add the range of pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }

      // Add ellipsis if needed after the range
      if (endPage < totalPages - 1) {
        pageNumbers.push("...")
      }

      // Always include last page
      pageNumbers.push(totalPages)
    }

    return pageNumbers
  }

  // Handle product deletion
  const handleDeleteClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete || !productToDelete.id) return

    try {
      await softDeleteProduct(productToDelete.id)

      // The real-time listener will automatically update the UI
      // No need for manual state updates

      toast({
        title: "Product deleted",
        description: `${productToDelete.name} has been successfully deleted.`,
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

  const handleEditClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()

    // Initialize form with product data
    setEditingProduct(product)
    setSiteType("digital")
    setCategory(product.categories?.[0] || DIGITAL_CATEGORIES[0])
    setSiteName(product.name || "")
    setLocation(product.specs_rental?.location || "")
    setLocationLabel(product.specs_rental?.location_label || "")
    setGeopoint(product.specs_rental?.geopoint || null)
    setHeight(product.specs_rental?.height ? String(product.specs_rental.height) : "")
    setWidth(product.specs_rental?.width ? String(product.specs_rental.width) : "")
    setDimensionUnit("ft")
    setElevation(product.specs_rental?.elevation ? String(product.specs_rental.elevation) : "")
    setElevationUnit("ft")
    setDescription(product.description || "")
    setSelectedAudience(product.specs_rental?.audience_types || [])
    setDailyTraffic(product.specs_rental?.traffic_count ? String(product.specs_rental.traffic_count) : "")
    setPrice(product.price ? formatPriceOnBlur(String(product.price)) : "0")
    setPriceUnit("per spot")
    setUploadedFiles([])
    setCurrentImageIndex(0)

    // Set CMS data if it exists
    if (product.cms) {
      setCms({
        start_time: product.cms.start_time || "06:00",
        end_time: product.cms.end_time || "22:00",
        spot_duration: product.cms.spot_duration ? String(product.cms.spot_duration) : "",
        loops_per_day: "", // Always empty when opening
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

    setPlayerId(product.playerIds?.[0] || "")
    setSpotInputs(product.spotUrls || [])
    setSelectedRetailSpots(product.retail_spot?.spot_number || [])
    setValidationError(null)
    setShowEditSiteDialog(true)
  }

  const handleViewDetails = (productId: string) => {
    router.push(`/business/inventory/${productId}`)
  }

  const handleAddSiteClick = async () => {
    console.log("handleAddSiteClick: Starting subscription check")
    console.log("userData:", { company_id: userData?.company_id, license_key: userData?.license_key })

    // Check if user has company_id first
    if (!userData?.company_id) {
      console.log("No company_id found, showing company registration dialog")
      setShowCompanyDialog(true)
      return
    }

    // Check if company information is complete
    try {
      const isCompanyComplete = await CompanyService.isCompanyInfoComplete(userData.company_id)
      if (!isCompanyComplete) {
        console.log("Company information incomplete, showing company update dialog")
        setShowCompanyUpdateDialog(true)
        return
      }
    } catch (error) {
      console.error("Error checking company completeness:", error)
      setSubscriptionLimitMessage("Error checking company information. Please try again or contact support.")
      setShowSubscriptionLimitDialog(true)
      return
    }

    // Query subscription by company ID
    let currentSubscription = null
    try {
      console.log("Fetching subscription for company_id:", userData.company_id)
      currentSubscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
      console.log("Current subscription:", currentSubscription)
    } catch (error) {
      console.error("Error fetching subscription:", error)
      setSubscriptionLimitMessage("Error fetching subscription data. Please try again or contact support.")
      setShowSubscriptionLimitDialog(true)
      return
    }


    // Check if subscription exists and is active
    if (!currentSubscription) {
      console.log("No subscription found")
      setSubscriptionLimitMessage("No active subscription found. Please choose a plan to start adding sites.")
      setShowSubscriptionLimitDialog(true)
      return
    }

    if (currentSubscription.status !== "active") {
      console.log("Subscription not active, status:", currentSubscription.status)
      setSubscriptionLimitMessage(
        `Your subscription is ${currentSubscription.status}. Please activate your subscription to continue.`,
      )
      setShowSubscriptionLimitDialog(true)
      return
    }

    // Check product limit
    console.log("Checking product limit:", { totalItems, maxProducts: currentSubscription.maxProducts })
    if (totalItems >= currentSubscription.maxProducts) {
      console.log("Product limit reached")
      setSubscriptionLimitMessage(
        `You've reached your plan limit of ${currentSubscription.maxProducts} sites. Upgrade your plan to add more sites.`,
      )
      setShowSubscriptionLimitDialog(true)
      return
    }

    console.log("All checks passed, opening add site dialog")

    // Reset form to defaults
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
    setLocationVisibilityUnit("ft")
    setLocationVisibility("")
    setPlayerId("")
    setSpotInputs([])
    setSelectedRetailSpots([])

    setShowAddSiteDialog(true)
  }

  const handleCompanyRegistrationSuccess = async () => {
    console.log("Company registration successful, refreshing user data")
    await refreshUserData()
    setShowCompanyDialog(false)

    // Wait a bit for userData to update
    setTimeout(async () => {
      // Query subscription by company ID after company registration
      let currentSubscription = null
      try {
        if (userData?.company_id) {
          console.log("Fetching subscription after company registration for company_id:", userData.company_id)
          currentSubscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
          console.log("Subscription after company registration:", currentSubscription)
        }
      } catch (error) {
        console.error("Error fetching subscription after company registration:", error)
      }


      if (!currentSubscription) {
        console.log("No subscription found after company registration")
        setSubscriptionLimitMessage(
          "Company registered successfully! Please choose a subscription plan to start adding sites.",
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (currentSubscription.status !== "active") {
        console.log("Subscription not active after company registration, status:", currentSubscription.status)
        setSubscriptionLimitMessage(
          `Company registered successfully! Your subscription is ${currentSubscription.status}. Please activate it to continue.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (totalItems >= currentSubscription.maxProducts) {
        console.log("Product limit reached after company registration")
        setSubscriptionLimitMessage(
          `Company registered successfully! You've reached your plan limit of ${currentSubscription.maxProducts} sites. Upgrade your plan to add more sites.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Only redirect if all subscription checks pass
      console.log("All checks passed after company registration, redirecting to create product")
      router.push("/admin/products/create")
    }, 1000) // Wait 1 second for userData to refresh
  }

  const handleCompanyUpdateSuccess = async () => {
    console.log("Company update successful")
    setShowCompanyUpdateDialog(false)

    // Wait a bit for any updates to propagate
    setTimeout(async () => {
      // Continue with the subscription checks after company update
      let currentSubscription = null
      try {
        if (userData?.company_id) {
          console.log("Fetching subscription after company update for company_id:", userData.company_id)
          currentSubscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
          console.log("Subscription after company update:", currentSubscription)
        }
      } catch (error) {
        console.error("Error fetching subscription after company update:", error)
        setSubscriptionLimitMessage("Error fetching subscription data. Please try again or contact support.")
        setShowSubscriptionLimitDialog(true)
        return
      }


      // Check if subscription exists and is active
      if (!currentSubscription) {
        console.log("No subscription found after company update")
        setSubscriptionLimitMessage("No active subscription found. Please choose a plan to start adding sites.")
        setShowSubscriptionLimitDialog(true)
        return
      }

      if (currentSubscription.status !== "active") {
        console.log("Subscription not active after company update, status:", currentSubscription.status)
        setSubscriptionLimitMessage(
          `Your subscription is ${currentSubscription.status}. Please activate your subscription to continue.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Check product limit
      console.log("Checking product limit after company update:", { totalItems, maxProducts: currentSubscription.maxProducts })
      if (totalItems >= currentSubscription.maxProducts) {
        console.log("Product limit reached after company update")
        setSubscriptionLimitMessage(
          `You've reached your plan limit of ${currentSubscription.maxProducts} sites. Upgrade your plan to add more sites.`,
        )
        setShowSubscriptionLimitDialog(true)
        return
      }

      // Only open dialog if all checks pass
      console.log("All checks passed after company update, opening add site dialog")
      setShowAddSiteDialog(true)
      setValidationErrors([])

      // Show info about required fields
      setTimeout(() => {
        toast({
          title: "Required Fields",
          description: "Fields marked with * are required: Site Name, Location, and Price.",
        })
      }, 500)
    }, 500) // Wait 0.5 seconds for updates to propagate
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

  const handleAddSubmit = async () => {
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
      const productData: Partial<Product> = {
        name: siteName,
        description,
        price: parseFloat(price.replace(/,/g, '')) || 0,
        content_type: siteType,
        categories: [category],
        company_id: userData.company_id,
        seller_id: user?.uid,
        seller_name: user?.displayName || user?.email || "",
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

      setShowAddSiteDialog(false)

      // Navigate to page 1 (the real-time listener will update the UI automatically)
      setCurrentPage(1)
      fetchTotalCount()

      toast({
        title: "Site added successfully",
        description: `${siteName} has been added to your inventory.`,
      })
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

  const handleEditSubmit = async () => {
    if (!editingProduct || !editingProduct.id || !userData?.company_id || !user?.uid) return

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
        const url = await uploadFileToFirebaseStorage(file, `products/${userData.company_id}`)
        mediaUrls.push({
          url,
          distance: "0",
          type: file.type,
          isVideo: file.type.startsWith('video/')
        })
      }

      // Combine with existing media
      const allMedia = [...(editingProduct.media || []), ...mediaUrls]

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
        pages: siteType === "digital" ? [
          {
            "name": "a-page",
            "widgets": [
              {
                "zIndex": 1,
                "type": "PICTURE",
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
          structure: editingProduct.specs_rental?.structure || {
            color: null,
            condition: null,
            contractor: null,
            last_maintenance: null,
          },
          illumination: editingProduct.specs_rental?.illumination || {
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
        media: allMedia,
        type: "RENTAL",
        updated: serverTimestamp(),
      }

      // Update in Firestore
      await updateProduct(editingProduct.id, updateData)

      setShowEditSiteDialog(false)

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

  // Show loading only on initial load
  if (loading && allProducts.length === 0 && userData === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <RouteProtection requiredRoles="business">
      <InventoryContent
        title="Enrolled Sites"
        allProducts={allProducts}
        filteredProducts={filteredProducts}
        displayedProducts={displayedProducts}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        viewMode={viewMode}
        setViewMode={setViewMode}
        loading={loading}
        loadingCount={loadingCount}
        totalItems={totalItems}
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        goToPage={goToPage}
        goToPreviousPage={goToPreviousPage}
        goToNextPage={goToNextPage}
        getPageNumbers={getPageNumbers}
        handleViewDetails={handleViewDetails}
        handleEditClick={handleEditClick}
        handleDeleteClick={handleDeleteClick}
        handleAddClick={handleAddSiteClick}
        userData={userData}
        cardsRef={cardsRef}
        cardElementsRef={cardElementsRef}
        setCardRef={setCardRef}
        AnimatedListItem={AnimatedListItem}
        emptyStateMessage="No sites found"
        emptyStateDescription="Click the Add Site button below to create your first site."
        addButtonText="Add Site"
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        description="This product will be removed from your inventory. This action cannot be undone."
        itemName={productToDelete?.name}
      />

      {/* Subscription Limit Dialog */}
      <Dialog open={showSubscriptionLimitDialog} onOpenChange={setShowSubscriptionLimitDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>🎯 Let's Get You Started!</DialogTitle>
            <DialogDescription>{subscriptionLimitMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => router.push("/admin/subscriptions/choose-plan")}>Choose Plan</Button>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSiteDialog
        isOpen={showAddSiteDialog}
        onClose={() => setShowAddSiteDialog(false)}
        userData={{ user, userData }}
        refreshData={fetchTotalCount}
      />

      {/* Edit Site Dialog */}
      <Dialog open={showEditSiteDialog} onOpenChange={setShowEditSiteDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[20px] py-0 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b px-6 mb-0 min-h-[4rem] flex items-start pt-6">
            <DialogTitle className="text-2xl font-semibold text-[#333333]">Edit site</DialogTitle>
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
                    id="edit-file-upload"
                  />
                  <label htmlFor="edit-file-upload" className="cursor-pointer">
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
                      <Label htmlFor="edit-start_time" className="text-[#4e4e4e] font-medium mb-3 block">Start Time</Label>
                      <Input
                        id="edit-start_time"
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.start_time}
                        onChange={(e) => setCms(prev => ({ ...prev, start_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-end_time" className="text-[#4e4e4e] font-medium mb-3 block">End Time</Label>
                      <Input
                        id="edit-end_time"
                        type="time"
                        className="border-[#c4c4c4]"
                        value={cms.end_time}
                        onChange={(e) => setCms(prev => ({ ...prev, end_time: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-spot_duration" className="text-[#4e4e4e] font-medium mb-3 block">Spot Duration (seconds)</Label>
                      <Input
                        id="edit-spot_duration"
                        type="number"
                        className="border-[#c4c4c4]"
                        value={cms.spot_duration}
                        onChange={(e) => setCms(prev => ({ ...prev, spot_duration: e.target.value }))}
                        placeholder="Enter duration in seconds"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-loops_per_day" className="text-[#4e4e4e] font-medium mb-3 block">Spots Per Loop</Label>
                      <Input
                        id="edit-loops_per_day"
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
                onClick={() => setShowEditSiteDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="px-8 bg-[#1d0beb] hover:bg-[#1508d1] text-white"
                onClick={handleEditSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </RouteProtection>
  )
}
