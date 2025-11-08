"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Upload, X, PlusCircle, Loader2, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getPaginatedClients, type Client } from "@/lib/client-service"
import { ClientDialog } from "@/components/client-dialog"
import { useAuth } from "@/contexts/auth-context"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { getQuotationById } from "@/lib/quotation-service"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
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
  next_collection_bir_2307?: File | null
  next_collection_status: "pending" | "collected" | "overdue"
  quotation_id?: string
  // Sites specific fields
  booking_no?: string
  site?: string
  covered_period?: string
  covered_period_range?: DateRange
  bir_2307?: File | null
  collection_date?: string
  // Supplies specific fields
  date?: string
  product?: string
  transfer_date?: string
  bs_no?: string
  due_for_collection?: string
  date_paid?: string
  net_amount_collection?: number
  vendor_name?: string
  tin_no?: string
  business_address?: string
}

interface Collectible {
  id?: string
  created?: any
  company_id?: string
  type: string
  updated?: any
  deleted: boolean
  client_name: string
  net_amount: number
  total_amount: number
  mode_of_payment: string
  bank_name?: string
  bi_no?: string
  or_no?: string
  invoice_no?: string
  next_collection_date?: string
  status: string
  vendor_name: string
  tin_no: string
  business_address: string
  // Sites specific fields
  booking_no?: string
  site?: string
  covered_period?: string
  bir_2307?: string
  collection_date?: string
  // Supplies specific fields
  date?: string
  product?: string
  transfer_date?: string
  bs_no?: string
  due_for_collection?: string
  date_paid?: string
  net_amount_collection?: number
  // Next collection fields
  next_bir_2307?: string
  next_status?: string
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

export default function CreateCollectiblePage() {
  const [formData, setFormData] = useState<CollectibleFormData>(initialFormData)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)
  const clientSearchRef = useRef<HTMLDivElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [hasLoadedQuotationData, setHasLoadedQuotationData] = useState(false)

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

  useEffect(() => {
    const fromQuotation = searchParams.get("from_quotation")
    if (fromQuotation === "true" && !hasLoadedQuotationData) {
      const clientName = searchParams.get("client_name") || ""
      const totalAmount = Number.parseFloat(searchParams.get("total_amount") || "0")
      const quotationNumber = searchParams.get("quotation_number") || ""
      const quotationId = searchParams.get("quotation_id") || ""

      const loadQuotationData = async () => {
        if (quotationId) {
          try {
            const quotationData = await getQuotationById(quotationId)
            if (quotationData && quotationData.start_date && quotationData.end_date) {
              const formatDateOnly = (dateString: string) => {
                const date = new Date(dateString)
                return date.toISOString().split("T")[0]
              }

              const startDate = formatDateOnly(quotationData.start_date)
              const endDate = formatDateOnly(quotationData.end_date)
              const coveredPeriod = `${startDate} - ${endDate}`

              setFormData((prev) => ({
                ...prev,
                client_name: clientName,
                total_amount: totalAmount,
                net_amount: totalAmount,
                type: "sites",
                status: "pending",
                quotation_id: quotationId,
                covered_period: coveredPeriod,
              }))
            } else {
              setFormData((prev) => ({
                ...prev,
                client_name: clientName,
                total_amount: totalAmount,
                net_amount: totalAmount,
                type: "sites",
                status: "pending",
                quotation_id: quotationId,
              }))
            }
          } catch (error) {
            console.error("Error fetching quotation data:", error)
            setFormData((prev) => ({
              ...prev,
              client_name: clientName,
              total_amount: totalAmount,
              net_amount: totalAmount,
              type: "sites",
              status: "pending",
              quotation_id: quotationId,
            }))
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            client_name: clientName,
            total_amount: totalAmount,
            net_amount: totalAmount,
            type: "sites",
            status: "pending",
            quotation_id: quotationId,
          }))
        }

        if (clientName) {
          setClientSearchTerm(clientName)
        }

        toast({
          title: "Quotation Data Loaded",
          description: `Form has been pre-populated with data from quotation ${quotationNumber}`,
        })

        setHasLoadedQuotationData(true)
      }

      loadQuotationData()
    }
  }, [searchParams, hasLoadedQuotationData, toast])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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

  const handleNextCollectionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      if (!allowedTypes.includes(file.type)) {
        alert("Please upload only PDF or DOC files.")
        return
      }
      setFormData((prev) => ({ ...prev, next_collection_bir_2307: file }))
    }
  }

  const removeNextCollectionFile = () => {
    setFormData((prev) => ({ ...prev, next_collection_bir_2307: null }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let bir2307Url = ""
      if (formData.bir_2307 && formData.bir_2307 instanceof File) {
        bir2307Url = await uploadFileToFirebaseStorage(formData.bir_2307, "collectibles/bir_2307/")
      }

      let nextBir2307Url = ""
      if (
        formData.proceed_next_collection &&
        formData.next_collection_bir_2307 &&
        formData.next_collection_bir_2307 instanceof File
      ) {
        nextBir2307Url = await uploadFileToFirebaseStorage(
          formData.next_collection_bir_2307,
          "collectibles/next_bir_2307/",
        )
      }

      const collectibleData: any = {
        client_name: formData.client_name || "",
        net_amount: Number.parseFloat(formData.net_amount) || 0,
        total_amount: Number.parseFloat(formData.total_amount) || 0,
        mode_of_payment: formData.mode_of_payment || "",
        bank_name: formData.bank_name || "",
        bi_no: formData.bi_no || "",
        or_no: formData.or_no || "",
        invoice_no: formData.invoice_no || "",
        status: formData.status || "",
        vendor_name: formData.vendor_name || "",
        tin_no: formData.tin_no || "",
        business_address: formData.business_address || "",
        deleted: false,
        created: serverTimestamp(),
        updated: serverTimestamp(),
        company_id: user?.company_id || user?.uid || "",
      }

      if (formData.quotation_id) {
        collectibleData.quotation_id = formData.quotation_id
      }

      if (formData.type === "sites") {
        if (formData.booking_no) collectibleData.booking_no = formData.booking_no
        if (formData.site) collectibleData.site = formData.site
        if (formData.covered_period) collectibleData.covered_period = formData.covered_period
        if (bir2307Url) collectibleData.bir_2307 = bir2307Url
        if (formData.collection_date) collectibleData.collection_date = formData.collection_date
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
        if (formData.next_collection_date) collectibleData.next_collection_date = formData.next_collection_date
        if (nextBir2307Url) collectibleData.next_bir_2307 = nextBir2307Url
        if (formData.next_collection_status) collectibleData.next_status = formData.next_collection_status
      }

      const docRef = await addDoc(collection(db, "collectibles"), collectibleData)
      console.log("Collectible created with ID:", docRef.id)

      await syncQuotationCollectionStatus(docRef.id)

      router.push("/finance/collectibles")
    } catch (error) {
      console.error("Error creating collectible:", error)
      setSubmitError("Failed to create collectible. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderFormFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              value={selectedClient ? selectedClient.company || selectedClient.name : clientSearchTerm}
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
          {isClientDropdownOpen && (
            <Card className="absolute top-full z-50 mt-1 w-full max-h-[200px] overflow-auto shadow-lg">
              <div className="p-2">
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

      <div className="md:col-span-2 space-y-4 border-t pt-4">
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
              <Label htmlFor="next_collection_status">Status</Label>
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
                      onChange={handleNextCollectionFileChange}
                    />
                  </label>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{formData.next_collection_bir_2307.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(formData.next_collection_bir_2307.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeNextCollectionFile}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
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
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{formData.bir_2307.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(formData.bir_2307.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
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

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/finance/collectibles">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Collectible</h1>
          <p className="text-muted-foreground">
            {searchParams.get("from_quotation") === "true"
              ? `Creating collectible from quotation ${searchParams.get("quotation_number") || ""}`
              : "Add a new collectible record"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collectible Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderFormFields()}
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{submitError}</div>
            )}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/finance/collectibles")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Collectible"}
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
