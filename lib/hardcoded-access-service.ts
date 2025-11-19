import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, deleteDoc, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore"

// Hardcoded role definitions
export type RoleType = "admin" | "sales" | "logistics" | "cms" | "it" | "business" | "treasury" | "accounting" | "finance"

export interface HardcodedRole {
  id: RoleType
  name: string
  description: string
  permissions: Permission[]
  color: string
}

export interface Permission {
  module: string
  actions: ("view" | "create" | "edit" | "delete")[]
  description: string
}

export interface UserRole {
  userId: string
  roleId: RoleType
  assignedAt: number
  assignedBy?: string
  createdAt: any
}

// Hardcoded roles with their permissions
export const HARDCODED_ROLES: Record<RoleType, HardcodedRole> = {
  admin: {
    id: "admin",
    name: "Administrator",
    description: "Full system access with all administrative privileges",
    color: "purple",
    permissions: [
      {
        module: "admin",
        actions: ["view", "create", "edit", "delete"],
        description: "Full admin panel access",
      },
      {
        module: "sales",
        actions: ["view", "create", "edit", "delete"],
        description: "Full sales module access",
      },
      {
        module: "logistics",
        actions: ["view", "create", "edit", "delete"],
        description: "Full logistics module access",
      },
      {
        module: "cms",
        actions: ["view", "create", "edit", "delete"],
        description: "Full CMS module access",
      },
      {
        module: "user-management",
        actions: ["view", "create", "edit", "delete"],
        description: "User and role management",
      },
      {
        module: "system-settings",
        actions: ["view", "create", "edit", "delete"],
        description: "System configuration and settings",
      },
    ],
  },
  sales: {
    id: "sales",
    name: "Sales Team",
    description: "Access to sales module and client management",
    color: "green",
    permissions: [
      {
        module: "sales",
        actions: ["view", "create", "edit", "delete"],
        description: "Full sales module access",
      },
      {
        module: "clients",
        actions: ["view", "create", "edit"],
        description: "Client management (no delete)",
      },
      {
        module: "proposals",
        actions: ["view", "create", "edit"],
        description: "Proposal management",
      },
      {
        module: "quotations",
        actions: ["view", "create", "edit"],
        description: "Quotation management",
      },
      {
        module: "bookings",
        actions: ["view", "create", "edit"],
        description: "Booking management",
      },
      {
        module: "products",
        actions: ["view"],
        description: "Product catalog viewing",
      },
      {
        module: "chat",
        actions: ["view", "create"],
        description: "Customer chat access",
      },
    ],
  },
  logistics: {
    id: "logistics",
    name: "Logistics Team",
    description: "Access to logistics operations and site management",
    color: "blue",
    permissions: [
      {
        module: "logistics",
        actions: ["view", "create", "edit", "delete"],
        description: "Full logistics module access",
      },
      {
        module: "sites",
        actions: ["view", "create", "edit"],
        description: "Site management",
      },
      {
        module: "assignments",
        actions: ["view", "create", "edit", "delete"],
        description: "Service assignment management",
      },
      {
        module: "reports",
        actions: ["view", "create", "edit"],
        description: "Report management",
      },
      {
        module: "alerts",
        actions: ["view", "create", "edit"],
        description: "Alert management",
      },
      {
        module: "planner",
        actions: ["view", "create", "edit"],
        description: "Logistics planning",
      },
      {
        module: "weather",
        actions: ["view"],
        description: "Weather data access",
      },
    ],
  },
  cms: {
    id: "cms",
    name: "Content Management",
    description: "Access to content creation and management",
    color: "orange",
    permissions: [
      {
        module: "cms",
        actions: ["view", "create", "edit", "delete"],
        description: "Full CMS module access",
      },
      {
        module: "content",
        actions: ["view", "create", "edit", "delete"],
        description: "Content creation and editing",
      },
      {
        module: "orders",
        actions: ["view", "create", "edit"],
        description: "Content order management",
      },
      {
        module: "planner",
        actions: ["view", "create", "edit"],
        description: "Content planning",
      },
      {
        module: "media",
        actions: ["view", "create", "edit", "delete"],
        description: "Media asset management",
      },
    ],
  },
  it: {
    id: "it",
    name: "IT Team",
    description: "Access to IT systems, technical support, and infrastructure management",
    color: "teal",
    permissions: [
      {
        module: "it",
        actions: ["view", "create", "edit", "delete"],
        description: "Full IT module access",
      },
      {
        module: "system-monitoring",
        actions: ["view", "create", "edit"],
        description: "System monitoring and alerts",
      },
      {
        module: "user-support",
        actions: ["view", "create", "edit"],
        description: "User support and ticketing",
      },
      {
        module: "infrastructure",
        actions: ["view", "create", "edit"],
        description: "Infrastructure management",
      },
      {
        module: "security",
        actions: ["view", "create", "edit"],
        description: "Security monitoring and management",
      },
    ],
  },
  business: {
    id: "business",
    name: "Business Development",
    description: "Access to business development, partnerships, and strategic initiatives",
    color: "purple",
    permissions: [
      {
        module: "business",
        actions: ["view", "create", "edit", "delete"],
        description: "Full business development module access",
      },
      {
        module: "partnerships",
        actions: ["view", "create", "edit"],
        description: "Partnership management",
      },
      {
        module: "market-research",
        actions: ["view", "create", "edit"],
        description: "Market research and analysis",
      },
      {
        module: "strategic-planning",
        actions: ["view", "create", "edit"],
        description: "Strategic planning and initiatives",
      },
      {
        module: "competitor-analysis",
        actions: ["view", "create", "edit"],
        description: "Competitor analysis and intelligence",
      },
    ],
  },
  treasury: {
    id: "treasury",
    name: "Treasury",
    description: "Access to treasury operations, cash management, and financial planning",
    color: "green",
    permissions: [
      {
        module: "treasury",
        actions: ["view", "create", "edit", "delete"],
        description: "Full treasury module access",
      },
      {
        module: "cash-management",
        actions: ["view", "create", "edit"],
        description: "Cash flow management",
      },
      {
        module: "financial-planning",
        actions: ["view", "create", "edit"],
        description: "Financial planning and forecasting",
      },
      {
        module: "risk-management",
        actions: ["view", "create", "edit"],
        description: "Financial risk management",
      },
      {
        module: "investments",
        actions: ["view", "create", "edit"],
        description: "Investment management",
      },
    ],
  },
  accounting: {
    id: "accounting",
    name: "Accounting",
    description: "Access to accounting operations, bookkeeping, and financial reporting",
    color: "blue",
    permissions: [
      {
        module: "accounting",
        actions: ["view", "create", "edit", "delete"],
        description: "Full accounting module access",
      },
      {
        module: "bookkeeping",
        actions: ["view", "create", "edit"],
        description: "Bookkeeping and transaction recording",
      },
      {
        module: "financial-reporting",
        actions: ["view", "create", "edit"],
        description: "Financial reporting and statements",
      },
      {
        module: "tax-management",
        actions: ["view", "create", "edit"],
        description: "Tax planning and compliance",
      },
      {
        module: "audit",
        actions: ["view", "create", "edit"],
        description: "Audit preparation and management",
      },
    ],
  },
  finance: {
    id: "finance",
    name: "Finance",
    description: "Access to finance operations, budgeting, and financial analysis",
    color: "emerald",
    permissions: [
      {
        module: "finance",
        actions: ["view", "create", "edit", "delete"],
        description: "Full finance module access",
      },
      {
        module: "budgeting",
        actions: ["view", "create", "edit"],
        description: "Budget planning and management",
      },
      {
        module: "financial-analysis",
        actions: ["view", "create", "edit"],
        description: "Financial analysis and reporting",
      },
      {
        module: "cost-control",
        actions: ["view", "create", "edit"],
        description: "Cost control and optimization",
      },
      {
        module: "procurement",
        actions: ["view", "create", "edit"],
        description: "Procurement and vendor management",
      },
    ],
  },
}

// Get all available roles
export function getAllRoles(): HardcodedRole[] {
  return Object.values(HARDCODED_ROLES)
}

// Get role by ID
export function getRoleById(roleId: RoleType): HardcodedRole | null {
  return HARDCODED_ROLES[roleId] || null
}

// Get user roles from Firestore
export async function getUserRoles(userId: string): Promise<RoleType[]> {
  try {
    console.log("=== GET USER ROLES DEBUG ===")
    console.log("Getting roles for user:", userId)

    const userRolesCollection = collection(db, "user_roles")
    const userRolesQuery = query(userRolesCollection, where("userId", "==", userId))
    const userRolesSnapshot = await getDocs(userRolesQuery)

    console.log("User roles snapshot size:", userRolesSnapshot.size)

    const roles: RoleType[] = []
    userRolesSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log("Role document data:", data)
      if (data.roleId && HARDCODED_ROLES[data.roleId as RoleType]) {
        roles.push(data.roleId as RoleType)
        console.log("Added role:", data.roleId)
      } else {
        console.log("Invalid role or role not found:", data.roleId)
      }
    })

    console.log("Final roles array:", roles)
    return roles
  } catch (error) {
    console.error("Error getting user roles:", error)
    return []
  }
}

// Assign role to user
export async function assignRoleToUser(userId: string, roleId: RoleType, assignedBy?: string): Promise<void> {
  try {
    console.log("=== ASSIGN ROLE DEBUG ===")
    console.log("Assigning role:", roleId, "to user:", userId)

    // Check if role exists
    if (!HARDCODED_ROLES[roleId]) {
      console.error("Role does not exist:", roleId)
      throw new Error(`Role ${roleId} does not exist`)
    }

    // Check if user already has this role
    const existingRoles = await getUserRoles(userId)
    console.log("Existing roles for user:", existingRoles)

    if (existingRoles.includes(roleId)) {
      console.log(`User ${userId} already has role ${roleId}`)
      return
    }

    const userRoleData: UserRole = {
      userId,
      roleId,
      assignedAt: Date.now(),
      assignedBy,
      createdAt: serverTimestamp(),
    }

    console.log("Creating role assignment document:", userRoleData)
    await addDoc(collection(db, "user_roles"), userRoleData)
    console.log(`Role ${roleId} assigned to user ${userId} successfully`)

    // Verify the role was assigned
    const updatedRoles = await getUserRoles(userId)
    console.log("Updated roles after assignment:", updatedRoles)

    // Update the boohk_users document with the new roles array
    try {
      const userDocRef = doc(db, "boohk_users", userId)
      await updateDoc(userDocRef, {
        roles: updatedRoles,
        updated: serverTimestamp()
      })
      console.log(`Updated boohk_users document with roles:`, updatedRoles)
    } catch (updateError) {
      console.error("Error updating boohk_users document:", updateError)
      // Don't fail the role assignment if updating boohk_users fails
    }
  } catch (error) {
    console.error("Error assigning role to user:", error)
    throw new Error("Failed to assign role to user")
  }
}

// Remove role from user
export async function removeRoleFromUser(userId: string, roleId: RoleType): Promise<void> {
  try {
    const userRolesCollection = collection(db, "user_roles")
    const userRolesQuery = query(userRolesCollection, where("userId", "==", userId), where("roleId", "==", roleId))
    const userRolesSnapshot = await getDocs(userRolesQuery)

    const deletePromises = userRolesSnapshot.docs.map((doc) => deleteDoc(doc.ref))
    await Promise.all(deletePromises)

    console.log(`Role ${roleId} removed from user ${userId}`)

    // Update the boohk_users document with the updated roles array
    try {
      const updatedRoles = await getUserRoles(userId)
      const userDocRef = doc(db, "boohk_users", userId)
      await updateDoc(userDocRef, {
        roles: updatedRoles,
        updated: serverTimestamp()
      })
      console.log(`Updated boohk_users document with roles after removal:`, updatedRoles)
    } catch (updateError) {
      console.error("Error updating boohk_users document after role removal:", updateError)
      // Don't fail the role removal if updating boohk_users fails
    }
  } catch (error) {
    console.error("Error removing role from user:", error)
    throw new Error("Failed to remove role from user")
  }
}

// Check if user has permission
export async function hasPermission(
  userId: string,
  module: string,
  action: "view" | "create" | "edit" | "delete",
): Promise<boolean> {
  try {
    const userRoles = await getUserRoles(userId)

    if (userRoles.length === 0) {
      return false
    }

    // Check each role for the permission
    for (const roleId of userRoles) {
      const role = HARDCODED_ROLES[roleId]
      if (!role) continue

      // Check if role has permission for this module and action
      const permission = role.permissions.find((p) => p.module === module)
      if (permission && permission.actions.includes(action)) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error("Error checking permission:", error)
    return false
  }
}

// Check if user has any of the specified roles
export async function hasRole(userId: string, roles: RoleType[]): Promise<boolean> {
  try {
    const userRoles = await getUserRoles(userId)
    return roles.some((role) => userRoles.includes(role))
  } catch (error) {
    console.error("Error checking user role:", error)
    return false
  }
}

// Check if user is admin
export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, ["admin"])
}

// Get users with specific role
export async function getUsersWithRole(roleId: RoleType): Promise<string[]> {
  try {
    const userRolesCollection = collection(db, "user_roles")
    const roleQuery = query(userRolesCollection, where("roleId", "==", roleId))
    const roleSnapshot = await getDocs(roleQuery)

    const userIds: string[] = []
    roleSnapshot.forEach((doc) => {
      userIds.push(doc.data().userId)
    })

    return userIds
  } catch (error) {
    console.error("Error getting users with role:", error)
    return []
  }
}

// Get all user role assignments (for admin purposes)
export async function getAllUserRoleAssignments(): Promise<UserRole[]> {
  try {
    const userRolesCollection = collection(db, "user_roles")
    const snapshot = await getDocs(userRolesCollection)

    const assignments: UserRole[] = []
    snapshot.forEach((doc) => {
      assignments.push(doc.data() as UserRole)
    })

    return assignments
  } catch (error) {
    console.error("Error getting all user role assignments:", error)
    return []
  }
}

// Get user's effective permissions (combined from all roles)
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    const userRoles = await getUserRoles(userId)
    const allPermissions: Permission[] = []
    const permissionMap = new Map<string, Permission>()

    // Collect all permissions from user's roles
    for (const roleId of userRoles) {
      const role = HARDCODED_ROLES[roleId]
      if (role) {
        for (const permission of role.permissions) {
          const key = permission.module
          const existing = permissionMap.get(key)

          if (!existing) {
            permissionMap.set(key, { ...permission })
          } else {
            // Merge actions (union of all actions)
            const mergedActions = Array.from(new Set([...existing.actions, ...permission.actions]))
            permissionMap.set(key, {
              ...existing,
              actions: mergedActions as ("view" | "create" | "edit" | "delete")[],
            })
          }
        }
      }
    }

    return Array.from(permissionMap.values())
  } catch (error) {
    console.error("Error getting user permissions:", error)
    return []
  }
}
