"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { ArrowLeft, Calendar, User, MapPin, DollarSign, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

interface Booking {
  id: string
  reservation_id?: string
  product_name?: string
  product_id?: string
  product_owner?: string
  client_name?: string
  client_company_name?: string
  client?: {
    name?: string
    company_name?: string
  }
  start_date?: any
  end_date?: any
  status?: string
  created?: any
  quotation_id?: string
  cost?: number
  total_cost?: number
  costDetails?: {
    total?: number
  }
  payment_method?: string
  projectCompliance?: {
    signedContract?: { status: string; fileUrl?: string; fileName?: string };
    irrevocablePo?: { status: string; fileUrl?: string; fileName?: string };
    paymentAsDeposit?: { status: string; note?: string; fileUrl?: string; fileName?: string };
    finalArtwork?: { status: string; fileUrl?: string; fileName?: string };
    signedQuotation?: { status: string; fileUrl?: string; fileName?: string };
  };
}

interface ComplianceItem {
  key: string
  name: string
  status: string
  fileUrl?: string
  fileName?: string
  note?: string
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBooking = async () => {
      if (!id || !user?.uid) return

      try {
        setLoading(true)
        const bookingRef = doc(db, "booking", id as string)
        const bookingDoc = await getDoc(bookingRef)

        if (bookingDoc.exists()) {
          setBooking({ id: bookingDoc.id, ...bookingDoc.data() } as Booking)
        }
      } catch (error) {
        console.error("Error fetching booking:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [id, user?.uid])

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "PPP")
      }
      if (typeof date === "string") {
        return format(new Date(date), "PPP")
      }
      return "N/A"
    } catch (error) {
      return "N/A"
    }
  }

  const calculateDuration = (startDate: any, endDate: any) => {
    if (!startDate || !endDate) return "N/A"

    try {
      const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate)

      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      return `${months} ${months === 1 ? "month" : "months"}`
    } catch (error) {
      return "N/A"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "reserved":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getComplianceStatus = (item: any) => {
    if (item.fileUrl) {
      return { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-50" }
    } else if (item.status === "confirmation") {
      return { icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-50" }
    } else {
      return { icon: AlertCircle, color: "text-gray-400", bgColor: "bg-gray-50" }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">The booking you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => router.push("/sales/reservation")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reservations
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const compliance = booking.projectCompliance || {}
  const complianceItems: ComplianceItem[] = [
    {
      key: "signedContract",
      name: "Signed Contract",
      status: compliance.signedContract?.status || "upload",
      fileUrl: compliance.signedContract?.fileUrl,
      fileName: compliance.signedContract?.fileName,
    },
    {
      key: "irrevocablePo",
      name: "Irrevocable PO",
      status: compliance.irrevocablePo?.status || "upload",
      fileUrl: compliance.irrevocablePo?.fileUrl,
      fileName: compliance.irrevocablePo?.fileName,
    },
    {
      key: "paymentAsDeposit",
      name: "Payment as Deposit",
      status: compliance.paymentAsDeposit?.status || "confirmation",
      fileUrl: compliance.paymentAsDeposit?.fileUrl,
      fileName: compliance.paymentAsDeposit?.fileName,
      note: "For Treasury's confirmation",
    },
    {
      key: "finalArtwork",
      name: "Final Artwork",
      status: compliance.finalArtwork?.status || "upload",
      fileUrl: compliance.finalArtwork?.fileUrl,
      fileName: compliance.finalArtwork?.fileName,
    },
    {
      key: "signedQuotation",
      name: "Signed Quotation",
      status: compliance.signedQuotation?.status || "upload",
      fileUrl: compliance.signedQuotation?.fileUrl,
      fileName: compliance.signedQuotation?.fileName,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sales/reservation")}
          className="text-black hover:bg-gray-100 p-1 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-black font-medium">Reservation Details</span>
        <span className="text-black italic ml-2">{booking.reservation_id || "N/A"}</span>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className={getStatusColor(booking.status || "")}
          >
            {booking.status?.toUpperCase() || "PENDING"}
          </Badge>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div className="w-full max-w-4xl">
            {/* Document Container */}
            <div className="bg-white shadow-lg print:shadow-none print:mx-0 print:my-0 relative overflow-hidden">
              {/* Document Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">Reservation Details</h1>
                    <p className="text-blue-100 mt-1">Reservation ID: {booking.reservation_id || "N/A"}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-3 py-1 ${
                      booking.status?.toLowerCase() === "confirmed"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : booking.status?.toLowerCase() === "reserved"
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-gray-100 text-gray-800 border-gray-300"
                    }`}
                  >
                    {booking.status?.toUpperCase() || "PENDING"}
                  </Badge>
                </div>
              </div>

              {/* Document Content */}
              <div className="p-6 space-y-8">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Basic Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Product/Service</label>
                      <p className="text-base text-gray-900">{booking.product_name || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Client</label>
                      <p className="text-base text-gray-900">
                        {(() => {
                          const companyName = booking.client_company_name || booking.client?.company_name || "";
                          const clientName = booking.client_name || booking.client?.name || "";
                          if (companyName && clientName) {
                            return `${companyName} - ${clientName}`;
                          } else if (companyName) {
                            return companyName;
                          } else if (clientName) {
                            return clientName;
                          } else {
                            return "N/A";
                          }
                        })()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Start Date</label>
                      <p className="text-base text-gray-900">{formatDate(booking.start_date)}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">End Date</label>
                      <p className="text-base text-gray-900">{formatDate(booking.end_date)}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Duration</label>
                      <p className="text-base text-gray-900">{calculateDuration(booking.start_date, booking.end_date)}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-600 uppercase tracking-wide">Payment Method</label>
                      <p className="text-base text-gray-900">{booking.payment_method || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Project Compliance Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Project Compliance
                  </h2>
                  <div className="space-y-4">
                    {complianceItems.map((item, index) => {
                      const { icon: StatusIcon, color, bgColor } = getComplianceStatus(item)
                      return (
                        <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                          <div className={`p-3 rounded-full ${bgColor} flex-shrink-0`}>
                            <StatusIcon className={`w-5 h-5 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-base font-semibold text-gray-900">{item.name}</h4>
                              <Badge
                                variant="outline"
                                className={`text-sm px-3 py-1 ${
                                  item.fileUrl
                                    ? "bg-green-100 text-green-800 border-green-300"
                                    : item.status === "confirmation"
                                    ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                    : "bg-gray-100 text-gray-800 border-gray-300"
                                }`}
                              >
                                {item.fileUrl
                                  ? "Completed"
                                  : item.status === "confirmation"
                                  ? "Pending Confirmation"
                                  : "Upload Required"}
                              </Badge>
                            </div>
                            {item.note && (
                              <p className="text-sm text-gray-700 mb-2 italic">{item.note}</p>
                            )}
                            {item.fileName && item.fileUrl && (
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                {item.fileName}
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Financial Summary Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Financial Summary
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-700">Subtotal</span>
                      <span className="text-xl text-gray-900">
                        ₱{(() => {
                          const value = booking.costDetails?.total || booking.total_cost || booking.cost || 0;
                          return Number(value).toFixed(2);
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-700">12% Vat</span>
                      <span className="text-xl text-gray-900">
                        ₱{(() => {
                          const subtotal = booking.costDetails?.total || booking.total_cost || booking.cost || 0;
                          return (subtotal * 0.12).toFixed(2);
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-gray-700">Total Cost</span>
                      <span className="text-xl font-bold text-gray-900">
                        ₱{(() => {
                          const subtotal = booking.costDetails?.total || booking.total_cost || booking.cost || 0;
                          return (subtotal + (subtotal * 0.12)).toFixed(2);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline Section */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Timeline
                  </h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-base font-semibold text-gray-900">Reservation Created</p>
                        <p className="text-sm text-gray-600">{formatDate(booking.created)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                        booking.status?.toLowerCase() === "confirmed" ? "bg-green-500" : "bg-gray-400"
                      }`}></div>
                      <div>
                        <p className="text-base font-semibold text-gray-900">Current Status</p>
                        <p className="text-sm text-gray-600">{booking.status || "Pending"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-gray-200 p-6 overflow-y-auto bg-gray-50">
          {/* Document Sidebar */}
          <div className="space-y-6">
            {/* Document Info */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Document Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">Booking Reservation</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-mono text-xs">{booking.reservation_id || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">{formatDate(booking.created)}</span>
                </div>
              </div>
            </div>

            {/* Status Overview */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Status Overview</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    booking.status?.toLowerCase() === "confirmed" ? "bg-green-500" :
                    booking.status?.toLowerCase() === "reserved" ? "bg-blue-500" : "bg-gray-400"
                  }`}></div>
                  <span className="text-sm font-medium">{booking.status || "Pending"}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Last updated: {formatDate(booking.created)}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push(`/sales/quotations/${booking.quotation_id}`)}
                  disabled={!booking.quotation_id}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Quotation
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/sales/reservation")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to List
                </Button>
              </div>
            </div>

            {/* Compliance Summary */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Compliance Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-medium text-green-600">
                    {complianceItems.filter(item => item.fileUrl).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pending:</span>
                  <span className="font-medium text-yellow-600">
                    {complianceItems.filter(item => item.status === "confirmation" || item.status === "upload").length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-medium">{complianceItems.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
