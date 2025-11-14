import { db } from "./firebase"
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  limit,
  startAfter,
  type DocumentSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import type { ProjectCompliance } from "@/lib/types/quotation" // Import ProjectCompliance

export interface Booking {
  id: string
  cancel_reason?: string
  category_id?: string
  client: {
    company_id: string
    id: string
    name: string
    company_name: string
  }
  company_id: string // This seems redundant with client.company_id, but keeping for now as per screenshot
  contract?: string
  cost: number
  costDetails: {
    basePrice: number
    days: number
    discount: number
    months: number
    otherFees: number
    pricePerMonth: number
    total: number
    vatAmount: number
    vatRate: number
  }
  created: any // Firestore timestamp
  end_date: Timestamp | null
  media_order?: string[]
  payment_method: string
  product_id: string
  product_name?: string
  product_owner: string
  project_name?: string // Added project_name field
  promos?: {
    quotation_id: string
    rated: boolean
  }
  projectCompliance?: ProjectCompliance // Added projectCompliance field
  requirements?: {
    description: string
    fileName: string
    fileUrl: string
    required: boolean
    title: string
    type: string
    uploadStatus: string
  }[]
  reservation_id: string // Generated reservation ID with format "RV-" + currentmillis
  seller_id: string
  spot_numbers?: number[] // Added spot_numbers field for digital/dynamic bookings
  start_date: Timestamp | null
  status: string
  total_cost: number
  type: string
  updated: any // Firestore timestamp
  user_id: string
  quotation_id: string // Added based on context
  quotation_number?: string // Added quotation number from original quotation
  isCollectibles?: boolean // Indicates if collectibles have been created for this booking
  items?: any // Added items field to store quotation items
  url?: string // Media URL for booking content
  for_screening?: number // Status for screening (0 = pending, 1 = accepted)
  airing_code?: string // Airing code generated when booking is accepted
}

export interface SalesRecord {
  id: string
  month: string
  date: string
  serviceInvoice: string
  bsNumber: string
  clients: string
  tin: string
  description: string
  netSales: number
  outputVat: number
  total: number
  discount: number
  creditableTax: number
  amountCollected: number
  orNo: string
  paidDate: string
  // Additional fields from booking
  bookingId: string
  productOwner: string
  paymentMethod: string
  // quantity: number, // Removed as it's not in the new Booking interface
  productType: string
  status: string
}

export interface PaginationOptions {
  page: number
  pageSize: number
  lastDoc?: DocumentSnapshot
}

export interface FilterOptions {
  type?: string
  status?: string
  product_id?: string
}

export interface PaginatedResult<T> {
  data: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  currentPage: number
  totalPages: number
  lastDoc?: DocumentSnapshot
}

export class BookingService {
  private static instance: BookingService

  static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService()
    }
    return BookingService.instance
  }


  async getCompletedBookingsCount(companyId: string, filters?: FilterOptions): Promise<number> {
    try {
      const bookingsRef = collection(db, "booking")
      let q = query(bookingsRef, where("company_id", "==", companyId))

      // Apply filters
      if (filters?.status) {
        q = query(q, where("status", "==", filters.status))
      }
      if (filters?.type) {
        q = query(q, where("type", "==", filters.type))
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.size
    } catch (error) {
      console.error("Error fetching completed bookings count:", error)
      throw error
    }
  }

  private convertToTimestamp(dateValue: any): Timestamp {
    if (!dateValue) return Timestamp.now()

    // If it's already a Firestore Timestamp, return it as-is
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue
    }

    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue)
      if (!isNaN(parsedDate.getTime())) {
        return Timestamp.fromDate(parsedDate)
      }
    }

    // If it's a Date object, convert it
    if (dateValue instanceof Date) {
      return Timestamp.fromDate(dateValue)
    }

    // Fallback to current timestamp
    return Timestamp.now()
  }

  async createBooking(quotation: any, userId: string, companyId: string, projectName?: string): Promise<string> {
    console.log("[DEBUG] createBooking called with:", { quotation, userId, companyId, projectName })
    try {
      const bookingData: any = {
        cancel_reason: "",
        category_id: quotation.category_id || "",
        client: {
          company_id: quotation.client_company_id || "",
          id: quotation.client_id || "",
          name: quotation.client_name || "",
          company_name: quotation.client_company_name || "",
        },
        company_id: companyId,
        contract: quotation.contract || "",
        cost: quotation.items?.price || quotation.total_cost || 0,
        costDetails: {
          basePrice: quotation.items?.price || 0,
          days: quotation.items?.duration_days || 0,
          discount: quotation.discount || 0,
          months: quotation.months || 0,
          otherFees: quotation.other_fees || 0,
          pricePerMonth: quotation.items?.price || 0,
          total: quotation.items?.item_total_amount || quotation.total_cost || 0,
          vatAmount: quotation.vat_amount || 0,
          vatRate: quotation.vat_rate || 0,
        },
        created: serverTimestamp(),
        end_date: quotation.end_date ? this.convertToTimestamp(quotation.end_date) : null,
        media_order: quotation.media_order || [],
        payment_method: quotation.payment_method || "Manual Payment",
        product_id: quotation.items?.product_id || "",
        product_owner: quotation.product_owner || "",
        project_name: projectName || "",
        promos: quotation.promos || {},
        projectCompliance: quotation.projectCompliance || undefined, // Copy projectCompliance from quotation
        requirements: quotation.requirements || [],
        reservation_id: `RV-${Date.now()}`, // Generate reservation ID with format "RV-" + currentmillis
        seller_id: quotation.seller_id || "",
        start_date: quotation.start_date ? this.convertToTimestamp(quotation.start_date) : null,
        status: "RESERVED", // Initial status for a new booking
        total_cost: quotation.items?.item_total_amount || 0,
        type: quotation.type || "RENTAL",
        updated: serverTimestamp(),
        user_id: userId,
        quotation_id: quotation.id,
        quotation_number: quotation.quotation_number,
        items: quotation.items,
        for_censorship: 1, // Set to approved for censorship
        for_screening: 0, // Set to pending screening
      }

      // Only add product_name if it exists
      if (quotation.items?.name) {
        bookingData.product_name = quotation.items.name
      }
      // Conditionally add CMS and spot number fields for digital/dynamic types
      const productType = (quotation.items?.type || "").toLowerCase()
      if (productType === "digital" || productType === "dynamic") {
        // Add CMS if it exists
        if (quotation.items?.cms) {
          bookingData.cms = quotation.items.cms
        }

        // Add spot numbers if they exist (can be single number or array)
        if (quotation.items?.spot_number) {
          const spotNumber = quotation.items.spot_number
          bookingData.spot_numbers = Array.isArray(spotNumber) ? spotNumber : [parseInt(String(spotNumber))]
        } else if (quotation.spot_numbers && quotation.spot_numbers.length > 0) {
          bookingData.spot_numbers = quotation.spot_numbers
        }
      }
      console.log("[DEBUG] Booking data to be created:", bookingData)

      const docRef = await addDoc(collection(db, "booking"), bookingData)
      console.log("[DEBUG] Booking document created with ID:", docRef.id)
      return docRef.id
    } catch (error) {
      console.error("[DEBUG] Error creating booking:", error)
      throw error
    }
  }

  async updateBookingProjectCompliance(quotationId: string, projectCompliance: ProjectCompliance): Promise<void> {
    try {
      const bookingsRef = collection(db, "booking")
      const q = query(bookingsRef, where("quotation_id", "==", quotationId))
      const querySnapshot = await getDocs(q)

      const updates = querySnapshot.docs.map((document) =>
        updateDoc(doc(db, "booking", document.id), {
          projectCompliance,
          updated: serverTimestamp(),
        })
      )

      await Promise.all(updates)
      console.log(`Updated projectCompliance for ${updates.length} booking(s) with quotation_id: ${quotationId}`)
    } catch (error) {
      console.error("Error updating booking projectCompliance:", error)
      throw error
    }
  }

  async getCompletedBookings(
    companyId: string,
    options?: PaginationOptions,
    filters?: FilterOptions,
  ): Promise<Booking[]> {
    try {
      const bookingsRef = collection(db, "booking")
      let q = query(bookingsRef, where("company_id", "==", companyId), orderBy("created", "desc"))

      // Apply filters
      if (filters?.status) {
        q = query(q, where("status", "==", filters.status))
      } else {
        // Default to completed if no status filter
        q = query(q, where("status", "==", "COMPLETED"))
      }

      if (filters?.type) {
        q = query(q, where("type", "==", filters.type))
      }

      if (options) {
        if (options.lastDoc) {
          q = query(q, startAfter(options.lastDoc))
        }
        q = query(q, limit(options.pageSize))
      }

      const querySnapshot = await getDocs(q)
      const bookings: Booking[] = []

      querySnapshot.forEach((doc) => {
        bookings.push({
          id: doc.id,
          ...doc.data(),
        } as Booking)
      })

      return bookings
    } catch (error) {
      console.error("Error fetching completed bookings:", error)
      throw error
    }
  }

  convertBookingToSalesRecord(booking: Booking): SalesRecord {
    const createdDate = booking.created?.toDate ? booking.created.toDate() : new Date(booking.created)
    const month = createdDate.toLocaleDateString("en-US", { month: "short" })
    const date = createdDate.getDate().toString()
    const paidDate = createdDate.toISOString().split("T")

    // Calculate financial values
    const netSales = booking.total_cost || booking.cost || 0
    const outputVat = netSales * 0.12
    const total = netSales + outputVat
    const creditableTax = netSales * 0.02
    const amountCollected = total - creditableTax

    return {
      id: booking.id,
      bookingId: booking.id,
      month,
      date,
      serviceInvoice: `SI-${booking.id.slice(-6)}`,
      bsNumber: `BS-${booking.id.slice(-4)}`,
      clients: booking.client?.name || booking.client?.id || "Unknown Client", // Using client name if available, fallback to ID
      tin: "", // Not available in booking data
      description: `${booking.type} - ${booking.product_owner}`,
      netSales,
      outputVat,
      total,
      discount: 0,
      creditableTax,
      amountCollected,
      orNo: `OR-${booking.id.slice(-4)}`,
      paidDate,
      productOwner: booking.product_owner,
      paymentMethod: booking.payment_method,
      // quantity: booking.quantity, // Removed as it's not in the new Booking interface
      productType: booking.type,
      status: booking.status, // Added status field
    }
  }

  async getSalesRecords(
    companyId: string,
    options?: PaginationOptions,
    filters?: FilterOptions,
  ): Promise<SalesRecord[]> {
    try {
      const bookings = await this.getCompletedBookings(companyId, options, filters)
      return bookings.map((booking) => this.convertBookingToSalesRecord(booking))
    } catch (error) {
      console.error("Error getting sales records:", error)
      throw error
    }
  }

  async getPaginatedSalesRecords(
    companyId: string,
    options: PaginationOptions,
    filters?: FilterOptions,
  ): Promise<PaginatedResult<SalesRecord>> {
    try {
      const [totalCount, bookings] = await Promise.all([
        this.getCompletedBookingsCount(companyId, filters),
        this.getCompletedBookings(companyId, options, filters),
      ])

      const salesRecords = bookings.map((booking) => this.convertBookingToSalesRecord(booking))
      const totalPages = Math.ceil(totalCount / options.pageSize)

      // Get the last document for cursor-based pagination
      const bookingsRef = collection(db, "booking")
      let lastQuery = query(
        bookingsRef,
        where("company_id", "==", companyId),
        orderBy("created", "desc"),
        limit(options.pageSize * options.page),
      )

      // Apply same filters to last query
      if (filters?.status) {
        lastQuery = query(lastQuery, where("status", "==", filters.status))
      } else {
        lastQuery = query(lastQuery, where("status", "==", "COMPLETED"))
      }

      if (filters?.type) {
        lastQuery = query(lastQuery, where("type", "==", filters.type))
      }

      const lastSnapshot = await getDocs(lastQuery)
      const lastDoc = lastSnapshot.docs[lastSnapshot.docs.length - 1]

      return {
        data: salesRecords,
        totalCount,
        hasNextPage: options.page < totalPages,
        hasPreviousPage: options.page > 1,
        currentPage: options.page,
        totalPages,
        lastDoc,
      }
    } catch (error) {
      console.error("Error getting paginated sales records:", error)
      throw error
    }
  }

  async getCollectiblesBookings(
    companyId: string,
    options?: PaginationOptions,
    filters?: FilterOptions,
  ): Promise<{ bookings: Booking[], lastDoc: DocumentSnapshot | null }> {
    try {
      const bookingsRef = collection(db, "booking")
      let q = query(bookingsRef, where("company_id", "==", companyId), orderBy("created", "desc"))

      // Apply filters
      if (filters?.status) {
        q = query(q, where("status", "==", filters.status))
      }

      if (filters?.type) {
        q = query(q, where("type", "==", filters.type))
      }

      if (filters?.product_id) {
        q = query(q, where("product_id", "==", filters.product_id))
      }

      if (options) {
        if (options.lastDoc) {
          q = query(q, startAfter(options.lastDoc))
        }
        q = query(q, limit(options.pageSize))
      }

      const querySnapshot = await getDocs(q)
      const bookings: Booking[] = []

      querySnapshot.forEach((doc) => {
        bookings.push({
          id: doc.id,
          ...doc.data(),
        } as Booking)
      })

      const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

      return { bookings, lastDoc }
    } catch (error) {
      console.error("Error fetching collectibles bookings:", error)
      throw error
    }
  }

  async getCollectiblesCount(companyId: string, filters?: FilterOptions): Promise<number> {
    try {
      const bookingsRef = collection(db, "booking")
      let q = query(bookingsRef, where("company_id", "==", companyId))

      // Apply filters
      if (filters?.status) {
        q = query(q, where("status", "==", filters.status))
      }

      if (filters?.type) {
        q = query(q, where("type", "==", filters.type))
      }

      const querySnapshot = await getDocs(q)
      return querySnapshot.size
    } catch (error) {
      console.error("Error fetching collectibles count:", error)
      throw error
    }
  }
  async getTotalBookingsCount(companyId: string): Promise<number> {
    try {
      const bookingsRef = collection(db, "booking")
      const q = query(bookingsRef, where("company_id", "==", companyId))
      const querySnapshot = await getDocs(q)
      return querySnapshot.size
    } catch (error) {
      console.error("Error fetching total bookings count:", error)
      throw error
    }
  }


  async getPaginatedCollectibles(
    companyId: string,
    options: PaginationOptions,
    filters?: FilterOptions,
  ): Promise<PaginatedResult<Booking>> {
    try {
      const [totalCount, { bookings }] = await Promise.all([
        this.getCollectiblesCount(companyId, filters),
        this.getCollectiblesBookings(companyId, options, filters),
      ])

      const totalPages = Math.ceil(totalCount / options.pageSize)

      // Get the last document for cursor-based pagination
      const bookingsRef = collection(db, "booking")
      let lastQuery = query(
        bookingsRef,
        where("company_id", "==", companyId),
        orderBy("created", "desc"),
        limit(options.pageSize * options.page),
      )

      // Apply same filters to last query
      if (filters?.status) {
        lastQuery = query(lastQuery, where("status", "==", filters.status))
      }

      if (filters?.type) {
        lastQuery = query(lastQuery, where("type", "==", filters.type))
      }

      const lastSnapshot = await getDocs(lastQuery)
      const lastDoc = lastSnapshot.docs[lastSnapshot.docs.length - 1]

      return {
        data: bookings,
        totalCount,
        hasNextPage: options.page < totalPages,
        hasPreviousPage: options.page > 1,
        currentPage: options.page,
        totalPages,
        lastDoc,
      }
    } catch (error) {
      console.error("Error getting paginated collectibles:", error)
      throw error
    }
  }

  async getBookingById(bookingId: string): Promise<Booking | null> {
    try {
      const bookingDoc = await getDoc(doc(db, "booking", bookingId))
      if (bookingDoc.exists()) {
        return {
          id: bookingDoc.id,
          ...bookingDoc.data(),
        } as Booking
      }
      return null
    } catch (error) {
      console.error("Error fetching booking by ID:", error)
      throw error
    }
  }
}

export const bookingService = BookingService.getInstance()

// Export getAllBookings as a standalone function for indexing
  export async function getAllBookings(): Promise<Booking[]> {
    try {
      console.log("Fetching all bookings from Firestore...")
      const bookingsRef = collection(db, "booking")
      const q = query(bookingsRef, orderBy("created", "desc"))
      console.log("Executing query for all bookings...")
      const querySnapshot = await getDocs(q)
      console.log(`Query executed, found ${querySnapshot.size} documents`)
      const bookings: Booking[] = []

      querySnapshot.forEach((doc) => {
        bookings.push({
          id: doc.id,
          ...doc.data(),
        } as Booking)
      })

      console.log(`Processed ${bookings.length} bookings`)
      return bookings
    } catch (error) {
      console.error("Error fetching all bookings:", error)
      throw error
    }
  }

// Utility function to format booking dates
export const formatBookingDates = (startDate: any, endDate: any): string => {
  if (!startDate || !endDate) return "N/A"
  try {
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return `${startStr} · ${days} Day${days !== 1 ? 's' : ''}`
  } catch (error) {
    console.error("Error formatting booking dates:", error)
    return "Invalid Dates"
  }
}
