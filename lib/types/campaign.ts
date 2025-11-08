export interface Campaign {
  id: string
  title: string
  client: {
    company: string
    contactPerson: string
    email: string
    phone: string
    address: string
    industry: string
    targetAudience: string
    campaignObjective: string
  }
  status:
    | "proposal_draft"
    | "proposal_sent"
    | "proposal_accepted"
    | "proposal_declined"
    | "cost_estimate_pending"
    | "cost_estimate_sent"
    | "cost_estimate_approved"
    | "cost_estimate_declined"
    | "quotation_pending"
    | "quotation_sent"
    | "quotation_accepted"
    | "quotation_declined"
    | "booking_confirmed"
    | "campaign_active"
    | "campaign_completed"
    | "campaign_cancelled"
  proposalId?: string
  costEstimateId?: string
  quotationId?: string
  bookingId?: string
  totalAmount: number
  estimatedAmount?: number
  finalAmount?: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  timeline: CampaignTimelineEvent[]
  notes: string
}

export interface CampaignTimelineEvent {
  id: string
  type:
    | "proposal_created"
    | "proposal_sent"
    | "proposal_accepted"
    | "proposal_declined"
    | "cost_estimate_created"
    | "cost_estimate_sent"
    | "cost_estimate_approved"
    | "cost_estimate_declined"
    | "quotation_created"
    | "quotation_sent"
    | "quotation_accepted"
    | "quotation_declined"
    | "booking_confirmed"
    | "campaign_started"
    | "campaign_completed"
    | "note_added"
  title: string
  description: string
  userId: string
  userName: string
  timestamp: Date
  metadata?: Record<string, any>
}
