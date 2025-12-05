import { type NextRequest, NextResponse } from "next/server"
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDoc, increment } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Message } from "@/lib/types/messaging"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, type, content, metadata, userId } = body

    // Verify authentication - for now, trust the userId from body
    // In production, verify Firebase Auth token
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!conversationId || !type || !content) {
      return NextResponse.json(
        { error: "Conversation ID, type, and content are required" },
        { status: 400 }
      )
    }

    // Verify user has access to the conversation
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId))
    if (!conversationDoc.exists()) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversationData = conversationDoc.data()
    if (!conversationData?.participants?.includes(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Create the message
    const messageData = {
      conversationId,
      senderId: userId,
      type,
      content,
      timestamp: serverTimestamp(),
      metadata: metadata || {},
      status: {
        delivered: {},
        read: {}
      },
      reactions: {}
    }

    const messageRef = await addDoc(collection(db, 'messages'), messageData)
    const messageId = messageRef.id

    // Update conversation's last message and updatedAt
    const lastMessage = {
      id: messageId,
      senderId: userId,
      content,
      timestamp: serverTimestamp(),
      type
    }

    // Update unread counts for all participants except sender
    const updateData: any = {
      lastMessage,
      updatedAt: serverTimestamp()
    }

    conversationData.participants.forEach((participantId: string) => {
      if (participantId !== userId) {
        updateData[`unreadCount.${participantId}`] = increment(1)
      }
    })

    await updateDoc(doc(db, 'conversations', conversationId), updateData)

    return NextResponse.json({
      messageId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}