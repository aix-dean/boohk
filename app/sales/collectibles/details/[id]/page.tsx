"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Eye } from "lucide-react"
import Link from "next/link"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useParams, useRouter } from "next/navigation"

interface Collectible {
  id: string
  created: any
  company_id: string
  type: "sites" | "supplies"
  updated: any
  deleted: boolean
  client_name: string
  net_amount: number
  total_amount: number
  mode_of_payment: string
  bank_name: string
  bi_no: string
  or_no: string
  invoice_no: string
  next_collection_date: any
  status: "pending" | "collected" | "overdue"
  // Sites specific fields
  booking_no?: string
  site?: string
  covered_period?: string
  bir_2307?: string
  collection_date?: any
  // Supplies specific fields
  date?: any
  product?: string
  transfer_date?: any
  bs_no?: string
  due_for_collection?: string
  date_paid?: any
  net_amount_collection?: number
  // Next collection fields
  next_collection_status?: string
  next_collection_bir_2307?: string
}

export default function CollectibleDetailsPage() {
  const [collectible, setCollectible] = useState<Collectible | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const fetchCollectible = async () => {
      if (!params.id) return

      try {
        setLoading(true)
        const collectibleRef = doc(db, "collectibles", params.id as string)
        const docSnapshot = await getDoc(collectibleRef)

        if (docSnapshot.exists()) {
          const data = docSnapshot.data()
          setCollectible({ id: docSnapshot.id, ...data } as Collectible)
        } else {
          setError("Collectible not found")
        }
      } catch (error) {
        console.error("Error fetching collectible:", error)
        setError("Error loading collectible details")
      } finally {
        setLoading(false)
      }
    }

    fetchCollectible()
  }, [params.id])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const displayValue = (value: string | number | undefined | null): string => {
    if (value === null || value === undefined || value === "" || (typeof value === "string" && value.trim() === "")) {
      return "-"
    }
    return String(value)
  }

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "-"

    try {
      let date: Date

      // Handle Firebase Timestamp object
      if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000)
      }
      // Handle string timestamps
      else if (typeof timestamp === "string") {
        date = new Date(timestamp)
      }
      // Handle Date objects
      else if (timestamp instanceof Date) {
        date = timestamp
      }
      // Handle numeric timestamps
      else if (typeof timestamp === "number") {
        date = new Date(timestamp)
      } else {
        return displayValue(timestamp)
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return displayValue(timestamp)
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      console.error("Error formatting date:", error)
      return displayValue(timestamp)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      collected: "default",
      overdue: "destructive",
    } as const

    return <Badge variant={variants[status as keyof typeof variants] || "secondary"}>{status}</Badge>
  }

  const handleFileView = (fileUrl: string) => {
    if (fileUrl && fileUrl !== "-") {
      window.open(fileUrl, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {/* Updated back link to point to sales collectibles */}
          <Link href="/sales/collectibles">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Collectible Details</h1>
            <p className="text-muted-foreground">Loading collectible information...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !collectible) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {/* Updated back link to point to sales collectibles */}
          <Link href="/sales/collectibles">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Collectible Details</h1>
            <p className="text-muted-foreground text-red-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {/* Updated back link to point to sales collectibles */}
          <Link href="/sales/collectibles">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Collectible Details</h1>
            <p className="text-muted-foreground">View collectible information</p>
          </div>
        </div>
        {/* Updated edit link to point to sales collectibles */}
        <Link href={`/sales/collectibles/edit/${collectible.id}`}>
          <Button>Edit Collectible</Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Client Name</label>
              <p className="text-sm font-medium">{displayValue(collectible.client_name)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <div className="mt-1">
                <Badge variant="outline">{collectible.type}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">{getStatusBadge(collectible.status)}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{formatDate(collectible.created)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Net Amount</label>
              <p className="text-sm font-medium">
                {collectible.net_amount ? formatCurrency(collectible.net_amount) : "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
              <p className="text-sm font-medium">
                {collectible.total_amount ? formatCurrency(collectible.total_amount) : "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Mode of Payment</label>
              <p className="text-sm">{displayValue(collectible.mode_of_payment)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
              <p className="text-sm">{displayValue(collectible.bank_name)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Document Information */}
        <Card>
          <CardHeader>
            <CardTitle>Document Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Invoice No</label>
              <p className="text-sm">{displayValue(collectible.invoice_no)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">OR No</label>
              <p className="text-sm">{displayValue(collectible.or_no)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">BI No</label>
              <p className="text-sm">{displayValue(collectible.bi_no)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Type-specific Information */}
        {collectible.type === "sites" && (
          <Card>
            <CardHeader>
              <CardTitle>Sites Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Booking No</label>
                <p className="text-sm">{displayValue(collectible.booking_no)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Site</label>
                <p className="text-sm">{displayValue(collectible.site)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Covered Period</label>
                <p className="text-sm">{displayValue(collectible.covered_period)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Collection Date</label>
                <p className="text-sm">{formatDate(collectible.collection_date)}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">BIR 2307</label>
                {collectible.bir_2307 && collectible.bir_2307 !== "-" ? (
                  <div className="mt-1">
                    <Button variant="outline" size="sm" onClick={() => handleFileView(collectible.bir_2307!)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">-</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {collectible.type === "supplies" && (
          <Card>
            <CardHeader>
              <CardTitle>Supplies Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date</label>
                <p className="text-sm">{formatDate(collectible.date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Product</label>
                <p className="text-sm">{displayValue(collectible.product)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Transfer Date</label>
                <p className="text-sm">{formatDate(collectible.transfer_date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">BS No</label>
                <p className="text-sm">{displayValue(collectible.bs_no)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Due for Collection</label>
                <p className="text-sm">{displayValue(collectible.due_for_collection)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date Paid</label>
                <p className="text-sm">{formatDate(collectible.date_paid)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Net Amount Collection</label>
                <p className="text-sm">
                  {collectible.net_amount_collection ? formatCurrency(collectible.net_amount_collection) : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Collection Information */}
        {collectible.next_collection_date && collectible.next_collection_date !== "-" && (
          <Card>
            <CardHeader>
              <CardTitle>Next Collection Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Next Collection Date</label>
                <p className="text-sm">{formatDate(collectible.next_collection_date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Next Collection Status</label>
                <p className="text-sm">{displayValue(collectible.next_collection_status)}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Next Collection BIR 2307</label>
                {collectible.next_collection_bir_2307 && collectible.next_collection_bir_2307 !== "-" ? (
                  <div className="mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFileView(collectible.next_collection_bir_2307!)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm">-</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
