import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Campaign, CampaignTimelineEvent } from "@/lib/types/campaign"
import type { Proposal } from "@/lib/types/proposal"
import { getProposalActivities } from "@/lib/proposal-activity-service"

export type { Campaign, CampaignTimelineEvent } from "@/lib/types/campaign"

// Create a campaign from a proposal
export async function createCampaignFromProposal(proposal: Proposal, userId: string): Promise<string> {
  try {
    // Create a regular JavaScript Date object instead of serverTimestamp for the timeline
    const currentDate = new Date()

    const campaignData: Omit<Campaign, "id"> = {
      title: proposal.title,
      client: proposal.client,
      status: proposal.status === "sent" ? "proposal_sent" : "proposal_draft",
      proposalId: proposal.id,
      quotationIds: [], // Initialize empty array for quotation IDs
      totalAmount: proposal.totalAmount,
      createdBy: userId,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      timeline: [
        {
          id: `timeline_${Date.now()}`,
          type: "proposal_created",
          title: "Proposal Created",
          description: `Proposal "${proposal.title}" was created`,
          userId,
          userName: "Current User",
          timestamp: currentDate, // Use regular Date object instead of serverTimestamp
        },
      ],
      notes: proposal.notes || "",
    }

    const docRef = await addDoc(collection(db, "campaigns"), campaignData)

    // Update the proposal with the campaign ID
    if (proposal.id) {
      const proposalRef = doc(db, "proposals", proposal.id)
      await updateDoc(proposalRef, {
        campaignId: docRef.id,
        updatedAt: serverTimestamp(),
      })
    }

    return docRef.id
  } catch (error) {
    console.error("Error creating campaign:", error)
    throw error
  }
}

// Add quotation to campaign
export async function addQuotationToCampaign(campaignId: string, quotationId: string, userId: string): Promise<void> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const campaignRef = doc(db, "campaigns", campaignId)

    // Add quotation ID to the campaign's quotationIds array
    await updateDoc(campaignRef, {
      quotationIds: arrayUnion(quotationId),
      updatedAt: serverTimestamp(),
    })

    // Add timeline event
    const timelineEvent: CampaignTimelineEvent = {
      id: `timeline_${Date.now()}`,
      type: "quotation_created",
      title: "Quotation Created",
      description: `Quotation ${quotationId} was created and linked to this campaign`,
      userId: userId || "system",
      userName: "System",
      timestamp: new Date(),
    }

    await updateDoc(campaignRef, {
      timeline: arrayUnion(timelineEvent),
    })
  } catch (error) {
    console.error("Error adding quotation to campaign:", error)
    throw error
  }
}

// Get campaign by ID
export async function getCampaignById(campaignId: string): Promise<Campaign | null> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const campaignDoc = await getDoc(doc(db, "campaigns", campaignId))

    if (!campaignDoc.exists()) {
      return null
    }

    const data = campaignDoc.data()

    return {
      id: campaignDoc.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
      timeline:
        data.timeline?.map((event: any) => ({
          ...event,
          timestamp: event.timestamp instanceof Timestamp ? event.timestamp.toDate() : new Date(event.timestamp),
        })) || [],
      quotationIds: data.quotationIds || [],
    } as Campaign
  } catch (error) {
    console.error("Error fetching campaign by ID:", error)
    return null
  }
}

// Get campaigns by user ID
export async function getCampaignsByUserId(userId: string): Promise<Campaign[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const campaignsRef = collection(db, "campaigns")
    const q = query(campaignsRef, where("createdBy", "==", userId), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    const campaigns: Campaign[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      campaigns.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        timeline:
          data.timeline?.map((event: any) => ({
            ...event,
            timestamp: event.timestamp instanceof Timestamp ? event.timestamp.toDate() : new Date(event.timestamp),
          })) || [],
        quotationIds: data.quotationIds || [],
      } as Campaign)
    })

    return campaigns
  } catch (error) {
    console.error("Error fetching campaigns:", error)
    return []
  }
}

// Get all campaigns
export async function getCampaigns(filters?: {
  status?: Campaign["status"]
  createdBy?: string
}): Promise<Campaign[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    let q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"))

    if (filters?.status) {
      q = query(q, where("status", "==", filters.status))
    }

    if (filters?.createdBy) {
      q = query(q, where("createdBy", "==", filters.createdBy))
    }

    const querySnapshot = await getDocs(q)
    const campaigns: Campaign[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      campaigns.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        timeline:
          data.timeline?.map((event: any) => ({
            ...event,
            timestamp: event.timestamp instanceof Timestamp ? event.timestamp.toDate() : new Date(event.timestamp),
          })) || [],
        quotationIds: data.quotationIds || [],
      } as Campaign)
    })

    return campaigns
  } catch (error) {
    console.error("Error fetching campaigns:", error)
    return []
  }
}

// Get campaign by proposal ID
export async function getCampaignByProposalId(proposalId: string): Promise<Campaign | null> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const campaignsRef = collection(db, "campaigns")
    const q = query(campaignsRef, where("proposalId", "==", proposalId))

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null
    }

    const doc = querySnapshot.docs[0]
    const data = doc.data()

    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
      timeline:
        data.timeline?.map((event: any) => ({
          ...event,
          timestamp: event.timestamp instanceof Timestamp ? event.timestamp.toDate() : new Date(event.timestamp),
        })) || [],
      quotationIds: data.quotationIds || [],
    } as Campaign
  } catch (error) {
    console.error("Error fetching campaign by proposal ID:", error)
    return null
  }
}

// Update campaign status
export async function updateCampaignStatus(
  campaignId: string,
  status: Campaign["status"],
  userId?: string,
  userName?: string,
): Promise<void> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const campaignRef = doc(db, "campaigns", campaignId)

    // Create timeline event with regular Date object instead of serverTimestamp
    const timelineEvent: CampaignTimelineEvent = {
      id: `timeline_${Date.now()}`,
      type: getTimelineEventType(status),
      title: getStatusTitle(status),
      description: `Campaign status changed to ${status.replace(/_/g, " ")}`,
      userId: userId || "system",
      userName: userName || "System",
      timestamp: new Date(), // Use regular Date object instead of serverTimestamp
    }

    await updateDoc(campaignRef, {
      status,
      updatedAt: serverTimestamp(),
      timeline: arrayUnion(timelineEvent),
    })
  } catch (error) {
    console.error("Error updating campaign status:", error)
    throw error
  }
}

// Add timeline event to campaign
export async function addCampaignTimelineEvent(
  campaignId: string,
  type: CampaignTimelineEvent["type"],
  title: string,
  description: string,
  userId?: string,
  userName?: string,
): Promise<void> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const campaignRef = doc(db, "campaigns", campaignId)

    const timelineEvent: CampaignTimelineEvent = {
      id: `timeline_${Date.now()}`,
      type,
      title,
      description,
      userId: userId || "system",
      userName: userName || "System",
      timestamp: new Date(),
    }

    await updateDoc(campaignRef, {
      timeline: arrayUnion(timelineEvent),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error adding timeline event:", error)
    throw error
  }
}

// Get combined timeline for campaign (campaign events + proposal activities)
export async function getCampaignTimeline(campaignId: string): Promise<CampaignTimelineEvent[]> {
  try {
    const campaign = await getCampaignById(campaignId)
    if (!campaign) return []

    const campaignEvents = campaign.timeline || []

    // Get proposal activities if proposal exists
    let proposalActivities: CampaignTimelineEvent[] = []
    if (campaign.proposalId) {
      const activities = await getProposalActivities(campaign.proposalId)
      proposalActivities = activities.map((activity) => ({
        id: `proposal_${activity.id}`,
        type: mapProposalActivityToTimelineType(activity.type),
        title: activity.description,
        description: `${activity.description}${activity.location?.city ? ` from ${activity.location.city}` : ""}`,
        userId: activity.performedBy,
        userName: activity.performedByName,
        timestamp: activity.timestamp,
        metadata: {
          source: "proposal_activity",
          ipAddress: activity.ipAddress,
          location: activity.location,
          ...activity.details,
        },
      }))
    }

    // Combine and sort by timestamp
    const allEvents = [...campaignEvents, ...proposalActivities]
    return allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  } catch (error) {
    console.error("Error fetching campaign timeline:", error)
    return []
  }
}

// Helper function to map proposal activity types to campaign timeline types
function mapProposalActivityToTimelineType(activityType: string): CampaignTimelineEvent["type"] {
  switch (activityType) {
    case "created":
      return "proposal_created"
    case "status_changed":
      return "proposal_sent" // This could be more specific based on the new status
    case "viewed":
      return "note_added" // Viewing is like a note/activity
    case "pdf_generated":
      return "note_added"
    case "email_sent":
      return "proposal_sent"
    case "updated":
      return "note_added"
    case "comment_added":
      return "note_added"
    default:
      return "note_added"
  }
}

// Helper function to get timeline event type from status
function getTimelineEventType(status: Campaign["status"]): CampaignTimelineEvent["type"] {
  switch (status) {
    case "proposal_draft":
      return "proposal_draft"
    case "proposal_sent":
      return "proposal_sent"
    case "proposal_accepted":
      return "proposal_accepted"
    case "proposal_declined":
      return "proposal_declined"
    case "cost_estimate_pending":
      return "cost_estimate_pending"
    case "cost_estimate_sent":
      return "cost_estimate_sent"
    case "cost_estimate_approved":
      return "cost_estimate_approved"
    case "cost_estimate_declined":
      return "cost_estimate_declined"
    case "quotation_pending":
      return "quotation_pending"
    case "quotation_sent":
      return "quotation_sent"
    case "quotation_accepted":
      return "quotation_accepted"
    case "quotation_declined":
      return "quotation_declined"
    case "booking_confirmed":
      return "booking_confirmed"
    case "campaign_active":
      return "campaign_started"
    case "campaign_completed":
      return "campaign_completed"
    case "campaign_cancelled":
      return "campaign_cancelled"
    default:
      return "note_added"
  }
}

// Helper function to get status title
function getStatusTitle(status: Campaign["status"]): string {
  switch (status) {
    case "proposal_draft":
      return "Proposal Draft"
    case "proposal_sent":
      return "Proposal Sent"
    case "proposal_accepted":
      return "Proposal Accepted"
    case "proposal_declined":
      return "Proposal Declined"
    case "cost_estimate_pending":
      return "Cost Estimate Pending"
    case "cost_estimate_sent":
      return "Cost Estimate Sent"
    case "cost_estimate_approved":
      return "Cost Estimate Approved"
    case "cost_estimate_declined":
      return "Cost Estimate Declined"
    case "quotation_pending":
      return "Quotation Pending"
    case "quotation_sent":
      return "Quotation Sent"
    case "quotation_accepted":
      return "Quotation Accepted"
    case "quotation_declined":
      return "Quotation Declined"
    case "booking_confirmed":
      return "Booking Confirmed"
    case "campaign_active":
      return "Campaign Active"
    case "campaign_completed":
      return "Campaign Completed"
    case "campaign_cancelled":
      return "Campaign Cancelled"
    default:
      return "Status Updated"
  }
}
