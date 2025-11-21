"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter, usePathname } from 'next/navigation'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, Timestamp, writeBatch } from "firebase/firestore"
import { tenantAuth, auth, db, TENANT_ID } from "@/lib/firebase"
import { generateLicenseKey } from "@/lib/utils"
import { assignRoleToUser, getUserRoles, type RoleType } from "@/lib/hardcoded-access-service"
import { subscriptionService } from "@/lib/subscription-service"
import type { SubscriptionData } from "@/lib/types/subscription"

import { useToast } from "@/hooks/use-toast"

interface UserData {
  uid: string
  email: string | null
  displayName: string | null
  license_key: string | null
  company_id?: string | null
  role: string | null
  roles: RoleType[] // Add roles array from user_roles collection
  permissions: string[]
  project_id?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  phone_number?: string
  gender?: string
  type?: string
  created?: Date
  updated?: Date
  onboarding?: boolean
  signature?: {
    url: string
    updated: Date | Timestamp
    type: 'text' | 'png'
  }
}

interface ProjectData {
  project_id: string
  company_name?: string
  company_location?: string
  company_website?: string
  project_name?: string
  social_media?: {
    facebook?: string
    instagram?: string
    youtube?: string
  }
  license_key?: string | null
  created?: Date
  updated?: Date
}

interface AuthContextType {
  user: FirebaseUser | null
  userData: UserData | null
  projectData: ProjectData | null
  subscriptionData: SubscriptionData | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginOHPlusOnly: (email: string, password: string) => Promise<void>
  register: (
    personalInfo: {
      email: string
      first_name: string
      last_name: string
      middle_name: string
      phone_number: string
      gender: string
    },
    companyInfo: {
      company_name: string
      company_location: string
    },
    password: string,
    orgCode?: string,
  ) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserData: (updates: Partial<UserData>) => Promise<void>
  updateProjectData: (updates: Partial<ProjectData>) => Promise<void>
  refreshUserData: () => Promise<void>
  refreshSubscriptionData: () => Promise<void>
  assignLicenseKey: (uid: string, licenseKey: string) => Promise<void>
  updateUserActivity: () => Promise<void>
  getRoleDashboardPath: (roles: RoleType[]) => string | null
  hasRole: (requiredRoles: RoleType | RoleType[]) => boolean
  startRegistration: () => void
  endRegistration: () => void
  debugUserPermissions: () => { permissions: string[], roles: RoleType[], role: string | null | undefined }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [hasInitialRedirectDone, setHasInitialRedirectDone] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const fetchSubscriptionData = useCallback(async (licenseKey: string, companyId?: string) => {
    try {
      console.log("Fetching subscription data for license key:", licenseKey, "company ID:", companyId)

      let subscription: SubscriptionData | null = null

      // Try to fetch by company_id first if available
      if (companyId) {
        try {
          subscription = await subscriptionService.getSubscriptionByCompanyId(companyId)
          console.log("Subscription found by company ID:", subscription)
        } catch (error) {
          console.log("No subscription found by company ID, trying license key")
        }
      }

      // If no subscription found by company_id, try license_key
      if (!subscription) {
        try {
          subscription = await subscriptionService.getSubscriptionByLicenseKey(licenseKey)
          console.log("Subscription found by license key:", subscription)
        } catch (error) {
          console.log("No subscription found by license key")
        }
      }

      setSubscriptionData(subscription)
      return subscription
    } catch (error) {
      console.error("Error fetching subscription data:", error)
      setSubscriptionData(null)
      return null
    }
  }, [])

  const fetchUserData = useCallback(
    async (firebaseUser: FirebaseUser) => {
      try {
        console.log("Fetching user data for UID:", firebaseUser.uid)

        // Query boohk_users collection by uid field
        const usersQuery = query(collection(db, "boohk_users"), where("uid", "==", firebaseUser.uid))
        const usersSnapshot = await getDocs(usersQuery)

        let fetchedUserData: UserData

        if (!usersSnapshot.empty) {
          const userDoc = usersSnapshot.docs[0]
          const data = userDoc.data()
          console.log("=== FETCH USER DATA DEBUG ===")
          console.log("User document data:", data)
          console.log("Permissions in user document:", data.permissions)
          console.log("Type of permissions:", typeof data.permissions)
          console.log("Length of permissions:", data.permissions?.length || 0)

          // Fetch roles from user_roles collection
          const userRoles = await getUserRoles(firebaseUser.uid)
          console.log("=== FETCH USER DATA - ROLES DEBUG ===")
          console.log("User roles from user_roles collection:", userRoles)
          console.log("User roles length:", userRoles.length)
          console.log("User roles type:", typeof userRoles)

          fetchedUserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            license_key: data.license_key || null,
            role: (userRoles.length > 0 ? userRoles[0] : null) || data.role, // Prioritize role from user_roles collection
            roles: userRoles, // Add the roles array from user_roles collection
            permissions: data.permissions || [],
            project_id: data.project_id,
            first_name: data.first_name,
            last_name: data.last_name,
            middle_name: data.middle_name,
            phone_number: data.phone_number,
            gender: data.gender,
            type: data.type,
            created: data.created?.toDate(),
            updated: data.updated?.toDate(),
            company_id: data.company_id || null,
            onboarding: data.onboarding || false,
            signature: data.signature_data ? {
              url: data.signature_data,
              updated: data.signature_updated?.toDate() || new Date(),
              type: (data.signature_type === 'text' ? 'text' : 'png') as 'text' | 'png'
            } : undefined,
            ...data,
          }

          // Sync roles between user_roles and boohk_users
          const currentRoles = data.roles || [];
          const sortedCurrent = [...currentRoles].sort();
          const sortedUserRoles = [...userRoles].sort();
          if (sortedCurrent.length !== sortedUserRoles.length || !sortedCurrent.every((r, i) => r === sortedUserRoles[i])) {
            await updateDoc(userDoc.ref, {
              roles: userRoles,
              updated: serverTimestamp()
            });
            console.log("Synced roles in boohk_users to match user_roles");
          }
        } else {
          console.log("User document doesn't exist, creating basic one")

          // Fetch roles from user_roles collection even if user doc doesn't exist
          const userRoles = await getUserRoles(firebaseUser.uid)
          console.log("=== FETCH USER DATA - ROLES DEBUG (no doc) ===")
          console.log("User roles from user_roles collection:", userRoles)
          console.log("User roles length:", userRoles.length)

          fetchedUserData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            license_key: null,
            company_id: null,
            role: userRoles.length > 0 ? userRoles[0] : null, // Use role from user_roles collection
            roles: userRoles,
            permissions: [],
            onboarding: false, // Skip onboarding for new users
            signature: undefined,
          }

          // Create the user document with uid field
          const userDocRef = doc(db, "boohk_users", firebaseUser.uid)
          const userData = {
            ...fetchedUserData,
            created: serverTimestamp(),
            updated: serverTimestamp(),
          }

          // Create wallet document atomically with user document
          const walletDocRef = doc(db, "wallets", firebaseUser.uid)
          const walletData = {
            balance: 0,
            created: serverTimestamp(),
            seller_id: firebaseUser.uid,
            seller_reference: userDocRef,
            updated: serverTimestamp(),
          }

          // Use batch to create both documents atomically
          const batch = writeBatch(db)
          batch.set(userDocRef, userData, { merge: true })
          batch.set(walletDocRef, walletData)
          await batch.commit()

          console.log("Basic user document created in boohk_users collection")
          console.log("Wallet document created in wallets collection")
          console.log("✅ Basic user and wallet documents creation completed successfully atomically")
        }

        console.log("Final fetchedUserData with roles:", fetchedUserData)
        console.log("Roles array:", fetchedUserData.roles)
        console.log("Primary role:", fetchedUserData.role)
        console.log("Final permissions in fetchedUserData:", fetchedUserData.permissions)

        setUserData(fetchedUserData)
        console.log("✅ UserData state updated with permissions:", fetchedUserData.permissions)

        // Fetch subscription data if license key is available
        if (fetchedUserData.license_key) {
          await fetchSubscriptionData(fetchedUserData.license_key, fetchedUserData.company_id || undefined)
        } else {
          setSubscriptionData(null)
        }

        if (fetchedUserData.project_id) {
          console.log("Fetching project data for project_id:", fetchedUserData.project_id)

          const projectDocRef = doc(db, "projects", fetchedUserData.project_id)
          const projectDocSnap = await getDoc(projectDocRef)

          if (projectDocSnap.exists()) {
            const projectData = projectDocSnap.data()
            console.log("Project document data:", projectData)

            setProjectData({
              project_id: projectDocSnap.id,
              company_name: projectData.company_name,
              company_location: projectData.company_location,
              company_website: projectData.company_website,
              project_name: projectData.project_name,
              social_media: projectData.social_media,
              license_key: projectData.license_key,
              created: projectData.created?.toDate(),
              updated: projectData.updated?.toDate(),
            })
          } else {
            console.log("Project document doesn't exist")
            setProjectData(null)
          }
        } else {
          console.log("No project_id found in user data")
          setProjectData(null)
        }
      } catch (error) {
        console.error("Error fetching user data or subscription:", error)
        setUserData(null)
        setProjectData(null)
        setSubscriptionData(null)
      }
    },
    [fetchSubscriptionData],
  )

  const refreshUserData = useCallback(async () => {
    if (user) {
      await fetchUserData(user)
    }
  }, [user, fetchUserData])

  const refreshSubscriptionData = useCallback(async () => {
    if (userData?.license_key) {
      await fetchSubscriptionData(userData.license_key, userData.company_id || undefined)
    }
  }, [userData, fetchSubscriptionData])

  const assignLicenseKey = useCallback(async (uid: string, licenseKey: string) => {
    try {
      console.log("Assigning license key:", licenseKey, "to user:", uid)

      const userDocRef = doc(db, "boohk_users", uid)
      await setDoc(userDocRef, { license_key: licenseKey }, { merge: true })

      setUserData((prev) => (prev ? { ...prev, license_key: licenseKey } : null))

      console.log("License key assigned successfully")
    } catch (error) {
      console.error("Error assigning license key:", error)
      throw error
    }
  }, [])

  const updateUserActivity = useCallback(async () => {
    if (!user?.uid) return

    try {
      const userDocRef = doc(db, "boohk_users", user.uid)
      await updateDoc(userDocRef, {
        lastActivity: serverTimestamp()
      })
    } catch (error) {
      console.error("Error updating user activity:", error)
    }
  }, [user?.uid])

  const startRegistration = useCallback(() => {
    setIsRegistering(true)
  }, [])

  const endRegistration = useCallback(() => {
    setIsRegistering(false)
  }, [])

  const findOHPlusAccount = async (uid: string) => {
    try {
      console.log("=== FIND OHPLUS ACCOUNT DEBUG ===")
      console.log("Checking OHPLUS account for uid:", uid)

      // Query for user document with this uid
      const usersQuery = query(collection(db, "boohk_users"), where("uid", "==", uid))
      const usersSnapshot = await getDocs(usersQuery)

      console.log("Query snapshot empty:", usersSnapshot.empty)
      console.log("Query snapshot size:", usersSnapshot.size)

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0]
        const data = userDoc.data()
        console.log("Document exists: true")
        console.log("User document data:", data)
        console.log("User data type:", data.type)
        console.log("User data uid:", data.uid)

        // Check if type is OHPLUS
        if (data.type === "OHPLUS") {
          console.log("✅ OHPLUS account found")
          return true
        } else {
          console.log("❌ User document exists but type is not OHPLUS:", data.type)
        }
      } else {
        console.log("Document exists: false")
        console.log("❌ No user document found in boohk_users collection")
        console.log("❌ This means the user registration failed to create the document")
      }

      console.log("❌ No OHPLUS account found")
      return false
    } catch (error) {
      console.error("❌ Error finding OHPLUS account:", error)
      return false
    }
  }

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      console.log("=== LOGIN DEBUG START ===")
      console.log("Attempting login for email:", email)
      console.log("Firebase project ID:", auth.app.options.projectId)
      console.log("Tenant ID:", tenantAuth.tenantId)
      console.log("Tenant auth app project ID:", tenantAuth.app.options.projectId)
      console.log("Logging in user with tenant ID:", tenantAuth.tenantId)
      // Try tenant auth only
      console.log("Trying tenant auth...")
      const userCredential = await signInWithEmailAndPassword(tenantAuth, email, password)
      console.log("✅ Tenant auth successful for user:", userCredential.user.uid)
      setUser(userCredential.user)
      await fetchUserData(userCredential.user)
    } catch (error: any) {
      console.error("❌ Login error:", error)
      console.log("=== LOGIN DEBUG END ===")
      // Don't show toast here, let the caller handle it
      setLoading(false)
      throw error
    }
  }

  const loginOHPlusOnly = async (email: string, password: string) => {
    setLoading(true)
    try {
      console.log("Logging in OHPLUS user only with tenant ID:", tenantAuth.tenantId)

      // Authenticate with Firebase using tenant ID
      const userCredential = await signInWithEmailAndPassword(tenantAuth, email, password)

      // Check if this is an OHPLUS account
      const isOHPlusAccount = await findOHPlusAccount(userCredential.user.uid)

      if (!isOHPlusAccount) {
        await signOut(tenantAuth)
        throw new Error("OHPLUS_ACCOUNT_NOT_FOUND")
      }

      setUser(userCredential.user)
      await fetchUserData(userCredential.user)
    } catch (error) {
      console.error("OHPLUS login error:", error)
      setLoading(false)
      throw error
    }
  }

  const register = async (
    personalInfo: {
      email: string
      first_name: string
      last_name: string
      middle_name: string
      phone_number: string
      gender: string
    },
    companyInfo: {
      company_name: string
      company_location: string
    },
    password: string,
    orgCode?: string,
  ) => {
    setLoading(true)
    startRegistration()
    try {
      console.log("Registering new user with tenant ID:", tenantAuth.tenantId)

      const userCredential = await createUserWithEmailAndPassword(tenantAuth, personalInfo.email, password)
      const firebaseUser = userCredential.user

      let licenseKey = generateLicenseKey()
      let companyId = null
      let assignedRoles: RoleType[] = ["sales", "it", "business", "accounting"] // Default roles for new org creators
      let invitationPermissions: string[] = [] // Initialize permissions array
      let invitationEmail: string = "" // Initialize invitation email

      if (orgCode) {
        console.log("Processing invitation code:", orgCode)
        const invitationQuery = query(collection(db, "invitation_codes"), where("code", "==", orgCode))
        const invitationSnapshot = await getDocs(invitationQuery)

        if (!invitationSnapshot.empty) {
          const invitationDoc = invitationSnapshot.docs[0]
          const invitationData = invitationDoc.data()
          console.log("Invitation data found:", invitationData)

          // Check if max_usage is still greater than used_by.length
          const maxUsage = invitationData.max_usage || 1 // Default to 1 if not set
          const currentUsage = invitationData.used_by ? invitationData.used_by.length : 0

          if (currentUsage >= maxUsage) {
            throw new Error("This invitation code has reached its maximum usage limit.")
          }

          licenseKey = invitationData.license_key || licenseKey
          companyId = invitationData.company_id || null

          // Validate and assign role and permissions from invitation
          const invitationRole = invitationData.role
          invitationPermissions = invitationData.permissions || []
          invitationEmail = invitationData.invited_email || invitationData.email || ""

          if (invitationRole && ["admin", "sales", "logistics", "cms", "it", "business", "treasury", "accounting", "finance"].includes(invitationRole)) {
            assignedRoles = [invitationRole as RoleType]
          } else {
            assignedRoles = ["sales"] // Default fallback for invited users
          }

          console.log("=== INVITATION DATA DEBUG ===")
          console.log("Full invitation data:", invitationData)
          console.log("=== ROLE ASSIGNMENT DEBUG ===")
          console.log("Invitation role from data:", invitationData.role)
          console.log("Allowed roles check:", ["admin", "sales", "logistics", "cms", "it", "business", "treasury", "accounting", "finance"].includes(invitationData.role))
          console.log("Assigned roles from invitation:", assignedRoles)
          console.log("Assigned permissions from invitation:", invitationPermissions)
          console.log("Invitation email:", invitationEmail)
          console.log("Available email fields in invitation:", {
            invited_email: invitationData.invited_email,
            email: invitationData.email
          })
          console.log("Permissions field type:", typeof invitationData.permissions)
          console.log("Permissions field value:", invitationData.permissions)

          const updateData: any = {
            used: true,
            used_count: (invitationData.used_count || 0) + 1,
            last_used_at: serverTimestamp(),
          }

          if (invitationData.used_by && Array.isArray(invitationData.used_by)) {
            updateData.used_by = [...invitationData.used_by, firebaseUser.uid]
          } else {
            updateData.used_by = [firebaseUser.uid]
          }

          await updateDoc(doc(db, "invitation_codes", invitationDoc.id), updateData)
          console.log("Invitation code marked as used")
        } else {
          console.log("No invitation found for code:", orgCode)
          assignedRoles = ["sales"] // Default for invalid invitation codes
        }

        // Validate email matches invitation email if invitation has email
        if (invitationEmail && personalInfo.email !== invitationEmail) {
          throw new Error("Email address must match the invitation code email address.")
        }
      }

      console.log("=== FINAL ROLE ASSIGNMENT ===")
      console.log("Creating user with roles:", assignedRoles)
      console.log("Roles type:", typeof assignedRoles)
      console.log("Roles value:", assignedRoles)

      // Create user document in boohk_users collection
      const userDocRef = doc(db, "boohk_users", firebaseUser.uid)
      const userData = {
        email: firebaseUser.email,
        uid: firebaseUser.uid,
        license_key: licenseKey,
        company_id: companyId,
        role: assignedRoles[0], // Primary role for backward compatibility
        permissions: invitationPermissions, // Use permissions from invitation code
        type: "OHPLUS",
        created: serverTimestamp(),
        updated: serverTimestamp(),
        first_name: personalInfo.first_name,
        last_name: personalInfo.last_name,
        middle_name: personalInfo.middle_name,
        phone_number: personalInfo.phone_number,
        gender: personalInfo.gender,
        project_id: orgCode ? null : firebaseUser.uid,
        onboarding: false, // Skip onboarding for new users
      }

      console.log("=== USER DOCUMENT CREATION DEBUG ===")
      console.log("Creating user document with data:", userData)
      console.log("Invitation permissions being set:", invitationPermissions)
      console.log("Type of invitation permissions:", typeof invitationPermissions)
      console.log("Length of invitation permissions:", invitationPermissions.length)

      // For new organizations, set company_id to the user's uid
      if (!orgCode) {
        userData.company_id = firebaseUser.uid
      }

      // Create wallet document atomically with user document
      const walletDocRef = doc(db, "wallets", firebaseUser.uid)
      const walletData = {
        balance: 0,
        created: serverTimestamp(),
        seller_id: firebaseUser.uid,
        seller_reference: userDocRef,
        updated: serverTimestamp(),
      }

      // Use batch to create both documents atomically
      const batch = writeBatch(db)
      batch.set(userDocRef, userData)
      batch.set(walletDocRef, walletData)
      await batch.commit()

      console.log("User document created in boohk_users collection")
      console.log("Wallet document created in wallets collection")
      console.log("✅ User and wallet documents creation completed successfully atomically")
      console.log("Final user data that was saved:", userData)
      console.log("Final wallet data that was saved:", walletData)

      // Also assign the roles to the user_roles collection
      try {
        for (const role of assignedRoles) {
          await assignRoleToUser(firebaseUser.uid, role, firebaseUser.uid)
          console.log("Role assigned to user_roles collection:", role)
        }
      } catch (roleError) {
        console.error("Error assigning roles to user_roles collection:", roleError)
        // Don't fail registration if role assignment fails
      }

      // Create project and company if not joining an organization
      if (!orgCode) {
        console.log("Creating new project and company for new organization")
        const projectDocRef = doc(db, "projects", firebaseUser.uid)
        await setDoc(projectDocRef, {
          company_name: companyInfo.company_name,
          company_location: companyInfo.company_location,
          project_name: "My First Project",
          license_key: licenseKey,
          created: serverTimestamp(),
          updated: serverTimestamp(),
        })

        // Create company document with the same ID as the project
        const companyDocRef = doc(db, "companies", firebaseUser.uid)
        await setDoc(companyDocRef, {
          name: companyInfo.company_name,
          address: {
            city: "",
            province: "",
            street: companyInfo.company_location,
          },
          business_type: "",
          position: "",
          website: "",
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          created_by: firebaseUser.uid,
          updated_by: firebaseUser.uid,
        })

        // Update user document to set company_id
        companyId = firebaseUser.uid
        await setDoc(userDocRef, { company_id: companyId }, { merge: true })
      }

      // Set the user and fetch data
      setUser(firebaseUser)
      await fetchUserData(firebaseUser)

      console.log("Registration completed successfully with roles:", assignedRoles)
    } catch (error) {
      console.error("Error in AuthContext register:", error)
      setLoading(false)
      endRegistration()
      throw error
    } finally {
      endRegistration()
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      console.log("Logging out user")
      await signOut(tenantAuth)
      setUser(null)
      setUserData(null)
      setProjectData(null)
      setSubscriptionData(null)
      setHasInitialRedirectDone(false)
    } catch (error) {
      console.error("Logout error:", error)
      setLoading(false)
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    try {
      console.log("Sending password reset email to:", email, "with tenant ID:", tenantAuth.tenantId)
      await sendPasswordResetEmail(tenantAuth, email)
      console.log("Password reset email sent successfully")
    } catch (error: any) {
      console.error("Password reset error:", error)

      const errorMessage =
        error.code === "auth/user-not-found"
          ? "No account found with this email address."
          : error.message || "Failed to send password reset email."

      throw new Error(errorMessage)
    }
  }

  const updateUserData = async (updates: Partial<UserData>) => {
    if (!user) throw new Error("User not authenticated.")

    console.log("Updating user data:", updates)
    const userDocRef = doc(db, "boohk_users", user.uid)
    const updatedFields = { ...updates, updated: serverTimestamp() }
    await updateDoc(userDocRef, updatedFields)

    setUserData((prev) => (prev ? { ...prev, ...updates } : null))
  }

  const updateProjectData = async (updates: Partial<ProjectData>) => {
    if (!user || !userData?.project_id) throw new Error("Project not found or user not authenticated.")

    console.log("Updating project data:", updates)
    const projectDocRef = doc(db, "projects", userData.project_id)
    const updatedFields = { ...updates, updated: serverTimestamp() }
    await updateDoc(projectDocRef, updatedFields)

    setProjectData((prev) => (prev ? { ...prev, ...updates } : null))
  }

  useEffect(() => {
    console.log("Setting up auth state listener with tenant ID:", tenantAuth.tenantId)
    const unsubscribe = onAuthStateChanged(tenantAuth, async (firebaseUser) => {
      console.log("=== AUTH STATE CHANGE ===")
      console.log("Firebase user:", firebaseUser?.uid)
      console.log("Is registering:", isRegistering)

      if (firebaseUser) {
        console.log("Auth state changed: user logged in", firebaseUser.uid)
        setUser(firebaseUser)

        // If we're in the middle of registration, skip the OHPLUS check
        // because the user document might not be created yet
        if (isRegistering) {
          console.log("Registration in progress, skipping OHPLUS check")
          return
        }

        const isOHPlusAccount = await findOHPlusAccount(firebaseUser.uid)
        console.log("Is OHPLUS account:", isOHPlusAccount)

        if (isOHPlusAccount) {
          console.log("✅ Fetching user data for OHPLUS account")
          await fetchUserData(firebaseUser)
        } else {
          console.log("Handling missing or incorrect OHPLUS account gracefully")
          const usersQuery = query(collection(db, "boohk_users"), where("uid", "==", firebaseUser.uid))
          const usersSnapshot = await getDocs(usersQuery)
          if (usersSnapshot.empty) {
            console.log("Creating new boohk_users document with OHPLUS type")
            const userRoles = await getUserRoles(firebaseUser.uid)
            const fetchedUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              license_key: null,
              company_id: null,
              role: userRoles.length > 0 ? userRoles[0] : null,
              roles: userRoles,
              permissions: [],
              onboarding: false,
              signature: undefined,
            }
            const userDocRef = doc(db, "boohk_users", firebaseUser.uid)
            const userDataToSave = {
              ...fetchedUserData,
              type: "OHPLUS",
              created: serverTimestamp(),
              updated: serverTimestamp(),
            }
            const walletDocRef = doc(db, "wallets", firebaseUser.uid)
            const walletData = {
              balance: 0,
              created: serverTimestamp(),
              seller_id: firebaseUser.uid,
              seller_reference: userDocRef,
              updated: serverTimestamp(),
            }
            const batch = writeBatch(db)
            batch.set(userDocRef, userDataToSave, { merge: true })
            batch.set(walletDocRef, walletData)
            await batch.commit()
            console.log("Created boohk_users and wallets documents")
          } else {
            console.log("Updating existing boohk_users document to set type to OHPLUS")
            const userDoc = usersSnapshot.docs[0]
            await updateDoc(userDoc.ref, {
              type: "OHPLUS",
              updated: serverTimestamp()
            })
            console.log("Updated type to OHPLUS")
          }
          await fetchUserData(firebaseUser)
        }
      } else {
        console.log("Auth state changed: user logged out")
        setUser(null)
        setUserData(null)
        setProjectData(null)
        setSubscriptionData(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [fetchUserData, isRegistering])

  // Function to check if user has a specific role or any of the roles in an array
  const hasRole = useCallback(
    (requiredRoles: RoleType | RoleType[]): boolean => {
      if (!userData) {
        console.log("hasRole: No userData available")
        return false
      }

      // Admin override
      if (userData.roles?.includes("admin")) {
        console.log("Admin override: granting access due to admin role");
        return true;
      }

      console.log("=== HAS ROLE DEBUG ===")
      console.log("Required roles:", requiredRoles)
      console.log("User roles from collection:", userData.roles)
      console.log("User role from document:", userData.role)

      // First check userData.roles (from user_roles collection)
      if (userData.roles && userData.roles.length > 0) {
        if (Array.isArray(requiredRoles)) {
          const hasRoleInCollection = requiredRoles.some((role) => userData.roles.includes(role))
          console.log("Checking roles in collection:", requiredRoles, "Result:", hasRoleInCollection)
          if (hasRoleInCollection) {
            console.log("✅ Found role in user_roles collection")
            return true
          }
        } else if (userData.roles.includes(requiredRoles)) {
          console.log("✅ Found role in user_roles collection:", requiredRoles)
          return true
        }
      }

      // Fallback: check userData.role (from boohk_users document)
      if (userData.role) {
        if (Array.isArray(requiredRoles)) {
          const hasRoleInDocument = requiredRoles.includes(userData.role as RoleType)
          console.log("Checking roles in document:", requiredRoles, "User role:", userData.role, "Result:", hasRoleInDocument)
          if (hasRoleInDocument) {
            console.log("✅ Found role in boohk_users document")
            return true
          }
        } else {
          const hasRoleInDocument = userData.role === requiredRoles
          console.log("Checking role in document:", requiredRoles, "User role:", userData.role, "Result:", hasRoleInDocument)
          if (hasRoleInDocument) {
            console.log("✅ Found role in boohk_users document")
            return true
          }
        }
      }

      console.log("❌ Role not found in either location")
      return false
    },
    [userData],
  )

  const getRoleDashboardPath = useCallback((roles: RoleType[]): string | null => {
    console.log("getRoleDashboardPath called with roles:", roles)

    if (!roles || roles.length === 0) {
      console.log("No roles found, redirecting to /it/user-management")
      return "/it/user-management"
    }

    if (roles.includes("admin") || roles.includes("sales")) {
      console.log("Has admin or sales role, redirecting to /sales/dashboard")
      return "/sales/dashboard"
    } else {
      console.log("No admin or sales role, redirecting to /it/user-management")
      return "/it/user-management"
    }
  }, [])

  // Redirect based on roles after authentication
  useEffect(() => {
    if (userData && !loading && !isRegistering && !pathname.startsWith("/account") && !hasInitialRedirectDone) {
      const path = getRoleDashboardPath(userData.roles)
      console.log("Auth context redirect: Current pathname:", pathname, "Calculated path:", path, "User roles:", userData.roles)
      if (path) {
        console.log("Auth context: Redirecting to", path)
        router.push(path)
        setHasInitialRedirectDone(true)
      }
    }
  }, [userData, loading, isRegistering, pathname, getRoleDashboardPath, router, hasInitialRedirectDone])

  // Debug function to check current user permissions
  const debugUserPermissions = useCallback(() => {
    console.log("=== CURRENT USER PERMISSIONS DEBUG ===")
    console.log("User:", user?.uid)
    console.log("UserData:", userData)
    console.log("User permissions:", userData?.permissions)
    console.log("User roles:", userData?.roles)
    console.log("User role:", userData?.role)
    return {
      permissions: userData?.permissions || [],
      roles: userData?.roles || [],
      role: userData?.role
    }
  }, [user, userData])

  const value = {
    user,
    userData,
    projectData,
    subscriptionData,
    loading,
    login,
    loginOHPlusOnly,
    register,
    logout,
    resetPassword,
    updateUserData,
    updateProjectData,
    refreshUserData,
    refreshSubscriptionData,
    assignLicenseKey,
    updateUserActivity,
    getRoleDashboardPath,
    hasRole,
    startRegistration,
    endRegistration,
    debugUserPermissions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
