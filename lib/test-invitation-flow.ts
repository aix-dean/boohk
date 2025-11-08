/**
 * Test file for invitation code flow
 * This file demonstrates how the invitation code system should work
 *
 * Expected flow:
 * 1. User visits /register?orgCode=DISQ-VVIS
 * 2. System queries invitation_codes collection with code == "DISQ-VVIS"
 * 3. System checks if max_usage > used_by.length
 * 4. If valid, system assigns role from invitation_code.role
 * 5. User registers successfully
 * 6. System updates invitation_code with:
 *    - used: true
 *    - used_count: +1
 *    - used_by: [..., newUserId]
 *    - last_used_at: timestamp
 */

import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "./firebase"

// Test function to validate invitation code logic
export async function testInvitationCodeFlow(orgCode: string) {
  console.log("Testing invitation code flow for:", orgCode)

  try {
    // Step 1: Query invitation code
    const invitationQuery = query(collection(db, "invitation_codes"), where("code", "==", orgCode))
    const invitationSnapshot = await getDocs(invitationQuery)

    if (invitationSnapshot.empty) {
      console.log("❌ No invitation code found")
      return false
    }

    const invitationDoc = invitationSnapshot.docs[0]
    const invitationData = invitationDoc.data()

    console.log("✅ Invitation code found:", invitationData)
    console.log("=== INVITATION DATA STRUCTURE DEBUG ===")
    console.log("Full invitation data keys:", Object.keys(invitationData))
    console.log("Permissions field:", invitationData.permissions)
    console.log("Permissions type:", typeof invitationData.permissions)
    console.log("Permissions length:", invitationData.permissions?.length || 0)

    // Step 2: Check max_usage validation
    const maxUsage = invitationData.max_usage || 1
    const currentUsage = invitationData.used_by ? invitationData.used_by.length : 0

    console.log(`📊 Usage check: ${currentUsage}/${maxUsage}`)

    if (currentUsage >= maxUsage) {
      console.log("❌ Invitation code has reached maximum usage")
      return false
    }

    console.log("✅ Invitation code is valid for use")

    // Step 3: Check role and permissions assignment
    const assignedRole = invitationData.role || "sales"
    const assignedPermissions = invitationData.permissions || []
    const invitationEmail = invitationData.invited_email || invitationData.email || ""
    console.log("👤 Assigned role:", assignedRole)
    console.log("🔐 Assigned permissions:", assignedPermissions)
    console.log("📧 Invitation email:", invitationEmail)
    console.log("📧 Available email fields:", {
      invited_email: invitationData.invited_email,
      email: invitationData.email
    })

    // Step 4: Simulate user registration (would normally happen in auth context)
    const mockUserId = "test-user-" + Date.now()

    const updateData: any = {
      used: true,
      used_count: (invitationData.used_count || 0) + 1,
      last_used_at: serverTimestamp(),
    }

    if (invitationData.used_by && Array.isArray(invitationData.used_by)) {
      updateData.used_by = [...invitationData.used_by, mockUserId]
    } else {
      updateData.used_by = [mockUserId]
    }

    console.log("📝 Update data:", updateData)

    // Step 5: Update invitation code (commented out for testing)
    // await updateDoc(doc(db, "invitation_codes", invitationDoc.id), updateData)
    console.log("✅ Invitation code update prepared")

    return true
  } catch (error) {
    console.error("❌ Error testing invitation code flow:", error)
    return false
  }
}

// Example usage:
// testInvitationCodeFlow("DISQ-VVIS").then(success => {
//   if (success) {
//     console.log("Invitation code flow test passed!")
//   } else {
//     console.log("Invitation code flow test failed!")
//   }
// })