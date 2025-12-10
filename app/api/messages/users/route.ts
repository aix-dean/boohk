import { type NextRequest, NextResponse } from "next/server"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Helper function to verify Firebase Auth token
async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  try {
    // For now, we'll trust the userId from query params
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
    console.log('GET /api/messages/users - userId:', userId)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIdsParam = searchParams.get('userIds')

    if (userIdsParam) {
      // Fetch specific users by IDs
      const userIds = userIdsParam.split(',').filter(id => id.trim())
      console.log('Fetching users by IDs:', userIds)

      if (userIds.length === 0) {
        return NextResponse.json({ users: [] })
      }

      // Fetch users from boohk_users collection
      const usersPromises = userIds.map(async (id) => {
        const userQuery = query(collection(db, 'boohk_users'), where('uid', '==', id))
        const userSnapshot = await getDocs(userQuery)
        if (!userSnapshot.empty) {
          const data = userSnapshot.docs[0].data()
          return {
            id: data.uid,
            displayName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Unknown User',
            email: data.email,
            avatar: data.photo_url || data.avatar,
            photo_url: data.photo_url,
            status: 'offline', // TODO: Implement real-time status
            lastSeen: data.updated?.toDate() || new Date(),
          }
        }
        return null
      })

      const users = (await Promise.all(usersPromises)).filter(user => user !== null)
      console.log('returning users by IDs:', users.length)
      return NextResponse.json({ users })
    } else {
      // Original logic: get company users
      // First get the current user's company_id
      const userDoc = await getDocs(query(collection(db, 'boohk_users'), where('uid', '==', userId)))
      console.log('userDoc.empty:', userDoc.empty)
      if (userDoc.empty) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      const userData = userDoc.docs[0].data()
      const companyId = userData.company_id
      console.log('current user companyId:', companyId)

      if (!companyId) {
        return NextResponse.json({ users: [] })
      }

      // Get all users in the same company
      const companyUsersQuery = query(collection(db, 'boohk_users'), where('company_id', '==', companyId))
      const companyUsersSnapshot = await getDocs(companyUsersQuery)
      console.log('companyUsersSnapshot.size:', companyUsersSnapshot.size)

      const users = companyUsersSnapshot.docs
        .filter(doc => doc.data().uid !== userId) // Exclude current user
        .map(doc => {
          const data = doc.data()
          return {
            id: data.uid,
            displayName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Unknown User',
            email: data.email,
            avatar: data.photo_url || data.avatar,
            photo_url: data.photo_url,
            status: 'offline', // TODO: Implement real-time status
            lastSeen: data.updated?.toDate() || new Date(),
          }
        })

      console.log('returning company users:', users.length)
      return NextResponse.json({ users })
    }
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}