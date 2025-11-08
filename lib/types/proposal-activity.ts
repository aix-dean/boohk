export interface ProposalActivity {
  id: string
  proposalId: string
  type: "created" | "status_changed" | "email_sent" | "viewed" | "pdf_generated" | "updated" | "comment_added"
  description: string
  details: {
    oldStatus?: string
    newStatus?: string
    emailRecipient?: string
    updatedFields?: string[]
    comment?: string
  }
  performedBy: string
  performedByName: string
  timestamp: Date
  ipAddress?: string
  location?: {
    country?: string
    region?: string
    city?: string
    timezone?: string
    isp?: string
  }
  metadata?: Record<string, any>
}
