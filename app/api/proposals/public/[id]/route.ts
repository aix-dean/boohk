import { type NextRequest, NextResponse } from "next/server"
import { initializeApp, getApps } from "firebase/app"
import { logProposalViewed } from "@/lib/proposal-activity-service"
import { getProposalById, verifyProposalPassword } from "@/lib/proposal-service"

// Initialize Firebase for server-side use
function getFirebaseApp() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  const existingApps = getApps()
  if (existingApps.length === 0) {
    return initializeApp(firebaseConfig)
  }
  return existingApps[0]
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: "Proposal ID is required" }, { status: 400 })
  }

  try {
    const proposal = await getProposalById(id)

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Check if proposal has a password
    if (proposal.password) {
      const url = new URL(request.url)
      const password = url.searchParams.get('password')

      if (!password) {
        return NextResponse.json({
          error: "Password required",
          requiresPassword: true
        }, { status: 401 })
      }

      const isValidPassword = await verifyProposalPassword(id, password)
      if (!isValidPassword) {
        return NextResponse.json({
          error: "Invalid password",
          requiresPassword: true
        }, { status: 401 })
      }
    }

    // Log proposal view
    try {
      await logProposalViewed(id, "public_viewer", `${proposal.client.contactPerson} (${proposal.client.company})`)
    } catch (logError) {
      console.error("Error logging proposal view:", logError)
      // Continue even if logging fails
    }

    return NextResponse.json({ success: true, proposal })
  } catch (error) {
    console.error("Error fetching public proposal:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Removed the POST method for password verification as it's no longer needed.
