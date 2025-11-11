import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from "firebase/firestore"
import { db } from "./firebase"

export interface ReportData {
  id?: string
  report_id?: string
  siteId: string
  siteName: string
  siteCode?: string
  companyId: string
  sellerId: string
  client: string
  clientId: string
  client_email?: string
  joNumber?: string
  joType?: string
  booking_id?: string
  bookingDates: {
    start: Timestamp
    end: Timestamp
  }
  breakdate: Timestamp
  sales: string
  reportType: string
  date: string
  attachments: Array<{
    note: string
    fileName: string
    fileType: string
    fileUrl: string
    label?: string
  }>
  status: string
  createdBy: string
  createdByName: string
  requestedBy?: {
    name: string
    department?: string
  }
  campaignName?: string
  created?: Timestamp
  updated?: Timestamp
  location?: string
  category: string
  subcategory: string
  priority: string
  completionPercentage: number
  tags: string[]
  assignedTo?: string
  // Product information
  pdf?: string
  product?: {
    id: string
    name: string
    content_type?: string
    specs_rental?: any
    light?: any
  }
  // Completion report specific field
  descriptionOfWork?: string
  // Installation report specific fields (optional)
  installationStatus?: string
  installationTimeline?: string
  delayReason?: string
  delayDays?: string
  // Site image URL
  siteImageUrl?: string
  logistics_report?: string
  reservation_number?: string
}

// Helper function to clean data by removing undefined values recursively
function cleanReportData(data: any): any {
  if (data === null || data === undefined) {
    return null
  }

  if (Array.isArray(data)) {
    return data.map(cleanReportData).filter((item) => item !== null && item !== undefined)
  }

  if (typeof data === "object" && !(data instanceof File) && !(data instanceof Timestamp)) {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const cleanedValue = cleanReportData(value)
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue
        }
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null
  }

  return data
}

export async function createReport(reportData: ReportData): Promise<string> {
  try {
    console.log("Creating report with data:", reportData)
    console.log("Report attachments before processing:", reportData.attachments)

    // Process attachments - ensure they have all required fields
    const processedAttachments = (reportData.attachments || [])
      .filter((attachment: any) => {
        // Only include attachments that have a fileUrl (successfully uploaded)
        return attachment && attachment.fileUrl && attachment.fileName
      })
      .map((attachment: any) => {
        const processedAttachment = {
          note: attachment.note || "",
          fileName: attachment.fileName || "Unknown file",
          fileType: attachment.fileType || "unknown",
          fileUrl: attachment.fileUrl,
          label: attachment.label,
        }

        console.log("Processed attachment:", processedAttachment)
        return processedAttachment
      })

    console.log("Processed attachments:", processedAttachments)

    // Generate report_id in format "RP-[currentmillis]"
    const reportId = `RP-${Date.now()}`

    // Create the final report data with proper structure
    const finalReportData: any = {
      report_id: reportId,
      siteId: reportData.siteId,
      siteName: reportData.siteName,
      companyId: reportData.companyId,
      sellerId: reportData.sellerId,
      client: reportData.client,
      clientId: reportData.clientId,
      client_email: reportData.client_email,
      joNumber: reportData.joNumber,
      joType: reportData.joType,
      bookingDates: {
        start: reportData.bookingDates.start,
        end: reportData.bookingDates.end,
      },
      breakdate: reportData.breakdate,
      sales: reportData.sales,
      reportType: reportData.reportType,
      date: reportData.date,
      attachments: processedAttachments,
      status: reportData.status || "draft",
      createdBy: reportData.createdBy,
      createdByName: reportData.createdByName,
      category: reportData.category,
      subcategory: reportData.subcategory,
      priority: reportData.priority,
      completionPercentage: reportData.completionPercentage,
      tags: reportData.tags || [],
      created: Timestamp.now(),
      updated: Timestamp.now(),
    }

    // Add requestedBy if provided
    if (reportData.requestedBy) {
      finalReportData.requestedBy = reportData.requestedBy
    }

    // Add product information if provided
    if (reportData.product) {
      finalReportData.product = reportData.product
    }

    // Add optional fields only if they have values
    if (reportData.siteCode) {
      finalReportData.siteCode = reportData.siteCode
    }

    if (reportData.location) {
      finalReportData.location = reportData.location
    }

    if (reportData.assignedTo) {
      finalReportData.assignedTo = reportData.assignedTo
    }

    // Add installation-specific fields only if they have values
    if (reportData.installationStatus && reportData.installationStatus.trim() !== "") {
      finalReportData.installationStatus = reportData.installationStatus
    }

    if (reportData.installationTimeline && reportData.installationTimeline.trim() !== "") {
      finalReportData.installationTimeline = reportData.installationTimeline
    }

    if (reportData.delayReason && reportData.delayReason.trim() !== "") {
      finalReportData.delayReason = reportData.delayReason
    }

    if (reportData.delayDays && reportData.delayDays.trim() !== "") {
      finalReportData.delayDays = reportData.delayDays
    }

    // Add description of work for completion reports
    if (reportData.descriptionOfWork && reportData.descriptionOfWork.trim() !== "") {
      finalReportData.descriptionOfWork = reportData.descriptionOfWork.trim()
    }
    // Add service assignment specific fields
    if (reportData.reservation_number && reportData.reservation_number.trim() !== "") {
      finalReportData.reservation_number = reportData.reservation_number.trim()
    }

    if (reportData.booking_id && reportData.booking_id.trim() !== "") {
      finalReportData.booking_id = reportData.booking_id.trim()
    }

    console.log("Final report data to be saved:", finalReportData)

    console.log("Final report data to be saved:", finalReportData)

    // Clean the data to remove undefined values before saving
    const cleanedReportData = cleanReportData(finalReportData)
    console.log("Cleaned report data:", cleanedReportData)
    console.log("Final attachments to be saved:", cleanedReportData.attachments)

    const docRef = await addDoc(collection(db, "reports"), cleanedReportData)
    console.log("Report created with ID:", docRef.id)

    return docRef.id
  } catch (error) {
    console.error("Error creating report:", error)
    throw error
  }
}

export async function getReports(options: {
  page?: number
  limit?: number
  companyId?: string
  status?: string
  reportType?: string
  searchQuery?: string
  lastDoc?: any
}): Promise<{ reports: ReportData[], hasNextPage: boolean, lastDoc: any, total?: number }> {
  try {
    console.log("getReports called with options:", options)
    const { page = 1, limit: pageLimit = 10, companyId, status, reportType, searchQuery, lastDoc } = options

    // For search queries, we need to fetch all and filter client-side
    if (searchQuery && searchQuery.trim()) {
      console.log(`Fetching all reports for search: "${searchQuery}"`)
      let q = query(collection(db, "reports"), orderBy("created", "desc"))

      if (companyId) {
        q = query(q, where("companyId", "==", companyId))
      }

      const querySnapshot = await getDocs(q)
      let allReports = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
        }
      }) as ReportData[]

      // Apply search filtering
      const searchTerm = searchQuery.trim().toLowerCase()
      allReports = allReports.filter(report =>
        report.siteName?.toLowerCase().includes(searchTerm) ||
        report.reportType?.toLowerCase().includes(searchTerm) ||
        report.createdByName?.toLowerCase().includes(searchTerm) ||
        report.id?.toLowerCase().includes(searchTerm) ||
        report.report_id?.toLowerCase().includes(searchTerm) ||
        report.client?.toLowerCase().includes(searchTerm)
      )

      // Apply status filtering
      if (status && status !== "all") {
        if (status === "published") {
          allReports = allReports.filter(report => report.status !== "draft")
        } else {
          allReports = allReports.filter(report => report.status === status)
        }
      }

      // Apply report type filtering
      if (reportType && reportType !== "All") {
        allReports = allReports.filter(report => report.reportType === reportType)
      }

      // Apply pagination
      const offset = (page - 1) * pageLimit
      const reports = allReports.slice(offset, offset + pageLimit)
      const hasNextPage = allReports.length > offset + pageLimit

      console.log(`Search results: ${allReports.length} total, ${reports.length} on page ${page}`)
      return { reports, hasNextPage, lastDoc: null, total: allReports.length }
    }

    // For non-search: use server-side pagination
    let q = query(collection(db, "reports"), orderBy("created", "desc"), limit(pageLimit + 1))

    if (companyId) {
      q = query(q, where("companyId", "==", companyId))
    }

    // Apply status filtering server-side
    if (status && status !== "all") {
      if (status === "published") {
        q = query(q, where("status", "!=", "draft"))
      } else {
        q = query(q, where("status", "==", status))
      }
    }

    // Apply report type filtering server-side
    if (reportType && reportType !== "All") {
      q = query(q, where("reportType", "==", reportType))
    }

    // Handle pagination cursor
    if (page > 1 && lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    const querySnapshot = await getDocs(q)
    const docs = querySnapshot.docs

    const hasNextPage = docs.length > pageLimit
    const pageDocs = hasNextPage ? docs.slice(0, pageLimit) : docs
    const newLastDoc = hasNextPage ? docs[pageLimit - 1] : docs[docs.length - 1]

    const reports = pageDocs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
      }
    }) as ReportData[]

    console.log(`Fetched ${reports.length} reports for page ${page}, hasNextPage: ${hasNextPage}`)
    // For non-search, we don't have the total count here, so we'll let the caller get it separately
    return { reports, hasNextPage, lastDoc: newLastDoc }
  } catch (error) {
    console.error("Error fetching reports:", error)
    throw error
  }
}

// Keep the old function for backward compatibility
export async function getReportsLegacy(): Promise<ReportData[]> {
  try {
    const q = query(collection(db, "reports"), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const reports = querySnapshot.docs.map((doc) => {
      const data = doc.data()
      console.log("Retrieved report data:", data)
      console.log("Report attachments:", data.attachments)

      return {
        id: doc.id,
        ...data,
        // Ensure attachments is always an array
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
      }
    }) as ReportData[]

    console.log("Total reports retrieved:", reports.length)
    return reports
  } catch (error) {
    console.error("Error fetching reports:", error)
    throw error
  }
}

export async function getReportsByCompany(companyId: string): Promise<ReportData[]> {
  try {
    const q = query(collection(db, "reports"), where("companyId", "==", companyId), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
    })) as ReportData[]
  } catch (error) {
    console.error("Error fetching reports by company:", error)
    throw error
  }
}

export async function getReportsBySeller(sellerId: string): Promise<ReportData[]> {
  try {
    const q = query(collection(db, "reports"), where("sellerId", "==", sellerId), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
    })) as ReportData[]
  } catch (error) {
    console.error("Error fetching reports by seller:", error)
    throw error
  }
}

export async function getReportById(reportId: string): Promise<ReportData | null> {
  try {
    const docRef = doc(db, "reports", reportId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      console.log("Retrieved single report data:", data)
      console.log("Single report attachments:", data.attachments)

      return {
        id: docSnap.id,
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
      } as ReportData
    } else {
      console.log("No report found with ID:", reportId)
      return null
    }
  } catch (error) {
    console.error("Error fetching report by ID:", error)
    throw error
  }
}

export async function updateReport(reportId: string, updateData: Partial<ReportData>): Promise<void> {
  try {
    // Create a clean update object with only defined values
    const cleanUpdateData: any = {}

    // Copy only defined values, excluding undefined and null
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        cleanUpdateData[key] = value
      }
    })

    // Handle attachments specifically
    if (updateData.attachments) {
      cleanUpdateData.attachments = updateData.attachments
        .filter((attachment: any) => attachment && attachment.fileUrl && attachment.fileName)
        .map((attachment: any) => ({
          note: attachment.note || "",
          fileName: attachment.fileName || "Unknown file",
          fileType: attachment.fileType || "unknown",
          fileUrl: attachment.fileUrl,
          label: attachment.label,
        }))
    }

    // Add description of work for completion reports
    if (updateData.descriptionOfWork && updateData.descriptionOfWork.trim() !== "") {
      cleanUpdateData.descriptionOfWork = updateData.descriptionOfWork.trim()
    }

    // Handle product information
    if (updateData.product !== undefined) {
      cleanUpdateData.product = updateData.product
    }

    // Always update the timestamp
    cleanUpdateData.updated = Timestamp.now()

    console.log("Updating report with data:", cleanUpdateData)

    const docRef = doc(db, "reports", reportId)
    await updateDoc(docRef, cleanUpdateData)

    console.log("Report updated successfully")
  } catch (error) {
    console.error("Error updating report:", error)
    throw error
  }
}

export async function deleteReport(reportId: string): Promise<void> {
  try {
    const docRef = doc(db, "reports", reportId)
    await deleteDoc(docRef)
    console.log("Report deleted successfully")
  } catch (error) {
    console.error("Error deleting report:", error)
    throw error
  }
}

export async function getRecentReports(limitCount = 10): Promise<ReportData[]> {
  try {
    const q = query(collection(db, "reports"), orderBy("created", "desc"), limit(limitCount))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
    })) as ReportData[]
  } catch (error) {
    console.error("Error fetching recent reports:", error)
    throw error
  }
}

export async function getReportsByStatus(status: string): Promise<ReportData[]> {
  try {
    const q = query(collection(db, "reports"), where("status", "==", status), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
    })) as ReportData[]
  } catch (error) {
    console.error("Error fetching reports by status:", error)
    throw error
  }
}

export async function getReportsByType(reportType: string): Promise<ReportData[]> {
  try {
    const q = query(collection(db, "reports"), where("reportType", "==", reportType), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
    })) as ReportData[]
  } catch (error) {
    console.error("Error fetching reports by type:", error)
    throw error
  }
}

export async function getReportsByProductId(productId: string, page: number = 1, limit: number = 10): Promise<{ reports: ReportData[], total: number }> {
  try {
    // Get all reports for this product (since Firestore doesn't support offset with where clauses)
    const q = query(collection(db, "reports"), where("product.id", "==", productId), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const allReports = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      attachments: Array.isArray(doc.data().attachments) ? doc.data().attachments : [],
    })) as ReportData[]

    const total = allReports.length
    const offset = (page - 1) * limit
    const reports = allReports.slice(offset, offset + limit)

    return { reports, total }
  } catch (error) {
    console.error("Error fetching reports by product:", error)
    throw error
  }
}

export async function postReport(reportData: ReportData): Promise<string> {
  try {
    console.log("Posting report with attachments:", reportData.attachments)

    // Set status to "posted" when posting the report
    const postData = {
      ...reportData,
      status: "posted",
      updated: Timestamp.now(),
    }

    const reportId = await createReport(postData)
    console.log("Report posted successfully with ID:", reportId)

    return reportId
  } catch (error) {
    console.error("Error posting report:", error)
    throw error
  }
}
export async function getLatestReportsByBookingIds(bookingIds: string[]): Promise<{ [bookingId: string]: ReportData | null }> {
  try {
    const reportsMap: { [bookingId: string]: ReportData | null } = {}

    // Fetch reports for each booking ID
    const promises = bookingIds.map(async (bookingId) => {
      const q = query(
        collection(db, "reports"),
        where("booking_id", "==", bookingId),
        orderBy("created", "desc"),
        limit(1)
      )
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        const data = doc.data()
        return {
          bookingId,
          report: {
            id: doc.id,
            ...data,
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
          } as ReportData
        }
      }
      return { bookingId, report: null }
    })

    const results = await Promise.all(promises)

    // Build the reports map from results
    results.forEach(({ bookingId, report }) => {
      reportsMap[bookingId] = report
    })
    return reportsMap
  } catch (error) {
    console.error("Error fetching latest reports by booking IDs:", error)
    throw error
  }
}

export async function getReportsPerBooking(companyId: string): Promise<{ [bookingId: string]: ReportData[] }> {
  try {
    const q = query(collection(db, "reports"), where("companyId", "==", companyId), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const reportsMap: { [bookingId: string]: ReportData[] } = {}

    querySnapshot.docs.forEach((doc) => {
      const data = doc.data()
      const report: ReportData = {
        id: doc.id,
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
      } as ReportData

      // Group reports by booking_id
      if (report.booking_id) {
        if (!reportsMap[report.booking_id]) {
          reportsMap[report.booking_id] = []
        }
        reportsMap[report.booking_id].push(report)
      }
    })

    return reportsMap
  } catch (error) {
    console.error("Error fetching reports per booking:", error)
    throw error
  }
}


// Get sent emails for a report
export async function getSentEmailsForReport(reportId: string): Promise<any[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const emailsRef = collection(db, "emails")
    const q = query(
      emailsRef,
      where("reportId", "==", reportId),
      where("email_type", "==", "report"),
      where("status", "==", "sent"),
      orderBy("sentAt", "desc")
    )

    const querySnapshot = await getDocs(q)
    const emails: any[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      emails.push({
        id: doc.id,
        ...data,
        sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toDate() : new Date(data.sentAt),
        created: data.created instanceof Timestamp ? data.created.toDate() : new Date(data.created),
        updated: data.updated instanceof Timestamp ? data.updated.toDate() : new Date(data.updated),
      })
    })

    return emails
  } catch (error) {
    console.error("Error fetching sent emails for report:", error)
    return []
  }
}

// Get all sent emails for a company
export async function getSentEmailsForCompany(companyId: string): Promise<any[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const emailsRef = collection(db, "emails")
    const q = query(
      emailsRef,
      where("company_id", "==", companyId),
      where("email_type", "==", "report"),
      where("status", "==", "sent"),
      orderBy("sentAt", "desc")
    )

    const querySnapshot = await getDocs(q)
    const emails: any[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      emails.push({
        id: doc.id,
        ...data,
        sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toDate() : new Date(data.sentAt),
        created: data.created instanceof Timestamp ? data.created.toDate() : new Date(data.created),
        updated: data.updated instanceof Timestamp ? data.updated.toDate() : new Date(data.updated),
      })
    })

    return emails
  } catch (error) {
    console.error("Error fetching sent emails for company:", error)
    return []
  }
}
