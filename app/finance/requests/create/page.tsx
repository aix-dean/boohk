"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { db, storage } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
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

type RequestType = "reimbursement" | "requisition" | "replenish"

type CreateRequestFormData = {
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

  // Reimbursement
  "Date Released": string

  // Requisition
  Cashback: string
  "O.R No.": string
  "Invoice No.": string
  Quotation: File | null
  "Date Requested": string

  // Replenish
  Particulars: string
  "Total Amount": string
  "Voucher No.": string
  "Management Approval": "Approved" | "Pending"
  // Uses 'Date Requested' above
  "Send Report": File | null
  "Print Report": File | null
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

export default function CreateRequestPage() {
  const { user, userData } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Derive the 'type' param as a stable primitive to avoid re-running effects on every render
  const tParam = (searchParams.get("type") || "").toLowerCase()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])

  // Initialize request_type from the URL once. This avoids setState loops from effects.
  const [formData, setFormData] = useState<CreateRequestFormData>(() => {
    const initialType: RequestType =
      tParam === "reimbursement" || tParam === "requisition" || tParam === "replenish"
        ? (tParam as RequestType)
        : "reimbursement"
    return {
      request_type: initialType,
      "Request No.": "",
      Requestor: user?.displayName || "",
      "Requested Item": "",
      Amount: "",
      Currency: "PHP",
      "Approved By": "",
      Attachments: null,
      Actions: "Pending",

      "Vendor Name": "",
      "TIN No.": "",
      "Business Address": "",

      "Date Released": "",

      Cashback: "",
      "O.R No.": "",
      "Invoice No.": "",
      Quotation: null,
      "Date Requested": "",

      Particulars: "",
      "Total Amount": "",
      "Voucher No.": "",
      "Management Approval": "Pending",
      "Send Report": null,
      "Print Report": null,
    }
  })

  // If the 'type' query param changes while on the page, update request_type only when it actually differs.
  useEffect(() => {
    if (tParam === "reimbursement" || tParam === "requisition" || tParam === "replenish") {
      setFormData((p) => (p.request_type === tParam ? p : { ...p, request_type: tParam as RequestType }))
    }
    // Depend only on the primitive string, not the searchParams object reference.
  }, [tParam])

  const handleText =
    (field: keyof CreateRequestFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }))

  const handleSelect = (field: keyof CreateRequestFormData) => (value: any) =>
    setFormData((p) => ({ ...p, [field]: value }))

  const handleFile = (field: "Attachments" | "Quotation" | "Send Report" | "Print Report") => (file: File | null) =>
    setFormData((p) => ({ ...p, [field]: file }))

  const companyIdentifier = useMemo(() => user?.company_id || userData?.project_id || user?.uid, [user, userData])

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
    // Shared
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

    // Module specific
    if (formData.request_type === "reimbursement") {
      if (!formData["Date Released"]) return "Date Released is mandatory."
      if (!formData["Requested Item"].trim() || !lettersAndNumbers(formData["Requested Item"])) {
        return "Requested Item is mandatory and must include letters and numbers."
      }
      if (!fileOk(formData.Attachments, true)) {
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
      // File uploads for Send Report and Print Report are no longer required.
    }

    return null
  }

  const generateRequestNumber = (): number => Math.floor(Math.random() * 900000) + 100000

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
      // Upload files based on type
      let attachmentsUrl = ""
      let quotationUrl = ""
      let sendReportUrl = ""
      let printReportUrl = ""

      const basePath = `finance-requests/${companyIdentifier}`

      // Reimbursement: attachments mandatory
      if (formData.request_type === "reimbursement" && formData.Attachments) {
        attachmentsUrl = await uploadFileToStorage(formData.Attachments, `${basePath}/attachments`)
      }

      // Requisition: optional attachments + quotation
      if (formData.request_type === "requisition" && formData.Attachments) {
        attachmentsUrl = await uploadFileToStorage(formData.Attachments, `${basePath}/attachments`)
      }
      if (formData.request_type === "requisition" && formData.Quotation) {
        quotationUrl = await uploadFileToStorage(formData.Quotation, `${basePath}/quotations`)
      }

      // Replenish: send/print report
      if (formData.request_type === "replenish" && formData["Send Report"]) {
        sendReportUrl = await uploadFileToStorage(formData["Send Report"], `${basePath}/send-report`)
      }
      if (formData.request_type === "replenish" && formData["Print Report"]) {
        printReportUrl = await uploadFileToStorage(formData["Print Report"], `${basePath}/print-report`)
      }

      // Prepare common document data
      const requestNo = Number.parseInt(formData["Request No."], 10) || generateRequestNumber()

      const baseData: any = {
        company_id: companyIdentifier,
        created: serverTimestamp(),
        deleted: false,
        request_type: formData.request_type,
        "Request No.": requestNo,
        Requestor: formData.Requestor.trim(),
        Amount: Number.parseFloat(formData.Amount) || 0,
        Currency: formData.Currency,
        "Approved By": formData["Approved By"].trim(),
        Attachments: attachmentsUrl, // may be empty string when not provided
        Actions: formData.Actions,

        "Vendor Name": formData["Vendor Name"].trim(),
        "TIN No.": formData["TIN No."].trim(),
        "Business Address": formData["Business Address"].trim(),
      }

      const documentData: any = { ...baseData }

      if (formData.request_type === "reimbursement") {
        documentData["Requested Item"] = formData["Requested Item"].trim()
        documentData["Date Released"] = new Date(formData["Date Released"])
      } else if (formData.request_type === "requisition") {
        documentData["Requested Item"] = formData["Requested Item"].trim()
        documentData["Date Requested"] = new Date(formData["Date Requested"])
        documentData.Cashback = Number.parseInt(formData.Cashback || "0", 10) || 0
        documentData["O.R No."] = formData["O.R No."].trim()
        documentData["Invoice No."] = formData["Invoice No."].trim()
        documentData.Quotation = quotationUrl
      } else if (formData.request_type === "replenish") {
        documentData.Particulars = formData.Particulars.trim()
        documentData["Requested Item"] = formData.Particulars.trim() // mirror for list
        documentData["Date Requested"] = new Date(formData["Date Requested"])
        documentData["Total Amount"] = Number.parseFloat(formData["Total Amount"]) || 0
        documentData["Voucher No."] = formData["Voucher No."].trim()
        documentData["Management Approval"] = formData["Management Approval"]
        if (sendReportUrl) documentData["Send Report"] = sendReportUrl
        if (printReportUrl) documentData["Print Report"] = printReportUrl
      }

      await addDoc(collection(db, "request"), documentData)

      toast({ title: "Success", description: "Request created successfully." })
      router.push("/finance/requests")
    } catch (error) {
      console.error("Error creating request:", error)
      toast({
        title: "Error",
        description: "Failed to create request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isUploading = uploadingFiles.length > 0

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
          <h1 className="text-2xl font-bold tracking-tight">Create New Request</h1>
          <p className="text-muted-foreground">
            Fill out the form below to create a new {formData.request_type} request.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
          <CardDescription>Provide information per module requirements.</CardDescription>
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
                  placeholder="Auto-generated if empty"
                  value={formData["Request No."]}
                  onChange={handleText("Request No.")}
                />
                <p className="text-xs text-muted-foreground">Only numbers allowed. Leave blank to auto-generate.</p>
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

            {/* Approved By and Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <SelectItem value="Send Report">Send Report</SelectItem>
                    <SelectItem value="Print Report">Print Report</SelectItem>
                    <SelectItem value="View">View</SelectItem>
                    <SelectItem value="Edit">Edit</SelectItem>
                    <SelectItem value="Delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

            {/* Module specific blocks */}
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
                  <p className="text-xs text-muted-foreground">
                    Must be provided. Displayed as {format(new Date(), "dd/MM/yyyy")} format in UI.
                  </p>
                </div>

                {/* Attachments mandatory */}
                <div className="space-y-2">
                  <Label htmlFor="attachments">Attachments (PDF/DOC, max 10MB) *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="attachments"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFile("Attachments")(e.target.files?.[0] || null)}
                      className="flex-1"
                      required
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  </div>
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
                {/* Send Report and Print Report uploads removed */}
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
                    Creating Request...
                  </>
                ) : (
                  "Create Request"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
