import { db } from "@/lib/firebase"
import { collection, doc, getDoc, getDocs, query, where, addDoc, deleteDoc, updateDoc } from "firebase/firestore"

// Define types for permissions and roles
export type Permission = {
  id: string
  name: string
  description: string
  module: "sales" | "logistics" | "cms" | "admin"
  action: "view" | "create" | "edit" | "delete"
  createdAt?: number
  updatedAt?: number
}

export type Role = {
  id: string
  name: string
  description: string
  isAdmin?: boolean
  permissions?: string[] // Array of permission IDs
  createdAt?: number
  updatedAt?: number
}

export type UserRole = {
  userId: string
  roleId: string
  assignedAt?: number
}

// Update the User type to match boohk_users collection
export type User = {
  id: string
  email: string
  display_name?: string
  displayName?: string // For compatibility with both naming conventions
  first_name?: string
  middle_name?: string
  last_name?: string
  license_key?: string
  photo_url?: string
  photoURL?: string // For compatibility with both naming conventions
  phone_number?: string
  location?: string
  gender?: string
  type?: string
  active?: boolean
  onboarding?: boolean
  department?: string
  lastLogin?: any
  created?: any
  updated?: any
  signature?: any
  company_id?: string
}

// Permission Management
export async function getPermissions(): Promise<Permission[]> {
  try {
    const permissionsSnapshot = await getDocs(collection(db, "permissions"))
    return permissionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Permission)
  } catch (error) {
    console.error("Error getting permissions:", error)
    throw new Error("Failed to get permissions")
  }
}

export async function createPermission(permission: Omit<Permission, "id">): Promise<string> {
  try {
    const timestamp = Date.now()
    const permissionWithTimestamp = {
      ...permission,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const docRef = await addDoc(collection(db, "permissions"), permissionWithTimestamp)
    return docRef.id
  } catch (error) {
    console.error("Error creating permission:", error)
    throw new Error("Failed to create permission")
  }
}

export async function updatePermission(
  permissionId: string,
  permission: Partial<Omit<Permission, "id">>,
): Promise<void> {
  try {
    const permissionRef = doc(db, "permissions", permissionId)
    await updateDoc(permissionRef, {
      ...permission,
      updatedAt: Date.now(),
    })
  } catch (error) {
    console.error("Error updating permission:", error)
    throw new Error("Failed to update permission")
  }
}

export async function deletePermission(permissionId: string): Promise<void> {
  try {
    const permissionRef = doc(db, "permissions", permissionId)
    await deleteDoc(permissionRef)
  } catch (error) {
    console.error("Error deleting permission:", error)
    throw new Error("Failed to delete permission")
  }
}

// Role Management
export async function getRoles(): Promise<Role[]> {
  try {
    const rolesSnapshot = await getDocs(collection(db, "roles"))
    return rolesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Role)
  } catch (error) {
    console.error("Error getting roles:", error)
    throw new Error("Failed to get roles")
  }
}

export async function createRole(role: Omit<Role, "id" | "createdAt" | "updatedAt">): Promise<string> {
  try {
    const timestamp = Date.now()
    const roleWithTimestamp = {
      ...role,
      permissions: role.permissions || [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const docRef = await addDoc(collection(db, "roles"), roleWithTimestamp)
    return docRef.id
  } catch (error) {
    console.error("Error creating role:", error)
    throw new Error("Failed to create role")
  }
}

export async function updateRole(
  roleId: string,
  role: Partial<Omit<Role, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  try {
    const roleRef = doc(db, "roles", roleId)
    await updateDoc(roleRef, {
      ...role,
      updatedAt: Date.now(),
    })
  } catch (error) {
    console.error("Error updating role:", error)
    throw new Error("Failed to update role")
  }
}

export async function deleteRole(roleId: string): Promise<void> {
  try {
    const roleRef = doc(db, "roles", roleId)
    await deleteDoc(roleRef)
  } catch (error) {
    console.error("Error deleting role:", error)
    throw new Error("Failed to delete role")
  }
}

// Role Permission Management
export async function getRolePermissions(roleId: string): Promise<string[]> {
  try {
    const roleDoc = await getDoc(doc(db, "roles", roleId))
    if (roleDoc.exists()) {
      const role = roleDoc.data() as Role
      return role.permissions || []
    }
    return []
  } catch (error) {
    console.error("Error getting role permissions:", error)
    return []
  }
}

export async function assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
  try {
    const roleRef = doc(db, "roles", roleId)
    const roleDoc = await getDoc(roleRef)
    if (roleDoc.exists()) {
      const role = roleDoc.data() as Role
      const permissions = role.permissions || []
      if (!permissions.includes(permissionId)) {
        await updateDoc(roleRef, {
          permissions: [...permissions, permissionId],
          updatedAt: Date.now(),
        })
      }
    }
  } catch (error) {
    console.error("Error assigning permission to role:", error)
    throw new Error("Failed to assign permission to role")
  }
}

export async function removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
  try {
    const roleRef = doc(db, "roles", roleId)
    const roleDoc = await getDoc(roleRef)
    if (roleDoc.exists()) {
      const role = roleDoc.data() as Role
      const permissions = role.permissions || []
      const updatedPermissions = permissions.filter((id) => id !== permissionId)
      await updateDoc(roleRef, {
        permissions: updatedPermissions,
        updatedAt: Date.now(),
      })
    }
  } catch (error) {
    console.error("Error removing permission from role:", error)
    throw new Error("Failed to remove permission from role")
  }
}

// User Management
export async function getUsers(licenseKey?: string): Promise<User[]> {
  try {
    const usersCollection = collection(db, "boohk_users")
    let usersQuery

    // If license key is provided, filter users by license key
    if (licenseKey) {
      usersQuery = query(usersCollection, where("license_key", "==", licenseKey))
    } else {
      usersQuery = usersCollection
    }

    const usersSnapshot = await getDocs(usersQuery)
    return usersSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          // Ensure these fields are properly typed
          email: doc.data().email || "",
          displayName: doc.data().display_name || "",
          photoURL: doc.data().photo_url || "",
        }) as User,
    )
  } catch (error) {
    console.error("Error getting users:", error)
    throw new Error("Failed to get users")
  }
}
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDocRef = doc(db, "boohk_users", userId)
    const userDoc = await getDoc(userDocRef)

    if (userDoc.exists()) {
      const userData = userDoc.data()
      return {
        id: userDoc.id,
        ...userData,
        email: userData.email || "",
        displayName: userData.display_name || userData.displayName || "",
        photoURL: userData.photo_url || userData.photoURL || "",
      } as User
    }

    return null
  } catch (error) {
    console.error("Error getting user by ID:", error)
    throw new Error("Failed to get user by ID")
  }
}

// User Role Management
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    const userRolesCollection = collection(db, "user_roles")
    const userRolesQuery = query(userRolesCollection, where("userId", "==", userId))
    const userRolesSnapshot = await getDocs(userRolesQuery)

    const roleIds: string[] = []
    userRolesSnapshot.forEach((doc) => {
      roleIds.push(doc.data().roleId)
    })

    return roleIds
  } catch (error) {
    console.error("Error getting user roles:", error)
    throw new Error("Failed to get user roles")
  }
}

export async function assignRoleToUser(userId: string, roleId: string): Promise<void> {
  try {
    // Check if the user already has this role
    const userRolesCollection = collection(db, "user_roles")
    const userRolesQuery = query(userRolesCollection, where("userId", "==", userId), where("roleId", "==", roleId))
    const userRolesSnapshot = await getDocs(userRolesQuery)

    if (userRolesSnapshot.empty) {
      // User doesn't have this role yet, so assign it
      await addDoc(userRolesCollection, {
        userId,
        roleId,
        assignedAt: Date.now(),
      })

      // Update the boohk_users document with the new roles array
      try {
        const updatedRoles = await getUserRoles(userId)
        const userDocRef = doc(db, "boohk_users", userId)
        await updateDoc(userDocRef, {
          roles: updatedRoles,
          updated: new Date(),
        })
        console.log(`Updated boohk_users document with roles:`, updatedRoles)
      } catch (updateError) {
        console.error("Error updating boohk_users document:", updateError)
        // Don't fail the role assignment if updating boohk_users fails
      }
    }
  } catch (error) {
    console.error("Error assigning role to user:", error)
    throw new Error("Failed to assign role to user")
  }
}

export async function removeRoleFromUser(userId: string, roleId: string): Promise<void> {
  try {
    const userRolesCollection = collection(db, "user_roles")
    const userRolesQuery = query(userRolesCollection, where("userId", "==", userId), where("roleId", "==", roleId))
    const userRolesSnapshot = await getDocs(userRolesQuery)

    userRolesSnapshot.forEach(async (docSnapshot) => {
      await deleteDoc(doc(userRolesCollection, docSnapshot.id))
    })

    // Update the boohk_users document with the updated roles array
    try {
      const updatedRoles = await getUserRoles(userId)
      const userDocRef = doc(db, "boohk_users", userId)
      await updateDoc(userDocRef, {
        roles: updatedRoles,
        updated: new Date(),
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

// Initialize default permissions based on departmental structure and routes
export async function initializeDefaultPermissions(): Promise<void> {
  try {
    // Check if permissions already exist
    const existingPermissions = await getPermissions()
    if (existingPermissions.length > 0) {
      console.log("Permissions already initialized, skipping...")
      return
    }

    // Define default permissions based on departmental routes and functionalities
    const defaultPermissions: Omit<Permission, "id">[] = [
      // Admin module permissions
      {
        name: "View Admin Dashboard",
        description: "Access to admin dashboard and overview",
        module: "admin",
        action: "view",
      },
      {
        name: "Manage Users",
        description: "Create, edit, and manage user accounts",
        module: "admin",
        action: "edit",
      },
      {
        name: "Manage Roles and Permissions",
        description: "Create and manage roles and permissions",
        module: "admin",
        action: "edit",
      },
      {
        name: "Manage Invitation Codes",
        description: "Generate and manage invitation codes",
        module: "admin",
        action: "edit",
      },
      {
        name: "View Documents",
        description: "Access to document management",
        module: "admin",
        action: "view",
      },
      {
        name: "Manage Documents",
        description: "Upload, edit, and delete documents",
        module: "admin",
        action: "edit",
      },
      {
        name: "View Inventory",
        description: "Access to inventory management",
        module: "admin",
        action: "view",
      },
      {
        name: "Manage Inventory",
        description: "Add, edit, and manage inventory items",
        module: "admin",
        action: "edit",
      },
      {
        name: "View Chat Analytics",
        description: "Access to chat analytics and reports",
        module: "admin",
        action: "view",
      },
      {
        name: "Manage Subscriptions",
        description: "Manage subscription plans and billing",
        module: "admin",
        action: "edit",
      },

      // Sales module permissions
      {
        name: "View Sales Dashboard",
        description: "Access to sales dashboard and metrics",
        module: "sales",
        action: "view",
      },
      {
        name: "View Project Campaigns",
        description: "Access to project campaign tracking",
        module: "sales",
        action: "view",
      },
      {
        name: "Manage Project Campaigns",
        description: "Create and manage project campaigns",
        module: "sales",
        action: "edit",
      },
      {
        name: "View Proposals",
        description: "Access to view proposals",
        module: "sales",
        action: "view",
      },
      {
        name: "Create Proposals",
        description: "Create new proposals",
        module: "sales",
        action: "create",
      },
      {
        name: "Edit Proposals",
        description: "Edit existing proposals",
        module: "sales",
        action: "edit",
      },
      {
        name: "Delete Proposals",
        description: "Delete proposals",
        module: "sales",
        action: "delete",
      },
      {
        name: "View Bookings",
        description: "Access to booking management",
        module: "sales",
        action: "view",
      },
      {
        name: "Manage Bookings",
        description: "Create and manage bookings",
        module: "sales",
        action: "edit",
      },
      {
        name: "View Job Orders",
        description: "Access to job order management",
        module: "sales",
        action: "view",
      },
      {
        name: "Manage Job Orders",
        description: "Create and manage job orders",
        module: "sales",
        action: "edit",
      },
      {
        name: "View Clients",
        description: "Access to client information",
        module: "sales",
        action: "view",
      },
      {
        name: "Manage Clients",
        description: "Add, edit, and manage client information",
        module: "sales",
        action: "edit",
      },
      {
        name: "View Products",
        description: "Access to product catalog",
        module: "sales",
        action: "view",
      },
      {
        name: "Manage Products",
        description: "Add, edit, and manage products",
        module: "sales",
        action: "edit",
      },
      {
        name: "View Sales Planner",
        description: "Access to sales planning tools",
        module: "sales",
        action: "view",
      },
      {
        name: "Use Customer Chat",
        description: "Access to customer chat functionality",
        module: "sales",
        action: "view",
      },
      {
        name: "View Billings",
        description: "Access to billing information",
        module: "sales",
        action: "view",
      },
      {
        name: "Manage Billings",
        description: "Create and manage billing records",
        module: "sales",
        action: "edit",
      },

      // Logistics module permissions
      {
        name: "View Logistics Dashboard",
        description: "Access to logistics dashboard and metrics",
        module: "logistics",
        action: "view",
      },
      {
        name: "View Service Assignments",
        description: "Access to service assignment tracking",
        module: "logistics",
        action: "view",
      },
      {
        name: "Create Service Assignments",
        description: "Create new service assignments",
        module: "logistics",
        action: "create",
      },
      {
        name: "Edit Service Assignments",
        description: "Edit existing service assignments",
        module: "logistics",
        action: "edit",
      },
      {
        name: "Delete Service Assignments",
        description: "Delete service assignments",
        module: "logistics",
        action: "delete",
      },
      {
        name: "View Logistics Planner",
        description: "Access to logistics planning tools",
        module: "logistics",
        action: "view",
      },
      {
        name: "Manage Logistics Planner",
        description: "Create and manage logistics schedules",
        module: "logistics",
        action: "edit",
      },
      {
        name: "View Alerts",
        description: "Access to system alerts and notifications",
        module: "logistics",
        action: "view",
      },
      {
        name: "Manage Alerts",
        description: "Create and manage alert configurations",
        module: "logistics",
        action: "edit",
      },
      {
        name: "View Sites",
        description: "Access to site information and status",
        module: "logistics",
        action: "view",
      },
      {
        name: "Manage Sites",
        description: "Add, edit, and manage site information",
        module: "logistics",
        action: "edit",
      },
      {
        name: "View Reports",
        description: "Access to logistics reports",
        module: "logistics",
        action: "view",
      },
      {
        name: "Manage Teams",
        description: "Manage teams and personnel assignments",
        module: "logistics",
        action: "edit",
      },
      {
        name: "View Weather Data",
        description: "Access to weather information and forecasts",
        module: "logistics",
        action: "view",
      },

      // CMS module permissions
      {
        name: "View CMS Dashboard",
        description: "Access to CMS dashboard and overview",
        module: "cms",
        action: "view",
      },
      {
        name: "View CMS Planner",
        description: "Access to content planning tools",
        module: "cms",
        action: "view",
      },
      {
        name: "Manage CMS Planner",
        description: "Create and manage content schedules",
        module: "cms",
        action: "edit",
      },
      {
        name: "View Orders",
        description: "Access to content orders and requests",
        module: "cms",
        action: "view",
      },
      {
        name: "Create Orders",
        description: "Create new content orders",
        module: "cms",
        action: "create",
      },
      {
        name: "Edit Orders",
        description: "Edit existing content orders",
        module: "cms",
        action: "edit",
      },
      {
        name: "Delete Orders",
        description: "Delete content orders",
        module: "cms",
        action: "delete",
      },
      {
        name: "Manage Content",
        description: "Create, edit, and manage digital content",
        module: "cms",
        action: "edit",
      },
    ]

    // Create all permissions
    for (const permission of defaultPermissions) {
      await createPermission(permission)
    }

    console.log("Default permissions initialized successfully")
  } catch (error) {
    console.error("Error initializing default permissions:", error)
    throw new Error("Failed to initialize default permissions")
  }
}

// Initialize departmental roles
export async function initializeDepartmentalRoles(): Promise<void> {
  try {
    // Check if roles already exist
    const existingRoles = await getRoles()
    if (existingRoles.length > 0) {
      console.log("Roles already initialized, skipping...")
      return
    }

    // Define departmental roles
    const departmentalRoles = [
      {
        name: "Administrator",
        description: "Full system access with all administrative privileges",
        isAdmin: true,
      },
      {
        name: "Sales Manager",
        description: "Full access to sales module with management capabilities",
        isAdmin: false,
      },
      {
        name: "Sales Representative",
        description: "Standard sales access for day-to-day operations",
        isAdmin: false,
      },
      {
        name: "Logistics Manager",
        description: "Full access to logistics module with management capabilities",
        isAdmin: false,
      },
      {
        name: "Logistics Coordinator",
        description: "Standard logistics access for operational tasks",
        isAdmin: false,
      },
      {
        name: "CMS Manager",
        description: "Full access to content management with editing privileges",
        isAdmin: false,
      },
      {
        name: "CMS Editor",
        description: "Content creation and editing access",
        isAdmin: false,
      },
      {
        name: "Viewer",
        description: "Read-only access across all modules",
        isAdmin: false,
      },
    ]

    // Create all roles
    for (const role of departmentalRoles) {
      await createRole(role)
    }

    console.log("Departmental roles initialized successfully")
  } catch (error) {
    console.error("Error initializing departmental roles:", error)
    throw new Error("Failed to initialize departmental roles")
  }
}

// Initialize admin role (legacy function - now part of departmental roles)
export async function initializeAdminRole(): Promise<string> {
  try {
    // Check if admin role already exists
    const existingRoles = await getRoles()
    const adminRole = existingRoles.find((role) => role.name === "Administrator")

    if (adminRole) {
      console.log("Admin role already exists, skipping...")
      return adminRole.id
    }

    // Create admin role
    const adminRoleId = await createRole({
      name: "Administrator",
      description: "Full access to all system features",
      isAdmin: true,
    })

    // Get all permissions and assign them to the admin role
    const permissions = await getPermissions()
    for (const permission of permissions) {
      await assignPermissionToRole(adminRoleId, permission.id)
    }

    console.log("Admin role initialized successfully")
    return adminRoleId
  } catch (error) {
    console.error("Error initializing admin role:", error)
    throw new Error("Failed to initialize admin role")
  }
}

// Check if user has permission
export async function hasPermission(
  userId: string,
  module: "sales" | "logistics" | "cms" | "admin",
  action: "view" | "create" | "edit" | "delete",
): Promise<boolean> {
  try {
    // Get user roles
    const userRoles = await getUserRoles(userId)

    if (userRoles.length === 0) {
      return false // User has no roles
    }

    // Check each role
    for (const roleId of userRoles) {
      const roleDoc = await getDoc(doc(db, "roles", roleId))

      if (!roleDoc.exists()) {
        continue // Role doesn't exist
      }

      const role = roleDoc.data() as Role

      // Admin roles have all permissions
      if (role.isAdmin) {
        return true
      }

      // Check role permissions
      const rolePermissions = await getRolePermissions(roleId)

      if (rolePermissions.length === 0) {
        continue // Role has no permissions
      }

      // Get all permissions that match the module and action
      const permissionsQuery = query(
        collection(db, "permissions"),
        where("module", "==", module),
        where("action", "==", action),
      )

      const permissionsSnapshot = await getDocs(permissionsQuery)

      for (const permissionDoc of permissionsSnapshot.docs) {
        if (rolePermissions.includes(permissionDoc.id)) {
          return true // User has the permission through this role
        }
      }
    }

    return false // User doesn't have the permission
  } catch (error) {
    console.error("Error checking permission:", error)
    return false // Assume no permission on error
  }
}
