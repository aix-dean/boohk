"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { db } from "@/lib/firebase"
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  User,
  X,
  Printer,
  Send,
} from "lucide-react"

import type { FinanceRequest } from "@/lib/types/finance-request"
import { generateReplenishRequestPDF } from "@/lib/replenish-pdf"

// Currency helpers
const currencies = [
  { code: "PHP", symbol: "₱" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "CHF", symbol: "CHF" },
  { code: "CNY", symbol: "¥" },
  { code: "SGD", symbol: "S$" },
  { code: "HKD", symbol: "HK$" },
  { code: "KRW", symbol: "₩" },
  { code: "THB", symbol: "฿" },
  { code: "MYR", symbol: "RM" },
  { code: "IDR", symbol: "Rp" },
  { code: "VND", symbol: "₫" },
]

function getCurrencySymbol(currencyCode?: string) {
  if (!currencyCode) return ""
  const found = currencies.find((c) => c.code === currencyCode)
  return found?.symbol ?? ""
}

function formatAmount(amount: number, currencyCode?: string) {
  const sym = getCurrencySymbol(currencyCode || "PHP")
  return `${sym}${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Status options registry (for icons/colors)
const statusOptions = [
  { value: "Pending", label: "Pending", icon: Clock, color: "text-yellow-600" },
  { value: "Approved", label: "Approved", icon: CheckCircle, color: "text-green-600" },
  { value: "Rejected", label: "Rejected", icon: X, color: "text-red-600" },
  { value: "Processing", label: "Processing", icon: AlertCircle, color: "text-blue-600" },
  { value: "Accept", label: "Accept", icon: CheckCircle, color: "text-green-600" },
  { value: "Decline", label: "Decline", icon: X, color: "text-red-600" },
] as const

// Make actions dependent on type (menu choices)
const getTypeStatusValues = (type?: string): string[] => {
  switch ((type || "").toLowerCase()) {
    case "reimbursement":
      return ["Accept", "Decline"]
    case "requisition":
      return ["Approved", "Decline"]
    case "replenish":
      return ["Approved", "Pending"]
    default:
      return ["Pending", "Approved", "Rejected", "Processing"]
  }
}

const getStatusOptionByValue = (value: string) =>
  statusOptions.find((s) => s.value.toLowerCase() === value.toLowerCase())

type SortDir = "asc" | "desc"
type SortCol = "requestNo" | "type" | "requestor" | "item" | "amount" | "status" | "date"
type TabKey = "all" | "reimbursement" | "requisition" | "replenish"

const tabLabels: Record<TabKey, string> = {
  all: "All",
  reimbursement: "Reimbursement",
  requisition: "Requisition",
  replenish: "Replenish",
}

function getStatusBadgeVariant(status?: string) {
  const s = status?.toLowerCase?.() || ""
  if (s === "approved" || s === "accept") return "default"
  if (s === "pending") return "secondary"
  if (s === "rejected" || s === "decline") return "destructive"
  if (s === "processing") return "outline"
  return "secondary"
}

function getRequestTypeBadgeVariant(type?: string) {
  if (type === "reimbursement") return "outline"
  if (type === "replenish") return "default"
  return "secondary"
}

function base64ToBlob(base64: string, mime = "application/pdf"): Blob {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mime })
}

export default function RequestsView() {
  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()

  const [requests, setRequests] = useState<FinanceRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Actions state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState("")
  const [sortCol, setSortCol] = useState<SortCol>("requestNo")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // Tabs state
  const [activeTab, setActiveTab] = useState<TabKey>("all")

  // Send dialog state
  const [sendOpen, setSendOpen] = useState(false)
  const [sendFor, setSendFor] = useState<FinanceRequest | null>(null)
  const [sending, setSending] = useState(false)
  const [sendTo, setSendTo] = useState("")
  const [sendCc, setSendCc] = useState("")
  const [sendSubject, setSendSubject] = useState("")
  const [sendMessage, setSendMessage] = useState("")

  // Fetch from Firestore
  useEffect(() => {
    const companyIdentifier = (user as any)?.company_id || (userData as any)?.project_id || (user as any)?.uid

    if (!companyIdentifier) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, "request"),
      where("company_id", "==", companyIdentifier),
      where("deleted", "==", false),
    )

    const unsub = onSnapshot(
      q,
      (qs) => {
        const list: FinanceRequest[] = []
        qs.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }))

        // initial ordering by created desc (fallback to Request No.)
        list.sort((a, b) => {
          const at = (a as any).created?.toDate?.()?.getTime?.() ?? 0
          const bt = (b as any).created?.toDate?.()?.getTime?.() ?? 0
          if (bt !== at) return bt - at
          const aNo = Number((a as any)["Request No."] ?? 0)
          const bNo = Number((b as any)["Request No."] ?? 0)
          return bNo - aNo
        })

        setRequests(list)
        setLoading(false)
      },
      (error) => {
        console.error("Error fetching requests:", error)
        toast({
          title: "Error",
          description: "Failed to fetch requests. Please try again.",
          variant: "destructive",
        })
        setLoading(false)
      },
    )

    return () => unsub()
  }, [user, userData, toast])

  // Derived counts for tabs
  const counts = useMemo(() => {
    const reimbursement = requests.filter((r: any) => r.request_type === "reimbursement").length
    const requisition = requests.filter((r: any) => r.request_type === "requisition").length
    const replenish = requests.filter((r: any) => r.request_type === "replenish").length
    return {
      all: requests.length,
      reimbursement,
      requisition,
      replenish,
    }
  }, [requests])

  // Search
  const searched = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return requests

    return requests.filter((r: any) => {
      const requestNo = String(r["Request No."] ?? "").toLowerCase()
      const requestType = String(r.request_type ?? "").toLowerCase()
      const requestor = String(r.Requestor ?? "").toLowerCase()
      const requestedItem = String(r["Requested Item"] ?? "").toLowerCase()
      const particulars = String(r.Particulars ?? "").toLowerCase()
      const amount = String(r.Amount ?? "")
      const totalAmount = String(r["Total Amount"] ?? "")
      const currency = String(r.Currency ?? "PHP").toLowerCase()
      const approvedBy = String(r["Approved By"] ?? "").toLowerCase()
      const status = String(r.Actions ?? "").toLowerCase()
      const createdDate = r.created ? format(r.created.toDate(), "MMM dd, yyyy").toLowerCase() : ""

      // Type-specific fields searchable
      const dateReleased = r["Date Released"] ? format(r["Date Released"].toDate(), "MMM dd, yyyy").toLowerCase() : ""
      const cashback = String(r.Cashback ?? "")
      const orNo = String(r["O.R No."] ?? "").toLowerCase()
      const invoiceNo = String(r["Invoice No."] ?? "").toLowerCase()
      const dateRequested = r["Date Requested"]
        ? format(r["Date Requested"].toDate(), "MMM dd, yyyy").toLowerCase()
        : ""
      const voucherNo = String(r["Voucher No."] ?? "").toLowerCase()
      const mgmtApproval = String(r["Management Approval"] ?? "").toLowerCase()

      const haystack = [
        requestNo,
        requestType,
        requestor,
        requestedItem,
        particulars,
        amount,
        totalAmount,
        currency,
        approvedBy,
        status,
        createdDate,
        dateReleased,
        cashback,
        orNo,
        invoiceNo,
        dateRequested,
        voucherNo,
        mgmtApproval,
      ]

      return haystack.some((s) => s.includes(q))
    })
  }, [requests, searchQuery])

  // Apply tab filter
  const tabFiltered = useMemo(() => {
    if (activeTab === "all") return searched
    return searched.filter((r: any) => r.request_type === activeTab)
  }, [searched, activeTab])

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...tabFiltered]

    const cmpStr = (a?: string, b?: string) => (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" })

    arr.sort((a: any, b: any) => {
      let res = 0

      switch (sortCol) {
        case "requestNo": {
          const aNo = Number(a["Request No."] ?? 0)
          const bNo = Number(b["Request No."] ?? 0)
          res = aNo - bNo
          break
        }
        case "type": {
          res = cmpStr(a.request_type, b.request_type)
          break
        }
        case "requestor": {
          res = cmpStr(a.Requestor, b.Requestor)
          break
        }
        case "item": {
          res = cmpStr(a["Requested Item"], b["Requested Item"])
          break
        }
        case "amount": {
          const aAmt = Number(a["Total Amount"] ?? a.Amount ?? 0)
          const bAmt = Number(b["Total Amount"] ?? b.Amount ?? 0)
          res = aAmt - bAmt
          break
        }
        case "status": {
          res = cmpStr(a.Actions, b.Actions)
          break
        }
        case "date": {
          const at = a.created?.toDate?.()?.getTime?.() ?? 0
          const bt = b.created?.toDate?.()?.getTime?.() ?? 0
          res = at - bt
          break
        }
        default:
          res = 0
      }

      return sortDir === "asc" ? res : -res
    })

    return arr
  }, [tabFiltered, sortCol, sortDir])

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(col)
      setSortDir(["requestNo", "amount", "date"].includes(col) ? "desc" : "asc")
    }
  }

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    return sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  // Notifications
  async function notifyRequestor(request: any, kind: "approved" | "declined" | "pending") {
    try {
      await addDoc(collection(db, "notifications"), {
        company_id: request.company_id,
        request_id: request.id,
        request_type: request.request_type,
        requestor_name: request.Requestor,
        kind,
        message:
          kind === "approved"
            ? `Your ${request.request_type} request #${request["Request No."]} was approved.`
            : kind === "declined"
              ? `Your ${request.request_type} request #${request["Request No."]} was declined.`
              : `Your ${request.request_type} request #${request["Request No."]} is pending management approval.`,
        created: serverTimestamp(),
        read: false,
      })
    } catch (e) {
      console.error("Notification save failed:", e)
    }
  }

  // Handlers
  const handleViewDetails = (requestId: string) => {
    router.push(`/finance/requests/details/${requestId}`)
  }

  const handleUpdateStatus = async (requestId: string, requestedStatus: string) => {
    const req = requests.find((r: any) => r.id === requestId) as any
    const type = (req?.request_type || "").toLowerCase()

    // Map "Accept" to "Approved" for reimbursement
    let finalStatus = requestedStatus
    if (type === "reimbursement") {
      if (requestedStatus === "Accept") finalStatus = "Approved"
      if (requestedStatus === "Decline") finalStatus = "Decline"
    }

    setUpdatingStatusId(requestId)
    try {
      const updates: any = { Actions: finalStatus }

      // For replenish, also reflect in "Management Approval"
      if (type === "replenish" && (finalStatus === "Approved" || finalStatus === "Pending")) {
        updates["Management Approval"] = finalStatus
      }

      await updateDoc(doc(db, "request", requestId), updates)

      // Notifications per spec
      if (type === "replenish") {
        if (finalStatus === "Approved") await notifyRequestor(req, "approved")
        else if (finalStatus === "Pending") await notifyRequestor(req, "pending")
      } else if (type === "reimbursement" || type === "requisition") {
        if (finalStatus === "Approved") {
          await notifyRequestor(req, "approved")
        } else if (finalStatus.toLowerCase() === "decline") {
          await notifyRequestor(req, "declined")
        }
      }

      toast({
        title: "Success",
        description: `Request status updated to ${finalStatus}.`,
      })
    } catch (error) {
      console.error("Error updating request status:", error)
      toast({
        title: "Error",
        description: "Failed to update request status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    setDeletingId(requestId)
    try {
      await updateDoc(doc(db, "request", requestId), { deleted: true })
      toast({ title: "Success", description: "Request moved to trash successfully." })
    } catch (error) {
      console.error("Error deleting request:", error)
      toast({
        title: "Error",
        description: "Failed to delete request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Replenish Report: Print (fresh PDF)
  const handlePrintReplenishReport = async (request: any) => {
    try {
      const base64 = await generateReplenishRequestPDF(request, { returnBase64: true })
      if (!base64 || typeof base64 !== "string") throw new Error("Failed to generate PDF")
      const blob = base64ToBlob(base64)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      console.error(e)
      toast({ title: "Unable to print", description: "Failed to generate report.", variant: "destructive" })
    }
  }

  // Replenish Report: Send dialog open
  const openSendDialog = (request: FinanceRequest) => {
    setSendFor(request)
    const reqNo = String((request as any)["Request No."] ?? request.id)
    setSendSubject(`Replenishment Request Report - #${reqNo}`)
    setSendMessage(
      `Hello,\n\nPlease find attached the replenishment request report for Request #${reqNo}.\n\nThank you.`,
    )
    setSendTo("")
    setSendCc("")
    setSendOpen(true)
  }

  // Replenish Report: Send submit
  const handleSendSubmit = async () => {
    if (!sendFor) return
    const recipients = sendTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (recipients.length === 0) {
      toast({
        title: "Recipient required",
        description: "Please add at least one email in the To field.",
        variant: "destructive",
      })
      return
    }
    try {
      setSending(true)
      const base64 = await generateReplenishRequestPDF(sendFor as any, { returnBase64: true })
      if (!base64 || typeof base64 !== "string") throw new Error("Failed to generate PDF")
      const blob = base64ToBlob(base64)
      const fileName = `replenish-request-${String((sendFor as any)["Request No."] ?? (sendFor as any).id)}.pdf`

      const form = new FormData()
      form.append("to", JSON.stringify(recipients))
      const ccList = sendCc
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      if (ccList.length) form.append("cc", JSON.stringify(ccList))
      form.append("subject", sendSubject)
      form.append("body", sendMessage)
      form.append("attachment_0", new File([blob], fileName, { type: "application/pdf" }))

      const res = await fetch("/api/send-email", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as any)?.error || "Failed to send email")

      toast({ title: "Report sent", description: "The PDF report was emailed successfully." })
      setSendOpen(false)
    } catch (e: any) {
      console.error(e)
      toast({ title: "Failed to send", description: e?.message || "An error occurred.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const clearSearch = () => setSearchQuery("")

  // Table renderer to keep UI consistent across tabs
  const TableView = ({
    title,
    data,
    addHref,
    addLabel,
  }: {
    title: string
    data: any[]
    addHref: string
    addLabel: string
  }) => (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>
            {title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({data.length} of {activeTab === "all" ? counts.all : counts[activeTab]} shown)
            </span>
          </CardTitle>
          <CardDescription>View and manage your finance requests</CardDescription>
        </div>
        <Link href={addHref}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="sticky top-0 bg-background z-10">
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("requestNo")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Request No."}
                    <SortIcon col="requestNo" />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("type")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Type"}
                    <SortIcon col="type" />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("requestor")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Requestor"}
                    <SortIcon col="requestor" />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("item")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Item"}
                    <SortIcon col="item" />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("amount")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Amount"}
                    <SortIcon col="amount" />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Status"}
                    <SortIcon col="status" />
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("date")}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    {"Date"}
                    <SortIcon col="date" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.map((request: any) => {
                const reqNo = request["Request No."]
                const created = request.created?.toDate?.() as Date | undefined
                const dateStr = created ? format(created, "MMM dd, yyyy") : "—"
                const isReplenish = request.request_type === "replenish"

                return (
                  <TableRow key={request.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium tabular-nums">#{reqNo}</TableCell>

                    <TableCell>
                      <Badge variant={getRequestTypeBadgeVariant(request.request_type)}>{request.request_type}</Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {request.Requestor}
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[280px] truncate">
                      {isReplenish ? request.Particulars || request["Requested Item"] : request["Requested Item"]}
                    </TableCell>

                    <TableCell className="font-medium tabular-nums">
                      {formatAmount(
                        isReplenish ? (request["Total Amount"] ?? request.Amount) : request.Amount,
                        request.Currency || "PHP",
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.Actions)}>{request.Actions}</Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {dateStr}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={updatingStatusId === request.id || deletingId === request.id}
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>

                          <DropdownMenuItem onClick={() => handleViewDetails(request.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => router.push(`/finance/requests/edit/${request.id}`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Request
                          </DropdownMenuItem>

                          {/* Replenish-specific quick actions: fresh PDF (no attachments) */}
                          {isReplenish && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Replenish</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openSendDialog(request)}>
                                <Send className="mr-2 h-4 w-4" />
                                Send Report
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintReplenishReport(request)}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print Report
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                          {getTypeStatusValues(request.request_type).map((val) => {
                            const opt = getStatusOptionByValue(val)
                            if (!opt) return null
                            const Icon = opt.icon
                            const isCurrent = request.Actions === opt.value
                            return (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() => handleUpdateStatus(request.id, opt.value)}
                                disabled={isCurrent || updatingStatusId === request.id}
                                className={isCurrent ? "bg-muted" : ""}
                              >
                                <Icon className={`mr-2 h-4 w-4 ${opt.color}`} />
                                {opt.label}
                                {isCurrent && <span className="ml-auto text-xs text-muted-foreground">Current</span>}
                              </DropdownMenuItem>
                            )
                          })}

                          <DropdownMenuSeparator />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Request
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Request</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this request? This will move the request to trash and
                                  it can be recovered later if needed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRequest(request.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}

              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No requests found in this tab. Adjust your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile hint */}
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: On mobile, scroll the table horizontally to see all columns.
        </p>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 bg-muted rounded w-48 animate-pulse" />
            <div className="h-4 bg-muted rounded w-64 mt-2 animate-pulse" />
          </div>
          <div className="h-10 bg-muted rounded w-32 animate-pulse" />
        </div>
        <div className="h-10 bg-muted rounded w-full animate-pulse" />
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded w-40 animate-pulse" />
            <div className="h-4 bg-muted rounded w-64 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Requests</h1>
          <p className="text-muted-foreground">Manage your reimbursement, requisition, and replenish requests</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search requests by number, type, requestor, item, amount, status, or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
          aria-label="Search requests"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex gap-2">
          <TabsTrigger value="all" className="px-4">
            {tabLabels.all} ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="reimbursement" className="px-4">
            {tabLabels.reimbursement} ({counts.reimbursement})
          </TabsTrigger>
          <TabsTrigger value="requisition" className="px-4">
            {tabLabels.requisition} ({counts.requisition})
          </TabsTrigger>
          <TabsTrigger value="replenish" className="px-4">
            {tabLabels.replenish} ({counts.replenish})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <TableView title="All Requests" data={sorted} addHref="/finance/requests/create" addLabel="Create Request" />
        </TabsContent>

        <TabsContent value="reimbursement" className="mt-4">
          <TableView
            title="Reimbursement Requests"
            data={sorted.filter((r: any) => r.request_type === "reimbursement")}
            addHref="/finance/requests/create?type=reimbursement"
            addLabel="Add Reimbursement"
          />
        </TabsContent>

        <TabsContent value="requisition" className="mt-4">
          <TableView
            title="Requisition Requests"
            data={sorted.filter((r: any) => r.request_type === "requisition")}
            addHref="/finance/requests/create?type=requisition"
            addLabel="Add Requisition"
          />
        </TabsContent>

        <TabsContent value="replenish" className="mt-4">
          <TableView
            title="Replenish Requests"
            data={sorted.filter((r: any) => r.request_type === "replenish")}
            addHref="/finance/requests/create?type=replenish"
            addLabel="Add Replenish"
          />
        </TabsContent>
      </Tabs>

      {/* Send Report Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Replenishment Report</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label htmlFor="to" className="text-sm text-muted-foreground">
                To (comma separated)
              </label>
              <Input
                id="to"
                placeholder="name@example.com, other@example.com"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="cc" className="text-sm text-muted-foreground">
                CC (optional, comma separated)
              </label>
              <Input id="cc" placeholder="cc1@example.com" value={sendCc} onChange={(e) => setSendCc(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="subject" className="text-sm text-muted-foreground">
                Subject
              </label>
              <Input id="subject" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="message" className="text-sm text-muted-foreground">
                Message
              </label>
              <Textarea id="message" rows={5} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendSubmit} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
