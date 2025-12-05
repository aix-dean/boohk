import { type NextRequest, NextResponse } from "next/server"
import { collection, doc, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Conversation, Message } from "@/lib/types/messaging"

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

    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get("limit") || "20")

    // Query conversations where user is a participant
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc'),
      limit(limitParam)
    )

    const snapshot = await getDocs(conversationsQuery)

    const conversations: Conversation[] = []

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()

      // Get last message if exists
      let lastMessage: Message | undefined
      if (data.lastMessage) {
        lastMessage = {
          id: data.lastMessage.id,
          conversationId: docSnap.id,
          senderId: data.lastMessage.senderId,
          type: data.lastMessage.type,
          content: data.lastMessage.content,
          timestamp: data.lastMessage.timestamp.toDate(),
          status: {
            delivered: {},
            read: {}
          },
          reactions: {}
        }
      }

      const conversation: Conversation = {
        id: docSnap.id,
        participants: data.participants || [],
        type: data.type || 'direct',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastMessage,
        unreadCount: data.unreadCount || {},
        metadata: data.metadata,
        settings: {
          isArchived: data.settings?.isArchived || false,
          isMuted: data.settings?.isMuted || false,
          muteUntil: data.settings?.muteUntil?.toDate(),
          pinned: data.settings?.pinned || false
        }
      }

      conversations.push(conversation)
    }

    return NextResponse.json({
      conversations,
      hasMore: snapshot.size === limitParam
    })
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { participants, type, metadata } = body

    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      return NextResponse.json(
        { error: "At least 2 participants are required" },
        { status: 400 }
      )
    }

    if (!participants.includes(userId)) {
      return NextResponse.json(
        { error: "Current user must be a participant" },
        { status: 400 }
      )
    }

    // For direct messages, ensure only 2 participants
    if (type === 'direct' && participants.length !== 2) {
      return NextResponse.json(
        { error: "Direct conversations must have exactly 2 participants" },
        { status: 400 }
      )
    }

    // Check if a direct conversation already exists between these participants
    if (type === 'direct') {
      const existingQuery = query(
        collection(db, 'conversations'),
        where('participants', 'in', [
          participants.sort(),
          participants.slice().reverse()
        ]),
        where('type', '==', 'direct')
      )

      const existingSnapshot = await getDocs(existingQuery)
      if (!existingSnapshot.empty) {
        const existingConversation = existingSnapshot.docs[0]
        return NextResponse.json({
          conversation: {
            id: existingConversation.id,
            ...existingConversation.data()
          }
        })
      }
    }

    // Create new conversation
    const conversationData = {
      participants: participants.sort(), // Sort for consistent ordering
      type: type || 'direct',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadCount: participants.reduce((acc, participantId) => {
        acc[participantId] = 0
        return acc
      }, {} as Record<string, number>),
      metadata: metadata || {},
      settings: {
        isArchived: false,
        isMuted: false,
        pinned: false
      }
    }

    const conversationRef = await addDoc(collection(db, 'conversations'), conversationData)

    return NextResponse.json({
      conversation: {
        id: conversationRef.id,
        ...conversationData,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
  }
}