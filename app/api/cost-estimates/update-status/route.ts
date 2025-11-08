import { type NextRequest, NextResponse } from "next/server"
import { updateCostEstimateStatus } from "@/lib/cost-estimate-service"

export async function POST(request: NextRequest) {
  try {
    const { costEstimateId, status, userId, rejectionReason } = await request.json()

    if (!costEstimateId || !status) {
      return NextResponse.json({ error: "Cost estimate ID and status are required" }, { status: 400 })
    }

    await updateCostEstimateStatus(costEstimateId, status, userId, rejectionReason)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating cost estimate status:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
