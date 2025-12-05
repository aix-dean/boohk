import { type NextRequest, NextResponse } from "next/server"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Helper function to verify Firebase Auth token
async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    // For now, we'll trust the token and extract userId from query params
    // In production, you should verify the token with Firebase Admin SDK
    return request.nextUrl.searchParams.get('userId')
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // First get the current user's company_id
    const userDoc = await getDocs(query(collection(db, 'boohk_users'), where('uid', '==', userId)))
    if (userDoc.empty) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userData = userDoc.docs[0].data()
    const companyId = userData.company_id

    if (!companyId) {
      return NextResponse.json({ users: [] })
    }

    // Get all users in the same company
    const companyUsersQuery = query(collection(db, 'boohk_users'), where('company_id', '==', companyId))
    const companyUsersSnapshot = await getDocs(companyUsersQuery)

    const users = companyUsersSnapshot.docs
      .filter(doc => doc.data().uid !== userId) // Exclude current user
      .map(doc => {
        const data = doc.data()
        return {
          id: data.uid,
          displayName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Unknown User',
          email: data.email,
          avatar: data.avatar,
          status: 'offline', // TODO: Implement real-time status
          lastSeen: data.updated?.toDate() || new Date(),
        }
      })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error fetching company users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}