"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Mail, Lock, Upload, Car, Power, CheckCircle, Zap, Loader2, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { collection, getDocs, doc, setDoc, getDoc, addDoc, serverTimestamp, GeoPoint } from "firebase/firestore"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { db, tenantAuth } from "@/lib/firebase"
import { assignRoleToUser } from "@/lib/hardcoded-access-service"
import WelcomePage from "./welcome-page"
import Step4Welcome from "./step-4-welcome"

<style> @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap'); </style>
const createAnalyticsDocument = async () => {
  try {
    // Get user's IP address (in a real app, you'd get this from a service)
    const ipAddress = "127.0.0.1" // Placeholder - in production, get from API

    // Get user's location (placeholder coordinates for now)
    const geopoint = new GeoPoint(14.5973113, 120.9969413)

    const analyticsData = {
      action: "page_view",
      created: new Date(),
      geopoint: geopoint,
      ip_address: ipAddress,
      isGuest: true,
      page: "Home",
      platform: "WEB",
      tags: [
        {
          action: "page_view",
          isGuest: true,
          page: "Home",
          platform: "WEB",
          section: "homepage",
        },
      ],
      uid: "",
    }

    await addDoc(collection(db, "analytics_ohplus"), analyticsData)
    console.log("Analytics document created successfully")
  } catch (error) {
    console.error("Error creating analytics document:", error)
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1: email+password, 2: new password, 3: file upload
  const [isActivated, setIsActivated] = useState(false)
  const [fileName, setFileName] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [pointPersonData, setPointPersonData] = useState<any>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [pendingRegistration, setPendingRegistration] = useState<any>(null)
  const [isStartingTour, setIsStartingTour] = useState(false)
  const pointPersonDataRef = useRef<any>(null)
  const [dialogTransform, setDialogTransform] = useState('translateY(100vh)')

  const { user, userData, getRoleDashboardPath, refreshUserData, login, loginOHPlusOnly, startRegistration, endRegistration } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Redirect if already logged in
  useEffect(() => {
    if (user && userData && currentStep < 4) {
      // Use roles from userData.roles array (populated from user_roles collection)
      const userRoles = userData?.roles || []
      console.log('Redirecting with user roles:', userRoles)

      const dashboardPath = getRoleDashboardPath(userRoles as any)
      if (dashboardPath) {
        // Add a small delay to prevent immediate back-and-forth redirects
        const timer = setTimeout(() => {
          router.push(dashboardPath)
        }, 1000) // 1 second delay
        return () => clearTimeout(timer)
      } else {
        // Fallback to IT dashboard if no specific dashboard path found
        const timer = setTimeout(() => {
          router.push("/it/user-management")
        }, 1000) // 1 second delay
        return () => clearTimeout(timer)
      }
    }
  }, [user, userData, router, getRoleDashboardPath, currentStep])

  useEffect(() => {
    if (currentStep === 2) {
      setTimeout(() => setDialogTransform('translateY(0)'), 300)
    } else {
      setDialogTransform('translateY(100vh)')
    }
  }, [currentStep])

  // Fetch point_person data from companies collection
  const fetchPointPersonData = async (email: string) => {
    try {
      console.log("Fetching point_person data for email:", email)
      const companiesRef = collection(db, "companies")
      const companiesSnapshot = await getDocs(companiesRef)

      // Find the company with matching point_person.email
      for (const doc of companiesSnapshot.docs) {
        const data = doc.data()
        if (data.point_person && data.point_person.email === email) {
          console.log("Found point_person data:", data.point_person)
          return {
            point_person: data.point_person,
            company_id: doc.id,
            company_data: data
          }
        }
      }

      console.log("No point_person data found for email:", email)
      return null
    } catch (error) {
      console.error("Error fetching point_person data:", error)
      return null
    }
  }

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const trimmedEmail = email.trim()
    setEmail(trimmedEmail)

    if (!trimmedEmail || !password.trim()) {
      setError("Please enter both email and password.")
      setIsLoading(false)
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address.")
      setIsLoading(false)
      return
    }

    try {
      console.log("Attempting login for email:", trimmedEmail)
      // Attempt login first
      await login(trimmedEmail, password)
      // If successful, auth context will handle redirect
      console.log("Existing user logged in successfully")
    } catch (error: any) {
      console.error("Login attempt failed:", error)

      if (error.code === 'auth/user-not-found') {
        // Check companies collection after tenant auth fails
        console.log("User not found in tenant, checking companies collection for email:", trimmedEmail)
        const pointPersonData = await fetchPointPersonData(trimmedEmail)

        if (pointPersonData) {
          // Proceed to signup flow since company eligibility is verified
          console.log("Point person found, proceeding to signup for email:", trimmedEmail)
          setPointPersonData(pointPersonData)
          pointPersonDataRef.current = pointPersonData
          console.log('pointPersonData set to state and ref:', pointPersonData)
          setCurrentStep(2)
        } else {
          console.log("No point person found in companies collection")
          setError("Invalid email or password.")
        }
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError("Invalid email or password.")
      } else {
        setError("An error occurred during login. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all required fields.")
      setIsLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      setIsLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      setIsLoading(false)
      return
    }

    console.log("Password change validated, proceeding to file upload step")
    // Store the new password in the ref for use in step 3
    if (pointPersonDataRef.current) {
      pointPersonDataRef.current.newPassword = newPassword
    }
    setCurrentStep(3)
    setIsLoading(false)
  }

  const validateAndSetFile = (file: File) => {
    // Check if it's a PDF or text file
    const allowedTypes = ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
      // File size validation (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB.")
        return
      }
      setUploadedFile(file)
      setError("")
    } else {
      setError("Please upload a PDF or text document.")
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      validateAndSetFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      validateAndSetFile(file)
    }
  }

  const handleCompleteRegistration = async (activationData?: any, file?: File, e?: React.FormEvent) => {
    if (e) e.preventDefault()
    console.log('Starting registration completion with activationData:', activationData)
    console.log('handleCompleteRegistration called - step 3 user creation')
    console.log('File parameter:', file)
    console.log('uploadedFile state:', uploadedFile)
    setError("")
    setIsLoading(true)

    const actualFile = file || uploadedFile
    console.log('actualFile:', actualFile)
    if (!actualFile) {
      console.log('No file found, returning early')
      setError("Please upload a file to complete registration.")
      setIsLoading(false)
      return
    }
    console.log('File validation passed, continuing...')

    // Email validation - use point_person email since component state might be lost
    const userEmail = pointPersonDataRef.current?.point_person?.email
    console.log('Email to validate from point_person:', userEmail)

    if (!userEmail || !isValidEmail(userEmail)) {
      console.log('Email validation failed for:', userEmail)
      setError("Invalid email address.")
      setIsLoading(false)
      return
    }

    console.log("Email validation passed, email:", userEmail)

    try {
      console.log('Using stored point_person data...')
      console.log('pointPersonData in ref:', pointPersonDataRef.current)
      if (!pointPersonDataRef.current) {
        console.log('Point person data not found in ref - returning early')
        setError("Unable to find your information. Please contact your administrator.")
        setIsLoading(false)
        return
      }
      console.log('Point person data found in ref, continuing...')

      const { point_person, company_id } = pointPersonDataRef.current
      console.log("Point person data found:", point_person)

      // Start registration to prevent auth listener from signing out
      startRegistration()

      // Use email and password from point_person data instead of component state
      const userEmail = point_person.email
      const userPassword = pointPersonDataRef.current.newPassword || newPassword
      console.log("About to create user in Firebase Auth")
      console.log("Creating user in Firebase Auth with email:", userEmail, "password length:", userPassword.length)
      // Create user in Firebase Auth (tenant) with new password
      const userCredential = await createUserWithEmailAndPassword(tenantAuth, userEmail, userPassword)
      const firebaseUser = userCredential.user
      console.log("User created in tenant:", firebaseUser.uid)
      console.log("Created user ID:", firebaseUser.uid)
      console.log("User creation successful, proceeding to document creation")

      console.log("=== USER DOCUMENT CREATION DEBUG ===")
      console.log("Creating user document in boohk_users...")
      console.log("Firebase user UID:", firebaseUser.uid)
      console.log("Firebase user email:", firebaseUser.email)

      // Create user document in boohk_users collection with type="OHPLUS"
      const userDocRef = doc(db, "boohk_users", firebaseUser.uid)
      console.log("User document reference:", userDocRef.path)

      // Get permissions and roles from pending registration or use defaults
      const permissions = pendingRegistration?.permissions || ["admin", "it"]
      const roles = pendingRegistration?.roles || ["admin", "it"]
      console.log('Using permissions for user registration:', permissions)
      console.log('Using roles for user registration:', roles)

      // Determine primary role based on roles array
      let primaryRole = "admin" // Default role
      if (roles.includes("business")) {
        primaryRole = "business"
      } else if (roles.includes("it")) {
        primaryRole = "it"
      }

      console.log('Primary role determined:', primaryRole)

      const userData = {
        email: firebaseUser.email,
        uid: firebaseUser.uid,
        first_name: point_person.first_name || "",
        last_name: point_person.last_name || "",
        middle_name: point_person.middle_name || "",
        phone_number: point_person.phone_number || "",
        gender: point_person.gender || "",
        company_id: company_id,
        type: "OHPLUS",
        role: primaryRole,
        roles: roles, // Store the roles array
        permissions: permissions,
        activation: activationData,
        created: serverTimestamp(),
        updated: serverTimestamp(),
        onboarding: true, // Show onboarding tour for new users
      }

      console.log("User data to be saved:", userData)
      console.log("User data to be created in boohk_users:", userData)
      console.log("About to call setDoc for boohk_users")

      try {
        await setDoc(userDocRef, userData)
        console.log("✅ User document created in boohk_users collection with type OHPLUS")
        console.log("✅ setDoc completed successfully")
      } catch (setDocError: any) {
        console.error("❌ Error creating user document:", setDocError)
        console.error("❌ setDoc error details:", {
          code: setDocError.code,
          message: setDocError.message,
          stack: setDocError.stack
        })
        throw setDocError
      }

      console.log("Verifying boohk_users document creation...")
      let docSnap = await getDoc(userDocRef)

      // Retry up to 3 times if document doesn't exist immediately
      let retryCount = 0
      while (!docSnap.exists() && retryCount < 3) {
        console.log(`Document not found, retrying... (${retryCount + 1}/3)`)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        docSnap = await getDoc(userDocRef)
        retryCount++
      }

      if (!docSnap.exists()) {
        console.error("❌ Failed to create boohk_users document - document does not exist after retries")
        console.error("❌ Document reference:", userDocRef.path)
        console.error("❌ This is the critical error causing the login redirect")
        throw new Error("Failed to create boohk_users document after retries")
      }

      console.log("✅ boohk_users document verified successfully")
      console.log("✅ Document data:", docSnap.data())
      console.log("✅ User registration completed successfully - user should stay logged in")
      console.log('warren')

      console.log("=== ROLE ASSIGNMENT DEBUG ===")
      console.log("Assigning roles based on roles array:", roles)
      console.log("Firebase user UID:", firebaseUser.uid)

      // Assign roles based on roles array from step 4 selection
      try {
        // Assign all roles from the roles array
        for (const role of roles) {
          console.log(`Assigning role '${role}' to user ${firebaseUser.uid}`)
          await assignRoleToUser(firebaseUser.uid, role, firebaseUser.uid)
          console.log(`Role '${role}' assigned to user_roles collection`)
        }

        console.log("All roles assigned successfully")

        // Verify roles were assigned
        const { getUserRoles } = await import("@/lib/hardcoded-access-service")
        const assignedRoles = await getUserRoles(firebaseUser.uid)
        console.log("Verified assigned roles:", assignedRoles)
      } catch (roleError) {
        console.error("Error assigning roles to user_roles collection:", roleError)
      }

      console.log("Refreshing user data...")
      // Refresh user data to update the auth context
      await refreshUserData()
      console.log("User data refreshed")

      // End registration
      endRegistration()

      console.log("Registration completed successfully, redirecting to dashboard...")
      // Refresh user data to get the latest roles and permissions
      await refreshUserData()

      // Use roles from userData.roles array (populated from user_roles collection)
      const userRoles = userData?.roles || []
      console.log('Final user roles after registration:', userRoles)

      // For new OHPLUS users, always redirect to IT management first
      console.log('Redirecting new OHPLUS user to IT user management')
      router.push("/it/user-management")
    } catch (error: any) {
      console.error("=== REGISTRATION FAILED ===")
      console.error("Registration failed:", error)
      console.log("Error code:", error.code, "Error message:", error.message)
      console.log("handleCompleteRegistration failed - no boohk_users created")

      // End registration on error
      endRegistration()

      // Handle specific Firebase Auth errors
      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered.")
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak. Please choose a stronger password.")
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address.")
      } else {
        setError(error.message || "Registration failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setCurrentStep(1)
    setError("")
    setPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setUploadedFile(null)
    setIsDragOver(false)
    setIsActivated(false)
    setFileName("")
    setIsValidating(false)
    setPointPersonData(null)
    setShowWelcome(false)
    setPendingRegistration(null)
    pointPersonDataRef.current = null
    // Don't reset email here
  }

  const handleBackToPassword = () => {
    setCurrentStep(2)
    setError("")
    setUploadedFile(null)
    setIsDragOver(false)
    setIsActivated(false)
    setFileName("")
    setIsValidating(false)
    setShowWelcome(false)
    setPendingRegistration(null)
  }

  const handleStep4Next = (permissions: string[], roles: string[]) => {
    console.log('=== handleStep4Next CALLED ===')
    console.log('Current step before:', currentStep)
    console.log('Permissions received:', permissions)
    console.log('Roles received:', roles)

    // Store permissions and roles for later use in registration
    setPendingRegistration((prev: any) => ({
      ...prev,
      permissions: permissions,
      roles: roles
    }))

    setCurrentStep(5) // Move to welcome page
    setShowWelcome(true)
    console.log('Current step after:', currentStep)
  }

  const handleStartTour = async () => {
    console.log('=== START TOUR DEBUG ===')
    console.log('Pending registration:', pendingRegistration)

    setIsStartingTour(true)
    try {
      if (pendingRegistration) {
        console.log('Completing registration before navigation...')
        await handleCompleteRegistration(pendingRegistration.activationData, pendingRegistration.file)
      } else {
        console.error('No pending registration data found')
        setError('Registration data not found. Please restart the process.')
      }
    } finally {
      setIsStartingTour(false)
    }
  }

  const handleDragOverStep3 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeaveStep3 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDropStep3 = useCallback(async (e: React.DragEvent) => {
    console.log('=== handleDropStep3 START ===')
    console.log('Current step before:', currentStep)
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    console.log('Dropped files:', files.map(f => f.name))
    const activationFile = files.find((file) => file.name.endsWith('.lic'))
    console.log('Activation file found:', activationFile?.name)

    if (activationFile) {
      console.log('Starting validation process for file:', activationFile.name)
      console.log('Setting isValidating to true')
      setIsValidating(true)
      console.log('isValidating should now be true')
      const formData = new FormData()
      formData.append('activationKey', activationFile)

      try {
        console.log('Calling OHPlus Activation Key Validator API...')
        const response = await fetch('/api/validate-activation', {
          method: 'POST',
          body: formData
        })
        console.log('API response received, status:', response.status)
        const result = await response.json()
        console.log('API result parsed:', result)

        console.log('OHPlus Activation Key Validator API Full Success Response (200 OK):', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data: result
        })

        if (result.success) {
          console.log('=== VALIDATION SUCCESS ===')
          console.log('API returned success, proceeding with companyId validation')
          // Additional validation: check if callback companyId matches step 1 company_id
          const callbackCompanyId = result.data.companyId
          const step1CompanyId = pointPersonDataRef.current.company_id
          console.log('Comparing companyIds - Callback:', callbackCompanyId, 'Step1:', step1CompanyId)

          if (callbackCompanyId !== step1CompanyId) {
            console.log('❌ Company ID mismatch - Callback companyId:', callbackCompanyId, 'Step 1 company_id:', step1CompanyId)
            setError('Invalid activation key: Company ID does not match.')
            toast({ title: "Invalid Activation Key", description: "The activation key does not match your company. Please contact your administrator.", variant: "destructive" })
            setIsValidating(false)
            return
          }

          console.log('✅ Company ID validation passed, proceeding with registration')
          console.log('✅ File authenticated')
          setFileName(activationFile.name)
          setUploadedFile(activationFile)

          // Store registration data for later completion
          setPendingRegistration({
            activationData: result.data,
            file: activationFile
          })

          // Show success without completing registration
          setIsActivated(true)
          toast({ title: "Activation Key Validated", description: "Your license file has been successfully authenticated." })

          // Proceed to step 4
          console.log('✅ File validation successful, proceeding to step 4')
          console.log('Current step before setCurrentStep(4):', currentStep)
          setCurrentStep(4)
          console.log('Current step after setCurrentStep(4):', currentStep)
        } else {
          console.log('❌ API returned failure:', result)
          setError(result.error || 'Invalid activation key')
          toast({ title: "Invalid Activation Key", description: result.error || "The uploaded file is not a valid activation key.", variant: "destructive" })
        }
      } catch (error) {
        console.error('Failed to validate activation key, error:', error)
        setError('Failed to validate activation key')
      } finally {
        // Add minimum delay to ensure loading GIF is visible
        console.log('Setting isValidating to false after timeout')
        setTimeout(() => {
          console.log('Timeout reached, setting isValidating to false')
          setIsValidating(false)
        }, 2000)
      }
    } else {
      console.log('No .lic file found in dropped files')
      setError("Please upload a valid .lic activation key file.")
      toast({ title: "Invalid File Type", description: "Please upload a valid .lic activation key file.", variant: "destructive" })
    }
  }, [])

  const handleFileSelectStep3 = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('=== handleFileSelectStep3 START ===')
    console.log('Current step before:', currentStep)
    const files = e.target.files
    console.log('Selected files:', files ? Array.from(files).map(f => f.name) : 'none')
    if (files && files.length > 0) {
      const file = files[0]
      console.log('Processing file:', file.name)
      if (file.name.endsWith('.lic')) {
        console.log('Starting validation process for file:', file.name)
        console.log('Setting isValidating to true')
        setIsValidating(true)
        console.log('isValidating should now be true')
        const formData = new FormData()
        formData.append('activationKey', file)

        try {
          console.log('Calling OHPlus Activation Key Validator API...')
          const response = await fetch('/api/validate-activation', {
            method: 'POST',
            body: formData
          })
          console.log('API response received, status:', response.status)
          const result = await response.json()
          console.log('API result parsed:', result)

          console.log('OHPlus Activation Key Validator API Full Success Response (200 OK):', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries()),
            data: result
          })

          if (result.success) {
            console.log('=== FILE SELECT VALIDATION SUCCESS ===')
            console.log('API returned success, proceeding with companyId validation')
            // Additional validation: check if callback companyId matches step 1 company_id
            const callbackCompanyId = result.data.companyId
            const step1CompanyId = pointPersonDataRef.current.company_id
            console.log('Comparing companyIds - Callback:', callbackCompanyId, 'Step1:', step1CompanyId)

            if (callbackCompanyId !== step1CompanyId) {
              console.log('❌ Company ID mismatch - Callback companyId:', callbackCompanyId, 'Step 1 company_id:', step1CompanyId)
              setError('Invalid activation key: Company ID does not match.')
              toast({ title: "Invalid Activation Key", description: "The activation key does not match your company. Please contact your administrator.", variant: "destructive" })
              setIsValidating(false)
              return
            }

            console.log('✅ Company ID validation passed, proceeding with registration')
            console.log('✅ File authenticated')
            setFileName(file.name)
            setUploadedFile(file)

            // Store registration data for later completion
            setPendingRegistration({
              activationData: result.data,
              file: file
            })

            // Show success without completing registration
            setIsActivated(true)
            toast({ title: "Activation Key Validated", description: "Your license file has been successfully authenticated." })

            // Proceed to step 4
            console.log('✅ File validation successful in file select, proceeding to step 4')
            console.log('Current step before setCurrentStep(4):', currentStep)
            setCurrentStep(4)
            console.log('Current step after setCurrentStep(4):', currentStep)
          } else {
            console.log('❌ File not valid, result:', result)
            setError(result.error || 'Invalid activation key')
            toast({ title: "Invalid Activation Key", description: result.error || "The uploaded file is not a valid activation key.", variant: "destructive" })
          }
        } catch (error) {
          console.error('Failed to validate activation key, error:', error)
          setError('Failed to validate activation key')
        } finally {
          // Add minimum delay to ensure loading GIF is visible
          console.log('Setting isValidating to false after timeout')
          setTimeout(() => {
            console.log('Timeout reached, setting isValidating to false')
            setIsValidating(false)
          }, 2000)
        }
      } else {
        console.log('File does not end with .lic')
        setError("Please upload a valid .lic activation key file.")
        toast({ title: "Invalid File Type", description: "Please upload a valid .lic activation key file.", variant: "destructive" })
      }
    } else {
      console.log('No files selected')
    }
  }, [])

  if (showWelcome) {
    return <WelcomePage onStartTour={handleStartTour} userName={pointPersonDataRef.current?.point_person?.first_name} isLoading={isStartingTour} />
  }

  if (currentStep === 4) {
    console.log('=== RENDERING STEP 4 ===')
    console.log('Current step is 4, showing Welcome screen')
    console.log('pointPersonDataRef.current:', pointPersonDataRef.current)
    return <Step4Welcome onNext={handleStep4Next} />
  }

  if (currentStep === 5) {
    return <WelcomePage onStartTour={handleStartTour} userName={pointPersonDataRef.current?.point_person?.first_name} />
  }

  console.log('=== RENDER CHECK ===')
  console.log('Current step:', currentStep)
  console.log('showWelcome:', showWelcome)
  console.log('isActivated:', isActivated)
  console.log('isValidating:', isValidating)

  if (currentStep === 3) {
    console.log('Rendering step 3, isValidating:', isValidating)
  }

  return currentStep === 3 ? (
    <div className="min-h-screen flex">
      {isValidating && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <img src="/boohk-loading.gif" alt="Loading" style={{ width: '419px', height: '419px', flexShrink: 0 }} />
        </div>
      )}
      {/* Left side - Content */}
      <div className="flex-1 bg-white flex items-center justify-center p-8">
        <div className="max-w-xl w-full space-y-6">
          {/* Avatar */}
          <Image
            src="/owen-face.png"
            alt="User avatar"
            width={49}
            height={49}
            className="rounded-full"
          />

          {/* Heading */}
          <div>
            <h1 style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '30px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%' }} className="mb-4">
              Alright {pointPersonDataRef.current?.point_person?.first_name || "User"},
              <br />
              {"we're almost"}
              <br />
              set!
            </h1>
            <p style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '120%' }}>
              Just upload the license key from your <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '120%' }}>Boohk Key</span> so
              we can unlock your account.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Upload area with illustration */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <Image
          src="/login-image-3.png"
          alt="Background"
          fill
          className="object-cover -z-10"
        />
        <img src="/boohk-logo.png" width="62" height="77.5" style={{position: 'absolute', top: '20px', right: '20px', flexShrink: 0, padding: '16px'}} />
        {/* Floating geometric shapes */}
        <div className="absolute inset-0">
          {/* Various floating cubes and rectangles */}
          <div className="absolute top-20 left-20 w-16 h-16 bg-cyan-400 rounded-lg transform rotate-12 opacity-80"></div>
          <div className="absolute top-32 right-32 w-12 h-20 bg-pink-400 rounded-lg transform -rotate-6 opacity-70"></div>
          <div className="absolute top-60 left-32 w-20 h-12 bg-purple-400 rounded-lg transform rotate-45 opacity-60"></div>
          <div className="absolute bottom-40 right-20 w-14 h-14 bg-blue-300 rounded-lg transform -rotate-12 opacity-80"></div>
          <div className="absolute bottom-60 left-16 w-18 h-10 bg-pink-300 rounded-lg transform rotate-30 opacity-70"></div>
          <div className="absolute top-40 right-16 w-10 h-16 bg-cyan-300 rounded-lg transform -rotate-45 opacity-60"></div>
        </div>

        {/* Main upload area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative max-w-sm w-full -mt-16  flex flex-col items-center justify-center">
            <Image
              src="/login-image-4.svg"
              alt="License upload area"
              width={85}
              height={85}
              className={`rounded-2xl transition-all duration-300 cursor-pointer ${
                isDragOver ? "scale-105 shadow-lg ring-4 ring-cyan-400" : ""
              } ${isActivated ? "ring-4 ring-green-400" : ""}`}
              onDragOver={handleDragOverStep3}
              onDragLeave={handleDragLeaveStep3}
              onDrop={handleDropStep3}
              onClick={() => document.getElementById('activation-file-upload')?.click()}
            />
            <div
              style={{
                color: 'var(--Foundational-Colors-White, #FFF)',
                textAlign: 'center',
                fontFamily: 'Inter',
                fontSize: '16px',
                fontStyle: 'normal',
                fontWeight: 600,
                lineHeight: '100%'
              }}
              dangerouslySetInnerHTML={{ __html: "Drag & Drop<br>or browse" }}
            />
            <input
              type="file"
              id="activation-file-upload"
              className="hidden"
              accept=".lic"
              onChange={handleFileSelectStep3}
            />
            {isValidating && (
              <div className="absolute inset-0 flex items-center justify-center  -ml-32 bg-black/50 rounded-2xl">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-12 mx-auto animate-spin" />
                  <p className="text-lg font-medium">Validating License Key...</p>
                </div>
              </div>
            )}
            {isActivated && (
              <div className="absolute inset-0 flex items-center justify-center -mt-16 -ml-16 bg-black/50 rounded-2xl">
                <div className="text-center text-white">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg font-medium">License Key Validated!</p>
                  <p className="text-sm">Key "{fileName}" authenticated.</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  ) : (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header - Only visible on mobile */}
      <div className="md:hidden w-full p-6 bg-white border-b border-gray-200">
        <div className="flex flex-col items-center text-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2 mb-4">
            <img src="/boohk-text-login.png" alt="boohk" style={{width: 'auto', height: '24px'}} />
          </div>
          <h2 className="text-xl font-light text-gray-700 leading-tight">
            Powering smarter site management
            <br />
            for billboard operators.
          </h2>
        </div>
      </div>



      {/* Left side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white p-8 order-1 md:order-1 min-h-0">
        {/* Full width container for login form */}
        <div className="w-full max-w-xs space-y-6 flex-1 flex flex-col justify-center px-5">
          <div className="space-y-2">
            <h1 style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '30px', fontStyle: 'normal', fontWeight: '700', lineHeight: '100%' }}>Welcome!</h1>
          </div>

          <div className="space-y-4">
            {(currentStep === 1 || currentStep === 2) ? (
              <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm text-gray-600">
                    Username
                  </Label>
                  <Input id="username" type="text" placeholder="Username" className="h-12" style={{ borderRadius: '10px', border: '1.2px solid var(--GREY, #C4C4C4)', background: '#FFF', width: '275px', height: '24px', flexShrink: 0 }} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-gray-600">
                    Password
                  </Label>
                  <Input id="password" type="password" placeholder="Password" className="h-12" style={{ borderRadius: '10px', border: '1.2px solid var(--GREY, #C4C4C4)', background: '#FFF', width: '275px', height: '24px', flexShrink: 0 }} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                {/* Forgot Password link */}
                <div className="flex justify-end mb-4">
                  <button
                    type="button"
                    style={{
                      color: 'var(--LINK-BLUE, #2D3FFF)',
                      textAlign: 'right',
                      fontFamily: 'Inter',
                      fontSize: '12px',
                      fontStyle: 'normal',
                      fontWeight: '700',
                      lineHeight: '12px'
                    }}
                    onClick={() => {
                      router.push('/forgot-password');
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button style={{ borderRadius: '10px', background: 'var(--DARK-BLUEEE, #1D0BEB)', width: '275px', height: '27px', flexShrink: 0 }} className="w-full h-12 text-white font-medium" type="submit" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Login"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {/* Promotional text at the bottom of the first column */}
        <div className="mt-auto pt-6 text-start">
          <p className="text-gray-500 italic text-sm leading-relaxed" style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'italic', fontWeight: 400, lineHeight: '118%' }}>
            Looking to streamline your OOH business? Explore our ERP with a free demo. Email us at{" "}
            <span className="font-bold">inquiry@aix.ph</span>
          </p>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden md:flex flex-1 relative order-2 md:order-2">
        <div className="w-full h-full">
          <Image
            src="/login-image-1.png"
            alt="Login illustration"
            fill

            priority
          />
        </div>
        <img src="/boohk-logo.png" width="62" height="77.5" style={{position: 'absolute', top: '20px', right: '20px', flexShrink: 0, padding: '16px'}} />
        <img src="/boohk-text-login.png" alt="boohk" style={{position: 'absolute', bottom: 50, left: 20, width: 'auto', height: '60px', paddingLeft: '20px', paddingBottom: '20px'}} />
        <div style={{position: 'absolute', bottom: 20, left: 20, color: '#FFF', fontFamily: 'Inter', fontSize: '25.734px', fontWeight: 600, lineHeight: '100%', paddingLeft: '20px', paddingBottom: '20px'}}>OOH Retail Solutions</div>
      </div>

      {/* Password Setup Dialog */}
      <Dialog open={currentStep === 2} onOpenChange={(open) => { if (!open) setCurrentStep(1); }}>
        <DialogContent className="bg-white rounded-[50px] shadow-lg p-8 w-full flex [animation-duration:0s]" style={{width: '800px', minHeight: '359px', flexShrink: 0, position: 'fixed', top: '50%', left: '50%', transform: `translate(-50%, -50%) ${dialogTransform}`, transition: 'transform 0.5s ease-out'}}>
<div className="flex-1 flex items-center justify-center flex-shrink-0">
  <Image
    src="/owen-face-1.png"
    alt="Login illustration"
    width={160}
    height={160}
    className="rounded-lg"
  />
</div>
            <div className="flex-1  space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="mt-0 -mt-4" style={{ marginTop: '0' }}>
                <h1 style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '30px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%', paddingBottom: '10px' }}>Hey {pointPersonDataRef.current?.point_person?.first_name || email}!</h1>

                <p style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>
                  {"It's great to finally meet you. I'm "}

                  <span style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 700, lineHeight: '100%' }}>Ohwen</span>
                  {", your OHPlus buddy."}
                  <br />
                  <br />
                </p>
                <p style={{ color: 'var(--LIGHTER-BLACK, #333)', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', fontWeight: 300, lineHeight: '100%' }}>
                  {
                    "Before we jump into the exciting stuff, let's set up a new password to keep your account safe and secure."
                  }
                </p>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="space-y-3">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Input
                    type="password"
                    placeholder="New password"
                    className="h-11 border-gray-200 rounded-lg text-[12.004px] placeholder:text-[#A1A1A1] placeholder:font-[Inter] placeholder:text-[12.004px] placeholder:font-medium placeholder:leading-[100%]"
                    style={{ width: '275px', height: '24px', flexShrink: 0, textAlign: 'left', verticalAlign: 'middle' }}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    className="h-11 border-gray-200 rounded-lg text-[12.004px] placeholder:text-[#A1A1A1] placeholder:font-[Inter] placeholder:text-[12.004px] placeholder:font-medium placeholder:leading-[100%]"
                    style={{ width: '275px', height: '24px', flexShrink: 0, textAlign: 'left', verticalAlign: 'middle' }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg mt-4" style={{ width: '275px', height: '24px', flexShrink: 0, borderRadius: '10px', background: '#1D0BEB' }} type="submit" disabled={isLoading}>
                  {isLoading ? "Processing..." : "OK"}
                </Button>
              </form>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
