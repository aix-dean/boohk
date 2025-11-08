import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import type { Team, TeamMember, CreateTeamData } from "@/lib/types/team"

const TEAMS_COLLECTION = "logistics_teams"
const TEAM_MEMBERS_COLLECTION = "team_members"

// Get all teams
export async function getTeams(companyId?: string): Promise<Team[]> {
  try {
    const teamsCollection = collection(db, TEAMS_COLLECTION)
    let teamsQuery

    if (companyId) {
      teamsQuery = query(
        teamsCollection,
        where("company_id", "==", companyId),
        orderBy("createdAt", "desc")
      )
    } else {
      teamsQuery = query(teamsCollection, orderBy("createdAt", "desc"))
    }

    const snapshot = await getDocs(teamsQuery)

    const teams: Team[] = []
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      const team: Team = {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        teamType: data.teamType,
        status: data.status,
        leaderId: data.leaderId,
        leaderName: data.leaderName,
        members: await getTeamMembers(docSnap.id),
        specializations: data.specializations || [],
        location: data.location,
        contactNumber: data.contactNumber,
        email: data.email,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        company_id: data.company_id,
      }
      teams.push(team)
    }

    return teams
  } catch (error) {
    console.error("Error fetching teams:", error)
    throw new Error("Failed to fetch teams")
  }
}

// Get team by ID
export async function getTeamById(teamId: string, companyId?: string): Promise<Team | null> {
  try {
    const teamDoc = doc(db, TEAMS_COLLECTION, teamId)
    const snapshot = await getDoc(teamDoc)

    if (!snapshot.exists()) {
      return null
    }

    const data = snapshot.data()

    // Verify company_id if provided
    if (companyId && data.company_id !== companyId) {
      return null
    }

    const team: Team = {
      id: snapshot.id,
      name: data.name,
      description: data.description,
      teamType: data.teamType,
      status: data.status,
      leaderId: data.leaderId,
      leaderName: data.leaderName,
      members: await getTeamMembers(snapshot.id),
      specializations: data.specializations || [],
      location: data.location,
      contactNumber: data.contactNumber,
      email: data.email,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      createdBy: data.createdBy,
      company_id: data.company_id,
    }

    return team
  } catch (error) {
    console.error("Error fetching team:", error)
    throw new Error("Failed to fetch team")
  }
}

// Create new team
export async function createTeam(teamData: CreateTeamData, createdBy: string): Promise<string> {
  try {
    const teamsCollection = collection(db, TEAMS_COLLECTION)
    const docRef = await addDoc(teamsCollection, {
      ...teamData,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy,
    })

    return docRef.id
  } catch (error) {
    console.error("Error creating team:", error)
    throw new Error("Failed to create team")
  }
}

// Update team
export async function updateTeam(teamId: string, updates: Partial<CreateTeamData>, companyId?: string): Promise<void> {
  try {
    const teamDoc = doc(db, TEAMS_COLLECTION, teamId)

    // First verify the team belongs to the company if companyId is provided
    if (companyId) {
      const teamSnapshot = await getDoc(teamDoc)
      if (!teamSnapshot.exists() || teamSnapshot.data().company_id !== companyId) {
        throw new Error("Team not found or access denied")
      }
    }

    await updateDoc(teamDoc, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating team:", error)
    throw new Error("Failed to update team")
  }
}

// Delete team
export async function deleteTeam(teamId: string, companyId?: string): Promise<void> {
  try {
    const teamDoc = doc(db, TEAMS_COLLECTION, teamId)

    // First verify the team belongs to the company if companyId is provided
    if (companyId) {
      const teamSnapshot = await getDoc(teamDoc)
      if (!teamSnapshot.exists() || teamSnapshot.data().company_id !== companyId) {
        throw new Error("Team not found or access denied")
      }
    }

    // Delete all team members first
    const membersQuery = query(collection(db, TEAM_MEMBERS_COLLECTION), where("teamId", "==", teamId))
    const membersSnapshot = await getDocs(membersQuery)

    const deletePromises = membersSnapshot.docs.map((doc) => deleteDoc(doc.ref))
    await Promise.all(deletePromises)

    // Delete the team
    await deleteDoc(teamDoc)
  } catch (error) {
    console.error("Error deleting team:", error)
    throw new Error("Failed to delete team")
  }
}

// Get team members
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const membersQuery = query(
      collection(db, TEAM_MEMBERS_COLLECTION),
      where("teamId", "==", teamId),
      orderBy("joinedAt", "desc"),
    )
    const snapshot = await getDocs(membersQuery)

    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        specializations: data.specializations || [],
        contactNumber: data.contactNumber,
        joinedAt: data.joinedAt?.toDate() || new Date(),
        status: data.status,
      }
    })
  } catch (error) {
    console.error("Error fetching team members:", error)
    return []
  }
}

// Add team member
export async function addTeamMember(teamId: string, memberData: Omit<TeamMember, "id" | "joinedAt">): Promise<void> {
  try {
    const membersCollection = collection(db, TEAM_MEMBERS_COLLECTION)
    await addDoc(membersCollection, {
      ...memberData,
      teamId,
      joinedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error adding team member:", error)
    throw new Error("Failed to add team member")
  }
}

// Remove team member
export async function removeTeamMember(memberId: string): Promise<void> {
  try {
    const memberDoc = doc(db, TEAM_MEMBERS_COLLECTION, memberId)
    await deleteDoc(memberDoc)
  } catch (error) {
    console.error("Error removing team member:", error)
    throw new Error("Failed to remove team member")
  }
}

// Update team status
export async function updateTeamStatus(teamId: string, status: "active" | "inactive", companyId?: string): Promise<void> {
  try {
    const teamDoc = doc(db, TEAMS_COLLECTION, teamId)

    // First verify the team belongs to the company if companyId is provided
    if (companyId) {
      const teamSnapshot = await getDoc(teamDoc)
      if (!teamSnapshot.exists() || teamSnapshot.data().company_id !== companyId) {
        throw new Error("Team not found or access denied")
      }
    }

    await updateDoc(teamDoc, {
      status,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating team status:", error)
    throw new Error("Failed to update team status")
  }
}

export const teamsService = {
  getAllTeams: getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamStatus,
}
