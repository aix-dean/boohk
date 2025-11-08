import { doc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface CollectibleStatus {
  id: string
  status: "pending" | "collected" | "overdue" | "paid"
  total_amount: number
}

/**
 * Updates quotation collection status based on associated collectibles
 * @param quotationId - The ID of the quotation to update
 */
export async function updateQuotationCollectionStatus(quotationId: string): Promise<void> {
  try {
    // Get all collectibles associated with this quotation
    const collectiblesRef = collection(db, "collectibles")
    const q = query(collectiblesRef, where("quotation_id", "==", quotationId), where("deleted", "==", false))

    const querySnapshot = await getDocs(q)
    const collectibles: CollectibleStatus[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      collectibles.push({
        id: doc.id,
        status: data.status || "pending",
        total_amount: data.total_amount || 0,
      })
    })

    // If no collectibles found, don't update quotation
    if (collectibles.length === 0) {
      return
    }

    // Calculate collection status based on collectibles
    const collectionStatus = calculateCollectionStatus(collectibles)

    // Update the quotation with the new collection status
    const quotationRef = doc(db, "quotations", quotationId)
    await updateDoc(quotationRef, {
      collection_status: collectionStatus.status,
      collection_progress: collectionStatus.progress,
      total_collected_amount: collectionStatus.totalCollected,
      total_pending_amount: collectionStatus.totalPending,
      updated: serverTimestamp(),
    })

    console.log(`Updated quotation ${quotationId} collection status to: ${collectionStatus.status}`)
  } catch (error) {
    console.error("Error updating quotation collection status:", error)
    throw error
  }
}

/**
 * Calculates the overall collection status based on collectibles
 */
function calculateCollectionStatus(collectibles: CollectibleStatus[]) {
  const totalCollectibles = collectibles.length
  const paidCollectibles = collectibles.filter((c) => c.status === "paid").length
  const collectedCollectibles = collectibles.filter((c) => c.status === "collected").length
  const overdueCollectibles = collectibles.filter((c) => c.status === "overdue").length

  const totalCollected = collectibles
    .filter((c) => c.status === "paid" || c.status === "collected")
    .reduce((sum, c) => sum + c.total_amount, 0)

  const totalPending = collectibles
    .filter((c) => c.status === "pending" || c.status === "overdue")
    .reduce((sum, c) => sum + c.total_amount, 0)

  const progress = Math.round(((paidCollectibles + collectedCollectibles) / totalCollectibles) * 100)

  // Determine overall status
  let status: string
  if (paidCollectibles === totalCollectibles) {
    status = "fully_paid"
  } else if (paidCollectibles + collectedCollectibles === totalCollectibles) {
    status = "fully_collected"
  } else if (overdueCollectibles > 0) {
    status = "partially_overdue"
  } else if (paidCollectibles > 0 || collectedCollectibles > 0) {
    status = "partially_collected"
  } else {
    status = "pending_collection"
  }

  return {
    status,
    progress,
    totalCollected,
    totalPending,
  }
}

/**
 * Updates quotation collection status when a collectible is modified
 * This function should be called after any collectible CRUD operation
 */
export async function syncQuotationCollectionStatus(collectibleId: string): Promise<void> {
  try {
    // Get the collectible to find its quotation_id
    const collectibleDoc = await getDoc(doc(db, "collectibles", collectibleId))

    if (!collectibleDoc.exists()) {
      return
    }

    const collectibleData = collectibleDoc.data()
    const quotationId = collectibleData.quotation_id

    // Only update if this collectible is associated with a quotation
    if (quotationId) {
      await updateQuotationCollectionStatus(quotationId)
    }
  } catch (error) {
    console.error("Error syncing quotation collection status:", error)
    // Don't throw error to avoid breaking the main collectible operation
  }
}
