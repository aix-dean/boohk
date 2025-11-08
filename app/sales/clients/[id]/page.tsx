"use client"

import { useState, useEffect, useRef } from "react" // Import useRef
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Edit, Search, Printer, Plus, FileText, Upload, X, Check, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, orderBy, limit, startAfter } from "firebase/firestore" // Import updateDoc, collection, query, where, getDocs
import { db } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Toaster } from "sonner"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service" // Import the upload function

interface Company {
  id: string
  name: string
  address?: string
  industry?: string
  clientType: string
  partnerType?: string
  companyLogoUrl?: string
  contactPersons?: Array<{
    name: string
    email: string
    phone: string
    position: string
  }>
  compliance?: {
    dti?: string;
    gis?: string;
    id?: string;
    uploadedAt?: Date;
    uploadedBy?: string;
  };
}

interface Proposal {
  id: string
  proposalNumber: string
  title: string
  date: string // This will be derived from createdAt
  sites: number // This will be derived from products array length
  sentTo: string // This will be derived from client.email or similar
  status: string
  totalAmount: number
  validUntil: string // This will be derived from validUntil
}

interface CostEstimate {
  id: string;
  costEstimateNumber: string;
  title: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  client_name: string;
  total_amount: number;
  status: string;
  created: Date;
  valid_until: Date;
  start_date: Date;
  end_date: Date;
  duration_days: number;
  items: { name: string; location: string }; // Single object, not array
  projectCompliance: {
    signedQuotation: {
      status: string;
    };
  };
}

interface Booking {
  id: string;
  cancel_reason: string;
  category_id: string;
  client: {
    company_id: string;
    id: string;
  };
  company_id: string;
  contract: string;
  cost: number;
  costDetails: {
    basePrice: number;
    days: number;
    discount: number;
    months: number;
    otherFees: number;
    pricePerMonth: number;
    total: number;
    vatAmount: number;
    vatRate: number;
  };
  created: Date;
  end_date: string;
  media_order: string[];
  payment_method: string;
  product_id: string;
  product_name: string;
  product_owner: string;
  promos: {
    quotation_id: string;
    rated: boolean;
  };
  requirements: Array<{
    description: string;
    fileName: string;
    fileUrl: string;
    required: boolean;
    title: string;
    type: string;
    uploadStatus: string;
  }>;
  reservation_id: string;
  seller_id: string;
  start_date: string;
  status: string;
  total_cost: number;
  type: string;
  updated: Date;
  user_id: string;
}

export default function ClientInformationPage() {
  const router = useRouter()
  const params = useParams()
  const { userData } = useAuth()
  const clientId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [costEstimates, setCostEstimates] = useState<CostEstimate[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [bookings, setBookings] = useState<Booking[]>([]) // Add bookings state
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("proposals")
  const [searchTerm, setSearchTerm] = useState("")
  const [showComplianceDialog, setShowComplianceDialog] = useState(false)
  const [showContactsDialog, setShowContactsDialog] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null) // To track which document is being uploaded
  const [companyContacts, setCompanyContacts] = useState<any[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [editingContact, setEditingContact] = useState<any | null>(null)
  const [showEditContactDialog, setShowEditContactDialog] = useState(false)
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: "",
    designation: "",
    phone: "",
    email: "",
  })
  const [showAddContactDialog, setShowAddContactDialog] = useState(false)
  const [addContactFormData, setAddContactFormData] = useState({
    name: "",
    designation: "",
    phone: "",
    email: "",
  })

  // Contact selection for proposal/ce/quotation creation
  const [showSelectContactDialog, setShowSelectContactDialog] = useState(false)
  const [selectedContact, setSelectedContact] = useState<any | null>(null)
  const [creationMode, setCreationMode] = useState<'proposal' | 'cost_estimate' | 'quotation'>('proposal')

  // Validation states for contact forms
  const [addContactValidationErrors, setAddContactValidationErrors] = useState({
    name: false,
    phone: false,
    email: false,
    phoneFormat: false,
  })

  const [editContactValidationErrors, setEditContactValidationErrors] = useState({
    name: false,
    phone: false,
    email: false,
    phoneFormat: false,
  })

  // Pagination states
  const [proposalsPage, setProposalsPage] = useState(1)
  const [proposalsTotalPages, setProposalsTotalPages] = useState(1)
  const [proposalsTotalItems, setProposalsTotalItems] = useState(0)
  const [loadingProposals, setLoadingProposals] = useState(false)

  const [costEstimatesPage, setCostEstimatesPage] = useState(1)
  const [costEstimatesTotalPages, setCostEstimatesTotalPages] = useState(1)
  const [costEstimatesTotalItems, setCostEstimatesTotalItems] = useState(0)
  const [loadingCostEstimates, setLoadingCostEstimates] = useState(false)

  const [quotationsPage, setQuotationsPage] = useState(1)
  const [quotationsTotalPages, setQuotationsTotalPages] = useState(1)
  const [quotationsTotalItems, setQuotationsTotalItems] = useState(0)
  const [loadingQuotations, setLoadingQuotations] = useState(false)

  const [reservationsPage, setReservationsPage] = useState(1)
  const [reservationsTotalPages, setReservationsTotalPages] = useState(1)
  const [reservationsTotalItems, setReservationsTotalItems] = useState(0)
  const [loadingReservations, setLoadingReservations] = useState(false)

  const ITEMS_PER_PAGE = 10

  // Refs for hidden file inputs
  const dtiBirFileInputRef = useRef<HTMLInputElement>(null)
  const gisFileInputRef = useRef<HTMLInputElement>(null)
  const idSignatureFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (clientId && userData?.company_id) {
      loadClientData()
      loadProposals(proposalsPage)
      loadCostEstimates(costEstimatesPage)
      loadQuotations(quotationsPage)
      loadBookings(reservationsPage) // Load bookings
      console.log("Calling loadBookings in useEffect"); // Log for useEffect
    }
  }, [clientId, userData?.company_id, proposalsPage, costEstimatesPage, quotationsPage, reservationsPage])

  const loadCostEstimates = async (page: number = 1) => {
    setLoadingCostEstimates(true)
    try {
      const costEstimatesCollectionRef = collection(db, "cost_estimates")

      // First, get total count
      const countQuery = query(costEstimatesCollectionRef, where("client.company_id", "==", clientId))
      const countSnapshot = await getDocs(countQuery)
      const totalItems = countSnapshot.size
      const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))

      setCostEstimatesTotalItems(totalItems)
      setCostEstimatesTotalPages(totalPages)

      // Then get paginated data
      let paginatedQuery = query(
        costEstimatesCollectionRef,
        where("client.company_id", "==", clientId),
        orderBy("createdAt", "desc"),
        limit(ITEMS_PER_PAGE)
      )

      // If not first page, add offset
      if (page > 1) {
        const offsetQuery = query(
          costEstimatesCollectionRef,
          where("client.company_id", "==", clientId),
          orderBy("createdAt", "desc"),
          limit((page - 1) * ITEMS_PER_PAGE)
        )
        const offsetSnapshot = await getDocs(offsetQuery)
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1]

        if (lastDoc) {
          paginatedQuery = query(
            costEstimatesCollectionRef,
            where("client.company_id", "==", clientId),
            orderBy("createdAt", "desc"),
            startAfter(lastDoc),
            limit(ITEMS_PER_PAGE)
          )
        }
      }

      const querySnapshot = await getDocs(paginatedQuery)

      const fetchedCostEstimates: CostEstimate[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          costEstimateNumber: data.costEstimateNumber || "",
          title: data.title || "",
          startDate: data.startDate
            ? new Date(data.startDate.toDate()).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
            : "",
          endDate: data.endDate
            ? new Date(data.endDate.toDate()).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
            : "",
          totalAmount: data.totalAmount || 0,
          status: data.status || "",
        }
      })
      setCostEstimates(fetchedCostEstimates)
    } catch (error) {
      console.error("Error loading cost estimates:", error)
      toast.error("Failed to load cost estimates")
    } finally {
      setLoadingCostEstimates(false)
      setLoading(false)
    }
  }

  const loadClientData = async () => {
    try {
      const docRef = doc(db, "client_company", clientId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        setCompany({
          id: docSnap.id,
          name: data.name || "",
          address: data.address || "",
          industry: data.industry || "",
          clientType: data.clientType || "",
          partnerType: data.partnerType || "",
          companyLogoUrl: data.companyLogoUrl || "",
          contactPersons: data.contactPersons || [],
          compliance: {
            dti: data.compliance?.dti || "",
            gis: data.compliance?.gis || "",
            id: data.compliance?.id || "",
            uploadedAt: data.compliance?.uploadedAt?.toDate(),
            uploadedBy: data.compliance?.uploadedBy || "",
          },
        })
      } else {
        toast.error("Client not found")
        router.push("/sales/clients")
      }
    } catch (error) {
      console.error("Error loading client data:", error)
      toast.error("Failed to load client data")
    } finally {
      setLoading(false)
    }
  }

  const loadProposals = async (page: number = 1) => {
    setLoadingProposals(true)
    try {
      const proposalsCollectionRef = collection(db, "proposals")

      // First, get total count
      const countQuery = query(proposalsCollectionRef, where("client.company_id", "==", clientId))
      const countSnapshot = await getDocs(countQuery)
      const totalItems = countSnapshot.size
      const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))

      setProposalsTotalItems(totalItems)
      setProposalsTotalPages(totalPages)

      // Then get paginated data
      let paginatedQuery = query(
        proposalsCollectionRef,
        where("client.company_id", "==", clientId),
        orderBy("createdAt", "desc"),
        limit(ITEMS_PER_PAGE)
      )

      // If not first page, add offset
      if (page > 1) {
        const offsetQuery = query(
          proposalsCollectionRef,
          where("client.company_id", "==", clientId),
          orderBy("createdAt", "desc"),
          limit((page - 1) * ITEMS_PER_PAGE)
        )
        const offsetSnapshot = await getDocs(offsetQuery)
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1]

        if (lastDoc) {
          paginatedQuery = query(
            proposalsCollectionRef,
            where("client.company_id", "==", clientId),
            orderBy("createdAt", "desc"),
            startAfter(lastDoc),
            limit(ITEMS_PER_PAGE)
          )
        }
      }

      const querySnapshot = await getDocs(paginatedQuery)

      const fetchedProposals: Proposal[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          proposalNumber: data.proposalNumber || "",
          title: data.title || "",
          date: data.createdAt
            ? new Date(data.createdAt.toDate()).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
            : "",
          sites: data.products?.length || 0,
          sentTo: data.client?.email || "",
          status: data.status || "",
          totalAmount: data.totalAmount || 0,
          validUntil: data.validUntil ? new Date(data.validUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "",
        }
      })
      setProposals(fetchedProposals)
    } catch (error) {
      console.error("Error loading proposals:", error)
      toast.error("Failed to load proposals")
    } finally {
      setLoadingProposals(false)
      setLoading(false)
    }
  }

  const loadQuotations = async (page: number = 1) => {
    setLoadingQuotations(true)
    try {
      const quotationsCollectionRef = collection(db, "quotations")

      // First, get total count
      const countQuery = query(quotationsCollectionRef, where("client_company_id", "==", clientId))
      const countSnapshot = await getDocs(countQuery)
      const totalItems = countSnapshot.size
      const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))

      setQuotationsTotalItems(totalItems)
      setQuotationsTotalPages(totalPages)

      // Then get paginated data
      let paginatedQuery = query(
        quotationsCollectionRef,
        where("client_company_id", "==", clientId),
        orderBy("created", "desc"),
        limit(ITEMS_PER_PAGE)
      )

      // If not first page, add offset
      if (page > 1) {
        const offsetQuery = query(
          quotationsCollectionRef,
          where("client_company_id", "==", clientId),
          orderBy("created", "desc"),
          limit((page - 1) * ITEMS_PER_PAGE)
        )
        const offsetSnapshot = await getDocs(offsetQuery)
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1]

        if (lastDoc) {
          paginatedQuery = query(
            quotationsCollectionRef,
            where("client_company_id", "==", clientId),
            orderBy("created", "desc"),
            startAfter(lastDoc),
            limit(ITEMS_PER_PAGE)
          )
        }
      }

      const querySnapshot = await getDocs(paginatedQuery)

      const fetchedQuotations: Quotation[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()

        return {
          id: doc.id,
          quotation_number: data.quotation_number || "",
          client_name: data.client_name || "",
          total_amount: data.total_amount || 0,
          status: data.status || "",
          created: data.created ? data.created.toDate() : new Date(),
          valid_until: data.valid_until ? data.valid_until.toDate() : new Date(),
          start_date: data.start_date || "",
          end_date: data.end_date || "",
          duration_days: data.duration_days || 0,
          items: data.items || [],
          projectCompliance: data.projectCompliance || { signedQuotation: { status: "pending" } },
        }
      })
      console.log(`Quotations for client:`, fetchedQuotations); // Log for quotations
      setQuotations(fetchedQuotations)
    } catch (error) {
      console.error("Error loading quotations:", error)
      toast.error("Failed to load quotations")
    } finally {
      setLoadingQuotations(false)
      setLoading(false)
    }
  }

  const loadBookings = async (page: number = 1) => {
    setLoadingReservations(true)
    try {
      const bookingsCollectionRef = collection(db, "booking")

      // First, get total count
      const countQuery = query(bookingsCollectionRef, where("client.company_id", "==", clientId))
      const countSnapshot = await getDocs(countQuery)
      const totalItems = countSnapshot.size
      const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))

      setReservationsTotalItems(totalItems)
      setReservationsTotalPages(totalPages)

      // Then get paginated data
      let paginatedQuery = query(
        bookingsCollectionRef,
        where("client.company_id", "==", clientId),
        orderBy("created", "desc"),
        limit(ITEMS_PER_PAGE)
      )

      // If not first page, add offset
      if (page > 1) {
        const offsetQuery = query(
          bookingsCollectionRef,
          where("client.company_id", "==", clientId),
          orderBy("created", "desc"),
          limit((page - 1) * ITEMS_PER_PAGE)
        )
        const offsetSnapshot = await getDocs(offsetQuery)
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1]

        if (lastDoc) {
          paginatedQuery = query(
            bookingsCollectionRef,
            where("client.company_id", "==", clientId),
            orderBy("created", "desc"),
            startAfter(lastDoc),
            limit(ITEMS_PER_PAGE)
          )
        }
      }

      const querySnapshot = await getDocs(paginatedQuery)

      const fetchedBookings: Booking[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          cancel_reason: data.cancel_reason || "",
          category_id: data.category_id || "",
          client: data.client || { company_id: "", id: "" },
          company_id: data.company_id || "",
          contract: data.contract || "",
          cost: data.cost || 0,
          costDetails: data.costDetails || {
            basePrice: 0,
            days: 0,
            discount: 0,
            months: 0,
            otherFees: 0,
            pricePerMonth: 0,
            total: 0,
            vatAmount: 0,
            vatRate: 0,
          },
          created: data.created ? data.created.toDate() : new Date(),
          end_date: data.end_date
            ? (data.end_date.toDate
              ? new Date(data.end_date.toDate()).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
              : new Date(data.end_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }))
            : "",
          media_order: data.media_order || [],
          payment_method: data.payment_method || "",
          product_id: data.product_id || "",
          product_owner: data.product_owner || "",
          product_name: data.product_name || "",
          promos: data.promos || { quotation_id: "", rated: false },
          requirements: data.requirements || [],
          reservation_id: data.reservation_id || "",
          seller_id: data.seller_id || "",
          start_date: data.start_date
            ? (data.start_date.toDate
              ? new Date(data.start_date.toDate()).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
              : new Date(data.start_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }))
            : "",
          status: data.status || "",
          total_cost: data.total_cost || 0,
          type: data.type || "",
          updated: data.updated ? data.updated.toDate() : new Date(),
          user_id: data.user_id || "",
        }
      })
      console.log(`Bookings for client:`, fetchedBookings); // Log for bookings
      setBookings(fetchedBookings)
    } catch (error) {
      console.error("Error loading bookings:", error)
      toast.error("Failed to load bookings")
    } finally {
      setLoadingReservations(false)
      setLoading(false)
    }
  }

  const loadCompanyContacts = async () => {
    if (!company) return

    setLoadingContacts(true)
    try {
      const clientsCollectionRef = collection(db, "client_db")
      // Query for contacts that belong to this company and are not soft-deleted
      const q = query(
        clientsCollectionRef,
        where("company_id", "==", clientId),
        where("deleted", "==", false)
      )
      const querySnapshot = await getDocs(q)

      const fetchedContacts: any[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          designation: data.designation || "",
          status: data.status || "",
          created: data.created ? data.created.toDate() : new Date(),
        }
      })

      setCompanyContacts(fetchedContacts)
      setShowContactsDialog(true)
    } catch (error) {
      console.error("Error loading company contacts:", error)
      toast.error("Failed to load company contacts")
    } finally {
      setLoadingContacts(false)
    }
  }

  const loadContactsForProposal = async () => {
    setLoadingContacts(true)
    try {
      const clientsCollectionRef = collection(db, "client_db")
      const q = query(
        clientsCollectionRef,
        where("company_id", "==", clientId),
        where("deleted", "==", false)
      )
      const querySnapshot = await getDocs(q)

      const fetchedContacts: any[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          designation: data.designation || "",
          status: data.status || "",
          created: data.created ? data.created.toDate() : new Date(),
        }
      })

      setCompanyContacts(fetchedContacts)
    } catch (error) {
      console.error("Error loading contacts for proposal:", error)
      toast.error("Failed to load contacts")
    } finally {
      setLoadingContacts(false)
    }
  }

  const handleEditContact = (contact: any) => {
    setEditingContact(contact)
    setEditFormData({
      name: contact.name || "",
      designation: contact.designation || "",
      phone: contact.phone || "",
      email: contact.email || "",
    })
    // Reset validation errors
    setEditContactValidationErrors({
      name: false,
      phone: false,
      email: false,
      phoneFormat: false,
    })
    setShowEditContactDialog(true)
  }

  const handleDeleteContact = (contact: any) => {
    setContactToDelete(contact)
    setShowDeleteContactDialog(true)
  }

  const handleSaveContactEdit = async () => {
    if (!editingContact) return

    // Validation
    let hasErrors = false
    const newValidationErrors = { ...editContactValidationErrors }

    if (!editFormData.name.trim()) {
      newValidationErrors.name = true
      hasErrors = true
    } else {
      newValidationErrors.name = false
    }

    if (!editFormData.phone.trim()) {
      newValidationErrors.phone = true
      hasErrors = true
    } else {
      newValidationErrors.phone = false
    }

    if (!editFormData.email.trim()) {
      newValidationErrors.email = true
      hasErrors = true
    } else {
      newValidationErrors.email = false
    }

    // Validate phone format (only if phone is provided and has content beyond +63)
    if (editFormData.phone.trim()) {
      if (editFormData.phone === '+63') {
        // If only +63 is entered, it's incomplete
        newValidationErrors.phoneFormat = true
        hasErrors = true
      } else if (!validatePhoneFormat(editFormData.phone)) {
        // If format is invalid
        newValidationErrors.phoneFormat = true
        hasErrors = true
      } else {
        newValidationErrors.phoneFormat = false
      }
    } else {
      newValidationErrors.phoneFormat = false
    }

    setEditContactValidationErrors(newValidationErrors)

    if (hasErrors) {
      toast.error("Please fill in all required fields correctly")
      return
    }

    try {
      const contactRef = doc(db, "client_db", editingContact.id)
      await updateDoc(contactRef, {
        name: editFormData.name,
        designation: editFormData.designation,
        phone: editFormData.phone,
        email: editFormData.email,
        updated: new Date(),
      })

      // Update the local state
      setCompanyContacts(prev =>
        prev.map(contact =>
          contact.id === editingContact.id
            ? { ...contact, ...editFormData }
            : contact
        )
      )

      setShowEditContactDialog(false)
      setEditingContact(null)
      toast.success("Contact updated successfully")
    } catch (error) {
      console.error("Error updating contact:", error)
      toast.error("Failed to update contact")
    }
  }

  const handleConfirmDeleteContact = async () => {
    if (!contactToDelete) return

    try {
      // Soft delete - update the deleted field instead of permanently deleting
      const contactRef = doc(db, "client_db", contactToDelete.id)
      await updateDoc(contactRef, {
        deleted: true,
        updated: new Date(),
      })

      // Update the local state to remove the contact from the UI
      setCompanyContacts(prev =>
        prev.filter(contact => contact.id !== contactToDelete.id)
      )

      setShowDeleteContactDialog(false)
      setContactToDelete(null)
      toast.success("Contact deleted successfully")
    } catch (error) {
      console.error("Error deleting contact:", error)
      toast.error("Failed to delete contact")
    }
  }

  const handleAddContact = () => {
    setAddContactFormData({
      name: "",
      designation: "",
      phone: "",
      email: "",
    })
    // Reset validation errors
    setAddContactValidationErrors({
      name: false,
      phone: false,
      email: false,
      phoneFormat: false,
    })
    setShowAddContactDialog(true)
  }

  // Phone validation function
  const validatePhoneFormat = (phone: string): boolean => {
    // Check if phone is exactly +63 followed by 10 digits (Philippines mobile format)
    const phoneRegex = /^\+63\d{10}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  // Format industry text from snake_case to Title Case
  const formatIndustryText = (industry: string | undefined): string => {
    if (!industry) return "Advertising"
    return industry
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Handle phone input for add contact form
  const handleAddContactPhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\s/g, '') // Remove spaces

    // Always ensure +63 prefix is present
    if (!value.startsWith('+63')) {
      if (value && /^\d/.test(value)) {
        // If user types digits, add +63 prefix
        value = '+63' + value.replace(/\D/g, '').substring(0, 10)
      } else {
        // If empty or doesn't start with digits, set to +63
        value = '+63'
      }
    } else {
      // If it starts with +63, ensure only digits after and limit to 10
      const digitsAfterPrefix = value.substring(3).replace(/\D/g, '') // Remove non-digits
      value = '+63' + digitsAfterPrefix.substring(0, 10) // Limit to 10 digits
    }

    // Update form data
    setAddContactFormData((prev) => ({ ...prev, phone: value }))

    // Clear validation errors when user types
    if (addContactValidationErrors.phoneFormat || addContactValidationErrors.phone) {
      setAddContactValidationErrors((prev) => ({
        ...prev,
        phoneFormat: false,
        phone: false
      }))
    }
  }

  // Handle phone input for edit contact form
  const handleEditContactPhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\s/g, '') // Remove spaces

    // Always ensure +63 prefix is present
    if (!value.startsWith('+63')) {
      if (value && /^\d/.test(value)) {
        // If user types digits, add +63 prefix
        value = '+63' + value.replace(/\D/g, '').substring(0, 10)
      } else {
        // If empty or doesn't start with digits, set to +63
        value = '+63'
      }
    } else {
      // If it starts with +63, ensure only digits after and limit to 10
      const digitsAfterPrefix = value.substring(3).replace(/\D/g, '') // Remove non-digits
      value = '+63' + digitsAfterPrefix.substring(0, 10) // Limit to 10 digits
    }

    // Update form data
    setEditFormData((prev) => ({ ...prev, phone: value }))

    // Clear validation errors when user types
    if (editContactValidationErrors.phoneFormat || editContactValidationErrors.phone) {
      setEditContactValidationErrors((prev) => ({
        ...prev,
        phoneFormat: false,
        phone: false
      }))
    }
  }

  const handleSaveNewContact = async () => {
    if (!company) return

    // Validation
    let hasErrors = false
    const newValidationErrors = { ...addContactValidationErrors }

    if (!addContactFormData.name.trim()) {
      newValidationErrors.name = true
      hasErrors = true
    } else {
      newValidationErrors.name = false
    }

    if (!addContactFormData.phone.trim()) {
      newValidationErrors.phone = true
      hasErrors = true
    } else {
      newValidationErrors.phone = false
    }

    if (!addContactFormData.email.trim()) {
      newValidationErrors.email = true
      hasErrors = true
    } else {
      newValidationErrors.email = false
    }

    // Validate phone format (only if phone is provided and has content beyond +63)
    if (addContactFormData.phone.trim()) {
      if (addContactFormData.phone === '+63') {
        // If only +63 is entered, it's incomplete
        newValidationErrors.phoneFormat = true
        hasErrors = true
      } else if (!validatePhoneFormat(addContactFormData.phone)) {
        // If format is invalid
        newValidationErrors.phoneFormat = true
        hasErrors = true
      } else {
        newValidationErrors.phoneFormat = false
      }
    } else {
      newValidationErrors.phoneFormat = false
    }

    setAddContactValidationErrors(newValidationErrors)

    if (hasErrors) {
      toast.error("Please fill in all required fields correctly")
      return
    }

    try {
      const newContactData = {
        name: addContactFormData.name,
        designation: addContactFormData.designation,
        phone: addContactFormData.phone,
        email: addContactFormData.email,
        company: company.name,
        company_id: company.id,
        status: "lead",
        notes: "",
        city: "",
        state: "",
        zipCode: "",
        uploadedBy: userData?.uid || "",
        uploadedByName: userData?.displayName || userData?.email || "",
        user_company_id: userData?.company_id || "",
        deleted: false, // Ensure new contacts are not marked as deleted
        created: new Date(),
        updated: new Date(),
      }

      const docRef = await addDoc(collection(db, "client_db"), newContactData)

      // Add to local state
      const newContact = {
        id: docRef.id,
        ...newContactData,
      }

      setCompanyContacts(prev => [...prev, newContact])
      setShowAddContactDialog(false)
      toast.success("Contact added successfully")
    } catch (error) {
      console.error("Error adding contact:", error)
      toast.error("Failed to add contact")
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      "Open Inquiry": "bg-gray-100 text-gray-800",
      "For Cost Estimate": "bg-green-100 text-green-800",
      Approved: "bg-blue-100 text-blue-800",
      Rejected: "bg-red-100 text-red-800",
      COMPLETED: "bg-green-500 text-white", // Added for bookings
      CANCELLED: "bg-red-500 text-white", // Added for bookings
      PENDING: "bg-yellow-500 text-white", // Added for bookings
      Ongoing: "bg-gray-500 text-white", // Added for bookings
      Done: "bg-green-500 text-white", // Added for bookings
    }

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
        {status}
      </Badge>
    )
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentKey: 'dti' | 'gis' | 'id') => {
    const file = e.target.files?.[0]
    if (!file || !company || !userData?.uid) {
      toast.error("No file selected or user not authenticated.")
      return
    }

    setUploadingDocument(documentKey)
    try {
      const uploadPath = `compliance_documents/${company.id}/${documentKey}/`
      const downloadUrl = await uploadFileToFirebaseStorage(file, uploadPath)

      const companyRef = doc(db, "client_company", company.id)
      await updateDoc(companyRef, {
        [`compliance.${documentKey}`]: downloadUrl,
        'compliance.uploadedAt': new Date(),
        'compliance.uploadedBy': userData.uid,
      })

      setCompany((prev) => {
        if (!prev) return null
        return {
          ...prev,
          compliance: {
            ...prev.compliance,
            [documentKey]: downloadUrl,
            uploadedAt: new Date(),
            uploadedBy: userData.uid,
          },
        }
      })
      toast.success(`${documentKey.toUpperCase()} uploaded successfully!`)
    } catch (error) {
      console.error(`Error uploading ${documentKey}:`, error)
      toast.error(`Failed to upload ${documentKey.toUpperCase()}.`)
    } finally {
      setUploadingDocument(null)
      // Clear the file input value to allow re-uploading the same file
      e.target.value = ""
    }
  }

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) {
      ref.current.click()
    }
  }

  const truncateFileName = (fileName: string, maxLength: number = 10) => {
    return fileName.length > maxLength ? fileName.substring(0, maxLength) + '...' : fileName;
  }

  const filteredProposals = proposals.filter(
    (proposal) =>
    (proposal.proposalNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.title?.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const filteredBookings = bookings.filter( // Added for bookings
    (booking) =>
      booking.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.product_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Card className="p-6">
            <div className="flex items-start space-x-4">
              <Skeleton className="w-20 h-20 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Client not found</p>
          <Button onClick={() => router.push("/sales/clients")} className="mt-4">
            Back to Clients
          </Button>
        </div>
      </div>
    )
  }

  const primaryContact = company.contactPersons?.[0]

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/sales/clients")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Client Information</h1>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hidden">
          <Edit className="h-4 w-4" />
        </Button>
      </div>

      {/* Client Information Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-red-500 flex items-center justify-center">
                {company.companyLogoUrl ? (
                  <img
                    src={company.companyLogoUrl || "/placeholder.svg"}
                    alt={company.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-white font-bold text-lg">{company.name.charAt(0)}</div>
                )}
              </div>
              <div className="space-y-1">
                <div>
                  <span className="font-semibold text-gray-900">Company Name: </span>
                  <span className="text-gray-700">{company.name}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Category: </span>
                  <span className="text-gray-700">
                    {company.clientType === "partner" ? "Partners" : "Brand"} - {company.partnerType || "Operator"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Industry: </span>
                  <span className="text-gray-700">{formatIndustryText(company.industry)}</span>
                </div>
                {primaryContact && (
                  <>
                    <div>
                      <span className="font-semibold text-gray-900">Contact Person: </span>
                      <span className="text-gray-700">{primaryContact.name}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Contact Details: </span>
                      <span className="text-gray-700">
                        {primaryContact.phone} / {primaryContact.email}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="font-semibold text-gray-900">Address: </span>
                  <span className="text-gray-700">{company.address}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowComplianceDialog(true)}>Corporate Compliance Docs</Button>
              <Button variant="outline" onClick={loadCompanyContacts} disabled={loadingContacts}>
                {loadingContacts ? "Loading..." : "View Contacts"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Compliance Documents Dialog */}
      <Dialog open={showComplianceDialog} onOpenChange={setShowComplianceDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Corporate Compliance Requirements</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
          <div className="grid gap-1 p-4">
            {/* DTI/ BIR 2303 */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                {company.compliance?.dti ? (
                  <div className="h-5 w-5 bg-green-500 rounded-sm flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <div className="h-5 w-5 border border-gray-300 rounded-sm" />
                )}
                <label htmlFor="dti-bir" className="text-sm font-medium leading-none">
                  DTI/ BIR 2303
                </label>
              </div>
              {company.compliance?.dti ? (
                <div className="flex items-center space-x-2">
                  <a href={company.compliance.dti} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                    {truncateFileName(decodeURIComponent(company.compliance.dti).split('/').pop()?.split('?')[0] || 'DTI/BIR 2303.pdf')}
                  </a>
                  <Edit className="h-4 w-4 text-gray-500 cursor-pointer" onClick={() => triggerFileInput(dtiBirFileInputRef)} />
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8" onClick={() => triggerFileInput(dtiBirFileInputRef)} disabled={uploadingDocument === "dti"}>
                  {uploadingDocument === "dti" ? "Uploading..." : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
                </Button>
              )}
            </div>

            {/* GIS */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                {company.compliance?.gis ? (
                  <div className="h-5 w-5 bg-green-500 rounded-sm flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <div className="h-5 w-5 border border-gray-300 rounded-sm" />
                )}
                <label htmlFor="gis" className="text-sm font-medium leading-none">
                  GIS
                </label>
              </div>
              {company.compliance?.gis ? (
                <div className="flex items-center space-x-2">
                  <a href={company.compliance.gis} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                    {truncateFileName(decodeURIComponent(company.compliance.gis).split('/').pop()?.split('?')[0] || 'GIS.pdf')}
                  </a>
                  <Edit className="h-4 w-4 text-gray-500 cursor-pointer" onClick={() => triggerFileInput(gisFileInputRef)} />
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8" onClick={() => triggerFileInput(gisFileInputRef)} disabled={uploadingDocument === "gis"}>
                  {uploadingDocument === "gis" ? "Uploading..." : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
                </Button>
              )}
            </div>

            {/* ID with signature */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                {company.compliance?.id ? (
                  <div className="h-5 w-5 bg-green-500 rounded-sm flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <div className="h-5 w-5 border border-gray-300 rounded-sm" />
                )}
                <label htmlFor="id-signature" className="text-sm font-medium leading-none">
                  ID with signature
                </label>
              </div>
              {company.compliance?.id ? (
                <div className="flex items-center space-x-2">
                  <a href={company.compliance.id} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                    {truncateFileName(decodeURIComponent(company.compliance.id).split('/').pop()?.split('?')[0] || 'ID_with_signature.pdf')}
                  </a>
                  <Edit className="h-4 w-4 text-gray-500 cursor-pointer" onClick={() => triggerFileInput(idSignatureFileInputRef)} />
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8" onClick={() => triggerFileInput(idSignatureFileInputRef)} disabled={uploadingDocument === "id"}>
                  {uploadingDocument === "id" ? "Uploading..." : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
                </Button>
              )}
            </div>
          </div>

          {/* Hidden file inputs */}
          <input
            type="file"
            ref={dtiBirFileInputRef}
            onChange={(e) => handleFileUpload(e, "dti")}
            className="hidden"
            accept="application/pdf,image/*"
          />
          <input
            type="file"
            ref={gisFileInputRef}
            onChange={(e) => handleFileUpload(e, "gis")}
            className="hidden"
            accept="application/pdf,image/*"
          />
          <input
            type="file"
            ref={idSignatureFileInputRef}
            onChange={(e) => handleFileUpload(e, "id")}
            className="hidden"
            accept="application/pdf,image/*"
          />
        </DialogContent>
      </Dialog>

      {/* View Contacts Dialog */}
      <Dialog open={showContactsDialog} onOpenChange={setShowContactsDialog}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Company Contacts</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{company?.name} - Contacts</h3>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm">
                  Total: {companyContacts.length}
                </Badge>
                <Button onClick={handleAddContact} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            </div>

            {companyContacts.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium text-gray-700">Name</TableHead>
                      <TableHead className="font-medium text-gray-700">Designation</TableHead>
                      <TableHead className="font-medium text-gray-700">Contact Details</TableHead>
                      <TableHead className="font-medium text-gray-700">Status</TableHead>
                      <TableHead className="font-medium text-gray-700">Created</TableHead>
                      <TableHead className="font-medium text-gray-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium text-gray-900">{contact.name}</TableCell>
                        <TableCell className="text-gray-700">{contact.designation || "N/A"}</TableCell>
                        <TableCell className="text-gray-700">
                          <div className="space-y-1">
                            <div className="text-sm">{contact.email}</div>
                            <div className="text-sm text-gray-500">{contact.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${contact.status === "active"
                                ? "bg-green-100 text-green-800"
                                : contact.status === "inactive"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {contact.status || "lead"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(contact.created).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditContact(contact)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteContact(contact)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No contacts found for this company.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={showEditContactDialog} onOpenChange={setShowEditContactDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Edit Contact</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>

          <div className="py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, name: e.target.value })
                    if (editContactValidationErrors.name) {
                      setEditContactValidationErrors({ ...editContactValidationErrors, name: false })
                    }
                  }}
                  placeholder="Contact name"
                  className={editContactValidationErrors.name ? 'border-red-500 focus:border-red-500' : ''}
                />
                {editContactValidationErrors.name && (
                  <p className="text-sm text-red-500">Name is required</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-designation">Designation</Label>
                <Input
                  id="edit-designation"
                  value={editFormData.designation}
                  onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                  placeholder="Job title/designation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone *</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={handleEditContactPhoneInput}
                  placeholder="Enter 10 digits"
                  className={(editContactValidationErrors.phone || editContactValidationErrors.phoneFormat) ? 'border-red-500 focus:border-red-500' : ''}
                />
                {editContactValidationErrors.phone && (
                  <p className="text-sm text-red-500">Phone number is required</p>
                )}
                {editContactValidationErrors.phoneFormat && !editContactValidationErrors.phone && (
                  <p className="text-sm text-red-500">Please enter exactly 10 digits</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, email: e.target.value })
                    if (editContactValidationErrors.email) {
                      setEditContactValidationErrors({ ...editContactValidationErrors, email: false })
                    }
                  }}
                  placeholder="Email address"
                  className={editContactValidationErrors.email ? 'border-red-500 focus:border-red-500' : ''}
                />
                {editContactValidationErrors.email && (
                  <p className="text-sm text-red-500">Email address is required</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditContactDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContactEdit} className="bg-blue-600 hover:bg-blue-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Confirmation Dialog */}
      <Dialog open={showDeleteContactDialog} onOpenChange={setShowDeleteContactDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Delete Contact</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-gray-700">
              Are you sure you want to delete the contact{" "}
              <span className="font-semibold text-gray-900">
                {contactToDelete?.name}
              </span>
              ? This action cannot be undone.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteContactDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeleteContact}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContactDialog} onOpenChange={setShowAddContactDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Add New Contact</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>

          <div className="py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name *</Label>
                <Input
                  id="add-name"
                  value={addContactFormData.name}
                  onChange={(e) => {
                    setAddContactFormData({ ...addContactFormData, name: e.target.value })
                    if (addContactValidationErrors.name) {
                      setAddContactValidationErrors({ ...addContactValidationErrors, name: false })
                    }
                  }}
                  placeholder="Contact name"
                  className={addContactValidationErrors.name ? 'border-red-500 focus:border-red-500' : ''}
                  required
                />
                {addContactValidationErrors.name && (
                  <p className="text-sm text-red-500">Name is required</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-designation">Designation</Label>
                <Input
                  id="add-designation"
                  value={addContactFormData.designation}
                  onChange={(e) => setAddContactFormData({ ...addContactFormData, designation: e.target.value })}
                  placeholder="Job title/designation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone *</Label>
                <Input
                  id="add-phone"
                  value={addContactFormData.phone}
                  onChange={handleAddContactPhoneInput}
                  placeholder="Enter 10 digits"
                  className={(addContactValidationErrors.phone || addContactValidationErrors.phoneFormat) ? 'border-red-500 focus:border-red-500' : ''}
                />
                {addContactValidationErrors.phone && (
                  <p className="text-sm text-red-500">Phone number is required</p>
                )}
                {addContactValidationErrors.phoneFormat && !addContactValidationErrors.phone && (
                  <p className="text-sm text-red-500">Please enter exactly 10 digits</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-email">Email *</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={addContactFormData.email}
                  onChange={(e) => {
                    setAddContactFormData({ ...addContactFormData, email: e.target.value })
                    if (addContactValidationErrors.email) {
                      setAddContactValidationErrors({ ...addContactValidationErrors, email: false })
                    }
                  }}
                  placeholder="Email address"
                  className={addContactValidationErrors.email ? 'border-red-500 focus:border-red-500' : ''}
                  required
                />
                {addContactValidationErrors.email && (
                  <p className="text-sm text-red-500">Email address is required</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContactDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewContact} className="bg-blue-600 hover:bg-blue-700">
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Contact Dialog */}
      <Dialog open={showSelectContactDialog} onOpenChange={setShowSelectContactDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Select Contact for {creationMode === 'proposal' ? 'Proposal' : creationMode === 'cost_estimate' ? 'Cost Estimate' : 'Quotation'}
            </DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
            </DialogClose>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Please select a contact person for this {creationMode === 'proposal' ? 'proposal' : creationMode === 'cost_estimate' ? 'cost estimate' : 'quotation'}. The document will be associated with the selected contact.
            </p>

            {loadingContacts ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading contacts...</p>
              </div>
            ) : companyContacts.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium text-gray-700">Name</TableHead>
                      <TableHead className="font-medium text-gray-700">Designation</TableHead>
                      <TableHead className="font-medium text-gray-700">Email</TableHead>
                      <TableHead className="font-medium text-gray-700">Select</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium text-gray-900">{contact.name}</TableCell>
                        <TableCell className="text-gray-700">{contact.designation || "N/A"}</TableCell>
                        <TableCell className="text-gray-700">{contact.email}</TableCell>
                        <TableCell>
                          <Button
                            variant={selectedContact?.id === contact.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedContact(contact)}
                            className={selectedContact?.id === contact.id ? "bg-blue-600 hover:bg-blue-700" : ""}
                          >
                            {selectedContact?.id === contact.id ? "Selected" : "Select"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No contacts found for this company.</p>
                <p className="text-sm">Please add contacts first.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelectContactDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedContact) {
                  router.push(`/sales/dashboard?mode=${creationMode}&clientId=${selectedContact.id}`)
                  setShowSelectContactDialog(false)
                  setSelectedContact(null)
                }
              }}
              disabled={!selectedContact}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create {creationMode === 'proposal' ? 'Proposal' : creationMode === 'cost_estimate' ? 'Cost Estimate' : 'Quotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="proposals" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Proposals
          </TabsTrigger>
          <TabsTrigger value="cost-estimates">Cost Estimates</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search proposals..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      loadContactsForProposal()
                      setCreationMode('proposal')
                      setShowSelectContactDialog(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Proposal</span>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total: {proposalsTotalItems}</span>
                  <span className="text-sm text-gray-500">All Time</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposal ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Site Name</TableHead>
                    <TableHead>Sent To</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>{proposal.proposalNumber}</TableCell>
                      <TableCell>{proposal.date}</TableCell>
                      <TableCell>({proposal.sites}) Sites</TableCell>
                      <TableCell>{proposal.sentTo}</TableCell>
                      <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {proposalsTotalPages > 1 && (
                <div className="flex items-center justify-center mt-6">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProposalsPage(prev => Math.max(1, prev - 1))}
                      disabled={proposalsPage === 1 || loadingProposals}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {proposalsPage} of {proposalsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProposalsPage(prev => Math.min(proposalsTotalPages, prev + 1))}
                      disabled={proposalsPage === proposalsTotalPages || loadingProposals}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-estimates" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search cost estimates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      loadContactsForProposal()
                      setCreationMode('cost_estimate')
                      setShowSelectContactDialog(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Cost Estimate</span>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total: {costEstimatesTotalItems}</span>
                  <span className="text-sm text-gray-500">All Time</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cost Estimate ID</TableHead>
                    <TableHead>Site Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costEstimates.filter(
                    (ce) =>
                      ce.costEstimateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      ce.title?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((costEstimate) => (
                    <TableRow key={costEstimate.id}>
                      <TableCell className="text-blue-600 font-medium">{costEstimate.costEstimateNumber}</TableCell>
                      <TableCell>{costEstimate.title}</TableCell>
                      <TableCell>{costEstimate.startDate}</TableCell>
                      <TableCell>{costEstimate.endDate}</TableCell>
                      <TableCell>{costEstimate.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</TableCell>
                      <TableCell>{getStatusBadge(costEstimate.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {costEstimatesTotalPages > 1 && (
                <div className="flex items-center justify-center mt-6">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCostEstimatesPage(prev => Math.max(1, prev - 1))}
                      disabled={costEstimatesPage === 1 || loadingCostEstimates}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {costEstimatesPage} of {costEstimatesTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCostEstimatesPage(prev => Math.min(costEstimatesTotalPages, prev + 1))}
                      disabled={costEstimatesPage === costEstimatesTotalPages || loadingCostEstimates}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Quotations Tab */}
        <TabsContent value="quotations" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search quotations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      loadContactsForProposal()
                      setCreationMode('quotation')
                      setShowSelectContactDialog(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Quotation</span>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total: {quotationsTotalItems}</span>
                  <span className="text-sm text-gray-500">All Time</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Site Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.filter(
                    (quotation) =>
                      quotation.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      quotation.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell>{quotation.quotation_number}</TableCell>
                      <TableCell>
                        {new Date(quotation.created).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{quotation.items?.name || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(
                          quotation.start_date.toDate
                            ? quotation.start_date.toDate()
                            : quotation.start_date.seconds * 1000
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        to{" "}
                        {new Date(
                          quotation.end_date.toDate
                            ? quotation.end_date.toDate()
                            : quotation.end_date.seconds * 1000
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <br />
                        ({Math.floor(quotation.duration_days / 30)}{" "}
                        months and {quotation.duration_days % 30} days)
                      </TableCell>
                      <TableCell>{quotation.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</TableCell>
                      <TableCell>
                        <Badge
                          className={`${quotation.status === "Expired"
                              ? "bg-gray-200 text-gray-800"
                              : "bg-green-100 text-green-800"
                            } rounded-md px-2 py-1 text-xs font-medium`}
                        >
                          {quotation.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {quotationsTotalPages > 1 && (
                <div className="flex items-center justify-center mt-6">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuotationsPage(prev => Math.max(1, prev - 1))}
                      disabled={quotationsPage === 1 || loadingQuotations}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {quotationsPage} of {quotationsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuotationsPage(prev => Math.min(quotationsTotalPages, prev + 1))}
                      disabled={quotationsPage === quotationsTotalPages || loadingQuotations}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search reservations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Total: {reservationsTotalItems}</span>
                  <span className="text-sm text-gray-500">All Time</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reservation ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Site Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => {
                    const startDate = new Date(booking.start_date);
                    const endDate = new Date(booking.end_date);
                    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const diffMonths = Math.floor(diffDays / 30);
                    const remainingDays = diffDays % 30;

                    return (
                      <TableRow key={booking.id}>
                        <TableCell className="text-blue-600 font-medium">{booking.reservation_id}</TableCell>
                        <TableCell>
                          {booking.start_date}
                        </TableCell>
                        <TableCell>{booking.product_name}</TableCell>
                        <TableCell>
                          {startDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })} to{" "}
                          {endDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          <br />
                          ({diffMonths} months and {remainingDays} days)
                        </TableCell>
                        <TableCell>{booking.costDetails.total.toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {reservationsTotalPages > 1 && (
                <div className="flex items-center justify-center mt-6">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReservationsPage(prev => Math.max(1, prev - 1))}
                      disabled={reservationsPage === 1 || loadingReservations}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {reservationsPage} of {reservationsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReservationsPage(prev => Math.min(reservationsTotalPages, prev + 1))}
                      disabled={reservationsPage === reservationsTotalPages || loadingReservations}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
