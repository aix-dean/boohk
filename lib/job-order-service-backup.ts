import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface JobOrder {
  id: string
  product_id: string
  company_id: string
  status: string
  joNumber: string
  siteName: string
  clientName: string
  clientCompany: string
  joType: string
  createdAt: any
  updatedAt: any
  // Add other fields as needed
}

// Get job orders by company ID
export async function getJobOrdersByCompanyId(companyId: string): Promise<JobOrder[]> {
  try {
    console.log("Fetching job orders for company ID:", companyId)

    const jobOrdersRef = collection(db, "job_orders")
    const q = query(jobOrdersRef, where("company_id", "==", companyId), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    const jobOrders: JobOrder[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      jobOrders.push({
        id: doc.id,
        ...data,
      } as JobOrder)
    })

    console.log(`Found ${jobOrders.length} job orders for company ${companyId}`)
    return jobOrders
  } catch (error) {
    console.error("Error fetching job orders by company ID:", error)
    throw error
  }
}

// Get job orders by product ID (site)
export async function getJobOrdersByProductId(productId: string): Promise<JobOrder[]> {
  try {
    console.log("Fetching job orders for product ID:", productId)

    const jobOrdersRef = collection(db, "job_orders")
    const q = query(jobOrdersRef, where("product_id", "==", productId), orderBy("createdAt", "desc"))

    const querySnapshot = await getDocs(q)
    const jobOrders: JobOrder[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      jobOrders.push({
        id: doc.id,
        ...data,
      } as JobOrder)
    })

    console.log(`Found ${jobOrders.length} job orders for product ${productId}`)
    return jobOrders
  } catch (error) {
    console.error("Error fetching job orders by product ID:", error)
    throw error
  }
}
