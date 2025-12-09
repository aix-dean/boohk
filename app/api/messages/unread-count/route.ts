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
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Query all conversations where user is a participant
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    )

    const snapshot = await getDocs(conversationsQuery)

    let totalUnread = 0

    // Sum unreadCount for the user across all conversations
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const unreadCount = data.unreadCount || {}
      const userUnreadCount = unreadCount[userId] || 0
      totalUnread += userUnreadCount
    })

    return NextResponse.json({ totalUnread })
  } catch (error) {
    console.error("Error fetching unread count:", error)
    return NextResponse.json({ error: "Failed to fetch unread count" }, { status: 500 })
  }
}