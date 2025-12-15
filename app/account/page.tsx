"use client"

import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Camera,
  Building,
  MapPin,
  Globe,
  SquarePen,
  Save,
  Loader2,
  LogOut,
  Facebook,
  Instagram,
  Youtube,
  MoreVertical,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { type RoleType } from "@/lib/hardcoded-access-service"
import { storage, db } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { getUserProductsCount } from "@/lib/firebase-service"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { subscriptionService } from "@/lib/subscription-service"

// Department color mapping for role badges
const departmentMapping: Record<RoleType, { name: string; color: string }> = {
  admin: { name: "Administrator", color: "bg-purple-500" },
  it: { name: "IT", color: "bg-teal-500" },
  sales: { name: "Sales", color: "bg-red-500" },
  logistics: { name: "Logistics", color: "bg-blue-500" },
  cms: { name: "CMS", color: "bg-orange-500" },
  business: { name: "Business", color: "bg-purple-500" },
  treasury: { name: "Treasury", color: "bg-green-500" },
  accounting: { name: "Accounting", color: "bg-blue-500" },
  finance: { name: "Finance", color: "bg-emerald-500" }
}

// Helper function to mask the license key
const maskLicenseKey = (key: string | undefined | null) => {
  if (!key) return "N/A"
  if (key.length <= 8) return "*".repeat(key.length) // Mask entirely if too short
  const firstFour = key.substring(0, 4)
  const lastFour = key.substring(key.length - 4)
  const maskedPart = "*".repeat(key.length - 8)
  return `${firstFour}${maskedPart}${lastFour}`
}

// Helper function to format location
const formatLocation = (location: any): string => {
  if (!location) return ""

  if (typeof location === "string") {
    return location
  }

  if (typeof location === "object") {
    const parts = []
    if (location.street) parts.push(location.street)
    if (location.city) parts.push(location.city)
    if (location.province) parts.push(location.province)
    return parts.join(", ")
  }

  return ""
}

interface CompanyData {
  id: string
  name?: string
  company_location?: any // Can be string or object
  address?: any // Can be string or object
  company_website?: string
  website?: string
  photo_url?: string
  contact_person?: string
  email?: string
  phone?: string
  social_media?: {
    facebook?: string
    instagram?: string
    youtube?: string
  }
  created_by?: string
  created?: Date
  updated?: Date
}

export default function AccountPage() {
  const { user, userData, projectData, subscriptionData, loading, updateUserData, updateProjectData, logout } =
    useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [currentProductsCount, setCurrentProductsCount] = useState<number | null>(null)
  const [productsCount, setProductsCount] = useState<number | null>(null)
  const [productsLoading, setProductsLoading] = useState(true)

  const [firstName, setFirstName] = useState("")
  const [middleName, setMiddleName] = useState("")
  const [lastName, setLastName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [gender, setGender] = useState("")
  const [photoURL, setPhotoURL] = useState("")

  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [companyName, setCompanyName] = useState("")
  const [companyLocation, setCompanyLocation] = useState("")
  const [companyWebsite, setCompanyWebsite] = useState("")
  const [projectName, setProjectName] = useState("")
  const [facebook, setFacebook] = useState("")
  const [instagram, setInstagram] = useState("")
  const [youtube, setYoutube] = useState("")

  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null)
  const [companyLogoPreviewUrl, setCompanyLogoPreviewUrl] = useState<string | null>(null)
  const [isUploadingCompanyLogo, setIsUploadingCompanyLogo] = useState(false)
  const companyLogoInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()

  const fetchCompanyData = async () => {
    if (!user?.uid) return

    setCompanyLoading(true)
    try {
      let companyDoc = null
      let companyData = null

      // First, try to find company by company_id if it exists in userData
      if (userData?.company_id) {
        try {
          const companyDocRef = doc(db, "companies", userData.company_id)
          const companyDocSnap = await getDoc(companyDocRef)

          if (companyDocSnap.exists()) {
            companyDoc = companyDocSnap
            companyData = companyDocSnap.data()
          }
        } catch (error) {
          console.error("Error fetching company by company_id:", error)
        }
      }

      // If no company found by company_id, try other methods
      if (!companyDoc) {
        // Try to find company by created_by field
        let companiesQuery = query(collection(db, "companies"), where("created_by", "==", user.uid))
        let companiesSnapshot = await getDocs(companiesQuery)

        // If no company found by created_by, try to find by email or other identifiers
        if (companiesSnapshot.empty && user.email) {
          companiesQuery = query(collection(db, "companies"), where("email", "==", user.email))
          companiesSnapshot = await getDocs(companiesQuery)
        }

        // If still no company found, try to find by contact_person email
        if (companiesSnapshot.empty && user.email) {
          companiesQuery = query(collection(db, "companies"), where("contact_person", "==", user.email))
          companiesSnapshot = await getDocs(companiesQuery)
        }

        if (!companiesSnapshot.empty) {
          companyDoc = companiesSnapshot.docs[0]
          companyData = companyDoc.data()
        }
      }

      if (companyDoc && companyData) {
        const company: CompanyData = {
          id: companyDoc.id,
          name: companyData.name,
          company_location: companyData.company_location || companyData.address,
          company_website: companyData.company_website || companyData.website,
          photo_url: companyData.photo_url,
          contact_person: companyData.contact_person,
          email: companyData.email,
          phone: companyData.phone,
          social_media: companyData.social_media || {},
          created_by: companyData.created_by,
          created: companyData.created?.toDate ? companyData.created.toDate() : companyData.created_at?.toDate(),
          updated: companyData.updated?.toDate ? companyData.updated.toDate() : companyData.updated_at?.toDate(),
        }

        setCompanyData(company)
        setCompanyName(company.name || "")
        setCompanyLocation(formatLocation(company.company_location))
        setCompanyWebsite(company.company_website || "")
        setFacebook(company.social_media?.facebook || "")
        setInstagram(company.social_media?.instagram || "")
        setYoutube(company.social_media?.youtube || "")
        setCompanyLogoPreviewUrl(company.photo_url || null)
      } else {
        setCompanyData(null)
      }
    } catch (error) {
      console.error("Error fetching company data:", error)
      toast({
        title: "Error",
        description: "Failed to load company information.",
        variant: "destructive",
      })
    } finally {
      setCompanyLoading(false)
    }
  }

  const updateCompanyData = async (updates: Partial<CompanyData>) => {
    if (!companyData?.id) {
      toast({
        title: "Error",
        description: "No company found to update.",
        variant: "destructive",
      })
      return
    }

    try {
      const companyDocRef = doc(db, "companies", companyData.id)
      const updatedFields = { ...updates, updated: serverTimestamp() }
      await updateDoc(companyDocRef, updatedFields)

      setCompanyData((prev) => (prev ? { ...prev, ...updates } : null))

      toast({
        title: "Success",
        description: "Company information updated successfully!",
      })
    } catch (error: any) {
      console.error("Error updating company data:", error)
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update company information.",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error: any) {
      console.error("Logout error:", error)
      toast({
        title: "Logout Failed",
        description: error.message || "Failed to log out. Please try again.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (userData) {
      setFirstName(userData.first_name || "")
      setMiddleName(userData.middle_name || "")
      setLastName(userData.last_name || "")
      setDisplayName(userData.displayName || "")
      setPhoneNumber(userData.phone_number || "")
      setGender(userData.gender || "")
      setPhotoURL((userData as any).photo_url || "")
    }

    if (projectData) {
      setProjectName(projectData.project_name || "")
    }

    // Fetch company data
    fetchCompanyData()
  }, [user, userData, projectData, loading, router])

  useEffect(() => {
    const fetchProductCount = async () => {
      if (user && subscriptionData?.licenseKey) {
        try {
          const count = await getUserProductsCount(user.uid)
          setCurrentProductsCount(count)
        } catch (error) {
          console.error("Failed to fetch product count:", error)
          setCurrentProductsCount(0)
          toast({
            title: "Error",
            description: "Failed to load product count.",
            variant: "destructive",
          })
        }
      }
    }
    fetchProductCount()
  }, [user, subscriptionData, toast])

  useEffect(() => {
    const fetchProductsCount = async () => {
      if (user?.uid) {
        setProductsLoading(true)
        try {
          const count = await getUserProductsCount(user.uid)
          setProductsCount(count)
        } catch (error) {
          console.error("Error fetching user products count:", error)
          setProductsCount(0) // Default to 0 on error
        } finally {
          setProductsLoading(false)
        }
      }
    }

    if (user) {
      fetchProductsCount()
    }
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Update user data
      await updateUserData({
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        displayName: displayName,
        phone_number: phoneNumber,
        gender,
        ...(photoURL && { photo_url: photoURL }),
      } as any)

      // Update project data if it exists
      if (projectData) {
        await updateProjectData({
          project_name: projectName,
        })
      }

      // Update company data if it exists
      if (companyData) {
        await updateCompanyData({
          name: companyName,
          company_location: companyLocation,
          company_website: companyWebsite,
          social_media: {
            facebook,
            instagram,
            youtube,
          },
        })
      }

      setIsEditingPersonal(false)
    } catch (error: any) {
      console.error("Update error:", error)
      // Error handling is done in individual update functions
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)

    try {
      const storageRef = ref(storage, `profile_photos/${user.uid}/${Date.now()}_${file.name}`)
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      setPhotoURL(downloadURL)
      await updateUserData({ photo_url: downloadURL } as any)
      toast({
        title: "Success",
        description: "Profile photo updated successfully!",
      })
    } catch (error: any) {
      console.error("Photo upload error:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload photo.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleCompanyLogoClick = () => {
    if (companyLogoInputRef.current) {
      companyLogoInputRef.current.click()
    }
  }

  const handleCompanyLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !companyData) return

    setIsUploadingCompanyLogo(true)

    try {
      const storageRef = ref(storage, `company_logos/${user.uid}/${Date.now()}_${file.name}`)
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      // Update the company data with the new logo URL
      await updateCompanyData({ photo_url: downloadURL })

      setCompanyLogoPreviewUrl(downloadURL)
    } catch (error: any) {
      console.error("Company logo upload error:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload company logo.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingCompanyLogo(false)
      if (companyLogoInputRef.current) {
        companyLogoInputRef.current.value = ""
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Not Found</CardTitle>
            <CardDescription>Please log in to view your account details.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const maxProducts = subscriptionData?.maxProducts
  const isLimitReached = maxProducts !== null && maxProducts !== undefined && currentProductsCount !== null && currentProductsCount >= maxProducts
  const isTrial = subscriptionData?.status === "trialing"
  const daysRemaining = subscriptionData ? subscriptionService.getDaysRemaining(subscriptionData) : 0

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Logout Button - Desktop */}
        <div className="hidden md:flex justify-end mb-6">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="bg-white border-2 border-gray-400 hover:bg-gray-50"
          >
            Logout
          </Button>
        </div>

        {/* Account Details Card */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-800">Account Details</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingPersonal(!isEditingPersonal)}
                  aria-label="Edit account info"
                  className="p-2"
                >
                  <SquarePen size={16} className="text-black" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="md:hidden bg-white border-2 border-gray-400 hover:bg-gray-50"
                >
                  Logout
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Section */}
              <div className="lg:col-span-1">
                <div className="flex flex-col items-center space-y-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full border-2 border-gray-400 overflow-hidden bg-gray-100">
                      {isUploading ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 size={48} className="animate-spin text-primary" />
                        </div>
                      ) : photoURL ? (
                        <img
                          src={photoURL || "/placeholder.svg"}
                          alt={userData?.displayName || "Profile"}
                          className={`w-full h-full object-cover ${isEditingPersonal ? 'grayscale' : ''}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <User size={48} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    {isEditingPersonal && (
                      <Button
                        onClick={handlePhotoClick}
                        disabled={isUploading}
                        className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white border border-gray-400 hover:bg-gray-50 text-sm text-gray-800"
                        size="sm"
                      >
                        Choose Avatar
                      </Button>
                    )}
                  </div>
                  
                  {/* Display Name */}
                  <h2 className="text-xl font-bold text-gray-800 text-center">
                    {userData?.first_name || "Noemi"}
                  </h2>
                </div>
              </div>

              {/* Form Fields Section */}
              <div className="lg:col-span-2">
                {isEditingPersonal ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="text-sm font-bold text-gray-800">First Name:</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="mt-1"
                          placeholder="First Name"
                          maxLength={50}
                        />
                      </div>
                      <div>
                        <Label htmlFor="middleName" className="text-sm font-bold text-gray-800">Middle Name:</Label>
                        <Input
                          id="middleName"
                          type="text"
                          value={middleName}
                          onChange={(e) => setMiddleName(e.target.value)}
                          className="mt-1"
                          placeholder="Middle Name"
                          maxLength={50}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-sm font-bold text-gray-800">Last Name:</Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="mt-1"
                          placeholder="Last Name"
                          maxLength={50}
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender" className="text-sm font-bold text-gray-800">Gender:</Label>
                        <select
                          id="gender"
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="mt-1 w-full px-3 py-2 border border-gray-400 rounded-md text-sm"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-sm font-bold text-gray-800">Phone No.:</Label>
                        <div className="mt-1 flex">
                          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-400 bg-gray-100 text-sm text-gray-600">
                            +63
                          </span>
                          <Input
                            id="phone"
                            type="text"
                            value={phoneNumber.replace(/^\+63/, '')}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '') // Only allow digits
                              setPhoneNumber(value)
                            }}
                            className="rounded-l-none"
                            placeholder="Phone Number"
                            maxLength={10}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-sm font-bold text-gray-800">Email:</Label>
                        <Input
                          id="email"
                          type="email"
                          value={userData?.email || ""}
                          disabled
                          className="mt-1 bg-gray-50"
                          placeholder="Email (read-only)"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingPersonal(false)}
                        disabled={isSaving}
                        className="bg-white border-2 border-gray-400 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <span className="text-sm font-bold text-gray-800">First Name:</span>
                        <p className="text-sm font-medium text-gray-600 mt-1">
                          {userData?.first_name || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800">Middle Name:</span>
                        <p className="text-sm font-medium text-gray-600 mt-1">
                          {userData?.middle_name || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800">Last Name:</span>
                        <p className="text-sm font-medium text-gray-600 mt-1">
                          {userData?.last_name || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800">Gender:</span>
                        <p className="text-sm font-medium text-gray-600 mt-1">
                          {userData?.gender || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800">Phone No.:</span>
                        <p className="text-sm font-medium text-gray-600 mt-1">
                          {userData?.phone_number || "-"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800">Email:</span>
                        <p className="text-sm font-medium text-gray-600 mt-1">
                          {userData?.email || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department and Roles Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-gray-800">Department and Roles</CardTitle>
              <Button variant="ghost" size="sm" className="p-2">
                <MoreVertical size={24} className="text-black" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            {userData?.roles && userData.roles.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {userData.roles.map((role: RoleType) => {
                  const department = departmentMapping[role]
                  return department ? (
                    <Badge
                      key={role}
                      className={`${department.color} text-white px-4 py-2 text-sm font-bold`}
                    >
                      {department.name}
                    </Badge>
                  ) : null
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No roles assigned</p>
            )}
          </CardContent>
        </Card>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handlePhotoChange}
          disabled={isUploading}
        />
      </div>
    </div>
  )
}
