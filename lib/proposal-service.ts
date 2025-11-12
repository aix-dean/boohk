import {
  updateCampaignStatus,
  getCampaignByProposalId,
  createCampaignFromProposal,
  addCampaignTimelineEvent,
} from "@/lib/campaign-service"
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
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  getCountFromServer,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import type { Proposal, ProposalProduct, ProposalClient } from "@/lib/types/proposal"
import { logProposalCreated, logProposalStatusChanged, logProposalEmailSent } from "@/lib/proposal-activity-service"


async function populateCompanyLogo(proposalData: any): Promise<any> {
  let companyLogo = proposalData.companyLogo || ""
  if (!companyLogo && proposalData.companyId) {
    try {
      const companyDoc = await getDoc(doc(db, "companies", proposalData.companyId))
      if (companyDoc.exists()) {
        const companyData = companyDoc.data()
        companyLogo = companyData.photo_url || ""
      }
    } catch (error) {
      console.error("Error fetching company data for logo:", error)
    }
  }
  return { ...proposalData, companyLogo }
}

// Generate an 8-digit password for proposal PDF access
export function generateProposalPassword(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()

}

// Create a new proposal
export async function createProposal(
  title: string,
  client: ProposalClient,
  products: ProposalProduct[],
  userId: string,
  options: {
    notes?: string
    customMessage?: string
    validUntil?: Date
    // Removed sendEmail option
    campaignId?: string // Add optional campaign ID parameter
    companyId?: string // Add optional company ID parameter
    client_company_id?: string // Add client_company_id parameter
    password?: string // Add optional password for public access
    generatePassword?: boolean // Add option to auto-generate password
  } = {},
): Promise<string> {
  try {
    const totalAmount = products.reduce((sum, product) => {
      const price = typeof product.price === "string" ? Number.parseFloat(product.price) : product.price
      return sum + (isNaN(price) ? 0 : price)
    }, 0)

    // Fetch company data if companyId is provided
    let companyName = ""
    let companyLogo = ""
    if (options.companyId) {
      try {
        const companyDoc = await getDoc(doc(db, "companies", options.companyId))
        if (companyDoc.exists()) {
          const companyData = companyDoc.data()
          companyName = companyData.name || ""
          companyLogo = companyData.logo || ""
        }
      } catch (error) {
        console.error("Error fetching company data:", error)
        // Continue with empty company data if fetch fails
      }
    }

    // Clean the client data to ensure no undefined values
    const cleanClient: ProposalClient = {
      id: client.id || "", // Include id field
      company: client.company || "",
      name: client.contactPerson || client.name || "", // Use contactPerson as name
      contactPerson: client.contactPerson || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      industry: client.industry || "",
      targetAudience: client.targetAudience || "",
      campaignObjective: client.campaignObjective || "",
      designation: client.designation || "", // Include designation
      company_id: options.client_company_id || "", // Add client_company_id to client field map
    }

    // Initialize contact info with current user data (will be editable in proposal)
    let contactInfo = {
      heading: "contact us!",
      name: userId, // Default to userId
      role: "Sales",
      phone: "",
      email: "",
    }

    // Try to fetch user data to populate contact info
    try {
      const userDocRef = doc(db, "iboard_users", userId)
      const userDocSnap = await getDoc(userDocRef)
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data()
        contactInfo = {
          heading: "contact us!",
          name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userId,
          role: "Sales", // Default role, can be updated
          phone: userData.phone_number || "",
          email: userData.email || "",
        }
      }
    } catch (error) {
      console.error("Error fetching user data for contact info:", error)
      // Continue with default values
    }

    // Clean the products data to ensure no undefined values
    const cleanProducts: ProposalProduct[] = products.map((product) => ({
      id: product.id,
      ID: product.id, // Document ID of the selected site
      name: product.name || "",
      type: product.type || "",
      price: typeof product.price === "string" ? Number.parseFloat(product.price) || 0 : product.price || 0,
      location: product.location || "",
      site_code: product.site_code || "",
      media: product.media || [],
      specs_rental: product.specs_rental
        ? {
            location: product.specs_rental.location || "",
            traffic_count: product.specs_rental.traffic_count || 0,
            traffic_unit: product.specs_rental.traffic_unit || "",
            elevation: product.specs_rental.elevation || 0,
            elevation_unit: product.specs_rental.elevation_unit || "",
            height: product.specs_rental.height || 0,
            width: product.specs_rental.width || 0,
            dimension_unit: product.specs_rental.dimension_unit || "",
            audience_type: product.specs_rental.audience_type || "",
            audience_types: product.specs_rental.audience_types || [],
            location_visibility: product.specs_rental.location_visibility || 0,
            location_visibility_unit: product.specs_rental.location_visibility_unit || "",
            orientation: product.specs_rental.orientation || "",
            partner: product.specs_rental.partner || "",
            land_owner: product.specs_rental.land_owner || "",
            geopoint: product.specs_rental.geopoint || null,
            illumination: product.specs_rental.illumination || {},
            structure: product.specs_rental.structure || {},
          }
        : null,
      light: product.light
        ? {
            location: product.light.location || "",
            name: product.light.name || "",
            operator: product.light.operator || "",
          }
        : null,
      description: product.description || "",
      health_percentage: product.health_percentage || 0,
      categories: product.categories || [], // Include categories from product
      category_names: product.category_names || [], // Include category names from product
    }))

    // Generate proposal number
    const proposalNumber = `PP${Date.now()}`

    // Handle password generation
    let password = options.password || null
    if (options.generatePassword && !password) {
      password = generateProposalPassword()
    }

    // Initialize field visibility for each product
    const fieldVisibility: { [productId: string]: any } = {}
    cleanProducts.forEach(product => {
      fieldVisibility[product.id] = {
        location: true,
        dimension: true,
        type: true,
        traffic: true,
        location_visibility: true,
        srp: true,
        additionalMessage: true,
      }
    })

    const proposalData = {
      title: title || "",
      proposalNumber: proposalNumber, // Add the new proposal number
      proposalTitle: "Site Proposals", // Add default proposal title
      proposalMessage: "Thank You", // Add default proposal message
      contactInfo: contactInfo, // Add contact info initialized with user data
      fieldVisibility: fieldVisibility, // Initialize field visibility per product
      client: cleanClient,
      products: cleanProducts,
      totalAmount: totalAmount || 0,
      validUntil: options.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      notes: options.notes || "",
      customMessage: options.customMessage || "",
      createdBy: userId,
      companyId: options.companyId || null, // Add company_id to proposal data
      companyName: companyName, // Store company name in proposal
      companyLogo: companyLogo, // Store company logo in proposal
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "draft" as const, // Always set to draft now
      campaignId: options.campaignId || null, // Store campaign ID if provided
      password: password, // Store password for public access
    }

    const docRef = await addDoc(collection(db, "proposals"), proposalData)

    // Create campaign from proposal if no campaign ID was provided
    let campaignId = options.campaignId
    if (!campaignId) {
      try {
        const proposalWithId = {
          id: docRef.id,
          ...proposalData,
          createdAt: new Date(),
          updatedAt: new Date(),
          validUntil: proposalData.validUntil,
        }
        campaignId = await createCampaignFromProposal(proposalWithId as any, userId)

        // Update the proposal with the new campaign ID
        await updateDoc(doc(db, "proposals", docRef.id), {
          campaignId: campaignId,
          updatedAt: serverTimestamp(),
        })
      } catch (campaignError) {
        console.error("Error creating campaign:", campaignError)
        // Don't throw - proposal was created successfully
      }
    }

    try {
      await logProposalCreated(docRef.id, title, userId, "Current User")
    } catch (activityError) {
      console.error("Error logging proposal creation:", activityError)
      // Don't throw - proposal was created successfully
    }

    return docRef.id
  } catch (error) {
    console.error("Error creating proposal:", error)
    throw error
  }
}

// Send proposal email
export async function sendProposalEmail(
  proposal: any,
  clientEmail: string,
  subject?: string, // Added subject parameter
  body?: string, // Added body parameter
  currentUserEmail?: string, // New: current user's email for reply-to
  ccEmail?: string, // New: CC email
): Promise<void> {
  try {
    console.log("Sending proposal email to:", clientEmail)

    const response = await fetch("/api/proposals/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        proposal,
        clientEmail,
        subject, // Pass subject
        body, // Pass body
        currentUserEmail, // Pass current user's email
        ccEmail, // Pass CC email
      }),
    })

    console.log("Email API response status:", response.status)

    // Check if response is ok
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`

      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.details || errorMessage
      } catch (parseError) {
        // If we can't parse the error response, use the status text
        console.error("Failed to parse error response:", parseError)
      }

      throw new Error(errorMessage)
    }

    // Parse successful response
    let result
    try {
      result = await response.json()
    } catch (parseError) {
      console.error("Failed to parse success response:", parseError)
      throw new Error("Email sent but response was invalid")
    }

    if (!result.success) {
      throw new Error(result.error || result.details || "Email sending failed")
    }

    console.log("Email sent successfully:", result)

    try {
      await logProposalEmailSent(proposal.id, clientEmail, proposal.createdBy || "system", "System")
    } catch (activityError) {
      console.error("Error logging email activity:", activityError)
    }
  } catch (error) {
    console.error("Error sending proposal email:", error)
    throw error
  }
}

// Get proposals by user ID
export async function getProposalsByUserId(userId: string): Promise<Proposal[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const proposalsRef = collection(db, "proposals")
    const q = query(proposalsRef, where("createdBy", "==", userId), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    const proposalPromises = querySnapshot.docs.map(async (doc) => {
      const data = doc.data()
      const populatedData = await populateCompanyLogo(data)
      return {
        id: doc.id,
        ...populatedData,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
      } as Proposal
    })

    const proposals = await Promise.all(proposalPromises)
    return proposals
  } catch (error) {
    console.error("Error fetching proposals:", error)
    return []
  }
}

// Get a single proposal by ID
export async function getProposalById(proposalId: string): Promise<Proposal | null> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    console.log("Getting proposal by ID:", proposalId)
    const proposalDoc = await getDoc(doc(db, "proposals", proposalId))

    if (proposalDoc.exists()) {
      const data = proposalDoc.data()
      console.log("Proposal data found:", data.title)

      // Populate companyLogo from company data if missing
      const populatedData = await populateCompanyLogo(data)

      // Convert Firestore timestamps to dates
      const proposal: Proposal = {
        id: proposalDoc.id,
        ...populatedData,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        validUntil: data.validUntil?.toDate() || new Date(),
      } as Proposal

      return proposal
    }

    console.log("Proposal document does not exist")
    return null
  } catch (error) {
    console.error("Error fetching proposal:", error)
    return null
  }
}

// Verify proposal password for public access
export async function verifyProposalPassword(proposalId: string, password: string): Promise<boolean> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const proposalDoc = await getDoc(doc(db, "proposals", proposalId))

    if (proposalDoc.exists()) {
      const data = proposalDoc.data()
      return data.password === password
    }

    return false
  } catch (error) {
    console.error("Error verifying proposal password:", error)
    return false
  }
}

// Update proposal status with optional custom user info for public viewers
export async function updateProposalStatus(
  proposalId: string,
  status: Proposal["status"],
  customUserId?: string,
  customUserName?: string,
): Promise<void> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    // Before updating the status, get the current proposal to log the old status
    const currentProposal = await getProposalById(proposalId)
    const oldStatus = currentProposal?.status || "unknown"

    const proposalRef = doc(db, "proposals", proposalId)
    await updateDoc(proposalRef, {
      status,
      updatedAt: serverTimestamp(),
    })

    // Update campaign status and add timeline event
    try {
      const campaign = await getCampaignByProposalId(proposalId)
      if (campaign) {
        let campaignStatus: any
        let timelineTitle = ""
        let timelineDescription = ""

        switch (status) {
          case "sent":
            campaignStatus = "proposal_sent"
            timelineTitle = "Proposal Sent"
            timelineDescription = `Proposal "${currentProposal?.title}" was sent to client`
            break
          case "accepted":
            campaignStatus = "proposal_accepted"
            timelineTitle = "Proposal Accepted"
            timelineDescription = `Proposal "${currentProposal?.title}" was accepted by ${currentProposal?.client?.contactPerson || "client"}`
            break
          case "declined":
            campaignStatus = "proposal_declined"
            timelineTitle = "Proposal Declined"
            timelineDescription = `Proposal "${currentProposal?.title}" was declined by ${currentProposal?.client?.contactPerson || "client"}`
            break
          default:
            campaignStatus = "proposal_draft"
            timelineTitle = "Proposal Updated"
            timelineDescription = `Proposal "${currentProposal?.title}" status changed to ${status}`
        }

        // Update campaign status
        await updateCampaignStatus(campaign.id, campaignStatus, customUserId || "system", customUserName || "System")

        // Add timeline event
        await addCampaignTimelineEvent(
          campaign.id,
          status === "accepted" ? "proposal_accepted" : status === "declined" ? "proposal_declined" : "proposal_sent",
          timelineTitle,
          timelineDescription,
          customUserId || "system",
          customUserName || "System",
        )
      }
    } catch (campaignError) {
      console.error("Error updating campaign status:", campaignError)
      // Don't throw - proposal status was updated successfully
    }

    try {
      // Use custom user info if provided (for public viewers), otherwise use default
      const userId = customUserId || "current_user"
      const userName = customUserName || "Current User"

      // If it's a public viewer accepting, use the client information
      if (customUserId === "public_viewer" && currentProposal) {
        const clientName = `${currentProposal.client.contactPerson} (${currentProposal.client.company})`
        await logProposalStatusChanged(proposalId, oldStatus, status, customUserId, clientName)
      } else {
        await logProposalStatusChanged(proposalId, oldStatus, status, userId, userName)
      }
    } catch (activityError) {
      console.error("Error logging status change:", activityError)
    }
  } catch (error) {
    console.error("Error updating proposal status:", error)
    throw error
  }
}

// Implement the updateProposal function
export async function updateProposal(
  proposalId: string,
  data: Partial<Proposal>,
  userId: string,
  userName: string,
): Promise<void> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    console.log("[v0] Updating proposal with data:", data) // Added debug logging

    const proposalRef = doc(db, "proposals", proposalId)

    // Prepare data for Firestore update, handling nested objects
    const updateData: { [key: string]: any } = {
      updatedAt: serverTimestamp(),
    }

    if (data.title !== undefined) updateData.title = data.title
    if (data.proposalTitle !== undefined) updateData.proposalTitle = data.proposalTitle
    if (data.proposalMessage !== undefined) updateData.proposalMessage = data.proposalMessage
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.customMessage !== undefined) updateData.customMessage = data.customMessage
    if (data.proposalNumber !== undefined) updateData.proposalNumber = data.proposalNumber // Add update for proposalNumber
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount
    if (data.preparedByName !== undefined) updateData.preparedByName = data.preparedByName
    if (data.preparedByCompany !== undefined) updateData.preparedByCompany = data.preparedByCompany
    if (data.companyName !== undefined) updateData.companyName = data.companyName
    if (data.companyLogo !== undefined) updateData.companyLogo = data.companyLogo
    if (data.logoWidth !== undefined) updateData.logoWidth = data.logoWidth
    if (data.logoHeight !== undefined) updateData.logoHeight = data.logoHeight
    if (data.logoLeft !== undefined) updateData.logoLeft = data.logoLeft
    if (data.logoTop !== undefined) updateData.logoTop = data.logoTop

    if (data.templateSize !== undefined) updateData.templateSize = data.templateSize
    if (data.templateOrientation !== undefined) updateData.templateOrientation = data.templateOrientation
    if (data.templateLayout !== undefined) updateData.templateLayout = data.templateLayout
    if (data.templateBackground !== undefined) updateData.templateBackground = data.templateBackground
    if (data.password !== undefined) updateData.password = data.password

    if (data.pdf !== undefined) updateData.pdf = data.pdf
    if (data.password !== undefined) updateData.password = data.password
    if (data.customPages !== undefined) updateData.customPages = data.customPages
    if (data.contactInfo !== undefined) updateData.contactInfo = data.contactInfo
    if (data.fieldVisibility !== undefined) updateData.fieldVisibility = data.fieldVisibility

    if (data.products !== undefined) {
      updateData.products = data.products
      // Recalculate total amount when products are updated
      const totalAmount = data.products.reduce((sum, product) => {
        const price = typeof product.price === "string" ? Number.parseFloat(product.price) : product.price
        return sum + (isNaN(price) ? 0 : price)
      }, 0)
      updateData.totalAmount = totalAmount
    }

    // Handle client object updates
    if (data.client) {
      if (data.client.company !== undefined) updateData["client.company"] = data.client.company
      if (data.client.contactPerson !== undefined) updateData["client.contactPerson"] = data.client.contactPerson
      if (data.client.email !== undefined) updateData["client.email"] = data.client.email
      if (data.client.phone !== undefined) updateData["client.phone"] = data.client.phone
      if (data.client.address !== undefined) updateData["client.address"] = data.client.address
      if (data.client.industry !== undefined) updateData["client.industry"] = data.client.industry
      if (data.client.targetAudience !== undefined) updateData["client.targetAudience"] = data.client.targetAudience
      if (data.client.campaignObjective !== undefined)
        updateData["client.campaignObjective"] = data.client.campaignObjective
      if (data.client.company_id !== undefined) updateData["client.company_id"] = data.client.company_id // Add client_company_id to updateData
    }

    console.log("[v0] Final update data being sent to Firestore:", updateData) // Added debug logging

    await updateDoc(proposalRef, updateData)

    console.log("[v0] Firestore update completed successfully") // Added debug logging

    // Log the activity
    await logProposalStatusChanged(proposalId, "updated", "updated", userId, userName) // Re-using status change log for general update
    console.log(`Proposal ${proposalId} updated by ${userName}`)
  } catch (error) {
    console.error("[v0] Error updating proposal:", error) // Added debug prefix
    throw error
  }
}

// Generate PDF data for proposal
export function generateProposalPDFData(proposal: Proposal) {
  return {
    title: proposal.title,
    proposalNumber: proposal.proposalNumber, // Include proposal number in PDF data
    client: proposal.client,
    products: proposal.products.map((product) => ({
      name: product.name,
      type: product.type,
      location: product.location,
      price: typeof product.price === "string" ? Number.parseFloat(product.price) : product.price,
      siteCode: product.site_code,
      description: product.description,
      specs: product.specs_rental
        ? {
            trafficCount: product.specs_rental.traffic_count,
            dimensions:
              product.specs_rental.height && product.specs_rental.width
                ? `${product.specs_rental.height}m x ${product.specs_rental.width}m`
                : undefined,
            audienceType: product.specs_rental.audience_type,
          }
        : undefined,
    })),
    totalAmount: proposal.totalAmount,
    validUntil: proposal.validUntil,
    notes: proposal.notes,
    customMessage: proposal.customMessage,
    createdAt: proposal.createdAt,
  }
}

export async function getProposal(id: string) {
  // Implementation for getting a proposal
  console.log("Getting proposal:", id)
  return await getProposalById(id)
}

// Removed the old placeholder updateProposal
// export async function updateProposal(id: string, data: any, userId: string, userName: string) {
//   // Implementation for updating a proposal
//   console.log("Updating proposal:", id, data, userId, userName)
//   return { id: id, ...data }
// }

export async function deleteProposal(id: string, userId: string, userName: string) {
  // Implementation for deleting a proposal
  console.log("Deleting proposal:", id, userId, userName)
  return { id: id }
}

export async function getPaginatedProposals(
  itemsPerPage: number,
  lastDoc: any | null,
  searchTerm = "",
  statusFilter: string | null = null,
): Promise<{ items: Proposal[]; lastDoc: any | null; hasMore: boolean }> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    let q = query(collection(db, "proposals"), orderBy("createdAt", "desc"))

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      // This is a basic search. For more advanced full-text search, consider Algolia or a similar service.
      // Firestore doesn't support full-text search directly or OR queries across multiple fields easily.
      // For now, we'll filter after fetching, which might be inefficient for large datasets.
      // A more robust solution would involve a dedicated search index.
    }

    if (statusFilter && statusFilter !== "all") {
      q = query(q, where("status", "==", statusFilter))
    }

    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    q = query(q, limit(itemsPerPage + 1)) // Fetch one more to check if there are more items

    const querySnapshot = await getDocs(q)
    const proposalPromises = querySnapshot.docs.map(async (doc) => {
      const data = doc.data()
      const populatedData = await populateCompanyLogo(data)
      return {
        id: doc.id,
        ...populatedData,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
      } as Proposal
    })
    const proposals = await Promise.all(proposalPromises)

    let filteredItems = proposals
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filteredItems = proposals.filter(
        (proposal) =>
          (statusFilter === "all" || !statusFilter || proposal.status === statusFilter) &&
          (proposal.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            proposal.client.company.toLowerCase().includes(lowerCaseSearchTerm) ||
            proposal.client.contactPerson.toLowerCase().includes(lowerCaseSearchTerm) ||
            (proposal.proposalNumber && proposal.proposalNumber.toLowerCase().includes(lowerCaseSearchTerm))), // Include proposalNumber in search
      )
    }

    const hasMore = filteredItems.length > itemsPerPage
    const itemsToReturn = filteredItems.slice(0, itemsPerPage)
    const newLastDoc = querySnapshot.docs[itemsToReturn.length] || null

    return { items: itemsToReturn, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error("Error fetching paginated proposals:", error)
    return { items: [], lastDoc: null, hasMore: false }
  }
}

export async function getPaginatedProposalsByUserId(
  userId: string,
  itemsPerPage: number,
  lastDoc: any | null,
  searchTerm = "",
  statusFilter: string | null = null,
): Promise<{ items: Proposal[]; lastDoc: any | null; hasMore: boolean }> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    let q = query(collection(db, "proposals"), where("companyId", "==", userId), orderBy("createdAt", "desc"))

    if (statusFilter && statusFilter !== "all") {
      q = query(q, where("status", "==", statusFilter))
    }

    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    q = query(q, limit(itemsPerPage + 1)) // Fetch one more to check if there are more items

    const querySnapshot = await getDocs(q)
    const proposalPromises = querySnapshot.docs.map(async (doc) => {
      const data = doc.data()
      const populatedData = await populateCompanyLogo(data)
      return {
        id: doc.id,
        ...populatedData,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
      } as Proposal
    })
    const proposals = await Promise.all(proposalPromises)

    let filteredItems = proposals
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filteredItems = proposals.filter(
        (proposal) =>
          proposal.title.toLowerCase().includes(lowerCaseSearchTerm) ||
          proposal.client.company.toLowerCase().includes(lowerCaseSearchTerm) ||
          proposal.client.contactPerson.toLowerCase().includes(lowerCaseSearchTerm) ||
          (proposal.proposalNumber && proposal.proposalNumber.toLowerCase().includes(lowerCaseSearchTerm)),
      )
    }

    const hasMore = filteredItems.length > itemsPerPage
    const itemsToReturn = filteredItems.slice(0, itemsPerPage)
    const newLastDoc = querySnapshot.docs[itemsToReturn.length] || null

    return { items: itemsToReturn, lastDoc: newLastDoc, hasMore }
  } catch (error) {
    console.error("Error fetching paginated proposals by user:", error)
    return { items: [], lastDoc: null, hasMore: false }
  }
}

export async function getProposalsCountByUserId(
  userId: string,
  searchTerm = "",
  statusFilter: string | null = null,
): Promise<number> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    let q = query(collection(db, "proposals"), where("createdBy", "==", userId))

    if (statusFilter && statusFilter !== "all") {
      q = query(q, where("status", "==", statusFilter))
    }

    // If there's a search term, we need to fetch all and filter client-side
    if (searchTerm) {
      const allProposalsSnapshot = await getDocs(q)
      const allProposals: Proposal[] = []
      allProposalsSnapshot.forEach((doc) => {
        const data = doc.data()
        allProposals.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
        } as Proposal)
      })

      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      const filteredProposals = allProposals.filter(
        (proposal) =>
          proposal.title.toLowerCase().includes(lowerCaseSearchTerm) ||
          proposal.client.company.toLowerCase().includes(lowerCaseSearchTerm) ||
          proposal.client.contactPerson.toLowerCase().includes(lowerCaseSearchTerm) ||
          (proposal.proposalNumber && proposal.proposalNumber.toLowerCase().includes(lowerCaseSearchTerm)),
      )
      return filteredProposals.length
    }

    const snapshot = await getCountFromServer(q)
    return snapshot.data().count
  } catch (error) {
    console.error("Error getting proposals count by user:", error)
    return 0
  }
}

export async function getProposalsCount(searchTerm = "", statusFilter: string | null = null): Promise<number> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const q = collection(db, "proposals")
    let countQuery = query(q)

    if (statusFilter && statusFilter !== "all") {
      countQuery = query(countQuery, where("status", "==", statusFilter))
    }

    const snapshot = await getCountFromServer(countQuery)
    let count = snapshot.data().count

    // If there's a search term, we need to fetch all (or a large subset) and filter client-side
    // as Firestore count queries don't support complex string matching.
    if (searchTerm) {
      const allProposalsQuery = query(collection(db, "proposals"), orderBy("createdAt", "desc"))
      const allProposalsSnapshot = await getDocs(allProposalsQuery)
      const allProposals: Proposal[] = []
      allProposalsSnapshot.forEach((doc) => {
        const data = doc.data()
        allProposals.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
        } as Proposal)
      })

      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      const filteredProposals = allProposals.filter(
        (proposal) =>
          (statusFilter === "all" || !statusFilter || proposal.status === statusFilter) &&
          (proposal.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            proposal.client.company.toLowerCase().includes(lowerCaseSearchTerm) ||
            proposal.client.contactPerson.toLowerCase().includes(lowerCaseSearchTerm) ||
            (proposal.proposalNumber && proposal.proposalNumber.toLowerCase().includes(lowerCaseSearchTerm))), // Include proposalNumber in count search
      )
      count = filteredProposals.length
    }

    return count
  } catch (error) {
    console.error("Error getting proposals count:", error)
    return 0
  }
}

// Helper function to wait for all images to load in a document
function waitForImagesToLoad(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    const images = doc.querySelectorAll('img')
    let loadedCount = 0
    const totalImages = images.length

    if (totalImages === 0) {
      resolve()
      return
    }

    const checkComplete = () => {
      loadedCount++
      if (loadedCount === totalImages) {
        resolve()
      }
    }

    images.forEach((img) => {
      if (img.complete) {
        checkComplete()
      } else {
        img.addEventListener('load', checkComplete)
        img.addEventListener('error', checkComplete) // Consider failed images as loaded to avoid hanging
      }
    })
  })
}

// Client-side PDF generation using html2canvas
export async function downloadProposalPDF(
  proposal: Proposal,
  selectedSize: string,
  selectedOrientation: string,
  toast: (options: any) => void
): Promise<void> {
  try {
    // Dynamic imports for client-side libraries
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')

    toast({
      title: "Download",
      description: "Generating PDF...",
    })

    // Find all page containers
    const pageContainers = document.querySelectorAll('[class*="mx-auto bg-white shadow-lg"]')

    if (pageContainers.length === 0) {
      throw new Error("No proposal pages found")
    }

    // Hardcoded to landscape orientation for all paper sizes
    let pdfWidth = 297 // A4 landscape width in mm
    let pdfHeight = 210 // A4 landscape height in mm

    switch (selectedSize) {
      case "A4":
        pdfWidth = 297
        pdfHeight = 210
        break
      case "Letter size":
        pdfWidth = 279.4
        pdfHeight = 215.9
        break
      case "Legal size":
        pdfWidth = 355.6
        pdfHeight = 215.9
        break
      default:
        pdfWidth = 297
        pdfHeight = 210
    }

    console.log(`Creating PDF with dimensions: ${pdfWidth}mm x ${pdfHeight}mm (Landscape)`)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: "mm",
      format: [pdfWidth, pdfHeight]
    })
    console.log(`PDF page size: ${pdf.internal.pageSize.getWidth()}mm x ${pdf.internal.pageSize.getHeight()}mm`)

    for (let i = 0; i < pageContainers.length; i++) {
      const container = pageContainers[i] as HTMLElement

      // Capture the page with html2canvas at natural size
      const canvas = await html2canvas(container, {
        scale: 3, // Higher quality
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000 + (proposal.products.length * 2000), // Dynamic timeout based on product count for static map images
        logging: false,
        onclone: async (clonedDoc) => {
          // Wait for all images to load in the cloned document
          await waitForImagesToLoad(clonedDoc)
        },
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.7)

      // Add the captured image to fill the entire PDF page
      // The canvas is already scaled to match PDF dimensions
      if (i > 0) {
        pdf.addPage()
      }

      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
    }

    // Save the PDF
    pdf.save(`OH_PROP_${proposal.id}_${proposal.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`)

    toast({
      title: "Success",
      description: "PDF downloaded successfully",
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    toast({
      title: "Error",
      description: "Failed to generate PDF. Please try again.",
      variant: "destructive",
    })
  }
}

export async function generateProposalPDFBlob(
  proposal: Proposal,
  selectedSize: string,
  selectedOrientation: string
): Promise<{ blob: Blob; filename: string }> {
  // Dynamic imports for client-side libraries
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')

  // Find all page containers
  const pageContainers = document.querySelectorAll('[class*="mx-auto bg-white shadow-lg"]')

  if (pageContainers.length === 0) {
    throw new Error("No proposal pages found")
  }

  // Hardcoded to landscape orientation for all paper sizes
  let pdfWidth = 297 // A4 landscape width in mm
  let pdfHeight = 210 // A4 landscape height in mm

  switch (selectedSize) {
    case "A4":
      pdfWidth = 297
      pdfHeight = 210
      break
    case "Letter size":
      pdfWidth = 279.4
      pdfHeight = 215.9
      break
    case "Legal size":
      pdfWidth = 355.6
      pdfHeight = 215.9
      break
    default:
      pdfWidth = 297
      pdfHeight = 210
  }

  console.log(`Creating PDF blob with dimensions: ${pdfWidth}mm x ${pdfHeight}mm (Landscape)`)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: "mm",
    format: [pdfWidth, pdfHeight]
  })
  console.log(`PDF blob page size: ${pdf.internal.pageSize.getWidth()}mm x ${pdf.internal.pageSize.getHeight()}mm`)

  for (let i = 0; i < pageContainers.length; i++) {
    const container = pageContainers[i] as HTMLElement

    // Capture the page with html2canvas at natural size
    const canvas = await html2canvas(container, {
      scale: 3, // Higher quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      imageTimeout: 15000 + (proposal.products.length * 2000), // Dynamic timeout based on product count for static map images
      logging: false,
      onclone: async (clonedDoc) => {
        // Wait for all images to load in the cloned document
        await waitForImagesToLoad(clonedDoc)
      },
    })

      const imgData = canvas.toDataURL('image/jpeg', 0.7)

      // Add the captured image to fill the entire PDF page
      // The canvas is already scaled to match PDF dimensions
      if (i > 0) {
        pdf.addPage()
      }

      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
  }

  // Generate blob instead of saving
  const pdfBlob = pdf.output('blob')
  const filename = `OH_PROP_${proposal.id}_${proposal.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`

  return { blob: pdfBlob, filename }
}

// Generate PDF and upload to Firebase storage with password protection
export async function generateAndUploadProposalPDF(
  proposal: Proposal,
  selectedSize: string = "A4",
  selectedOrientation: string = "Landscape"
): Promise<{ pdfUrl: string; password: string }> {
  try {
    // Generate the PDF blob
    const { blob } = await generateProposalPDFBlob(proposal, selectedSize, selectedOrientation)

    // Generate password
    const password = generateProposalPassword()

    // Create a unique filename
    const timestamp = Date.now()
    const filename = `proposal_${proposal.id}_${timestamp}.pdf`

    // Convert blob to File object for upload
    const pdfFile = new File([blob], filename, { type: 'application/pdf' })

    // Upload to Firebase storage
    const uploadPath = `proposals/pdfs/${filename}`
    const pdfUrl = await uploadFileToFirebaseStorage(pdfFile, uploadPath)

    return { pdfUrl, password }
  } catch (error) {
    console.error("Error generating and uploading proposal PDF:", error)
    throw error
  }
}

// Get sent emails for a proposal, cost estimate, or quotation
export async function getSentEmailsForProposal(proposalId: string, emailType: "proposal" | "cost_estimate" | "quotation" = "proposal"): Promise<any[]> {
  try {
    if (!db) {
      throw new Error("Firestore not initialized")
    }

    const emailsRef = collection(db, "emails")
    let idField: string
    if (emailType === "quotation") {
      idField = "quotationId"
    } else if (emailType === "cost_estimate") {
      idField = "costEstimateId"
    } else {
      idField = "proposalId"
    }

    const q = query(
      emailsRef,
      where(idField, "==", proposalId),
      where("email_type", "==", emailType),
      where("status", "==", "sent"),
      orderBy("sentAt", "desc")
    )

    const querySnapshot = await getDocs(q)
    const emails: any[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      emails.push({
        id: doc.id,
        ...data,
        sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toDate() : new Date(data.sentAt),
        created: data.created instanceof Timestamp ? data.created.toDate() : new Date(data.created),
        updated: data.updated instanceof Timestamp ? data.updated.toDate() : new Date(data.updated),
      })
    })

    return emails
  } catch (error) {
    console.error("Error fetching sent emails for proposal:", error)
    return []
  }
}

