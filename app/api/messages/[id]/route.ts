import { type NextRequest, NextResponse } from "next/server"
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Message } from "@/lib/types/messaging"

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[DEBUG] Starting GET request for conversationId:', params)

    const userId = await verifyAuthToken(request)
    console.log('[DEBUG] Auth verification result - userId:', userId)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get("limit") || "9")
    const beforeParam = searchParams.get("before")
    console.log('[DEBUG] Query params - limit:', limitParam, 'before:', beforeParam)

    // First verify user has access to this conversation
    console.log('[DEBUG] Fetching conversation document:', id)
    const conversationDoc = await getDoc(doc(db, 'conversations', id))
    console.log('[DEBUG] Conversation doc exists:', conversationDoc.exists())

    if (!conversationDoc.exists()) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversationData = conversationDoc.data()
    console.log('[DEBUG] Conversation data:', conversationData)
    if (!conversationData?.participants?.includes(userId)) {
      console.log('[DEBUG] Access denied - user not in participants')
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Build query for messages
    console.log('[DEBUG] Building messages query')
    let messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', id),
      orderBy('timestamp', 'desc'),
      limit(limitParam + 1) // +1 to check if there are more
    )

    // If before parameter is provided, start after that message
    if (beforeParam) {
      console.log('[DEBUG] Before param provided, fetching beforeDoc:', beforeParam)
      const beforeDoc = await getDoc(doc(db, 'messages', beforeParam))
      console.log('[DEBUG] Before doc exists:', beforeDoc.exists())
      if (beforeDoc.exists()) {
        messagesQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', id),
          orderBy('timestamp', 'desc'),
          startAfter(beforeDoc),
          limit(limitParam + 1)
        )
      }
    }

    console.log('[DEBUG] Executing messages query')
    const snapshot = await getDocs(messagesQuery)
    console.log('[DEBUG] Query snapshot size:', snapshot.size)

    const hasMore = snapshot.size > limitParam
    const docs = hasMore ? snapshot.docs.slice(0, limitParam) : snapshot.docs

    const messages: Message[] = docs.map(docSnap => {
      console.log('[DEBUG] Processing message doc:', docSnap.id)
      const data = docSnap.data()
      console.log('[DEBUG] Message data keys:', Object.keys(data))

      try {
        const message = {
          id: docSnap.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          type: data.type || 'text',
          content: data.content || '',
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
          editedAt: data.editedAt?.toDate ? data.editedAt.toDate() : undefined,
          deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : undefined,
          metadata: data.metadata,
          status: {
            delivered: Object.fromEntries(
              Object.entries(data.status?.delivered || {}).map(([k, v]) => {
                console.log('[DEBUG] Processing delivered status for', k, typeof v)
                return [k, (v as any)?.toDate ? (v as any).toDate() : new Date()]
              })
            ),
            read: Object.fromEntries(
              Object.entries(data.status?.read || {}).map(([k, v]) => {
                console.log('[DEBUG] Processing read status for', k, typeof v)
                return [k, (v as any)?.toDate ? (v as any).toDate() : new Date()]
              })
            )
          },
          reactions: data.reactions || {}
        }
        console.log('[DEBUG] Successfully processed message:', docSnap.id)
        return message
      } catch (mapError) {
        console.error('[DEBUG] Error mapping message', docSnap.id, ':', mapError)
        throw mapError
      }
    }).filter(message => !message.deletedAt)

    // Reverse to get chronological order (oldest first)
    messages.reverse()
    console.log('[DEBUG] Final messages count:', messages.length, 'hasMore:', hasMore)

    return NextResponse.json({
      messages,
      hasMore
    })
  } catch (error) {
    console.error("[DEBUG] Error fetching messages:", error)
    console.error("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get the message
    const messageDoc = await getDoc(doc(db, 'messages', id))
    if (!messageDoc.exists()) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const messageData = messageDoc.data()

    // Verify user is the sender
    if (messageData.senderId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Soft delete the message
    await updateDoc(doc(db, 'messages', id), { deletedAt: serverTimestamp() })

    return NextResponse.json({ success: true, message: "Message marked as deleted successfully" })
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
  }
}