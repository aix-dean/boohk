import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  type DocumentData,
  type QueryDocumentSnapshot,
  getCountFromServer,
  type Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  onSnapshot,
  GeoPoint,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"

// Algolia client for service assignments indexing
let algoliasearch: any = null
let serviceAssignmentsIndex: any = null

// Initialize Algolia client for service assignments
function initializeServiceAssignmentsAlgolia() {
  if (typeof window === 'undefined') {
    // Server-side
    try {
      algoliasearch = require('algoliasearch')
      const client = algoliasearch(
        process.env.NEXT_PUBLIC_ALGOLIA_ASSIGNMENTS_APP_ID,
        process.env.ALGOLIA_ASSIGNMENTS_ADMIN_API_KEY
      )
      serviceAssignmentsIndex = client.initIndex(process.env.NEXT_PUBLIC_ALGOLIA_ASSIGNMENTS_INDEX_NAME)
    } catch (error) {
      console.warn('Algolia client not available for service assignments:', error)
    }
  }
}

// Index service assignment in Algolia
async function indexServiceAssignment(serviceAssignment: ServiceAssignment) {
  if (!serviceAssignmentsIndex) {
    initializeServiceAssignmentsAlgolia()
  }

  if (!serviceAssignmentsIndex) {
    console.warn('Algolia index not available for service assignments, skipping indexing')
    return
  }

  try {
    const algoliaObject = {
      objectID: serviceAssignment.id,
      id: serviceAssignment.id,
      saNumber: serviceAssignment.saNumber,
      joNumber: serviceAssignment.joNumber || '',
      projectSiteId: serviceAssignment.projectSiteId,
      projectSiteName: serviceAssignment.projectSiteName,
      projectSiteLocation: serviceAssignment.projectSiteLocation,
      serviceType: serviceAssignment.serviceType,
      assignedTo: serviceAssignment.assignedTo,
      jobDescription: serviceAssignment.jobDescription,
      requestedBy: serviceAssignment.requestedBy,
      message: serviceAssignment.message,
      campaignName: serviceAssignment.campaignName || '',
      status: serviceAssignment.status,
      coveredDateStart: serviceAssignment.coveredDateStart?.toISOString() || '',
      coveredDateEnd: serviceAssignment.coveredDateEnd?.toISOString() || '',
      alarmDate: serviceAssignment.alarmDate?.toISOString() || '',
      alarmTime: serviceAssignment.alarmTime,
      created: serviceAssignment.created?.toISOString() || '',
      company_id: serviceAssignment.company_id || '',
      reservation_number: serviceAssignment.reservation_number || '',
      booking_id: serviceAssignment.booking_id || '',
    }

    await serviceAssignmentsIndex.saveObject(algoliaObject)
    console.log('Service assignment indexed in Algolia:', serviceAssignment.id)
  } catch (error) {
    console.error('Error indexing service assignment in Algolia:', error)
  }
}

// Remove service assignment from Algolia index
async function removeServiceAssignmentFromIndex(serviceAssignmentId: string) {
  if (!serviceAssignmentsIndex) {
    initializeServiceAssignmentsAlgolia()
  }

  if (!serviceAssignmentsIndex) {
    console.warn('Algolia index not available for service assignments, skipping removal')
    return
  }

  try {
    await serviceAssignmentsIndex.deleteObject(serviceAssignmentId)
    console.log('Service assignment removed from Algolia index:', serviceAssignmentId)
  } catch (error) {
    console.error('Error removing service assignment from Algolia index:', error)
  }
}
import type { QuotationProduct, ProjectCompliance, ClientCompliance } from "@/lib/types/quotation"

// Initialize Firebase Storage
const storage = getStorage()

// Product interface
export interface Product {
  id?: string
  name: string
  description: string
  price: number
  imageUrl?: string
  active: boolean
  deleted: boolean
  created?: any
  updated?: any
  seller_id: string
  seller_name: string
  company_id?: string | null
  position: number
  media?: Array<{
    url: string
    distance: string
    type: string
    isVideo: boolean
  }>
  playerIds?: string[]
  categories?: string[]
  category_names?: string[]
  content_type?: string
  cms?: {
    start_time?: string
    end_time?: string
    spot_duration?: number
    loops_per_day?: number
    spots_per_loop?: number
  } | null
  specs_rental?: {
    audience_types?: string[]
    geopoint?: GeoPoint
    location?: string
    location_label?: string
    land_owner?: string
    partner?: string
    orientation?: string
    traffic_count?: number | null
    traffic_unit?: "monthly" | "daily" | "weekly"
    elevation?: number | null
    height?: number | null
    width?: number | null
    site_orientation?: string | null
    caretaker?: string | null
    size?: string
    material?: string
    panels?: string
    gondola?: boolean
    technology?: string
    site_code?: string
    location_visibility?: number | null
    location_visibility_unit?: string
    dimension_unit?: "ft" | "m"
    elevation_unit?: "ft" | "m"
    structure:{
      color?: string | null
      condition?: string | null
      contractor?: string | null
      last_maintenance?: Date | null
    }
    illumination: string | {
      bottom_count?: number | null
      bottom_lighting_specs?: string | null
      left_count?: number | null
      left_lighting_specs?: string | null
      right_count?: number | null
      right_lighting_specs?: string | null
      upper_count?: number | null
      upper_lighting_specs?: string | null
      power_consumption_monthly?: number | null
    }
  }
  type?: string
  status?: string
  health_percentage?: number
  location?: string
  address?: string
  site_code?: string
  light?: {
    illumination_status?: string
    location?: string
    size?: string
  }
  blueprints?: Array<{
    blueprint: string
    uploaded_by: string
    created: any
  }>
  compliance?: Array<{
    name: string
    doc_url: string
    created: any
    created_by: string
  }>
  structure?: {
    color?: string
    contractor?: string
    condition?: string
    last_maintenance?: any
  }
  personnel?: Array<{
    status: boolean
    name: string
    position: string
    contact: string
    start_date: any
    created: any
    created_by: string
  }>
}

// ServiceAssignment interface
export interface ServiceAssignment {
  id: string
  saNumber: string
  joNumber?: string
  projectSiteId: string
  projectSiteName: string
  projectSiteLocation: string
  serviceType: string
  assignedTo: string
  jobDescription: string
  requestedBy: {
    id: string
    name: string
    department: string
  }
  message: string
  campaignName?: string
  coveredDateStart: Date | null
  coveredDateEnd: Date | null
  alarmDate: Date | null
  alarmTime: string
  attachments: { name: string; type: string }[]
  serviceExpenses: { name: string; amount: string }[]
  status: string
  created: any
  updated: any
  company_id?: string
  reservation_number?: string
  booking_id?: string
}

// Booking interface
export interface Booking {
  id: string
  product_id: string
  client_id: string
  client_name: string
  seller_id: string
  start_date: string | Timestamp
  end_date: string | Timestamp
  status: string
  total_amount: number
  payment_status: string
  created: string | Timestamp
  updated: string | Timestamp
  notes?: string
  booking_reference?: string
  spot_numbers?: number[]
}

// User interface
export interface User {
  id: string
  name: string
  email: string
  company?: string
  company_id?: string // Added company_id
  phone?: string
  role?: string
  created?: string | Timestamp
  updated?: string | Timestamp
}

// QuotationRequest interface
export interface QuotationRequest {
  id: string
  company: string
  company_address: string
  contact_number: string
  created: string | Timestamp
  deleted: boolean
  email_address: string
  end_date: string | Timestamp
  name: string
  position: string
  product_id: string
  product_ref: string
  seller_id: string
  start_date: string | Timestamp
  status: string
  user_id: string
  // Optional fields that might be added later
  notes?: string
  total_amount?: number
  updated?: string | Timestamp
}

// Quotation interface
export interface Quotation {
  id?: string
  quotation_number: string
  quotation_request_id?: string
  start_date?: Date | any // Made optional - supports both string and Timestamp
  end_date?: Date | any // Made optional - supports both string and Timestamp
  total_amount: number
  duration_days: number // Overall duration for the quotation
  notes?: string
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "viewed" | "reserved"
  created: any // Firebase Timestamp
  updated?: any // Firebase Timestamp
  created_by?: string
  created_by_first_name?: string
  created_by_last_name?: string
  client_name?: string
  client_email?: string
  client_id?: string
  client_company_id?: string // Added client company ID
  client_company_name?: string // Added client company name
  client_designation?: string // Added client designation
  client_address?: string // Added client address
  client_phone?: string // Added client phone
  campaignId?: string
  proposalId?: string
  company_id?: string // Added company ID
  valid_until?: any // Firebase Timestamp
  seller_id?: string
  product_id?: string // Added to support legacy single product quotations
  items: QuotationProduct // Changed from array to single object
  projectCompliance?: ProjectCompliance
  client_compliance?: ClientCompliance // Added client compliance
}

// PaginatedResult interface
export interface PaginatedResult<T> {
  items: T[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

// ProjectData interface
export interface ProjectData {
  id: string
  uid: string
  license_key: string
  project_name: string
  company_name: string
  company_location: string
  company_website: string
  social_media: {
    facebook: string
    instagram: string
    youtube: string
  }
  created: string
  updated: string
  deleted: boolean
  tenant_id?: string
}

// ProposalTemplate interface
export interface ProposalTemplate {
  id?: string
  name: string
  background_url: string
  company_id: string
  created: any
  updated: any
  deleted?: boolean
}

// Get a single product by ID
export async function getProductById(productId: string): Promise<Product | null> {
  try {
    const productDoc = await getDoc(doc(db, "products", productId))

    if (productDoc.exists()) {
      return { id: productDoc.id, ...productDoc.data() } as Product
    }

    return null
  } catch (error) {
    console.error("Error fetching product:", error)
    return null
  }
}

// Update an existing product
export async function updateProduct(productId: string, productData: Partial<Product>): Promise<void> {
  try {
    const productRef = doc(db, "products", productId)

    // Add updated timestamp
    const updateData = {
      ...productData,
      updated: serverTimestamp(),
    }

    await updateDoc(productRef, updateData)
  } catch (error) {
    console.error("Error updating product:", error)
    throw error
  }
}

// Get all products for a user (legacy method)
export async function getUserProducts(userId: string): Promise<Product[]> {
  try {
    const productsRef = collection(db, "products")
    const q = query(productsRef, where("company_id", "==", userId), orderBy("name", "asc"))
    const querySnapshot = await getDocs(q)

    const products: Product[] = []
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() } as Product)
    })

    return products
  } catch (error) {
    console.error("Error fetching user products:", error)
    return []
  }
}

// Get all products for a user with real-time updates
export function getUserProductsRealtime(
  userId: string,
  callback: (products: Product[]) => void,
): () => void {
  const productsRef = collection(db, "products")
  const q = query(
    productsRef,
    where("company_id", "==", userId),
    where("active", "==", true),
    orderBy("created", "desc")
  )

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    try {
      const products: Product[] = []
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() } as Product)
      })
      callback(products)
    } catch (error) {
      console.error("Error processing real-time product updates:", error)
      callback([])
    }
  }, (error) => {
    console.error("Error in real-time products listener:", error)
    callback([])
  })

  return unsubscribe
}

// Get paginated products for a user
export async function getPaginatedUserProducts(
  userId: string,
  itemsPerPage = 16,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  options: { searchTerm?: string; active?: boolean; content_type?: string } = {},
): Promise<PaginatedResult<Product>> {
  try {
    const productsRef = collection(db, "products")
    const { searchTerm = "", active, content_type } = options

    // Start with basic constraints
    const constraints: any[] = [where("company_id", "==", userId), orderBy("created", "desc"), limit(itemsPerPage)]

    // Add active filter if specified
    if (active !== undefined) {
      constraints.unshift(where("active", "==", active))
    }

    // Add content_type filter if specified (case-insensitive handled client-side due to Firestore limitations)
    if (content_type) {
      // Note: Firestore doesn't support case-insensitive queries, so we'll need to handle this client-side
      // For now, we'll fetch more items and filter client-side
      constraints[constraints.length - 1] = limit(itemsPerPage * 2) // Fetch more to account for filtering
    }

    // Create the query with all constraints
    let q = query(productsRef, ...constraints)

    // If we have a last document, start after it for pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    const querySnapshot = await getDocs(q)

    // Get the last visible document for next pagination
    let lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    // Convert the documents to Product objects and apply filters
    const products: Product[] = []
    querySnapshot.forEach((doc) => {
      const product = { id: doc.id, ...doc.data() } as Product

      // Apply content_type filter (case-insensitive)
      if (content_type) {
        const productContentType = (product.content_type || "").toLowerCase()
        const filterContentType = content_type.toLowerCase()
        if (productContentType !== filterContentType) {
          return // Skip this product
        }
      }

      // If there's a search term, filter client-side
      if (searchTerm && typeof searchTerm === "string") {
        const searchLower = searchTerm.toLowerCase()
        if (
          product.name?.toLowerCase().includes(searchLower) ||
          product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower)
        ) {
          products.push(product)
        }
      } else {
        products.push(product)
      }
    })

    // If we filtered by content_type, we might have fewer items than requested
    // Adjust pagination accordingly
    const actualItems = products.slice(0, itemsPerPage)
    const hasMore = content_type ? products.length > itemsPerPage : querySnapshot.docs.length === itemsPerPage

    // Update lastVisible if we sliced the results
    if (content_type && actualItems.length > 0) {
      // Find the last document that corresponds to our last item
      const lastItemId = actualItems[actualItems.length - 1].id
      lastVisible = querySnapshot.docs.find((doc) => doc.id === lastItemId) || lastVisible
    }

    return {
      items: actualItems,
      lastDoc: lastVisible,
      hasMore,
    }
  } catch (error) {
    console.error("Error fetching paginated user products:", error)
    return {
      items: [],
      lastDoc: null,
      hasMore: false,
    }
  }
}

// Get paginated products for a user with real-time updates
export function getPaginatedUserProductsRealtime(
  userId: string,
  itemsPerPage = 16,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  options: { searchTerm?: string; active?: boolean; content_type?: string } = {},
  callback: (result: PaginatedResult<Product>) => void,
): () => void {
  const productsRef = collection(db, "products")
  const { searchTerm = "", active, content_type } = options

  // Start with basic constraints
  const constraints: any[] = [where("company_id", "==", userId), orderBy("created", "desc"), limit(itemsPerPage)]

  // Add active filter if specified
  if (active !== undefined) {
    constraints.unshift(where("active", "==", active))
  }

  // Add content_type filter if specified (case-insensitive handled client-side due to Firestore limitations)
  if (content_type) {
    // Note: Firestore doesn't support case-insensitive queries, so we'll need to handle this client-side
    // For now, we'll fetch more items and filter client-side
    constraints[constraints.length - 1] = limit(itemsPerPage * 2) // Fetch more to account for filtering
  }

  // Create the query with all constraints
  let q = query(productsRef, ...constraints)

  // If we have a last document, start after it for pagination
  if (lastDoc) {
    q = query(q, startAfter(lastDoc))
  }

  // Set up the real-time listener
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    try {
      // Get the last visible document for next pagination
      let lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

      // Convert the documents to Product objects and apply filters
      const products: Product[] = []
      querySnapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() } as Product

        // Apply content_type filter (case-insensitive)
        if (content_type) {
          const productContentType = (product.content_type || "").toLowerCase()
          const filterContentType = content_type.toLowerCase()
          if (productContentType !== filterContentType) {
            return // Skip this product
          }
        }

        // If there's a search term, filter client-side
        if (searchTerm && typeof searchTerm === "string") {
          const searchLower = searchTerm.toLowerCase()
          if (
            product.name?.toLowerCase().includes(searchLower) ||
            product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower)
          ) {
            products.push(product)
          }
        } else {
          products.push(product)
        }
      })

      // If we filtered by content_type, we might have fewer items than requested
      // Adjust pagination accordingly
      const actualItems = products.slice(0, itemsPerPage)
      const hasMore = content_type ? products.length > itemsPerPage : querySnapshot.docs.length === itemsPerPage

      // Update lastVisible if we sliced the results
      if (content_type && actualItems.length > 0) {
        // Find the last document that corresponds to our last item
        const lastItemId = actualItems[actualItems.length - 1].id
        lastVisible = querySnapshot.docs.find((doc) => doc.id === lastItemId) || lastVisible
      }

      const result: PaginatedResult<Product> = {
        items: actualItems,
        lastDoc: lastVisible,
        hasMore,
      }

      callback(result)
    } catch (error) {
      console.error("Error processing real-time product updates:", error)
      callback({
        items: [],
        lastDoc: null,
        hasMore: false,
      })
    }
  }, (error) => {
    console.error("Error in real-time product listener:", error)
    callback({
      items: [],
      lastDoc: null,
      hasMore: false,
    })
  })

  return unsubscribe
}

// Get the total count of products for a user
export async function getUserProductsCount(
  userId: string,
  options: { searchTerm?: string; active?: boolean; deleted?: boolean; content_type?: string } = {},
): Promise<number> {
  try {
    console.log("Getting user products count for userId:", userId, "with options:", options)

    const productsRef = collection(db, "products")
    const { searchTerm = "", active, deleted, content_type } = options

    // Start with basic constraints
    const constraints: any[] = [where("company_id", "==", userId)]

    // Add active filter if specified
    if (active !== undefined) {
      constraints.push(where("active", "==", active))
    }
    // Add deleted filter if specified
    if (deleted !== undefined) {
      constraints.push(where("deleted", "==", deleted))
    }

    // Create the query with all constraints
    const q = query(productsRef, ...constraints)

    // If there's a search term or content_type filter, we need to fetch all documents and filter client-side
    if ((searchTerm && typeof searchTerm === "string") || content_type) {
      const querySnapshot = await getDocs(q)
      const searchLower = searchTerm ? searchTerm.toLowerCase() : ""
      const contentTypeLower = content_type ? content_type.toLowerCase() : ""

      // Filter documents client-side
      let count = 0
      querySnapshot.forEach((doc) => {
        const product = doc.data() as Product

        // Apply content_type filter if specified
        if (content_type) {
          const productContentType = (product.content_type || "").toLowerCase()
          if (productContentType !== contentTypeLower) {
            return // Skip this product
          }
        }

        // Apply search filter if specified
        if (searchTerm && typeof searchTerm === "string") {
          if (
            product.name?.toLowerCase().includes(searchLower) ||
            product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower)
          ) {
            count++
          }
        } else {
          count++
        }
      })

      console.log("User products count (with filters):", count)
      return count
    } else {
      // If no search term or content_type, we can use the more efficient getCountFromServer
      const snapshot = await getCountFromServer(q)
      return snapshot.data().count
    }
  } catch (error) {
    console.error("Error getting user products count:", error)
    return 0
  }
}

// Create a new product
export async function createProduct(productData: Partial<Product>): Promise<string> {
  try {
    const newProduct = {
      ...productData,
      status: productData.status || "PENDING",
      position: productData.position || 0,
      deleted: productData.deleted !== undefined ? productData.deleted : false,
      active: productData.active !== undefined ? productData.active : true,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    }

    console.log("Final product data to be saved:", newProduct)

    const docRef = await addDoc(collection(db, "products"), newProduct)
    console.log("Product created with ID:", docRef.id)

    return docRef.id
  } catch (error) {
    console.error("Error creating product:", error)
    throw error
  }
}

// Soft delete a product (mark as deleted)
export async function softDeleteProduct(productId: string): Promise<void> {
  try {
    const productRef = doc(db, "products", productId)
    await updateDoc(productRef, {
      deleted: true,
      date_deleted: serverTimestamp(),
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting product:", error)
    throw error
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    const productsRef = collection(db, "products")
    const querySnapshot = await getDocs(productsRef)

    const products: Product[] = []
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() } as Product)
    })

    return products
  } catch (error) {
    console.error("Error fetching all products:", error)
    return []
  }
}

// Search products by term (for more complex search requirements)
export async function searchUserProducts(userId: string, searchTerm: string): Promise<Product[]> {
  try {
    // For simple searches, we can fetch all user products and filter client-side
    // For production with large datasets, consider using Algolia, Elasticsearch, or Firestore's array-contains
    const products = await getUserProducts(userId)

    if (!searchTerm) return products

    const searchLower = searchTerm.toLowerCase()
    return products.filter(
      (product) =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower),
    )
  } catch (error) {
    console.error("Error searching user products:", error)
    return []
  }
}

// NEW OPTIMIZED FUNCTIONS

// Get products by content type with pagination and filtering
export async function getProductsByContentType(
  contentType: string,
  itemsPerPage = 16,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  searchTerm = "",
): Promise<PaginatedResult<Product>> {
  try {
    const productsRef = collection(db, "products")

    // Create base query - filter out deleted products
    const baseQuery = query(productsRef, where("deleted", "==", false), orderBy("name", "asc"))

    // If search term is provided, we need to handle it differently
    if (searchTerm) {
      // For search, we need to fetch more items and filter client-side
      // This is because Firestore doesn't support case-insensitive search
      const searchQuery = lastDoc
        ? query(baseQuery, startAfter(lastDoc), limit(itemsPerPage * 3)) // Fetch more to account for filtering
        : query(baseQuery, limit(itemsPerPage * 3))

      const querySnapshot = await getDocs(searchQuery)

      // Filter client-side for content_type and search term
      const searchLower = searchTerm.toLowerCase()
      const contentTypeLower = contentType.toLowerCase()

      const filteredDocs = querySnapshot.docs.filter((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        // Check content type match
        if (productContentType !== contentTypeLower) return false

        // Check search term match
        return (
          product.name?.toLowerCase().includes(searchLower) ||
          product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower)
        )
      })

      // Apply pagination to filtered results
      const paginatedDocs = filteredDocs.slice(0, itemsPerPage)
      const lastVisible = paginatedDocs.length > 0 ? paginatedDocs[paginatedDocs.length - 1] : null

      // Convert to products
      const products = paginatedDocs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)

      return {
        items: products,
        lastDoc: lastVisible,
        hasMore: filteredDocs.length > itemsPerPage,
      }
    } else {
      // If no search term, we can use a more efficient query
      // Add content_type filter (case insensitive is handled client-side)
      // Note: For case-insensitive search, consider adding lowercase fields to your documents
      const paginatedQuery = lastDoc
        ? query(baseQuery, limit(itemsPerPage * 2), startAfter(lastDoc))
        : query(baseQuery, limit(itemsPerPage * 2))

      const querySnapshot = await getDocs(paginatedQuery)

      // Filter for content_type (case insensitive)
      const contentTypeLower = contentType.toLowerCase()
      const filteredDocs = querySnapshot.docs.filter((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()
        return productContentType === contentTypeLower
      })

      // Apply pagination to filtered results
      const paginatedDocs = filteredDocs.slice(0, itemsPerPage)
      const lastVisible = paginatedDocs.length > 0 ? paginatedDocs[paginatedDocs.length - 1] : null

      // Convert to products
      const products = paginatedDocs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)

      return {
        items: products,
        lastDoc: lastVisible,
        hasMore: filteredDocs.length > itemsPerPage,
      }
    }
  } catch (error) {
    console.error(`Error fetching products by content type (${contentType}):`, error)
    return {
      items: [],
      lastDoc: null,
      hasMore: false,
    }
  }
}

// Get count of products by content type
export async function getProductsCountByContentType(contentType: string, searchTerm = ""): Promise<number> {
  try {
    const productsRef = collection(db, "products")

    // Create base query - filter out deleted products
    const baseQuery = query(productsRef, where("deleted", "==", false))

    const querySnapshot = await getDocs(baseQuery)

    // Filter for content_type and search term
    const contentTypeLower = contentType.toLowerCase()
    let count = 0

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()

      querySnapshot.forEach((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        if (productContentType === contentTypeLower) {
          if (
            product.name?.toLowerCase().includes(searchLower) ||
            product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower)
          ) {
            count++
          }
        }
      })
    } else {
      querySnapshot.forEach((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        if (productContentType === contentTypeLower) {
          count++
        }
      })
    }

    return count
  } catch (error) {
    console.error(`Error getting count of products by content type (${contentType}):`, error)
    return 0
  }
}

// Add these functions at the end of the file
export async function getServiceAssignments(): Promise<ServiceAssignment[]> {
  try {
    const assignmentsRef = collection(db, "service_assignments")
    const querySnapshot = await getDocs(assignmentsRef)

    const assignments: ServiceAssignment[] = []
    querySnapshot.forEach((doc) => {
      assignments.push({ id: doc.id, ...doc.data() } as ServiceAssignment)
    })

    return assignments
  } catch (error) {
    console.error("Error fetching service assignments:", error)
    return []
  }
}

export async function getServiceAssignmentsByCompanyId(companyId: string): Promise<ServiceAssignment[]> {
  try {
    const assignmentsRef = collection(db, "service_assignments")
    const q = query(assignmentsRef, where("company_id", "==", companyId))
    const querySnapshot = await getDocs(q)

    const assignments: ServiceAssignment[] = []
    querySnapshot.forEach((doc) => {
      assignments.push({ id: doc.id, ...doc.data() } as ServiceAssignment)
    })

    return assignments
  } catch (error) {
    console.error("Error fetching service assignments by company ID:", error)
    return []
  }
}

// Calendar Event interface for unified calendar display
export interface CalendarEvent {
  id: string
  title: string
  type: 'service_assignment' | 'booking' | 'planner' | 'job_order'
  date: Date
  color: string
  description?: string
}

// Get calendar events for the 3-day window from all collections
export async function getCalendarEventsForWindow(companyId: string): Promise<{[date: string]: CalendarEvent[]}> {
  const eventsByDate: {[date: string]: CalendarEvent[]} = {}

  try {
    // Calculate the 3-day window: today, tomorrow, day after tomorrow
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(today.getDate() + 2)

    const windowStart = today
    const windowEnd = dayAfterTomorrow

    // Helper function to safely convert dates
    const convertToDate = (dateValue: any): Date | null => {
      if (!dateValue) return null
      if (dateValue.toDate) return dateValue.toDate() // Firestore Timestamp
      if (dateValue instanceof Date) return dateValue // Already a Date
      if (typeof dateValue === 'string') return new Date(dateValue) // String date
      return null
    }

    // Helper function to add event to the correct date
    const addEventToDate = (event: CalendarEvent, eventDate: Date) => {
      const dateKey = eventDate.toDateString()
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = []
      }
      eventsByDate[dateKey].push(event)
    }

    // 1. Service Assignments - check if start/end dates fall within 3-day window
    const serviceAssignmentsRef = collection(db, "service_assignments")
    const saQuery = query(serviceAssignmentsRef, where("company_id", "==", companyId))
    const saSnapshot = await getDocs(saQuery)

    saSnapshot.forEach((doc) => {
      const data = doc.data()
      const startDate = convertToDate(data.coveredDateStart)
      const endDate = convertToDate(data.coveredDateEnd)

      // Check start date
      if (startDate && startDate >= windowStart && startDate <= windowEnd) {
        addEventToDate({
          id: doc.id,
          title: `${data.saNumber}: ${data.serviceType}`,
          type: 'service_assignment',
          date: startDate,
          color: '#7fdb97', // green
          description: data.jobDescription
        }, startDate)
      }

      // Check end date (only if different from start date)
      if (endDate && endDate >= windowStart && endDate <= windowEnd &&
          (!startDate || endDate.getTime() !== startDate.getTime())) {
        addEventToDate({
          id: `${doc.id}_end`,
          title: `${data.saNumber}: ${data.serviceType} (End)`,
          type: 'service_assignment',
          date: endDate,
          color: '#7fdb97', // green
          description: data.jobDescription
        }, endDate)
      }
    })

    // 2. Bookings - check if start/end dates fall within 3-day window
    const bookingsRef = collection(db, "booking")
    const bookingQuery = query(bookingsRef, where("company_id", "==", companyId))
    const bookingSnapshot = await getDocs(bookingQuery)

    bookingSnapshot.forEach((doc) => {
      const data = doc.data()
      const startDate = convertToDate(data.start_date)
      const endDate = convertToDate(data.end_date)

      // Check start date
      if (startDate && startDate >= windowStart && startDate <= windowEnd) {
        addEventToDate({
          id: doc.id,
          title: `${data.reservation_id || doc.id}: ${data.product_name || data.type || 'Booking'}`,
          type: 'booking',
          date: startDate,
          color: '#73bbff', // blue
          description: data.project_name || data.notes
        }, startDate)
      }

      // Check end date (only if different from start date)
      if (endDate && endDate >= windowStart && endDate <= windowEnd &&
          (!startDate || endDate.getTime() !== startDate.getTime())) {
        addEventToDate({
          id: `${doc.id}_end`,
          title: `${data.reservation_id || doc.id}: ${data.product_name || data.type || 'Booking'} (End)`,
          type: 'booking',
          date: endDate,
          color: '#73bbff', // blue
          description: data.project_name || data.notes
        }, endDate)
      }
    })

    // 3. Planner events - check if start/end dates fall within 3-day window
    const plannerRef = collection(db, "planner")
    const plannerQuery = query(plannerRef, where("createdBy", "==", companyId)) // Note: planner uses createdBy, not company_id
    const plannerSnapshot = await getDocs(plannerQuery)

    plannerSnapshot.forEach((doc) => {
      const data = doc.data()
      const startDate = convertToDate(data.start)
      const endDate = convertToDate(data.end)

      // Check start date
      if (startDate && startDate >= windowStart && startDate <= windowEnd) {
        addEventToDate({
          id: doc.id,
          title: `${data.title}: ${data.type || 'Event'}`,
          type: 'planner',
          date: startDate,
          color: '#ff9696', // red
          description: data.description
        }, startDate)
      }

      // Check end date (only if different from start date)
      if (endDate && endDate >= windowStart && endDate <= windowEnd &&
          (!startDate || endDate.getTime() !== startDate.getTime())) {
        addEventToDate({
          id: `${doc.id}_end`,
          title: `${data.title}: ${data.type || 'Event'} (End)`,
          type: 'planner',
          date: endDate,
          color: '#ff9696', // red
          description: data.description
        }, endDate)
      }
    })

    // 4. Job Orders - check if relevant dates fall within 3-day window
    const jobOrdersRef = collection(db, "job_orders")
    const joQuery = query(jobOrdersRef, where("company_id", "==", companyId))
    const joSnapshot = await getDocs(joQuery)

    joSnapshot.forEach((doc) => {
      const data = doc.data()
      const datesToCheck = [
        { field: 'dateRequested', label: 'Requested' },
        { field: 'deadline', label: 'Deadline' },
        { field: 'contractPeriodStart', label: 'Contract Start' },
        { field: 'contractPeriodEnd', label: 'Contract End' }
      ]

      datesToCheck.forEach(({ field, label }) => {
        const dateValue = convertToDate(data[field])
        if (dateValue && dateValue >= windowStart && dateValue <= windowEnd) {
          addEventToDate({
            id: `${doc.id}_${field}`,
            title: `${data.joNumber}: ${data.joType} (${label})`,
            type: 'job_order',
            date: dateValue,
            color: '#ffe522', // yellow
            description: data.jobDescription
          }, dateValue)
        }
      })
    })

  } catch (error) {
    console.error("Error fetching calendar events:", error)
  }

  return eventsByDate
}

// Legacy function for backward compatibility - now delegates to the new function
export async function getCalendarEventsForDate(companyId: string, targetDate: Date): Promise<CalendarEvent[]> {
  const eventsByDate = await getCalendarEventsForWindow(companyId)
  const dateKey = targetDate.toDateString()
  return eventsByDate[dateKey] || []
}

export async function getServiceAssignmentById(assignmentId: string): Promise<ServiceAssignment | null> {
  try {
    const assignmentDoc = await getDoc(doc(db, "service_assignments", assignmentId))

    if (assignmentDoc.exists()) {
      return { id: assignmentDoc.id, ...assignmentDoc.data() } as ServiceAssignment
    }

    return null
  } catch (error) {
    console.error("Error fetching service assignment:", error)
    return null
  }
}

export async function updateServiceAssignment(
  assignmentId: string,
  assignmentData: Partial<ServiceAssignment>,
): Promise<void> {
  try {
    const assignmentRef = doc(db, "service_assignments", assignmentId)

    // Add updated timestamp
    const updateData = {
      ...assignmentData,
      updated: serverTimestamp(),
    }

    await updateDoc(assignmentRef, updateData)

    // Re-index the updated service assignment in Algolia
    try {
      const updatedDoc = await getDoc(assignmentRef)
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data()
        const updatedAssignment = {
          id: assignmentId,
          saNumber: updatedData.saNumber,
          joNumber: updatedData.joNumber || '',
          projectSiteId: updatedData.projectSiteId,
          projectSiteName: updatedData.projectSiteName,
          projectSiteLocation: updatedData.projectSiteLocation,
          serviceType: updatedData.serviceType,
          assignedTo: updatedData.assignedTo,
          jobDescription: updatedData.jobDescription,
          requestedBy: updatedData.requestedBy,
          message: updatedData.message,
          campaignName: updatedData.campaignName || '',
          status: updatedData.status,
          coveredDateStart: updatedData.coveredDateStart?.toDate() || null,
          coveredDateEnd: updatedData.coveredDateEnd?.toDate() || null,
          alarmDate: updatedData.alarmDate?.toDate() || null,
          alarmTime: updatedData.alarmTime,
          created: updatedData.created?.toDate(),
          updated: new Date(),
          reservation_number: updatedData.reservation_number || '',
          booking_id: updatedData.booking_id || '',
          company_id: updatedData.company_id || '',
        } as ServiceAssignment

        // Re-index asynchronously
        indexServiceAssignment(updatedAssignment)
      }
    } catch (indexError) {
      console.error('Error re-indexing updated service assignment:', indexError)
    }
  } catch (error) {
    console.error("Error updating service assignment:", error)
    throw error
  }
}

export async function createServiceAssignment(assignmentData: Omit<ServiceAssignment, "id" | "created" | "updated">): Promise<string> {
  try {
    const newAssignment = {
      ...assignmentData,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, "service_assignments"), newAssignment)
    console.log("Service assignment created with ID:", docRef.id)

    // Index the service assignment in Algolia
    const assignmentForIndexing = {
      id: docRef.id,
      ...assignmentData,
      created: new Date(),
      updated: new Date(),
    } as ServiceAssignment

    // Index asynchronously (don't await to avoid blocking)
    indexServiceAssignment(assignmentForIndexing)

    return docRef.id
  } catch (error) {
    console.error("Error creating service assignment:", error)
    throw error
  }
}

// Add this function at the end of the file
export async function getProductBookings(productId: string): Promise<Booking[]> {
  try {
    const bookingsRef = collection(db, "booking")
    const q = query(bookingsRef, where("product_id", "==", productId), orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)

    const bookings: Booking[] = []
    querySnapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() } as Booking)
    })

    return bookings
  } catch (error) {
    console.error("Error fetching product bookings:", error)
    return []
  }
}

// Add this function at the end of the file
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId))

    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User
    }

    return null
  } catch (error) {
    console.error("Error fetching user:", error)
    return null
  }
}

// Update this function to make status filtering case-insensitive
export async function getServiceAssignmentsByProductId(productId: string, companyId?: string): Promise<ServiceAssignment[]> {
  try {
    const assignmentsRef = collection(db, "service_assignments")

    // Build query constraints
    const constraints: any[] = [where("projectSiteId", "==", productId)]

    // Add company_id filter if provided
    if (companyId) {
      constraints.push(where("company_id", "==", companyId))
    }

    const q = query(assignmentsRef, ...constraints)

    const querySnapshot = await getDocs(q)

    // Filter by status case-insensitively on the client side
    const assignments: ServiceAssignment[] = []
    querySnapshot.forEach((doc) => {
      const assignment = { id: doc.id, ...doc.data() } as ServiceAssignment

      // Case-insensitive status check
      const status = assignment.status?.toLowerCase() || ""
      if (status === "ongoing" || status === "pending") {
        assignments.push(assignment)
      }
    })

    return assignments
  } catch (error) {
    console.error(`Error fetching service assignments for product ${productId}:`, error)
    return []
  }
}

// QUOTATION REQUEST FUNCTIONS

// Get all quotation requests
export async function getQuotationRequests(): Promise<QuotationRequest[]> {
  try {
    const quotationRequestsRef = collection(db, "quotation_request")
    const q = query(quotationRequestsRef, where("deleted", "==", false), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const quotationRequests: QuotationRequest[] = []
    querySnapshot.forEach((doc) => {
      quotationRequests.push({ id: doc.id, ...doc.data() } as QuotationRequest)
    })

    return quotationRequests
  } catch (error) {
    console.error("Error fetching quotation requests:", error)
    return []
  }
}

// Get quotation requests by seller ID
export async function getQuotationRequestsBySellerId(sellerId: string): Promise<QuotationRequest[]> {
  try {
    const quotationRequestsRef = collection(db, "quotation_request")
    const q = query(
      quotationRequestsRef,
      where("seller_id", "==", sellerId),
      where("deleted", "==", false),
      orderBy("created", "desc"),
    )
    const querySnapshot = await getDocs(q)

    const quotationRequests: QuotationRequest[] = []
    querySnapshot.forEach((doc) => {
      quotationRequests.push({ id: doc.id, ...doc.data() } as QuotationRequest)
    })

    return quotationRequests
  } catch (error) {
    console.error("Error fetching quotation requests by seller ID:", error)
    return []
  }
}

// Get quotation requests by product ID
export async function getQuotationRequestsByProductId(productId: string): Promise<QuotationRequest[]> {
  try {
    const quotationRequestsRef = collection(db, "quotation_request")
    const q = query(
      quotationRequestsRef,
      where("product_id", "==", productId),
      where("deleted", "==", false),
      orderBy("created", "desc"),
    )
    const querySnapshot = await getDocs(q)

    const quotationRequests: QuotationRequest[] = []
    querySnapshot.forEach((doc) => {
      quotationRequests.push({ id: doc.id, ...doc.data() } as QuotationRequest)
    })

    return quotationRequests
  } catch (error) {
    console.error("Error fetching quotation requests by product ID:", error)
    return []
  }
}

// Get quotation requests with pagination
export async function getPaginatedQuotationRequests(
  itemsPerPage = 20,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  options: {
    sellerId?: string
    status?: string
    searchTerm?: string
  } = {},
): Promise<PaginatedResult<QuotationRequest>> {
  try {
    const quotationRequestsRef = collection(db, "quotation_request")
    const { sellerId, status, searchTerm = "" } = options

    // Start with basic constraints
    const constraints: any[] = [where("deleted", "==", false), orderBy("created", "desc"), limit(itemsPerPage)]

    // Add seller filter if specified
    if (sellerId) {
      constraints.unshift(where("seller_id", "==", sellerId))
    }

    // Add status filter if specified
    if (status && status !== "all") {
      constraints.unshift(where("status", "==", status.toUpperCase()))
    }

    // Create the query with all constraints
    let q = query(quotationRequestsRef, ...constraints)

    // If we have a last document, start after it for pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    const querySnapshot = await getDocs(q)

    // Get the last visible document for next pagination
    const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    // Check if there are more documents to fetch
    const hasMore = querySnapshot.docs.length === itemsPerPage

    // Convert the documents to QuotationRequest objects
    const quotationRequests: QuotationRequest[] = []
    querySnapshot.forEach((doc) => {
      const quotationRequest = { id: doc.id, ...doc.data() } as QuotationRequest

      // If there's a search term, filter client-side
      if (searchTerm && typeof searchTerm === "string") {
        const searchLower = searchTerm.toLowerCase()
        if (
          quotationRequest.name?.toLowerCase().includes(searchLower) ||
          quotationRequest.company?.toLowerCase().includes(searchLower) ||
          quotationRequest.email_address?.toLowerCase().includes(searchLower) ||
          quotationRequest.contact_number?.includes(searchTerm)
        ) {
          quotationRequests.push(quotationRequest)
        }
      } else {
        quotationRequests.push(quotationRequest)
      }
    })

    return {
      items: quotationRequests,
      lastDoc: lastVisible,
      hasMore,
    }
  } catch (error) {
    console.error("Error fetching paginated quotation requests:", error)
    return {
      items: [],
      lastDoc: null,
      hasMore: false,
    }
  }
}

// Get a single quotation request by ID
export async function getQuotationRequestById(quotationRequestId: string): Promise<QuotationRequest | null> {
  try {
    const quotationRequestDoc = await getDoc(doc(db, "quotation_request", quotationRequestId))

    if (quotationRequestDoc.exists()) {
      return { id: quotationRequestDoc.id, ...quotationRequestDoc.data() } as QuotationRequest
    }

    return null
  } catch (error) {
    console.error("Error fetching quotation request:", error)
    return null
  }
}

// Update a quotation request
export async function updateQuotationRequest(
  quotationRequestId: string,
  quotationRequestData: Partial<QuotationRequest>,
): Promise<void> {
  try {
    const quotationRequestRef = doc(db, "quotation_request", quotationRequestId)

    // Add updated timestamp
    const updateData = {
      ...quotationRequestData,
      updated: serverTimestamp(),
    }

    await updateDoc(quotationRequestRef, updateData)
  } catch (error) {
    console.error("Error updating quotation request:", error)
    throw error
  }
}

// Create a new quotation request
export async function createQuotationRequest(quotationRequestData: Partial<QuotationRequest>): Promise<string> {
  try {
    const newQuotationRequest = {
      ...quotationRequestData,
      created: serverTimestamp(),
      deleted: false,
      status: quotationRequestData.status || "PENDING",
    }

    const docRef = await addDoc(collection(db, "quotation_request"), newQuotationRequest)
    return docRef.id
  } catch (error) {
    console.error("Error creating quotation request:", error)
    throw error
  }
}

// Soft delete a quotation request
export async function softDeleteQuotationRequest(quotationRequestId: string): Promise<void> {
  try {
    const quotationRequestRef = doc(db, "quotation_request", quotationRequestId)
    await updateDoc(quotationRequestRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting quotation request:", error)
    throw error
  }
}

// Get quotations by quotation request ID
export async function getQuotationsByRequestId(quotationRequestId: string): Promise<any[]> {
  try {
    const quotationsRef = collection(db, "quotations")
    const q = query(quotationsRef, where("quotation_request_id", "==", quotationRequestId), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const quotations: any[] = []
    querySnapshot.forEach((doc) => {
      quotations.push({ id: doc.id, ...doc.data() })
    })

    return quotations
  } catch (error) {
    console.error("Error fetching quotations by request ID:", error)
    return []
  }
}

// Get products by content type and company with pagination and filtering
export async function getProductsByContentTypeAndCompany(
  contentType: string,
  itemsPerPage = 16,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  searchTerm = "",
): Promise<PaginatedResult<Product>> {
  try {
    const productsRef = collection(db, "products")

    // Create base query - filter out deleted products
    const baseQuery = query(productsRef, where("deleted", "==", false), orderBy("name", "asc"))

    // If search term is provided, we need to handle it differently
    if (searchTerm) {
      // For search, we need to fetch more items and filter client-side
      // This is because Firestore doesn't support case-insensitive search
      const searchQuery = lastDoc
        ? query(baseQuery, startAfter(lastDoc), limit(itemsPerPage * 3)) // Fetch more to account for filtering
        : query(baseQuery, limit(itemsPerPage * 3))

      const querySnapshot = await getDocs(searchQuery)

      // Filter client-side for content_type, company_id and search term
      const searchLower = searchTerm.toLowerCase()
      const contentTypeLower = contentType.toLowerCase()

      const filteredDocs = querySnapshot.docs.filter((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        // Check content type match
        if (productContentType !== contentTypeLower) return false

        // Check if product has company_id (filter out products without company_id)
        if (!product.company_id) return false

        // Check search term match
        return (
          product.name?.toLowerCase().includes(searchLower) ||
          product.light?.location?.toLowerCase().includes(searchLower) ||
          product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower)
        )
      })

      // Apply pagination to filtered results
      const paginatedDocs = filteredDocs.slice(0, itemsPerPage)
      const lastVisible = paginatedDocs.length > 0 ? paginatedDocs[paginatedDocs.length - 1] : null

      // Convert to products
      const products = paginatedDocs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)

      return {
        items: products,
        lastDoc: lastVisible,
        hasMore: filteredDocs.length > itemsPerPage,
      }
    } else {
      // If no search term, we can use a more efficient query
      const paginatedQuery = lastDoc
        ? query(baseQuery, limit(itemsPerPage * 2), startAfter(lastDoc))
        : query(baseQuery, limit(itemsPerPage * 2))

      const querySnapshot = await getDocs(paginatedQuery)

      // Filter for content_type and company_id (case insensitive)
      const contentTypeLower = contentType.toLowerCase()
      const filteredDocs = querySnapshot.docs.filter((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        // Check content type match and has company_id
        return productContentType === contentTypeLower && product.company_id
      })

      // Apply pagination to filtered results
      const paginatedDocs = filteredDocs.slice(0, itemsPerPage)
      const lastVisible = paginatedDocs.length > 0 ? paginatedDocs[paginatedDocs.length - 1] : null

      // Convert to products
      const products = paginatedDocs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)

      return {
        items: products,
        lastDoc: lastVisible,
        hasMore: filteredDocs.length > itemsPerPage,
      }
    }
  } catch (error) {
    console.error(`Error fetching products by content type and company (${contentType}):`, error)
    return {
      items: [],
      lastDoc: null,
      hasMore: false,
    }
  }
}

// Get count of products by content type and company
export async function getProductsCountByContentTypeAndCompany(contentType: string, searchTerm = ""): Promise<number> {
  try {
    const productsRef = collection(db, "products")

    // Create base query - filter out deleted products
    const baseQuery = query(productsRef, where("deleted", "==", false))

    const querySnapshot = await getDocs(baseQuery)

    // Filter for content_type, company_id and search term
    const contentTypeLower = contentType.toLowerCase()
    let count = 0

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()

      querySnapshot.forEach((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        if (productContentType === contentTypeLower && product.company_id) {
          if (
            product.name?.toLowerCase().includes(searchLower) ||
            product.light?.location?.toLowerCase().includes(searchLower) ||
            product.specs_rental?.location?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower)
          ) {
            count++
          }
        }
      })
    } else {
      querySnapshot.forEach((doc) => {
        const product = doc.data() as Product
        const productContentType = (product.content_type || "").toLowerCase()

        if (productContentType === contentTypeLower && product.company_id) {
          count++
        }
      })
    }

    return count
  } catch (error) {
    console.error(`Error getting count of products by content type and company (${contentType}):`, error)
    return 0
  }
}

/**
 * Uploads a file to Firebase Storage.
 * @param file The file to upload.
 * @param path The path in Firebase Storage (e.g., "company_logos/").
 * @returns The download URL of the uploaded file.
 */
export async function uploadFileToFirebaseStorage(file: File, path: string): Promise<string> {
  try {
    const storageRef = ref(storage, `${path}${file.name}`)
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    console.log("File uploaded successfully:", downloadURL)
    return downloadURL
  } catch (error) {
    console.error("Error uploading file to Firebase Storage:", error)
    throw error
  }
}

// Get all products
export const getProducts = async (): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products")
    const q = query(productsRef, where("deleted", "==", false), orderBy("created", "desc"))

    const querySnapshot = await getDocs(q)
    const products: Product[] = []

    querySnapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data(),
      } as Product)
    })

    return products
  } catch (error) {
    console.error("Error getting products:", error)
    throw error
  }
}

// Get products by company
export const getProductsByCompany = async (companyId: string): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products")
    const q = query(
      productsRef,
      where("company_id", "==", companyId),
      where("deleted", "==", false),
      orderBy("created", "desc"),
    )

    const querySnapshot = await getDocs(q)
    const products: Product[] = []

    querySnapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data(),
      } as Product)
    })

    return products
  } catch (error) {
    console.error("Error getting products by company:", error)
    throw error
  }
}

// Get a single product by ID
export const getProduct = async (id: string): Promise<Product | null> => {
  try {
    const docRef = doc(db, "products", id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Product
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting product:", error)
    throw error
  }
}

// Update a product
export const updateProductById = async (id: string, productData: Partial<Product>): Promise<void> => {
  try {
    const docRef = doc(db, "products", id)
    await updateDoc(docRef, {
      ...productData,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating product:", error)
    throw error
  }
}

// Soft delete a product
export const deleteProductById = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, "products", id)
    await updateDoc(docRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error deleting product:", error)
    throw error
  }
}

// Get products with pagination
export const getProductsPaginated = async (limitCount = 10): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products")
    const q = query(productsRef, where("deleted", "==", false), orderBy("created", "desc"), limit(limitCount))

    const querySnapshot = await getDocs(q)
    const products: Product[] = []

    querySnapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data(),
      } as Product)
    })

    return products
  } catch (error) {
    console.error("Error getting paginated products:", error)
    throw error
  }
}

// Search products by name
export const searchProductsByName = async (searchTerm: string): Promise<Product[]> => {
  try {
    const productsRef = collection(db, "products")
    const q = query(productsRef, where("deleted", "==", false), orderBy("name"))

    const querySnapshot = await getDocs(q)
    const products: Product[] = []

    querySnapshot.forEach((doc) => {
      const product = { id: doc.id, ...doc.data() } as Product
      if (product.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        products.push(product)
      }
    })

    return products
  } catch (error) {
    console.error("Error searching products:", error)
    throw error
  }
}

// PROPOSAL TEMPLATE FUNCTIONS

// Get all proposal templates for a company
export async function getProposalTemplatesByCompanyId(companyId: string): Promise<ProposalTemplate[]> {
  try {
    const templatesRef = collection(db, "proposal_templates")
    const q = query(
      templatesRef,
      where("company_id", "==", companyId),
      where("deleted", "==", false),
      orderBy("created", "desc"),
    )
    const querySnapshot = await getDocs(q)

    const templates: ProposalTemplate[] = []
    querySnapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() } as ProposalTemplate)
    })

    return templates
  } catch (error) {
    console.error("Error fetching proposal templates:", error)
    return []
  }
}

// Get paginated proposal templates for a company
export async function getPaginatedProposalTemplates(
  companyId: string,
  itemsPerPage = 16,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  options: { searchTerm?: string } = {},
): Promise<PaginatedResult<ProposalTemplate>> {
  try {
    const templatesRef = collection(db, "proposal_templates")
    const { searchTerm = "" } = options

    // Start with basic constraints
    const constraints: any[] = [
      where("company_id", "==", companyId),
      where("deleted", "==", false),
      orderBy("created", "desc"),
      limit(itemsPerPage),
    ]

    // Create the query with all constraints
    let q = query(templatesRef, ...constraints)

    // If we have a last document, start after it for pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    const querySnapshot = await getDocs(q)

    // Get the last visible document for next pagination
    const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    // Convert the documents to ProposalTemplate objects
    const templates: ProposalTemplate[] = []
    querySnapshot.forEach((doc) => {
      const template = { id: doc.id, ...doc.data() } as ProposalTemplate

      // If there's a search term, filter client-side
      if (searchTerm && typeof searchTerm === "string") {
        const searchLower = searchTerm.toLowerCase()
        if (template.name?.toLowerCase().includes(searchLower)) {
          templates.push(template)
        }
      } else {
        templates.push(template)
      }
    })

    return {
      items: templates,
      lastDoc: lastVisible,
      hasMore: querySnapshot.docs.length === itemsPerPage,
    }
  } catch (error) {
    console.error("Error fetching paginated proposal templates:", error)
    return {
      items: [],
      lastDoc: null,
      hasMore: false,
    }
  }
}

// Get a single proposal template by ID
export async function getProposalTemplateById(templateId: string): Promise<ProposalTemplate | null> {
  try {
    const templateDoc = await getDoc(doc(db, "proposal_templates", templateId))

    if (templateDoc.exists()) {
      return { id: templateDoc.id, ...templateDoc.data() } as ProposalTemplate
    }

    return null
  } catch (error) {
    console.error("Error fetching proposal template:", error)
    return null
  }
}

// Create a new proposal template
export async function createProposalTemplate(templateData: Partial<ProposalTemplate>): Promise<string> {
  try {
    const newTemplate = {
      ...templateData,
      created: serverTimestamp(),
      updated: serverTimestamp(),
      deleted: false,
    }

    const docRef = await addDoc(collection(db, "proposal_templates"), newTemplate)
    return docRef.id
  } catch (error) {
    console.error("Error creating proposal template:", error)
    throw error
  }
}

// Update an existing proposal template
export async function updateProposalTemplate(
  templateId: string,
  templateData: Partial<ProposalTemplate>,
): Promise<void> {
  try {
    const templateRef = doc(db, "proposal_templates", templateId)

    // Add updated timestamp
    const updateData = {
      ...templateData,
      updated: serverTimestamp(),
    }

    await updateDoc(templateRef, updateData)
  } catch (error) {
    console.error("Error updating proposal template:", error)
    throw error
  }
}

// Soft delete a proposal template
export async function softDeleteProposalTemplate(templateId: string): Promise<void> {
  try {
    const templateRef = doc(db, "proposal_templates", templateId)
    await updateDoc(templateRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting proposal template:", error)
    throw error
  }
}

// Get count of proposal templates for a company
export async function getProposalTemplatesCount(companyId: string, searchTerm = ""): Promise<number> {
  try {
    const templatesRef = collection(db, "proposal_templates")
    const q = query(templatesRef, where("company_id", "==", companyId), where("deleted", "==", false))

    if (searchTerm && typeof searchTerm === "string") {
      const querySnapshot = await getDocs(q)
      const searchLower = searchTerm.toLowerCase()

      let count = 0
      querySnapshot.forEach((doc) => {
        const template = doc.data() as ProposalTemplate
        if (template.name?.toLowerCase().includes(searchLower)) {
          count++
        }
      })

      return count
    } else {
      const snapshot = await getCountFromServer(q)
      return snapshot.data().count
    }
  } catch (error) {
    console.error("Error getting proposal templates count:", error)
    return 0
  }
}

// Get occupancy data for all products in one efficient query
export async function getOccupancyData(companyId: string, currentDate: Date = new Date()): Promise<{
  staticUnavailable: number;
  staticTotal: number;
  dynamicUnavailable: number;
  dynamicTotal: number;
}> {
  try {
    console.log(`Getting occupancy data for company:`, companyId)

    // Get all products for the company
    const productsRef = collection(db, "products")
    const productsQuery = query(
      productsRef,
      where("company_id", "==", companyId),
      where("deleted", "==", false)
    )

    const productsSnapshot = await getDocs(productsQuery)
    const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product))

    console.log(`Found ${allProducts.length} total products`)

    // Get all bookings for the company
    const bookingsRef = collection(db, "booking")
    const bookingsQuery = query(bookingsRef, where("company_id", "==", companyId))
    const bookingsSnapshot = await getDocs(bookingsQuery)
    const allBookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking))

    console.log(`Found ${allBookings.length} total bookings`)

    // Group bookings by product_id for faster lookup
    const bookingsByProduct = new Map<string, Booking[]>()
    allBookings.forEach(booking => {
      if (!bookingsByProduct.has(booking.product_id)) {
        bookingsByProduct.set(booking.product_id, [])
      }
      bookingsByProduct.get(booking.product_id)!.push(booking)
    })

    // Initialize counters
    let staticUnavailable = 0
    let staticTotal = 0
    let dynamicUnavailable = 0
    let dynamicTotal = 0

    // Process each product
    for (const product of allProducts) {
      if (!product.id) continue // Skip products without ID

      const productBookings = bookingsByProduct.get(product.id) || []
      const isUnavailable = productBookings.some((booking) => {
        // Skip completed or cancelled bookings
        if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
          return false
        }

        // Convert dates to Date objects (handle both string and Timestamp)
        const startDate = booking.start_date ? (typeof booking.start_date === 'string' ? new Date(booking.start_date) : booking.start_date.toDate()) : null
        const endDate = booking.end_date ? (typeof booking.end_date === 'string' ? new Date(booking.end_date) : booking.end_date.toDate()) : null

        // Check if current date falls within booking period
        if (startDate && endDate) {
          return currentDate >= startDate && currentDate <= endDate
        }

        return false
      })

      // Check content type and increment counters
      const contentType = (product.content_type || "").toLowerCase()
      if (contentType === "static") {
        staticTotal++
        if (isUnavailable) staticUnavailable++
      } else if (contentType === "dynamic") {
        dynamicTotal++
        if (isUnavailable) dynamicUnavailable++
      }
    }

    console.log(`Occupancy results: Static ${staticUnavailable}/${staticTotal}, Dynamic ${dynamicUnavailable}/${dynamicTotal}`)

    return {
      staticUnavailable,
      staticTotal,
      dynamicUnavailable,
      dynamicTotal
    }
  } catch (error) {
    console.error(`Error getting occupancy data:`, error)
    return {
      staticUnavailable: 0,
      staticTotal: 0,
      dynamicUnavailable: 0,
      dynamicTotal: 0
    }
  }
}

// ContentMedia interface
export interface ContentMedia {
  id?: string
  category_id: string
  title?: string
  thumbnail?: string
  media: Array<{
    url: string
    type: string
    isVideo: boolean
  }>
  created?: any
  updated?: any
}

// Get service assignments filtered by company_id and department
export async function getServiceAssignmentsByDepartment(company_id: string, department: string): Promise<ServiceAssignment[]> {
   try {
     const assignmentsRef = collection(db, "service_assignments")
     const q = query(
       assignmentsRef,
       where("company_id", "==", company_id),
       where("requestedBy.department", "==", department),
       orderBy("created", "desc")
     )

     const querySnapshot = await getDocs(q)

     const assignments: ServiceAssignment[] = []
     querySnapshot.forEach((doc) => {
       assignments.push({ id: doc.id, ...doc.data() } as ServiceAssignment)
     })

     return assignments
   } catch (error) {
     console.error("Error fetching service assignments by department:", error)
     return []
   }
}

export async function getLatestServiceAssignmentsPerBooking(companyId: string): Promise<{ [bookingId: string]: ServiceAssignment }> {
  try {
    const q = query(collection(db, "service_assignments"), where("company_id", "==", companyId), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const assignmentsByBooking: { [bookingId: string]: ServiceAssignment } = {}

    querySnapshot.docs.forEach((doc) => {
      const data = doc.data()
      const assignment: ServiceAssignment = {
        id: doc.id,
        ...data,
      } as ServiceAssignment

      // Only keep the latest assignment for each booking_id
      if (assignment.booking_id && !assignmentsByBooking[assignment.booking_id]) {
        assignmentsByBooking[assignment.booking_id] = assignment
      }
    })

    return assignmentsByBooking
  } catch (error) {
    console.error("Error fetching latest service assignments per booking:", error)
    throw error
  }
}

// Get latest video from content_media by category_id
export async function getLatestVideoByCategory(categoryId: string): Promise<string | null> {
  try {
    const contentMediaRef = collection(db, "content_media")
    const q = query(
      contentMediaRef,
      where("category_id", "==", categoryId),
      orderBy("created", "desc"),
      limit(1)
    )

    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]
      const contentMedia = { id: doc.id, ...doc.data() } as ContentMedia

      // Extract video URL from media[0].url
      if (contentMedia.media && contentMedia.media.length > 0 && contentMedia.media[0].url) {
        return contentMedia.media[0].url
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching latest video by category:", error)
    return null
  }
}

// Get news items from content_media by category_id
export async function getNewsItemsByCategory(categoryId: string, limitCount = 5): Promise<ContentMedia[]> {
  try {
    const contentMediaRef = collection(db, "content_media")
    const q = query(
      contentMediaRef,
      where("category_id", "==", categoryId),
      orderBy("created", "desc"),
      limit(limitCount)
    )

    const querySnapshot = await getDocs(q)
    const newsItems: ContentMedia[] = []

    querySnapshot.forEach((doc) => {
      newsItems.push({ id: doc.id, ...doc.data() } as ContentMedia)
    })

    return newsItems
  } catch (error) {
    console.error("Error fetching news items by category:", error)
    return []
  }
}