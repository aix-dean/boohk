import { type NextRequest, NextResponse } from "next/server"
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore"
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

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      )
    }

    // Verify user has access to this conversation
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId))
    if (!conversationDoc.exists()) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversationData = conversationDoc.data()
    if (!conversationData?.participants?.includes(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all unread messages in this conversation for this user
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId)
    )

    const messagesSnapshot = await getDocs(messagesQuery)

    // Use batch to update all messages and conversation unread count
    const batch = writeBatch(db)

    // Update conversation unread count to 0 for this user
    batch.update(doc(db, 'conversations', conversationId), {
      [`unreadCount.${userId}`]: 0,
      updatedAt: serverTimestamp()
    })

    // Update read status for all messages
    messagesSnapshot.docs.forEach((messageDoc) => {
      const messageData = messageDoc.data()
      if (messageData.senderId !== userId) { // Don't mark own messages as read
        batch.update(doc(db, 'messages', messageDoc.id), {
          [`status.read.${userId}`]: serverTimestamp()
        })
      }
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      message: "Messages marked as read"
    })
  } catch (error) {
    console.error("Error marking messages as read:", error)
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 })
  }
}