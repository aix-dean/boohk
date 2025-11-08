"use client"

import type React from "react"
import Image from "next/image"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"

import { Loader2, ArrowLeft } from "lucide-react"

import { format } from "date-fns"
import type { Product } from "@/lib/firebase-service"
import type { JobOrder } from "@/lib/types/job-order" // Import JobOrder type
import { teamsService } from "@/lib/teams-service"
import type { Team } from "@/lib/types/team"
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ServiceAssignmentSuccessDialog } from "@/components/service-assignment-success-dialog"
import { ServiceAssignmentConfirmationDialog } from "@/components/service-assignment-confirmation-dialog"
import { useToast } from "@/hooks/use-toast"

import { generateServiceAssignmentPDF } from "@/lib/pdf-service"
import { TeamFormDialog } from "@/components/team-form-dialog"
import { JobOrderSelectionDialog } from "@/components/logistics/assignments/create/JobOrderSelectionDialog"
import { ProductSelectionDialog } from "@/components/logistics/assignments/create/ProductSelectionDialog"
import { CompanyService } from "@/lib/company-service"
import { storage } from "@/lib/firebase"
import { playerService } from "@/lib/player-service"
import { createCMSContentDeployment } from "@/lib/cms-api"

// Service types as provided
const SERVICE_TYPES = ["Roll Up", "Roll Down", "Monitoring", "Change Material", "Maintenance", "Repair"]

import { CreateServiceAssignmentForm } from '@/components/logistics/assignments/create/CreateServiceAssignmentForm';

export default function CreateServiceAssignmentPage() {
  const { user, userData } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const initialProjectSite = searchParams.get("projectSite")
  const jobOrderId = searchParams.get("jobOrderId") // Get jobOrderId from query params

  const [loading, setLoading] = useState(false)
  const [fetchingProducts, setFetchingProducts] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [saNumber, setSaNumber] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [createdSaNumber, setCreatedSaNumber] = useState("")
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [isEditingDraft, setIsEditingDraft] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [isJobOrderSelectionDialogOpen, setIsJobOrderSelectionDialogOpen] = useState(false) // State for JobOrderSelectionDialog
  const [jobOrderData, setJobOrderData] = useState<JobOrder | null>(null) // State to store fetched job order
  const [hasManualSelection, setHasManualSelection] = useState(false) // Flag to prevent job order pre-filling after manual selection
  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string | null>(null) // State to store selected job order ID
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false) // State for confirmation dialog

  const [teams, setTeams] = useState<Team[]>([])
  const [isProductSelectionDialogOpen, setIsProductSelectionDialogOpen] = useState(false) // State for ProductSelectionDialog

  const [loadingTeams, setLoadingTeams] = useState(true)
  const [isNewTeamDialogOpen, setIsNewTeamDialogOpen] = useState(false)


  // Form data state
  const [formData, setFormData] = useState({
    projectSite: initialProjectSite || "",
    serviceType: "",
    assignedTo: "",
    serviceDuration: 0,
    priority: "",
    equipmentRequired: "",
    materialSpecs: "",
    crew: "",
    gondola: "",
    technology: "",
    sales: "",
    remarks: "",
    message: "",
    campaignName: "",
    startDate: null as Date | null,
    endDate: null as Date | null,
    alarmDate: null as Date | null,
    alarmTime: "",
    attachments: [] as { name: string; type: string; file?: File; url?: string }[],
    serviceExpenses: [] as { name: string; amount: string }[],
    serviceCost: {
      crewFee: "",
      overtimeFee: "",
      transpo: "",
      tollFee: "",
      mealAllowance: "",
      otherFees: [] as { name: string; amount: string }[],
      total: 0,
    },
  })

  // Auto-set sales field to current user's full name
  useEffect(() => {
    if (userData?.first_name && userData?.last_name && !formData.sales) {
      setFormData(prev => ({ ...prev, sales: `${userData.first_name} ${userData.last_name}` }));
    }
  }, [userData, formData.sales]);


  // Generate a random SA number on mount
  useEffect(() => {
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    setSaNumber(randomNum.toString())
  }, [])

  // Fetch products when component mounts
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setFetchingProducts(true)
        const productsRef = collection(db, "products")
        const q = query(productsRef, where("deleted", "==", false), orderBy("name", "asc"), limit(100))
        const querySnapshot = await getDocs(q)

        const fetchedProducts: Product[] = []
        querySnapshot.forEach((doc) => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as Product)
        })

        setProducts(fetchedProducts)
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setFetchingProducts(false)
      }
    }

    fetchProducts()
  }, [])

  // Auto-select product when projectSite parameter is present
  useEffect(() => {
    const autoSelectProduct = async () => {
      if (initialProjectSite && !formData.projectSite && userData?.company_id) {
        try {
          // First check if the product is already in the loaded products
          const existingProduct = products.find(p => p.id === initialProjectSite)
          if (existingProduct) {
            setFormData(prev => ({ ...prev, projectSite: initialProjectSite }))
            return
          }

          // If not found in loaded products, fetch the specific product document
          const productDoc = await getDoc(doc(db, "products", initialProjectSite))
          if (productDoc.exists()) {
            const productData = { id: productDoc.id, ...productDoc.data() } as Product
            // Add the product to the products array if it's not already there
            setProducts(prev => {
              const exists = prev.find(p => p.id === productData.id)
              if (!exists) {
                return [...prev, productData]
              }
              return prev
            })
            // Set the projectSite in form data
            setFormData(prev => ({ ...prev, projectSite: initialProjectSite }))
          }
        } catch (error) {
          console.error("Error fetching product for auto-selection:", error)
        }
      }
    }

    autoSelectProduct()
  }, [initialProjectSite, formData.projectSite, userData?.company_id, products])

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoadingTeams(true)
        const teamsData = await teamsService.getAllTeams(userData?.company_id ?? undefined)
        // Filter only active teams
        const activeTeams = teamsData.filter((team) => team.status === "active")
        setTeams(activeTeams)
      } catch (error) {
        console.error("Error fetching teams:", error)
      } finally {
        setLoadingTeams(false)
      }
    }

    fetchTeams()
  }, [userData?.company_id])

  // Helper function to set form data from job order
  const setFormDataForJobOrder = (fetchedJobOrder: JobOrder, productId: string) => {
    // Helper function to safely parse dates
    const parseDateSafely = (dateValue: any): Date | null => {
      if (!dateValue) return null;

      try {
        let date: Date;

        if (dateValue instanceof Date) {
          date = dateValue;
        } else if (typeof dateValue === 'string') {
          date = new Date(dateValue);
          if (isNaN(date.getTime())) {
            return null;
          }
        } else if (typeof dateValue === 'number') {
          date = new Date(dateValue * 1000);
        } else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
          date = new Date(dateValue.seconds * 1000);
        } else {
          return null;
        }

        if (isNaN(date.getTime())) {
          return null;
        }

        return date;
      } catch (error) {
        console.warn('Error parsing date:', dateValue, error);
        return null;
      }
    };

    setFormData((prev) => ({
      ...prev,
      projectSite: productId,
      serviceType: fetchedJobOrder.joType ? fetchedJobOrder.joType.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : "",
      remarks: fetchedJobOrder.remarks || fetchedJobOrder.jobDescription || "",
      campaignName: fetchedJobOrder.campaignName || "",
      startDate: parseDateSafely(fetchedJobOrder.dateRequested),
      endDate: parseDateSafely(fetchedJobOrder.deadline),
      // You might want to pre-fill other fields like assignedTo, crew, etc.
    }))
  }

  // Load draft data if editing
  useEffect(() => {
    const loadDraft = async () => {
      const draftParam = searchParams.get("draft")
      if (draftParam) {
        try {
          setDraftId(draftParam)
          const draftDoc = await getDoc(doc(db, "service_assignments", draftParam))

          if (draftDoc.exists()) {
            const draftData = draftDoc.data()
            setIsEditingDraft(true)

            // Load the draft data into form
            setFormData({
              projectSite: draftData.projectSiteId || "",
              serviceType: draftData.serviceType || "",
              assignedTo: draftData.crew || draftData.assignedTo || "",
              serviceDuration: draftData.serviceDuration || "",
              priority: draftData.priority || "",
              equipmentRequired: draftData.equipmentRequired || "",
              materialSpecs: draftData.materialSpecs || "",
              crew: draftData.crew || draftData.assignedTo || "",
              gondola: draftData.gondola || "",
              technology: draftData.technology || "",
              sales: draftData.sales || "",
              remarks: draftData.remarks || "",
              message: draftData.message || "",
              campaignName: draftData.campaignName || "",
              startDate: draftData.coveredDateStart?.toDate() || null,
              endDate: draftData.coveredDateEnd?.toDate() || null,
              alarmDate: draftData.alarmDate?.toDate() || null,
              alarmTime: draftData.alarmTime || "",
              attachments: draftData.attachments || [],
              serviceExpenses: draftData.serviceExpenses || [],
              serviceCost: {
                crewFee: "",
                overtimeFee: "",
                transpo: "",
                tollFee: "",
                mealAllowance: "",
                otherFees: [],
                total: 0,
              },
            })

            // Set the SA number from draft
            setSaNumber(draftData.saNumber || "")

            // Date inputs are now handled directly as Date objects
          }
        } catch (error) {
          console.error("Error loading draft:", error)
          alert("Error loading draft")
        }
      }
    }

    loadDraft()
  }, [searchParams])

  // Fetch job order data if jobOrderId is present
  useEffect(() => {
    const fetchJobOrder = async () => {
      if (jobOrderId && !hasManualSelection && !jobOrderData) {
        try {
          const jobOrderDoc = await getDoc(doc(db, "job_orders", jobOrderId))
          if (jobOrderDoc.exists()) {
            const fetchedJobOrder = { id: jobOrderDoc.id, ...jobOrderDoc.data() } as JobOrder
            setJobOrderData(fetchedJobOrder)
            setSelectedJobOrderId(fetchedJobOrder.id)

            // Debug logging to understand the job order structure
            console.log("Fetched job order data:", fetchedJobOrder)
            console.log("Available fields:", Object.keys(fetchedJobOrder))
            console.log("joType value:", fetchedJobOrder.joType)
            console.log("jobDescription value:", fetchedJobOrder.jobDescription)

            // Set the project site from the job order's product_id
            const productId = fetchedJobOrder.product_id || ""
            if (productId) {
              // Guard: Prevent pre-fill if user has manually selected a different product
              if (formData.projectSite && formData.projectSite !== productId) {
                // Skip pre-fill logic to preserve manual selection
                return
              }
              // First check if the product is already in the loaded products
              const existingProduct = products.find(p => p.id === productId)
              if (existingProduct) {
                // Product exists, proceed with setting form data
                setFormDataForJobOrder(fetchedJobOrder, productId)
              } else {
                // If not found in loaded products, fetch the specific product document
                try {
                  const productDoc = await getDoc(doc(db, "products", productId))
                  if (productDoc.exists()) {
                    const productData = { id: productDoc.id, ...productDoc.data() } as Product
                    // Add the product to the products array if it's not already there
                    setProducts(prev => {
                      const exists = prev.find(p => p.id === productData.id)
                      if (!exists) {
                        return [...prev, productData]
                      }
                      return prev
                    })
                    // Proceed with setting form data
                    setFormDataForJobOrder(fetchedJobOrder, productId)
                  } else {
                    // Product not found, still set the form data but product won't be selectable
                    setFormDataForJobOrder(fetchedJobOrder, productId)
                  }
                } catch (error) {
                  console.error("Error fetching product for job order:", error)
                  // Still set form data even if product fetch fails
                  setFormDataForJobOrder(fetchedJobOrder, productId)
                }
              }
            }

            // Date inputs are now handled directly as Date objects
          }
        } catch (error) {
          console.error("Error fetching job order for pre-fill:", error)
        }
      }
    }
    fetchJobOrder()
  }, [jobOrderId, products, hasManualSelection]) // Added products to dependencies to check if product is already loaded

  // Prevent job order data from overriding manual product selection
  useEffect(() => {
    if (jobOrderData && formData.projectSite && formData.projectSite !== jobOrderData.product_id) {
      // If user has manually selected a different product, clear job order data
      console.log("Manual product selection detected, clearing job order data")
      setJobOrderData(null)
    }
  }, [formData.projectSite, jobOrderData])

  // Reset manual selection flag when jobOrderId changes
  useEffect(() => {
    setHasManualSelection(false)
  }, [jobOrderId])

  // Handle form input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }


  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newAttachments: { name: string; type: string; file: File; url?: string }[] = []

    for (const file of Array.from(files)) {
      // Check file size (10MB limit)
      if (file.size > 500 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`)
        continue
      }

      try {
        // Upload file to Firebase Storage
        const fileName = `attachments/${Date.now()}-${file.name}`
        const fileRef = ref(storage, fileName)
        await uploadBytes(fileRef, file)
        const downloadURL = await getDownloadURL(fileRef)

        newAttachments.push({
          name: file.name,
          type: file.type,
          file: file,
          url: downloadURL,
        })
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error)
        alert(`Failed to upload ${file.name}. Please try again.`)
      }
    }

    if (newAttachments.length > 0) {
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }))
    }

    // Note: Input reset is now handled in ServiceAssignmentCard component
  }

  // Remove attachment
  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  // Convert attachments to Firestore-compatible format
  const convertAttachmentsForFirestore = async (attachments: { name: string; type: string; file?: File }[], saNumber: string) => {
    const convertedAttachments = []

    for (const attachment of attachments) {
      let downloadUrl = null

      // Upload file to Firebase Storage if it exists
      if (attachment.file) {
        try {
          const storage = getStorage()
          const fileName = `${attachment.name}`
          const storageRef = ref(storage, fileName)

          const snapshot = await uploadBytes(storageRef, attachment.file)
          downloadUrl = await getDownloadURL(snapshot.ref)
        } catch (error) {
          console.error("Error uploading attachment to storage:", error)
        }
      }

      convertedAttachments.push({
        name: attachment.name,
        type: attachment.type,
        size: attachment.file?.size || 0,
        lastModified: attachment.file?.lastModified || Date.now(),
        url: downloadUrl, // Include the download URL
      })
    }

    return convertedAttachments
  }

  // Chunked base64 conversion to handle large PDFs efficiently
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    const chunkSize = 8192 // Process in 8KB chunks to avoid stack overflow
    let result = ''

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize)
      result += String.fromCharCode.apply(null, Array.from(chunk))
    }

    return btoa(result)
  }

  // Helper function to convert File objects to base64 data URLs
  const fileToBase64DataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  // Handle form submission (now navigates to PDF preview without creating assignment) - shows confirmation dialog first
  const handleSubmit = () => {
    setShowConfirmationDialog(true)
    return Promise.resolve()
  }

const handleSubmitConfirmed = async () => {
  if (!user) return

  // --- Validation ---
  if (!formData.projectSite || formData.projectSite.trim() === "") {
    toast({
      title: "Site Selection Required",
      description: "Please select a site before creating the service assignment.",
      variant: "destructive",
    });
    return;
  }

  if (formData.serviceType !== "Maintenance" && formData.serviceType !== "Repair") {
    if (!formData.campaignName || formData.campaignName.trim() === "") {
      toast({
        title: "Campaign Name Required",
        description: "Please enter a campaign name.",
        variant: "destructive",
      });
      return;
    }
  }

  if (!["Monitoring", "Change Material", "Maintenance", "Repair"].includes(formData.serviceType)) {
    if (!formData.materialSpecs || formData.materialSpecs.trim() === "") {
      toast({
        title: "Material Specs Required",
        description: "Please select material specifications.",
        variant: "destructive",
      });
      return;
    }
  }

  if (!formData.crew || formData.crew.trim() === "") {
    toast({
      title: "Crew Selection Required",
      description: "Please select a crew for the assignment.",
      variant: "destructive",
    });
    return;
  }

  try {
    setGeneratingPDF(true)
    setLoading(true)

    const selectedProduct = products.find((p) => p.id === formData.projectSite)
    const selectedTeam = teams.find((t) => t.id === (formData.assignedTo || formData.crew))

    // --- Prepare PDF and assignment data ---
    const pdfAssignmentData = {
      saNumber,
      projectSiteName: selectedProduct?.name || "",
      projectSiteLocation: selectedProduct?.light?.location || selectedProduct?.specs_rental?.location || "",
      serviceType: formData.serviceType,
      assignedTo: selectedTeam?.id || formData.crew,
      assignedToName: selectedTeam?.name || "",
      serviceDuration: `${formData.serviceDuration} days`,
      priority: formData.priority,
      equipmentRequired: formData.equipmentRequired,
      materialSpecs: formData.materialSpecs,
      crew: formData.crew,
      crewName: selectedTeam?.name || "",
      gondola: formData.gondola,
      technology: formData.technology,
      sales: formData.sales,
      campaignName: formData.campaignName,
      remarks: formData.remarks,
      requestedBy: {
        name: userData?.first_name && userData?.last_name
          ? `${userData.first_name} ${userData.last_name}`
          : user?.displayName || "Unknown User",
        department: "LOGISTICS",
      },
      startDate: formData.startDate,
      endDate: formData.endDate,
      alarmDate: formData.alarmDate,
      alarmTime: formData.alarmTime,
      attachments: await convertAttachmentsForFirestore(formData.attachments, saNumber),
      serviceExpenses: formData.serviceExpenses,
      status: "Draft",
      created: new Date(),
    }

    // Fetch company logo
    const companyData = userData?.company_id ? await CompanyService.getCompanyData(userData.company_id) : null
    let logoDataUrl = null
    if (companyData?.logo) {
      try {
        const logoResponse = await fetch(companyData.logo)
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob()
          logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(logoBlob)
          })
        }
      } catch (error) {
        console.error('Error fetching company logo:', error)
      }
    }

    // --- Generate PDF ---
    const response = await fetch('/api/generate-service-assignment-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignment: pdfAssignmentData,
        companyData,
        logoDataUrl,
        format: 'pdf',
        userData,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to generate PDF')
    }

    const pdfBuffer = await response.arrayBuffer()
    const pdfBase64 = arrayBufferToBase64(pdfBuffer)
    if (!pdfBase64) throw new Error('Failed to generate PDF')

    localStorage.setItem('serviceAssignmentData', JSON.stringify({
      ...pdfAssignmentData,
      projectSiteId: formData.projectSite,
      message: formData.message,
      jobOrderId: jobOrderData?.id || null,
      reservation_number: jobOrderData?.reservation_number || null,
      booking_id: jobOrderData?.booking_id || null,
      userData: {
        uid: user.uid,
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        company_id: userData?.company_id,
        license_key: userData?.license_key,
      }
    }))
    localStorage.setItem('serviceAssignmentPDF', pdfBase64)

    // --- Prepare Firestore assignment data ---
    const assignmentData = {
      ...pdfAssignmentData,
      projectSiteId: formData.projectSite,
      assignedTo: formData.assignedTo || formData.crew,
      message: formData.message,
      status: "Pending",
      updated: serverTimestamp(),
      project_key: userData?.license_key || "",
      company_id: userData?.company_id || null,
      jobOrderId: selectedJobOrderId || null,
      reservation_number: jobOrderData?.reservation_number || null,
      booking_id: jobOrderData?.booking_id || null,
      attachments: await convertAttachmentsForFirestore(formData.attachments, saNumber),
    }

    // --- Save to Firestore ---
    let assignmentDocRef
    if (isEditingDraft && draftId) {
      assignmentDocRef = doc(db, "service_assignments", draftId)
      await updateDoc(assignmentDocRef, assignmentData)
    } else {
      assignmentDocRef = await addDoc(collection(db, "service_assignments"), {
        ...assignmentData,
        created: serverTimestamp(),
      })
    }

    // --- Notifications ---
    try {
      const notificationTitle = `New Service Assignment: ${saNumber}`
      const notificationDescription = `A new ${formData.serviceType} service assignment has been created for ${selectedProduct?.name || "Unknown Site"}`

      const departments = ["Logistics", "Admin"]
      for (const dept of departments) {
        await addDoc(collection(db, "notifications"), {
          type: "Service Assignment",
          title: notificationTitle,
          description: notificationDescription,
          department_to: dept,
          uid_to: null,
          company_id: userData?.company_id,
          department_from: "Logistics",
          viewed: false,
          navigate_to: `${process.env.NEXT_PUBLIC_APP_URL || window?.location?.origin || ""}/logistics/assignments/${assignmentDocRef.id}`,
          created: serverTimestamp(),
        })
      }
    } catch (notificationError) {
      console.error("Error creating notifications:", notificationError)
    }

    // Integrate with CMS API for content deployment
      try {
        // Get the download URL from the first uploaded attachment
        const convertedAttachments = await convertAttachmentsForFirestore(formData.attachments, saNumber)
        const attachmentDownloadUrl = convertedAttachments.length > 0 ? convertedAttachments[0].url : null

        if (attachmentDownloadUrl) {
          console.log("Creating CMS content deployment for service assignment...")
          console.log("Attachment URL:", attachmentDownloadUrl)

          const playerIds = selectedProduct?.playerIds || ["141a16d405254b8fb5c5173ef3a58cc5"]
          const schedule = {
            startDate: formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : "2020-01-11",
            endDate: formData.endDate ? format(formData.endDate, "yyyy-MM-dd") : "2060-05-12",
            plans: [
              {
                weekDays: [1, 2, 3, 4, 5],
                startTime: "00:00",
                endTime: "22:00"
              }
            ]
          }
          const pages = [
            {
              name: `sa-${saNumber}-page`,
              widgets: [
                {
                  zIndex: 1,
                  type: "STREAM_MEDIA",
                  size: 12000,
                  md5: "placeholder-md5", // This should be calculated from the actual file
                  duration: 9000,
                  url: attachmentDownloadUrl,
                  layout: {
                    x: "0%",
                    y: "0%",
                    width: "100%",
                    height: "100%"
                  }
                }
              ]
            }
          ]

          await createCMSContentDeployment(playerIds, schedule, pages)
        } else {
          console.log("No attachment found for CMS deployment")
        }
      } catch (cmsApiError) {
        console.error("Error with CMS API integration:", cmsApiError)
        // Don't throw here - we don't want CMS API failure to break assignment creation
      }

    // --- Navigate to PDF preview ---
    router.push(`/logistics/assignments/view-pdf/preview?jobOrderId=${jobOrderId || 'Df4wxbfrO5EnAbml0r2I'}&booking_id=${jobOrderData?.booking_id || ''}`)

  } catch (error) {
    console.error("Error submitting service assignment:", error)
    toast({
      title: "Submission Failed",
      description: "Unable to process the service assignment. Please check your connection and try again.",
      variant: "destructive",
    })
  } finally {
    setGeneratingPDF(false)
    setLoading(false)
  }
}

  // Add this new function after the handleSubmit function
  const handleSaveDraft = async () => {
    if (!user) return

    // Validate that a site is selected
    if (!formData.projectSite || formData.projectSite.trim() === "") {
      toast({
        title: "Site Selection Required",
        description: "Please select a site before saving the draft.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields based on service type for drafts too
    if (formData.serviceType !== "Maintenance" && formData.serviceType !== "Repair") {
      // Campaign Name is required for non-maintenance/repair services
      if (!formData.campaignName || formData.campaignName.trim() === "") {
        toast({
          title: "Campaign Name Required",
          description: "Please enter a campaign name before saving the draft.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!["Monitoring", "Change Material", "Maintenance", "Repair"].includes(formData.serviceType)) {
      // Material Specs is required for services that are not monitoring, change material, maintenance, or repair
      if (!formData.materialSpecs || formData.materialSpecs.trim() === "") {
        toast({
          title: "Material Specs Required",
          description: "Please select material specifications before saving the draft.",
          variant: "destructive",
        });
        return;
      }
    }

    // Crew is always required
    if (!formData.crew || formData.crew.trim() === "") {
      toast({
        title: "Crew Selection Required",
        description: "Please select a crew before saving the draft.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true)
      console.log("jobOrderData:", jobOrderData)
      console.log("jobOrderData.booking_id:", jobOrderData?.booking_id)
      const selectedProduct = products.find((p) => p.id === formData.projectSite)
      const selectedTeam = teams.find((t) => t.id === (formData.assignedTo || formData.crew))

      const draftData = {
        saNumber,
        projectSiteId: formData.projectSite,
        projectSiteName: selectedProduct?.name || "",
        projectSiteLocation: selectedProduct?.light?.location || selectedProduct?.specs_rental?.location || "",
        serviceType: formData.serviceType,
        assignedTo: selectedTeam?.id || formData.assignedTo || formData.crew,
        assignedToName: selectedTeam?.name || "",
        serviceDuration: `${formData.serviceDuration} days`,
        priority: formData.priority,
        equipmentRequired: formData.equipmentRequired,
        materialSpecs: formData.materialSpecs,
        crew: formData.crew,
        gondola: formData.gondola,
        technology: formData.technology,
        sales: formData.sales,
        remarks: formData.remarks,
        requestedBy: {
          id: user.uid,
          name: userData?.first_name && userData?.last_name
            ? `${userData.first_name} ${userData.last_name}`
            : user?.displayName || "Unknown User",
          department: "LOGISTICS",
        },
        message: formData.message,
        campaignName: formData.campaignName,
        joNumber: jobOrderData?.joNumber || null, // Add job order number if present
        coveredDateStart: formData.startDate ? Timestamp.fromDate(formData.startDate) : null,
        coveredDateEnd: formData.endDate ? Timestamp.fromDate(formData.endDate) : null,
        alarmDate: formData.alarmDate ? Timestamp.fromDate(formData.alarmDate) : null,
        alarmTime: formData.alarmTime,
        attachments: await convertAttachmentsForFirestore(formData.attachments, saNumber),
        serviceExpenses: formData.serviceExpenses,
        status: "Draft",
        updated: serverTimestamp(),
        project_key: userData?.license_key || "",
        company_id: userData?.company_id || null,
        jobOrderId: selectedJobOrderId || null, // Add job order ID if present
        reservation_number: jobOrderData?.reservation_number || null, // Add reservation number from job order
        booking_id: jobOrderData?.booking_id || null, // Add booking ID from job order
      }

      if (isEditingDraft && draftId) {
        // Update existing draft
        await updateDoc(doc(db, "service_assignments", draftId), draftData)
        alert("Draft updated successfully!")
      } else {
        // Create new draft
        await addDoc(collection(db, "service_assignments"), {
          ...draftData,
          created: serverTimestamp(),
        })
        alert("Service assignment saved as draft successfully!")
      }

      router.push("/logistics/assignments")
    } catch (error) {
      console.error("Error saving draft:", error)
      alert("Error saving draft. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Generate time options
  const timeOptions = useMemo(() => {
    const options = []
    for (let hour = 0; hour < 24; hour++) {
      options.push({
        value: `${hour}:00`,
        label: `${hour.toString().padStart(2, "0")}:00`,
      })
    }
    return options
  }, [])

  // Calculate service expenses total
  const calculateTotal = () => {
    return formData.serviceExpenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0)
  }

  // Add expense
  const addExpense = () => {
    setFormData((prev) => ({
      ...prev,
      serviceExpenses: [...prev.serviceExpenses, { name: "", amount: "" }],
    }))
  }

  // Remove expense
  const removeExpense = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      serviceExpenses: prev.serviceExpenses.filter((_, i) => i !== index),
    }))
  }

  // Update expense
  const updateExpense = (index: number, field: "name" | "amount", value: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceExpenses: prev.serviceExpenses.map((expense, i) => (i === index ? { ...expense, [field]: value } : expense)),
    }))
  }

  // Format date for display
  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return ""
    try {
      return format(date, "PPP")
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid date"
    }
  }

  // Handle success dialog actions
  const handleViewAssignments = () => {
    router.push("/logistics/assignments")
  }

  const handleCreateAnother = () => {
    // Reset form
    setFormData({
      projectSite: "",
      serviceType: "",
      assignedTo: "",
      serviceDuration: 0,
      priority: "",
      equipmentRequired: "",
      materialSpecs: "",
      crew: "",
      gondola: "",
      technology: "",
      sales: "",
      remarks: "",
      message: "",
      campaignName: "",
      startDate: null,
      endDate: null,
      alarmDate: null,
      alarmTime: "",
      attachments: [],
      serviceExpenses: [],
      serviceCost: {
        crewFee: "",
        overtimeFee: "",
        transpo: "",
        tollFee: "",
        mealAllowance: "",
        otherFees: [],
        total: 0,
      },
    })

    // Generate new SA number
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    setSaNumber(randomNum.toString())
  }

  // Handle PDF generation and print/download
  const handleGeneratePDF = async (action: "print" | "download") => {
    try {
      setGeneratingPDF(true)

      // Create service assignment data structure for PDF
      const selectedProduct = products.find((p) => p.id === formData.projectSite)
      const selectedTeam = teams.find((t) => t.id === formData.crew)
      const serviceAssignmentData = {
        saNumber,
        projectSiteName: selectedProduct?.name || "",
        projectSiteLocation: selectedProduct?.light?.location || selectedProduct?.specs_rental?.location || "",
        serviceType: formData.serviceType,
        assignedTo: selectedTeam?.name || formData.assignedTo,
        assignedToName: selectedTeam?.name || "",
        serviceDuration: `${formData.serviceDuration} days`,
         priority: formData.priority,
         equipmentRequired: formData.equipmentRequired,
         materialSpecs: formData.materialSpecs,
         crew: formData.crew,
         crewName: selectedTeam?.name || "",
         gondola: formData.gondola,
         technology: formData.technology,
         sales: formData.sales,
         campaignName: formData.campaignName,
         remarks: formData.remarks,
         requestedBy: {
           name:
             userData?.first_name && userData?.last_name
               ? `${userData.first_name} ${userData.last_name}`
               : user?.displayName || "Unknown User",
           department: "LOGISTICS",
         },
         startDate: formData.startDate,
         endDate: formData.endDate,
         alarmDate: formData.alarmDate,
         alarmTime: formData.alarmTime,
         attachments: formData.attachments.map(att => ({
           name: att.name,
           type: att.type,
           url: att.url
         })),
         serviceExpenses: formData.serviceExpenses,
         status: "Draft",
         created: new Date(),
      }

      if (action === "print") {
        // Generate PDF and open in new window for printing
        await generateServiceAssignmentPDF(serviceAssignmentData, false)
      } else {
        // Download PDF
        await generateServiceAssignmentPDF(serviceAssignmentData, false)
      }
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "PDF Generation Failed",
        description: "Unable to create PDF. Please check your connection and try again. If the problem persists, contact support.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleCrewChange = (value: string) => {
    if (value === "add-new-team") {
      setIsNewTeamDialogOpen(true)
    } else {
      handleInputChange("crew", value)
    }
  }

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    console.log("handleProductSelect called with product:", product)
    console.log("Setting projectSite to:", product.id)
    handleInputChange("projectSite", product.id || "")
    // Clear job order data when manually selecting a product to allow the new selection to take precedence
    setJobOrderData(null)
    // Set flag to prevent job order pre-filling
    setHasManualSelection(true)
    // Replace the product in the products array with the selected product data
    setProducts(prev => {
      const filtered = prev.filter(p => p.id !== product.id)
      console.log("Replacing product in products array:", product.name)
      return [...filtered, product]
    })
    console.log("handleProductSelect completed")
  }

  // Handle identify JO
  const handleIdentifyJO = () => {
    // Check if a product is selected
    if (!formData.projectSite) {
      // Show error toast
      toast({
        title: "Site Selection Required",
        description: "Please select a site first before identifying job orders.",
        variant: "destructive",
      });
      return;
    }

    // Show the job order selection dialog
    setIsJobOrderSelectionDialogOpen(true);
  };

  // Handle job order selection
  const handleJobOrderSelect = async (jobOrder: JobOrder) => {
    try {
      // Fetch the complete job order document to get all fields including booking_id and jobOrderId
      const jobOrderDoc = await getDoc(doc(db, "job_orders", jobOrder.id))
      if (jobOrderDoc.exists()) {
        const completeJobOrder = { id: jobOrderDoc.id, ...jobOrderDoc.data() } as JobOrder
        console.log("Fetched job order data:", completeJobOrder)
        console.log("booking_id:", completeJobOrder.booking_id)
        console.log("jobOrderId:", completeJobOrder.id)
        setJobOrderData(completeJobOrder)
        setSelectedJobOrderId(completeJobOrder.id)

        // Get the product_id during the selection
        const productId = completeJobOrder.product_id || ""
        if (productId) {
          // Helper function to safely parse dates
          const parseDateSafely = (dateValue: any): Date | null => {
            if (!dateValue) return null;

            try {
              let date: Date;

              if (dateValue instanceof Date) {
                date = dateValue;
              } else if (typeof dateValue === 'string') {
                date = new Date(dateValue);
                if (isNaN(date.getTime())) {
                  return null;
                }
              } else if (typeof dateValue === 'number') {
                date = new Date(dateValue * 1000);
              } else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                date = new Date(dateValue.seconds * 1000);
              } else {
                return null;
              }

              if (isNaN(date.getTime())) {
                return null;
              }

              return date;
            } catch (error) {
              console.warn('Error parsing date:', dateValue, error);
              return null;
            }
          };

          setFormData((prev) => ({
            ...prev,
            projectSite: productId,
            serviceType: completeJobOrder.joType ? completeJobOrder.joType.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : "",
            remarks: completeJobOrder.remarks || completeJobOrder.jobDescription || "",
            campaignName: completeJobOrder.campaignName || "",
            startDate: parseDateSafely(completeJobOrder.dateRequested),
            endDate: parseDateSafely(completeJobOrder.deadline),
          }))

          // Update the URL to include the jobOrderId for consistency
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('jobOrderId', completeJobOrder.id);
          window.history.replaceState({}, '', newUrl.toString());
        }
      }
    } catch (error) {
      console.error("Error fetching complete job order:", error)
    }

    setIsJobOrderSelectionDialogOpen(false)
  };

  // Handle changing job order
  const handleChangeJobOrder = () => {
    setJobOrderData(null);
    setSelectedJobOrderId(null);
    // Clear the jobOrderId from URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('jobOrderId');
    window.history.replaceState({}, '', newUrl.toString());

    // Reset form fields that were auto-filled from job order
    setFormData(prev => ({
      ...prev,
      serviceType: "",
      remarks: "",
      message: "",
      campaignName: "",
      materialSpecs: "",
      illuminationNits: "",
      startDate: null,
      endDate: null,
      serviceDuration: 0,
      assignedTo: "",
      priority: "",
    }));

    setIsJobOrderSelectionDialogOpen(true);
  };

  if (fetchingProducts) {
    return (
      <div className="container mx-auto py-4">
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-700">Loading products...</span>
        </div>
      </div>
    )
  }

  return (
<section className="p-8 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          disabled={loading || generatingPDF}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">
          {isEditingDraft ? "Edit Service Assignment Draft" : "Create Service Assignment"}
        </h1>
        {(loading || generatingPDF) && (
          <div className="ml-auto flex items-center gap-2 text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              {generatingPDF ? "Generating PDF..." : "Processing..."}
            </span>
          </div>
        )}
      </div>

      {/* Form Card */}
      <CreateServiceAssignmentForm
        onSaveAsDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        loading={loading}
        generatingPDF={generatingPDF}
        companyId={userData?.company_id || null}
        productId={formData.projectSite}
        formData={formData}
        handleInputChange={handleInputChange}
        products={products}
        teams={teams}
        saNumber={saNumber}
        jobOrderData={jobOrderData}
        addExpense={addExpense}
        removeExpense={removeExpense}
        updateExpense={updateExpense}
        calculateTotal={calculateTotal}
        onOpenProductSelection={() => setIsProductSelectionDialogOpen(true)}
        onIdentifyJO={handleIdentifyJO}
        onChangeJobOrder={handleChangeJobOrder}
        onOpenJobOrderDialog={() => setIsJobOrderSelectionDialogOpen(true)}
        onClearJobOrder={() => setJobOrderData(null)}
        onFileUpload={handleFileUpload}
        onRemoveAttachment={removeAttachment}
      />


      {/* Success Dialog */}
      <ServiceAssignmentSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        saNumber={createdSaNumber}
        onViewAssignments={handleViewAssignments}
        onCreateAnother={handleCreateAnother}
      />

      <TeamFormDialog
        open={isNewTeamDialogOpen}
        onOpenChange={setIsNewTeamDialogOpen}
        onSubmit={async (teamData) => {
          try {
            const teamId = await teamsService.createTeam(teamData, "logistics-admin")

            // Create team object for local state
            const newTeam = {
              id: teamId,
              status: "active" as const,
              members: [],
              ...teamData, // Spread teamData first
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: "logistics-admin",
            }

            // Add the new team to the teams list
            setTeams((prev) => [...prev, newTeam])
            // Select the new team in the form
            handleInputChange("crew", newTeam.id)
            handleInputChange("assignedTo", newTeam.id)
            // Close the dialog
            setIsNewTeamDialogOpen(false)
          } catch (error) {
            console.error("Failed to create team:", error)
            // Handle error appropriately
          }
        }}
      />

      <ProductSelectionDialog
        open={isProductSelectionDialogOpen}
        onOpenChange={setIsProductSelectionDialogOpen}
        onSelectProduct={handleProductSelect}
      />

      <JobOrderSelectionDialog
        open={isJobOrderSelectionDialogOpen}
        onOpenChange={setIsJobOrderSelectionDialogOpen}
        productId={formData.projectSite}
        companyId={userData?.company_id || ""}
        onSelectJobOrder={handleJobOrderSelect}
        selectedJobOrderId={selectedJobOrderId}
      />

      <ServiceAssignmentConfirmationDialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
        onConfirm={() => {
          setShowConfirmationDialog(false)
          handleSubmitConfirmed()
        }}
        formData={formData}
        selectedProductName={products.find(p => p.id === formData.projectSite)?.name}
        selectedTeamName={teams.find(t => t.id === (formData.assignedTo || formData.crew))?.name}
        isSubmitting={loading}
      />
    </section>
  )
}
