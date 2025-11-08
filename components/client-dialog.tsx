"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react" // Import useRef
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient, updateClient, type Client, type ClientCompany } from "@/lib/client-service"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service" // Import the upload function
import { useAuth } from "@/contexts/auth-context" // Import useAuth
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"

interface ClientDialogProps {
  client?: Client
  onSuccess?: (client: Client) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientDialog({ client, onSuccess, open, onOpenChange }: ClientDialogProps) {
  const { userData } = useAuth() // Get current user from auth context
  const [loading, setLoading] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null) // Ref for hidden file input

  const [companies, setCompanies] = useState<ClientCompany[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")

  // Compliance file states
  const [complianceFiles, setComplianceFiles] = useState({
    dti: null as File | null,
    gis: null as File | null,
    id: null as File | null,
  })

  // File input refs for compliance documents
  const dtiFileInputRef = useRef<HTMLInputElement>(null)
  const gisFileInputRef = useRef<HTMLInputElement>(null)
  const idFileInputRef = useRef<HTMLInputElement>(null)


  const [formData, setFormData] = useState({
    clientType: client?.clientType || "",
    partnerType: client?.partnerType || "",
    company_id: client?.company_id || "",
    company: client?.company || "",
    industry: client?.industry || "",
    website: client?.website || "",
    companyPhone: "", // Separate field for company phone
    address: client?.address || "",
    companyLogoUrl: client?.companyLogoUrl || "",
    prefix: "Mr.", // Contact Person Prefix
    firstName: "", // Contact Person First Name
    lastName: "", // Contact Person Last Name
    designation: client?.designation || "", // New field
    contactPhone: client?.phone || "+63", // Primary contact phone
    email: client?.email || "", // Primary email
    contactPhone_sub: client?.phone_sub || "", // Secondary contact phone (optional)
    email_sub: client?.email_sub || "", // Secondary email (optional)
    user_company_id: client?.user_company_id || userData?.company_id || "", // New field
  })

  // Validation error states
  const [validationErrors, setValidationErrors] = useState({
    clientType: false,
    partnerType: false,
    firstName: false,
    lastName: false,
    designation: false,
    contactPhone: false,
    email: false,
    phoneFormat: false,
    prefix: false,
  })

  const fetchCompanies = async () => {
    setLoadingCompanies(true)
    try {
      const companiesRef = collection(db, "client_company")
      const q = query(
        companiesRef,
        where("user_company_id", "==", userData?.company_id || ""),
        where("deleted", "!=", true)
      )
      const snapshot = await getDocs(q)
      const companiesData = snapshot.docs.map((doc) => {
        const data = doc.data() as any
        return {
          id: doc.id,
          name: data.name,
          address: data.address || "",
          industry: data.industry || "",
          clientType: data.clientType || "",
          partnerType: data.partnerType || "", // Include partner type in fetched data
          companyLogoUrl: data.companyLogoUrl || "",
          created: data.created?.toDate() || new Date(),
          user_company_id: data.user_company_id || "", // Include user_company_id
        }
      })
      setCompanies(companiesData)
    } catch (error) {
      console.error("Error fetching companies:", error)
      toast.error("Failed to load companies")
    } finally {
      setLoadingCompanies(false)
    }
  }

  // Reset form data and logo states when dialog opens for a new client or when client prop changes
  useEffect(() => {
    if (open) {
      setFormData({
        clientType: client?.clientType || "",
        partnerType: client?.partnerType || "",
        company_id: client?.company_id || "",
        company: client?.company || "",
        industry: client?.industry || "",
        website: (client as any)?.website || "",
        companyPhone: "",
        address: client?.address || "",
        companyLogoUrl: client?.companyLogoUrl || "",
        prefix: "Mr.",
        firstName: client?.name || "",
        lastName: "",
        designation: client?.designation || "",
        contactPhone: client?.phone || "+63",
        email: client?.email || "",
        contactPhone_sub: client?.phone_sub || "",
        email_sub: client?.email_sub || "",
        user_company_id: client?.user_company_id || userData?.company_id || "", // New field
      })
      setLogoFile(null) // Clear selected file
      setLogoPreviewUrl(client?.companyLogoUrl || null) // Set preview to existing logo or null
      setShowNewCompanyInput(!client) // Default to new company input for new clients
      setNewCompanyName("")
      // Reset validation errors
      setValidationErrors({
        clientType: false,
        partnerType: false,
        firstName: false,
        lastName: false,
        designation: false,
        contactPhone: false,
        email: false,
        phoneFormat: false,
        prefix: false,
      })
      fetchCompanies()

    }
  }, [open, client, userData?.company_id]) // Added userData?.company_id to dependency array


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    // Skip contactPhone as it's handled by handlePhoneInput
    if (name === 'contactPhone') return

    // For companyPhone, allow only numbers
    if (name === 'companyPhone') {
      const numericValue = value.replace(/\D/g, '') // Remove non-digits
      setFormData((prev) => ({ ...prev, [name]: numericValue }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }

    // Clear validation error when field is filled
    if (value.trim() && validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [name]: false }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === "clientType" && value === "brand") {
      setFormData((prev) => ({ ...prev, partnerType: "" }))
    }

    // Clear validation error when field is filled
    if (value && validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [name]: false }))
    }
  }

  const validatePhoneFormat = (phone: string): boolean => {
    // Check if phone is exactly +63 followed by 10 digits (Philippines mobile format)
    const phoneRegex = /^\+63\d{10}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }


  const handlePhoneInput = (field: 'contactPhone' | 'contactPhone_sub', value: string) => {
    value = value.replace(/\s/g, '') // Remove spaces

    // Always ensure +63 prefix is present
    if (!value.startsWith('+63')) {
      if (value && /^\d/.test(value)) {
        // If user types digits, add +63 prefix
        value = '+63' + value.replace(/\D/g, '').substring(0, 9)
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
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear validation errors when user types
    if (validationErrors.phoneFormat || validationErrors.contactPhone) {
      setValidationErrors((prev) => ({
        ...prev,
        phoneFormat: false,
        contactPhone: false
      }))
    }
  }

  const handleEmailInput = (field: 'email' | 'email_sub', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear validation error when field is filled
    if (validationErrors.email) {
      setValidationErrors((prev) => ({ ...prev, email: false }))
    }
  }


  const scrollToFirstError = () => {
    // Define the order of fields to check for errors
    const fieldOrder = [
      'clientType',
      'partnerType',
      'prefix',
      'firstName',
      'contactPhone',
      'phoneFormat',
      'email'
    ]

    for (const fieldName of fieldOrder) {
      if (validationErrors[fieldName as keyof typeof validationErrors]) {
        // Find the corresponding DOM element
        let element: HTMLElement | null = null

        if (fieldName === 'clientType') {
          element = document.getElementById('clientType')
        } else if (fieldName === 'partnerType') {
          element = document.getElementById('partnerType')
        } else if (fieldName === 'prefix') {
          element = document.getElementById('prefix')
        } else if (fieldName === 'firstName') {
          element = document.getElementById('firstName')
        } else if (fieldName === 'contactPhone') {
          element = document.getElementById('contactPhone')
        } else if (fieldName === 'email') {
          element = document.getElementById('email')
        } else if (fieldName === 'phoneFormat') {
          element = document.getElementById('contactPhone')
        }

        if (element) {
          // Scroll the element into view
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          })

          // Focus on the element after a short delay to ensure scroll is complete
          setTimeout(() => {
            element?.focus()
          }, 500)

          break // Stop after finding the first error
        }
      }
    }
  }

  const handleCompanySelect = async (value: string) => {
    if (value === "add_new") {
      setShowNewCompanyInput(true)
      setFormData((prev) => ({
        ...prev,
        company: "",
        company_id: "",
        address: "",
        industry: "",
        clientType: "",
        partnerType: "",
        website: "",
        companyPhone: "",
        companyLogoUrl: "",
      }))
      setLogoPreviewUrl(null)
    } else {
      const selectedCompany = companies.find((c) => c.id === value)
      if (selectedCompany) {
        setFormData((prev) => ({
          ...prev,
          company: selectedCompany.name,
          company_id: selectedCompany.id,
          address: selectedCompany.address || "",
          industry: selectedCompany.industry || "",
          clientType: selectedCompany.clientType || "",
          partnerType: selectedCompany.partnerType || "",
          website: (selectedCompany as any).website || "",
          companyLogoUrl: selectedCompany.companyLogoUrl || "",
          prefix: "Mr.",
          firstName: "",
          lastName: "",
          designation: "",
          contactPhone: "+63",
          email: "",
          contactPhone_sub: "",
          email_sub: "",
        }))
        setLogoPreviewUrl(selectedCompany.companyLogoUrl || null)
        setShowNewCompanyInput(false)
      }
    }
  }

  const createNewCompany = async (companyName: string) => {
    try {
      const companiesRef = collection(db, "client_company")

      // Upload compliance files if they exist
      const complianceUrls = {
        dti: "",
        gis: "",
        id: "",
      }

      if (complianceFiles.dti) {
        const uploadPath = `compliance_documents/${userData?.uid || "unknown"}/dti/`
        complianceUrls.dti = await uploadFileToFirebaseStorage(complianceFiles.dti, uploadPath)
      }

      if (complianceFiles.gis) {
        const uploadPath = `compliance_documents/${userData?.uid || "unknown"}/gis/`
        complianceUrls.gis = await uploadFileToFirebaseStorage(complianceFiles.gis, uploadPath)
      }

      if (complianceFiles.id) {
        const uploadPath = `compliance_documents/${userData?.uid || "unknown"}/id/`
        complianceUrls.id = await uploadFileToFirebaseStorage(complianceFiles.id, uploadPath)
      }

      const docRef = await addDoc(companiesRef, {
        name: companyName,
        address: formData.address,
        industry: formData.industry,
        clientType: formData.clientType,
        partnerType: formData.partnerType || "",
        website: formData.website,
        phone: formData.companyPhone,
        companyLogoUrl: "", // Will be updated after logo upload if needed
        created: new Date(),
        user_company_id: userData?.company_id || "",
        deleted: false,
        compliance: {
          dti: complianceUrls.dti,
          gis: complianceUrls.gis,
          id: complianceUrls.id,
          uploadedAt: new Date(),
          uploadedBy: userData?.uid || "",
        },
      })
      return docRef.id
    } catch (error) {
      console.error("Error creating company:", error)
      throw error
    }
  }

  const handleLogoClick = () => {
    fileInputRef.current?.click() // Trigger hidden file input click
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreviewUrl(URL.createObjectURL(file)) // Create a local URL for preview
    } else {
      setLogoFile(null)
      setLogoPreviewUrl(client?.companyLogoUrl || null) // Revert to existing or null
    }
  }

  const handleComplianceFileChange = (type: "dti" | "gis" | "id") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setComplianceFiles((prev) => ({ ...prev, [type]: file }))
      toast.success(`${type.toUpperCase()} document selected`)
    }
  }

  const handleComplianceUpload = (type: "dti" | "gis" | "id") => {
    const fileInputRefs = {
      dti: dtiFileInputRef,
      gis: gisFileInputRef,
      id: idFileInputRef,
    }
    fileInputRefs[type].current?.click()
  }

  const fetchUserCompanyId = async (): Promise<string> => {
    try {
      if (!userData?.uid) return ""

      const companiesRef = collection(db, "client_company")
      const q = query(companiesRef, where("deleted", "!=", true))
      const snapshot = await getDocs(q)

      // Find the company that belongs to the current user
      const userCompany = snapshot.docs.find((doc) => {
        const data = doc.data()
        return data.user_company_id === userData.uid || data.created_by === userData.uid
      })

      return userCompany?.id || userData?.company_id || ""
    } catch (error) {
      console.error("Error fetching user company ID:", error)
      return userData?.company_id || ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validation for new company creation
    let hasErrors = false
    const newValidationErrors = { ...validationErrors }

    if (showNewCompanyInput) {
      if (!formData.clientType) {
        newValidationErrors.clientType = true
        hasErrors = true
      } else {
        newValidationErrors.clientType = false
      }

      if (formData.clientType === "partner" && !formData.partnerType) {
        newValidationErrors.partnerType = true
        hasErrors = true
      } else if (formData.clientType === "partner") {
        newValidationErrors.partnerType = false
      }
    }

    // Validate required contact fields
    if (!formData.prefix.trim()) {
      newValidationErrors.prefix = true
      hasErrors = true
    } else {
      newValidationErrors.prefix = false
    }

    if (!formData.firstName.trim()) {
      newValidationErrors.firstName = true
      hasErrors = true
    } else {
      newValidationErrors.firstName = false
    }

    if (!formData.lastName.trim()) {
      newValidationErrors.lastName = true
      hasErrors = true
    } else {
      newValidationErrors.lastName = false
    }

    if (!formData.designation.trim()) {
      newValidationErrors.designation = true
      hasErrors = true
    } else {
      newValidationErrors.designation = false
    }

    // Validate primary contact phone - required
    if (!formData.contactPhone.trim() || formData.contactPhone === '+63') {
      newValidationErrors.contactPhone = true
      hasErrors = true
    } else {
      newValidationErrors.contactPhone = false
    }

    // Validate primary email - required
    if (!formData.email.trim()) {
      newValidationErrors.email = true
      hasErrors = true
    } else {
      newValidationErrors.email = false
    }

    // Validate phone formats
    if (formData.contactPhone.trim() && formData.contactPhone !== '+63' && !validatePhoneFormat(formData.contactPhone)) {
      newValidationErrors.phoneFormat = true
      hasErrors = true
    } else if (formData.contactPhone_sub.trim() && formData.contactPhone_sub !== '+63' && !validatePhoneFormat(formData.contactPhone_sub)) {
      newValidationErrors.phoneFormat = true
      hasErrors = true
    } else {
      newValidationErrors.phoneFormat = false
    }


    setValidationErrors(newValidationErrors)

    if (hasErrors) {
      toast.error("Please fill in all required fields")
      setLoading(false)

      // Scroll to and focus on the first field with an error
      setTimeout(() => {
        scrollToFirstError()
      }, 100)

      return
    }

    try {
      const userCompanyId = await fetchUserCompanyId()

      let finalCompanyLogoUrl = formData.companyLogoUrl
      let finalCompanyId = formData.company_id
      let finalCompanyName = formData.company

      if (logoFile) {
        const uploadPath = `company_logos/${client?.id || "new_client"}/`
        finalCompanyLogoUrl = await uploadFileToFirebaseStorage(logoFile, uploadPath)
      }

      if (showNewCompanyInput && newCompanyName.trim()) {
        setFormData((prev) => ({ ...prev, companyLogoUrl: finalCompanyLogoUrl }))
        finalCompanyId = await createNewCompany(newCompanyName.trim())
        finalCompanyName = newCompanyName.trim()

        if (finalCompanyLogoUrl && finalCompanyLogoUrl !== formData.companyLogoUrl) {
          await updateDoc(doc(db, "client_company", finalCompanyId), {
            companyLogoUrl: finalCompanyLogoUrl,
          })
        }
      }

      const clientDataToSave = {
        ...formData,
        company_id: finalCompanyId,
        company: finalCompanyName,
        companyLogoUrl: finalCompanyLogoUrl, // Use the uploaded URL or existing one
        name: `${formData.firstName} ${formData.lastName}`.trim() || "",
        email: formData.email.trim(),
        phone: formData.contactPhone.trim(),
        email_sub: formData.email_sub.trim() || undefined,
        phone_sub: formData.contactPhone_sub.trim() || undefined,
        industry: formData.industry || "",
        address: formData.address || "",
        designation: formData.designation || "",
        status: client?.status || "lead",
        notes: client?.notes || "",
        city: client?.city || "",
        state: client?.state || "",
        zipCode: client?.zipCode || "",
        uploadedBy: client?.uploadedBy || userData?.uid || "",
        uploadedByName: client?.uploadedByName || userData?.displayName || userData?.email || "",
        user_company_id: formData.user_company_id, // Use formData's user_company_id
        deleted: false,
      } as Omit<Client, "id" | "created" | "updated"> // Cast to ensure type compatibility

      let savedClient: Client

      if (client?.id) {
        await updateClient(client.id, clientDataToSave)
        savedClient = { id: client.id, ...clientDataToSave, created: client.created, updated: new Date() } as Client // Mock updated client
        toast.success("Client updated successfully")
      } else {
        const newClientId = await createClient(clientDataToSave)
        savedClient = { id: newClientId, ...clientDataToSave, created: new Date(), updated: new Date() } as Client // Mock created client
        toast.success("Client added successfully")
      }

      onOpenChange(false)
      if (onSuccess) onSuccess(savedClient)
    } catch (error) {
      console.error("Error saving client:", error)
      toast.error("Failed to save client")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-8">
            {/* Left Section: Company Fields */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company" className="text-[#333333] text-sm font-medium">
                  Company Name <span className="text-[#f95151]">*</span>
                </Label>
                {!showNewCompanyInput ? (
                  <Select value={formData.company_id} onValueChange={handleCompanySelect}>
                    <SelectTrigger className="h-10 border-[#c4c4c4]">
                      <SelectValue placeholder={loadingCompanies ? "Loading companies..." : "Select or add company"} />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="add_new">+ Add New Company</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Enter new company name"
                      required
                      className="h-10 border-[#c4c4c4]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowNewCompanyInput(false)
                        setNewCompanyName("")
                      }}
                      className="border-[#c4c4c4]"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {showNewCompanyInput && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientType" className="text-[#333333] text-sm font-medium">
                      Client Type <span className="text-[#f95151]">*</span>
                    </Label>
                    <Select value={formData.clientType} onValueChange={(value) => handleSelectChange("clientType", value)}>
                      <SelectTrigger id="clientType" className={`h-10 border-[#c4c4c4] ${validationErrors.clientType ? 'border-[#f95151]' : ''}`}>
                        <SelectValue placeholder="Select client type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="brand">Brand</SelectItem>
                      </SelectContent>
                    </Select>
                    {validationErrors.clientType && (
                      <p className="text-sm text-[#f95151]">Client type is required</p>
                    )}
                  </div>

                  {formData.clientType === "partner" && (
                    <div className="space-y-2">
                      <Label htmlFor="partnerType" className="text-[#333333] text-sm font-medium">
                        Type <span className="text-[#f95151]">*</span>
                      </Label>
                      <Select
                        value={formData.partnerType}
                        onValueChange={(value) => handleSelectChange("partnerType", value)}
                      >
                        <SelectTrigger id="partnerType" className={`h-10 border-[#c4c4c4] ${validationErrors.partnerType ? 'border-[#f95151]' : ''}`}>
                          <SelectValue placeholder="Select partner type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="agency">Agency</SelectItem>
                        </SelectContent>
                      </Select>
                      {validationErrors.partnerType && (
                        <p className="text-sm text-[#f95151]">Partner type is required</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[#333333] text-sm font-medium">
                      Company Address
                    </Label>
                    <GooglePlacesAutocomplete
                      value={formData.address}
                      onChange={(value) => {
                        setFormData((prev) => ({ ...prev, address: value }))
                      }}
                      placeholder="Enter company address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyPhone" className="text-[#333333] text-sm font-medium">
                      Company Landline
                    </Label>
                    <Input
                      id="companyPhone"
                      name="companyPhone"
                      value={formData.companyPhone}
                      onChange={handleChange}
                      placeholder="Enter company landline"
                      className="h-10 border-[#c4c4c4]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyLogo" className="text-[#333333] text-sm font-medium">
                      Company Logo
                    </Label>
                    <div
                      className="w-24 h-24 border border-[#c4c4c4] rounded-lg flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden"
                      onClick={handleLogoClick}
                    >
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl || "/placeholder.svg"}
                          alt="Company Logo Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Plus className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-[#333333] text-sm font-medium">
                      Company Website
                    </Label>
                    <Input
                      id="website"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="https://example.com"
                      className="h-10 border-[#c4c4c4]"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Vertical Line */}
            <div className="w-px bg-[#c4c4c4] opacity-50"></div>

            {/* Right Section: Contact Person Fields */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label className="text-[#333333] text-sm font-medium">
                  Contact Person
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="prefix" className="text-[#a1a1a1] text-sm">
                      Prefix <span className="text-[#f95151]">*</span>
                    </Label>
                    <Select value={formData.prefix} onValueChange={(value) => handleSelectChange("prefix", value)}>
                      <SelectTrigger id="prefix" className={`h-10 border-[#c4c4c4] ${validationErrors.prefix ? 'border-[#f95151]' : ''}`}>
                        <SelectValue placeholder="Select prefix" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mr.">Mr.</SelectItem>
                        <SelectItem value="Mrs.">Mrs.</SelectItem>
                        <SelectItem value="Ms.">Ms.</SelectItem>
                        <SelectItem value="Dr.">Dr.</SelectItem>
                      </SelectContent>
                    </Select>
                    {validationErrors.prefix && (
                      <p className="text-sm text-[#f95151]">Prefix is required</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="firstName" className="text-[#a1a1a1] text-sm">
                      First Name <span className="text-[#f95151]">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="First Name"
                      className={`h-10 border-[#c4c4c4] ${validationErrors.firstName ? 'border-[#f95151]' : ''}`}
                    />
                    {validationErrors.firstName && (
                      <p className="text-sm text-[#f95151]">First name is required</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-[#a1a1a1] text-sm">
                    Last Name <span className="text-[#f95151]">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    className={`h-10 border-[#c4c4c4] ${validationErrors.lastName ? 'border-[#f95151]' : ''}`}
                  />
                  {validationErrors.lastName && (
                    <p className="text-sm text-[#f95151]">Last name is required</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="designation" className="text-[#a1a1a1] text-sm">
                    Designation <span className="text-[#f95151]">*</span>
                  </Label>
                  <Input
                    id="designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="Designation"
                    className={`h-10 border-[#c4c4c4] ${validationErrors.designation ? 'border-[#f95151]' : ''}`}
                  />
                  {validationErrors.designation && (
                    <p className="text-sm text-[#f95151]">Designation is required</p>
                  )}
                </div>
                <div>
                  <Label className="text-[#a1a1a1] text-sm">
                    Contact No. <span className="text-[#f95151]">*</span>
                  </Label>
                  <Input
                    value={formData.contactPhone}
                    onChange={(e) => handlePhoneInput('contactPhone', e.target.value)}
                    placeholder="Enter 10 digits"
                    className={`h-10 border-[#c4c4c4] mb-2 ${(validationErrors.contactPhone || validationErrors.phoneFormat) ? 'border-[#f95151]' : ''}`}
                  />
                  <Input
                    value={formData.contactPhone_sub}
                    onChange={(e) => handlePhoneInput('contactPhone_sub', e.target.value)}
                    placeholder="Additional contact no. (optional)"
                    className="h-10 border-[#c4c4c4]"
                  />
                  {validationErrors.contactPhone && (
                    <p className="text-sm text-[#f95151]">Primary phone number is required</p>
                  )}
                  {validationErrors.phoneFormat && !validationErrors.contactPhone && (
                    <p className="text-sm text-[#f95151]">Please enter valid phone numbers</p>
                  )}
                </div>
                <div>
                  <Label className="text-[#a1a1a1] text-sm">
                    Email Address <span className="text-[#f95151]">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleEmailInput('email', e.target.value)}
                    placeholder="Email Address"
                    className={`h-10 border-[#c4c4c4] mb-2 ${validationErrors.email ? 'border-[#f95151]' : ''}`}
                  />
                  <Input
                    type="email"
                    value={formData.email_sub}
                    onChange={(e) => handleEmailInput('email_sub', e.target.value)}
                    placeholder="Additional email (optional)"
                    className="h-10 border-[#c4c4c4]"
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-[#f95151]">Primary email address is required</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-8">
            <p className="text-[#333333] text-sm">
              Fields marked <span className="text-[#f95151]">*</span> are required
            </p>
            <div className="flex space-x-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="px-6 py-3 border-[#c4c4c4] text-[#333333]">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="px-6 py-3 bg-[#1d0beb] hover:bg-blue-700 text-white">
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </form>

        <style>{`.pac-container { z-index: 9999 !important; } .autocomplete-dropdown { z-index: 9998 !important; }`}</style>

        {/* Hidden file inputs for compliance documents */}
        <input
          type="file"
          ref={dtiFileInputRef}
          onChange={handleComplianceFileChange("dti")}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
        <input
          type="file"
          ref={gisFileInputRef}
          onChange={handleComplianceFileChange("gis")}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
        <input
          type="file"
          ref={idFileInputRef}
          onChange={handleComplianceFileChange("id")}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        />
      </DialogContent>
    </Dialog>
  )
}
