"use client"

import { useState, useEffect } from "react"
import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, User, Building, Loader2, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { getProductById, getLatestServiceAssignmentsPerBooking, type Product, type ServiceAssignment } from "@/lib/firebase-service"
import { bookingService, type Booking } from "@/lib/booking-service"
import { collection, query, where, orderBy, getDocs, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ReportData } from "@/lib/report-service"


export default function SiteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [reports, setReports] = useState<ReportData[]>([])
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([])
  const [campaignName, setCampaignName] = useState<string>("")

  const { user } = useAuth()

  useEffect(() => {
    const fetchBooking = async () => {
      if (!user?.uid || !id) return

      setLoading(true)
      try {
        const bookingData = await bookingService.getBookingById(id)
        if (bookingData) {
          setBooking(bookingData)
          // Also fetch the product if needed for display
          if (bookingData.product_id) {
            const productData = await getProductById(bookingData.product_id)
            setProduct(productData)
          }
        } else {
          setError("Booking not found")
        }
      } catch (error) {
        console.error("Error fetching booking:", error)
        setError("Failed to load booking details")
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [user?.uid, id])

  useEffect(() => {
    const fetchReports = async () => {
      if (!booking?.id) return

      try {
        const reportsQuery = query(
          collection(db, "reports"),
          where("booking_id", "==", booking.id),
          orderBy("created", "desc")
        )

        const querySnapshot = await getDocs(reportsQuery)
        const reportsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
        })) as ReportData[]

        setReports(reportsData)
      } catch (error) {
        console.error("Error fetching reports:", error)
      }
    }

    if (booking) {
      fetchReports()

      // Set up real-time listener for reports
      const reportsQuery = query(
        collection(db, "reports"),
        where("booking_id", "==", booking.id),
        orderBy("created", "desc")
      )

      const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
        const reportsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
        })) as ReportData[]

        setReports(reportsData)
      })

      return () => unsubscribe()
    }
  }, [booking])

  useEffect(() => {
    const fetchServiceAssignments = async () => {
      if (!booking?.id) return

      try {
        const assignmentsRef = collection(db, "service_assignments")
        const q = query(assignmentsRef, where("booking_id", "==", booking.id))
        const querySnapshot = await getDocs(q)

        const assignments: ServiceAssignment[] = []
        querySnapshot.forEach((doc) => {
          assignments.push({ id: doc.id, ...doc.data() } as ServiceAssignment)
        })

        setServiceAssignments(assignments)

        // Get campaign name from the first assignment (if any)
        if (assignments.length > 0) {
          setCampaignName(assignments[0].campaignName || "")
        } else {
          setCampaignName("")
        }
      } catch (error) {
        console.error("Error fetching service assignments:", error)
      }
    }

    fetchServiceAssignments()
  }, [booking])

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-gray-500">Loading site details...</p>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700">{error || "Booking not found"}</p>
          <Link href="/admin/project-bulletin">
            <Button variant="outline" className="mt-4 bg-transparent">
              Back to Project Bulletin
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link href="/admin/project-bulletin" className="text-lg font-semibold text-gray-700 hover:text-gray-900">
          ← View Project Bulletin
        </Link>
      </div>

      {/* Booking Details Card */}
      <Card className="mb-6 shadow-md">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-1">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Reservation ID</p>
              <p className="text-sm text-gray-900">{booking.reservation_id}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Site</p>
              <p className="text-sm text-blue-600 font-medium">{booking.product_name || product?.name || "Unknown Site"}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Client</p>
              <p className="text-sm text-gray-900">{booking.client?.name || "Unknown Client"}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Booking Dates</p>
                <p className="text-sm text-gray-900">
                  {booking.start_date ? (booking.start_date.toDate ? booking.start_date.toDate() : new Date(booking.start_date as any)).toLocaleDateString() : "N/A"} - {booking.end_date ? (booking.end_date.toDate ? booking.end_date.toDate() : new Date(booking.end_date as any)).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <Button variant="outline" className="border-gray-300">
                Actions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulletin Table */}
      <Card>
        <CardHeader className="bg-[#2A31B4] text-white">
          <div className="grid grid-cols-6 gap-3 text-sm font-semibold">
            <div>Date</div>
            <div>By</div>
            <div>Department</div>
            <div>Campaign Name</div>
            <div>Item</div>
            <div>Attachment</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {reports.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No reports found for this booking
              </div>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="p-4 grid grid-cols-6 gap-3 text-sm hover:bg-gray-50">
                  <div className="font-medium">
                    {report.created ? new Date(report.created.toDate ? report.created.toDate() : (report.created as any)).toLocaleDateString() : "N/A"}
                  </div>
                  <div>{report.createdByName || report.createdBy || "Unknown"}</div>
                  <div>{report.category || "N/A"}</div>
                  <div>{campaignName || "N/A"}</div>
                  <div>{report.reportType || "Report"} submitted</div>
                  <div>
                    {report.attachments && report.attachments.length > 0 ? (
                      <a
                        href={report.attachments[0].fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {report.report_id || `RPT#${report.id?.slice(-6)}`}.{report.attachments[0].fileType === 'pdf' ? 'pdf' : 'file'}
                      </a>
                    ) : (
                      "No attachment"
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}