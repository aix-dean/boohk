import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ProposalActivity } from "@/lib/types/proposal-activity"
import { getClientLocation } from "@/lib/location-service"
import { addCampaignTimelineEvent, getCampaignByProposalId } from "@/lib/campaign-service"

// Log a new activity for a proposal with location tracking
export async function logProposalActivity(
  proposalId: string,
  type: ProposalActivity["type"],
  description: string,
  performedBy: string,
  performedByName: string,
  details?: ProposalActivity["details"],
  metadata?: Record<string, any>,
  ipAddress?: string,
  location?: ProposalActivity["location"],
): Promise<string> {
  try {
    const activityData = {
      proposalId,
      type,
      description,
      details: details || {},
      performedBy,
      performedByName,
      timestamp: serverTimestamp(),
      ipAddress: ipAddress || "unknown",
      location: location || {},
      metadata: metadata || {},
    }

    const docRef = await addDoc(collection(db, "proposal_activities"), activityData)

    // Also log to campaign timeline if campaign exists
    try {
      const campaign = await getCampaignByProposalId(proposalId)
      if (campaign) {
        await addCampaignTimelineEvent(
          campaign.id,
          mapActivityTypeToCampaignType(type),
          description,
          `${description}${location?.city ? ` from ${location.city}` : ""}`,
          performedBy,
          performedByName,
        )
      }
    } catch (error) {
      console.error("Error logging to campaign timeline:", error)
      // Don't throw here as proposal activity was logged successfully
    }

    return docRef.id
  } catch (error) {
    console.error("Error logging proposal activity:", error)
    throw error
  }
}

// Enhanced logging function that automatically gets location data
export async function logProposalActivityWithLocation(
  proposalId: string,
  type: ProposalActivity["type"],
  description: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
  details?: ProposalActivity["details"],
  metadata?: Record<string, any>,
): Promise<string> {
  let ipAddress = "unknown"
  let location = {}

  try {
    if (request) {
      // Server-side: get IP from request headers
      const { getClientIP, getLocationFromIP } = await import("@/lib/location-service")
      ipAddress = getClientIP(request)
      location = await getLocationFromIP(ipAddress)
    } else if (typeof window !== "undefined") {
      // Client-side: get location from browser
      location = await getClientLocation()
      // Try to get IP from a service
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json")
        const ipData = await ipResponse.json()
        ipAddress = ipData.ip || "unknown"
      } catch (error) {
        console.error("Error getting client IP:", error)
      }
    }
  } catch (error) {
    console.error("Error getting location data:", error)
  }

  return logProposalActivity(
    proposalId,
    type,
    description,
    performedBy,
    performedByName,
    details,
    metadata,
    ipAddress,
    location,
  )
}

// Get all activities for a proposal
export async function getProposalActivities(proposalId: string): Promise<ProposalActivity[]> {
  try {
    const activitiesRef = collection(db, "proposal_activities")
    const q = query(activitiesRef, where("proposalId", "==", proposalId), orderBy("timestamp", "desc"))

    const querySnapshot = await getDocs(q)
    const activities: ProposalActivity[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      activities.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
      } as ProposalActivity)
    })

    return activities
  } catch (error) {
    console.error("Error fetching proposal activities:", error)
    return []
  }
}

// Helper functions for common activities with location tracking
export async function logProposalCreated(
  proposalId: string,
  proposalTitle: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "created",
    `Proposal "${proposalTitle}" was created`,
    performedBy,
    performedByName,
    request,
  )
}

export async function logProposalStatusChanged(
  proposalId: string,
  oldStatus: string,
  newStatus: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "status_changed",
    `Status changed from "${oldStatus}" to "${newStatus}"`,
    performedBy,
    performedByName,
    request,
    { oldStatus, newStatus },
  )
}

export async function logProposalEmailSent(
  proposalId: string,
  emailRecipient: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "email_sent",
    `Proposal sent via email to ${emailRecipient}`,
    performedBy,
    performedByName,
    request,
    { emailRecipient },
  )
}

export async function logProposalViewed(
  proposalId: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "viewed",
    `Proposal was viewed`,
    performedBy,
    performedByName,
    request,
  )
}

export async function logProposalPDFGenerated(
  proposalId: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "pdf_generated",
    `PDF was generated and downloaded`,
    performedBy,
    performedByName,
    request,
  )
}

export async function logProposalUpdated(
  proposalId: string,
  updatedFields: string[],
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "updated",
    `Proposal was updated (${updatedFields.join(", ")})`,
    performedBy,
    performedByName,
    request,
    { updatedFields },
  )
}

export async function logProposalComment(
  proposalId: string,
  comment: string,
  performedBy: string,
  performedByName: string,
  request?: Request,
): Promise<void> {
  await logProposalActivityWithLocation(
    proposalId,
    "comment_added",
    `Comment added: "${comment.substring(0, 50)}${comment.length > 50 ? "..." : ""}"`,
    performedBy,
    performedByName,
    request,
    { comment },
  )
}

// Helper function to map activity types
function mapActivityTypeToCampaignType(activityType: string): any {
  switch (activityType) {
    case "created":
      return "proposal_created"
    case "status_changed":
      return "proposal_sent"
    case "email_sent":
      return "proposal_sent"
    case "viewed":
      return "note_added"
    case "pdf_generated":
      return "note_added"
    case "updated":
      return "note_added"
    case "comment_added":
      return "note_added"
    default:
      return "note_added"
  }
}
