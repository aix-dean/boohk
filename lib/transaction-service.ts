import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
} from "firebase/firestore"
import type { Transaction } from 'oh-db-models'

// Algolia client for indexing
let algoliasearch: any = null
let transactionsIndex: any = null

// Initialize Algolia client
function initializeAlgolia() {
  if (typeof window === 'undefined') {
    // Server-side
    try {
      algoliasearch = require('algoliasearch')
      const client = algoliasearch(
        process.env.NEXT_PUBLIC_ALGOLIA_APP_ID,
        process.env.ALGOLIA_ADMIN_API_KEY
      )
      transactionsIndex = client.initIndex('transactions')
    } catch (error) {
      console.warn('Algolia client not available:', error)
    }
  }
}

// Index transaction in Algolia
async function indexTransaction(transaction: Transaction) {
  if (!transactionsIndex) {
    initializeAlgolia()
  }

  if (!transactionsIndex) {
    console.warn('Algolia index not available, skipping indexing')
    return
  }

  try {
    const algoliaObject = {
      objectID: transaction.id,
      id: transaction.id,
      'client.name': transaction.client?.name || '',
      merchantName: transaction.merchantName,
      status: transaction.status,
      amount: transaction.amount,
      date: transaction.createdAt?.toISOString() || '',
      description: transaction.description,
      companyId: transaction.companyId,
      createdAt: transaction.createdAt?.toISOString() || '',
    }

    await transactionsIndex.saveObject(algoliaObject)
    console.log('Transaction indexed in Algolia:', transaction.id)
  } catch (error) {
    console.error('Error indexing transaction in Algolia:', error)
  }
}

// Remove transaction from Algolia index
async function removeTransactionFromIndex(transactionId: string) {
  if (!transactionsIndex) {
    initializeAlgolia()
  }

  if (!transactionsIndex) {
    console.warn('Algolia index not available, skipping removal')
    return
  }

  try {
    await transactionsIndex.deleteObject(transactionId)
    console.log('Transaction removed from Algolia index:', transactionId)
  } catch (error) {
    console.error('Error removing transaction from Algolia index:', error)
  }
}

const TRANSACTIONS_COLLECTION = "transactions"

// Helper function to safely convert to Date
function safeToDate(dateValue: any): Date | null {
  if (!dateValue) return null
  if (dateValue instanceof Date) return dateValue
  if (dateValue.toDate && typeof dateValue.toDate === "function") return dateValue.toDate()
  return new Date(dateValue)
}

// Get all transactions
export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    const q = query(collection(db, TRANSACTIONS_COLLECTION), orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data
      } as Transaction
    })
  } catch (error) {
    console.error("Error getting all transactions:", error)
    throw new Error("Failed to retrieve all transactions.")
  }
}

// Create a new transaction
export async function createTransaction(transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const newTransactionRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), {
      ...transactionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Index the transaction in Algolia
    const transaction = {
      id: newTransactionRef.id,
      ...transactionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Transaction

    // Index asynchronously (don't await to avoid blocking)
    indexTransaction(transaction)

    return newTransactionRef.id
  } catch (error) {
    console.error("Error creating transaction:", error)
    throw new Error("Failed to create transaction.")
  }
}

// Update transaction
export async function updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
  try {
    // Exclude createdAt from updates to prevent it from being modified
    const { createdAt, ...allowedUpdates } = updates

    const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId)
    await updateDoc(transactionRef, {
      ...allowedUpdates,
      updatedAt: serverTimestamp(),
    })

    // Re-index the updated transaction in Algolia
    try {
      const updatedDoc = await getDoc(transactionRef)
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data()
        const updatedTransaction = {
          id: transactionId,
          ...updatedData,
          createdAt: safeToDate(updatedData.createdAt),
          updatedAt: new Date(),
        } as Transaction

        // Re-index asynchronously
        indexTransaction(updatedTransaction)
      }
    } catch (indexError) {
      console.error('Error re-indexing updated transaction:', indexError)
    }
  } catch (error) {
    console.error("Error updating transaction:", error)
    throw error
  }
}

// Delete transaction
export async function deleteTransaction(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, id))

    // Remove from Algolia index
    removeTransactionFromIndex(id)
  } catch (error) {
    console.error("Error deleting transaction:", error)
    throw new Error("Failed to delete transaction.")
  }
}

// Get transactions by company ID
export async function getTransactionsByCompanyId(companyId: string, limitCount: number = 50): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data
      } as Transaction
    })
  } catch (error) {
    console.error("Error fetching transactions by company ID:", error)
    return []
  }
}

// Get paginated transactions by company ID
export async function getPaginatedTransactionsByCompanyId(
  companyId: string,
  limitCount: number,
  lastDocId: string | null = null,
): Promise<{ items: Transaction[]; lastVisible: string | null; hasMore: boolean }> {
  try {
    let q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(limitCount + 1) // Fetch one extra to check if there are more pages
    )

    if (lastDocId) {
      const lastDoc = await getDoc(doc(db, TRANSACTIONS_COLLECTION, lastDocId))
      if (lastDoc.exists()) {
        q = query(q, startAfter(lastDoc))
      }
    }

    const querySnapshot = await getDocs(q)
    const items: Transaction[] = querySnapshot.docs.slice(0, limitCount).map((docSnap) => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data
      } as Transaction
    })

    const hasMore = querySnapshot.docs.length > limitCount
    const lastVisibleDoc = querySnapshot.docs[limitCount - 1]
    const newLastDocId = lastVisibleDoc ? lastVisibleDoc.id : null

    return { items, lastVisible: newLastDocId, hasMore }
  } catch (error) {
    console.error("Error fetching paginated transactions by company ID:", error)
    return { items: [], lastVisible: null, hasMore: false }
  }
}