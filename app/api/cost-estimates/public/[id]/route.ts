import { type NextRequest, NextResponse } from "next/server"
import { getCostEstimate, updateCostEstimateStatus } from "@/lib/cost-estimate-service"

// Server-side Firebase initialization
async function getFirestoreDb() {
  try {
    // Dynamically import Firebase modules
    const { initializeApp, getApps } = await import("firebase/app")
    const { getFirestore } = await import("firebase/firestore")

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }

    // Check if Firebase is already initialized
    const existingApps = getApps()
    let app

    if (existingApps.length === 0) {
      app = initializeApp(firebaseConfig)
    } else {
      app = existingApps[0]
    }

    return getFirestore(app)
  } catch (error) {
    console.error("Firebase initialization error:", error)
    throw new Error("Failed to initialize Firebase")
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: "Cost estimate ID is required" }, { status: 400 })
  }

  try {
    const costEstimate = await getCostEstimate(id)

    if (!costEstimate) {
      return NextResponse.json({ error: "Cost estimate not found" }, { status: 404 })
    }

    // If the status is 'sent', update it to 'viewed'
    if (costEstimate.status === "sent") {
      await updateCostEstimateStatus(id, "viewed")
      // Fetch again to get the updated status and timestamp
      const updatedCostEstimate = await getCostEstimate(id)
      return NextResponse.json(updatedCostEstimate)
    }

    return NextResponse.json(costEstimate)
  } catch (error) {
    console.error("Error fetching public cost estimate:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
