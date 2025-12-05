import { type NextRequest, NextResponse } from "next/server"
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Message } from "@/lib/types/messaging"

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

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { conversationId } = params
    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get("limit") || "50")
    const beforeParam = searchParams.get("before")

    // First verify user has access to this conversation
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId))
    if (!conversationDoc.exists()) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversationData = conversationDoc.data()
    if (!conversationData?.participants?.includes(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Build query for messages
    let messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      limit(limitParam)
    )

    // If before parameter is provided, start after that message
    if (beforeParam) {
      const beforeDoc = await getDoc(doc(db, 'messages', beforeParam))
      if (beforeDoc.exists()) {
        messagesQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', conversationId),
          orderBy('timestamp', 'desc'),
          startAfter(beforeDoc),
          limit(limitParam)
        )
      }
    }

    const snapshot = await getDocs(messagesQuery)

    const messages: Message[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type || 'text',
        content: data.content || '',
        timestamp: data.timestamp?.toDate() || new Date(),
        editedAt: data.editedAt?.toDate(),
        deletedAt: data.deletedAt?.toDate(),
        metadata: data.metadata,
        status: {
          delivered: Object.fromEntries(
            Object.entries(data.status?.delivered || {}).map(([k, v]) => [k, (v as Timestamp).toDate()])
          ),
          read: Object.fromEntries(
            Object.entries(data.status?.read || {}).map(([k, v]) => [k, (v as Timestamp).toDate()])
          )
        },
        reactions: data.reactions || {}
      }
    })

    // Reverse to get chronological order (oldest first)
    messages.reverse()

    return NextResponse.json({
      messages,
      hasMore: snapshot.size === limitParam
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}