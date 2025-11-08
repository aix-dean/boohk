"use client"

import React from "react"

import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  Loader2,
  FileText,
  Grid3X3,
  Edit,
  Download,
  Plus,
  X,
  ImageIcon,
  Upload,
  Check,
  Minus,
  Send,
  CheckCircle2,
} from "lucide-react"
import { getProposalById, updateProposal, downloadProposalPDF, generateProposalPDFBlob, generateAndUploadProposalPDF } from "@/lib/proposal-service"
import {
  getPaginatedUserProducts,
  getUserProductsCount,
  softDeleteProduct,
  type Product,
  type Booking,
  getProposalTemplatesByCompanyId,
  createProposalTemplate,
  uploadFileToFirebaseStorage,
} from "@/lib/firebase-service"
import type { Proposal, ProposalClient, ProposalProduct } from "@/lib/types/proposal"
import type { ProposalTemplate } from "@/lib/firebase-service"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { loadGoogleMaps } from "@/lib/google-maps-loader"
import { generateStaticMapUrl } from "@/lib/static-maps"
import { SendProposalShareDialog } from "@/components/send-proposal-share-dialog"
import { ProposalHistory } from "@/components/proposal-history"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getPaginatedClients, type Client } from "@/lib/client-service"
import { ResponsiveCardGrid } from "@/components/responsive-card-grid"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { BlankPageEditor } from "@/components/blank-page-editor"
import { Vibrant } from 'node-vibrant/browser'
import type { CustomPage } from "@/lib/types/proposal"

const GoogleMap: React.FC<{ location: string; className?: string }> = ({ location, className }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    const initializeMaps = async () => {
      try {
        await loadGoogleMaps()
        await initializeMap()
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        setMapError(true)
      }
    }

    const initializeMap = async () => {
      if (!mapRef.current || !window.google) return

      try {
        const geocoder = new window.google.maps.Geocoder()

        // Geocode the location
        geocoder.geocode({ address: location }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status === "OK" && results && results[0]) {
            const map = new window.google.maps.Map(mapRef.current!, {
              center: results[0].geometry.location,
              zoom: 15,
              disableDefaultUI: true,
              gestureHandling: "none",
              zoomControl: false,
              mapTypeControl: false,
              scaleControl: false,
              streetViewControl: false,
              rotateControl: false,
              fullscreenControl: false,
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }],
                },
              ],
            })

            // Add marker
            new window.google.maps.Marker({
              position: results[0].geometry.location,
              map: map,
              title: location,
              icon: {
                url:
                  "data:image/svg+xml;charset=UTF-8," +
                  encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 32),
              },
            })

            setMapLoaded(true)
          } else {
            console.error("Geocoding failed:", status)
            setMapError(true)
          }
        })
      } catch (error) {
        console.error("Error initializing map:", error)
        setMapError(true)
      }
    }

    initializeMaps()
  }, [location])

  if (mapError) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Map unavailable</p>
          <p className="text-xs mt-1">{location}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}

const formatLocationVisibility = (value: string | undefined): string => {
  if (!value) return ''
  const match = value.match(/^([\d,]+)(\s+.*)?$/)
  if (match) {
    const numStr = match[1].replace(/,/g, '')
    const num = parseInt(numStr)
    if (!isNaN(num)) {
      const unit = match[2] || ''
      return num.toLocaleString() + unit
    }
  }
  return value
}

const formatLocationVisibilityInput = (value: string): string => {
  const match = value.match(/^([\d,]+)(\s+.*)?$/)
  if (match) {
    const numStr = match[1].replace(/,/g, '')
    const num = parseInt(numStr)
    if (!isNaN(num)) {
      const unit = match[2] || ''
      return num.toLocaleString() + unit
    }
  }
  return value
}

const CompanyLogo: React.FC<{ className?: string; proposal?: Proposal | null; onColorExtracted?: (color: string) => void; hasShadow?: boolean; onLogoChange?: (logoUrl: string) => void }> = ({ className, proposal, onColorExtracted, hasShadow = true, onLogoChange }) => {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [companyLogo, setCompanyLogo] = useState<string>("")
  const [companyName, setCompanyName] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    // Use proposal name if available
    if (proposal?.companyName) {
      setCompanyName(proposal.companyName)
    }

    // Check if proposal has its own logo first
    if (proposal?.companyLogo && proposal.companyLogo.trim() !== "") {
      setCompanyLogo(proposal.companyLogo)
      setLoading(false)
      return
    }

    // Otherwise, fetch latest logo from company data
    const fetchCompanyData = async () => {
      if (!userData?.company_id) {
        setLoading(false)
        return
      }

      try {
        const companyDocRef = doc(db, "companies", userData.company_id)
        const companyDocSnap = await getDoc(companyDocRef)

        if (companyDocSnap.exists()) {
          const companyData = companyDocSnap.data()
          if (companyData.logo && companyData.logo.trim() !== "") {
            setCompanyLogo(companyData.logo)
          }
          // Use company name if no proposal name
          if (!proposal?.companyName && companyData.name && companyData.name.trim() !== "") {
            setCompanyName(companyData.name)
          }
        }
      } catch (error) {
        console.error("Error fetching company data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyData()
  }, [userData?.company_id, proposal?.companyName, proposal?.companyLogo])


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload only image files (JPEG, PNG, GIF, WebP)",
        variant: "destructive",
      })
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)
    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    if (!userData?.company_id) return

    setUploading(true)
    try {
      const uploadPath = `companies/logos/${Date.now()}_${file.name}`
      const logoUrl = await uploadFileToFirebaseStorage(file, uploadPath)

      // Just update local state, don't save to database yet
      if (onLogoChange) {
        onLogoChange(logoUrl)
      }
      setSelectedFile(null)

      toast({
        title: "Image Updated",
        description: "Click 'Save' to confirm changes",
      })
    } catch (error) {
      console.error("Error uploading company logo:", error)
      toast({
        title: "Error",
        description: "Failed to upload company logo",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }

  if (companyLogo) {
    return (
      <div
        style={{
          backgroundImage: `url(${companyLogo || "/placeholder.svg"})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: hasShadow ? 'white' : 'transparent',
        }}
        className={`rounded-lg ${hasShadow ? 'shadow-sm' : ''} ${className}`}
        onError={(e) => {
          // If image fails to load, clear it so upload button shows
          setCompanyLogo("")
        }}
      />
    )
  }

  return (
    <div className={`border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors ${className}`}>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        id="company-logo-upload"
        disabled={uploading}
      />
      <label htmlFor="company-logo-upload" className="cursor-pointer">
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">Upload Company Logo</p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
          </div>
        )}
      </label>
    </div>
  )
}

export default function ProposalDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { userData } = useAuth()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [editablePrice, setEditablePrice] = useState<string>("")
  const [individualPrices, setIndividualPrices] = useState<{[key: string]: string}>({})
  const [savingPrice, setSavingPrice] = useState(false)
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    background_url: "",
  })
  const [formLoading, setFormLoading] = useState(false)
  const [templates, setTemplates] = useState<ProposalTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [selectedTemplateBackground, setSelectedTemplateBackground] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("A4")
  const [selectedOrientation, setSelectedOrientation] = useState<string>("Landscape")
  const [selectedLayout, setSelectedLayout] = useState<string>("1")
  const [previewSize, setPreviewSize] = useState<string>("A4")
  const [previewOrientation, setPreviewOrientation] = useState<string>("Portrait")
  const [previewLayout, setPreviewLayout] = useState<string>("1")
  const [previewTemplateBackground, setPreviewTemplateBackground] = useState<string>("")
  const [showBackgroundTemplates, setShowBackgroundTemplates] = useState(false)
  const [currentEditingPage, setCurrentEditingPage] = useState<number | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(0.85)
  const [isSendOptionsDialogOpen, setIsSendOptionsDialogOpen] = useState(false)
  const [printLoading, setPrintLoading] = useState(false)
  const [dominantColor, setDominantColor] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [isAddSiteDialogOpen, setIsAddSiteDialogOpen] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [selectedProductsForAddition, setSelectedProductsForAddition] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [siteToDelete, setSiteToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [editableTitle, setEditableTitle] = useState("Site Proposals")
  const [editableProposalTitle, setEditableProposalTitle] = useState("Site Proposals")
  const [editableProposalMessage, setEditableProposalMessage] = useState("Thank You!")
  const [editableContactInfo, setEditableContactInfo] = useState({
    heading: "contact us:",
    name: "",
    role: "Sales",
    phone: "",
    email: "",
  })
  const [editableCompanyName, setEditableCompanyName] = useState("")
  const [editableClientContact, setEditableClientContact] = useState("")
  const [editableClientCompany, setEditableClientCompany] = useState("")
  const [editablePreparedByName, setEditablePreparedByName] = useState("")
  const [editablePreparedByCompany, setEditablePreparedByCompany] = useState("")
  const [editableProducts, setEditableProducts] = useState<{ [key: string]: any }>({})
  const [originalEditableProducts, setOriginalEditableProducts] = useState<{ [key: string]: any }>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [editableLogo, setEditableLogo] = useState<string>("")
  const [pendingSiteImages, setPendingSiteImages] = useState<{[productId: string]: string}>({})
  const [logoDimensions, setLogoDimensions] = useState({ width: 183, height: 110 })
  const [logoPosition, setLogoPosition] = useState({ left: 114, top: 175 })
  const [originalLogoDimensions, setOriginalLogoDimensions] = useState({ width: 183, height: 110 })
  const [originalLogoPosition, setOriginalLogoPosition] = useState({ left: 114, top: 175 })
  const [isResizingLogo, setIsResizingLogo] = useState(false)
  const [isDraggingLogo, setIsDraggingLogo] = useState(false)
  const [logoStartPos, setLogoStartPos] = useState({ x: 0, y: 0 })
  const [logoStartDimensions, setLogoStartDimensions] = useState({ width: 183, height: 110 })
  const [logoStartPosition, setLogoStartPosition] = useState({ left: 114, top: 175 })
  const [logoResizeDirection, setLogoResizeDirection] = useState<string>('')
  const [selectedProductForMedia, setSelectedProductForMedia] = useState<ProposalProduct | null>(null)
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState(false)
  const [editingCustomPage, setEditingCustomPage] = useState<CustomPage | null>(null)
  const [isBlankPageEditorOpen, setIsBlankPageEditorOpen] = useState(false)
  const [fieldVisibility, setFieldVisibility] = useState<{[productId: string]: {
    location?: boolean
    dimension?: boolean
    type?: boolean
    traffic?: boolean
    location_visibility?: boolean
    srp?: boolean
    additionalMessage?: boolean
  }}>({})

  const fetchClients = async () => {
    if (!userData?.company_id) return

    try {
      // Use the existing getPaginatedClients function
      const result = await getPaginatedClients(
        100, // itemsPerPage - fetch more for dropdown
        null, // lastDoc
        "", // searchTerm - empty for all
        null, // statusFilter
        null, // uploadedByFilter
        userData.company_id, // companyIdFilter
        false // deletedFilter - false to exclude deleted
      )

      // Ensure the current proposal client is included if not in the list
      let allClients = result.items
      if (proposal?.client && !allClients.find(c => c.id === proposal.client.id)) {
        // Convert ProposalClient to Client format
        const currentClient: Client = {
          id: proposal.client.id,
          name: proposal.client.contactPerson || '',
          company: proposal.client.company || '',
          email: proposal.client.email || '',
          phone: proposal.client.phone || '',
          address: proposal.client.address || '',
          industry: proposal.client.industry || '',
          designation: proposal.client.designation || '',
          status: 'active' as const,
          created: new Date(),
          updated: new Date(),
          user_company_id: proposal.client.company_id || userData.company_id,
        }
        allClients = [currentClient, ...allClients]
      }

      setClients(allClients)
    } catch (error) {
      console.error('Error fetching clients:', error)
      // Add dummy clients for testing
      const dummyClients: Client[] = [
        {
          id: '1',
          name: 'John Doe',
          company: 'ABC Company',
          email: 'john@example.com',
          phone: '',
          address: '',
          industry: '',
          designation: '',
          status: 'active' as const,
          created: new Date(),
          updated: new Date(),
          user_company_id: userData.company_id
        },
        {
          id: '2',
          name: 'Jane Smith',
          company: 'XYZ Corp',
          email: 'jane@example.com',
          phone: '',
          address: '',
          industry: '',
          designation: '',
          status: 'active' as const,
          created: new Date(),
          updated: new Date(),
          user_company_id: userData.company_id
        }
      ]
      // Include current client if not in dummy
      if (proposal?.client && !dummyClients.find(c => c.id === proposal.client.id)) {
        const currentClient: Client = {
          id: proposal.client.id,
          name: proposal.client.contactPerson || '',
          company: proposal.client.company || '',
          email: proposal.client.email || '',
          phone: proposal.client.phone || '',
          address: proposal.client.address || '',
          industry: proposal.client.industry || '',
          designation: proposal.client.designation || '',
          status: 'active' as const,
          created: new Date(),
          updated: new Date(),
          user_company_id: userData.company_id
        }
        dummyClients.unshift(currentClient)
      }
      setClients(dummyClients)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [userData?.company_id])

  // Auto-resize textareas when entering edit mode or when content changes
  useLayoutEffect(() => {
    if (isEditMode) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const textareas = document.querySelectorAll('textarea[placeholder="Add specs"], textarea[placeholder="Add data"]') as NodeListOf<HTMLTextAreaElement>
        textareas.forEach((ta) => {
          ta.style.height = 'auto'
          ta.style.height = ta.scrollHeight + 'px'
        })
      }, 0)
    }
  }, [isEditMode, editableProducts])

  useEffect(() => {
    // Reset field visibility to defaults when proposal changes
    setFieldVisibility({})

    async function fetchProposal() {
      if (!params.id) return

      setLoading(true)
      try {
        const proposalData = await getProposalById(params.id as string)
        if (proposalData) {
          setProposal(proposalData)
          setSelectedClientId(proposalData.client?.id || "")
          const currentPageContent = getPageContent(1, proposalData.templateLayout || "1")
          const currentPagePrice = getPagePrice(currentPageContent)
          setEditablePrice(currentPagePrice.toString())

          if (proposalData.templateSize) {
            setSelectedSize(proposalData.templateSize)
            setPreviewSize(proposalData.templateSize)
          }
          if (proposalData.templateOrientation) {
            setSelectedOrientation(proposalData.templateOrientation)
            setPreviewOrientation(proposalData.templateOrientation)
          }
          if (proposalData.templateLayout) {
            setSelectedLayout(proposalData.templateLayout)
            setPreviewLayout(proposalData.templateLayout)
          }
          if (proposalData.templateBackground) {
            setSelectedTemplateBackground(proposalData.templateBackground)
            setPreviewTemplateBackground(proposalData.templateBackground)
          }

          // Set editable states
          setEditableTitle(proposalData.title || "Site Proposals")
          setEditableProposalTitle(proposalData.proposalTitle || "Site Proposals")
          setEditableProposalMessage("Thank You!")
          setEditableContactInfo({
            heading: "contact us:",
            name: `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || userData?.email || 'Sales Rep',
            role: 'Sales',
            phone: userData?.phone_number || '',
            email: userData?.email || '',
          })
          // Initialize field visibility for each product
          const productFieldVisibility: {[productId: string]: any} = {}
          proposalData.products.forEach((product: any) => {
            productFieldVisibility[product.id] = {
              location: proposalData.fieldVisibility?.[product.id]?.location ?? true,
              dimension: proposalData.fieldVisibility?.[product.id]?.dimension ?? true,
              type: proposalData.fieldVisibility?.[product.id]?.type ?? true,
              traffic: proposalData.fieldVisibility?.[product.id]?.traffic ?? true,
              location_visibility: proposalData.fieldVisibility?.[product.id]?.location_visibility ?? true,
              srp: proposalData.fieldVisibility?.[product.id]?.srp ?? true,
              additionalMessage: proposalData.fieldVisibility?.[product.id]?.additionalMessage ?? true,
            }
          })
          setFieldVisibility(productFieldVisibility)
          setEditableCompanyName(proposalData.companyName || "")
          setEditableClientContact(proposalData.client?.contactPerson || "")
          setEditableClientCompany(proposalData.client?.company || "")
          setEditablePreparedByName(proposalData.preparedByName || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim())
          setEditablePreparedByCompany(proposalData.preparedByCompany || proposalData.companyName || "")
          setLogoDimensions({
            width: proposalData.logoWidth || 183,
            height: proposalData.logoHeight || 110
          })
          setLogoPosition({
            left: proposalData.logoLeft || 114,
            top: proposalData.logoTop || 175
          })
          setOriginalLogoDimensions({
            width: proposalData.logoWidth || 183,
            height: proposalData.logoHeight || 110
          })
          setOriginalLogoPosition({
            left: proposalData.logoLeft || 114,
            top: proposalData.logoTop || 175
          })
          const products: { [key: string]: any } = {}
          proposalData.products.forEach(product => {
            products[product.id] = {
              name: product.name,
              location: product.location || 'N/A',
              dimension: `${product.specs_rental?.height ? `${product.specs_rental.height}ft (H)` : ''}${product.specs_rental?.height && product.specs_rental?.width ? ' x ' : ''}${product.specs_rental?.width ? `${product.specs_rental.width}ft (W)` : ''}${!product.specs_rental?.height && !product.specs_rental?.width ? 'N/A' : ''}`,
              type: product.categories && product.categories.length > 0 ? product.categories[0] : 'N/A',
              traffic: product.specs_rental?.traffic_count ? product.specs_rental.traffic_count.toLocaleString() : 'N/A',
              location_visibility: product.specs_rental?.location_visibility ? `${product.specs_rental.location_visibility.toLocaleString()} ${product.specs_rental.location_visibility_unit || 'm'}`.trim() : '0 m',
              srp: product.price ? `₱${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month` : 'N/A',
              additionalMessage: product.additionalMessage || '',
              additionalSpecs: (product as any).additionalSpecs || []
            }
          })
          setEditableProducts(products)

        }
      } catch (error) {
        console.error("Error fetching proposal:", error)
        toast({
          title: "Error",
          description: "Failed to load proposal",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProposal()
  }, [params.id])

  // Handle automatic download/print/share when page loads with action parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const action = searchParams.get("action")

    if (action === "download" && proposal && !loading) {
      // Small delay to ensure the proposal is fully rendered
      setTimeout(() => {
        handleDownload()
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 1000)
    } else if (action === "print" && proposal && !loading) {
      setPrintLoading(true)

      // Scroll to load all maps and generate PDF
      setTimeout(async () => {
        // Scroll to load all maps before generating PDF
        const loadAllMaps = async () => {
          const pageContainers = document.querySelectorAll('[class*="mx-auto bg-white shadow-lg"]')
          for (let i = 0; i < pageContainers.length; i++) {
            const container = pageContainers[i] as HTMLElement
            container.scrollIntoView({ behavior: 'smooth', block: 'center' })
            await new Promise(resolve => setTimeout(resolve, 1500)) // Wait for maps to load
          }
          // Scroll back to top
          window.scrollTo({ top: 0, behavior: 'smooth' })
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        await loadAllMaps()

        try {
          // Generate PDF blob same as download
          const { blob, filename } = await generateProposalPDFBlob(proposal, selectedSize, selectedOrientation)
          // Create URL for the blob
          const pdfUrl = URL.createObjectURL(blob)
          // Open in new window for printing
          const printWindow = window.open(pdfUrl, '_blank')
          if (printWindow) {
            // Wait for PDF to load then print and navigate back
            printWindow.onload = () => {
              printWindow.print()
              // Navigate back immediately after triggering print
              router.push('/sales/proposals')
            }
          }
        } catch (error) {
          console.error("Error generating PDF for print:", error)
          toast({
            title: "Error",
            description: "Failed to generate PDF for printing",
            variant: "destructive",
          })
        } finally {
          setPrintLoading(false)
        }
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 1000) // Initial delay before starting
    } else if (action === "share" && proposal && !loading) {
      // Small delay to ensure the proposal is fully rendered
      setTimeout(() => {
        setIsSendOptionsDialogOpen(true)
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 1000)
    } else if (action === "edit" && proposal && !loading) {
      // Automatically enter edit mode for newly created proposals
      setTimeout(() => {
        setIsEditMode(true)
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 500)
    }
  }, [proposal, loading])

  // Extract color from current logo (editable or proposal)
  useEffect(() => {
    const currentLogo = editableLogo || proposal?.companyLogo || ''
    if (currentLogo) {
      Vibrant.from(currentLogo).getPalette().then(palette => {
        const vibrant = palette.Vibrant
        if (vibrant) {
          setDominantColor(vibrant.hex)
        }
      }).catch(error => {
        console.error('Error extracting color:', error)
        setDominantColor('#f8c102')
      })
    } else {
      setDominantColor('#f8c102') // default color
    }
  }, [editableLogo, proposal?.companyLogo])

  const fetchTemplates = async () => {
    if (!userData?.company_id) {
      toast({
        title: "Error",
        description: "Company information not available",
        variant: "destructive",
      })
      return
    }

    setTemplatesLoading(true)
    try {
      const templatesData = await getProposalTemplatesByCompanyId(userData.company_id)
      setTemplates(templatesData)
    } catch (error) {
      console.error("Error fetching templates:", error)
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive",
      })
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleTemplates = () => {
    setShowTemplatesPanel(true)
    setShowCreateForm(false)
    setShowBackgroundTemplates(false)
    // Initialize preview states with current selected states when opening dialog
    setPreviewSize(selectedSize)
    setPreviewOrientation(selectedOrientation)
    setPreviewLayout(selectedLayout)
    setPreviewTemplateBackground(selectedTemplateBackground)
  }

  const handleShowBackgroundTemplates = () => {
    setShowBackgroundTemplates(true)
    fetchTemplates()
  }

  const handleBackToTemplateOptions = () => {
    setShowBackgroundTemplates(false)
    setShowCreateForm(false)
  }

  const handleApplyTemplate = async () => {
    if (!proposal || !userData) return

    setIsApplying(true)
    try {
      const updateData: any = {
        templateSize: previewSize,
        templateOrientation: previewOrientation,
        templateLayout: previewLayout,
      }

      if (previewTemplateBackground !== "") {
        updateData.templateBackground = previewTemplateBackground
      } else {
        updateData.templateBackground = ""
      }

      console.log("[v0] Applying template with data:", updateData)

      await updateProposal(proposal.id, updateData, userData.uid, userData.displayName || "User")

      setProposal((prev) =>
        prev
          ? {
              ...prev,
              templateSize: previewSize,
              templateOrientation: previewOrientation,
              templateLayout: previewLayout,
              templateBackground: previewTemplateBackground,
            }
          : null,
      )

      setSelectedSize(previewSize)
      setSelectedOrientation(previewOrientation)
      setSelectedLayout(previewLayout)
      setSelectedTemplateBackground(previewTemplateBackground)

      // Update URL with new template settings
      const url = new URL(window.location.href)
      url.searchParams.set('size', previewSize)
      url.searchParams.set('orientation', previewOrientation)
      url.searchParams.set('layout', previewLayout)
      if (previewTemplateBackground) {
        url.searchParams.set('background', previewTemplateBackground)
      } else {
        url.searchParams.delete('background')
      }
      window.history.replaceState({}, '', url.toString())

      setShowTemplatesPanel(false)

      toast({
        title: "Template Applied",
        description: "Template settings have been applied and saved",
      })
    } catch (error) {
      console.error("Error applying template:", error)
      toast({
        title: "Error",
        description: "Failed to apply template settings",
        variant: "destructive",
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleCreateTemplate = () => {
    setShowCreateForm(true)
    setFormData({ name: "", background_url: "" })
    setSelectedFile(null)
    setFilePreview("")
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please upload only image files (JPEG, PNG, GIF, WebP)",
        variant: "destructive",
      })
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setFilePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFilePreview("")
    setFormData((prev) => ({ ...prev, background_url: "" }))
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Template name is required",
        variant: "destructive",
      })
      return
    }

    if (!userData?.company_id) {
      toast({
        title: "Error",
        description: "Company information not available",
        variant: "destructive",
      })
      return
    }

    setFormLoading(true)
    try {
      let backgroundUrl = formData.background_url

      if (selectedFile) {
        setUploading(true)
        try {
          const uploadPath = `templates/backgrounds/${Date.now()}_${selectedFile.name}`
          backgroundUrl = await uploadFileToFirebaseStorage(selectedFile, uploadPath)
          toast({
            title: "Success",
            description: "Background image uploaded successfully",
          })
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError)
          toast({
            title: "Error",
            description: "Failed to upload background image",
            variant: "destructive",
          })
          return
        } finally {
          setUploading(false)
        }
      }

      await createProposalTemplate({
        name: formData.name.trim(),
        background_url: backgroundUrl,
        company_id: userData.company_id,
      })
      toast({
        title: "Success",
        description: "Template created successfully",
      })
      setShowCreateForm(false)
      setFormData({ name: "", background_url: "" })
      setSelectedFile(null)
      setFilePreview("")
      fetchTemplates()
    } catch (error) {
      console.error("Error creating template:", error)
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      })
    } finally {
      setFormLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleBackToList = () => {
    setShowCreateForm(false)
    setFormData({ name: "", background_url: "" })
    setSelectedFile(null)
    setFilePreview("")
  }

  const getPagePrice = (pageContent: any[]) => {
    return pageContent.reduce((total, product) => {
      return total + (product.price || 0)
    }, 0)
  }

  const handleEditPrice = (pageNum: number) => {
    setIsEditingPrice(true)
    const currentPageContent = getPageContent(pageNum, selectedLayout)
    const currentPagePrice = getPagePrice(currentPageContent)
    setEditablePrice(currentPagePrice.toString())
    setCurrentEditingPage(pageNum)

    // Initialize individual prices for multi-product pages
    if (getSitesPerPage(selectedLayout) > 1) {
      const prices: {[key: string]: string} = {}
      currentPageContent.forEach((product) => {
        prices[product.id] = (product.price || 0).toString()
      })
      setIndividualPrices(prices)
    }
  }

  const handleSavePrice = async () => {
    if (!proposal || !userData) {
      toast({
        title: "Error",
        description: "Unable to save price changes",
        variant: "destructive",
      })
      return
    }

    setSavingPrice(true)
    try {
      const currentPageContent = getPageContent(currentEditingPage || 1, selectedLayout)
      if (currentPageContent.length > 0) {
        let updatedProducts = proposal.products

        if (getSitesPerPage(selectedLayout) === 1) {
          // Single product per page - use total price
          const newPrice = Number.parseFloat(editablePrice)
          if (isNaN(newPrice) || newPrice < 0) {
            toast({
              title: "Error",
              description: "Please enter a valid price",
              variant: "destructive",
            })
            return
          }

          updatedProducts = proposal.products.map((product: any) => {
            const productOnCurrentPage = currentPageContent.find((p) => p.id === product.id)
            if (productOnCurrentPage) {
              return { ...product, price: newPrice }
            }
            return product
          })
        } else {
          // Multiple products per page - use individual prices
          const invalidPrices = Object.values(individualPrices).some(price => {
            const numPrice = Number.parseFloat(price)
            return isNaN(numPrice) || numPrice < 0
          })

          if (invalidPrices) {
            toast({
              title: "Error",
              description: "Please enter valid prices for all products",
              variant: "destructive",
            })
            return
          }

          updatedProducts = proposal.products.map((product: any) => {
            const productOnCurrentPage = currentPageContent.find((p) => p.id === product.id)
            if (productOnCurrentPage && individualPrices[product.id] !== undefined) {
              return { ...product, price: Number.parseFloat(individualPrices[product.id]) }
            }
            return product
          })
        }

        await updateProposal(
          proposal.id,
          { products: updatedProducts },
          userData.uid || "current_user",
          userData.displayName || "Current User",
        )

        setProposal((prev) => (prev ? { ...prev, products: updatedProducts } : null))
      }

      setIsEditingPrice(false)
      setCurrentEditingPage(null)
      setIndividualPrices({})

      toast({
        title: "Success",
        description: "Price updated successfully",
      })
    } catch (error) {
      console.error("Error updating price:", error)
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      })
    } finally {
      setSavingPrice(false)
    }
  }

  const handleCancelPriceEdit = () => {
    setIsEditingPrice(false)
    setCurrentEditingPage(null)
    setIndividualPrices({})
    const currentPageContent = getPageContent(currentEditingPage || 1, selectedLayout)
    const currentPagePrice = getPagePrice(currentPageContent)
    setEditablePrice(currentPagePrice.toString())
  }

  const handleSaveEdit = async () => {
    if (!proposal || !userData) return

    setSavingEdit(true)
    try {
      const updatedClient = {
        ...proposal.client,
        contactPerson: editableClientContact,
        company: editableClientCompany
      }
      const updatedProducts = proposal.products.map(product => {
        const editable = editableProducts[product.id]
        if (editable) {
          const updatedProduct = { ...product }
          if (editable.name) updatedProduct.name = editable.name
          if (editable.location) updatedProduct.location = editable.location
          if (editable.srp) {
            const priceStr = editable.srp.replace(/[^\d.]/g, '')
            const price = parseFloat(priceStr)
            if (!isNaN(price)) {
              updatedProduct.price = price
            }
          }
          if (editable.traffic) {
            const trafficStr = editable.traffic.replace(/[^\d]/g, '')
            const traffic = parseInt(trafficStr)
            if (!isNaN(traffic) && updatedProduct.specs_rental) {
              updatedProduct.specs_rental = { ...updatedProduct.specs_rental, traffic_count: traffic }
            }
          }
          if ('location_visibility' in editable) {
            const match = editable.location_visibility.match(/^([\d,]+)\s*(.*)$/)
            if (match) {
              const visibility = parseInt(match[1].replace(/,/g, ''))
              const unit = match[2] || 'm'
              if (!isNaN(visibility)) {
                if (!updatedProduct.specs_rental) {
                  updatedProduct.specs_rental = {}
                }
                updatedProduct.specs_rental.location_visibility = visibility
                updatedProduct.specs_rental.location_visibility_unit = unit
              } else if (updatedProduct.specs_rental && 'location_visibility' in updatedProduct.specs_rental) {
                // Remove the field if it's invalid and existed
                const { location_visibility, location_visibility_unit, ...rest } = updatedProduct.specs_rental
                updatedProduct.specs_rental = rest
              }
            } else if (updatedProduct.specs_rental && 'location_visibility' in updatedProduct.specs_rental) {
              // Remove the field if it's invalid and existed
              const { location_visibility, location_visibility_unit, ...rest } = updatedProduct.specs_rental
              updatedProduct.specs_rental = rest
            }
          }
          if (editable.dimension) {
            // Parse dimension string like "10ft (H) x 20ft (W)"
            const dimensionRegex = /(\d+(?:\.\d+)?)ft\s*\(H\)\s*x\s*(\d+(?:\.\d+)?)ft\s*\(W\)/i
            const match = editable.dimension.match(dimensionRegex)
            if (match) {
              const height = parseFloat(match[1])
              const width = parseFloat(match[2])
              if (!isNaN(height) && !isNaN(width) && updatedProduct.specs_rental) {
                updatedProduct.specs_rental = { ...updatedProduct.specs_rental, height, width }
              }
            }
          }
          if (editable.type) {
            if (!updatedProduct.categories) {
              updatedProduct.categories = []
            }
            updatedProduct.categories[0] = editable.type
          }
          if (editable.additionalSpecs) {
            const filteredSpecs = editable.additionalSpecs.filter((spec: {specs: string, data: string}) => spec.specs.trim() || spec.data.trim())
            ;(updatedProduct as any).additionalSpecs = filteredSpecs
            // Also update editableProducts to remove empty specs
            editable.additionalSpecs = filteredSpecs
          }
          return updatedProduct
        }
        return product
      })

      console.log("Saving edit with data:", {
        title: editableTitle,
        proposalTitle: editableProposalTitle,
        companyName: editableCompanyName,
        logoWidth: logoDimensions.width,
        logoHeight: logoDimensions.height,
        logoLeft: logoPosition.left,
        logoTop: logoPosition.top,
        client: updatedClient,
        products: updatedProducts,
        preparedByName: editablePreparedByName,
        preparedByCompany: editablePreparedByCompany
      })

      const updateData: any = {
        title: editableTitle,
        proposalTitle: editableProposalTitle,
        proposalMessage: editableProposalMessage,
        contactInfo: editableContactInfo,
        fieldVisibility: fieldVisibility,
        companyName: editableCompanyName,
        logoWidth: logoDimensions.width,
        logoHeight: logoDimensions.height,
        logoLeft: logoPosition.left,
        logoTop: logoPosition.top,
        client: updatedClient,
        products: updatedProducts,
        preparedByName: editablePreparedByName,
        preparedByCompany: editablePreparedByCompany
      }

      // Save additional messages for products
      if (Object.keys(editableProducts).length > 0) {
        const productsWithMessages = updatedProducts.map(product => {
          const editable = editableProducts[product.id]
          if (editable?.additionalMessage && editable.additionalMessage.trim() !== '') {
            return {
              ...product,
              additionalMessage: editable.additionalMessage.trim()
            }
          } else {
            // Remove additionalMessage if it's empty or whitespace-only
            const { additionalMessage, ...productWithoutMessage } = product as any
            return productWithoutMessage
          }
        })
        updateData.products = productsWithMessages
      }

      // Save company logo if changed
      if (editableLogo) {
        updateData.companyLogo = editableLogo
      }

      // Save site images if changed
      if (Object.keys(pendingSiteImages).length > 0) {
        const finalProducts = updatedProducts.map(product => {
          const pendingImageUrl = pendingSiteImages[product.id]
          if (pendingImageUrl) {
            return {
              ...product,
              media: [{ url: pendingImageUrl, isVideo: false }]
            }
          }
          return product
        })
        updateData.products = finalProducts
      }
      await updateProposal(
        proposal.id,
        updateData,
        userData.uid,
        userData.displayName || "User"
      )

      console.log("Update successful")

      setProposal(prev => prev ? { ...prev, title: editableTitle, proposalTitle: editableProposalTitle, proposalMessage: editableProposalMessage, contactInfo: editableContactInfo, fieldVisibility: fieldVisibility, companyName: editableCompanyName, logoWidth: logoDimensions.width, logoHeight: logoDimensions.height, logoLeft: logoPosition.left, logoTop: logoPosition.top, client: updatedClient, products: updateData.products || updatedProducts, companyLogo: editableLogo || prev.companyLogo, preparedByName: editablePreparedByName, preparedByCompany: editablePreparedByCompany } : null)

      // Clear pending changes after successful save
      setEditableLogo("")
      setPendingSiteImages({})

      // Reset cursor when exiting edit mode
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setIsEditMode(false)
      toast({
        title: "Success",
        description: "Proposal updated successfully",
      })
    } catch (error) {
      console.error("Error updating proposal:", error)
      toast({
        title: "Error",
        description: "Failed to update proposal",
        variant: "destructive",
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleEdit = () => {
    setIsEditingPrice(true)
    // Don't set currentEditingPage here - let individual pages handle their own editing
  }

  const handleToggleEditMode = () => {
    if (!isEditMode) {
      // Entering edit mode - store original values
      setOriginalLogoDimensions({ ...logoDimensions })
      setOriginalLogoPosition({ ...logoPosition })
      setOriginalEditableProducts(JSON.parse(JSON.stringify(editableProducts))) // Deep copy
    } else {
      // Exiting edit mode - reset cursor
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    setIsEditMode(!isEditMode)
  }

  const handleCancelEdit = () => {
    // Restore logo values
    setLogoDimensions({ ...originalLogoDimensions })
    setLogoPosition({ ...originalLogoPosition })
    // Clear pending changes
    setEditableLogo("")
    setPendingSiteImages({})
    // Reset cursor when exiting edit mode
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setIsEditMode(false)
  }

  const generatePDFIfNeeded = async (proposal: Proposal) => {
    if (proposal.pdf && proposal.pdf.trim() !== "") {
      return { pdfUrl: proposal.pdf, password: proposal.password }
    }

    try {
      const { pdfUrl, password } = await generateAndUploadProposalPDF(
        proposal,
        proposal.templateSize || "A4",
        proposal.templateOrientation || "Landscape"
      )

      // Update proposal with PDF URL and password
      console.log("Updating proposal with PDF URL:", pdfUrl, "and password:", password)
      await updateProposal(
        proposal.id,
        { pdf: pdfUrl, password: password },
        userData?.uid || "system",
        userData?.displayName || "System"
      )

      // Update local state
      setProposal(prev => prev ? { ...prev, pdf: pdfUrl, password: password } : null)

      console.log("PDF generated and uploaded successfully:", pdfUrl)
      console.log("Proposal document updated with PDF URL and password")
      return { pdfUrl, password }
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleDownload = async () => {
    if (!proposal) {
      toast({
        title: "Error",
        description: "No proposal data available",
        variant: "destructive",
      })
      return
    }

    setDownloading(true)
    try {
      // Ensure PDF is generated and saved before downloading
      await generatePDFIfNeeded(proposal)
      await downloadProposalPDF(proposal, selectedSize, selectedOrientation, toast)
    } catch (error) {
      // Error is already handled in generatePDFIfNeeded
    } finally {
      setDownloading(false)
    }
  }

  const handleTemplateSelect = (template: any) => {
    const newBackground = template.background_url || ""
    setPreviewTemplateBackground(newBackground)
    setShowBackgroundTemplates(false) // Navigate back to options
    toast({
      title: "Background Selected for Preview",
      description: `Selected template: ${template.name}`,
    })
  }

  const handleRemoveBackground = () => {
    setPreviewTemplateBackground("")
    setShowBackgroundTemplates(false) // Navigate back to options
    toast({
      title: "Background Removed for Preview",
      description: "Background template has been removed from preview",
    })
  }

  // Helper functions to calculate container styles based on template settings
  const getContainerDimensions = (size: string, orientation: string) => {
    const baseStyles = "bg-white shadow-lg border-transparent relative"

    // Size-based dimensions
    let sizeStyles = ""
    switch (size) {
      case "A4":
        sizeStyles = "w-[210mm] min-h-[297mm]" // A4 dimensions
        break
      case "Letter size":
        sizeStyles = "w-[8.5in] min-h-[11in]" // US Letter dimensions
        break
      case "Legal size":
        sizeStyles = "w-[8.5in] min-h-[14in]" // US Legal dimensions
        break
      default:
        sizeStyles = "w-full max-w-4xl min-h-[600px]"
    }

    let orientationStyles = ""
    switch (orientation) {
      case "Landscape":
        orientationStyles = "max-w-[800px] min-h-[500px]"
        break
      case "Portrait":
        orientationStyles = "max-w-[600px] min-h-[800px]"
        break
      default:
        orientationStyles = ""
    }

    return `${baseStyles} ${sizeStyles} ${orientationStyles}`
  }

  const getSitesPerPage = (layout: string) => Number.parseInt(layout)

  const getTotalPages = (layout: string) => {
    const numberOfSites = proposal?.products?.length || 1
    const sitesPerPage = getSitesPerPage(layout)
    const customPages = proposal?.customPages?.length || 0
    // Always include 1 page for intro + pages for sites + custom pages + 1 page for outro
    return 1 + Math.ceil(numberOfSites / sitesPerPage) + customPages + 1
  }

  const getPageContent = (pageNumber: number, layout: string) => {
    if (!proposal?.products) return []

    // Page 1 is always intro
    if (pageNumber === 1) return []

    const numberOfSitePages = Math.ceil((proposal.products?.length || 0) / getSitesPerPage(layout))
    const sitePageNumber = pageNumber - 1

    // Check if this is a site page
    if (sitePageNumber <= numberOfSitePages) {
      const sitesPerPage = getSitesPerPage(layout)
      const startIndex = (sitePageNumber - 1) * sitesPerPage
      const endIndex = startIndex + sitesPerPage
      return proposal.products.slice(startIndex, endIndex)
    }

    // This is a custom page
    return []
  }

  const getCustomPageForPageNumber = (pageNumber: number) => {
    if (!proposal?.customPages) return null

    const numberOfSitePages = Math.ceil((proposal.products?.length || 0) / getSitesPerPage(selectedLayout))
    const customPageIndex = pageNumber - 2 - numberOfSitePages // -2 because page 1 is intro, page 2+ are site pages

    if (customPageIndex >= 0 && customPageIndex < proposal.customPages.length) {
      return proposal.customPages[customPageIndex]
    }

    return null
  }

  const getLayoutGridClass = (layout: string) => {
    const sitesPerPage = getSitesPerPage(layout)
    switch (sitesPerPage) {
      case 1:
        return "grid-cols-1"
      case 2:
        return "grid-cols-1 lg:grid-cols-2"
      case 4:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
      default:
        return "grid-cols-1"
    }
  }

  const getPageDimensions = (size: string, orientation: string) => {
    const dpi = 96
    const mmToPx = 3.7795

    switch (size) {
      case "A4":
        if (orientation === "Landscape") {
          return { width: Math.round(280 * mmToPx), height: Math.round(180 * mmToPx) }
        } else {
          return { width: Math.round(200 * mmToPx), height: Math.round(240 * mmToPx) }
        }
      case "Letter size":
        if (orientation === "Landscape") {
          return { width: 10 * dpi, height: 7 * dpi }
        } else {
          return { width: 8 * dpi, height: 9 * dpi }
        }
      case "Legal size":
        if (orientation === "Landscape") {
          return { width: 12 * dpi, height: 7 * dpi }
        } else {
          return { width: 8 * dpi, height: 10 * dpi }
        }
      default:
        return { width: 800, height: 600 }
    }
  }

  const getPageTitle = (pageContent: any[]): string => {
    if (!pageContent || pageContent.length === 0) {
      return "N/A"
    }

    const siteCodes = pageContent.map((product) => product.site_code).filter(Boolean)

    if (siteCodes.length === 0) {
      return "N/A"
    }

    if (siteCodes.length === 1) {
      return siteCodes[0]
    }

    if (siteCodes.length === 2) {
      return `${siteCodes[0]} & ${siteCodes[1]}`
    }

    return `${siteCodes[0]} & ${siteCodes.length - 1} more sites`
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.1, 2)) // Max zoom 200%
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.1, 0.3)) // Min zoom 30%
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
  }

  // Added handler functions for Save as Draft and Send
  const handleClientChange = async (clientId: string) => {
    const selectedClient = clients.find(c => c.id === clientId)
    if (!selectedClient || !proposal || !userData) return

    // Convert Client to ProposalClient format
    const proposalClient: ProposalClient = {
      id: selectedClient.id,
      company: selectedClient.company,
      contactPerson: selectedClient.name,
      name: selectedClient.name,
      email: selectedClient.email || '',
      phone: selectedClient.phone || '',
      address: selectedClient.address || '',
      industry: selectedClient.industry || '',
      designation: selectedClient.designation || '',
      targetAudience: '',
      campaignObjective: '',
      company_id: selectedClient.user_company_id || userData.company_id || '',
    }

    try {
      await updateProposal(
        proposal.id,
        { client: proposalClient },
        userData.uid,
        userData.displayName || "User",
      )

      setProposal((prev) => (prev ? { ...prev, client: proposalClient } : null))
      setSelectedClientId(clientId)

      toast({
        title: "Success",
        description: "Client updated successfully",
      })
    } catch (error) {
      console.error("Error updating client:", error)
      toast({
        title: "Error",
        description: "Failed to update client",
        variant: "destructive",
      })
    }
  }

  const handleAddSiteClick = async () => {
    if (!userData?.company_id) return

    setLoadingProducts(true)
    try {
      // Fetch all available products
      const result = await getPaginatedUserProducts(userData.company_id, 100, null, { active: true })

      console.log("Available products:", result.items)
      console.log("Current proposal products:", proposal?.products)

      setAvailableProducts(result.items)
      setSelectedProductsForAddition([])
      setIsAddSiteDialogOpen(true)
    } catch (error) {
      console.error('Error fetching products:', error)
      toast({
        title: "Error",
        description: "Failed to load available products",
        variant: "destructive",
      })
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleProductSelectForAddition = (product: Product) => {
    setSelectedProductsForAddition((prev) => {
      const isSelected = prev.some((p) => p.id === product.id)
      if (isSelected) {
        return prev.filter((p) => p.id !== product.id)
      } else {
        return [...prev, product]
      }
    })
  }

  const handleConfirmAddSites = async () => {
    if (!proposal || !userData || selectedProductsForAddition.length === 0) return

    try {
      // Convert selected products to proposal products format
      const newProposalProducts = selectedProductsForAddition.map(product => {
        const proposalProduct: any = {
          id: product.id || "",
          ID: product.id || "", // Document ID of the selected site
          name: product.name,
          type: product.type || "rental",
          price: product.price || 0,
          location: product.specs_rental?.location || (product as any).light?.location || "N/A",
          media: product.media || [],
          specs_rental: product.specs_rental || null,
          light: (product as any).light || null,
          description: product.description || "",
          health_percentage: 0,
          categories: product.categories || [],
          category_names: product.category_names || [],
        }

        // Only add site_code if it has a value
        const siteCode = product.site_code || product.specs_rental?.site_code || (product as any).light?.siteCode
        if (siteCode) {
          proposalProduct.site_code = siteCode
        }

        return proposalProduct as ProposalProduct
      })

      // Add new products to existing ones
      const updatedProducts = [...(proposal.products || []), ...newProposalProducts]

      await updateProposal(
        proposal.id,
        { products: updatedProducts },
        userData.uid,
        userData.displayName || "User",
      )

      setProposal((prev) => (prev ? { ...prev, products: updatedProducts } : null))

      // Update editableProducts state to include the new products
      const newEditableProducts: { [key: string]: any } = {}
      selectedProductsForAddition.forEach(product => {
        const productId = product.id || `temp-${Date.now()}`
        newEditableProducts[productId] = {
          name: product.name,
          location: product.specs_rental?.location || (product as any).light?.location || 'N/A',
          dimension: `${product.specs_rental?.height ? `${product.specs_rental.height}ft (H)` : ''}${product.specs_rental?.height && product.specs_rental?.width ? ' x ' : ''}${product.specs_rental?.width ? `${product.specs_rental.width}ft (W)` : ''}${!product.specs_rental?.height && !product.specs_rental?.width ? 'N/A' : ''}`,
          type: product.categories && product.categories.length > 0 ? product.categories[0] : 'N/A',
          traffic: product.specs_rental?.traffic_count ? product.specs_rental.traffic_count.toLocaleString() : 'N/A',
          srp: product.price ? `₱${product.price.toLocaleString()}.00 per month` : 'N/A',
          additionalMessage: (product as any).additionalMessage || '',
          additionalSpecs: []
        }
      })
      setEditableProducts(prev => ({ ...prev, ...newEditableProducts }))

      setIsAddSiteDialogOpen(false)
      setSelectedProductsForAddition([])

      toast({
        title: "Success",
        description: `${selectedProductsForAddition.length} site${selectedProductsForAddition.length === 1 ? '' : 's'} added to proposal`,
      })
    } catch (error) {
      console.error("Error adding sites:", error)
      toast({
        title: "Error",
        description: "Failed to add sites to proposal",
        variant: "destructive",
      })
    }
  }

  const handleRemoveSiteClick = (productId: string, productName: string) => {
    setSiteToDelete({ id: productId, name: productName })
    setIsDeleteConfirmationOpen(true)
  }

  const handleConfirmRemoveSite = async () => {
    if (!siteToDelete || !proposal || !userData) return

    try {
      // Find the product to remove by matching document ID
      const productToRemove = proposal.products?.find(p => p.ID === siteToDelete.id || p.id === siteToDelete.id)
      if (!productToRemove) return

      // Remove the product from the proposal
      const updatedProducts = (proposal.products || []).filter(product =>
        !(product.ID === siteToDelete.id || product.id === siteToDelete.id)
      )

      await updateProposal(
        proposal.id,
        { products: updatedProducts },
        userData.uid,
        userData.displayName || "User",
      )

      setProposal((prev) => (prev ? { ...prev, products: updatedProducts } : null))

      // Close the add site dialog if it's open (when removing from within the dialog)
      setIsAddSiteDialogOpen(false)

      toast({
        title: "Site Removed",
        description: `${productToRemove.name} has been removed from the proposal`,
      })
    } catch (error) {
      console.error("Error removing site:", error)
      toast({
        title: "Error",
        description: "Failed to remove site from proposal",
        variant: "destructive",
      })
    } finally {
      setSiteToDelete(null)
    }
  }


  const handleUpdatePublicStatus = async (status: string) => {
    if (!proposal || !userData) return

    try {
      await updateProposal(
        proposal.id,
        { status: status as Proposal["status"] },
        userData.uid,
        userData.displayName || "User",
      )

      setProposal((prev) => (prev ? { ...prev, status: status as Proposal["status"] } : null))

      toast({
        title: "Success",
        description: `Proposal ${status === "draft" ? "saved as draft" : "status updated"}`,
      })
    } catch (error) {
      console.error("Error updating proposal status:", error)
      toast({
        title: "Error",
        description: "Failed to update proposal status",
        variant: "destructive",
      })
    }
  }

  const handleLogoMouseDown = (e: React.MouseEvent, resizeDirection?: string) => {
    if (!isEditMode) return

    // Check if clicking on resize handle
    const rect = e.currentTarget.getBoundingClientRect()
    const isOnResizeHandle = resizeDirection || (
      e.clientX >= rect.right - 20 && e.clientY >= rect.bottom - 20
    )

    if (isOnResizeHandle) {
      // Resize mode
      setIsResizingLogo(true)
      setLogoResizeDirection(resizeDirection || 'se')
      setLogoStartPos({ x: e.clientX, y: e.clientY })
      setLogoStartDimensions({ ...logoDimensions })
      setLogoStartPosition({ ...logoPosition })

      // Set cursor based on resize direction
      const cursorMap: { [key: string]: string } = {
        'nw': 'nw-resize',
        'ne': 'ne-resize',
        'sw': 'sw-resize',
        'se': 'se-resize',
        'n': 'n-resize',
        's': 's-resize',
        'w': 'w-resize',
        'e': 'e-resize'
      }
      document.body.style.cursor = cursorMap[resizeDirection || 'se'] || 'nw-resize'
    } else {
      // Drag mode
      setIsDraggingLogo(true)
      setLogoStartPos({ x: e.clientX, y: e.clientY })
      setLogoStartPosition({ ...logoPosition })
      document.body.style.cursor = 'move'
    }
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  const handleLogoMouseMove = (e: MouseEvent) => {
    if (isResizingLogo) {
      const deltaX = e.clientX - logoStartPos.x
      const deltaY = e.clientY - logoStartPos.y

      let newWidth = logoStartDimensions.width
      let newHeight = logoStartDimensions.height
      let newLeft = logoStartPosition.left
      let newTop = logoStartPosition.top

      switch (logoResizeDirection) {
        case 'nw': // Top-left
          newWidth = Math.max(50, logoStartDimensions.width - deltaX)
          newHeight = Math.max(30, logoStartDimensions.height - deltaY)
          newLeft = logoStartPosition.left + (logoStartDimensions.width - newWidth)
          newTop = logoStartPosition.top + (logoStartDimensions.height - newHeight)
          break
        case 'ne': // Top-right
          newWidth = Math.max(50, logoStartDimensions.width + deltaX)
          newHeight = Math.max(30, logoStartDimensions.height - deltaY)
          newTop = logoStartPosition.top + (logoStartDimensions.height - newHeight)
          break
        case 'sw': // Bottom-left
          newWidth = Math.max(50, logoStartDimensions.width - deltaX)
          newHeight = Math.max(30, logoStartDimensions.height + deltaY)
          newLeft = logoStartPosition.left + (logoStartDimensions.width - newWidth)
          break
        case 'se': // Bottom-right
          newWidth = Math.max(50, logoStartDimensions.width + deltaX)
          newHeight = Math.max(30, logoStartDimensions.height + deltaY)
          break
        case 'n': // Top edge
          newHeight = Math.max(30, logoStartDimensions.height - deltaY)
          newTop = logoStartPosition.top + (logoStartDimensions.height - newHeight)
          break
        case 's': // Bottom edge
          newHeight = Math.max(30, logoStartDimensions.height + deltaY)
          break
        case 'w': // Left edge
          newWidth = Math.max(50, logoStartDimensions.width - deltaX)
          newLeft = logoStartPosition.left + (logoStartDimensions.width - newWidth)
          break
        case 'e': // Right edge
          newWidth = Math.max(50, logoStartDimensions.width + deltaX)
          break
      }

      setLogoDimensions({ width: newWidth, height: newHeight })
      setLogoPosition({ left: newLeft, top: newTop })
    } else if (isDraggingLogo) {
      const deltaX = e.clientX - logoStartPos.x
      const deltaY = e.clientY - logoStartPos.y

      const newLeft = logoStartPosition.left + deltaX
      const newTop = logoStartPosition.top + deltaY

      // Allow free movement anywhere on the page
      setLogoPosition({ left: newLeft, top: newTop })
    }
  }

  const handleLogoMouseUp = () => {
    setIsResizingLogo(false)
    setIsDraggingLogo(false)
    setLogoResizeDirection('')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const handleAddBlankPage = (position: number) => {
    const newPage: CustomPage = {
      id: `blank-${Date.now()}`,
      type: 'blank',
      elements: [],
      position
    }

    // Save the blank page immediately
    handleSaveBlankPage(newPage)
  }

  const handleEditBlankPage = (page: CustomPage) => {
    setEditingCustomPage(page)
    setIsBlankPageEditorOpen(true)
  }

  const handleSaveBlankPage = async (page: CustomPage) => {
    if (!proposal || !userData) return

    try {
      const existingPages = proposal.customPages || []
      const updatedPages = editingCustomPage?.id
        ? existingPages.map(p => p.id === page.id ? page : p)
        : [...existingPages, page]

      await updateProposal(
        proposal.id,
        { customPages: updatedPages },
        userData.uid,
        userData.displayName || "User"
      )

      setProposal(prev => prev ? { ...prev, customPages: updatedPages } : null)
      setIsBlankPageEditorOpen(false)
      setEditingCustomPage(null)

      toast({
        title: "Success",
        description: "Blank page saved successfully"
      })
    } catch (error) {
      console.error("Error saving blank page:", error)
      toast({
        title: "Error",
        description: "Failed to save blank page",
        variant: "destructive"
      })
    }
  }

  const handleDeleteBlankPage = async (pageId: string) => {
    if (!proposal || !userData) return

    try {
      const updatedPages = (proposal.customPages || []).filter(p => p.id !== pageId)

      await updateProposal(
        proposal.id,
        { customPages: updatedPages },
        userData.uid,
        userData.displayName || "User"
      )

      setProposal(prev => prev ? { ...prev, customPages: updatedPages } : null)

      toast({
        title: "Success",
        description: "Blank page deleted successfully"
      })
    } catch (error) {
      console.error("Error deleting blank page:", error)
      toast({
        title: "Error",
        description: "Failed to delete blank page",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (isResizingLogo || isDraggingLogo) {
      document.addEventListener('mousemove', handleLogoMouseMove)
      document.addEventListener('mouseup', handleLogoMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleLogoMouseMove)
        document.removeEventListener('mouseup', handleLogoMouseUp)
      }
    }
  }, [isResizingLogo, isDraggingLogo, logoStartPos, logoStartDimensions, logoStartPosition])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading proposal...</p>
        </div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Proposal Not Found</h1>
          <p className="text-gray-600 mb-6">The proposal you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => router.push("/sales/proposals")} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Proposals
          </Button>
        </div>
      </div>
    )
  }

  const getPageContainerClass = (size: string, orientation: string) => {
    const baseStyles = "mx-auto bg-white shadow-lg print:shadow-none print:mx-0 print:my-0 relative overflow-hidden"

    // Size-based dimensions with orientation support and responsiveness - adjusted sizes
    let sizeStyles = ""
    switch (size) {
      case "A4":
        if (orientation === "Landscape") {
          sizeStyles = "w-full md:w-[280mm] min-h-[350px] md:min-h-[180mm]" // A4 Landscape - adjusted
        } else {
          sizeStyles = "w-full md:w-[200mm] min-h-[500px] md:min-h-[240mm]" // A4 Portrait - adjusted
        }
        break
      case "Letter size":
        if (orientation === "Landscape") {
          sizeStyles = "w-full md:w-[10in] min-h-[350px] md:min-h-[7in]" // Letter Landscape - adjusted
        } else {
          sizeStyles = "w-full md:w-[8in] min-h-[500px] md:min-h-[9in]" // Letter Portrait - adjusted
        }
        break
      case "Legal size":
        if (orientation === "Landscape") {
          sizeStyles = "w-full md:w-[12in] min-h-[350px] md:min-h-[7in]" // Legal Landscape - adjusted
        } else {
          sizeStyles = "w-full md:w-[8in] min-h-[500px] md:min-h-[10in]" // Legal Portrait - adjusted
        }
        break
      default:
        sizeStyles = "w-full max-w-4xl min-h-[500px]" // Adjusted max-width and height
    }


    return `${baseStyles} ${sizeStyles}`
  }

  const renderIntroPage = (pageNumber: number) => {
    const totalPages = getTotalPages(selectedLayout)
    const formattedDate = proposal?.createdAt ? new Date(proposal.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'N/A'

    return (
      <div className="relative w-full h-full bg-white">
        {/* Header */}
        <div className="absolute top-0 left-0 w-[700px] h-[70px] rounded-tr-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor || undefined }} />
        {/* Header Right */}
        <div className="absolute top-0 left-0 w-[1310px] h-[70px] rounded-tl-[44px] rounded-tr-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : undefined }} />
        {/* Background borders and accents - scaled */}
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-0 w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="bg-white h-[857px] w-[675px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-[473px] top-[2px] w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="h-[393px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-[594px] w-[0px]">
          <div className="flex-none rotate-[90deg]">
            <div className="h-[393px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-[2px] w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="h-[651px] rounded-bl-[44px] rounded-br-[44px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-[208px] top-[594px] w-[0px]">
          <div className="flex-none rotate-[90deg]">
            <div className="h-[651px] rounded-bl-[44px] rounded-br-[44px] w-[69px]" />
          </div>
        </div>

        {/* Company Logo */}
        <div
          className={`absolute border-2 transition-colors ${isEditMode ? 'border-[#c4c4c4] border-dashed' : 'border-transparent'}`}
          style={{
            left: logoPosition.left * 0.875,
            top: logoPosition.top * 0.857,
            width: logoDimensions.width * 0.875,
            height: logoDimensions.height * 0.857
          }}
          onMouseDown={handleLogoMouseDown}
        >
          <div className="relative h-full w-full">
            {editableLogo ? (
              <img src={editableLogo} alt="Proposal logo" className="h-full w-full object-contain" />
            ) : (
              <CompanyLogo className="h-full w-full" proposal={proposal} onColorExtracted={setDominantColor} hasShadow={false} onLogoChange={setEditableLogo} />
            )}
            {isEditMode && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const uploadFile = async () => {
                        try {
                          const uploadPath = `proposals/logos/${Date.now()}_${file.name}`
                          const logoUrl = await uploadFileToFirebaseStorage(file, uploadPath)
                          setEditableLogo(logoUrl)
                        } catch (error) {
                          console.error("Error uploading logo:", error)
                          toast({
                            title: "Error",
                            description: "Failed to upload logo",
                            variant: "destructive",
                          })
                        }
                      }
                      uploadFile()
                    }
                  }}
                  className="hidden"
                  id="proposal-logo"
                />
                <label htmlFor="proposal-logo" className="absolute top-1 right-1 w-6 h-6 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                  <Upload className="h-3 w-3 text-white" />
                </label>
                {/* Resize Handles - Small dots */}
                {/* Top-left corner */}
                <div
                  className="absolute top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-blue-500 cursor-nw-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'nw')}
                  title="Drag to resize logo"
                />
                {/* Top-right corner */}
                <div
                  className="absolute top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-blue-500 cursor-ne-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'ne')}
                  title="Drag to resize logo"
                />
                {/* Bottom-left corner */}
                <div
                  className="absolute bottom-0 left-0 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-blue-500 cursor-sw-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'sw')}
                  title="Drag to resize logo"
                />
                {/* Bottom-right corner */}
                <div
                  className="absolute bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2 bg-blue-500 cursor-se-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'se')}
                  title="Drag to resize logo"
                />
                {/* Middle edges */}
                {/* Top edge */}
                <div
                  className="absolute top-0 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-blue-500 cursor-n-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'n')}
                  title="Drag to resize logo"
                />
                {/* Bottom edge */}
                <div
                  className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-blue-500 cursor-s-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 's')}
                  title="Drag to resize logo"
                />
                {/* Left edge */}
                <div
                  className="absolute left-0 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-blue-500 cursor-w-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'w')}
                  title="Drag to resize logo"
                />
                {/* Right edge */}
                <div
                  className="absolute right-0 top-1/2 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-blue-500 cursor-e-resize rounded-full opacity-70 hover:opacity-100 transition-opacity"
                  onMouseDown={(e) => handleLogoMouseDown(e, 'e')}
                  title="Drag to resize logo"
                />
              </>
            )}
          </div>
        </div>

        {/* Title */}
        {isEditMode ? (
          <input
            value={editableProposalTitle}
            onChange={(e) => setEditableProposalTitle(e.target.value)}
            className="absolute font-bold text-[#333333] text-[70px] leading-none left-[100px] top-[284px] min-w-[262px] max-w-[700px] w-auto border-2 border-[#c4c4c4] border-dashed rounded px-2 outline-none whitespace-nowrap"
            style={{ width: `${Math.max(262, (editableProposalTitle.length * 39) + 35)}px` }}
          />
        ) : (
          <p className="absolute font-bold text-[#333333] text-[70px] leading-none left-[100px] top-[284px] whitespace-nowrap">
            {proposal?.proposalTitle || 'Site Proposals'}
          </p>
        )}

        {/* Subtitle */}
        {isEditMode ? (
          <input
            value={editableCompanyName}
            onChange={(e) => setEditableCompanyName(e.target.value)}
            className="absolute font-semibold text-[#333333] text-[18px] leading-none left-[100px] top-[243px] w-[291px] border-2 border-[#c4c4c4] border-dashed rounded px-2 outline-none"
          />
        ) : (
          <p className="absolute font-semibold text-[#333333] text-[18px] leading-none left-[100px] top-[243px] w-[291px]">
            {proposal?.companyName || 'Company Name'}
          </p>
        )}

        {/* Date */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[89px] right-[28px] w-[191px]">
          {formattedDate}
        </p>

        {/* Page Number */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[558px] right-[28px] w-[51px]">
          {pageNumber}/{totalPages}
        </p>

        {/* Prepared For */}
        {isEditMode ? (
          <div className="absolute text-[#333333] text-[18px] left-[100px] top-[386px] w-[645px] leading-[1.2]">
            <p className="font-bold mb-0">Prepared for:</p>
            <input
              value={editableClientContact}
              onChange={(e) => setEditableClientContact(e.target.value)}
              className="border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none"
            /> - <input
              value={editableClientCompany}
              onChange={(e) => setEditableClientCompany(e.target.value)}
              className="border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none"
            />
          </div>
        ) : (
          <div className="absolute text-[#333333] text-[18px] left-[100px] top-[386px] w-[645px] leading-[1.2]">
            <p className="font-bold mb-0">Prepared for:</p>
            <p>{proposal?.client?.contactPerson} - {proposal?.client?.company}</p>
          </div>
        )}

        {/* Prepared By */}
        {isEditMode ? (
          <div className="absolute font-bold text-[#333333] text-[18px] left-[100px] top-[434px] w-[688px] leading-[1.2]">
            <p className="mb-0">Prepared By:</p>
            <input
              value={editablePreparedByName}
              onChange={(e) => setEditablePreparedByName(e.target.value)}
              className="font-normal border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none"
            /> - <input
              value={editablePreparedByCompany}
              onChange={(e) => setEditablePreparedByCompany(e.target.value)}
              className="font-normal border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none"
            />
          </div>
        ) : (
          <div className="absolute font-bold text-[#333333] text-[18px] left-[100px] top-[434px] w-[688px] leading-[1.2]">
            <p className="mb-0">Prepared By:</p>
            <p className="font-normal">{proposal?.preparedByName || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim()} - {proposal?.preparedByCompany || proposal?.companyName}</p>
          </div>
        )}

        {/* Bottom Logo */}
        <div className="absolute h-[40px] left-[28px] top-[626px] w-[67px] z-20">
          {editableLogo ? (
            <div
              style={{
                backgroundImage: `url(${editableLogo})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <CompanyLogo className="h-full w-full" proposal={proposal} onColorExtracted={setDominantColor} />
          )}
        </div>
        {/* Footer */}
        <div className="absolute top-[612px] right-0 w-[700px] h-[70px] rounded-tl-[44px] rounded-bl-[44px] z-10" style={{ backgroundColor: dominantColor || undefined }} />
        {/* Footer Right */}
        <div className="absolute top-[612px] right-0 w-[1320px] h-[70px] rounded-tl-[44px] rounded-tl-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : undefined }} />
      </div>
    )
  }

  const renderSitePage = (pageNumber: number) => {
    const totalPages = getTotalPages(selectedLayout)
    const pageContent = getPageContent(pageNumber, selectedLayout)
    const customPage = getCustomPageForPageNumber(pageNumber)

    // Check if this is a custom blank page
    if (customPage) {
      return renderBlankPage(customPage, pageNumber, totalPages)
    }

    // For now, we'll take the first product on this page (assuming 1 site per page for this layout)
    const product = pageContent[0]

    if (!product) {
      return (
        <div className="relative w-full h-full bg-white">
          <p className="text-center text-gray-500 mt-20">No site data available</p>
        </div>
      )
    }

    return (
      <div className="relative w-full h-full bg-white">

        {/* Background borders and accents - scaled */}
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-0 w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="bg-white h-[857px] w-[675px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-[473px] top-[2px] w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="h-[393px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-[594px] w-[0px]">
          <div className="flex-none rotate-[90deg]">
            <div className="h-[393px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-[2px] w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="h-[651px] rounded-bl-[44px] rounded-br-[44px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-[208px] top-[594px] w-[0px]">
          <div className="flex-none rotate-[90deg]">
            <div className="h-[651px] rounded-bl-[44px] rounded-br-[44px] w-[69px]" />
          </div>
        </div>

        {/* Date - scaled */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[89px] right-[28px] w-[191px]">
          {proposal?.createdAt ? new Date(proposal.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : 'N/A'}
        </p>

        {/* Page Number */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[558px] right-[28px] w-[51px]">
          {pageNumber}/{totalPages}
        </p>

        {/* Main Image - Top Left - scaled */}
        <div className="absolute left-0 top-[70px] w-[324px] h-[324px] overflow-hidden">
          {(() => {
            const pendingImageUrl = pendingSiteImages[product.id]
            const currentImageUrl = pendingImageUrl || (product.media && product.media.length > 0 ? product.media[0].url : null)

            if (currentImageUrl) {
              return product.media && product.media.length > 0 && product.media[0].isVideo && !pendingImageUrl ? (
                <video
                  src={currentImageUrl}
                  className="w-full h-full"
                  controls
                />
              ) : (
                <img
                  src={currentImageUrl}
                  alt={product.name}
                  className="w-full h-full"
                />
              )
            } else {
              return (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">No image available</span>
                </div>
              )
            }
          })()}
          {isEditMode && (
            <div
              className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-all rounded-lg group"
              onClick={() => {
                setSelectedProductForMedia(product)
                setIsMediaDialogOpen(true)
              }}
            >
              <div className="opacity-0 group-hover:opacity-100 text-white text-center transition-opacity">
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Change Image</p>
              </div>
            </div>
          )}
        </div>

        {/* Static Map - Bottom Left - scaled */}
        <div className="absolute left-0 top-[386px] w-[324px] h-[226px] overflow-hidden">
          {(() => {
            const mapUrl = generateStaticMapUrl(product.location)
            return mapUrl ? (
              <img
                src={mapUrl}
                alt={`Map of ${product.location}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full bg-gray-200 flex items-center justify-center"><span class="text-gray-500">Map unavailable</span></div>'
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">No location available</span>
              </div>
            )
          })()}
        </div>

        {/* Site Details - Right Side - scaled */}
        <div
          className="absolute font-bold text-[#333333] text-[18px] left-[358px] w-[600px] leading-[1.2]"
          style={{
            top: ((editableProducts[product.id]?.additionalSpecs?.length || 0) > 0 ||
                  (isEditMode || (fieldVisibility[product.id]?.additionalMessage !== false && (product.additionalMessage || '').trim() !== ''))) ? '120px' : '191px'
          }}
        >
          {/* Site Name */}
          <div className="mb-2 text-[35px] ml-2">
            {isEditMode ? (
              <input
                value={editableProducts[product.id]?.name || product.name}
                onChange={(e) => setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], name: e.target.value } }))}
                className="mb-0 border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
              />
            ) : (
              <p className="mb-0">{product.name}</p>
            )}
          </div>

          <div className="ml-2">
            {/* Location Row */}
            {isEditMode || fieldVisibility[product.id]?.location !== false ? (
              <div className="flex mb-2">
                <div className="w-[200px] pr-4 text-left">
                  <p className="font-bold text-[18px]">Location:</p>
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  {isEditMode ? (
                    <textarea
                      value={editableProducts[product.id]?.location || product.location || 'N/A'}
                      onChange={(e) => {
                        const value = e.target.value
                        const lineBreaks = (value.match(/\n/g) || []).length
                        if (lineBreaks <= 1) {
                          setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], location: value } }))
                        }
                      }}
                      className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full resize-none"
                      rows={2}
                      placeholder="Location"
                    />
                  ) : (
                    <p className="font-normal text-[18px] break-words">{product.location || 'N/A'}</p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Dimension Row */}
            {isEditMode || fieldVisibility[product.id]?.dimension !== false ? (
              <div className="flex mb-2">
                <div className="w-[200px] pr-4 text-left">
                  <p className="font-bold text-[18px]">Dimension:</p>
                </div>
                <div className="flex-1">
                  {isEditMode ? (
                    <input
                      value={editableProducts[product.id]?.dimension || ''}
                      onChange={(e) => setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], dimension: e.target.value } }))}
                      className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                    />
                  ) : (
                    <p className="font-normal text-[18px] break-words">
                      {product.specs_rental?.height ? `${product.specs_rental.height}ft (H)` : ''}
                      {product.specs_rental?.height && product.specs_rental?.width ? ' x ' : ''}
                      {product.specs_rental?.width ? `${product.specs_rental.width}ft (W)` : ''}
                      {!product.specs_rental?.height && !product.specs_rental?.width ? 'N/A' : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Type Row */}
            {isEditMode || fieldVisibility[product.id]?.type !== false ? (
              <div className="flex mb-2">
                <div className="w-[200px] pr-4 text-left">
                  <p className="font-bold text-[18px]">Type:</p>
                </div>
                <div className="flex-1">
                  {isEditMode ? (
                    <input
                      value={editableProducts[product.id]?.type || ''}
                      onChange={(e) => setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], type: e.target.value } }))}
                      className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                    />
                  ) : (
                    <p className="font-normal text-[18px] break-words">{product.categories && product.categories.length > 0 ? product.categories[0] : 'N/A'}</p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Average Monthly Traffic Count Row */}
            {isEditMode || fieldVisibility[product.id]?.traffic !== false ? (
              <div className="flex mb-2">
                <div className="w-[200px] pr-4 text-left">
                  <p className="font-bold text-[18px]">Average Monthly Traffic Count:</p>
                </div>
                <div className="flex-1">
                  {isEditMode ? (
                    <input
                      value={editableProducts[product.id]?.traffic || ''}
                      onChange={(e) => setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], traffic: e.target.value } }))}
                      className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                    />
                  ) : (
                    <p className="font-normal text-[18px] break-words">
                      {product.specs_rental?.traffic_count ? product.specs_rental.traffic_count.toLocaleString() : 'N/A'}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Location Visibility Row */}
            {isEditMode || (product.specs_rental?.location_visibility && fieldVisibility[product.id]?.location_visibility !== false) ? (
              <div className="flex mb-2">
                <div className="w-[200px] pr-4 text-left">
                  <p className="font-bold text-[18px]">Location Visibility:</p>
                </div>
                <div className="flex-1">
                  {isEditMode ? (
                    <input
                      value={editableProducts[product.id]?.location_visibility || ''}
                      onChange={(e) => {
                        const formatted = formatLocationVisibilityInput(e.target.value)
                        setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], location_visibility: formatted } }))
                      }}
                      className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                    />
                  ) : (
                    <p className="font-normal text-[18px] break-words">
                      {product.specs_rental?.location_visibility ? `${product.specs_rental.location_visibility.toLocaleString()} ${product.specs_rental.location_visibility_unit || 'm'}` : 'N/A'}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* SRP Row */}
            <div className="flex mb-2">
              <div className="w-[200px] pr-4 text-left">
                <p className="font-bold text-[18px]">SRP:</p>
              </div>
              <div className="flex-1">
                {isEditMode ? (
                  <input
                    value={editableProducts[product.id]?.srp || ''}
                    onChange={(e) => setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], srp: e.target.value } }))}
                    className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                  />
                ) : (
                  <p className="font-normal text-[18px] break-words">
                    {product.price ? `₱${product.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month` : 'N/A'}
                  </p>
                )}
              </div>
            </div>

            {/* Additional Specs Rows */}
            {(editableProducts[product.id]?.additionalSpecs || []).map((spec: {specs: string, data: string}, index: number) => (
              <div key={index} className="flex mb-2">
                <div className="w-[200px] pr-4 text-left" style={{ minWidth: 0 }}>
                  {isEditMode ? (
                    <textarea
                      value={spec.specs}
                      onChange={(e) => {
                        const newSpecs = [...(editableProducts[product.id]?.additionalSpecs || [])]
                        newSpecs[index].specs = e.target.value
                        setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], additionalSpecs: newSpecs } }))
                        e.target.style.height = 'auto'
                        e.target.style.height = e.target.scrollHeight + 'px'
                      }}
                      className="font-bold text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full resize-none overflow-hidden"
                      placeholder="Add specs"
                      rows={1}
                      style={{ minHeight: '40px' }}
                    />
                  ) : (
                    <div
                      className="font-bold text-[18px] border-none outline-none w-full bg-transparent"
                      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', overflow: 'visible' }}
                    >
                      {spec.specs || ''}
                    </div>
                  )}
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  {isEditMode ? (
                    <textarea
                      value={spec.data}
                      onChange={(e) => {
                        const newSpecs = [...(editableProducts[product.id]?.additionalSpecs || [])]
                        newSpecs[index].data = e.target.value
                        setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], additionalSpecs: newSpecs } }))
                        e.target.style.height = 'auto'
                        e.target.style.height = e.target.scrollHeight + 'px'
                      }}
                      className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full resize-none overflow-hidden"
                      placeholder="Add data"
                      rows={1}
                      style={{ minHeight: '40px' }}
                    />
                  ) : (
                    <div
                      className="font-normal text-[18px] border-none outline-none w-full bg-transparent"
                      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', overflow: 'visible' }}
                    >
                      {spec.data || ''}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add Specs Button */}
            {isEditMode && (
              <div className="flex mb-2 justify-end">
                <div className="flex-1">
                  <Button
                    onClick={() => {
                      const current = editableProducts[product.id]?.additionalSpecs || []
                      if (current.length < 3) {
                        setEditableProducts(prev => ({
                          ...prev,
                          [product.id]: {
                            ...prev[product.id],
                            additionalSpecs: [...current, { specs: '', data: '' }]
                          }
                        }))
                      }
                    }}
                    
                    className="self-start"
                    style={{ transform: 'translateX(475px)' }}
                    variant="outline"
                  >
                    + Add Specs
                  </Button>
                </div>
              </div>
            )}

            </div>

           {/* Additional Message - Outside the column layout */}
           {isEditMode || (fieldVisibility[product.id]?.additionalMessage !== false && (product.additionalMessage || '').trim() !== '') ? (
             <div className="mt-4 ml-2">
               <div className="flex items-center gap-2">
                 <div className="flex-1" style={{ minWidth: 0 }}>
                   {isEditMode ? (
                     <textarea
                       value={editableProducts[product.id]?.additionalMessage || ''}
                       onChange={(e) => {
                         const value = e.target.value
                         const lineBreaks = (value.match(/\n/g) || []).length
                         if (lineBreaks <= 1) {
                           setEditableProducts(prev => ({ ...prev, [product.id]: { ...prev[product.id], additionalMessage: value } }))
                         }
                       }}
                       className="font-normal text-[18px] border-2 border-[#c4c4c4] border-dashed rounded px-2 py-1 outline-none w-full resize-none"
                       placeholder="Additional message..."
                       rows={2}
                       maxLength={130}
                       style={{ width: '105%', whiteSpace: 'pre-wrap' }}
                     />
                   ) : (
                     <div
                       className="font-normal text-[18px] border-none outline-none w-full bg-transparent"
                       style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', overflow: 'visible' }}
                     >
                       {product.additionalMessage || ''}
                     </div>
                   )}
                 </div>
                 {isEditMode && (
                   <button
                     onClick={() => setFieldVisibility(prev => ({
                       ...prev,
                       [product.id]: {
                         ...prev[product.id],
                         additionalMessage: !prev[product.id]?.additionalMessage
                       }
                     }))}
                     className={`transition-colors ${fieldVisibility[product.id]?.additionalMessage !== false ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                     style={{ transform: 'translateX(24px)' }}
                     title={fieldVisibility[product.id]?.additionalMessage !== false ? "Hide Additional Message field" : "Show Additional Message field"}
                   >
                     <X className="h-4 w-4" />
                   </button>
                 )}
               </div>
             </div>
           ) : null}
        </div>

        {/* Bottom Logo */}
        <div className="absolute h-[40px] left-[28px] top-[626px] w-[67px] z-20">
          {editableLogo ? (
            <div
              style={{
                backgroundImage: `url(${editableLogo})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <CompanyLogo className="h-full w-full" proposal={proposal} onColorExtracted={setDominantColor} />
          )}
        </div>
      </div>
    )
  }

  const renderBlankPage = (customPage: CustomPage, pageNumber: number, totalPages: number) => {
    return (
      <div className="relative w-full h-full bg-white">
        {/* Header */}
        <div className="absolute top-0 left-0 w-[700px] h-[70px] rounded-tr-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor || undefined }} />
        <div className="absolute top-0 left-0 w-[1310px] h-[70px] rounded-tl-[44px] rounded-tr-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : undefined }} />

        {/* Page Number */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[89px] right-[28px] w-[51px]">
          {pageNumber}/{totalPages}
        </p>

        {/* Custom Elements */}
        {customPage.elements.map((element) => (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: element.position.x,
              top: element.position.y + 70, // Account for header
              width: element.size.width,
              height: element.size.height,
              zIndex: 5
            }}
          >
            {element.type === 'text' && (
              <div
                className="w-full h-full overflow-hidden"
                style={{
                  fontSize: element.style?.fontSize || 16,
                  fontFamily: element.style?.fontFamily || 'Arial',
                  color: element.style?.color || '#000000',
                  fontWeight: element.style?.fontWeight || 'normal',
                  textAlign: element.style?.textAlign as any || 'left',
                  lineHeight: '1.2'
                }}
              >
                {element.content}
              </div>
            )}
            {element.type === 'image' && (
              <img
                src={element.content}
                alt="Custom content"
                className="w-full h-full object-cover"
              />
            )}
            {element.type === 'video' && (
              <video
                src={element.content}
                className="w-full h-full object-cover"
                controls
              />
            )}
          </div>
        ))}

        {/* Footer */}
        <div className="absolute top-[612px] right-0 w-[700px] h-[70px] rounded-tl-[44px] rounded-bl-[44px] z-10" style={{ backgroundColor: dominantColor || undefined }} />
        <div className="absolute top-[612px] right-0 w-[1320px] h-[70px] bg-[rgba(248,193,2,0.5)] rounded-tl-[44px] rounded-tl-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : undefined }} />

        {/* Edit Mode Overlay for Blank Pages */}
        {isEditMode && customPage.elements.length === 0 && (
          <div className="absolute top-[350px] left-0 right-0 bottom-[70px] flex items-center justify-center bg-gray-50 bg-opacity-80 z-10">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Edit className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Blank Page</h3>
                <p className="text-gray-600 mb-4">Click the edit button to add content</p>
              </div>
              <Button
                onClick={() => {
                  setEditingCustomPage(customPage)
                  setIsBlankPageEditorOpen(true)
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Page
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderOutroPage = (pageNumber: number) => {
    const totalPages = getTotalPages(selectedLayout)
    const formattedDate = proposal?.createdAt ? new Date(proposal.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'N/A'

    return (
      <div className="relative w-full h-full bg-white">
        {/* Header */}
        <div className="absolute top-0 left-0 w-[700px] h-[70px] rounded-tr-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor || undefined }} />
        <div className="absolute top-0 left-0 w-[1310px] h-[70px] rounded-tl-[44px] rounded-tr-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : undefined }} />

        {/* Background borders and accents - scaled */}
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-0 w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="bg-white h-[857px] w-[675px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-[473px] top-[2px] w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="h-[393px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-[594px] w-[0px]">
          <div className="flex-none rotate-[90deg]">
            <div className="h-[393px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-0 top-[2px] w-[0px]">
          <div className="flex-none rotate-[270deg]">
            <div className="h-[651px] rounded-bl-[44px] rounded-br-[44px] w-[69px]" />
          </div>
        </div>
        <div className="absolute flex h-[0px] items-center justify-center left-[208px] top-[594px] w-[0px]">
          <div className="flex-none rotate-[90deg]">
            <div className="h-[651px] rounded-bl-[44px] rounded-br-[44px] w-[69px]" />
          </div>
        </div>


        {/* Thank You Message - Group 534 content */}
        {isEditMode ? (
          <input
            value={editableProposalMessage}
            onChange={(e) => setEditableProposalMessage(e.target.value)}
            className="absolute font-bold text-[#333333] text-[71px] left-[73px] top-[307px] min-w-[200px] max-w-[500px] w-auto border-2 border-[#c4c4c4] border-dashed rounded px-2 outline-none whitespace-nowrap"
            style={{ width: `${Math.max(200, (editableProposalMessage.length * 45) + 35)}px` }}
          />
        ) : (
          <div className="absolute font-bold text-[#333333] text-[71px] left-[73px] top-[307px] whitespace-nowrap">
            Thank You!
          </div>
        )}

        {/* Contact Information */}
        <div className="absolute font-normal text-[#333333] text-[20px] left-[93px] top-[429px] w-[316px] leading-[1.2]">
          {isEditMode ? (
            <input
              value={editableContactInfo.heading}
              onChange={(e) => setEditableContactInfo(prev => ({ ...prev, heading: e.target.value }))}
              className="font-bold mb-0 text-[20px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
              placeholder="Contact Heading"
            />
          ) : (
            <p className="font-bold mb-0 text-[20px]">contact us:</p>
          )}
          {isEditMode ? (
            <>
              <input
                value={editableContactInfo.name}
                onChange={(e) => setEditableContactInfo(prev => ({ ...prev, name: e.target.value }))}
                className="mb-0 text-[20px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                placeholder="Contact Name"
              />
              <input
                value={editableContactInfo.role}
                onChange={(e) => setEditableContactInfo(prev => ({ ...prev, role: e.target.value }))}
                className="mb-0 text-[20px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                placeholder="Role"
              />
              <input
                value={editableContactInfo.phone}
                onChange={(e) => setEditableContactInfo(prev => ({ ...prev, phone: e.target.value }))}
                className="mb-0 text-[20px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                placeholder="Phone Number"
              />
              <input
                value={editableContactInfo.email}
                onChange={(e) => setEditableContactInfo(prev => ({ ...prev, email: e.target.value }))}
                className="text-[20px] border-2 border-[#c4c4c4] border-dashed rounded px-1 outline-none w-full"
                placeholder="Email Address"
              />
            </>
          ) : (
            <>
              <p className="mb-0 text-[20px]">{proposal?.contactInfo?.name || 'N/A'}</p>
              <p className="mb-0 text-[20px]">{proposal?.contactInfo?.role || 'Sales'}</p>
              <p className="mb-0 text-[20px]">{proposal?.contactInfo?.phone || 'N/A'}</p>
              <p className="text-[20px]">{proposal?.contactInfo?.email || 'N/A'}</p>
            </>
          )}
        </div>

        {/* Date */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[89px] right-[28px] w-[191px]">
          {formattedDate}
        </p>

        {/* Page Number */}
        <p className="absolute font-normal text-[#333333] text-[18px] text-right top-[558px] right-[28px] w-[51px]">
          {pageNumber}/{totalPages}
        </p>

        {/* Bottom Logo */}
        <div className="absolute h-[40px] left-[28px] top-[626px] w-[67px] z-20">
          {editableLogo ? (
            <div
              style={{
                backgroundImage: `url(${editableLogo})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <CompanyLogo className="h-full w-full" proposal={proposal} onColorExtracted={setDominantColor} />
          )}
        </div>

        {/* Footer */}
        <div className="absolute top-[612px] right-0 w-[700px] h-[70px] rounded-tl-[44px] rounded-bl-[44px] z-10" style={{ backgroundColor: dominantColor || undefined }} />
        <div className="absolute top-[612px] right-0 w-[1320px] h-[70px] rounded-tl-[44px] rounded-tl-[44px] rounded-br-[44px] z-10" style={{ backgroundColor: dominantColor ? `rgba(${parseInt(dominantColor.slice(1,3),16)}, ${parseInt(dominantColor.slice(3,5),16)}, ${parseInt(dominantColor.slice(5,7),16)}, 0.5)` : undefined }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 print:bg-white flex flex-col">

      {/* Top Navigation Header */}
      <div className="px-6 py-4 print:hidden">
        <button
          onClick={() => router.push('/sales/proposals')}
          className="text-[#333333] font-bold text-[20px] leading-none hover:text-gray-600 transition-colors"
        >
          ← Finalize proposal
        </button>
      </div>

      {/* Client Selector */}
      <div className="px-4 py-2 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-medium text-[16px] text-[#333333] w-[60px]">Client:</span>
            <Select value={selectedClientId} onValueChange={handleClientChange}>
              <SelectTrigger className="bg-white border-2 border-[#c4c4c4] rounded-[8px] h-[32px] w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleTemplates}
              className="w-[50px] h-[50px] bg-white border-[#c4c4c4] border-2 rounded-[12px] p-0 flex items-center justify-center hover:bg-gray-50"
            >
              <Grid3X3 className="h-5 w-5 text-black opacity-50" />
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleEditMode}
              className="w-[50px] h-[50px] bg-white border-[#c4c4c4] border-2 rounded-[12px] p-0 flex items-center justify-center hover:bg-gray-50"
            >
              <Edit className="h-5 w-5 text-black opacity-50" />
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={downloading}
              className="w-[50px] h-[50px] bg-white border-[#c4c4c4] border-2 rounded-[12px] p-0 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-5 w-5 animate-spin text-black opacity-50" />
              ) : (
                <Download className="h-5 w-5 text-black opacity-50" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sites Selector */}
      <div className="px-4 py-2 print:hidden">
        <div className="flex items-center mb-3">
          <span className="font-medium text-[16px] text-[#333333] w-[60px]">Site:</span>
          <div className="flex gap-3">
            {proposal?.products?.map((product, index) => (
              <div
                key={product.id}
                className="bg-[#c4c4c4] bg-opacity-25 shadow h-[32px] rounded-[8px] flex items-center justify-between px-2 min-w-[100px]"
              >
                <span className="font-medium text-[12px] text-[#333] leading-none truncate">
                  {product.site_code || product.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveSiteClick(product.ID || product.id || "", product.site_code || product.name)
                  }}
                  className="ml-2 text-[#333] hover:text-gray-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div
              className="bg-white shadow h-[32px] rounded-[8px] flex items-center px-2 min-w-[100px] cursor-pointer hover:bg-gray-50"
              onClick={handleAddSiteClick}
            >
              <span className="font-medium text-[16px] text-[#333333]">+Add Site</span>
            </div>
            {isEditMode && (
              <div
                className="bg-blue-50 shadow h-[32px] rounded-[8px] flex items-center px-2 min-w-[120px] cursor-pointer hover:bg-blue-100 border border-blue-200"
                onClick={() => handleAddBlankPage(getTotalPages(selectedLayout))}
              >
                <span className="font-medium text-[14px] text-blue-700">+Add Blank Page</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Proposal Page Content */}
        <div className="flex-1 p-2 md:p-4">
          {Array.from({ length: getTotalPages(selectedLayout) }, (_, index) => {
            const pageNumber = index + 1
            return (
              <div key={pageNumber} className={`${getPageContainerClass(selectedSize, "Landscape")} ${index > 0 ? 'mt-[-65px]' : ''}`} style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                {pageNumber === 1 ? renderIntroPage(pageNumber) : pageNumber === getTotalPages(selectedLayout) ? renderOutroPage(pageNumber) : renderSitePage(pageNumber)}
                {/* Add blank page button between pages */}
                {isEditMode && pageNumber === 1 && (
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                    <Button
                      onClick={() => handleAddBlankPage(pageNumber)}
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-8 h-8 p-0"
                      title="Add blank page"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {/* Edit/Delete blank page buttons */}
                {isEditMode && getCustomPageForPageNumber(pageNumber) && (
                  <div className="absolute top-2 right-2 z-30 flex gap-1">
                    <Button
                      onClick={() => {
                        const page = getCustomPageForPageNumber(pageNumber)!
                        setEditingCustomPage(page)
                        setIsBlankPageEditorOpen(true)
                      }}
                      size="sm"
                      variant="outline"
                      className="bg-white hover:bg-gray-50 w-8 h-8 p-0"
                      title="Edit blank page"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteBlankPage(getCustomPageForPageNumber(pageNumber)!.id)}
                      size="sm"
                      variant="outline"
                      className="bg-white hover:bg-red-50 border-red-200 w-8 h-8 p-0"
                      title="Delete blank page"
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="w-full md:w-80 h-[60vh] bg-white rounded-[20px] shadow-[-2px_4px_10.5px_-2px_rgba(0,0,0,0.25)] print:hidden flex flex-col">
          <div className="p-6 pb-0">
            <h3 className="text-lg font-semibold">
              Proposal History
              {proposal && (
                <span className="text-sm font-normal text-gray-500 block">for {proposal.client?.company}</span>
              )}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ProposalHistory
              selectedClient={
                proposal
                  ? {
                      id: proposal.client?.id || "",
                      company: proposal.client?.company,
                      contactPerson: proposal.client?.contactPerson,
                    }
                  : null
              }
              useProposalViewer={true}
              excludeProposalId={params.id as string}
              showHeader={false}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      {!loading && proposal && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 print:hidden">
          <div className="bg-white rounded-[20px] shadow-lg border border-gray-200 p-4 min-w-[350px] max-w-[450px]">
            <div className="flex items-center justify-center gap-4">
          {isEditMode ? (
            <div className="flex gap-4">
              <Button
                onClick={handleCancelEdit}
                variant="ghost"
                className="text-gray-600 hover:text-gray-800 underline underline-offset-4 hover:underline-offset-2 font-medium px-0 py-2 h-auto transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className={`bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 ${
                  savingEdit ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          ) : isEditingPrice ? (
            <>
              <Button
                onClick={() => setIsEditingPrice(false)}
                variant="outline"
                className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePrice}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
                disabled={savingPrice}
              >
                {savingPrice ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </>
          ) : (
            <div className="flex gap-4">
              <Button
                onClick={() => handleUpdatePublicStatus("draft")}
                variant="ghost"
                className="text-gray-600 hover:text-gray-800 underline underline-offset-4 hover:underline-offset-2 font-medium px-0 py-2 h-auto transition-all duration-200"
              >
                <FileText className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
              <Button
                onClick={async () => {
                  if (!proposal) return
                  try {
                    await generatePDFIfNeeded(proposal)
                    setIsSendOptionsDialogOpen(true)
                  } catch (error) {
                    // Error is already handled in generatePDFIfNeeded
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
              >
                <Send className="h-5 w-5 mr-2" />
                Send
              </Button>
            </div>
          )}
            </div>
          </div>
        </div>
      )}

      {/* Media Selection Dialog */}
      <Dialog open={isMediaDialogOpen} onOpenChange={setIsMediaDialogOpen}>
        <DialogContent className="max-w-4xl mx-auto border-0 shadow-lg">
          <DialogTitle className="text-xl font-semibold mb-4">
            Select Image for {selectedProductForMedia?.name}
          </DialogTitle>

          {selectedProductForMedia?.media && selectedProductForMedia.media.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {selectedProductForMedia.media.map((mediaItem, index) => (
                <div
                  key={index}
                  className="relative cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 transition-colors"
                  onClick={() => {
                    setPendingSiteImages(prev => ({
                      ...prev,
                      [selectedProductForMedia.id]: mediaItem.url
                    }))
                    setIsMediaDialogOpen(false)
                    setSelectedProductForMedia(null)
                    toast({
                      title: "Image Selected",
                      description: "Click 'Save' to confirm changes",
                    })
                  }}
                >
                  {mediaItem.isVideo ? (
                    <video
                      src={mediaItem.url}
                      className="w-full h-32 object-cover"
                      controls={false}
                    />
                  ) : (
                    <img
                      src={mediaItem.url}
                      alt={`Media ${index + 1}`}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/placeholder.svg"
                      }}
                    />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                    {mediaItem.type || 'Image'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No media available for this site.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsMediaDialogOpen(false)
                setSelectedProductForMedia(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Options Dialog */}
      <SendProposalShareDialog
        isOpen={isSendOptionsDialogOpen}
        onClose={() => setIsSendOptionsDialogOpen(false)}
        proposal={proposal}
        templateSettings={{
          size: selectedSize,
          orientation: selectedOrientation,
          layout: selectedLayout,
          background: selectedTemplateBackground
        }}
      />

      {/* Print Loading Dialog */}
      <Dialog open={printLoading} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm mx-auto text-center border-0 shadow-lg">
          <DialogTitle className="sr-only">Generating PDF for Print</DialogTitle>
          <div className="py-6">
            <div className="mb-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Preparing for Print</h2>
              <p className="text-gray-600">Generating PDF and waiting for all content to load...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Sites Dialog */}
      <Dialog open={isAddSiteDialogOpen} onOpenChange={setIsAddSiteDialogOpen}>
        <DialogContent className="max-w-6xl mx-auto border-0 shadow-lg">
          <DialogTitle className="text-xl font-semibold mb-4">Add Sites to Proposal</DialogTitle>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2">Loading products...</span>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Select sites to add to this proposal. Sites marked as "Already Added" are currently in this proposal. {selectedProductsForAddition.length} site{selectedProductsForAddition.length !== 1 ? 's' : ''} selected for addition.
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <ResponsiveCardGrid
                  mobileColumns={1}
                  tabletColumns={2}
                  desktopColumns={4}
                  gap="lg"
                >
                  {availableProducts.map((product) => {
                    // Check if product is already in proposal by comparing document IDs
                    const isAlreadyInProposal = proposal?.products?.some(p => {
                      const matches = p.ID === product.id || p.id === product.id
                      if (matches && product.id === "BjKgUoSrHaK5zLtqOKwL") {
                        console.log("Found matching product in proposal:", p, "for product:", product)
                      }
                      return matches
                    }) || false
                    const isSelectedForAddition = selectedProductsForAddition.some((p) => p.id === product.id)

                    return (
                      <div
                        key={product.id}
                        className={`bg-white rounded-2xl shadow-lg overflow-hidden transition-all border ${
                          isAlreadyInProposal
                            ? "border-blue-500 bg-blue-50 cursor-pointer hover:shadow-xl"
                            : isSelectedForAddition
                            ? "border-green-500 cursor-pointer hover:shadow-xl"
                            : "border-gray-200 cursor-pointer hover:shadow-xl"
                        }`}
                        onClick={() => isAlreadyInProposal ? handleRemoveSiteClick(product.id || "", product.site_code || product.name) : handleProductSelectForAddition(product)}
                      >
                        <div className="h-[180px] bg-gray-300 relative rounded-t-2xl">
                          <Image
                            src={product.media && product.media.length > 0 ? product.media[0].url : "/abstract-geometric-sculpture.png"}
                            alt={product.name || "Product image"}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/abstract-geometric-sculpture.png"
                              target.className = "opacity-50 object-contain"
                            }}
                          />

                          {/* Selection indicator */}
                          <div className="absolute top-3 left-3 z-10">
                            {isAlreadyInProposal ? (
                              <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-blue-500 flex items-center justify-center">
                                <CheckCircle2 size={16} className="text-white" />
                              </div>
                            ) : (
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  isSelectedForAddition
                                    ? "bg-green-500 border-green-500"
                                    : "bg-white border-gray-300"
                                }`}
                              >
                                {isSelectedForAddition && (
                                  <CheckCircle2 size={16} className="text-white" />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Already selected badge */}
                          {isAlreadyInProposal && (
                            <div className="absolute top-3 right-3 z-10">
                              <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                Already Added
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-3">
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 font-medium">
                              {product.site_code || "N/A"}
                            </div>
                            <div className="text-sm text-black font-medium line-clamp-1">
                              {product.name}
                            </div>
                            <div className="text-xs text-black font-medium truncate">
                              {product.specs_rental?.location || (product as any).light?.location || "Unknown location"}
                            </div>
                            <div className="text-xs text-black font-medium">
                              ₱{product.price ? Number(product.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Not set"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </ResponsiveCardGrid>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddSiteDialogOpen(false)
                    setSelectedProductsForAddition([])
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAddSites}
                  disabled={selectedProductsForAddition.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add {selectedProductsForAddition.length} Site{selectedProductsForAddition.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Templates Panel Dialog - Work in Progress */}
      <Dialog open={showTemplatesPanel} onOpenChange={setShowTemplatesPanel}>
        <DialogContent className="max-w-md mx-auto border-0 shadow-lg">
          <DialogTitle className="text-xl font-semibold mb-4 text-center">Template Settings</DialogTitle>

          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Grid3X3 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Work in Progress</h3>
            <p className="text-gray-600 mb-6">
              Template customization features are currently under development. This functionality will be available in a future update.
            </p>
            <Button
              onClick={() => setShowTemplatesPanel(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Template Form Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-md mx-auto border-0 shadow-lg">
          <DialogTitle className="text-xl font-semibold mb-4">Create New Template</DialogTitle>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter template name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="background-url">Background URL (optional)</Label>
              <Input
                id="background-url"
                value={formData.background_url}
                onChange={(e) => handleInputChange("background_url", e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Or Upload Background Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {filePreview && (
                <div className="mt-2">
                  <img src={filePreview} alt="Preview" className="max-w-full h-32 object-cover rounded border" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToList}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formLoading || uploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {formLoading || uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Template"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Blank Page Editor Dialog */}
      <Dialog open={isBlankPageEditorOpen} onOpenChange={setIsBlankPageEditorOpen}>
        <DialogContent className="w-full max-w-7xl mx-auto border-0 shadow-lg h-[90vh] sm:h-[95vh]">
          <DialogTitle className="sr-only">Blank Page Editor</DialogTitle>
          {editingCustomPage && (
            <BlankPageEditor
              page={editingCustomPage}
              onSave={handleSaveBlankPage}
              onCancel={() => {
                setIsBlankPageEditorOpen(false)
                setEditingCustomPage(null)
              }}
              pageWidth={getPageDimensions(selectedSize, selectedOrientation).width}
              pageHeight={getPageDimensions(selectedSize, selectedOrientation).height}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteConfirmationOpen}
        onClose={() => {
          setIsDeleteConfirmationOpen(false)
          setSiteToDelete(null)
        }}
        onConfirm={handleConfirmRemoveSite}
        title="Remove Site from Proposal"
        description="This action will remove the site from your proposal. You can add it back later if needed."
        itemName={siteToDelete?.name}
        confirmButtonText="Remove"
        confirmButtonLoadingText="Removing..."
      />
    </div>
  )
}
