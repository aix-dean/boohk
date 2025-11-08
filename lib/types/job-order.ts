import type { Timestamp } from "firebase/firestore"
import type { ProjectCompliance } from "@/lib/types/quotation" // Import ProjectCompliance

export type JobOrderType = "Installation" | "Maintenance" | "Repair" | "Dismantling" | "Other"
export type JobOrderStatus = "draft" | "pending" | "approved" | "rejected" | "completed" | "cancelled"

export interface JobOrder {
  id: string
  joNumber: string
  siteName: string
  siteLocation?: string
  joType: JobOrderType | string
  requestedBy: string
  assignTo: string
  dateRequested: string | Date
  deadline: string | Date
  jobDescription?: string
  message?: string
  attachments: { name: string; type: string; url: string } | null
  status: JobOrderStatus | string
  created?: Date | Timestamp
  updated?: Date | Timestamp
  created_by: string
  company_id: string
  quotation_id?: string
  booking_id?: string

  // Additional fields from the actual database structure
  clientCompany?: string
  clientName?: string
  contractDuration?: string
  contractPeriodEnd?: string | Date
  contractPeriodStart?: string | Date
  leaseRatePerMonth?: number
  missingCompliance?: Record<string, any>
  quotationNumber?: string
  remarks?: string
  product_id?: string
  projectCompliance?: ProjectCompliance // Added project compliance object
  dtiBirUrl?: string | null // Added client compliance URL
  gisUrl?: string | null // Added client compliance URL
  idSignatureUrl?: string | null // Added client compliance URL
  siteImageUrl?: string | null // Added site image URL
  materialSpec?: string // Material specification for the job order
  illumination?: string // Illumination specification for the job order
  client_email?: string // Client email for the job order
  campaignName?: string // Campaign name for the job order
  reservation_number?: string // Reservation number from booking
}
