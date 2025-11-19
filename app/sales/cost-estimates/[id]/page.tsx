"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  getCostEstimate,
  updateCostEstimate,
  getCostEstimatesByPageId,
  getCostEstimatesByClientId, // Import new function
  getCostEstimatesByProductIdAndCompanyId, // Import new function
  updateCostEstimateStatus, // Import updateCostEstimateStatus
  generateAndUploadCostEstimatePDF,
} from "@/lib/cost-estimate-service"
import type {
  CostEstimate,
  CostEstimateClient,
  CostEstimateStatus,
  CostEstimateLineItem,
} from "@/lib/types/cost-estimate"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft,
  DownloadIcon,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  LayoutGrid,
  Pencil,
  Save,
  X,
  Building,
  History,
} from "lucide-react"
import { ProposalActivityTimeline } from "@/components/proposal-activity-timeline"
import { getProposalActivities } from "@/lib/proposal-activity-service"
import type { ProposalActivity } from "@/lib/types/proposal-activity"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { generateCostEstimatePDF, generateSeparateCostEstimatePDFs } from "@/lib/cost-estimate-pdf-service"
import { CostEstimateSentSuccessDialog } from "@/components/cost-estimate-sent-success-dialog" // Ensure this is imported
import { SendCostEstimateOptionsDialog } from "@/components/send-cost-estimate-options-dialog" // Import the new options dialog
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { getUserById, type User } from "@/lib/access-management-service"

interface CompanyData {
  id: string
  name?: string
  company_location?: any
  address?: any
  company_website?: string
  website?: string
  logo?: string
  contact_person?: string
  email?: string
  phone?: string
  social_media?: any
  created_by?: string
  created?: Date
  updated?: Date
}

const formatCompanyAddress = (companyData: CompanyData | null): string => {
  if (!companyData) return ""

  // Model 2: address as object with city, province, street
  if (companyData.address && typeof companyData.address === "object") {
    const { street, city, province } = companyData.address
    const addressParts = [street, city, province].filter(
      (part) => part && part.trim() !== "" && !part.toLowerCase().includes("default"),
    )
    return addressParts.join(", ")
  }

  // Model 3: address as string
  if (companyData.address && typeof companyData.address === "string") {
    return companyData.address
  }

  return ""
}

// Helper function to generate QR code URL
const generateQRCodeUrl = (costEstimateId: string) => {
  const costEstimateViewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cost-estimates/view/${costEstimateId}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(costEstimateViewUrl)}`
}

const formatDurationDisplay = (durationDays: number | null | undefined): string => {
  if (!durationDays || durationDays <= 0) return "—"
  return durationDays === 1 ? "1 day" : `${durationDays} days`
}

// Calculate prorated price based on actual calendar months and days
const calculateProratedPrice = (price: number, startDate: Date, endDate: Date): number => {
  let total = 0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Daily price for this month
    const dailyRate = price / daysInMonth;

    // Determine start and end days for this month
    let startDay = (currentDate.getMonth() === startDate.getMonth() && currentDate.getFullYear() === startDate.getFullYear())
      ? startDate.getDate()
      : 1;

    let endDay = (currentDate.getMonth() === endDate.getMonth() && currentDate.getFullYear() === endDate.getFullYear())
      ? endDate.getDate()
      : daysInMonth;

    // Days counted in this month
    const daysCounted = (endDay - startDay + 1);

    // Add to total
    total += dailyRate * daysCounted;

    // Move to next month
    currentDate = new Date(year, month + 1, 1);
  }

  return total;
}

const getDateObject = (date: any): Date | undefined => {
  if (date === null || date === undefined) return undefined
  if (date instanceof Date) return date
  if (typeof date === "object" && date.toDate && typeof date.toDate === "function") {
    return date.toDate()
  }
  if (typeof date === "string") {
    const parsedDate = new Date(date)
    if (!isNaN(parsedDate.getTime())) return parsedDate
  }
  return undefined
}

const formatDate = (date: any) => {
  if (!date) return "N/A"
  try {
    const dateObj = getDateObject(date)
    if (!dateObj) return "N/A"
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj)
  } catch (error) {
    console.error("Error formatting date:", error)
    return "Invalid Date"
  }
}

const formatDateForInput = (date: any) => {
  if (!date) return ""
  try {
    const dateObj = getDateObject(date)
    if (!dateObj) return ""
    // Format as local date in YYYY-MM-DD format for date input
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (error) {
    console.error("Error formatting date for input:", error)
    return ""
  }
}

export default function CostEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const { id: costEstimateId } = resolvedParams
  const router = useRouter()
  const { user, userData } = useAuth()

  const { toast } = useToast()

  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [editableCostEstimate, setEditableCostEstimate] = useState<CostEstimate | null>(null)
  const [relatedCostEstimates, setRelatedCostEstimates] = useState<CostEstimate[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [activities, setActivities] = useState<ProposalActivity[]>([])
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [isSendEmailDialogOpen, setIsSendEmailDialogOpen] = useState(false)
  const [isSendOptionsDialogOpen, setIsSendOptionsDialogOpen] = useState(false) // New state for options dialog
  const [ccEmail, setCcEmail] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false) // New state for PDF download
  const [showPageSelection, setShowPageSelection] = useState(false)
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [projectData, setProjectData] = useState<{ company_logo?: string; company_name?: string } | null>(null)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [clientHistory, setClientHistory] = useState<CostEstimate[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [pdfPreviewDialogOpen, setPdfPreviewDialogOpen] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CostEstimate | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [loadingPdfPreview, setLoadingPdfPreview] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValues, setTempValues] = useState<{ [key: string]: any }>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [generatingPDFsForSend, setGeneratingPDFsForSend] = useState(false)
  const [userSignatureUrl, setUserSignatureUrl] = useState<string | null>(null)
  const [creatorUser, setCreatorUser] = useState<User | null>(null)

  // Helper function to fetch current user's signature.updated date
  const getCurrentUserSignatureDate = async (): Promise<Date | null> => {
    if (!costEstimate?.createdBy) return null
    try {
      const userDocRef = doc(db, "boohk_users", costEstimate.createdBy)
      const userDoc = await getDoc(userDocRef)
      if (userDoc.exists()) {
        const userData = userDoc.data()
        if (userData.signature && typeof userData.signature === 'object' && userData.signature.updated) {
          return userData.signature.updated.toDate ? userData.signature.updated.toDate() : new Date(userData.signature.updated)
        }
      }
      return null
    } catch (error) {
      console.error('Error fetching current user signature date:', error)
      return null
    }
  }

  const groupLineItemsBySite = (lineItems: CostEstimateLineItem[]) => {

    const siteGroups: { [siteName: string]: CostEstimateLineItem[] } = {}

    // Group line items by site based on the site rental items
    lineItems.forEach((item) => {
      if (item.category.includes("Billboard Rental")) {
        // This is a site rental item - use its description as the site name
        const siteName = item.description
        if (!siteGroups[siteName]) {
          siteGroups[siteName] = []
        }
        siteGroups[siteName].push(item)

        // Find related production, installation, and maintenance items for this site
        const siteId = item.id
        const relatedItems = lineItems.filter(
          (relatedItem) => relatedItem.id.includes(siteId) && relatedItem.id !== siteId,
        )
        siteGroups[siteName].push(...relatedItems)
      }
    })

    if (Object.keys(siteGroups).length === 0) {
      siteGroups["Single Site"] = lineItems
    } else {
      // Check for orphaned items (items not associated with any site)
      const groupedItemIds = new Set()
      Object.values(siteGroups).forEach((items) => {
        items.forEach((item) => groupedItemIds.add(item.id))
      })

      const orphanedItems = lineItems.filter((item) => !groupedItemIds.has(item.id))
      if (orphanedItems.length > 0) {
        const siteNames = Object.keys(siteGroups)
        siteNames.forEach((siteName) => {
          // Create copies of orphaned items for each site to avoid reference issues
          const orphanedCopies = orphanedItems.map((item) => ({ ...item }))
          siteGroups[siteName].push(...orphanedCopies)
        })
      }
    }

    return siteGroups
  }

  // Memoize siteGroups to ensure it updates when costEstimate.lineItems changes
  const siteGroups = React.useMemo(() => groupLineItemsBySite(costEstimate?.lineItems || []), [costEstimate?.lineItems])
  const siteNames = Object.keys(siteGroups)
  const hasMultipleSites = siteNames.length > 1
  const totalPages = hasMultipleSites ? siteNames.length : 1

  useEffect(() => {
    console.log("[v0] Save button visibility check:", {
      isEditing,
      hasUnsavedChanges,
      tempValuesCount: Object.keys(tempValues).length,
      tempValues,
    })
  }, [isEditing, hasUnsavedChanges, tempValues])

  const handleFieldEdit = (fieldName: string, currentValue: any) => {
    setEditingField(fieldName)

    if (fieldName === "contractPeriod") {
      // For contract period, set individual date fields with defaults if not available
      const startDate = getDateObject(currentValue.startDate) || new Date()
      const endDate = getDateObject(currentValue.endDate) || new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000)) // Default to 30 days later

      setTempValues({
        ...tempValues,
        startDate: startDate,
        endDate: endDate
      })
    } else {
      setTempValues({ ...tempValues, [fieldName]: currentValue })
    }

    setHasUnsavedChanges(true)
  }

  const updateTempValues = (fieldName: string, newValue: any) => {
    const updatedTempValues = { ...tempValues, [fieldName]: newValue }

    // Bidirectional sync: duration days <-> contract period
    if (fieldName === "durationDays" && costEstimate?.startDate) {
      // When duration changes, update end date
      const newEndDate = new Date(costEstimate.startDate)
      newEndDate.setDate(newEndDate.getDate() + newValue)
      updatedTempValues.endDate = newEndDate
    } else if (fieldName === "startDate" || fieldName === "endDate") {
      // When dates change, update duration
      const startDate = fieldName === "startDate" ? newValue : tempValues.startDate || costEstimate?.startDate
      const endDate = fieldName === "endDate" ? newValue : tempValues.endDate || costEstimate?.endDate

      if (startDate && endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
        const newDurationDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
        updatedTempValues.durationDays = newDurationDays
      }
    }

    setTempValues(updatedTempValues)
    setHasUnsavedChanges(true)
  }

  const handleSaveAllChanges = async () => {
    setIsSaving(true)
    try {
      console.log("[v0] handleSaveAllChanges called")
      console.log("[v0] Current state:", {
        isEditing,
        editableCostEstimate: !!costEstimate,
        tempValuesCount: Object.keys(tempValues).length,
        tempValues,
        currentProductIndex,
      })

      if (!costEstimate) {
        toast({
          title: "Error",
          description: "No cost estimate data available",
          variant: "destructive",
        })
        return
      }

      if (!isEditing) {
        console.log("[v0] Not in edit mode, cannot save changes")
        toast({
          title: "Error",
          description: "Please enter edit mode to save changes",
          variant: "destructive",
        })
        return
      }

      if (Object.keys(tempValues).length === 0) {
        console.log("[v0] No temp values to save, returning")
        toast({
          title: "No Changes",
          description: "No changes to save",
          variant: "destructive",
        })
        return
      }

      // Create a deep copy of the cost estimate to ensure React detects changes
      const updatedCostEstimate = JSON.parse(JSON.stringify(costEstimate))

      const siteGroups = groupLineItemsBySite(updatedCostEstimate.lineItems || [])
      const siteNames = Object.keys(siteGroups)
      const currentSiteName = siteNames[currentProductIndex]
      const currentSiteItems = siteGroups[currentSiteName] || []

      console.log("[v0] Editing site:", currentSiteName, "with items:", currentSiteItems.length)

      const currentSiteRentalItem = currentSiteItems.find((item) => item.category.includes("Billboard Rental"))
      const currentSiteId = currentSiteRentalItem?.id

      // Apply all temp values to the cost estimate - but only for current site
      Object.entries(tempValues).forEach(([fieldName, newValue]) => {
        switch (fieldName) {
          case "terms_and_conditions":
            updatedCostEstimate.template = {
              ...(updatedCostEstimate.template || {}),
              terms_and_conditions: newValue,
            }
            break
          case "salutation":
            updatedCostEstimate.template = {
              ...(updatedCostEstimate.template || {}),
              salutation: newValue,
            }
            break
          case "greeting":
            updatedCostEstimate.template = {
              ...(updatedCostEstimate.template || {}),
              greeting: newValue,
            }
            break
          case "signature_position":
            updatedCostEstimate.signature_position = newValue
            break
          case "closing_message":
            updatedCostEstimate.template = {
              ...updatedCostEstimate.template,
              closing_message: newValue,
            }
            break
          case "site_notes":
            updatedCostEstimate.items = {
              ...updatedCostEstimate.items,
              site_notes: newValue,
            }
            break
          case "price_notes":
            updatedCostEstimate.items = {
              ...updatedCostEstimate.items,
              price_notes: newValue,
            }
            break
          case "unitPrice":
            const updatedLineItems = updatedCostEstimate.lineItems.map((item) => {
              const belongsToCurrentSite = currentSiteItems.some((siteItem) => siteItem.id === item.id)
              if (belongsToCurrentSite && item.category.includes("Billboard Rental")) {
                const newTotal = updatedCostEstimate.startDate && updatedCostEstimate.endDate
                  ? calculateProratedPrice(newValue, updatedCostEstimate.startDate, updatedCostEstimate.endDate)
                  : newValue * (updatedCostEstimate.durationDays ? updatedCostEstimate.durationDays / 30 : 1)
                console.log("[v0] Updating price for item:", item.id, "from", item.unitPrice, "to", newValue)
                return { ...item, unitPrice: newValue, total: newTotal }
              }
              return item
            })
            updatedCostEstimate.lineItems = updatedLineItems
            updatedCostEstimate.totalAmount = updatedLineItems.reduce((sum, item) => sum + item.total, 0)
            break

          case "durationDays":
            updatedCostEstimate.durationDays = newValue
            const recalculatedItems = updatedCostEstimate.lineItems.map((item) => {
              const belongsToCurrentSite = currentSiteItems.some((siteItem) => siteItem.id === item.id)
              if (belongsToCurrentSite && item.category.includes("Billboard Rental")) {
                const newTotal = updatedCostEstimate.startDate && updatedCostEstimate.endDate
                  ? calculateProratedPrice(item.unitPrice, updatedCostEstimate.startDate, updatedCostEstimate.endDate)
                  : item.unitPrice * (newValue / 30)
                console.log("[v0] Updating duration for item:", item.id, "new total:", newTotal)
                return { ...item, total: newTotal }
              }
              return item
            })
            updatedCostEstimate.lineItems = recalculatedItems
            updatedCostEstimate.totalAmount = recalculatedItems.reduce((sum, item) => sum + item.total, 0)

            if (updatedCostEstimate.startDate) {
              const newEndDate = new Date(updatedCostEstimate.startDate)
              newEndDate.setDate(newEndDate.getDate() + newValue - 1) // -1 because duration is inclusive
              updatedCostEstimate.endDate = newEndDate
            }
            break


          case "startDate":
          case "endDate":
            updatedCostEstimate[fieldName] = newValue
            if (updatedCostEstimate.startDate && updatedCostEstimate.endDate) {
              const diffTime = Math.abs(new Date(updatedCostEstimate.endDate).getTime() - new Date(updatedCostEstimate.startDate).getTime())
              const newDurationDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
              updatedCostEstimate.durationDays = newDurationDays

              const durationUpdatedItems = updatedCostEstimate.lineItems.map((item) => {
                const belongsToCurrentSite = currentSiteItems.some((siteItem) => siteItem.id === item.id)
                if (belongsToCurrentSite && item.category.includes("Billboard Rental")) {
                  const newTotal = calculateProratedPrice(item.unitPrice, updatedCostEstimate.startDate, updatedCostEstimate.endDate)
                  console.log("[v0] Updating date-based duration for item:", item.id, "new total:", newTotal)
                  return { ...item, total: newTotal }
                }
                return item
              })
              updatedCostEstimate.lineItems = durationUpdatedItems
              updatedCostEstimate.totalAmount = durationUpdatedItems.reduce((sum, item) => sum + item.total, 0)
            }
            break

          case "closing_message":
            updatedCostEstimate.template = {
              ...(updatedCostEstimate.template || {}),
              closing_message: newValue,
            }
            break

          case "height":
          case "width":
            // Update the specs of the billboard rental item for the current site only
            // Find the billboard rental item that belongs to the current site
            const billboardItemToUpdate = updatedCostEstimate.lineItems.find((item) => {
              if (!item.category.includes("Billboard Rental")) return false

              // Check if this item belongs to the current site by checking if it exists in currentSiteItems
              return currentSiteItems.some((siteItem) => siteItem.id === item.id)
            })

            if (billboardItemToUpdate) {
              if (!billboardItemToUpdate.specs) {
                billboardItemToUpdate.specs = {}
              }
              if (fieldName === "height") {
                billboardItemToUpdate.specs.height = newValue
                console.log(`[v0] Updated height to ${newValue} for item:`, billboardItemToUpdate.id)
              } else if (fieldName === "width") {
                billboardItemToUpdate.specs.width = newValue
                console.log(`[v0] Updated width to ${newValue} for item:`, billboardItemToUpdate.id)
              }
            } else {
              console.log(`[v0] Could not find billboard item to update for field: ${fieldName}`)
            }
            break
        }
      })

      // Remove the id field from update data as it's not needed for Firestore update
      const { id, ...updateDataWithoutId } = updatedCostEstimate

      // Clean the data to remove undefined values before sending to Firestore
      const cleanData = (obj: any): any => {
        if (obj === null || obj === undefined) return obj
        if (typeof obj !== 'object') return obj
        if (obj instanceof Date) return obj // Preserve Date objects
        if (Array.isArray(obj)) return obj.map(cleanData)

        const cleaned: any = {}
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = cleanData(value)
          }
        }
        return cleaned
      }

      const cleanedUpdateData = cleanData(updateDataWithoutId)

      await updateCostEstimate(updatedCostEstimate.id, cleanedUpdateData)

      // Generate new PDF after saving the cost estimate data
      console.log("[v0] Generating new PDF after saving changes")

      // Prepare logo data URL if company logo exists
      let logoDataUrl: string | null = null
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
          // Continue without logo if fetch fails
        }
      }

      // Prepare signature data URL if user signature exists
      let userSignatureDataUrl: string | null = null
      if (userSignatureUrl) {
        try {
          const signatureResponse = await fetch(userSignatureUrl)
          if (signatureResponse.ok) {
            const signatureBlob = await signatureResponse.blob()
            userSignatureDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(signatureBlob)
            })
          }
        } catch (error) {
          console.error('Error fetching user signature:', error)
          // Continue without signature if fetch fails
        }
      }

      // Fetch signature date directly if not available from creatorUser
      let signatureDate: Date | null = null
      if (updatedCostEstimate.createdBy) {
        try {
          const userDocRef = doc(db, "boohk_users", updatedCostEstimate.createdBy)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('Error fetching signature date:', error)
        }
      }

      const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(updatedCostEstimate, creatorUser ? {
        first_name: creatorUser.first_name || undefined,
        last_name: creatorUser.last_name || undefined,
        email: creatorUser.email || undefined,
        company_id: creatorUser.company_id || undefined,
      } : undefined, companyData ? {
        name: companyData.name || "Company Name",
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
        website: companyData.website || companyData.company_website,
      } : undefined, userSignatureDataUrl)

      // Update cost estimate with new PDF URL, password, and signature date
      await updateCostEstimate(updatedCostEstimate.id, {
        pdf: pdfUrl,
        password: password,
        signature_date: signatureDate
      })

      // Update state with the new data including PDF
      const finalCostEstimate = { ...updatedCostEstimate, pdf: pdfUrl, password: password }
      setEditableCostEstimate(finalCostEstimate)
      setCostEstimate(finalCostEstimate)

      // Force a re-render by updating the key or triggering a state change
      setEditingField(null)
      setTempValues({})
      setHasUnsavedChanges(false)
      setIsEditing(false) // Added missing setIsEditing(false) to disable edit mode

      toast({
        title: "Success",
        description: `Changes saved successfully for ${currentSiteName}`,
      })

      // Refresh data from server
      const refreshedCostEstimate = await getCostEstimate(costEstimateId)
      if (refreshedCostEstimate) {
        setCostEstimate(refreshedCostEstimate)
        setEditableCostEstimate(refreshedCostEstimate)
        // Refresh related cost estimates if needed
        if (refreshedCostEstimate.page_id) {
          const relatedCEs = await getCostEstimatesByPageId(refreshedCostEstimate.page_id)
          setRelatedCostEstimates(relatedCEs)
          const currentIndex = relatedCEs.findIndex((rce) => rce.id === refreshedCostEstimate.id)
          setCurrentPageIndex(currentIndex >= 0 ? currentIndex : 0)
        }
      }

      console.log("[v0] Save completed successfully for site:", currentSiteName)
      console.log("[v0] Updated cost estimate:", finalCostEstimate)
    } catch (error) {
      console.error("[v0] Save failed:", error)
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelAllChanges = () => {
    setTempValues({})
    setHasUnsavedChanges(false)
    setIsEditing(false)
    toast({
      title: "Cancelled",
      description: "Changes cancelled",
    })
  }

  const fetchCompanyData = async () => {
    if (!user?.uid || !userData) return

    try {
      let companyDoc = null
      let companyDataResult = null

      // First, try to find company by company_id if it exists in userData
      if (userData?.company_id) {
        try {
          const companyDocRef = doc(db, "companies", userData.company_id)
          const companyDocSnap = await getDoc(companyDocRef)

          if (companyDocSnap.exists()) {
            companyDoc = companyDocSnap
            companyDataResult = companyDocSnap.data()
          }
        } catch (error) {
          console.error("Error fetching company by company_id:", error)
        }
      }

      // If no company found by company_id, try other methods
      if (!companyDoc) {
        // Try to find company by created_by field
        let companiesQuery = query(collection(db, "companies"), where("created_by", "==", user.uid))
        let companiesSnapshot = await getDocs(companiesQuery)

        // If no company found by created_by, try to find by email or other identifiers
        if (companiesSnapshot.empty && user.email) {
          companiesQuery = query(collection(db, "companies"), where("email", "==", user.email))
          companiesSnapshot = await getDocs(companiesQuery)
        }

        // If still no company found, try to find by contact_person email
        if (companiesSnapshot.empty && user.email) {
          companiesQuery = query(collection(db, "companies"), where("contact_person", "==", user.email))
          companiesSnapshot = await getDocs(companiesQuery)
        }

        if (!companiesSnapshot.empty) {
          companyDoc = companiesSnapshot.docs[0]
          companyDataResult = companyDoc.data()
        }
      }

      if (companyDoc && companyDataResult) {
        const company: CompanyData = {
          id: companyDoc.id,
          name: companyDataResult.name,
          company_location: companyDataResult.company_location || companyDataResult.address,
          address: companyDataResult.address,
          company_website: companyDataResult.company_website || companyDataResult.website,
          logo: companyDataResult.logo,
          contact_person: companyDataResult.contact_person,
          email: companyDataResult.email,
          phone: companyDataResult.phone,
          social_media: companyDataResult.social_media || {},
          created_by: companyDataResult.created_by,
          created: companyDataResult.created?.toDate
            ? companyDataResult.created.toDate()
            : companyDataResult.created_at?.toDate(),
          updated: companyDataResult.updated?.toDate
            ? companyDataResult.updated.toDate()
            : companyDataResult.updated_at?.toDate(),
        }

        setCompanyData(company)
      } else {
        setCompanyData(null)
      }
    } catch (error) {
      console.error("Error fetching company data:", error)
    }
  }

  const fetchClientHistory = useCallback(async () => {
    if (!costEstimate?.lineItems?.[0]?.id || !costEstimate?.company_id || !costEstimate?.id) return

    setLoadingHistory(true)
    try {
      const productId = costEstimate.lineItems[0].id
      const companyId = costEstimate.company_id
      const history = await getCostEstimatesByProductIdAndCompanyId(productId, companyId, costEstimate.id)
      setClientHistory(history)
    } catch (error) {
      console.error("Error fetching client history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }, [costEstimate?.lineItems?.[0]?.id, costEstimate?.company_id, costEstimate?.id])

  useEffect(() => {
    const fetchCostEstimateData = async () => {
      if (!costEstimateId) return

      setLoading(true)
      try {
        const ce = await getCostEstimate(costEstimateId)
        if (ce) {
          setCostEstimate(ce)
          setEditableCostEstimate(ce)

          console.log("[v0] Current cost estimate page_id:", ce.page_id)

          if (ce.page_id) {
            const relatedCEs = await getCostEstimatesByPageId(ce.page_id)
            console.log("[v0] Related cost estimates found:", relatedCEs.length, relatedCEs)
            setRelatedCostEstimates(relatedCEs)
            // Find current page index
            const currentIndex = relatedCEs.findIndex((rce) => rce.id === ce.id)
            console.log("[v0] Current page index:", currentIndex)
            setCurrentPageIndex(currentIndex >= 0 ? currentIndex : 0)
          } else {
            console.log("[v0] No page_id found for this cost estimate")
          }

          const ceActivities = await getProposalActivities(costEstimateId)
          setActivities(ceActivities)

        } else {
          toast({
            title: "Cost Estimate Not Found",
            description: "The cost estimate you're looking for doesn't exist.",
            variant: "destructive",
          })
          router.push("/sales/cost-estimates")
        }
      } catch (error) {
        console.error("Error fetching cost estimate:", error)
        toast({
          title: "Error",
          description: "Failed to load cost estimate. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCostEstimateData()
  }, [costEstimateId, router, toast])

  useEffect(() => {
    if (user && userData) {
      fetchCompanyData()
    }
  }, [user, userData])

  useEffect(() => {
    if (costEstimate?.lineItems?.[0]?.id) {
      fetchClientHistory()
    }
  }, [fetchClientHistory])

  // Fetch user signature

  useEffect(() => {
    const fetchCreatorUser = async () => {
      if (!costEstimate?.createdBy) return

      try {
        const creator = await getUserById(costEstimate.createdBy)
        setCreatorUser(creator)
        console.log("Fetched creator user:", creator)
        setUserSignatureUrl(creator?.signature.url || null)
      } catch (error) {
        console.error("Error fetching creator user:", error)
      }
    }

    fetchCreatorUser()
  }, [costEstimate?.createdBy])

  // Handle automatic share when page loads with action parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const action = searchParams.get("action")

    if (action === "share" && costEstimate && !loading) {
      // Small delay to ensure the cost estimate is fully rendered
      setTimeout(() => {
        setIsSendOptionsDialogOpen(true)
        // Clean up the URL parameter
        const url = new URL(window.location.href)
        url.searchParams.delete("action")
        window.history.replaceState({}, "", url.toString())
      }, 1000)
    }
  }, [costEstimate, loading])

  useEffect(() => {
    const fetchProjectData = async () => {
      // Simulate fetching project data
      setProjectData({
        company_logo: "/path/to/company-logo.svg",
        company_name: "Boohk Outdoor Advertising",
      })
    }

    fetchProjectData()
  }, [])

  useEffect(() => {
    if (isSendEmailDialogOpen && costEstimate) {
      setEmailSubject(`Cost Estimate: ${costEstimate.lineItems[0].description || "Custom Cost Estimate"}`)
      setEmailBody(
        `Dear ${costEstimate.client?.contactPerson || costEstimate.client?.company || "Valued Client"},\n\nWe are pleased to provide you with a detailed cost estimate for your advertising campaign. Please find the full cost estimate attached and accessible via the link below.\n\nThank you for considering Boohk for your advertising needs. We look forward to working with you to bring your campaign to life!\n\nBest regards,\nThe Boohk Team`,
      )
      // CC field is intentionally left empty (no auto-fill)
      setCcEmail("")
    }
  }, [isSendEmailDialogOpen, costEstimate])

  const handleSendEmail = async () => {
    if (!costEstimate) return

    // Ensure PDF is generated and saved before sending
    try {
      await generatePDFIfNeeded(costEstimate)
      router.push(`/sales/cost-estimates/${costEstimateId}/compose-email`)
    } catch (error) {
      // Error is already handled in generatePDFIfNeeded
    }
  }

  const handleSendWithPDFGeneration = async () => {
    if (!costEstimate) return

    console.log("=== DEBUG SEND BUTTON ===")
    console.log("Current costEstimate.pdf:", costEstimate?.pdf, "Type:", typeof costEstimate?.pdf)

    // Check if current cost estimate has PDF and signature dates match
    if (costEstimate.pdf) {
      const currentSignatureDate = await getCurrentUserSignatureDate()
      const storedSignatureDate = costEstimate.signature_date

      let needsRegeneration = false

      if (currentSignatureDate && storedSignatureDate) {
        const currentDate = new Date(currentSignatureDate).getTime()
        const storedDate = new Date(storedSignatureDate).getTime()

        if (currentDate !== storedDate) {
          console.log('[COST_ESTIMATE_SEND] Signature dates do not match, regenerating PDF')
          needsRegeneration = true
        } else {
          console.log('[COST_ESTIMATE_SEND] Signature dates match, using existing PDF')
        }
      } else {
        console.log('[COST_ESTIMATE_SEND] Missing signature date info, regenerating PDF')
        needsRegeneration = true
      }

      if (!needsRegeneration) {
        console.log("✅ Skipping PDF generation - signature dates match")
        setIsSendOptionsDialogOpen(true)
        return
      }
    }

    console.log("⚠️ Generating PDFs...")

    setGeneratingPDFsForSend(true)
    try {
      let generatedCount = 0
      // Generate PDFs for all related cost estimates
      if (relatedCostEstimates.length > 1) {
        // Generate and update PDFs for all related cost estimates
        const updatedRelatedEstimates = [...relatedCostEstimates]
        for (let i = 0; i < relatedCostEstimates.length; i++) {
          const estimate = relatedCostEstimates[i]

          // Check if PDF already exists and signature dates match
          let needsRegeneration = !estimate.pdf
          if (estimate.pdf) {
            const currentSignatureDate = await getCurrentUserSignatureDate()
            const storedSignatureDate = estimate.signature_date

            if (currentSignatureDate && storedSignatureDate) {
              const currentDate = new Date(currentSignatureDate).getTime()
              const storedDate = new Date(storedSignatureDate).getTime()
              needsRegeneration = currentDate !== storedDate
            } else {
              needsRegeneration = true
            }
          }

          if (needsRegeneration) {
            // Prepare signature data URL if user signature exists
            let userSignatureDataUrl: string | null = null
            if (userSignatureUrl) {
              try {
                const signatureResponse = await fetch(userSignatureUrl)
                if (signatureResponse.ok) {
                  const signatureBlob = await signatureResponse.blob()
                  userSignatureDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result as string)
                    reader.readAsDataURL(signatureBlob)
                  })
                }
              } catch (error) {
                console.error('Error fetching user signature:', error)
                // Continue without signature if fetch fails
              }
            }

            // Fetch signature date directly if not available from creatorUser
            let signatureDate: Date | null = null
            if (estimate.createdBy) {
              try {
                const userDocRef = doc(db, "boohk_users", estimate.createdBy)
                const userDoc = await getDoc(userDocRef)

                if (userDoc.exists()) {
                  const userDataFetched = userDoc.data()
                  if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                    signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
                  }
                }
              } catch (error) {
                console.error('Error fetching signature date:', error)
              }
            }

            // Generate PDF and get URL/password
            const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(estimate, userData ? {
              first_name: userData.first_name || undefined,
              last_name: userData.last_name || undefined,
              email: userData.email || undefined,
              company_id: userData.company_id || undefined,
            } : undefined, companyData ? {
              name: companyData.name || "Company Name",
              address: companyData.address,
              phone: companyData.phone,
              email: companyData.email,
              website: companyData.website || companyData.company_website,
            } : undefined, userSignatureDataUrl)

            // Update the cost estimate with PDF URL and password
            await updateCostEstimate(estimate.id, { pdf: pdfUrl, password: password, signature_date: signatureDate })
            // Update the local state
            updatedRelatedEstimates[i] = { ...estimate, pdf: pdfUrl, password: password }
            generatedCount++
          }
        }
        setRelatedCostEstimates(updatedRelatedEstimates)
      } else {
        // Single cost estimate - check if PDF exists and signature dates match
        let needsRegeneration = !costEstimate.pdf
        if (costEstimate.pdf) {
          const currentSignatureDate = await getCurrentUserSignatureDate()
          const storedSignatureDate = costEstimate.signature_date

          if (currentSignatureDate && storedSignatureDate) {
            const currentDate = new Date(currentSignatureDate).getTime()
            const storedDate = new Date(storedSignatureDate).getTime()
            needsRegeneration = currentDate !== storedDate
          } else {
            needsRegeneration = true
          }
        }

        if (needsRegeneration) {
          await generatePDFIfNeeded(costEstimate)
          generatedCount++
        }
      }

      // After PDFs are generated, open the send options dialog
      setIsSendOptionsDialogOpen(true)
    } catch (error) {
      console.error("Error generating PDFs for send:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDFs. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingPDFsForSend(false)
    }
  }

  const handleSendEmailConfirm = async () => {
    if (!costEstimate || !user?.uid) return

    if (!costEstimate.client?.email) {
      toast({
        title: "Missing Client Email",
        description: "Cannot send email: Client email address is not available.",
        variant: "destructive",
      })
      return
    }

    const ccEmailsArray = ccEmail
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+\$/
    for (const email of ccEmailsArray) {
      if (!emailRegex.test(email)) {
        toast({
          title: "Invalid CC Email",
          description: `Please enter a valid email address for CC: ${email}`,
          variant: "destructive",
        })
        return
      }
    }

    setSendingEmail(true)
    try {
      const response = await fetch("/api/cost-estimates/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          costEstimate: costEstimate,
          clientEmail: costEstimate.client.email,
          client: costEstimate.client,
          currentUserEmail: user.email, // This is the reply-to
          ccEmail: ccEmail,
          subject: emailSubject, // Pass subject
          body: emailBody, // Pass body
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to send email")
      }

      await updateCostEstimateStatus(costEstimate.id, "sent")
      setCostEstimate((prev) => (prev ? { ...prev, status: "sent" } : null))
      setEditableCostEstimate((prev) => (prev ? { ...prev, status: "sent" } : null))
      setIsSendEmailDialogOpen(false) // Close the send dialog
      setShowSuccessDialog(true) // Show the success dialog
      setCcEmail("") // Clear CC field
      // No toast here, success dialog will handle it
      const updatedActivities = await getProposalActivities(costEstimate.id)
      setActivities(updatedActivities)
    } catch (error) {
      console.error("Error sending email:", error)
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSuccessDialogDismissAndNavigate = () => {
    setShowSuccessDialog(false) // Hide the success dialog
    router.push("/sales/dashboard") // Navigate to sales dashboard
  }

  const handleUpdatePublicStatus = async (status: CostEstimateStatus) => {
    if (!costEstimate || !user?.uid) return

    setUpdatingStatus(true)
    try {
      const response = await fetch("/api/cost-estimates/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          costEstimateId: costEstimate.id,
          status: status,
          userId: user.uid,
          rejectionReason: status === "declined" ? "Client declined" : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to update status")
      }

      await updateCostEstimateStatus(costEstimate.id, status)
      setCostEstimate((prev) => (prev ? { ...prev, status: status } : null))
      setEditableCostEstimate((prev) => (prev ? { ...prev, status: status } : null))
      toast({
        title: "Status Updated",
        description: `Cost estimate status changed to ${status}.`,
      })
      const updatedActivities = await getProposalActivities(costEstimate.id)
      setActivities(updatedActivities)
    } catch (error) {
      console.error("Error updating public status:", error)
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const generatePDFIfNeeded = async (costEstimate: CostEstimate) => {
    // Check if PDF exists and signature dates match
    if (costEstimate.pdf) {
      const currentSignatureDate = await getCurrentUserSignatureDate()
      const storedSignatureDate = costEstimate.signature_date

      if (currentSignatureDate && storedSignatureDate) {
        const currentDate = new Date(currentSignatureDate).getTime()
        const storedDate = new Date(storedSignatureDate).getTime()

        if (currentDate === storedDate) {
          console.log('[PDF_GENERATE] Signature dates match, using existing PDF')
          return { pdfUrl: costEstimate.pdf, password: costEstimate.password }
        } else {
          console.log('[PDF_GENERATE] Signature dates do not match, regenerating PDF')
        }
      } else {
        console.log('[PDF_GENERATE] Missing signature date info, regenerating PDF')
      }
    }

    try {
      // Prepare signature data URL if user signature exists
      let userSignatureDataUrl: string | null = null
      if (userSignatureUrl) {
        try {
          const signatureResponse = await fetch(userSignatureUrl)
          if (signatureResponse.ok) {
            const signatureBlob = await signatureResponse.blob()
            userSignatureDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(signatureBlob)
            })
          }
        } catch (error) {
          console.error('Error fetching user signature:', error)
          // Continue without signature if fetch fails
        }
      }

      // Fetch signature date directly if not available from creatorUser
      let signatureDate: Date | null = null
      if (costEstimate.createdBy) {
        try {
          const userDocRef = doc(db, "boohk_users", costEstimate.createdBy)
          const userDoc = await getDoc(userDocRef)

          if (userDoc.exists()) {
            const userDataFetched = userDoc.data()
            if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
              signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
            }
          }
        } catch (error) {
          console.error('Error fetching signature date:', error)
        }
      }

      const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(costEstimate, creatorUser ? {
        first_name: creatorUser.first_name || undefined,
        last_name: creatorUser.last_name || undefined,
        email: creatorUser.email || undefined,
        company_id: creatorUser.company_id || undefined,
      } : undefined, companyData ? {
        name: companyData.name || "Company Name",
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
        website: companyData.website || companyData.company_website,
      } : undefined, userSignatureDataUrl)
      await updateCostEstimate(costEstimate.id, { pdf: pdfUrl, password: password, signature_date: signatureDate })
      setCostEstimate(prev => prev ? { ...prev, pdf: pdfUrl, password: password } : null)
      // Also update the relatedCostEstimates if this estimate is in there
      setRelatedCostEstimates(prev => prev.map(est =>
        est.id === costEstimate.id ? { ...est, pdf: pdfUrl, password: password } : est
      ))
      console.log("Cost estimate PDF generated and uploaded successfully:", pdfUrl)
      return { pdfUrl, password }
    } catch (error) {
      console.error("Error generating cost estimate PDF:", error)
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" })
      throw error
    }
  }

  const handleDownloadPDF = async () => {
    if (!costEstimate) return

    console.log('[PDF_DOWNLOAD] Starting PDF download process for cost estimate:', costEstimate.id)
    setDownloadingPDF(true)
    try {
      // Check if there are multiple related cost estimates
      const estimatesToDownload = relatedCostEstimates.length > 1 ? relatedCostEstimates : [costEstimate]

      console.log('[PDF_DOWNLOAD] Downloading PDFs for', estimatesToDownload.length, 'cost estimate(s)')

      for (let i = 0; i < estimatesToDownload.length; i++) {
        const estimate = estimatesToDownload[i]

        // Fetch fresh cost estimate data from database to check current PDF field
        console.log(`[PDF_DOWNLOAD] Fetching fresh cost estimate data for ${estimate.id}...`)
        const freshCostEstimate = await getCostEstimate(estimate.id)
        if (!freshCostEstimate) {
          throw new Error(`Cost estimate ${estimate.id} not found`)
        }

        // Check if PDF field has value
        let pdfUrl = freshCostEstimate.pdf
        let wasExisting = !!pdfUrl
        if (pdfUrl) {
          // If PDF exists, check signature dates
          const currentSignatureDate = await getCurrentUserSignatureDate()
          const storedSignatureDate = freshCostEstimate.signature_date

          if (currentSignatureDate && storedSignatureDate) {
            const currentDate = new Date(currentSignatureDate).getTime()
            const storedDate = new Date(storedSignatureDate).getTime()

            if (currentDate !== storedDate) {
              console.log('[PDF_DOWNLOAD] Signature dates do not match, regenerating PDF')
              const result = await generatePDFIfNeeded(freshCostEstimate)
              pdfUrl = result.pdfUrl
              wasExisting = false
            } else {
              console.log('[PDF_DOWNLOAD] Signature dates match, using existing PDF')
            }
          } else {
            console.log('[PDF_DOWNLOAD] Missing signature date info, regenerating PDF')
            const result = await generatePDFIfNeeded(freshCostEstimate)
            pdfUrl = result.pdfUrl
            wasExisting = false
          }
        } else {
          // Generate PDF if field is null or doesn't exist
          const result = await generatePDFIfNeeded(freshCostEstimate)
          pdfUrl = result.pdfUrl
          wasExisting = false
        }

        if (!pdfUrl) {
          console.error('[PDF_DOWNLOAD] No PDF URL available after generation')
          throw new Error("Failed to generate PDF")
        }

        console.log('[PDF_DOWNLOAD] PDF URL available:', pdfUrl, 'existing:', wasExisting)

        // Download the PDF
        const response = await fetch(pdfUrl)
        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${freshCostEstimate.costEstimateNumber || freshCostEstimate.id || 'cost-estimate'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.open(url, '_blank')

        // Revoke blob URL after a short delay (to keep tab valid)
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
        }, 2000)

        // Add a small delay between downloads to ensure proper file naming
        if (i < estimatesToDownload.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      console.log('[PDF_DOWNLOAD] PDF download initiated successfully')

      toast({
        title: "Success",
        description: `PDF${estimatesToDownload.length > 1 ? 's' : ''} downloaded successfully`,
      })
    } catch (error) {
      console.error("[PDF_DOWNLOAD] Error in PDF download process:", error)
      toast({
        title: "Error",
        description: `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handlePageToggle = (pageIndex: number) => {
    const siteGroups = groupLineItemsBySite(costEstimate?.lineItems || [])
    const sites = Object.keys(siteGroups)
    const siteName = sites[pageIndex]

    setSelectedPages((prev) => (prev.includes(siteName) ? prev.filter((p) => p !== siteName) : [...prev, siteName]))
  }

  const handleSelectAllPages = () => {
    if (!costEstimate) return

    const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
    const sites = Object.keys(siteGroups)

    if (selectedPages.length === sites.length) {
      setSelectedPages([])
    } else {
      setSelectedPages([...sites])
    }
  }

  const handleDownloadSelectedPages = async () => {
    if (!costEstimate || selectedPages.length === 0) return

    setDownloadingPDF(true)
    try {
      await generateCostEstimatePDF(costEstimate, selectedPages, false, undefined, creatorUser ? {
        first_name: creatorUser.first_name || undefined,
        last_name: creatorUser.last_name || undefined,
        email: creatorUser.email || undefined,
        company_id: creatorUser.company_id || undefined,
      } : undefined)
      toast({
        title: "PDF Generated",
        description: `Cost estimate PDF with ${selectedPages.length} page(s) has been downloaded.`,
      })
      setShowPageSelection(false)
      setSelectedPages([])
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDownloadingPDF(false)
    }
  }

  const handleEditClick = () => {
    if (costEstimate) {
      setEditableCostEstimate({ ...costEstimate })
      setTempValues({
        terms_and_conditions: costEstimate?.template?.terms_and_conditions || [
          "Cost Estimate validity: 5 working days.",
          "Site availability: First-come-first-served basis. Official documents required.",
          "Payment terms: One month advance and two months security deposit.",
          "Payment deadline: 7 days before rental start.",
        ],
        greeting: costEstimate?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`,
        unitPrice: costEstimate.lineItems.find(item => item.category.includes("Billboard Rental"))?.unitPrice,
        durationDays: costEstimate.durationDays,
        startDate: costEstimate.startDate,
        endDate: costEstimate.endDate,
        salutation: costEstimate.template?.salutation,
        site_notes: costEstimate.items?.site_notes,
        price_notes: costEstimate.items?.price_notes,
        signature_position: costEstimate.signature_position,
        closing_message: costEstimate.template?.closing_message,
      }) // Set all current values to preserve edits
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setEditableCostEstimate(costEstimate)
    setIsEditing(false)
    setTempValues({})
    setHasUnsavedChanges(false)
    toast({
      title: "Cancelled",
      description: "Editing cancelled. Changes were not saved.",
    })
  }

  const handleSaveEdit = async () => {
    if (!editableCostEstimate || !costEstimateId || !user?.uid) return

    setIsSaving(true)
    try {
      // Remove the id field from update data as it's not needed for Firestore update
      const { id, ...updateDataWithoutId } = editableCostEstimate

      await updateCostEstimate(editableCostEstimate.id, updateDataWithoutId)
      setCostEstimate(editableCostEstimate)
      setIsEditing(false)
      toast({
        title: "Success",
        description: "Cost estimate updated successfully!",
      })
    } catch (error) {
      console.error("Error saving cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to save cost estimate changes.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith("client.")) {
      const clientField = name.split(".")[1] as keyof CostEstimateClient
      setEditableCostEstimate((prev) => ({
        ...prev!,
        client: {
          ...prev!.client,
          [clientField]: value,
        },
      }))
    } else {
      setEditableCostEstimate((prev) => ({
        ...prev!,
        [name]: value,
      }))
    }
  }

  const handleDateChange = (date: Date | undefined, field: "startDate" | "endDate" | "validUntil") => {
    setEditableCostEstimate((prev) => ({
      ...prev!,
      [field]: date || new Date(),
    }))
  }

  const getStatusConfig = (status: CostEstimateStatus) => {
    switch (status) {
      case "draft":
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Draft",
        }
      case "sent":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Send className="h-3.5 w-3.5" />,
          label: "Sent",
        }
      case "accepted":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: "Accepted",
        }
      case "declined":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="h-3.5 w-3.5" />,
          label: "Declined",
        }
      case "revised":
        return {
          color: "bg-orange-100 text-orange-800 border-orange-200",
          icon: <Pencil className="h-3.5 w-3.5" />,
          label: "Revised",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800 border-gray-200",
          icon: <FileText className="h-3.5 w-3.5" />,
          label: "Unknown",
        }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-blue-100 text-blue-800"
      case "accepted":
        return "bg-green-100 text-green-800"
      case "declined":
        return "bg-red-100 text-red-800"
      case "revised":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleNextProduct = () => {
    if (!costEstimate) return
    const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
    const totalProducts = Object.keys(siteGroups).length
    setCurrentProductIndex((prev) => (prev + 1) % totalProducts)
  }

  const handlePreviousProduct = () => {
    if (!costEstimate) return
    const siteGroups = groupLineItemsBySite(costEstimate.lineItems || [])
    const totalProducts = Object.keys(siteGroups).length
    setCurrentProductIndex((prev) => (prev - 1 + totalProducts) % totalProducts)
  }

  const handlePreviousPage = () => {
    if (currentPageIndex > 0) {
      const prevCostEstimate = relatedCostEstimates[currentPageIndex - 1]
      router.push(`/sales/cost-estimates/${prevCostEstimate.id}`)
    }
  }

  const handleNextPage = () => {
    if (currentPageIndex < relatedCostEstimates.length - 1) {
      const nextCostEstimate = relatedCostEstimates[currentPageIndex + 1]
      router.push(`/sales/cost-estimates/${nextCostEstimate.id}`)
    }
  }

  const handlePageSelect = (pageIndex: number) => {
    const selectedCostEstimate = relatedCostEstimates[pageIndex]
    router.push(`/sales/cost-estimates/${selectedCostEstimate.id}`)
  }

  const handleHistoryItemClick = async (historyItem: CostEstimate) => {
    setSelectedHistoryItem(historyItem)
    setLoadingPdfPreview(true)
    setPdfPreviewDialogOpen(true)

    try {
      // Check if cost estimate already has a PDF
      if (historyItem.pdf && historyItem.pdf.trim() !== "") {
        setPdfPreviewUrl(historyItem.pdf)
      } else {
        // If no PDF exists, generate one
        // Prepare logo data URL if company logo exists
        let logoDataUrl: string | null = null
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

        // Prepare cost estimate data for API (convert dates to serializable format)
        const serializableCostEstimate = {
          ...historyItem,
          createdAt: historyItem.createdAt?.toISOString ? historyItem.createdAt.toISOString() : historyItem.createdAt,
          updatedAt: historyItem.updatedAt?.toISOString ? historyItem.updatedAt.toISOString() : historyItem.updatedAt,
          startDate: historyItem.startDate?.toISOString ? historyItem.startDate.toISOString() : historyItem.startDate,
          endDate: historyItem.endDate?.toISOString ? historyItem.endDate.toISOString() : historyItem.endDate,
        }

        // Fetch user signature if available
        let userSignatureDataUrl: string | null = null
        let signatureDate: Date | null = null
        if (historyItem.createdBy) {
          try {
            console.log('[HISTORY_PDF] Fetching user signature for createdBy:', historyItem.createdBy)
            const userDocRef = doc(db, "boohk_users", historyItem.createdBy)
            const userDoc = await getDoc(userDocRef)

            if (userDoc.exists()) {
              const userDataFetched = userDoc.data()
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
                const signatureUrl = userDataFetched.signature.url
                console.log('[HISTORY_PDF] Found user signature URL:', signatureUrl)

                // Convert signature image to base64 data URL
                try {
                  const response = await fetch(signatureUrl)
                  if (response.ok) {
                    const blob = await response.blob()
                    const arrayBuffer = await blob.arrayBuffer()
                    const base64 = Buffer.from(arrayBuffer).toString('base64')
                    const mimeType = blob.type || 'image/png'
                    userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                    console.log('[HISTORY_PDF] Converted signature to base64 data URL')
                  } else {
                    console.warn('[HISTORY_PDF] Failed to fetch signature image:', response.status)
                  }
                } catch (fetchError) {
                  console.error('[HISTORY_PDF] Error converting signature to base64:', fetchError)
                }
              }
              // Also fetch signature date
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
              }
            }
          } catch (error) {
            console.error('[HISTORY_PDF] Error fetching user signature:', error)
          }
        }

        // Call the generate-cost-estimate-pdf API
        const response = await fetch('/api/generate-cost-estimate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            costEstimate: serializableCostEstimate,
            companyData,
            logoDataUrl,
            userSignatureDataUrl,
            creatorUser,
            signatureDate: historyItem.signature_date || costEstimate?.signature_date,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Error:', response.status, errorText)
          throw new Error(`Failed to generate PDF: ${response.status} ${errorText}`)
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)

        // Save the generated PDF URL to the cost estimate
        try {
          const { pdfUrl } = await generateAndUploadCostEstimatePDF(historyItem, userData ? {
            first_name: userData.first_name || undefined,
            last_name: userData.last_name || undefined,
            email: userData.email || undefined,
            company_id: userData.company_id || undefined,
          } : undefined, companyData ? {
            name: companyData.name || "Company Name",
            address: companyData.address,
            phone: companyData.phone,
            email: companyData.email,
            website: companyData.website || companyData.company_website,
          } : undefined, userSignatureDataUrl)
          await updateCostEstimate(historyItem.id, { pdf: pdfUrl, signature_date: signatureDate })
          console.log("PDF saved to cost estimate:", pdfUrl)
        } catch (saveError) {
          console.error("Error saving PDF to cost estimate:", saveError)
          // Continue with preview even if save fails
        }

        setPdfPreviewUrl(url)
      }
    } catch (error) {
      console.error("Error loading PDF preview:", error)
      toast({
        title: "Error",
        description: "Failed to load PDF preview",
        variant: "destructive",
      })
      setPdfPreviewDialogOpen(false)
    } finally {
      setLoadingPdfPreview(false)
    }
  }

  const handleClosePdfPreview = () => {
    setPdfPreviewDialogOpen(false)
    setSelectedHistoryItem(null)
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl)
      setPdfPreviewUrl(null)
    }
  }

  const handleAddTerm = () => {
    const currentTerms = tempValues.terms_and_conditions || editableCostEstimate?.template?.terms_and_conditions || [
      "Cost Estimate validity: 5 working days.",
      "Site availability: First-come-first-served basis. Official documents required.",
      "Payment terms: One month advance and two months security deposit.",
      "Payment deadline: 7 days before rental start.",
    ]
    const newTerms = [...currentTerms, ""]
    setEditableCostEstimate({
      ...editableCostEstimate!,
      template: {
        ...editableCostEstimate?.template,
        terms_and_conditions: newTerms,
      },
    })
    setTempValues({
      ...tempValues,
      terms_and_conditions: newTerms,
    })
    setHasUnsavedChanges(true)
  }

  const handleUpdateTerm = (index: number, value: string) => {
    const currentTerms = tempValues.terms_and_conditions || editableCostEstimate?.template?.terms_and_conditions || []
    const newTerms = [...currentTerms]
    newTerms[index] = value
    setTempValues({
      ...tempValues,
      terms_and_conditions: newTerms,
    })
    setEditableCostEstimate({
      ...editableCostEstimate!,
      template: {
        ...editableCostEstimate?.template,
        terms_and_conditions: newTerms,
      },
    })
  }

  const handleRemoveTerm = (index: number) => {
    const currentTerms = tempValues.terms_and_conditions || editableCostEstimate?.template?.terms_and_conditions || []
    const newTerms = currentTerms.filter((_: string, i: number) => i !== index)
    setTempValues({
      ...tempValues,
      terms_and_conditions: newTerms,
    })
    setEditableCostEstimate({
      ...editableCostEstimate!,
      template: {
        ...editableCostEstimate?.template,
        terms_and_conditions: newTerms,
      },
    })
    setHasUnsavedChanges(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-gray-200 rounded-lg"></div>
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!costEstimate || !editableCostEstimate) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Cost Estimate Not Found</h1>
          <p className="text-gray-600 mb-6">
            The cost estimate you're looking for doesn't exist or may have been removed.
          </p>
          <Button onClick={() => router.push("/sales/cost-estimates")} className="bg-blue-600 hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cost Estimates
          </Button>
        </div>
      </div>
    )
  }

  const renderCostEstimationBlock = (siteName: string, siteLineItems: CostEstimateLineItem[], pageNumber: number) => {
    const currentCostEstimate = editableCostEstimate || costEstimate
    if (!currentCostEstimate) return null

    // Calculate preview total using tempValues if available
    const previewSiteTotal = siteLineItems.reduce((sum, item) => {
      let itemTotal = item.total

      // Determine effective dates and duration for calculation
      const effectiveStartDate = tempValues.startDate || costEstimate?.startDate
      const effectiveEndDate = tempValues.endDate || costEstimate?.endDate
      const effectiveDuration = tempValues.durationDays !== undefined ? tempValues.durationDays : costEstimate?.durationDays

      if (item.category.includes("Billboard Rental")) {
        // Apply unitPrice changes
        if (tempValues.unitPrice !== undefined) {
          if (effectiveStartDate && effectiveEndDate) {
            itemTotal = calculateProratedPrice(tempValues.unitPrice, effectiveStartDate, effectiveEndDate)
          } else {
            const duration = effectiveDuration || 30
            itemTotal = tempValues.unitPrice * (duration / 30)
          }
        }
        // Apply duration changes (only if unitPrice not changed)
        else if (tempValues.durationDays !== undefined) {
          if (effectiveStartDate && effectiveEndDate) {
            itemTotal = calculateProratedPrice(item.unitPrice, effectiveStartDate, effectiveEndDate)
          } else {
            itemTotal = item.unitPrice * (tempValues.durationDays / 30)
          }
        }
        // If no changes, use existing total or calculate from unitPrice
        else {
          if (effectiveStartDate && effectiveEndDate) {
            itemTotal = calculateProratedPrice(item.unitPrice, effectiveStartDate, effectiveEndDate)
          } else {
            const duration = effectiveDuration || 30
            itemTotal = item.unitPrice * (duration / 30)
          }
        }
      } else {
        // For non-billboard items, ensure total is calculated if not set
        if (item.total === 0 && item.unitPrice && item.quantity) {
          itemTotal = item.unitPrice * item.quantity
        }
      }

      return sum + itemTotal
    }, 0)

    const siteTotal = previewSiteTotal
    const adjustedTitle = hasMultipleSites ? `${siteName}` : costEstimate?.lineItems[0]?.description

    const baseCENumber = costEstimate?.costEstimateNumber || costEstimate?.id
    const uniqueCENumber = hasMultipleSites
      ? `${baseCENumber}-${String.fromCharCode(64 + pageNumber)}` // Appends -A, -B, -C, etc.
      : baseCENumber

    const rentalItem = siteLineItems.find((item) => item.category.includes("Billboard Rental"))
    const monthlyRate = rentalItem
      ? rentalItem.unitPrice
      : siteTotal / (costEstimate?.durationDays ? costEstimate.durationDays / 30 : 1)

    return (
      <div key={siteName} className="px-8 bg-white">
        {/* Header Section */}
        <div className="text-center mb-8"></div>

        <div id="cost-estimate-body">
          {/* Date */}
          <div className="text-left mb-8">
            <p className="text-base">{format(new Date(), "MMMM dd, yyyy")}</p>
          </div>

          {/* Client and RFQ Info */}
          <div className="flex justify-between items-start mb-8">
            <div className="text-left">
              <p className="text-base ">{currentCostEstimate.client?.name || "Client Name"}</p>
              <p className="text-base ">{currentCostEstimate.client?.designation || "Position"}</p>
              <p className="text-base font-bold">{currentCostEstimate.client?.company || "COMPANY NAME"}</p>
            </div>
            <div className="text-right">
              <p className="text-base">RFQ. No. {uniqueCENumber}</p>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-gray-900 mb-4">{adjustedTitle} Cost Estimate</h1>
          </div>

          {/* Salutation */}
          <div className="text-left mb-4">
            <p className="text-base">
              Dear {isEditing && editingField === "salutation" ? (
                <select
                  value={tempValues.salutation || currentCostEstimate.template?.salutation}
                  onChange={(e) => updateTempValues("salutation", e.target.value)}
                  className="border border-gray-300 rounded px-1 py-0 text-sm"
                  onBlur={() => setEditingField(null)}
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Miss">Miss</option>
                </select>
              ) : (
                <span
                  className={isEditing ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : ""}
                  onClick={() => isEditing && handleFieldEdit("salutation", tempValues.salutation || currentCostEstimate.template?.salutation || "Mr.")}
                  title={isEditing ? "Click to edit salutation" : ""}
                >
                  {tempValues.salutation || currentCostEstimate.template?.salutation || "Mr."}
                  {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
                </span>
              )} {currentCostEstimate?.client?.name?.split(' ').pop() || 'Client'},
            </p>
          </div>

          {/* Greeting */}
          <div className="text-left mb-8">
            {isEditing && editingField === "greeting" ? (
              <textarea
                value={tempValues.greeting || currentCostEstimate?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`}
                onChange={(e) => updateTempValues("greeting", e.target.value)}
                className="w-full text-left text-base border border-gray-300 rounded p-2"
                rows={2}
                placeholder="Enter greeting text"
              />
            ) : (
              <div
                className={isEditing ? "cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : ""}
                onClick={() => isEditing && handleFieldEdit("greeting", tempValues.greeting || currentCostEstimate?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`)}
                title={isEditing ? "Click to edit greeting" : ""}
              >
                <p className="text-base">
                  {tempValues.greeting || currentCostEstimate?.template?.greeting || `Good Day! Thank you for considering ${companyData?.name || "our company"} for your business needs.`}
                </p>
                {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
              </div>
            )}
          </div>

          {/* Details Header */}
          <div className="text-left mb-1">
            <p className="text-base font-semibold">Site details:</p>
          </div>

          {/* Details Section with editable fields */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/4">Type:</span>
              <span className="text-gray-700">{siteLineItems[0]?.content_type || ""}</span>
            </div>

            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/4">Size:</span>
              <span className="text-gray-700">
                {siteLineItems[0]?.specs?.height ? `${siteLineItems[0].specs.height}ft (H)` : "N/A"} x {siteLineItems[0]?.specs?.width ? `${siteLineItems[0].specs.width}ft (W)` : "N/A"}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/4">Contract Duration:</span>
              {isEditing && editingField === "durationDays" ? (
                <div className="flex items-center gap-2 ml-1">
                  <Input
                    type="number"
                    value={tempValues.durationDays || ""}
                    onChange={(e) => updateTempValues("durationDays", Number.parseInt(e.target.value) || 0)}
                    className="w-24 h-6 text-sm"
                    placeholder={currentCostEstimate?.durationDays?.toString() || "0"}
                    onBlur={() => setEditingField(null)}
                  />
                  <span className="text-sm text-gray-600">days</span>
                </div>
              ) : (
                <span
                  className={`text-gray-700 ${isEditing
                      ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                      : ""
                    }`}
                  onClick={() => isEditing && handleFieldEdit("durationDays", tempValues.durationDays || currentCostEstimate?.durationDays || 0)}
                  title={isEditing ? "Click to edit contract duration" : ""}
                >
                  {formatDurationDisplay(tempValues.durationDays || currentCostEstimate?.durationDays || 0)}
                  {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
                </span>
              )}
            </div>

            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/4">Contract Period:</span>
              {isEditing && editingField === "contractPeriod" ? (
                <div className="flex items-center gap-2 ml-1">
                  <Input
                    type="date"
                    value={formatDateForInput(tempValues.startDate)}
                    onChange={(e) => updateTempValues("startDate", new Date(e.target.value))}
                    className="w-36 h-8 text-sm border-gray-300 rounded-md"
                    onBlur={() => setEditingField(null)}
                  />
                  <span className="text-gray-500">-</span>
                  <Input
                    type="date"
                    value={formatDateForInput(tempValues.endDate)}
                    onChange={(e) => updateTempValues("endDate", new Date(e.target.value))}
                    className="w-36 h-8 text-sm border-gray-300 rounded-md"
                    onBlur={() => setEditingField(null)}
                  />
                </div>
              ) : (
                <span
                  className={`text-gray-700 ${isEditing
                      ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                      : ""
                    }`}
                  onClick={() =>
                    isEditing &&
                    handleFieldEdit("contractPeriod", {
                      startDate: tempValues.startDate || currentCostEstimate?.startDate,
                      endDate: tempValues.endDate || currentCostEstimate?.endDate,
                    })
                  }
                  title={isEditing ? "Click to edit contract period" : ""}
                >
                  {(tempValues.startDate || currentCostEstimate?.startDate) && (tempValues.endDate || currentCostEstimate?.endDate)
                    ? `${formatDate(tempValues.startDate || currentCostEstimate?.startDate)} - ${formatDate(tempValues.endDate || currentCostEstimate?.endDate)}`
                    : "—"}
                  {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
                </span>
              )}
            </div>

            <div className="flex">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/4">Proposal to:</span>
              <span className="text-gray-700">{currentCostEstimate?.client?.company || "CLIENT COMPANY NAME"}</span>
            </div>

            <div className="flex items-center">
              <span className="w-4 text-center">•</span>
              <span className="font-medium text-gray-700 w-1/4">Lease rate per month:</span>

              {isEditing && editingField === "unitPrice" ? (
                <div className="flex items-center gap-2 ml-1">
                  <Input
                    type="number"
                    value={tempValues.unitPrice || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      const parsed = Number.parseFloat(value);
                      if (!isNaN(parsed)) {
                        updateTempValues("unitPrice", Number(parsed.toFixed(2)));
                      } else if (value === "") {
                        updateTempValues("unitPrice", 0);
                      }
                    }}
                    className="w-32 h-6 text-sm"
                    placeholder={monthlyRate?.toString() || "0.00"}
                    step="0.01"
                    onBlur={() => setEditingField(null)}
                  />
                  <span className="text-sm text-gray-600">(Exclusive of VAT)</span>
                </div>
              ) : (
                <span
                  className={`text-gray-700 ${isEditing
                      ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200"
                      : ""
                    }`}
                  onClick={() => isEditing && handleFieldEdit("unitPrice", tempValues.unitPrice || monthlyRate)}
                  title={isEditing ? "Click to edit lease rate" : ""}
                >
                  PHP {(tempValues.unitPrice || monthlyRate).toLocaleString("en-US", { minimumFractionDigits: 2 })} (Exclusive of VAT)
                  {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
                </span>
              )}
            </div>

          </div>

          {/* Site Notes */}
          {isEditing && editingField === "site_notes" ? (
            <div className="mt-4">
              <textarea
                value={tempValues.site_notes || currentCostEstimate?.items?.site_notes || ""}
                onChange={(e) => updateTempValues("site_notes", e.target.value)}
                className="w-full text-base border border-gray-300 rounded p-2"
                rows={3}
                placeholder="Enter site notes"
                onBlur={() => setEditingField(null)}
              />
            </div>
          ) : (tempValues.site_notes || currentCostEstimate?.items?.site_notes) ? (
            <div
              className={isEditing ? "mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : "mt-4"}
              onClick={() => isEditing && handleFieldEdit("site_notes", tempValues.site_notes || currentCostEstimate.items?.site_notes || "")}
              title={isEditing ? "Click to edit site notes" : ""}
            >
              <p className="text-sm italic"><strong>Note:</strong> {tempValues.site_notes || currentCostEstimate.items?.site_notes}</p>
              {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
            </div>
          ) : isEditing ? (
            <div
              className="mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200 text-gray-500"
              onClick={() => handleFieldEdit("site_notes", tempValues.site_notes || "")}
              title="Click to add site notes"
            >
              <p className="text-base">+ Add site notes</p>
            </div>
          ) : null}

          <p className="font-bold mt-2">Price breakdown:</p>
          {/* Pricing Table */}
          <div className="px-4 pt-2">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-700">Lease rate per month</span>
                <span className="text-gray-900">PHP {monthlyRate.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Contract duration</span>
                <span className="text-gray-900">x {formatDurationDisplay(tempValues.durationDays || currentCostEstimate?.durationDays || 30)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Total lease</span>
                <span className="text-gray-900">PHP {siteTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Add: VAT</span>
                <span className="text-gray-900">PHP {(siteTotal * 0.12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-1 mt-1">
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">PHP {(siteTotal * 1.12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Price Notes */}
          {isEditing && editingField === "price_notes" ? (
            <div className="mt-4">
              <textarea
                value={tempValues.price_notes || currentCostEstimate?.items?.price_notes || ""}
                onChange={(e) => updateTempValues("price_notes", e.target.value)}
                className="w-full text-base border border-gray-300 rounded p-2"
                rows={3}
                placeholder="Enter price notes"
                onBlur={() => setEditingField(null)}
              />
            </div>
          ) : (tempValues.price_notes || currentCostEstimate?.items?.price_notes) ? (
            <div
              className={isEditing ? "mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : "mt-4"}
              onClick={() => isEditing && handleFieldEdit("price_notes", tempValues.price_notes || currentCostEstimate.items?.price_notes || "")}
              title={isEditing ? "Click to edit price notes" : ""}
            >
              <p className="text-sm italic mb-[15px]"><strong>Note:</strong> {tempValues.price_notes || currentCostEstimate.items?.price_notes}</p>
              {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
            </div>
          ) : isEditing ? (
            <div
              className="mt-4 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200 text-gray-500"
              onClick={() => handleFieldEdit("price_notes", tempValues.price_notes || "")}
              title="Click to add price notes"
            >
              <p className="text-base">+ Add price notes</p>
            </div>
          ) : null}

          {/* Terms and Conditions */}
          <div className="mb-8 mt-2">
            <p className="font-semibold mb-4">Terms and Conditions:</p>
            <div className="space-y-2 text-sm">
              {(isEditing
                ? tempValues.terms_and_conditions || currentCostEstimate?.template?.terms_and_conditions || [
                  "Cost Estimate validity: 5 working days.",
                  "Site availability: First-come-first-served basis. Official documents required.",
                  "Payment terms: One month advance and two months security deposit.",
                  "Payment deadline: 7 days before rental start.",
                ]
                : currentCostEstimate?.template?.terms_and_conditions || [
                  "Cost Estimate validity: 5 working days.",
                  "Site availability: First-come-first-served basis. Official documents required.",
                  "Payment terms: One month advance and two months security deposit.",
                  "Payment deadline: 7 days before rental start.",
                ]
              ).map((term: string, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0">{index + 1}.</span>
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <textarea
                        value={term}
                        onChange={(e) => handleUpdateTerm(index, e.target.value)}
                        className="flex-1 text-sm border border-gray-300 rounded p-1 min-h-[40px]"
                        placeholder="Enter term and condition"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveTerm(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="flex-1">{term}</span>
                  )}
                </div>
              ))}
              {isEditing && (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTerm}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    + Add Term
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Closing Message */}
          {isEditing && editingField === "closing_message" ? (
            <div className="mb-8">
              <textarea
                value={tempValues.closing_message || currentCostEstimate?.template?.closing_message || ""}
                onChange={(e) => updateTempValues("closing_message", e.target.value)}
                className="w-full text-base border border-gray-300 rounded p-2"
                rows={3}
                placeholder="Enter closing message (optional)"
                onBlur={() => setEditingField(null)}
              />
            </div>
          ) : (tempValues.closing_message || currentCostEstimate?.template?.closing_message) ? (
            <div
              className={isEditing ? "mb-8 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : "mb-8"}
              onClick={() => isEditing && handleFieldEdit("closing_message", tempValues.closing_message || currentCostEstimate?.template?.closing_message || "")}
              title={isEditing ? "Click to edit closing message" : ""}
            >
              <p className="text-base">{tempValues.closing_message || currentCostEstimate?.template?.closing_message}</p>
              {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
            </div>
          ) : isEditing ? (
            <div
              className="mb-8 cursor-pointer hover:bg-blue-50 p-2 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200 text-gray-500"
              onClick={() => handleFieldEdit("closing_message", tempValues.closing_message || "")}
              title="Click to add closing message"
            >
              <p className="text-base">+ Add closing message</p>
            </div>
          ) : null}

          <div className="space-y-8 mb-8">
            <div className="text-left">
              <p className="mb-4">Very truly yours,</p>
              <div>
                {userSignatureUrl ? (
                  <div className="mb-2">
                    <img
                      src={userSignatureUrl}
                      alt="Signature"
                      className="max-w-48 max-h-16 object-contain border-b border-gray-400"
                      style={{ width: 'auto', height: 'auto' }}
                    />
                  </div>
                ) : (
                  <div className="border-b border-gray-400 w-48 mb-2"></div>
                )}
                <p className="font-medium">
                  {creatorUser?.first_name && creatorUser?.last_name
                    ? `${creatorUser.first_name} ${creatorUser.last_name}`
                    : "Golden Touch Imaging Specialist"}
                </p>
                {isEditing && editingField === "signature_position" ? (
                  <Input
                    type="text"
                    value={tempValues.signature_position || ""}
                    onChange={(e) => updateTempValues("signature_position", e.target.value)}
                    className="w-32 h-6 text-sm"
                    placeholder={currentCostEstimate?.signature_position ?? "Position"}
                    onBlur={() => setEditingField(null)}
                  />
                ) : (
                  <p
                    className={`text-sm ${isEditing ? "cursor-pointer hover:bg-blue-50 px-2 py-1 rounded border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-200" : ""}`}
                    onClick={() => isEditing && handleFieldEdit("signature_position", tempValues.signature_position ?? currentCostEstimate?.signature_position ?? "")}
                    title={isEditing ? "Click to edit position" : ""}
                  >
                    {tempValues.signature_position ?? currentCostEstimate?.signature_position ?? "Sales"}
                    {isEditing && <span className="ml-1 text-blue-500 text-xs">✏️</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-600 mt-8 border-t pt-4">
            <p className="font-semibold">{companyData?.name || "Company Name"}</p>
            <p>{formatCompanyAddress(companyData)}</p>
            <span className="text-center gap-1 flex-1">{companyData?.phone && `Tel no: ${companyData.phone}`}|{companyData?.email && `Email: ${companyData.email}`}</span>
          </div>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(costEstimate.status)

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        @media print {
          .page-break-before {
            page-break-before: always;
          }
        }
        @page {
          margin: 0.5in;
        }
      `}</style>

      {/* Header with Back Button and Status */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/sales/cost-estimates")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Cost Estimates
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Status:</span>
              <Badge className={`${statusConfig.color} border`}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {costEstimate?.costEstimateNumber || costEstimate?.id}
          </div>
        </div>
      </div>

      {/* New Wrapper for Sidebar + Document */}
      <div className="flex justify-center items-start gap-6 mt-6">
        {/* Left Panel (now part of flow) */}
        {costEstimate.status !== "sent" && (
          <div className="flex flex-col space-y-4 z-20 hidden lg:flex">
            <Button
              variant="ghost"
              className="h-16 w-16 flex flex-col items-center justify-center p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            >
              <LayoutGrid className="h-8 w-8 text-gray-500 mb-1" />
              <span className="text-[10px] text-gray-700">Templates</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleEditClick}
              disabled={isEditing}
              className="h-16 w-16 flex flex-col items-center justify-center p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            >
              <Pencil className="h-8 w-8 text-gray-500 mb-1" />
              <span className="text-[10px] text-gray-700">Edit</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleDownloadPDF()}
              disabled={downloadingPDF}
              className="h-16 w-16 flex flex-col items-center justify-center p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50"
            >
              {downloadingPDF ? (
                <>
                  <Loader2 className="h-8 w-8 text-gray-500 mb-1 animate-spin" />
                  <span className="text-[10px] text-gray-700">Generating...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="h-8 w-8 text-gray-500 mb-1" />
                  <span className="text-[10px] text-gray-700">Download</span>
                </>
              )}
            </Button>
          </div>
        )}

        <div className="flex gap-6 items-start">
          {costEstimate.status === "sent" && costEstimate.pdf ? (
            <div className="w-[210mm] min-h-[297mm] bg-white shadow-md rounded-sm overflow-hidden">
              <iframe
                src={`${costEstimate.pdf}#view=FitH`}
                className="w-full h-full min-h-[297mm]"
                title="Cost Estimate PDF"
              />
            </div>
          ) : (
            <div id="cost-estimate-document" className="w-[210mm] min-h-[297mm] bg-white shadow-md py-8 rounded-sm overflow-auto">
              <div className="text-left mb-8 ml-8">
                <div className="flex items-center justify-start mb-6 pt-6">
                  {companyData?.logo ? (
                    <img
                      src={companyData.logo || "/placeholder.svg"}
                      alt="Company Logo"
                      className="h-24 w-auto object-contain"
                    />
                  ) : (
                    <div className="h-24 w-24 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {hasMultipleSites ? (
                <>
                  {renderCostEstimationBlock(
                    siteNames[currentProductIndex],
                    siteGroups[siteNames[currentProductIndex]],
                    currentProductIndex + 1,
                  )}
                </>
              ) : (
                // Render single page for single site (original behavior)
                renderCostEstimationBlock("Single Site", costEstimate?.lineItems || [], 1)
              )}
            </div>
          )}

          <Button
            onClick={() => setShowHistory(!showHistory)}
            className="fixed top-24 right-4 z-50 xl:hidden bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>

          {showHistory && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden"
              onClick={() => setShowHistory(false)}
            />
          )}

          <div
            className={`
              w-80 bg-white shadow-md rounded-lg p-4 max-h-[calc(100vh-120px)] overflow-y-auto
              xl:sticky xl:top-24 xl:block
              ${showHistory ? "fixed top-24 right-4 z-50" : "hidden"}
              xl:${showHistory ? "block" : "block"}
            `}
          >
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cost Estimate History</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="xl:hidden">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-medium inline-block mb-4">
                {costEstimate?.lineItems[0].description || "Client"}
              </div>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : clientHistory.length > 0 ? (
              <div className="space-y-3">
                {clientHistory.map((historyItem) => (
                  <div
                    key={historyItem.id}
                    onClick={() => handleHistoryItemClick(historyItem)}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {historyItem.costEstimateNumber || historyItem.id.slice(-8)}
                    </div>
                    <div className="text-sm text-red-600 font-medium mb-2">
                      PHP {historyItem.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month
                    </div>
                    <div className="flex justify-end">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(historyItem.status)}`}
                      >
                        {historyItem.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-sm">No other cost estimates found for this client</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      {isEditing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">✏️ Edit Mode Active</span>
            <span className="text-xs">Click on highlighted fields to edit them</span>
          </div>
        </div>
      )}
      {isEditing ? (
        <div className="fixed bottom-6 right-6 flex space-x-4">
          <Button
            onClick={handleCancelEdit}
            variant="outline"
            className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75"
          >
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSaveAllChanges}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </div>
      ) : null}

      {!isEditing && relatedCostEstimates.length > 1 ? (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-full shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPageIndex === 0}
              className="px-6 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-medium"
            >
              Previous
            </Button>

            <div className="px-4 py-2 bg-gray-100 text-gray-800 rounded-full font-medium text-sm">
              {currentPageIndex + 1}/{relatedCostEstimates.length}
            </div>

            {currentPageIndex === relatedCostEstimates.length - 1 ? (
              <Button
                onClick={handleSendWithPDFGeneration}
                disabled={generatingPDFsForSend}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium"
              >
                {generatingPDFsForSend ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPageIndex === relatedCostEstimates.length - 1}
                className="px-6 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-medium"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      ) : !isEditing ? (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-full shadow-lg">
            <Button
              onClick={handleSendWithPDFGeneration}
              disabled={generatingPDFsForSend}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium disabled:opacity-50"
            >
              {generatingPDFsForSend ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {!isEditing && hasMultipleSites && relatedCostEstimates.length <= 1 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-200 rounded-full shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousProduct}
              disabled={currentProductIndex === 0}
              className="px-6 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-medium"
            >
              Previous
            </Button>

            <div className="px-4 py-2 bg-gray-100 text-gray-800 rounded-full font-medium text-sm">
              {currentProductIndex + 1}/{Object.keys(siteGroups).length}
            </div>

            {currentProductIndex === Object.keys(siteGroups).length - 1 ? (
              <Button
                onClick={handleSendWithPDFGeneration}
                disabled={generatingPDFsForSend}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium disabled:opacity-50"
              >
                {generatingPDFsForSend ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextProduct}
                disabled={currentProductIndex === Object.keys(siteGroups).length - 1}
                className="px-6 py-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full font-medium"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Send Cost Estimate Options Dialog */}
      {costEstimate && (
        <SendCostEstimateOptionsDialog
          isOpen={isSendOptionsDialogOpen}
          onOpenChange={setIsSendOptionsDialogOpen}
          costEstimate={costEstimate}
          companyData={companyData}
          onEmailClick={() => {
            setIsSendOptionsDialogOpen(false)
            handleSendEmail()
          }}
        />
      )}

      {/* Send Email Dialog (existing) */}
      <Dialog open={isSendEmailDialogOpen} onOpenChange={setIsSendEmailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Send Cost Estimate</DialogTitle>
            <DialogDescription>
              Review the email details before sending the cost estimate to{" "}
              <span className="font-semibold text-gray-900">{costEstimate?.client?.email}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">
                To
              </Label>
              <Input id="to" value={costEstimate?.client?.email || ""} readOnly className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cc" className="text-right">
                CC
              </Label>
              <Input
                id="cc"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="Optional: comma-separated emails"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">
                From
              </Label>
              <Input id="from" value="Boohk &lt;noreply@resend.dev&gt;" readOnly className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="replyTo" className="text-right">
                Reply-To
              </Label>
              <Input
                id="replyTo"
                value={user?.email || ""} // Use current user's email as default reply-to
                readOnly // Make it read-only as it's derived from user data
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                Subject
              </Label>
              <Input
                id="subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Cost Estimate for Your Advertising Campaign"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="body" className="text-right pt-2">
                Body
              </Label>
              <Textarea
                id="body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="col-span-3 min-h-[150px]"
                placeholder="e.g., Dear [Client Name],\n\nPlease find our cost estimate attached...\n\nBest regards,\nThe Boohk Team"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendEmailDialogOpen(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleSendEmailConfirm} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CostEstimateSentSuccessDialog
        isOpen={showSuccessDialog}
        onDismissAndNavigate={handleSuccessDialogDismissAndNavigate}
      />
      {/* Timeline Sidebar */}
      {timelineOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setTimelineOpen(false)} />

          {/* Sidebar */}
          <div className="fixed right-0 top-0 h-full w-80 sm:w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTimelineOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">
              <ProposalActivityTimeline
                proposalId={costEstimate.id}
                currentUserId={user?.uid || "unknown_user"}
                currentUserName={user?.displayName || "Unknown User"}
              />
            </div>
          </div>
        </>
      )}

      <Dialog open={showPageSelection} onOpenChange={setShowPageSelection}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <DialogTitle className="text-xl font-semibold">Select Pages for PDF Download</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">Choose which site pages to include in your PDF</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllPages}
                className="text-blue-600 border-blue-600 hover:bg-blue-50 bg-transparent"
              >
                {selectedPages.length === Object.keys(groupLineItemsBySite(costEstimate?.lineItems || [])).length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowPageSelection(false)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {costEstimate &&
                // Updated page selection logic to use site names
                Object.keys(siteGroups).map((siteName, index) => {
                  const siteItems = siteGroups[siteName]
                  const isSelected = selectedPages.includes(siteName)
                  const totalCost = siteItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
                  const items = siteGroups[siteName]

                  return (
                    <div
                      key={siteName}
                      className={`relative border rounded-lg p-4 cursor-pointer transition-all ${isSelected ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      onClick={() => handlePageToggle(index)}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-3 left-3 z-10">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handlePageToggle(index)}
                          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                      </div>

                      {/* Page Preview */}
                      <div className="mt-6 space-y-3">
                        <div className="text-sm font-semibold text-gray-900">Page {index + 1}</div>
                        <div className="text-xs text-gray-600 font-medium">
                          {costEstimate.costEstimateNumber || costEstimate.id}
                          {Object.keys(groupLineItemsBySite(costEstimate?.lineItems || [])).length > 1
                            ? `-${String.fromCharCode(65 + index)}`
                            : ""}
                        </div>
                        <div className="text-sm font-medium text-gray-800 line-clamp-2">
                          Cost Estimate for {siteName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {items.length} line item{items.length !== 1 ? "s" : ""}
                        </div>
                        <div className="text-xs text-gray-500">
                          Total: ₱
                          {items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-500">
              {selectedPages.length} of {Object.keys(groupLineItemsBySite(costEstimate?.lineItems || [])).length} pages
              selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPageSelection(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDownloadSelectedPages}
                disabled={selectedPages.length === 0 || downloadingPDF}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {downloadingPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="h-4 w-4 mr-2" />
                    Download PDF ({selectedPages.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={pdfPreviewDialogOpen} onOpenChange={handleClosePdfPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedHistoryItem ? `Cost Estimate ${selectedHistoryItem.costEstimateNumber || selectedHistoryItem.id?.slice(-8) || "N/A"}` : "PDF Preview"}
            </DialogTitle>
            <DialogDescription>
              Preview of the cost estimate PDF
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[600px]">
            {loadingPdfPreview ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Generating PDF preview...</p>
                </div>
              </div>
            ) : pdfPreviewUrl ? (
              <iframe
                src={`${pdfPreviewUrl}#view=FitH&toolbar=0&navpanes=0`}
                className="w-full h-full min-h-[600px] border-0"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600">Failed to load PDF preview</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePdfPreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
