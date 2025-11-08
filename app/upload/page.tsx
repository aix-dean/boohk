"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { db, tenantAuth } from "@/lib/firebase"
import { assignRoleToUser } from "@/lib/hardcoded-access-service"
import { useAuth } from "@/contexts/auth-context"

export default function UploadPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUserData } = useAuth()

  // Get data from URL parameters
  const email = searchParams.get('email')
  const tempPassword = searchParams.get('tempPassword')
  const newPassword = searchParams.get('newPassword')

  useEffect(() => {
    if (!email || !tempPassword || !newPassword) {
      router.push('/login')
    }
  }, [email, tempPassword, newPassword, router])

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

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsCreating(true)

    if (!email || !newPassword || !uploadedFile) {
      setError("Please upload a file to complete registration.")
      setIsCreating(false)
      return
    }

    try {
      // Fetch point_person data from companies collection
      const pointPersonData = await fetchPointPersonData(email)

      if (!pointPersonData) {
        setError("Unable to find your information. Please contact your administrator.")
        setIsCreating(false)
        return
      }

      const { point_person, company_id } = pointPersonData

      console.log("Creating user with point_person data:", point_person)

      // Create user in Firebase Auth (tenant) with new password
      const userCredential = await createUserWithEmailAndPassword(tenantAuth, email, newPassword!)
      const firebaseUser = userCredential.user

      console.log("User created in tenant:", firebaseUser.uid)

      // Create user document in iboard_users collection with type="OHPLUS"
      const userDocRef = doc(db, "iboard_users", firebaseUser.uid)
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
        role: "sales",
        permissions: [],
        created: serverTimestamp(),
        updated: serverTimestamp(),
        onboarding: false, // Skip onboarding for new users
      }

      await setDoc(userDocRef, userData)
      console.log("User document created in iboard_users collection with type OHPLUS")
      console.log("User data from point_person:", userData)

      // Assign role "sales" to user_roles collection
      try {
        await assignRoleToUser(firebaseUser.uid, "sales", firebaseUser.uid)
        console.log("Role 'sales' assigned to user_roles collection")
      } catch (roleError) {
        console.error("Error assigning role 'sales' to user_roles collection:", roleError)
      }

      // Refresh user data to update the auth context
      await refreshUserData()

      console.log("Registration completed successfully with type OHPLUS")

      // Registration successful - redirect will be handled by useEffect
    } catch (error: any) {
      console.error("Registration failed:", error)

      // Handle specific Firebase Auth errors
      if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered.")
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak. Please choose a stronger password.")
      } else {
        setError(error.message || "Registration failed. Please try again.")
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (!email || !tempPassword) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="flex flex-col w-full max-w-4xl bg-white rounded-lg md:shadow-lg overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden w-full p-6">
          <div className="flex flex-col items-center text-center">
            <Image src="public/boohk-logo.svg" alt="OH! Plus Logo" width={80} height={80} priority />
            <h2 className="mt-4 text-2xl font-light text-blue-700 leading-tight text-center">
              Complete Your Registration
            </h2>
          </div>
        </div>

        <div className="flex">
          {/* Left Section: Logo */}
          <div className="hidden md:flex flex-col items-center justify-evenly p-8 bg-gray-50 w-1/2">
            <Image src="public/boohk-logo.svg" alt="OH! Plus Logo" width={120} height={120} priority />
            <h2 className="text-3xl font-light text-blue-700 leading-tight text-center">
              Complete Your
              <br />
              Registration
            </h2>
          </div>

          {/* Right Section: Upload Form */}
          <div className="w-full md:w-1/2 p-8">
            <Card className="border-none shadow-none">
              <CardHeader className="text-center md:text-left">
                <CardTitle className="text-3xl font-bold text-gray-900">Upload Document</CardTitle>
                <CardDescription className="text-gray-600 mt-2">
                  Upload your document to complete registration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCompleteRegistration} className="space-y-6">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Email Display */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-600">Email: {email}</label>
                  </div>

                  {/* File Upload */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-4">
                      <div className="mx-auto w-12 h-12 text-gray-400">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lg font-medium text-gray-900">
                          {uploadedFile ? `✓ ${uploadedFile.name}` : "Drag and drop your file here"}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          or click to browse files
                        </p>
                      </div>
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".pdf,.txt,.doc,.docx,.csv"
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        Choose File
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
                    <p className="font-medium mb-2">📖 How to upload:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Drag your file from your computer to the area above</li>
                      <li>Or click "Choose File" to browse and select</li>
                      <li>The system will validate and complete your registration</li>
                    </ol>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
                    disabled={isCreating || !uploadedFile}
                  >
                    {isCreating ? "Creating Account..." : "Complete Registration"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}