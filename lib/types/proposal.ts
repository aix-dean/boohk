import { GeoPoint } from "firebase/firestore"

export type ProposalClient = {
  id: string // Added missing id field
  company: string
  contactPerson: string
  name: string
  email: string
  phone: string
  address?: string
  industry?: string
  targetAudience?: string
  campaignObjective?: string
  designation?: string // Added new field
  companyLogoUrl?: string // Added new field
  company_id?: string // Added new field
}

export type ProductSpecsRental = {
  location?: string
  traffic_count?: number
  traffic_unit?: string
  elevation?: number
  elevation_unit?: string
  height?: number
  width?: number
  dimension_unit?: string
  audience_type?: string
  audience_types?: string[]
  location_visibility?: number
  location_visibility_unit?: string
  orientation?: string
  partner?: string
  land_owner?: string
  geopoint?: GeoPoint
  illumination?: {
    bottom_count?: number
    bottom_lighting_specs?: string
    left_count?: number
    left_lighting_specs?: string
    power_consumption_monthly?: number
    right_count?: number
    right_lighting_specs?: string
    upper_count?: number
    upper_lighting_specs?: string
  }
  structure?: {
    color?: string
    condition?: string
    contractor?: string
    last_maintenance?: string
  }
}

export type ProductLight = {
  location?: string
  name?: string
  operator?: string
}

export type ProductMedia = {
  url: string
  distance?: string // Added missing field
  type?: string     // Added missing field
  isVideo: boolean
}

export type ProposalProduct = {
  id: string
  ID: string // Document ID of the selected or created site
  name: string
  type: string
  price: number
  location: string
  site_code?: string
  media?: ProductMedia[]
  specs_rental?: ProductSpecsRental | null
  light?: ProductLight | null
  description?: string
  health_percentage?: number
  additionalMessage?: string // Additional message for the product
  // Add all other fields from Product interface that might be needed
  active?: boolean
  deleted?: boolean
  created?: any
  updated?: any
  seller_id?: string
  seller_name?: string
  company_id?: string | null
  position?: number
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
  status?: string
  address?: string
}

export type PageElement = {
  id: string
  type: 'text' | 'image' | 'video'
  content: string // text content or media URL
  position: { x: number; y: number }
  size: { width: number; height: number }
  style?: {
    fontSize?: number
    fontFamily?: string
    color?: string
    fontWeight?: string
    textAlign?: string
  }
}

export type CustomPage = {
  id: string
  type: 'blank'
  elements: PageElement[]
  position: number // order in proposal
}

export type ProposalContactInfo = {
  heading: string
  name: string
  role: string
  phone: string
  email: string
}

export type Proposal = {
     id: string
     title: string
     description?: string
     proposalNumber?: string // Add proposal number field
     proposalTitle?: string // Add proposal title field for the main heading
     proposalMessage?: string // Add proposal message field for the outro page
     contactInfo?: ProposalContactInfo // Add contact info field for the outro page
     fieldVisibility?: { // Add field visibility for site details per product
       [productId: string]: {
         location?: boolean
         dimension?: boolean
         type?: boolean
         traffic?: boolean
         location_visibility?: boolean
         srp?: boolean
         additionalMessage?: boolean
       }
     }
    client: ProposalClient
    products: ProposalProduct[]
    customPages?: CustomPage[] // Add custom blank pages
    totalAmount: number
    validUntil: Date
    notes?: string
    customMessage?: string
    createdBy: string
    companyId?: string | null // Add company_id field
    companyName?: string // Add company name field
    companyLogo?: string // Add company logo field
    logoWidth?: number // Add logo width field
    logoHeight?: number // Add logo height field
    logoLeft?: number // Add logo left position field
    logoTop?: number // Add logo top position field
    preparedByName?: string // Add prepared by name field
    preparedByCompany?: string // Add prepared by company field
    campaignId?: string | null
    templateSize?: string
    templateOrientation?: string
    templateLayout?: string
    templateBackground?: string
    pdf?: string // PDF URL field
    password?: string // 8-digit password field
    status:
      | "draft"
      | "sent"
      | "viewed"
      | "accepted"
      | "declined"
      | "cost_estimate_pending"
      | "cost_estimate_approved"
      | "cost_estimate_rejected"
    createdAt: Date
    updatedAt: Date
  }
