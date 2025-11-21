"use client"

import React, { useRef } from "react"
import { useState, useEffect, use } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Calendar, Trash2, Upload, X, Loader2, AlertTriangle, CheckCircle, XCircle, Clock3, Maximize, Check, ImageIcon, MoreVertical } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { doc, getDoc, getDocs, updateDoc, serverTimestamp } from "firebase/firestore"
import { db} from "@/lib/firebase"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { Product } from "@/lib/firebase-service"
import { Skeleton } from "@/components/ui/skeleton"
import { softDeleteProduct } from "@/lib/firebase-service"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import SiteInformation from "@/components/SiteInformation"
import { AddEditSiteDialog } from "@/components/AddEditSiteDialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore"
import { SpotsGrid } from "@/components/spots-grid"
import { SpotSelectionDialog } from "@/components/spot-selection-dialog"
import TransactionsTab from "@/components/TransactionsTab"
import ProgramListTab from "@/components/ProgramListTab"
import ProofOfPlayTab from "@/components/ProofOfPlayTab"
import { OperatorProgramContentDialog } from "@/components/OperatorProgramContentDialog"
import type { Booking } from "@/lib/booking-service"
import { formatBookingDates } from "@/lib/booking-service"
import { useAuth } from "@/contexts/auth-context"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
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



export default function BusinessProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { userData, user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const paramsData = params
  const productId = Array.isArray(paramsData.id) ? paramsData.id[0] : paramsData.id

  // Helper functions for spots data
  const generateSpotsData = (cms: any, activePlaylistPages: any[]) => {
    const totalSpots = cms.loops_per_day || 18
    const spots = []
    for (let i = 1; i <= totalSpots; i++) {
      // Find the active playlist page for this spot
      const page = activePlaylistPages.find(p => p.spot_number === i)
      const isOccupied = !!page

      // Get image URL from playlist page widget with matching spot_number
      let imageUrl: string | undefined
      let endDate: Date | undefined
      if (page && page.widgets) {
        const widget = activePlaylistPages.find((w: any) => w.spot_number === i)
        if (widget) {
          imageUrl = widget.widgets[0].url
          const scheduleEndDate = widget.schedules[0]?.endDate
          endDate = scheduleEndDate?.toDate ? scheduleEndDate.toDate() : new Date(scheduleEndDate)
        }
      }

      spots.push({
        id: `spot-${i}`,
        number: i,
        status: (isOccupied ? "occupied" : "vacant") as "occupied" | "vacant",
        endDate,
        imageUrl,
        booking_id: page?.booking_id,
      })
    }

    return spots
  }

  const calculateOccupiedSpots = (cms: any) => {
    if (currentDayBookingsLoading) {
      return 0
    }

    // Count unique spot numbers from current day's bookings
    const occupiedSpots = new Set()
    currentDayBookings.forEach(booking => {
      if (booking.spot_number) {
        occupiedSpots.add(booking.spot_number)
      } else {
        console.log("🔍 DEBUG: Booking has no spot_number:", booking.id, booking.spot_number)
      }
    })

    const occupiedCount = occupiedSpots.size

    return occupiedCount
  }

  const calculateVacantSpots = (cms: any) => {
    const totalSpots = cms.loops_per_day || 18
    return totalSpots - calculateOccupiedSpots(cms)
  }

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [companyLoading, setCompanyLoading] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const fetchProduct = async () => {
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

  useEffect(() => {
    fetchProduct()
  }, [params])

  const handleCalendarOpen = () => {
    setIsCalendarOpen(true)
  }

  const handleBack = () => {
    router.back()
  }


  const handleEdit = () => {
    setEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    // Refresh product data
    fetchProduct()
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
      <AddEditSiteDialog
        isOpen={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        editingProduct={product}
        userData={userData}
        user={user}
        onSuccess={handleEditSuccess}
      />
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
