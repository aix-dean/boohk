import type { Timestamp } from "firebase/firestore"

export interface SalesQuota {
  id?: string
  associateId: string // User ID of the sales associate
  associateName: string // Display name
  companyId: string
  month: number // 1-12
  year: number
  targetQuotations: number // Monthly target number of quotations
  actualQuotations: number // Actual number of quotations created (calculated)
  achievementPercentage: number // (actual / target) * 100
  created: Timestamp
  updated: Timestamp
  createdBy: string // Admin who set the quota
}

export interface SalesQuotaSummary {
  averageAchievement: number // Average achievement percentage across all associates
  totalAssociates: number
  associatesOnTrack: number // Associates meeting or exceeding target
  associatesBelowTarget: number // Associates below target
  totalTargets: number
  totalActual: number
}

export interface SalesAssociateQuota {
  associateId: string
  associateName: string
  targetQuotations: number
  actualQuotations: number
  achievementPercentage: number
  status: 'above-target' | 'on-target' | 'below-target'
}