import { NextRequest, NextResponse } from "next/server"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Active users are defined as users with lastActivity within the last 15 minutes
const ACTIVE_THRESHOLD_MINUTES = 15

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")

    if (!companyId || !userId) {
      return NextResponse.json({ error: "Company ID and User ID required" }, { status: 400 })
    }

    // First get all users in the company
    const usersQuery = query(
      collection(db, "iboard_users"),
      where("company_id", "==", companyId)
    )

    const snapshot = await getDocs(usersQuery)

    // Calculate the threshold timestamp (15 minutes ago)
    const thresholdTime = new Date()
    thresholdTime.setMinutes(thresholdTime.getMinutes() - ACTIVE_THRESHOLD_MINUTES)
    const thresholdTimestamp = thresholdTime.getTime()

    // Filter users who have been active within the threshold
    const activeUsers = snapshot.docs
      .map((doc) => {
        const data = doc.data()
        const lastActivity = data.lastActivity?.toDate()?.getTime()

        return {
          id: doc.id,
          uid: data.uid,
          email: data.email,
          displayName: data.display_name || `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Unknown User",
          firstName: data.first_name,
          lastName: data.last_name,
          department: data.department,
          roles: data.roles || [],
          lastActivity: data.lastActivity?.toDate().toISOString(),
          photoURL: data.photo_url,
          phoneNumber: data.phone_number,
          _lastActivityTimestamp: lastActivity,
        }
      })
      .filter((user) => {
        // Include users who have lastActivity within the threshold OR have no lastActivity but are currently logged in
        // For now, we'll include all users and let the client decide based on activity
        return user._lastActivityTimestamp ? user._lastActivityTimestamp >= thresholdTimestamp : true
      })
      .sort((a, b) => (b._lastActivityTimestamp || 0) - (a._lastActivityTimestamp || 0))
      .map(({ _lastActivityTimestamp, ...user }) => user) // Remove the temporary field

    return NextResponse.json({ activeUsers })

  } catch (error) {
    console.error("Error in active users API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}