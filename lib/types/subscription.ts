export type SubscriptionPlanType = "solo" | "family" | "membership" | "enterprise" | "trial" | "graphic-expo-event"
export type BillingCycle = "monthly" | "annually"
export type SubscriptionStatus = "active" | "inactive" | "trialing" | "cancelled" | "expired"

export interface Subscription {
  id: string
  licenseKey: string
  planType: SubscriptionPlanType
  billingCycle: BillingCycle
  uid: string // User ID
  startDate: Date // When the subscription started
  endDate: Date | null // When the subscription ends (null for lifetime or ongoing)
  status: SubscriptionStatus
  maxProducts: number // Max products allowed for this subscription
  maxUsers: number // Max users allowed for this subscription
  trialEndDate: Date | null // End date of the trial period, if applicable
  companyId: string | null // Company ID field
  createdAt: Date // Timestamp of creation
  updatedAt: Date // Last updated timestamp
}

export type SubscriptionData = Subscription

export interface SubscriptionPlan {
  id: string
  name: string
  description: string // Added description for plans
  price: number // Price per month/year depending on context, or 0 for free/trial
  billingCycle: BillingCycle | "N/A" // Added billing cycle to plan definition
  features: string[]
  buttonText: string // Added button text for plans
}

// Helper function to calculate subscription end date
export function calculateSubscriptionEndDate(
  planType: SubscriptionPlanType,
  billingCycle: BillingCycle,
  startDate: Date,
): { endDate: Date | null; trialEndDate: Date | null } {
  let endDate: Date | null = null
  let trialEndDate: Date | null = null

  const start = new Date(startDate)

  if (planType === "trial") {
    trialEndDate = new Date(start)
    trialEndDate.setDate(start.getDate() + 60) // 60-day trial
    endDate = trialEndDate // Trial ends, subscription ends
  } else if (planType === "graphic-expo-event") {
    endDate = new Date(start)
    endDate.setDate(start.getDate() + 90) // 90 days for graphic expo event plan
  } else if (planType === "enterprise") {
    endDate = null // Enterprise has no fixed end date, or handled separately
  } else {
    if (billingCycle === "monthly") {
      endDate = new Date(start)
      endDate.setMonth(start.getMonth() + 1)
    } else if (billingCycle === "annually") {
      endDate = new Date(start)
      endDate.setFullYear(start.getFullYear() + 1)
    }
  }

  return { endDate, trialEndDate }
}

// Helper function to get max products for a given plan type
export function getMaxProductsForPlan(planType: SubscriptionPlanType): number {
  switch (planType) {
    case "solo":
      return 3 // Manage up to 3 sites
    case "family":
      return 5 // Manage up to 5 sites
    case "membership":
      return 8 // Manage up to 8 sites
    case "enterprise":
      return 99999 // Unlimited for enterprise
    case "trial":
      return 3 // Example: 1 product for trial
    case "graphic-expo-event":
      return 5 // Example: 5 products for event plan
    default:
      return 0
  }
}

// Helper function to get max users for a given plan type
export function getMaxUsersForPlan(planType: SubscriptionPlanType): number {
  switch (planType) {
    case "solo":
      return 12 // Solo plan allows 3 users
    case "family":
      return 12 // Family plan allows 5 users
    case "membership":
      return 12 // Membership allows 10 users
    case "enterprise":
      return 99999 // Unlimited for enterprise
    case "trial":
      return 12 // Trial allows 2 users
    case "graphic-expo-event":
      return 12 // Event plan allows 5 users
    default:
      return 12 // Default to 12 users
  }
}
