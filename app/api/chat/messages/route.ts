import { type NextRequest, NextResponse } from "next/server"
import { chatDB } from "@/lib/chat-database-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversationId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    const messages = await chatDB.getMessages(conversationId, limit)
    return NextResponse.json({ messages })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, role, content, currentPage, responseTime } = await request.json()

    if (!conversationId || !role || !content) {
      return NextResponse.json(
        {
          error: "Conversation ID, role, and content are required",
        },
        { status: 400 },
      )
    }

    const messageId = await chatDB.addMessage(conversationId, role, content, currentPage, responseTime)

    return NextResponse.json({ messageId })
  } catch (error) {
    console.error("Error adding message:", error)
    return NextResponse.json({ error: "Failed to add message" }, { status: 500 })
  }
}
