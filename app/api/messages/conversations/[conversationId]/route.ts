import { type NextRequest, NextResponse } from "next/server"
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from "firebase/firestore"
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { conversationId } = params
    const body = await request.json()
    const { metadata } = body

    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json(
        { error: "Metadata object is required" },
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

    // Update conversation metadata
    await updateDoc(doc(db, 'conversations', conversationId), {
      metadata: { ...conversationData.metadata, ...metadata },
      updatedAt: new Date()
    })

    return NextResponse.json({
      success: true,
      message: "Conversation metadata updated successfully"
    })
  } catch (error) {
    console.error("Error updating conversation metadata:", error)
    return NextResponse.json({ error: "Failed to update conversation metadata" }, { status: 500 })
  }
}
// Add member to group (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const userId = await verifyAuthToken(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { conversationId } = params
    const body = await request.json()
    const { memberId } = body

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    // Get conversation
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId))
    if (!conversationDoc.exists()) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversationData = conversationDoc.data()
    if (conversationData?.type !== 'group') {
      return NextResponse.json({ error: "Only group conversations support member management" }, { status: 400 })
    }

    // Check if user is admin
    if (conversationData.metadata?.admin !== userId) {
      return NextResponse.json({ error: "Only group admin can manage members" }, { status: 403 })
    }

    // Check if member already exists
    if (conversationData.participants?.includes(memberId)) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 })
    }

    // Get member name
    const memberQuery = query(collection(db, 'boohk_users'), where('uid', '==', memberId))
    const memberSnapshot = await getDocs(memberQuery)
    let memberName = 'Unknown User'
    if (!memberSnapshot.empty) {
      const data = memberSnapshot.docs[0].data()
      memberName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Unknown User'
    }

    // Update participants and metadata
    const updatedParticipants = [...(conversationData.participants || []), memberId].sort()
    const updatedParticipantNames = [...(conversationData.metadata?.participantNames || []), memberName]

    await updateDoc(doc(db, 'conversations', conversationId), {
      participants: updatedParticipants,
      'metadata.participantNames': updatedParticipantNames,
      unreadCount: { ...conversationData.unreadCount, [memberId]: 0 },
      updatedAt: new Date()
    })

    return NextResponse.json({ success: true, message: "Member added successfully" })
  } catch (error) {
    console.error("Error adding member:", error)
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
}

// Remove member from group (admin only)
export async function DELETE(
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
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: "memberId query parameter is required" }, { status: 400 })
    }

    // Get conversation
    const conversationDoc = await getDoc(doc(db, 'conversations', conversationId))
    if (!conversationDoc.exists()) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversationData = conversationDoc.data()
    if (conversationData?.type !== 'group') {
      return NextResponse.json({ error: "Only group conversations support member management" }, { status: 400 })
    }

    // Check if user is admin
    if (conversationData.metadata?.admin !== userId) {
      return NextResponse.json({ error: "Only group admin can manage members" }, { status: 403 })
    }

    // Cannot remove admin
    if (memberId === conversationData.metadata?.admin) {
      return NextResponse.json({ error: "Cannot remove group admin" }, { status: 400 })
    }

    // Check if member exists
    if (!conversationData.participants?.includes(memberId)) {
      return NextResponse.json({ error: "User is not a member" }, { status: 400 })
    }

    // Find member index for name removal
    const memberIndex = conversationData.participants.indexOf(memberId)
    const updatedParticipants = conversationData.participants.filter((id: string) => id !== memberId)
    const updatedParticipantNames = conversationData.metadata?.participantNames?.filter((_: string, index: number) => index !== memberIndex) || []

    // Remove from unread count
    const { [memberId]: _, ...updatedUnreadCount } = conversationData.unreadCount || {}

    await updateDoc(doc(db, 'conversations', conversationId), {
      participants: updatedParticipants,
      'metadata.participantNames': updatedParticipantNames,
      unreadCount: updatedUnreadCount,
      updatedAt: new Date()
    })

    return NextResponse.json({ success: true, message: "Member removed successfully" })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}