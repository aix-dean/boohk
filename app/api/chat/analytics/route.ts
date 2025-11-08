import { type NextRequest, NextResponse } from "next/server"
import { chatDB } from "@/lib/chat-database-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate") || new Date().toISOString().split("T")[0]
    const endDate = searchParams.get("endDate") || startDate

    const analytics = await chatDB.getAnalytics(startDate, endDate)
    return NextResponse.json({ analytics })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, rating, feedback } = await request.json()

    if (!conversationId || !rating) {
      return NextResponse.json({ error: "Conversation ID and rating are required" }, { status: 400 })
    }

    await chatDB.rateConversation(conversationId, rating, feedback)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error rating conversation:", error)
    return NextResponse.json({ error: "Failed to rate conversation" }, { status: 500 })
  }
}
