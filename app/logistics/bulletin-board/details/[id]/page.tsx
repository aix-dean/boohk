"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore"

interface Booking {
  id: string
  start_date: any
  end_date: any
  product_id: string
  status: string
  cost: number
  total_cost: number
  type: string
  project_name?: string
  reservation_id?: string
  client_name?: string
}

interface Report {
  id: string
  reservation_id: string
  date: string
  created: any
  updated: any
  category: string
  subcategory: string
  status: string
  reportType: string
  attachments?: Array<{
    fileName: string
    fileType: string
    fileUrl: string
  }>
}

export default function BookingDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { userData } = useAuth()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)
  const [lastVisibleDocs, setLastVisibleDocs] = useState<QueryDocumentSnapshot<DocumentData>[]>([null as any])
  const [hasMore, setHasMore] = useState(true)

  const fetchReports = async (reservationId: string, page: number = 1) => {
    if (!userData?.company_id) return

    try {
      const companyId = userData.company_id
      console.log('Fetching reports for reservationId:', reservationId, 'companyId:', companyId)
      const reportsRef = collection(db, "reports")
      let reportsQuery = query(
        reportsRef,
        where("reservation_id", "==", reservationId),
        where("companyId", "==", companyId),
        orderBy("updated", "desc"),
        limit(itemsPerPage + 1)
      )

      const lastDoc = lastVisibleDocs[page - 1]
      if (lastDoc && page > 1) {
        reportsQuery = query(
          reportsRef,
          where("reservation_id", "==", reservationId),
          where("companyId", "==", companyId),
          orderBy("updated", "desc"),
          startAfter(lastDoc),
          limit(itemsPerPage + 1)
        )
      }

      const reportsSnapshot = await getDocs(reportsQuery)
      const reportsData = reportsSnapshot.docs.slice(0, itemsPerPage).map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[]

      console.log('Found reports:', reportsData.length, 'for reservationId:', reservationId)
      if (reportsData.length > 0) {
        console.log('Sample report:', reportsData[0])
      }

      const newLastVisible = reportsSnapshot.docs[reportsSnapshot.docs.length - 1]
      setHasMore(reportsSnapshot.docs.length > itemsPerPage)

      if (newLastVisible && page === lastVisibleDocs.length) {
        setLastVisibleDocs((prev) => [...prev, newLastVisible])
      }

      setReports(reportsData)
    } catch (error) {
      console.error("Error fetching reports:", error)
      setReports([])
    }
  }

  useEffect(() => {
    const fetchBooking = async () => {
      if (!params.id) return

      try {
        const bookingRef = doc(db, "booking", params.id as string)
        const bookingSnap = await getDoc(bookingRef)

        if (bookingSnap.exists()) {
          const bookingData = {
            id: bookingSnap.id,
            ...bookingSnap.data(),
          } as Booking

          setBooking(bookingData)

          if (bookingData.reservation_id) {
            await fetchReports(bookingData.reservation_id, 1)
          }
        }
      } catch (error) {
        console.error("Error fetching booking:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [params.id])

  useEffect(() => {
    if (booking?.reservation_id && currentPage > 1) {
      fetchReports(booking.reservation_id, currentPage)
    }
  }, [currentPage, booking?.reservation_id])

  const formatDate = (dateField: any) => {
    if (!dateField) return "Not specified"

    try {
      if (dateField?.toDate) {
        return dateField.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      } else if (dateField) {
        const date = new Date(dateField)
        return isNaN(date.getTime()) ? "Invalid Date" : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
      return "Not specified"
    } catch (error) {
      return "Invalid Date"
    }
  }

  const formatTime = (dateField: any) => {
    if (!dateField) return "N/A"

    try {
      if (dateField?.toDate) {
        return dateField.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } else if (dateField) {
        const date = new Date(dateField)
        return isNaN(date.getTime()) ? "N/A" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
      return "N/A"
    } catch (error) {
      return "N/A"
    }
  }

  const getTeamBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case "sales":
        return "Sales"
      case "logistics":
        return "Logistics"
      case "installer":
      case "installation":
        return "Installer"
      case "delivery":
        return "Delivery"
      default:
        return category
    }
  }

  const getUpdateText = (report: Report) => {
    if (report.reportType === "completion-report") {
      return `Completion report submitted - ${report.subcategory || "general"}`
    }
    return report.subcategory || report.reportType || "Report submitted"
  }

  const getSiteData = () => {
    return {
      site: booking?.project_name || "Not specified",
      client: booking?.client_name || "Not specified",
      bookingDates:
        booking?.start_date && booking?.end_date
          ? `${formatDate(booking.start_date)} to ${formatDate(booking.end_date)}`
          : "Not specified",
      seller: "Not specified",
    }
  }

  const siteData = getSiteData()

  return (
    <div className="w-[1280px] h-[720px] relative">
      <div onClick={() => router.back()} className="w-80 h-6 left-[30px] top-[30px] absolute justify-start text-gray-700 text-base font-bold font-['Inter'] leading-none cursor-pointer">← View Project Bulletin</div>
      <div className="w-[990px] h-20 left-[34px] top-[60px] absolute bg-white rounded-[5px] shadow-[-2px_4px_5px_0px_rgba(0,0,0,0.25)]" />
      <div className="w-24 h-3.5 left-[60.14px] top-[80.44px] absolute justify-start text-gray-700 text-xs font-semibold font-['Inter'] leading-3">Reservation ID</div>
      <div className="w-32 h-3.5 left-[60.14px] top-[96.95px] absolute justify-start text-gray-700 text-xs font-normal font-['Inter'] leading-3">{booking?.reservation_id || 'N/A'}</div>
      <div className="w-24 h-3.5 left-[250px] top-[80.44px] absolute justify-start text-gray-700 text-xs font-semibold font-['Inter'] leading-3">Site</div>
      <div className="w-40 h-6 left-[250px] top-[96.95px] absolute justify-start text-blue-600 text-xs font-bold font-['Inter'] leading-3 break-words">{siteData.site}</div>
      <div className="w-24 h-3.5 left-[453px] top-[84px] absolute justify-start text-gray-700 text-xs font-semibold font-['Inter'] leading-3">Client</div>
      <div className="w-24 h-3 left-[453px] top-[99.56px] absolute justify-start text-gray-700 text-xs font-normal font-['Inter'] leading-3">{siteData.client}</div>
      <div className="w-24 h-3.5 left-[647px] top-[80.44px] absolute justify-start text-gray-700 text-xs font-semibold font-['Inter'] leading-3">Booking Dates</div>
      <div className="w-36 h-3 left-[647px] top-[96px] absolute justify-start text-gray-700 text-xs font-normal font-['Inter'] leading-3">{siteData.bookingDates}</div>
      <div className="w-[990px] h-7 left-[34px] top-[162px] absolute" style={{ backgroundColor: 'var(--ADMIN-BLUE, #2A31B4)' }} />
      <div className="w-14 h-4 left-[60px] top-[170px] absolute justify-start text-white text-xs font-semibold font-['Inter'] leading-3">Date</div>
      <div className="w-14 h-4 left-[179px] top-[169px] absolute justify-start text-white text-xs font-semibold font-['Inter'] leading-3">By</div>
      <div className="w-20 h-4 left-[342px] top-[170px] absolute justify-start text-white text-xs font-semibold font-['Inter'] leading-3">Department</div>
      <div className="w-14 h-4 left-[674px] top-[170px] absolute justify-start text-white text-xs font-semibold font-['Inter'] leading-3">Item</div>
      <div className="w-24 h-4 left-[495px] top-[170px] absolute justify-start text-white text-xs font-semibold font-['Inter'] leading-3">Campaign Name</div>
      <div className="w-28 h-4 left-[873px] top-[170px] absolute justify-start text-white text-xs font-semibold font-['Inter'] leading-3">Attachment</div>
      <div className="w-[990px] h-[496px] left-[34px] top-[190px] absolute bg-white overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading project monitoring data...</div>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">No project monitoring data available for this booking.</div>
          </div>
        ) : (
          <table className="w-full min-w-full table-fixed">
            <tbody className="divide-y divide-gray-200">
              {reports.map((report, index) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 w-20">{formatDate(report.updated || report.created || report.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 w-16">{formatTime(report.updated || report.created)}</td>
                  <td className="px-4 py-3 w-24">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getTeamBadge(report.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 flex-1">
                    <button
                      className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      onClick={() => router.push(`/logistics/reports/${report.id}`)}
                    >
                      {getUpdateText(report)}
                    </button>
                  </td>
                  <td className="px-4 py-3 w-32">
                    {report.attachments && report.attachments.length > 0 ? (
                      <button
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        onClick={() => window.open(report.attachments![0].fileUrl, "_blank")}
                      >
                        See Attachment
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
