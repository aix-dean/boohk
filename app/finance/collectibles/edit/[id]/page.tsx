"use client"

import type React from "react"
import { useState, useEffect, useRef, type MouseEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Upload, X, FileText, PlusCircle, CheckCircle, Loader2, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage" // Added Firebase Storage imports
import { db, storage } from "@/lib/firebase" // Added storage import
import { useAuth } from "@/contexts/auth-context"
import { getPaginatedClients, type Client } from "@/lib/client-service"
import { ClientDialog } from "@/components/client-dialog"
import { syncQuotationCollectionStatus } from "@/lib/quotation-collection-service"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DateRange } from "react-day-picker"

interface CollectibleFormData {
  type: "sites" | "supplies"
  client_name: string
  net_amount: number
  total_amount: number
  mode_of_payment: string
  bank_name: string
  bi_no: string
  or_no: string
  invoice_no: string
  next_collection_date: string
  status: "pending" | "collected" | "overdue"
  proceed_next_collection: boolean
  next_collection_status: "pending" | "collected" | "overdue"
  next_collection_bir_2307?: File | string | null
  // Sites specific fields
  booking_no?: string
  site?: string
  covered_period?: string
  covered_period_range?: DateRange
  bir_2307?: File | string | null // Changed to support both File and existing file reference
  collection_date?: string
  // Supplies specific fields
  date?: string
  product?: string
  transfer_date?: string
  bs_no?: string
  due_for_collection?: string
  date_paid?: string
  net_amount_collection?: number
}

const initialFormData: CollectibleFormData = {
  type: "sites",
  client_name: "",
  net_amount: 0,
  total_amount: 0,
  mode_of_payment: "",
  bank_name: "",
  bi_no: "",
  or_no: "",
  invoice_no: "",
  next_collection_date: "",
  status: "pending",
  proceed_next_collection: false,
  next_collection_status: "pending",
}

export default function EditCollectiblePage({ params }: { params: { id: string } }) {
  const [formData, setFormData] = useState<CollectibleFormData>(initialFormData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)
  const clientSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchCollectible = async () => {
      try {
        setLoading(true)
        setError(null)

        const collectibleDoc = await getDoc(doc(db, "collectibles", params.id))

        if (collectibleDoc.exists()) {
          const data = collectibleDoc.data()

          // Convert Firestore data to form format
          const collectibleData: CollectibleFormData = {
            type: data.type || "sites",
            client_name: data.client_name || "",
            net_amount: data.net_amount || 0,
            total_amount: data.total_amount || 0,
            mode_of_payment: data.mode_of_payment || "",
            bank_name: data.bank_name || "",
            bi_no: data.bi_no || "",
            or_no: data.or_no || "",
            invoice_no: data.invoice_no || "",
            next_collection_date: data.next_collection_date || "",
            status: data.status || "pending",
            proceed_next_collection: !!(
              data.next_collection_date ||
              data.next_collection_status ||
              data.next_collection_bir_2307
            ),
            next_collection_status: data.next_collection_status || "pending",
            next_collection_bir_2307: data.next_collection_bir_2307 || null,
            // Sites specific fields
            booking_no: data.booking_no || "",
            site: data.site || "",
            covered_period: data.covered_period || "",
            covered_period_range: data.covered_period
              ? (() => {
                  const parts = data.covered_period.split(" - ")
                  if (parts.length === 2) {
                    const fromDate = new Date(parts[0])
                    const toDate = new Date(parts[1])
                    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
                      return { from: fromDate, to: toDate }
                    }
                  }
                  return undefined
                })()
              : undefined,
            bir_2307: data.bir_2307 || null,
            collection_date: data.collection_date || "",
            // Supplies specific fields
            date: data.date || "",
            product: data.product || "",
            transfer_date: data.transfer_date || "",
            bs_no: data.bs_no || "",
            due_for_collection: data.due_for_collection || "",
            date_paid: data.date_paid || "",
            net_amount_collection: data.net_amount_collection || 0,
          }

          setFormData(collectibleData)
        } else {
          setError("Collectible not found")
        }
      } catch (error) {
        console.error("Error fetching collectible:", error)
        setError("Failed to load collectible data")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchCollectible()
    }
  }, [params.id])

  useEffect(() => {
    const fetchClients = async () => {
      if (user?.uid) {
        setIsSearchingClients(true)
        try {
          const result = await getPaginatedClients(10, null, clientSearchTerm.trim(), null, user.uid, undefined, false)
          setClientSearchResults(result.items)
        } catch (error) {
          console.error("Error fetching clients:", error)
          setClientSearchResults([])
        } finally {
          setIsSearchingClients(false)
        }
      } else {
        setClientSearchResults([])
      }
    }
    fetchClients()
  }, [clientSearchTerm, user?.uid])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      if (!allowedTypes.includes(file.type)) {
        alert("Only PDF and DOC files are allowed")
        e.target.value = ""
        return
      }
      handleInputChange("bir_2307", file)
    }
  }

  const removeFile = () => {
    handleInputChange("bir_2307", null)
  }

  const triggerFileReplace = () => {
    const fileInput = document.getElementById("bir_2307_replace") as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
  }

  const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path)
    const snapshot = await uploadBytes(storageRef, file)
    return await getDownloadURL(snapshot.ref)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const collectibleRef = doc(db, "collectibles", params.id)

      // Prepare update data, filtering out undefined values
      const collectibleData: any = {
        type: formData.type,
        client_name: formData.client_name,
        net_amount: formData.net_amount,
        total_amount: formData.total_amount,
        mode_of_payment: formData.mode_of_payment,
        bank_name: formData.bank_name,
        bi_no: formData.bi_no,
        or_no: formData.or_no,
        invoice_no: formData.invoice_no,
        status: formData.status,
        updated: serverTimestamp(),
      }

      if (formData.type === "sites") {
        if (formData.booking_no) collectibleData.booking_no = formData.booking_no
        if (formData.site) collectibleData.site = formData.site
        if (formData.covered_period) collectibleData.covered_period = formData.covered_period
        if (formData.collection_date) collectibleData.collection_date = formData.collection_date

        // Handle BIR 2307 file upload
        if (formData.bir_2307) {
          if (formData.bir_2307 instanceof File) {
            // Upload new file
            const fileUrl = await uploadFileToStorage(
              formData.bir_2307,
              `collectibles/${params.id}/bir_2307_${Date.now()}.${formData.bir_2307.name.split(".").pop()}`,
            )
            collectibleData.bir_2307 = fileUrl
          } else {
            // Keep existing file URL
            collectibleData.bir_2307 = formData.bir_2307
          }
        }
      } else if (formData.type === "supplies") {
        if (formData.date) collectibleData.date = formData.date
        if (formData.product) collectibleData.product = formData.product
        if (formData.transfer_date) collectibleData.transfer_date = formData.transfer_date
        if (formData.bs_no) collectibleData.bs_no = formData.bs_no
        if (formData.due_for_collection) collectibleData.due_for_collection = formData.due_for_collection
        if (formData.date_paid) collectibleData.date_paid = formData.date_paid
        if (formData.net_amount_collection) collectibleData.net_amount_collection = formData.net_amount_collection
      }

      if (formData.proceed_next_collection) {
        collectibleData.next_collection_date = formData.next_collection_date
        collectibleData.next_collection_status = formData.next_collection_status

        // Handle next collection BIR 2307 file upload
        if (formData.next_collection_bir_2307) {
          if (formData.next_collection_bir_2307 instanceof File) {
            // Upload new file
            const fileUrl = await uploadFileToStorage(
              formData.next_collection_bir_2307,
              `collectibles/${params.id}/next_bir_2307_${Date.now()}.${formData.next_collection_bir_2307.name.split(".").pop()}`,
            )
            collectibleData.next_collection_bir_2307 = fileUrl
          } else {
            // Keep existing file URL
            collectibleData.next_collection_bir_2307 = formData.next_collection_bir_2307
          }
        }
      }

      await updateDoc(collectibleRef, collectibleData)

      await syncQuotationCollectionStatus(params.id)

      // Navigate back to collectibles list
      router.push("/finance/collectibles")
    } catch (error) {
      console.error("Error updating collectible:", error)
      setSubmitError("Failed to update collectible")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client)
    setFormData((prev) => ({ ...prev, client_name: client.company || client.name }))
    setIsClientDropdownOpen(false)
    setClientSearchTerm("")
  }

  const handleNewClientSuccess = (client: Client) => {
    setSelectedClient(client)
    setFormData((prev) => ({ ...prev, client_name: client.company || client.name }))
    setIsNewClientDialogOpen(false)
  }

  const renderFormFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Base Fields */}
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sites">Sites</SelectItem>
            <SelectItem value="supplies">Supplies</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="client_name">Client Name</Label>
        <div className="relative" ref={clientSearchRef}>
          <div className="relative">
            <Input
              placeholder="Search or select client..."
              value={
                selectedClient
                  ? selectedClient.company || selectedClient.name
                  : clientSearchTerm || formData.client_name
              }
              onChange={(e) => {
                setClientSearchTerm(e.target.value)
                setSelectedClient(null)
                setFormData((prev) => ({ ...prev, client_name: "" }))
              }}
              onFocus={() => {
                setIsClientDropdownOpen(true)
                if (selectedClient) {
                  setClientSearchTerm("")
                }
              }}
              className="pr-10"
              required
            />
            {isSearchingClients && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
            )}
          </div>
          {/* Results dropdown */}
          {isClientDropdownOpen && (
            <Card className="absolute top-full z-50 mt-1 w-full max-h-[200px] overflow-auto shadow-lg">
              <div className="p-2">
                {/* Always show "Add New Client" option at the top */}
                <div
                  className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 cursor-pointer rounded-md text-sm mb-2 border-b pb-2"
                  onClick={() => setIsNewClientDialogOpen(true)}
                >
                  <PlusCircle className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-700">Add New Client</span>
                </div>

                {clientSearchResults.length > 0 ? (
                  clientSearchResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-100 cursor-pointer rounded-md text-sm"
                      onClick={() => handleClientSelect(result)}
                    >
                      <div>
                        <p className="font-medium">
                          {result.name} ({result.company})
                        </p>
                        <p className="text-xs text-gray-500">{result.email}</p>
                      </div>
                      {selectedClient?.id === result.id && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    {clientSearchTerm.trim() && !isSearchingClients
                      ? `No clients found for "${clientSearchTerm}".`
                      : "Start typing to search for clients."}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="net_amount">Net Amount</Label>
        <Input
          id="net_amount"
          type="number"
          value={formData.net_amount}
          onChange={(e) => handleInputChange("net_amount", Number.parseFloat(e.target.value) || 0)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="total_amount">Total Amount</Label>
        <Input
          id="total_amount"
          type="number"
          value={formData.total_amount}
          onChange={(e) => handleInputChange("total_amount", Number.parseFloat(e.target.value) || 0)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mode_of_payment">Mode of Payment</Label>
        <Select value={formData.mode_of_payment} onValueChange={(value) => handleInputChange("mode_of_payment", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Credit/Debit Card">Credit/Debit Card</SelectItem>
            <SelectItem value="Gcash">Gcash</SelectItem>
            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_name">Bank Name</Label>
        <Input
          id="bank_name"
          value={formData.bank_name}
          onChange={(e) => handleInputChange("bank_name", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bi_no">BI No</Label>
        <Input
          id="bi_no"
          value={formData.bi_no}
          onChange={(e) => handleInputChange("bi_no", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="or_no">OR No</Label>
        <Input
          id="or_no"
          value={formData.or_no}
          onChange={(e) => handleInputChange("or_no", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoice_no">Invoice No</Label>
        <Input
          id="invoice_no"
          value={formData.invoice_no}
          onChange={(e) => handleInputChange("invoice_no", e.target.value)}
          required
        />
      </div>

      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="proceed_next_collection"
            checked={formData.proceed_next_collection}
            onChange={(e) => handleInputChange("proceed_next_collection", e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <Label htmlFor="proceed_next_collection" className="text-sm font-medium">
            Proceed to set the next collection date?
          </Label>
        </div>

        {formData.proceed_next_collection && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="next_collection_date">Next Collection Date</Label>
              <Input
                id="next_collection_date"
                type="date"
                value={formData.next_collection_date}
                onChange={(e) => handleInputChange("next_collection_date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="next_collection_status">Status for Next Collection</Label>
              <Select
                value={formData.next_collection_status}
                onValueChange={(value) => handleInputChange("next_collection_status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="collected">Collected</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="next_collection_bir_2307">BIR 2307 for Next Collection (PDF/DOC only)</Label>
              {!formData.next_collection_bir_2307 ? (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="next_collection_bir_2307"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> BIR 2307 for Next Collection
                      </p>
                      <p className="text-xs text-gray-500">PDF or DOC files only</p>
                    </div>
                    <input
                      id="next_collection_bir_2307"
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleInputChange("next_collection_bir_2307", file)
                        }
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-700">Existing file</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {typeof formData.next_collection_bir_2307 === "string" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const fileInput = document.getElementById(
                            "next_collection_bir_2307_replace",
                          ) as HTMLInputElement
                          if (fileInput) {
                            fileInput.click()
                          }
                        }}
                        className="flex items-center space-x-1"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Replace</span>
                      </Button>
                    )}
                    {typeof formData.next_collection_bir_2307 === "string" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(formData.next_collection_bir_2307 as string, "_blank")}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange("next_collection_bir_2307", null)}
                      className="p-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <input
                    id="next_collection_bir_2307_replace"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleInputChange("next_collection_bir_2307", file)
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditional Fields based on type */}
      {formData.type === "sites" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="booking_no">Booking No</Label>
            <Input
              id="booking_no"
              value={formData.booking_no || ""}
              onChange={(e) => handleInputChange("booking_no", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site">Site</Label>
            <Input id="site" value={formData.site || ""} onChange={(e) => handleInputChange("site", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="covered_period">Covered Period</Label>
            <DateRangePicker
              value={formData.covered_period_range}
              onChange={(range) => {
                handleInputChange("covered_period_range", range)
                // Convert range to string format for backward compatibility
                if (range?.from && range?.to) {
                  const fromStr = range.from.toISOString().split("T")[0]
                  const toStr = range.to.toISOString().split("T")[0]
                  handleInputChange("covered_period", `${fromStr} - ${toStr}`)
                } else {
                  handleInputChange("covered_period", "")
                }
              }}
              placeholder="Select date range"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bir_2307">BIR 2307 (PDF/DOC only)</Label>
            {!formData.bir_2307 ? (
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="bir_2307"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> BIR 2307
                    </p>
                    <p className="text-xs text-gray-500">PDF or DOC files only</p>
                  </div>
                  <input
                    id="bir_2307"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">Existing file</span>
                </div>
                <div className="flex items-center space-x-2">
                  {typeof formData.bir_2307 === "string" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={triggerFileReplace}
                      className="flex items-center space-x-1 bg-transparent"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Replace</span>
                    </Button>
                  )}
                  {typeof formData.bir_2307 === "string" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(formData.bir_2307 as string, "_blank")}
                      className="flex items-center space-x-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={removeFile} className="p-2 bg-transparent">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <input
                  id="bir_2307_replace"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection_date">Collection Date</Label>
            <Input
              id="collection_date"
              type="date"
              value={formData.collection_date || ""}
              onChange={(e) => handleInputChange("collection_date", e.target.value)}
            />
          </div>
        </>
      )}

      {formData.type === "supplies" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || ""}
              onChange={(e) => handleInputChange("date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Input
              id="product"
              value={formData.product || ""}
              onChange={(e) => handleInputChange("product", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer_date">Transfer Date</Label>
            <Input
              id="transfer_date"
              type="date"
              value={formData.transfer_date || ""}
              onChange={(e) => handleInputChange("transfer_date", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bs_no">BS No</Label>
            <Input
              id="bs_no"
              value={formData.bs_no || ""}
              onChange={(e) => handleInputChange("bs_no", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_for_collection">Due for Collection</Label>
            <Input
              id="due_for_collection"
              type="date"
              value={formData.due_for_collection || ""}
              onChange={(e) => handleInputChange("due_for_collection", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_paid">Date Paid</Label>
            <Input
              id="date_paid"
              type="date"
              value={formData.date_paid || ""}
              onChange={(e) => handleInputChange("date_paid", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="net_amount_collection">Net Amount Collection</Label>
            <Input
              id="net_amount_collection"
              type="number"
              value={formData.net_amount_collection || 0}
              onChange={(e) => handleInputChange("net_amount_collection", Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        </>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/finance/collectibles">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Collectible</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/finance/collectibles">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Collectible</h1>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/finance/collectibles">
          <Button variant="outline" type="button">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Collectible</h1>
          <p className="text-muted-foreground">Update collectible record</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collectible Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderFormFields()}
            <div className="flex justify-end space-x-2 pt-4">
              <Link href="/finance/collectibles">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Collectible"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ClientDialog
        open={isNewClientDialogOpen}
        onOpenChange={setIsNewClientDialogOpen}
        onSuccess={handleNewClientSuccess}
      />
    </div>
  )
}
