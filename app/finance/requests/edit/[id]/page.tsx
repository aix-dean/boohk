"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { db, storage } from "@/lib/firebase"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, X } from "lucide-react"

import type { FinanceRequest } from "@/lib/types/finance-request"

type RequestType = "reimbursement" | "requisition" | "replenish"

type EditRequestFormData = {
  request_type: RequestType

  // Common
  "Request No.": string
  Requestor: string
  Amount: string
  Currency: string
  "Approved By": string
  Actions: string

  "Vendor Name": string
  "TIN No.": string
  "Business Address": string

  // Shared concept of "item-like" for list compatibility
  "Requested Item": string

  // Uploads common
  Attachments: File | null
  currentAttachmentsUrl: string

  // Reimbursement
  "Date Released": string

  // Requisition
  Cashback: string
  "O.R No.": string
  "Invoice No.": string
  Quotation: File | null
  currentQuotationUrl: string
  "Date Requested": string

  // Replenish
  Particulars: string
  "Total Amount": string
  "Voucher No.": string
  "Management Approval": "Approved" | "Pending"
  "Send Report": File | null
  "Print Report": File | null
  currentSendReportUrl: string
  currentPrintReportUrl: string
}

const currencies = [
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
]

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])
const ACCEPTED_EXT = new Set(["pdf", "doc", "docx"])

function fileOk(file: File | null, mandatory: boolean) {
  if (!file) return !mandatory
  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  if (!ACCEPTED_MIME.has(file.type) && !ACCEPTED_EXT.has(ext)) return false
  if (file.size > MAX_FILE_BYTES) return false
  return true
}

function onlyAlphabet(str: string) {
  return /^[A-Za-z\s]+$/.test(str)
}
function onlyNumbers(str: string) {
  return /^\d+$/.test(str)
}
function lettersAndNumbers(str: string) {
  return /[A-Za-z]/.test(str) && /\d/.test(str) && /^[A-Za-z0-9\s]+$/.test(str)
}
function docNumberAllowed(str: string) {
  return /^[A-Za-z0-9#*+\-.\s]+$/.test(str)
}

function pesoSign(currency: string) {
  const c = currencies.find((x) => x.code === currency)
  return c?.symbol ?? ""
}

export default function EditRequestPage() {
  const { user, userData } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const requestId = params.id as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])

  const [formData, setFormData] = useState<EditRequestFormData>({
    request_type: "reimbursement",
    "Request No.": "",
    Requestor: "",
    "Requested Item": "",
    Amount: "",
    Currency: "PHP",
    "Approved By": "",
    Attachments: null,
    currentAttachmentsUrl: "",
    Actions: "Pending",

    "Vendor Name": "",
    "TIN No.": "",
    "Business Address": "",

    "Date Released": "",

    Cashback: "",
    "O.R No.": "",
    "Invoice No.": "",
    Quotation: null,
    currentQuotationUrl: "",
    "Date Requested": "",

    Particulars: "",
    "Total Amount": "",
    "Voucher No.": "",
    "Management Approval": "Pending",
    "Send Report": null,
    "Print Report": null,
    currentSendReportUrl: "",
    currentPrintReportUrl: "",
  })

  const companyIdentifier = useMemo(() => user?.company_id || userData?.project_id || user?.uid, [user, userData])

  // Load existing request data
  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId || !companyIdentifier) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        const docRef = doc(db, "request", requestId)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
          setNotFound(true)
          return
        }

        const data = docSnap.data() as any

        // Check ownership and deletion status
        if (data.company_id !== companyIdentifier || data.deleted === true) {
          setNotFound(true)
          return
        }

        const request = { id: docSnap.id, ...data } as FinanceRequest

        // Populate form with existing data
        setFormData({
          request_type: request.request_type as RequestType,
          "Request No.": String(request["Request No."] || ""),
          Requestor: request.Requestor || "",
          "Requested Item": request["Requested Item"] || "",
          Amount: String(request.Amount || ""),
          Currency: request.Currency || "PHP",
          "Approved By": request["Approved By"] || "",
          Actions: request.Actions || "Pending",
          currentAttachmentsUrl: request.Attachments || "",
          Attachments: null,

          "Vendor Name": (request as any)["Vendor Name"] || "",
          "TIN No.": (request as any)["TIN No."] || "",
          "Business Address": (request as any)["Business Address"] || "",

          "Date Released": request["Date Released"] ? format(request["Date Released"].toDate(), "yyyy-MM-dd") : "",

          Cashback: String(request.Cashback || ""),
          "O.R No.": request["O.R No."] || "",
          "Invoice No.": request["Invoice No."] || "",
          currentQuotationUrl: request.Quotation || "",
          Quotation: null,
          "Date Requested": request["Date Requested"] ? format(request["Date Requested"].toDate(), "yyyy-MM-dd") : "",

          Particulars: (request as any).Particulars || "",
          "Total Amount": String((request as any)["Total Amount"] || ""),
          "Voucher No.": (request as any)["Voucher No."] || "",
          "Management Approval": (request as any)["Management Approval"] || "Pending",
          currentSendReportUrl: (request as any)["Send Report"] || "",
          currentPrintReportUrl: (request as any)["Print Report"] || "",
          "Send Report": null,
          "Print Report": null,
        })

        setLoading(false)
      } catch (error) {
        console.error("Error fetching request:", error)
        toast({
          title: "Error",
          description: "Failed to fetch request details.",
          variant: "destructive",
        })
        setNotFound(true)
        setLoading(false)
      }
    }

    fetchRequest()
  }, [requestId, companyIdentifier, toast])

  const handleText =
    (field: keyof EditRequestFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }))

  const handleSelect = (field: keyof EditRequestFormData) => (value: any) =>
    setFormData((p) => ({ ...p, [field]: value }))

  const handleFile = (field: "Attachments" | "Quotation" | "Send Report" | "Print Report") => (file: File | null) =>
    setFormData((p) => ({ ...p, [field]: file }))

  const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    setUploadingFiles((prev) => [...prev, file.name])
    try {
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name}`
      const storageRef = ref(storage, `${path}/${fileName}`)
      const snapshot = await uploadBytes(storageRef, file)
      const url = await getDownloadURL(snapshot.ref)
      return url
    } finally {
      setUploadingFiles((prev) => prev.filter((n) => n !== file.name))
    }
  }

  const amountPrefix = useMemo(() => pesoSign(formData.Currency), [formData.Currency])

  const validate = (): string | null => {
    // Shared validation logic (same as create page)
    if (formData["Request No."] && !onlyNumbers(formData["Request No."])) {
      return "Request No. must contain numbers only."
    }
    if (!formData.Requestor.trim() || !onlyAlphabet(formData.Requestor)) {
      return "Requestor is mandatory and must contain alphabets only."
    }
    if (!formData.Amount.trim() || !onlyNumbers(formData.Amount)) {
      return "Amount is mandatory and must contain numbers only."
    }
    if (!formData["Approved By"].trim() || !onlyAlphabet(formData["Approved By"])) {
      return "Approved By is mandatory and must contain alphabets only."
    }

    if (!formData["Vendor Name"].trim() || !onlyAlphabet(formData["Vendor Name"])) {
      return "Vendor Name is mandatory and must contain alphabets only."
    }
    if (!formData["TIN No."].trim() || !lettersAndNumbers(formData["TIN No."])) {
      return "TIN No. is mandatory and must include letters and numbers."
    }
    if (!formData["Business Address"].trim()) {
      return "Business Address is mandatory."
    }

    // Module specific validation
    if (formData.request_type === "reimbursement") {
      if (!formData["Date Released"]) return "Date Released is mandatory."
      if (!formData["Requested Item"].trim() || !lettersAndNumbers(formData["Requested Item"])) {
        return "Requested Item is mandatory and must include letters and numbers."
      }
      // For edit, attachments are not mandatory if they already exist
      if (formData.Attachments && !fileOk(formData.Attachments, false)) {
        return "Attachments must be a PDF/DOC up to 10 MB."
      }
    } else if (formData.request_type === "requisition") {
      if (!formData["Date Requested"]) return "Date Requested is mandatory."
      if (!formData["Requested Item"].trim() || !lettersAndNumbers(formData["Requested Item"])) {
        return "Requested Item is mandatory and must include letters and numbers."
      }
      if (formData.Cashback && !onlyNumbers(formData.Cashback)) {
        return "Cashback must contain numbers only."
      }
      if (!formData["O.R No."].trim() || !docNumberAllowed(formData["O.R No."])) {
        return "O.R No. is mandatory and may include letters, numbers, and # * + - . only."
      }
      if (!formData["Invoice No."].trim() || !docNumberAllowed(formData["Invoice No."])) {
        return "Invoice No. is mandatory and may include letters, numbers, and # * + - . only."
      }
      if (formData.Quotation && !fileOk(formData.Quotation, false)) {
        return "Quotation must be a PDF/DOC up to 10 MB."
      }
      if (formData.Attachments && !fileOk(formData.Attachments, false)) {
        return "Attachments must be a PDF/DOC up to 10 MB."
      }
    } else if (formData.request_type === "replenish") {
      if (!formData["Date Requested"]) return "Date Requested is mandatory."
      if (!formData.Particulars.trim() || !lettersAndNumbers(formData.Particulars)) {
        return "Particulars is mandatory and must include letters and numbers."
      }
      if (!formData["Total Amount"].trim() || !onlyNumbers(formData["Total Amount"])) {
        return "Total Amount is mandatory and must contain numbers only."
      }
      if (!formData["Voucher No."].trim() || !docNumberAllowed(formData["Voucher No."])) {
        return "Voucher No. is mandatory and may include letters, numbers, and # * + - . only."
      }
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyIdentifier) {
      toast({
        title: "Error",
        description: "Unable to identify company information. Please try logging in again.",
        variant: "destructive",
      })
      return
    }

    const err = validate()
    if (err) {
      toast({ title: "Validation error", description: err, variant: "destructive" })
      return
    }

    setIsSubmitting(true)

    try {
      const basePath = `finance-requests/${companyIdentifier}`

      // Handle file uploads - only upload if new files are provided
      let attachmentsUrl = formData.currentAttachmentsUrl
      let quotationUrl = formData.currentQuotationUrl
      let sendReportUrl = formData.currentSendReportUrl
      let printReportUrl = formData.currentPrintReportUrl

      if (formData.Attachments) {
        attachmentsUrl = await uploadFileToStorage(formData.Attachments, `${basePath}/attachments`)
      }

      if (formData.request_type === "requisition" && formData.Quotation) {
        quotationUrl = await uploadFileToStorage(formData.Quotation, `${basePath}/quotations`)
      }

      if (formData.request_type === "replenish") {
        if (formData["Send Report"]) {
          sendReportUrl = await uploadFileToStorage(formData["Send Report"], `${basePath}/send-report`)
        }
        if (formData["Print Report"]) {
          printReportUrl = await uploadFileToStorage(formData["Print Report"], `${basePath}/print-report`)
        }
      }

      // Prepare update data
      const updateData: any = {
        request_type: formData.request_type,
        "Request No.": Number.parseInt(formData["Request No."], 10) || 0,
        Requestor: formData.Requestor.trim(),
        Amount: Number.parseFloat(formData.Amount) || 0,
        Currency: formData.Currency,
        "Approved By": formData["Approved By"].trim(),
        Actions: formData.Actions,
        Attachments: attachmentsUrl,

        "Vendor Name": formData["Vendor Name"].trim(),
        "TIN No.": formData["TIN No."].trim(),
        "Business Address": formData["Business Address"].trim(),

        updated: serverTimestamp(),
      }

      if (formData.request_type === "reimbursement") {
        updateData["Requested Item"] = formData["Requested Item"].trim()
        updateData["Date Released"] = new Date(formData["Date Released"])
      } else if (formData.request_type === "requisition") {
        updateData["Requested Item"] = formData["Requested Item"].trim()
        updateData["Date Requested"] = new Date(formData["Date Requested"])
        updateData.Cashback = Number.parseInt(formData.Cashback || "0", 10) || 0
        updateData["O.R No."] = formData["O.R No."].trim()
        updateData["Invoice No."] = formData["Invoice No."].trim()
        updateData.Quotation = quotationUrl
      } else if (formData.request_type === "replenish") {
        updateData.Particulars = formData.Particulars.trim()
        updateData["Requested Item"] = formData.Particulars.trim() // mirror for list
        updateData["Date Requested"] = new Date(formData["Date Requested"])
        updateData["Total Amount"] = Number.parseFloat(formData["Total Amount"]) || 0
        updateData["Voucher No."] = formData["Voucher No."].trim()
        updateData["Management Approval"] = formData["Management Approval"]
        if (sendReportUrl) updateData["Send Report"] = sendReportUrl
        if (printReportUrl) updateData["Print Report"] = printReportUrl
      }

      await updateDoc(doc(db, "request", requestId), updateData)

      toast({ title: "Success", description: "Request updated successfully." })
      router.push("/finance/requests")
    } catch (error) {
      console.error("Error updating request:", error)
      toast({
        title: "Error",
        description: "Failed to update request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isUploading = uploadingFiles.length > 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-muted rounded animate-pulse" />
          <div>
            <div className="h-8 bg-muted rounded w-48 animate-pulse" />
            <div className="h-4 bg-muted rounded w-32 mt-2 animate-pulse" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded w-32 animate-pulse" />
            <div className="h-4 bg-muted rounded w-64 animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/finance/requests">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Requests
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">Request Not Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              The request you're trying to edit doesn't exist or you don't have permission to edit it.
            </p>
            <Link href="/finance/requests">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Requests
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/finance/requests">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Requests
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Request #{formData["Request No."]}</h1>
          <p className="text-muted-foreground">Update the {formData.request_type} request details below.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
          <CardDescription>Update the request information. Fields marked with * are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Request Type + No. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="request_type">Request Type *</Label>
                <Select value={formData.request_type} onValueChange={handleSelect("request_type")}>
                  <SelectTrigger id="request_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reimbursement">Reimbursement</SelectItem>
                    <SelectItem value="requisition">Requisition</SelectItem>
                    <SelectItem value="replenish">Replenish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="request_no">Request No. *</Label>
                <Input
                  id="request_no"
                  type="text"
                  inputMode="numeric"
                  pattern="\d+"
                  title="Numbers only"
                  placeholder="Request number"
                  value={formData["Request No."]}
                  onChange={handleText("Request No.")}
                />
                <p className="text-xs text-muted-foreground">Only numbers allowed.</p>
              </div>
            </div>

            {/* Names and Amount */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="requestor">Requestor *</Label>
                <Input
                  id="requestor"
                  required
                  placeholder="Full name"
                  value={formData.Requestor}
                  onChange={handleText("Requestor")}
                  pattern="[A-Za-z\s]+"
                  title="Alphabets only"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {amountPrefix}
                  </div>
                  <Input
                    id="amount"
                    className="pl-7"
                    type="text"
                    inputMode="numeric"
                    required
                    pattern="\d+"
                    title="Numbers only"
                    placeholder="0"
                    value={formData.Amount}
                    onChange={handleText("Amount")}
                  />
                </div>
              </div>
            </div>

            {/* Currency and Approved By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select value={formData.Currency} onValueChange={handleSelect("Currency")}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="approved_by">Approved By *</Label>
                <Input
                  id="approved_by"
                  required
                  placeholder="Enter approver name"
                  value={formData["Approved By"]}
                  onChange={handleText("Approved By")}
                  pattern="[A-Za-z\s]+"
                  title="Alphabets only"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="actions">Status *</Label>
              <Select value={formData.Actions} onValueChange={handleSelect("Actions")}>
                <SelectTrigger id="actions">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Accept">Accept</SelectItem>
                  <SelectItem value="Decline">Decline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Vendor Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="vendor_name">Vendor Name *</Label>
                  <Input
                    id="vendor_name"
                    required
                    placeholder="Enter vendor name"
                    value={formData["Vendor Name"]}
                    onChange={handleText("Vendor Name")}
                    pattern="[A-Za-z\s]+"
                    title="Alphabets only"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tin_no">TIN No. *</Label>
                  <Input
                    id="tin_no"
                    required
                    placeholder="Enter TIN number"
                    value={formData["TIN No."]}
                    onChange={handleText("TIN No.")}
                    title="Must include letters and numbers"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_address">Business Address *</Label>
                <Textarea
                  id="business_address"
                  required
                  placeholder="Enter complete business address"
                  value={formData["Business Address"]}
                  onChange={handleText("Business Address")}
                  rows={3}
                />
              </div>
            </div>

            {/* Module specific fields */}
            {formData.request_type === "reimbursement" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="requested_item">Requested Item *</Label>
                  <Textarea
                    id="requested_item"
                    required
                    placeholder="Describe the item (must include letters and numbers)"
                    rows={3}
                    value={formData["Requested Item"]}
                    onChange={handleText("Requested Item")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_released">Date Released *</Label>
                  <Input
                    id="date_released"
                    type="date"
                    required
                    value={formData["Date Released"]}
                    onChange={handleText("Date Released")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attachments">Attachments (PDF/DOC, max 10MB)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="attachments"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFile("Attachments")(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    {formData.Attachments && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFile("Attachments")(null)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.currentAttachmentsUrl && !formData.Attachments && (
                    <p className="text-xs text-muted-foreground">
                      Current attachment will be kept if no new file is uploaded.
                    </p>
                  )}
                </div>
              </>
            )}

            {formData.request_type === "requisition" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="date_requested">Date Requested *</Label>
                  <Input
                    id="date_requested"
                    type="date"
                    required
                    value={formData["Date Requested"]}
                    onChange={handleText("Date Requested")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requested_item_req">Requested Item *</Label>
                  <Textarea
                    id="requested_item_req"
                    required
                    placeholder="Describe the item (must include letters and numbers)"
                    rows={3}
                    value={formData["Requested Item"]}
                    onChange={handleText("Requested Item")}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="cashback">Cashback</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {pesoSign(formData.Currency)}
                      </div>
                      <Input
                        id="cashback"
                        type="text"
                        inputMode="numeric"
                        pattern="\d+"
                        title="Numbers only"
                        placeholder="0"
                        className="pl-7"
                        value={formData.Cashback}
                        onChange={handleText("Cashback")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="or_no">O.R No. *</Label>
                    <Input
                      id="or_no"
                      required
                      placeholder="Allowed: letters, numbers, # * + - ."
                      value={formData["O.R No."]}
                      onChange={handleText("O.R No.")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_no">Invoice No. *</Label>
                  <Input
                    id="invoice_no"
                    required
                    placeholder="Allowed: letters, numbers, # * + - ."
                    value={formData["Invoice No."]}
                    onChange={handleText("Invoice No.")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quotation">Quotation (PDF/DOC, max 10MB)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="quotation"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFile("Quotation")(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    {formData.Quotation && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFile("Quotation")(null)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.currentQuotationUrl && !formData.Quotation && (
                    <p className="text-xs text-muted-foreground">
                      Current quotation will be kept if no new file is uploaded.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attachments_opt">Attachments (PDF/DOC, max 10MB)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="attachments_opt"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFile("Attachments")(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    {formData.Attachments && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFile("Attachments")(null)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.currentAttachmentsUrl && !formData.Attachments && (
                    <p className="text-xs text-muted-foreground">
                      Current attachment will be kept if no new file is uploaded.
                    </p>
                  )}
                </div>
              </>
            )}

            {formData.request_type === "replenish" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="date_requested_repl">Date Requested *</Label>
                  <Input
                    id="date_requested_repl"
                    type="date"
                    required
                    value={formData["Date Requested"]}
                    onChange={handleText("Date Requested")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="particulars">Particulars *</Label>
                  <Textarea
                    id="particulars"
                    required
                    placeholder="Must include letters and numbers"
                    rows={3}
                    value={formData.Particulars}
                    onChange={handleText("Particulars")}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="total_amount">Total Amount *</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {pesoSign(formData.Currency)}
                      </div>
                      <Input
                        id="total_amount"
                        type="text"
                        inputMode="numeric"
                        required
                        pattern="\d+"
                        title="Numbers only"
                        className="pl-7"
                        placeholder="0"
                        value={formData["Total Amount"]}
                        onChange={handleText("Total Amount")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="voucher_no">Voucher No. *</Label>
                    <Input
                      id="voucher_no"
                      required
                      placeholder="Allowed: letters, numbers, # * + - ."
                      value={formData["Voucher No."]}
                      onChange={handleText("Voucher No.")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mgmt_approval">Management Approval *</Label>
                  <Select value={formData["Management Approval"]} onValueChange={handleSelect("Management Approval")}>
                    <SelectTrigger id="mgmt_approval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Uploading indicator */}
            {(isUploading || uploadingFiles.length > 0) && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading files...</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {uploadingFiles.map((name) => (
                      <div key={name} className="text-xs text-muted-foreground">
                        • {name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form actions */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <Link href="/finance/requests">
                <Button type="button" variant="outline" disabled={isSubmitting || isUploading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Request...
                  </>
                ) : (
                  "Update Request"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
