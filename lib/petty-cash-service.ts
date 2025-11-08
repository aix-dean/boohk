import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"

/**
 * Upload file to Firebase Storage and return download URL
 */
export async function uploadFileToFirebase(file: File, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type (images and PDFs)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]
    if (!allowedTypes.includes(file.type)) {
      reject(new Error("Invalid file type. Please select an image or PDF file."))
      return
    }


    // Create unique filename
    const timestamp = Date.now()
    const fileName = `${path}/${timestamp}_${file.name}`
    const storageRef = ref(storage, fileName)

    // Start upload
    const uploadTask = uploadBytesResumable(storageRef, file)

    uploadTask.on(
      "state_changed",
      null, // No progress callback needed
      (error) => {
        console.error("Upload error:", error)
        reject(error)
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          resolve(downloadURL)
        } catch (error) {
          console.error("Error getting download URL:", error)
          reject(error)
        }
      }
    )
  })
}

// Petty Cash Configuration interface
export interface PettyCashConfig {
  id?: string
  company_id: string
  amount: number
  warning_amount: number
  created: Timestamp | any
  user_id: string
}

// Petty Cash Expense interface
export interface PettyCashExpense {
  id?: string
  company_id: string
  cycle_id: string
  item: string
  amount: number
  requested_by: string
  attachment: string[]
  created: Timestamp | any
  user_id: string
}

// Petty Cash Cycle interface
export interface PettyCashCycle {
  id?: string
  company_id: string
  config_id: string
  startDate: Timestamp | any
  endDate?: Timestamp | any
  total: number
  user_id: string
  cycle_no: number
  status?: "active" | "completed" | "archived"
  created?: Timestamp | any
}

/**
 * Save petty cash configuration to database
 */
export async function savePettyCashConfig(
  companyId: string,
  userId: string,
  amount: number,
  warningAmount: number
): Promise<string> {
  try {
    const configData = {
      company_id: companyId,
      amount: amount,
      warning_amount: warningAmount,
      created: serverTimestamp(),
      user_id: userId,
    }

    const docRef = await addDoc(collection(db, "petty_cash_config"), configData)
    console.log("Petty cash configuration saved with ID:", docRef.id)

    return docRef.id
  } catch (error) {
    console.error("Error saving petty cash configuration:", error)
    throw error
  }
}

/**
 * Get petty cash configuration for a company
 */
export async function getPettyCashConfig(companyId: string): Promise<PettyCashConfig | null> {
  try {
    console.log("getPettyCashConfig called with companyId:", companyId)
    const configRef = collection(db, "petty_cash_config")
    const q = query(
      configRef,
      where("company_id", "==", companyId),
      orderBy("created", "desc")
    )

    console.log("Executing query for petty_cash_config collection")
    const querySnapshot = await getDocs(q)
    console.log("Query returned", querySnapshot.size, "documents")

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0] // Get the most recent config
      const data = doc.data()
      console.log("Found configuration document:", { id: doc.id, ...data })
      return { id: doc.id, ...data } as PettyCashConfig
    }

    console.log("No configuration documents found for company:", companyId)
    return null
  } catch (error) {
    console.error("Error fetching petty cash configuration:", error)
    return null
  }
}

/**
 * Update petty cash configuration
 */
export async function updatePettyCashConfig(
  configId: string,
  amount: number,
  warningAmount: number
): Promise<void> {
  try {
    const configRef = doc(db, "petty_cash_config", configId)

    await updateDoc(configRef, {
      amount: amount,
      warning_amount: warningAmount,
      updated: serverTimestamp(),
    })

    console.log("Petty cash configuration updated:", configId)
  } catch (error) {
    console.error("Error updating petty cash configuration:", error)
    throw error
  }
}

/**
 * Save petty cash expense to database
 */
export async function savePettyCashExpense(
  companyId: string,
  userId: string,
  cycleId: string,
  expenseData: {
    item: string
    amount: number
    requestedBy: string
    attachment: string[]
  }
): Promise<string> {
  try {
    const expense = {
      company_id: companyId,
      cycle_id: cycleId,
      item: expenseData.item,
      amount: expenseData.amount,
      requested_by: expenseData.requestedBy,
      attachment: expenseData.attachment,
      created: serverTimestamp(),
      user_id: userId,
    }

    const docRef = await addDoc(collection(db, "petty_cash_expenses"), expense)
    console.log("Petty cash expense saved with ID:", docRef.id)

    return docRef.id
  } catch (error) {
    console.error("Error saving petty cash expense:", error)
    throw error
  }
}

/**
 * Get petty cash expenses for a cycle
 */
export async function getPettyCashExpenses(cycleId: string): Promise<PettyCashExpense[]> {
  try {
    const expensesRef = collection(db, "petty_cash_expenses")
    const q = query(
      expensesRef,
      where("cycle_id", "==", cycleId),
      orderBy("created", "desc")
    )

    const querySnapshot = await getDocs(q)
    const expenses: PettyCashExpense[] = []

    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() } as PettyCashExpense)
    })

    return expenses
  } catch (error) {
    console.error("Error fetching petty cash expenses:", error)
    return []
  }
}

/**
 * Create a new petty cash cycle
 */
export async function createPettyCashCycle(
  companyId: string,
  userId: string,
  configId: string,
  cycleNo: number,
): Promise<string> {
  try {
    const cycleData = {
      company_id: companyId,
      config_id: configId,
      startDate: serverTimestamp(),
      endDate: null,
      total: 0,
      user_id: userId,
      cycle_no: cycleNo,
      status: "active",
      created: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, "petty_cash_cycles"), cycleData)
    console.log("Petty cash cycle created with ID:", docRef.id)

    return docRef.id
  } catch (error) {
    console.error("Error creating petty cash cycle:", error)
    throw error
  }
}

/**
 * Get the next cycle number for a company
 */
export async function getNextCycleNo(companyId: string): Promise<number> {
  try {
    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", companyId),
      orderBy("cycle_no", "desc")
    )

    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const highestCycle = querySnapshot.docs[0].data() as PettyCashCycle
      return highestCycle.cycle_no + 1
    }

    return 1
  } catch (error) {
    console.error("Error fetching next cycle number:", error)
    return 1
  }
}

/**
 * Get active petty cash cycle for a company
 */
export async function getActivePettyCashCycle(companyId: string): Promise<PettyCashCycle | null> {
  try {
    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", companyId),
      where("status", "==", "active"),
      orderBy("created", "desc")
    )

    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() } as PettyCashCycle
    }

    return null
  } catch (error) {
    console.error("Error fetching active petty cash cycle:", error)
    return null
  }
}

/**
 * Update petty cash cycle total
 */
export async function updatePettyCashCycleTotal(
  cycleId: string,
  newTotal: number
): Promise<void> {
  try {
    const cycleRef = doc(db, "petty_cash_cycles", cycleId)

    await updateDoc(cycleRef, {
      total: newTotal,
      updated: serverTimestamp(),
    })

    console.log("Petty cash cycle total updated:", cycleId)
  } catch (error) {
    console.error("Error updating petty cash cycle total:", error)
    throw error
  }
}

/**
 * Update petty cash cycle config_id
 */
export async function updatePettyCashCycleConfigId(
  cycleId: string,
  configId: string
): Promise<void> {
  try {
    const cycleRef = doc(db, "petty_cash_cycles", cycleId)

    await updateDoc(cycleRef, {
      config_id: configId,
      updated: serverTimestamp(),
    })

    console.log("Petty cash cycle config_id updated:", cycleId, "to", configId)
  } catch (error) {
    console.error("Error updating petty cash cycle config_id:", error)
    throw error
  }
}

/**
 * Complete a petty cash cycle
 */
export async function completePettyCashCycle(cycleId: string): Promise<void> {
  try {
    const cycleRef = doc(db, "petty_cash_cycles", cycleId)

    await updateDoc(cycleRef, {
      status: "completed",
      endDate: serverTimestamp(),
    })

    console.log("Petty cash cycle completed:", cycleId)
  } catch (error) {
    console.error("Error completing petty cash cycle:", error)
    throw error
  }
}

/**
 * Get the latest petty cash cycle for a company (by highest cycle number)
 */
export async function getLatestPettyCashCycle(companyId: string): Promise<PettyCashCycle | null> {
  try {
    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", companyId),
      orderBy("cycle_no", "desc"),
      limit(1)
    )

    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() } as PettyCashCycle
    }

    return null
  } catch (error) {
    console.error("Error fetching latest petty cash cycle:", error)
    return null
  }
}

/**
 * Get all petty cash cycles for a company
 */
export async function getPettyCashCycles(companyId: string): Promise<PettyCashCycle[]> {
  try {
    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", companyId),
      orderBy("cycle_no", "desc")
    )

    const querySnapshot = await getDocs(q)
    const cycles: PettyCashCycle[] = []

    querySnapshot.forEach((doc) => {
      cycles.push({ id: doc.id, ...doc.data() } as PettyCashCycle)
    })

    return cycles
  } catch (error) {
    console.error("Error fetching petty cash cycles:", error)
    return []
  }
}