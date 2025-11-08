export interface MediaItem {
  distance?: string
  isVideo?: boolean
  type?: string // e.g., "Video", "Image"
  url?: string
  name?: string
  price?: number // This price seems to be for the media item itself, not the product.
}

export interface SpecsRental {
  audience_types?: string[] // e.g., ["General Public"]
  elevation?: number
  location?: string // e.g., "manila"
  traffic_count?: number
  type?: string // e.g., "RENTAL"
  height?: number
  width?: number
  content_type?: string // e.g., "Digital"
}

export interface QuotationProduct {
  id?: string // Added missing id field
  product_id: string
  name: string
  location: string
  price: number // Monthly price
  site_code?: string
  type?: string // e.g., "LED Billboard", "Static Billboard"
  description?: string // Added for product description
  health_percentage?: number // Added from image
  light?: boolean // Added from image
  media?: MediaItem[] // Added from image
  specs?: SpecsRental // Added from image
  // New fields from image data model
  media_url?: string // Added to match image exactly
  duration_days?: number // Duration specific to this item (if different from overall)
  item_total_amount?: number // Total amount for this specific item
  height?: number
  width?: number
  content_type?: string
  site_type?: string
  site_notes?: string
  price_notes?: string
  illumination?: string
  cms?: any // Added cms field for product CMS data
  spot_number?: number // Spot number for dynamic/digital content types
}

export interface ClientComplianceItem {
  status: "pending" | "completed" | "uploaded"
  pdf_url?: string
  uploaded_date?: any // Firebase Timestamp
  uploaded_by?: string
  file_name?: string
  notes?: string
}

export interface ClientCompliance {
  dti_bir_2303?: ClientComplianceItem
  gis?: ClientComplianceItem
  id_signature?: ClientComplianceItem
}

export interface ProjectComplianceItem {
  completed?: boolean
  fileName: string | null
  fileUrl: string | null
  notes: string | null
  uploadedAt: any | null // Firebase Timestamp or ISO string
  uploadedBy?: string | null // Optional, as it's not in all examples
  status?: "pending" | "completed" | "uploaded" // Added status field
}

export interface ProjectCompliance {
  finalArtwork: ProjectComplianceItem
  paymentAsDeposit: ProjectComplianceItem
  irrevocablePo: ProjectComplianceItem
  signedContract: ProjectComplianceItem
  signedQuotation: ProjectComplianceItem
}

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
  page_id?: string // Added page ID for grouping related quotations
  page_number?: number // Added page number for ordering within a page group
  valid_until?: any // Firebase Timestamp
  seller_id?: string
  product_id?: string // Added to support legacy single product quotations
  items: QuotationProduct // Renamed from 'products' to 'items'
  projectCompliance?: ProjectCompliance
  client_compliance?: ClientCompliance // Added client compliance
  signature_position?: string // Position of the person signing the quotation
  signature_name?: string // Name of the person signing the quotation
  template?: {
    salutation?: string // Salutation title (Mr., Ms., Mrs., Miss)
    greeting?: string // Custom greeting text
    terms_and_conditions?: string[] // Array of terms and conditions
    closing_message?: string // Optional closing message
  }
  size?: string // Size specification
  costEstimateNumber?: string // Reference to the source cost estimate number
  pdf?: string // PDF URL field
  password?: string // 8-digit password field
  signature_date?: Date | null // Signature date from creator's signature
  spot_numbers?: number[] // Array of selected spot numbers
}
