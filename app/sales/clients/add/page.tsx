"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ArrowLeft, Upload, Plus, MoreHorizontal, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Toaster } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { createClient } from "@/lib/client-service"

interface Company {
  id: string
  name: string
  address?: string
  industry?: string
  clientType?: string
  partnerType?: string
  companyLogoUrl?: string
  website?: string
  phone?: string
  created: Date
  compliance?: {
    dti: string
    gis: string
    id: string
    uploadedAt: Date
    uploadedBy: string
  }
}

interface ContactPerson {
  id: string
  name: string
  designation: string
  phone: string
  email: string
  remarks: string
}

export default function AddClientPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const dtiFileInputRef = useRef<HTMLInputElement>(null)
  const gisFileInputRef = useRef<HTMLInputElement>(null)
  const idFileInputRef = useRef<HTMLInputElement>(null)

  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")

  const [complianceFiles, setComplianceFiles] = useState({
    dti: null as File | null,
    gis: null as File | null,
    id: null as File | null,
  })

  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({
    name: "",
    designation: "",
    phone: "",
    email: "",
    remarks: "",
  })

  const [formData, setFormData] = useState({
    clientType: "",
    partnerType: "",
    company_id: "",
    company: "",
    industry: "",
    address: "",
    website: "",
    phone: "",
    companyLogoUrl: "",
  })

  const fetchCompanies = async () => {
    setLoadingCompanies(true)
    try {
      const companiesRef = collection(db, "client_company")
      const q = query(companiesRef, where("deleted", "!=", true))
      const snapshot = await getDocs(q)
      const companiesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        address: doc.data().address || "",
        industry: doc.data().industry || "",
        clientType: doc.data().clientType || "",
        partnerType: doc.data().partnerType || "",
        companyLogoUrl: doc.data().companyLogoUrl || "",
        website: doc.data().website || "",
        phone: doc.data().phone || "",
        created: doc.data().created?.toDate() || new Date(),
        compliance: doc.data().compliance || {
          dti: "",
          gis: "",
          id: "",
          uploadedAt: new Date(),
          uploadedBy: "",
        },
      }))
      setCompanies(companiesData)
    } catch (error) {
      console.error("Error fetching companies:", error)
      toast.error("Failed to load companies")
    } finally {
      setLoadingCompanies(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === "clientType" && value === "brand") {
      setFormData((prev) => ({ ...prev, partnerType: "" }))
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
        phone: "",
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
          website: selectedCompany.website || "",
          phone: selectedCompany.phone || "",
          companyLogoUrl: selectedCompany.companyLogoUrl || "",
        }))
        setLogoPreviewUrl(selectedCompany.companyLogoUrl || null)
        setShowNewCompanyInput(false)
      }
    }
  }

  const createNewCompany = async (companyName: string) => {
    try {
      const companiesRef = collection(db, "client_company")
      const docRef = await addDoc(companiesRef, {
        name: companyName,
        address: formData.address,
        industry: formData.industry,
        clientType: formData.clientType,
        partnerType: formData.partnerType || "",
        website: formData.website,
        phone: formData.phone,
        companyLogoUrl: "",
        created: new Date(),
        user_company_id: userData?.company_id || "",
        deleted: false,
      })
      return docRef.id
    } catch (error) {
      console.error("Error creating company:", error)
      throw error
    }
  }

  const handleLogoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreviewUrl(URL.createObjectURL(file))
    } else {
      setLogoFile(null)
      setLogoPreviewUrl(formData.companyLogoUrl || null)
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

  const handleAddContact = () => {
    if (newContact.name && newContact.email && newContact.phone) {
      const contact: ContactPerson = {
        id: Date.now().toString(),
        ...newContact,
      }
      setContactPersons([...contactPersons, contact])
      setNewContact({
        name: "",
        designation: "",
        phone: "",
        email: "",
        remarks: "",
      })
      setShowAddContact(false)
    } else {
      toast.error("Please fill in required fields (Name, Email, Phone)")
    }
  }

  const handleRemoveContact = (id: string) => {
    setContactPersons(contactPersons.filter((c) => c.id !== id))
  }

  const fetchUserCompanyId = async (): Promise<string> => {
    try {
      if (!userData?.uid) return ""

      const companiesRef = collection(db, "client_company")
      const q = query(companiesRef, where("deleted", "!=", true))
      const snapshot = await getDocs(q)

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

    try {
      if (contactPersons.length === 0) {
        toast.error("Please add at least one contact person")
        setLoading(false)
        return
      }

      const userCompanyId = await fetchUserCompanyId()

      let finalCompanyLogoUrl = formData.companyLogoUrl
      let finalCompanyId = formData.company_id
      let finalCompanyName = formData.company

      const complianceUrls = {
        dti: "",
        gis: "",
        id: "",
      }

      // Upload compliance files if they exist
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

      if (logoFile) {
        const uploadPath = `company_logos/new_client/`
        finalCompanyLogoUrl = await uploadFileToFirebaseStorage(logoFile, uploadPath)
      }

      if (!formData.company_id && formData.company.trim()) {
        // Create new company since no existing company was selected
        setFormData((prev) => ({ ...prev, companyLogoUrl: finalCompanyLogoUrl }))
        finalCompanyId = await createNewCompany(formData.company.trim())
        finalCompanyName = formData.company.trim()

        if (finalCompanyLogoUrl && finalCompanyLogoUrl !== formData.companyLogoUrl) {
          await updateDoc(doc(db, "client_company", finalCompanyId), {
            companyLogoUrl: finalCompanyLogoUrl,
          })
        }

        if (complianceUrls.dti || complianceUrls.gis || complianceUrls.id) {
          await updateDoc(doc(db, "client_company", finalCompanyId), {
            compliance: {
              dti: complianceUrls.dti,
              gis: complianceUrls.gis,
              id: complianceUrls.id,
              uploadedAt: new Date(),
              uploadedBy: userData?.uid || "",
            },
          })
        }
      } else if (formData.company_id && logoFile) {
        // Update existing company logo if new logo was uploaded
        await updateDoc(doc(db, "client_company", formData.company_id), {
          companyLogoUrl: finalCompanyLogoUrl,
        })

        if (complianceUrls.dti || complianceUrls.gis || complianceUrls.id) {
          await updateDoc(doc(db, "client_company", formData.company_id), {
            compliance: {
              dti: complianceUrls.dti,
              gis: complianceUrls.gis,
              id: complianceUrls.id,
              uploadedAt: new Date(),
              uploadedBy: userData?.uid || "",
            },
          })
        }
      } else if (formData.company_id && (complianceUrls.dti || complianceUrls.gis || complianceUrls.id)) {
        await updateDoc(doc(db, "client_company", formData.company_id), {
          compliance: {
            dti: complianceUrls.dti,
            gis: complianceUrls.gis,
            id: complianceUrls.id,
            uploadedAt: new Date(),
            uploadedBy: userData?.uid || "",
          },
        })
      }

      // Create multiple client documents for each contact person
      for (const contact of contactPersons) {
        const clientDataToSave = {
          clientType: formData.clientType,
          partnerType: formData.partnerType || "",
          company_id: finalCompanyId,
          company: finalCompanyName,
          industry: formData.industry || "",
          name: contact.name,
          designation: contact.designation,
          phone: contact.phone,
          email: contact.email,
          address: formData.address || "",
          companyLogoUrl: finalCompanyLogoUrl,
          status: "lead" as const,
          notes: contact.remarks,
          city: "",
          state: "",
          zipCode: "",
          uploadedBy: userData?.uid || "",
          uploadedByName: userData?.displayName || userData?.email || "",
          user_company_id: userCompanyId,
          deleted: false,
          compliance: {
            dti: complianceUrls.dti,
            gis: complianceUrls.gis,
            id: complianceUrls.id,
          },
        }

        await createClient(clientDataToSave)
      }

      setShowSuccessModal(true)
    } catch (error) {
      console.error("Error saving client:", error)
      toast.error("Failed to save client")
    } finally {
      setLoading(false)
    }
  }

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false)
    router.push("/sales/clients")
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster />

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-4">
              <div className="text-6xl">🎉</div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Congratulations!</h2>
            <p className="text-gray-600 mb-6">You have successfully added a new client</p>
            <Button onClick={handleSuccessModalClose} className="bg-blue-600 hover:bg-blue-700">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">Add Client</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Company Information - Left Column */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Company Information</h2>

            <div className="space-y-6">
              {/* Company Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Company Name:</Label>
                  <Input
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Company Name"
                    className="h-10"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Industry:</Label>
                  <Select value={formData.industry} onValueChange={(value) => handleSelectChange("industry", value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="-Choose an Industry-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automotive">Automotive</SelectItem>
                      <SelectItem value="banking">Banking & Financial Services</SelectItem>
                      <SelectItem value="beverages">Beverages</SelectItem>
                      <SelectItem value="fast_food">Fast Food & QSR</SelectItem>
                      <SelectItem value="retail">Retail & Shopping</SelectItem>
                      <SelectItem value="telecom">Telecommunications</SelectItem>
                      <SelectItem value="pharmaceuticals">Pharmaceuticals</SelectItem>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                      <SelectItem value="government">Government & Public Services</SelectItem>
                      <SelectItem value="fmcg">FMCG</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="entertainment">Entertainment & Media</SelectItem>
                      <SelectItem value="travel">Travel & Tourism</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Client Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">Client Type:</Label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="relative">
                        <input
                          type="radio"
                          name="clientType"
                          value="partner"
                          checked={formData.clientType === "partner"}
                          onChange={(e) => handleSelectChange("clientType", e.target.value)}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${formData.clientType === "partner" ? "border-green-500 bg-green-500" : "border-gray-300"} flex items-center justify-center`}
                        >
                          {formData.clientType === "partner" && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span
                        className={`text-sm ${formData.clientType === "partner" ? "text-green-600 font-medium" : "text-gray-700"}`}
                      >
                        Partner
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="relative">
                        <input
                          type="radio"
                          name="clientType"
                          value="brand"
                          checked={formData.clientType === "brand"}
                          onChange={(e) => handleSelectChange("clientType", e.target.value)}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${formData.clientType === "brand" ? "border-green-500 bg-green-500" : "border-gray-300"} flex items-center justify-center`}
                        >
                          {formData.clientType === "brand" && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span
                        className={`text-sm ${formData.clientType === "brand" ? "text-green-600 font-medium" : "text-gray-700"}`}
                      >
                        Brand
                      </span>
                    </label>
                  </div>
                </div>

                {formData.clientType === "partner" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Partner Type:</Label>
                    <Select
                      value={formData.partnerType}
                      onValueChange={(value) => handleSelectChange("partnerType", value)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="-Select Type-" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">Operator</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Address and Website */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Company Address:</Label>
                  <Input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Company Address"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Company Website:</Label>
                  <Input
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="Company Website"
                    className="h-10"
                  />
                </div>
              </div>

              {/* Phone and Logo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Company Phone #:</Label>
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Company Phone #"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Company Logo:</Label>
                  <div
                    className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden"
                    onClick={handleLogoClick}
                  >
                    {logoPreviewUrl ? (
                      <img
                        src={logoPreviewUrl || "/placeholder.svg"}
                        alt="Company Logo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload className="h-6 w-6 text-gray-400" />
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
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Compliance</h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">DTI/BIR 2303</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs bg-transparent"
                    onClick={() => handleComplianceUpload("dti")}
                  >
                    {complianceFiles.dti ? "Document Selected" : "Upload Document"}
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">G.I.S.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs bg-transparent"
                    onClick={() => handleComplianceUpload("gis")}
                  >
                    {complianceFiles.gis ? "Document Selected" : "Upload Document"}
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">ID with signature</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs bg-transparent"
                    onClick={() => handleComplianceUpload("id")}
                  >
                    {complianceFiles.id ? "Document Selected" : "Upload Document"}
                  </Button>
                </div>
                <div className="pt-2">
                  <Button variant="link" className="p-0 h-auto text-blue-600 text-sm">
                    Add Compliance
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Redesigned Contact Person section to match image */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">Contact Person</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Total: ({contactPersons.length})</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddContact(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </div>

          {showAddContact && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <Input
                  placeholder="Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="h-10"
                />
                <Input
                  placeholder="Designation"
                  value={newContact.designation}
                  onChange={(e) => setNewContact({ ...newContact, designation: e.target.value })}
                  className="h-10"
                />
                <Input
                  placeholder="Contact #"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="h-10"
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="h-10"
                />
                <Input
                  placeholder="Remarks"
                  value={newContact.remarks}
                  onChange={(e) => setNewContact({ ...newContact, remarks: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={handleAddContact} size="sm">
                  Add
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddContact(false)} size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-medium text-gray-700">Name</TableHead>
                  <TableHead className="font-medium text-gray-700">Designation</TableHead>
                  <TableHead className="font-medium text-gray-700">Contact #</TableHead>
                  <TableHead className="font-medium text-gray-700">Email</TableHead>
                  <TableHead className="font-medium text-gray-700">Remarks</TableHead>
                  <TableHead className="font-medium text-gray-700">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactPersons.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="text-sm">{contact.name}</TableCell>
                    <TableCell className="text-sm">{contact.designation}</TableCell>
                    <TableCell className="text-sm">{contact.phone}</TableCell>
                    <TableCell className="text-sm text-blue-600">{contact.email}</TableCell>
                    <TableCell className="text-sm">{contact.remarks}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRemoveContact(contact.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {contactPersons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No contact persons added yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Redesigned Action buttons to match image - right aligned */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="px-6">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="px-6 bg-blue-600 hover:bg-blue-700">
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>

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
    </div>
  )
}
