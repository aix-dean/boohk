import { db } from "./firebase"
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, orderBy, limit, startAfter } from "firebase/firestore"
import type { Quotation, QuotationProduct } from "./types/quotation" // Import QuotationProduct
import type { JobOrder, JobOrderStatus } from "./types/job-order"
import type { Product } from "./firebase-service"
import type { Client, ClientCompany } from "./client-service" // Import ClientCompany
import type { Booking } from "./booking-service"
import { getAllBookings } from "./booking-service"
 
 const QUOTATIONS_COLLECTION = "quotations"
const JOB_ORDERS_COLLECTION = "job_orders"
const PRODUCTS_COLLECTION = "products"
const CLIENTS_COLLECTION = "client_db"
const CLIENT_COMPANIES_COLLECTION = "client_company"

// Removed local QuotationItem interface, will use QuotationProduct from types/quotation.ts

export async function getQuotationsForSelection(userId: string, companyId?: string, status?: string): Promise<Quotation[]> {
  try {
    let q = query(
      collection(db, QUOTATIONS_COLLECTION),
      orderBy("created", "desc"),
    )

    // If companyId is provided, add filter
    if (companyId) {
      q = query(q, where("company_id", "==", companyId))
    }
    // If status is provided, add filter
    if (status) {
      q = query(q, where("status", "==", status.toLowerCase()))
    }

    const querySnapshot = await getDocs(q)
    const quotations: Quotation[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Quotation[]
    return quotations
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching quotations for selection:", error)
    throw error
  }
}

export async function getBookingsForSelection(companyId?: string, status?: string): Promise<Booking[]> {
  try {
    const allBookings = await getAllBookings()

    let filteredBookings = allBookings

    // If companyId is provided, filter by company_id
    if (companyId) {
      filteredBookings = filteredBookings.filter(booking => booking.company_id === companyId)
    }

    // If status is provided, filter by status
    if (status) {
      filteredBookings = filteredBookings.filter(booking => booking.status.toLowerCase() === status.toLowerCase())
    }

    // Sort by created date descending (assuming created is a Firestore timestamp)
    filteredBookings.sort((a, b) => {
      const aTime = a.created?.toMillis ? a.created.toMillis() : new Date(a.created).getTime()
      const bTime = b.created?.toMillis ? b.created.toMillis() : new Date(b.created).getTime()
      return bTime - aTime
    })

    return filteredBookings
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching bookings for selection:", error)
    throw error
  }
}

export async function getQuotationById(quotationId: string): Promise<Quotation | null> {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, quotationId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Quotation
    } else {
      return null
    }
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching quotation by ID:", error)
    throw error
  }
}

export async function getQuotationDetailsForJobOrder(quotationId: string): Promise<{
  quotation: Quotation
  products: Product[]
  client: Client | null
  items?: QuotationProduct[] // Use QuotationProduct
} | null> {
  console.log(`[getQuotationDetailsForJobOrder] Attempting to fetch details for quotationId: ${quotationId}`)
  try {
    const quotationDocRef = doc(db, QUOTATIONS_COLLECTION, quotationId)
    const quotationDocSnap = await getDoc(quotationDocRef)

    if (!quotationDocSnap.exists()) {
      console.warn(`[getQuotationDetailsForJobOrder] Quotation with ID ${quotationId} not found.`)
      return null
    }
    const quotation = { id: quotationDocSnap.id, ...quotationDocSnap.data() } as Quotation
    console.log("[getQuotationDetailsForJobOrder] Fetched raw quotation:", quotation) // Log raw quotation
    console.log("[getQuotationDetailsForJobOrder] quotation.items:", quotation.items)
    console.log("[getQuotationDetailsForJobOrder] quotation.items type:", typeof quotation.items)
    console.log("[getQuotationDetailsForJobOrder] Array.isArray(quotation.items):", Array.isArray(quotation.items))
    if (quotation.items && !Array.isArray(quotation.items)) {
      console.log("[getQuotationDetailsForJobOrder] quotation.items.product_id:", quotation.items.product_id)
    }
 
     const products: Product[] = []
     let items: QuotationProduct[] = [] // Use QuotationProduct

     console.log("[DEBUG] Starting product fetching logic")
     console.log("[DEBUG] quotation.items exists:", !!quotation.items)
     console.log("[DEBUG] quotation.items is array:", Array.isArray(quotation.items))

     // Check if quotation has items (single product - new format)
    if (quotation.items && !Array.isArray(quotation.items) && quotation.items.product_id) {
      console.log(`[getQuotationDetailsForJobOrder] Found single item in quotation with product_id: ${quotation.items.product_id}`)
      items = [quotation.items] // Convert single item to array for consistency

      // Fetch the product
      const productDocRef = doc(db, PRODUCTS_COLLECTION, quotation.items.product_id)
      const productDocSnap = await getDoc(productDocRef)
      if (productDocSnap.exists()) {
        const product = { id: productDocSnap.id, ...productDocSnap.data() } as Product
        products.push(product)
        console.log("[getQuotationDetailsForJobOrder] Fetched product:", product)
      } else {
        console.warn(`[getQuotationDetailsForJobOrder] Product with ID ${quotation.items.product_id} not found.`)
      }
    } else if (quotation.items && Array.isArray(quotation.items)) {
      // Legacy: Check if quotation has items array (multiple products)
      console.log(`[getQuotationDetailsForJobOrder] Found ${quotation.items.length} items in quotation`)
      items = quotation.items

      // Fetch all products for the items
      for (const item of items) {
        if (item.product_id) {
          console.log(`[getQuotationDetailsForJobOrder] Fetching product with ID: ${item.product_id}`)
          const productDocRef = doc(db, PRODUCTS_COLLECTION, item.product_id)
          const productDocSnap = await getDoc(productDocRef)
          if (productDocSnap.exists()) {
            const product = { id: productDocSnap.id, ...productDocSnap.data() } as Product
            products.push(product)
            console.log("[getQuotationDetailsForJobOrder] Fetched product:", product)
          } else {
            console.warn(`[getQuotationDetailsForJobOrder] Product with ID ${item.product_id} not found.`)
          }
        }
      }
    } else if (quotation.product_id) {
      // Legacy: Single product (old format)
      console.log(`[getQuotationDetailsForJobOrder] Fetching single product with ID: ${quotation.product_id}`)
      const productDocRef = doc(db, PRODUCTS_COLLECTION, quotation.product_id)
      const productDocSnap = await getDoc(productDocRef)
      if (productDocSnap.exists()) {
        const product = { id: productDocSnap.id, ...productDocSnap.data() } as Product
        products.push(product)
        console.log("[getQuotationDetailsForJobOrder] Fetched single product:", product)
      } else {
        console.warn(`[getQuotationDetailsForJobOrder] Product with ID ${quotation.product_id} not found.`)
      }
    }

    let client: Client | null = null
    if (quotation.client_id) {
      console.log(`[getQuotationDetailsForJobOrder] Attempting to fetch client by ID: ${quotation.client_id}`)
      const clientDocRef = doc(db, CLIENTS_COLLECTION, quotation.client_id)
      const clientDocSnap = await getDoc(clientDocRef)
      if (clientDocSnap.exists()) {
        client = { id: clientDocSnap.id, ...clientDocSnap.data() } as Client
        console.log("[getQuotationDetailsForJobOrder] Fetched client by ID:", client)
      } else {
        console.warn(`[getQuotationDetailsForJobOrder] Client with ID ${quotation.client_id} not found.`)
      }
    }

    // Fetch client company details if client_company_id is available
    if (quotation.client_company_id) {
      console.log(`[getQuotationDetailsForJobOrder] Attempting to fetch client company by ID: ${quotation.client_company_id}`)
      const clientCompanyDocRef = doc(db, CLIENT_COMPANIES_COLLECTION, quotation.client_company_id)
      const clientCompanyDocSnap = await getDoc(clientCompanyDocRef)
      console.log("[getQuotationDetailsForJobOrder] clientCompanyDocSnap.exists():", clientCompanyDocSnap.exists());
      if (clientCompanyDocSnap.exists()) {
        const clientCompanyData = clientCompanyDocSnap.data() as ClientCompany // Cast to ClientCompany
        // Ensure client_company_id is explicitly set on the returned quotation object
        quotation.client_company_id = clientCompanyDocSnap.id; // Explicitly set client_company_id
        console.log("[getQuotationDetailsForJobOrder] Explicitly set quotation.client_company_id:", quotation.client_company_id);

        // Update client object with compliance URLs from client company
        if (client) {
          client.dti_bir_2303_url = clientCompanyData.compliance?.dti || null
          client.gis_url = clientCompanyData.compliance?.gis || null
          client.id_signature_url = clientCompanyData.compliance?.id || null
          console.log("[getQuotationDetailsForJobOrder] Updated client with compliance URLs from client company:", client)
        } else {
          // If client wasn't found by client_id, but client_company_id exists,
          // we can create a minimal client object with compliance info.
          // Note: This creates a 'Client' object, not a 'ClientCompany' object,
          // but populates it with compliance fields from the ClientCompany.
          client = {
            id: quotation.client_company_id,
            name: clientCompanyData.name || "N/A",
            email: "", // ClientCompany might not have email
            phone: "", // ClientCompany might not have phone
            company: clientCompanyData.name || "N/A", // Use company name for company field
            status: "active", // Default status
            dti_bir_2303_url: clientCompanyData.compliance?.dti || null,
            gis_url: clientCompanyData.compliance?.gis || null,
            id_signature_url: clientCompanyData.compliance?.id || null,
            created: clientCompanyData.created || serverTimestamp(),
            updated: clientCompanyData.updated || serverTimestamp(),
          }
          console.log("[getQuotationDetailsForJobOrder] Created client from client company with compliance URLs:", client)
        }
      } else {
        console.warn(`[getQuotationDetailsForJobOrder] Client company with ID ${quotation.client_company_id} not found.`)
      }
    }

    if (products.length === 0) {
      console.warn(`[getQuotationDetailsForJobOrder] No products found for quotation ${quotationId}.`)
      return null
    }

    console.log("[getQuotationDetailsForJobOrder] Successfully fetched all details.")
    return { quotation, products, client, items }
  } catch (error: any) { // Explicitly type error
    console.error("[getQuotationDetailsForJobOrder] Error fetching quotation details for job order:", error)
    throw new Error("Failed to fetch quotation details due to an unexpected error.")
  }
}

export async function getBookingDetailsForJobOrder(bookingId: string): Promise<{
  booking: Booking
  products: Product[]
  client: Client | null
} | null> {
  console.log(`[getBookingDetailsForJobOrder] Attempting to fetch details for bookingId: ${bookingId}`)
  try {
    // Fetch the booking
    const allBookings = await getAllBookings()
    const booking = allBookings.find(b => b.id === bookingId)

    if (!booking) {
      console.warn(`[getBookingDetailsForJobOrder] Booking with ID ${bookingId} not found.`)
      return null
    }

    console.log("[getBookingDetailsForJobOrder] Fetched booking:", booking)

    // Fetch the product
    const products: Product[] = []
    if (booking.product_id) {
      console.log(`[getBookingDetailsForJobOrder] Fetching product with ID: ${booking.product_id}`)
      const productDocRef = doc(db, PRODUCTS_COLLECTION, booking.product_id)
      const productDocSnap = await getDoc(productDocRef)
      if (productDocSnap.exists()) {
        const product = { id: productDocSnap.id, ...productDocSnap.data() } as Product
        products.push(product)
        console.log("[getBookingDetailsForJobOrder] Fetched product:", product)
      } else {
        console.warn(`[getBookingDetailsForJobOrder] Product with ID ${booking.product_id} not found.`)
      }
    }

    // Fetch client information
    let client: Client | null = null
    if (booking.client?.id) {
      console.log(`[getBookingDetailsForJobOrder] Attempting to fetch client by ID: ${booking.client.id}`)
      const clientDocRef = doc(db, CLIENTS_COLLECTION, booking.client.id)
      const clientDocSnap = await getDoc(clientDocRef)
      if (clientDocSnap.exists()) {
        client = { id: clientDocSnap.id, ...clientDocSnap.data() } as Client
        console.log("[getBookingDetailsForJobOrder] Fetched client by ID:", client)
      } else {
        console.warn(`[getBookingDetailsForJobOrder] Client with ID ${booking.client.id} not found.`)
      }
    }

    // Fetch client company details if available
    if (booking.client?.company_id) {
      console.log(`[getBookingDetailsForJobOrder] Attempting to fetch client company by ID: ${booking.client.company_id}`)
      const clientCompanyDocRef = doc(db, CLIENT_COMPANIES_COLLECTION, booking.client.company_id)
      const clientCompanyDocSnap = await getDoc(clientCompanyDocRef)
      if (clientCompanyDocSnap.exists()) {
        const clientCompanyData = clientCompanyDocSnap.data() as ClientCompany
        console.log("[getBookingDetailsForJobOrder] clientCompanyDocSnap.exists():", clientCompanyDocSnap.exists());

        // Update client object with compliance URLs from client company
        if (client) {
          // Note: Client type may not have these properties, but we're adding them for compatibility
          (client as any).dti_bir_2303_url = clientCompanyData.compliance?.dti || null;
          (client as any).gis_url = clientCompanyData.compliance?.gis || null;
          (client as any).id_signature_url = clientCompanyData.compliance?.id || null;
          console.log("[getBookingDetailsForJobOrder] Updated client with compliance URLs from client company:", client)
        } else {
          // If client wasn't found by client_id, but client_company_id exists,
          // we can create a minimal client object with compliance info.
          client = {
            id: booking.client.company_id,
            name: clientCompanyData.name || "N/A",
            email: "", // ClientCompany might not have email
            phone: "", // ClientCompany might not have phone
            company: clientCompanyData.name || "N/A", // Use company name for company field
            status: "active", // Default status
            dti_bir_2303_url: clientCompanyData.compliance?.dti || null,
            gis_url: clientCompanyData.compliance?.gis || null,
            id_signature_url: clientCompanyData.compliance?.id || null,
            created: clientCompanyData.created || serverTimestamp(),
            updated: clientCompanyData.updated || serverTimestamp(),
          } as Client
          console.log("[getBookingDetailsForJobOrder] Created client from client company with compliance URLs:", client)
        }
      } else {
        console.warn(`[getBookingDetailsForJobOrder] Client company with ID ${booking.client.company_id} not found.`)
      }
    }

    if (products.length === 0) {
      console.warn(`[getBookingDetailsForJobOrder] No products found for booking ${bookingId}.`)
      return null
    }

    console.log("[getBookingDetailsForJobOrder] Successfully fetched all details.")
    return { booking, products, client }
  } catch (error: any) { // Explicitly type error
    console.error("[getBookingDetailsForJobOrder] Error fetching booking details for job order:", error)
    throw new Error("Failed to fetch booking details due to an unexpected error.")
  }
}

export async function createJobOrder(
  jobOrderData: Omit<JobOrder, "id" | "createdAt" | "updatedAt" | "status" | "createdBy">,
  createdBy: string,
  status: JobOrderStatus,
): Promise<string> {
  console.log("Received job order data in createJobOrder (service):", jobOrderData)
  console.log("Created By (service):", createdBy)
  console.log("Status (service):", status)

  try {
    const docRef = await addDoc(collection(db, JOB_ORDERS_COLLECTION), {
      ...jobOrderData,
      createdBy: createdBy,
      status: status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log("Job Order successfully added with ID:", docRef.id)

    return docRef.id
  } catch (error: any) { // Explicitly type error
    console.error("Error adding job order to Firestore:", error)
    throw error
  }
}

export async function createMultipleJobOrders(
  jobOrdersData: Array<Omit<JobOrder, "id" | "createdAt" | "updatedAt" | "status" | "createdBy">>,
  createdBy: string,
  status: JobOrderStatus,
): Promise<string[]> {
  console.log("Creating multiple job orders:", jobOrdersData.length)

  // DEBUG: Log the received jobOrdersData
  console.log("[DEBUG] Received jobOrdersData in service:")
  jobOrdersData.forEach((jobOrder, index) => {
    console.log(`[DEBUG] Job Order ${index}:`)
    console.log(`- created:`, jobOrder.created, "Type:", typeof jobOrder.created)
    console.log(`- dateRequested:`, jobOrder.dateRequested, "Type:", typeof jobOrder.dateRequested)
    console.log(`- deadline:`, jobOrder.deadline, "Type:", typeof jobOrder.deadline)
    console.log(`- contractPeriodStart:`, jobOrder.contractPeriodStart, "Type:", typeof jobOrder.contractPeriodStart)
    console.log(`- contractPeriodEnd:`, jobOrder.contractPeriodEnd, "Type:", typeof jobOrder.contractPeriodEnd)

    // Check for invalid dates
    if (jobOrder.created && jobOrder.created instanceof Date) {
      console.log(`- created is valid Date:`, !isNaN(jobOrder.created.getTime()))
    }
    if (jobOrder.dateRequested && jobOrder.dateRequested instanceof Date) {
      console.log(`- dateRequested is valid Date:`, !isNaN(jobOrder.dateRequested.getTime()))
    }
    if (jobOrder.deadline && jobOrder.deadline instanceof Date) {
      console.log(`- deadline is valid Date:`, !isNaN(jobOrder.deadline.getTime()))
    }
    if (jobOrder.contractPeriodStart && jobOrder.contractPeriodStart instanceof Date) {
      console.log(`- contractPeriodStart is valid Date:`, !isNaN(jobOrder.contractPeriodStart.getTime()))
    }
    if (jobOrder.contractPeriodEnd && jobOrder.contractPeriodEnd instanceof Date) {
      console.log(`- contractPeriodEnd is valid Date:`, !isNaN(jobOrder.contractPeriodEnd.getTime()))
    }
  })

  try {
    const jobOrderIds: string[] = []

    for (const jobOrderData of jobOrdersData) {
      // DEBUG: Log what we're about to send to Firestore
      console.log("[DEBUG] Preparing to save job order to Firestore:")
      const firestoreData = {
        ...jobOrderData,
        createdBy: createdBy,
        status: status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      console.log("- Final data being saved:", firestoreData)

      const docRef = await addDoc(collection(db, JOB_ORDERS_COLLECTION), firestoreData)
      jobOrderIds.push(docRef.id)
      console.log("Job Order successfully added with ID:", docRef.id)

      try {
        // Get the current user's UID for comparison
        const currentUserUid = createdBy

        // Only create notification if assignTo is different from current user
        const shouldCreateNotification = jobOrderData.assignTo && jobOrderData.assignTo !== currentUserUid

        if (shouldCreateNotification) {
          const notificationTitle = `New Job Order Assigned: ${jobOrderData.joNumber}`
          const notificationDescription = `A new ${jobOrderData.joType} job order has been created`

          // Create single notification per job order
          await addDoc(collection(db, "notifications"), {
            type: "Job Order",
            title: notificationTitle,
            description: notificationDescription,
            department_to: "Logistics",
            uid_to: jobOrderData.assignTo,
            company_id: jobOrderData.company_id,
            department_from: "Sales",
            viewed: false,
            navigate_to: `${process.env.NEXT_PUBLIC_APP_URL || window?.location?.origin || ""}/logistics/job-orders/${docRef.id}`,
            created: serverTimestamp(),
          })
          console.log(`Single notification created for job order ${docRef.id}`)
        }
      } catch (notificationError: any) { // Explicitly type error
        console.error("Error creating notification for job order:", docRef.id, notificationError)
        // Don't throw here - we don't want notification failure to break job order creation
      }
    }

    return jobOrderIds
  } catch (error: any) { // Explicitly type error
    console.error("Error adding multiple job orders to Firestore:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    throw error
  }
}

export async function getJobOrderById(jobOrderId: string): Promise<JobOrder | null> {
  try {
    const docRef = doc(db, JOB_ORDERS_COLLECTION, jobOrderId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as JobOrder;
    } else {
      console.warn(`Job Order with ID ${jobOrderId} not found.`);
      return null;
    }
  } catch (error: any) { // Explicitly type error
    console.error(`Error fetching job order by ID ${jobOrderId}:`, error);
    throw error;
  }
}

export async function getJobOrders(
  companyId: string,
  options: {
    page?: number;
    limit?: number;
    searchQuery?: string;
    lastDoc?: any;
  } = {}
): Promise<{
  jobOrders: JobOrder[];
  hasNextPage: boolean;
  lastDoc: any;
  totalItems?: number;
}> {
  try {
    const { page = 1, limit: pageLimit = 10, searchQuery, lastDoc } = options;

    let q = query(
      collection(db, JOB_ORDERS_COLLECTION),
      where("company_id", "==", companyId),
      orderBy("createdAt", "desc")
    );

    // Apply pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    // Fetch one extra to check if there's a next page
    const fetchLimit = pageLimit + 1;
    q = query(q, limit(fetchLimit));

    const querySnapshot = await getDocs(q);
    let jobOrders: JobOrder[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JobOrder[];

    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      jobOrders = jobOrders.filter(jo =>
        jo.joNumber?.toLowerCase().includes(query) ||
        jo.siteName?.toLowerCase().includes(query) ||
        jo.requestedBy?.toLowerCase().includes(query)
      );
    }

    // Check if there's a next page
    const hasNextPage = jobOrders.length > pageLimit;
    if (hasNextPage) {
      jobOrders = jobOrders.slice(0, pageLimit);
    }

    // Get the last document for pagination
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    // Get total count (without pagination and search for efficiency)
    let totalItems: number | undefined;
    try {
      const countQuery = query(
        collection(db, JOB_ORDERS_COLLECTION),
        where("company_id", "==", companyId)
      );
      const countSnapshot = await getDocs(countQuery);
      totalItems = countSnapshot.size;
    } catch (error) {
      // If count fails, leave undefined
      console.warn("Could not get total count:", error);
    }

    return {
      jobOrders,
      hasNextPage,
      lastDoc: newLastDoc,
      totalItems,
    };
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching job orders:", error)
    throw error
  }
}

export async function getJobOrdersByCompanyId(companyId: string): Promise<JobOrder[]> {
  try {
    console.log("DEBUG: getJobOrdersByCompanyId called with companyId:", companyId)

    if (!companyId) {
      console.log("DEBUG: No companyId provided")
      return []
    }

    const jobOrdersRef = collection(db, "job_orders")
    console.log("DEBUG: Created collection reference")

    const q = query(jobOrdersRef, where("company_id", "==", companyId), orderBy("createdAt", "desc"))
    console.log("DEBUG: Created query with company_id filter")

    const querySnapshot = await getDocs(q)
    console.log("DEBUG: Query executed, got", querySnapshot.size, "documents")

    const jobOrders: JobOrder[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      console.log("DEBUG: Processing document", doc.id, "with data:", data)

      jobOrders.push({
        id: doc.id,
        joNumber: data.joNumber || "",
        siteName: data.siteName || "",
        siteLocation: data.siteLocation || "",
        joType: data.joType || "",
        requestedBy: data.requestedBy || "",
        assignTo: data.assignTo || "",
        dateRequested: data.dateRequested,
        deadline: data.deadline,
        jobDescription: data.jobDescription || "",
        message: data.message || "",
        attachments: data.attachments || [],
        status: data.status || "pending",
        created: data.createdAt,
        updated: data.updatedAt,
        created_by: data.createdBy || "",
        company_id: data.company_id || "",
        quotation_id: data.quotationId || "",
        materialSpec: data.materialSpec || "",
        illumination: data.illumination || "",
      })
    })

    console.log("DEBUG: getJobOrdersByCompanyId returning", jobOrders.length, "job orders")
    console.log("DEBUG: Job orders:", jobOrders)
    return jobOrders
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching job orders by company ID:", error)
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
    throw error
  }
}

export async function getJobOrdersByProductId(productId: string): Promise<JobOrder[]> {
  try {
    console.log("Fetching job orders for product ID:", productId)

    if (!productId) {
      console.log("No productId provided")
      return []
    }

    const jobOrdersRef = collection(db, JOB_ORDERS_COLLECTION)
    const q = query(jobOrdersRef, where("product_id", "==", productId), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    const jobOrders: JobOrder[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      jobOrders.push({
        id: doc.id,
        joNumber: data.joNumber || "",
        siteName: data.siteName || "",
        siteLocation: data.siteLocation || "",
        joType: data.joType || "",
        requestedBy: data.requestedBy || "",
        assignTo: data.assignTo || "",
        dateRequested: data.dateRequested,
        deadline: data.deadline,
        jobDescription: data.jobDescription || "",
        message: data.message || "",
        attachments: data.attachments || [],
        status: data.status || "pending",
        created: data.createdAt,
        updated: data.updatedAt,
        created_by: data.createdBy || "",
        company_id: data.company_id || "",
        quotation_id: data.quotationId || "",
        product_id: data.product_id || "",
        materialSpec: data.materialSpec || "",
        illumination: data.illumination || "",
      } as JobOrder)
    })

    console.log(`Found ${jobOrders.length} job orders for product ${productId}`)
    return jobOrders
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching job orders by product ID:", error)
    throw error
  }
}

export async function getAllJobOrders(): Promise<JobOrder[]> {
  try {
    const q = query(collection(db, JOB_ORDERS_COLLECTION), orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)
    const jobOrders: JobOrder[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JobOrder[]
    return jobOrders
  } catch (error: any) { // Explicitly type error
    console.error("Error fetching all job orders:", error)
    throw error
  }
}

export function generateJONumber(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `JO-${timestamp}-${randomSuffix}`
}

export async function generatePersonalizedJONumber(userData: any): Promise<string> {
  try {
    // Extract initials from user's name
    const names = [userData.first_name, userData.middle_name, userData.last_name].filter(Boolean) // Remove empty/null values

    const initials = names
      .map((name) => name.charAt(0).toUpperCase())
      .join("")
      .substring(0, 4) // Limit to 4 characters max

    // If no initials available, use default
    if (!initials) {
      return generateJONumber() // Fallback to original method
    }

    // Count existing job orders for this user to get sequential number
    const jobOrdersRef = collection(db, JOB_ORDERS_COLLECTION)
    const q = query(jobOrdersRef, where("createdBy", "==", userData.uid), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    const nextSequence = querySnapshot.size + 1

    // Format as INITIALS-XXXX (e.g., JPDM-0001)
    const sequenceNumber = nextSequence.toString().padStart(4, "0")

    return `${initials}-${sequenceNumber}`
  } catch (error: any) { // Explicitly type error
    console.error("Error generating personalized JO number:", error)
    // Fallback to original method if there's an error
    return generateJONumber()
  }
}
