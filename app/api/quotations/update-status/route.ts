import { type NextRequest, NextResponse } from "next/server"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export async function POST(request: NextRequest) {
  try {
    const { quotationId, status } = await request.json()
    console.log("[v0] Update status API called with:", { quotationId, status })

    if (!quotationId || !status) {
      console.error("[v0] Missing quotationId or status:", { quotationId, status })
      return NextResponse.json({ error: "Missing quotationId or status" }, { status: 400 })
    }

    const quotationRef = doc(db, "quotations", quotationId)
    const lowerCaseStatus = status.toLowerCase()
    console.log("[v0] Updating quotation", quotationId, "status to:", lowerCaseStatus)

    await updateDoc(quotationRef, {
      status: lowerCaseStatus,
      updated: serverTimestamp(),
      ...(lowerCaseStatus === "accepted" && { accepted_at: serverTimestamp() }),
      ...(lowerCaseStatus === "rejected" && { rejected_at: serverTimestamp() }),
    })

    console.log("[v0] Quotation status updated successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating quotation status:", error)
    return NextResponse.json({ error: "Failed to update quotation status" }, { status: 500 })
  }
}
