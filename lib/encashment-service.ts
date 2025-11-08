import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface PettyCashSettings {
  id?: string
  companyName: string
  pettyCashFundReplenishment: string
  cutOffPeriod: string
  pettyCashFundName: string
  pettyCashFundAmount: number
  created?: Timestamp
  updated?: Timestamp
}

export interface PettyCashRow {
  id?: string
  category: string
  month: string
  date: string
  pettyCashVoucherNo: string
  supplierName: string
  description: string
  accountTitle: string
  documentTypeNo: string
  tinNo: string
  companyAddress: string
  grossAmount: number
  netOfVat: number
  inputVat: number
  onePercent: number
  twoPercent: number
  netAmount: number
  type?: string
  deleted?: boolean
  created?: Timestamp
  updated?: Timestamp
}

export async function createPettyCashSettings(
  settings: Omit<PettyCashSettings, "id" | "created" | "updated">,
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "encashment_settings"), {
      ...settings,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating petty cash settings:", error)
    throw error
  }
}

export async function getPettyCashSettings(): Promise<PettyCashSettings[]> {
  try {
    const q = query(collection(db, "encashment_settings"), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const settings: PettyCashSettings[] = []
    querySnapshot.forEach((doc) => {
      settings.push({ id: doc.id, ...doc.data() } as PettyCashSettings)
    })

    return settings
  } catch (error) {
    console.error("Error fetching petty cash settings:", error)
    return []
  }
}

export async function updatePettyCashSettings(id: string, settings: Partial<PettyCashSettings>): Promise<void> {
  try {
    const settingsRef = doc(db, "encashment_settings", id)
    await updateDoc(settingsRef, {
      ...settings,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating petty cash settings:", error)
    throw error
  }
}

export async function deletePettyCashSettings(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "encashment_settings", id))
  } catch (error) {
    console.error("Error deleting petty cash settings:", error)
    throw error
  }
}

export async function createPettyCashTransaction(
  transaction: Omit<PettyCashRow, "id" | "created" | "updated">,
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "encashment_transactions"), {
      ...transaction,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating petty cash transaction:", error)
    throw error
  }
}

export async function getPettyCashTransactions(): Promise<PettyCashRow[]> {
  try {
    const q = query(collection(db, "encashment_transactions"), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const transactions: PettyCashRow[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data() as PettyCashRow
      if (data.type === "PETTYCASH" && data.deleted !== true) {
        transactions.push({ id: doc.id, ...data })
      }
    })

    return transactions
  } catch (error) {
    console.error("Error fetching petty cash transactions:", error)
    return []
  }
}

export async function updatePettyCashTransaction(id: string, transaction: Partial<PettyCashRow>): Promise<void> {
  try {
    const transactionRef = doc(db, "encashment_transactions", id)
    await updateDoc(transactionRef, {
      ...transaction,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating petty cash transaction:", error)
    throw error
  }
}

export async function deletePettyCashTransaction(id: string): Promise<void> {
  try {
    const transactionRef = doc(db, "encashment_transactions", id)
    await updateDoc(transactionRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting petty cash transaction:", error)
    throw error
  }
}

export async function deleteMultiplePettyCashTransactions(ids: string[]): Promise<void> {
  try {
    const promises = ids.map((id) => {
      const transactionRef = doc(db, "encashment_transactions", id)
      return updateDoc(transactionRef, {
        deleted: true,
        updated: serverTimestamp(),
      })
    })
    await Promise.all(promises)
  } catch (error) {
    console.error("Error soft deleting multiple petty cash transactions:", error)
    throw error
  }
}

export async function createMultiplePettyCashTransactions(
  transactions: Omit<PettyCashRow, "id" | "created" | "updated">[],
): Promise<string[]> {
  try {
    const promises = transactions.map((transaction) =>
      addDoc(collection(db, "encashment_transactions"), {
        ...transaction,
        created: serverTimestamp(),
        updated: serverTimestamp(),
      }),
    )

    const results = await Promise.all(promises)
    return results.map((docRef) => docRef.id)
  } catch (error) {
    console.error("Error creating multiple petty cash transactions:", error)
    throw error
  }
}

export async function getSettings(type?: string): Promise<PettyCashSettings[]> {
  try {
    const q = query(collection(db, "encashment_settings"), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const settings: PettyCashSettings[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data() as PettyCashSettings
      if (!type || data.type === type) {
        settings.push({ id: doc.id, ...data })
      }
    })

    return settings
  } catch (error) {
    console.error("Error fetching settings:", error)
    return []
  }
}

export async function getTransactions(type?: string): Promise<PettyCashRow[]> {
  try {
    const q = query(collection(db, "encashment_transactions"), orderBy("created", "desc"))
    const querySnapshot = await getDocs(q)

    const transactions: PettyCashRow[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data() as PettyCashRow
      if (data.deleted !== true && (!type || data.type === type)) {
        transactions.push({ id: doc.id, ...data })
      }
    })

    return transactions
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return []
  }
}

export async function createSettings(settings: Omit<PettyCashSettings, "id" | "created" | "updated">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "encashment_settings"), {
      ...settings,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating settings:", error)
    throw error
  }
}

export async function createTransaction(
  transaction: Omit<PettyCashRow, "id" | "created" | "updated">,
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "encashment_transactions"), {
      ...transaction,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating transaction:", error)
    throw error
  }
}

export async function updateTransaction(id: string, transaction: Partial<PettyCashRow>): Promise<void> {
  try {
    const transactionRef = doc(db, "encashment_transactions", id)
    await updateDoc(transactionRef, {
      ...transaction,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating transaction:", error)
    throw error
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    const transactionRef = doc(db, "encashment_transactions", id)
    await updateDoc(transactionRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting transaction:", error)
    throw error
  }
}

export const encashmentService = {
  // Settings operations
  createPettyCashSettings,
  getPettyCashSettings,
  updatePettyCashSettings,
  deletePettyCashSettings,

  // Transaction operations
  createPettyCashTransaction,
  getPettyCashTransactions,
  updatePettyCashTransaction,
  deletePettyCashTransaction,
  createMultiplePettyCashTransactions,
  deleteMultiplePettyCashTransactions,

  getSettings,
  getTransactions,
  createSettings,
  createTransaction,
  updateTransaction,
  deleteTransaction,
}
