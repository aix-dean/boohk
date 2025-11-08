import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { SalesQuota, SalesQuotaSummary, SalesAssociateQuota } from "@/lib/types/sales-quota"

export class SalesQuotaService {
  private get quotasCollection() {
    return collection(db, "sales_quotas")
  }

  // Create or update a sales quota for an associate
  async setAssociateQuota(
    associateId: string,
    associateName: string,
    companyId: string,
    month: number,
    year: number,
    targetQuotations: number,
    createdBy: string
  ): Promise<string> {
    try {
      // Check if quota already exists for this associate/month/year
      const existingQuota = await this.getAssociateQuota(associateId, month, year)

      if (existingQuota) {
        // Update existing quota
        await updateDoc(doc(this.quotasCollection, existingQuota.id), {
          targetQuotations,
          updated: serverTimestamp(),
        })
        return existingQuota.id!
      } else {
        // Create new quota
        const quotaData: Omit<SalesQuota, "id"> = {
          associateId,
          associateName,
          companyId,
          month,
          year,
          targetQuotations,
          actualQuotations: 0, // Will be calculated separately
          achievementPercentage: 0, // Will be calculated separately
          created: serverTimestamp() as Timestamp,
          updated: serverTimestamp() as Timestamp,
          createdBy,
        }

        const docRef = await addDoc(this.quotasCollection, quotaData)
        return docRef.id
      }
    } catch (error) {
      console.error("Error setting associate quota:", error)
      throw error
    }
  }

  // Get quota for a specific associate and month/year
  async getAssociateQuota(
    associateId: string,
    month: number,
    year: number
  ): Promise<SalesQuota | null> {
    try {
      const q = query(
        this.quotasCollection,
        where("associateId", "==", associateId),
        where("month", "==", month),
        where("year", "==", year)
      )

      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        return { id: doc.id, ...doc.data() } as SalesQuota
      }
      return null
    } catch (error) {
      console.error("Error getting associate quota:", error)
      return null
    }
  }

  // Get all quotas for a company in a specific month/year
  async getCompanyQuotas(
    companyId: string,
    month: number,
    year: number
  ): Promise<SalesQuota[]> {
    try {
      const q = query(
        this.quotasCollection,
        where("companyId", "==", companyId),
        where("month", "==", month),
        where("year", "==", year),
        orderBy("associateName", "asc")
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesQuota))
    } catch (error) {
      console.error("Error getting company quotas:", error)
      return []
    }
  }

  // Calculate actual quotations for an associate in a given month/year
  async calculateAssociateAchievements(
    associateId: string,
    month: number,
    year: number,
    companyId: string
  ): Promise<number> {
    try {
      // Query quotations created by this associate in the specified month/year
      const quotationsRef = collection(db, "quotations")
      const startDate = new Date(year, month - 1, 1) // Month is 0-indexed in Date
      const endDate = new Date(year, month, 1) // First day of next month

      const q = query(
        quotationsRef,
        where("created_by", "==", associateId),
        where("company_id", "==", companyId),
        where("created", ">=", startDate),
        where("created", "<", endDate)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.size
    } catch (error) {
      console.error("Error calculating associate achievements:", error)
      return 0
    }
  }

  // Update actual achievements and percentages for all associates in a company/month/year
  async updateCompanyAchievements(
    companyId: string,
    month: number,
    year: number
  ): Promise<void> {
    try {
      const quotas = await this.getCompanyQuotas(companyId, month, year)

      for (const quota of quotas) {
        const actualQuotations = await this.calculateAssociateAchievements(
          quota.associateId,
          month,
          year,
          companyId
        )

        const achievementPercentage = quota.targetQuotations > 0
          ? Math.round((actualQuotations / quota.targetQuotations) * 100)
          : 0

        await updateDoc(doc(this.quotasCollection, quota.id), {
          actualQuotations,
          achievementPercentage,
          updated: serverTimestamp(),
        })
      }
    } catch (error) {
      console.error("Error updating company achievements:", error)
      throw error
    }
  }

  // Get sales quota summary for a company in a specific month/year
  async getSalesQuotaSummary(
    companyId: string,
    month: number,
    year: number
  ): Promise<SalesQuotaSummary> {
    try {
      // First update achievements to ensure data is current
      await this.updateCompanyAchievements(companyId, month, year)

      // Get updated quotas
      const quotas = await this.getCompanyQuotas(companyId, month, year)

      if (quotas.length === 0) {
        return {
          averageAchievement: 0,
          totalAssociates: 0,
          associatesOnTrack: 0,
          associatesBelowTarget: 0,
          totalTargets: 0,
          totalActual: 0,
        }
      }

      const totalAchievement = quotas.reduce((sum, quota) => sum + quota.achievementPercentage, 0)
      const averageAchievement = Math.round(totalAchievement / quotas.length)

      const associatesOnTrack = quotas.filter(q => q.achievementPercentage >= 100).length
      const associatesBelowTarget = quotas.filter(q => q.achievementPercentage < 100).length

      const totalTargets = quotas.reduce((sum, quota) => sum + quota.targetQuotations, 0)
      const totalActual = quotas.reduce((sum, quota) => sum + quota.actualQuotations, 0)

      return {
        averageAchievement,
        totalAssociates: quotas.length,
        associatesOnTrack,
        associatesBelowTarget,
        totalTargets,
        totalActual,
      }
    } catch (error) {
      console.error("Error getting sales quota summary:", error)
      throw error
    }
  }

  // Get detailed associate quotas for breakdown dialog
  async getAssociateQuotasForBreakdown(
    companyId: string,
    month: number,
    year: number
  ): Promise<SalesAssociateQuota[]> {
    try {
      // First update achievements
      await this.updateCompanyAchievements(companyId, month, year)

      // Get updated quotas
      const quotas = await this.getCompanyQuotas(companyId, month, year)

      return quotas.map(quota => ({
        associateId: quota.associateId,
        associateName: quota.associateName,
        targetQuotations: quota.targetQuotations,
        actualQuotations: quota.actualQuotations,
        achievementPercentage: quota.achievementPercentage,
        status: quota.achievementPercentage >= 100 ? 'above-target' :
                quota.achievementPercentage >= 80 ? 'on-target' : 'below-target',
      }))
    } catch (error) {
      console.error("Error getting associate quotas for breakdown:", error)
      return []
    }
  }

  // Get sales associates (users with sales role) for a company
  async getSalesAssociates(companyId: string): Promise<{ id: string; name: string }[]> {
    try {
      const usersRef = collection(db, "users")
      const q = query(
        usersRef,
        where("company_id", "==", companyId),
        where("type", "==", "sales")
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => {
        const data = doc.data()
        const name = data.first_name && data.last_name
          ? `${data.first_name} ${data.last_name}`
          : data.email || "Unknown User"

        return {
          id: doc.id,
          name,
        }
      })
    } catch (error) {
      console.error("Error getting sales associates:", error)
      return []
    }
  }
}

// Export singleton instance
export const salesQuotaService = new SalesQuotaService()