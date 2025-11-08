"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Building,
  Folder,
  Edit,
  Save,
  X,
  File,
  Download,
  Upload,
} from "lucide-react"
import { CompanyService } from "@/lib/company-service"
import type { CompanyData } from "@/lib/types/company"
import { FileBrowser } from "@/components/file-browser"
import { GenericSuccessDialog } from "@/components/generic-success-dialog"

export default function AdminCompanyPage() {
  const { user, userData } = useAuth()
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [logoUploadProgress, setLogoUploadProgress] = useState(0)
  const [profileUploadProgress, setProfileUploadProgress] = useState(0)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingProfile, setIsUploadingProfile] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: {
      city: "",
      province: "",
      street: "",
    } as Record<string, string>,
    tin: "",
    email: "",
    phone: "",
    website: "",
    company_profile: "",
    logo: "",
    business_type: "",
    position: "",
  })

  useEffect(() => {
    if (userData?.company_id) {
      loadCompanyData()
    } else {
      setIsLoading(false)
    }
  }, [userData])

  const loadCompanyData = async () => {
    if (!userData?.company_id || !user?.uid) return

    try {
      const data = await CompanyService.getCompanyData(userData.company_id)
      if (data) {
        setCompanyData(data)
        setFormData({
          name: data.name,
          address: {
            city: data.address?.city || "",
            province: data.address?.province || "",
            street: data.address?.street || "",
          },
          tin: data.tin || "",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
          company_profile: data.company_profile || "",
          logo: data.logo || "",
          business_type: data.business_type || "",
          position: data.position || "",
        })
      }
    } catch (error) {
      console.error("Error loading company data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!userData?.company_id || !user?.uid) return

    // Validate phone number
    if (formData.phone) {
      const phoneWithoutSpaces = formData.phone.replace(/\s/g, '')
      if (!/^(\+63|0)[0-9]{10,11}$/.test(phoneWithoutSpaces)) {
        alert("Please enter a valid Philippine phone number")
        return
      }
    }

    setIsSaving(true)
    try {
      await CompanyService.updateCompanyData(userData.company_id, user.uid, formData)
      await loadCompanyData()
      setIsEditing(false)
      setShowSaveSuccess(true)
    } catch (error) {
      console.error("Error saving company data:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (companyData) {
      setFormData({
        name: companyData.name,
        address: {
          city: companyData.address?.city || "",
          province: companyData.address?.province || "",
          street: companyData.address?.street || "",
        },
        tin: companyData.tin || "",
        email: companyData.email || "",
        phone: companyData.phone || "",
        website: companyData.website || "",
        company_profile: companyData.company_profile || "",
        logo: companyData.logo || "",
        business_type: companyData.business_type || "",
        position: companyData.position || "",
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!userData?.company_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Company Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            You are not associated with any company yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600 mt-1">Manage your company details and files</p>
        </div>
        <div className="flex items-center space-x-3">
          {companyData && (
            <Badge variant="outline" className="px-3 py-1">
              {companyData.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Company Details Section - Fixed width */}
        <div className="w-80 border-r bg-white flex flex-col">
          <Card className="flex-1 border-0 rounded-none">
            <CardHeader className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-lg font-semibold">
                  <Building className="h-5 w-5" />
                  <span>Profile</span>
                </CardTitle>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {/* Company Name - Centered */}
                <div className="text-center">
                  <Label htmlFor="name" className="text-xs font-medium text-gray-600">Company Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={!isEditing}
                    className="text-center text-base font-medium mt-1 h-8"
                  />
                </div>

                {/* Company Logo */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Company Logo</Label>
                  {formData.logo ? (
                    <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                      <div className="flex items-center space-x-2">
                        <img
                          src={formData.logo}
                          alt="Company Logo"
                          className="h-8 w-8 object-cover rounded"
                        />
                        <span className="text-xs text-gray-700">Company Logo</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(formData.logo, '_blank')}
                          className="h-6 w-6 p-0"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, logo: "" }))}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                      <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600 mb-1">Upload Company Logo</p>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file && userData?.company_id && user?.uid) {
                            setIsUploadingLogo(true)
                            setLogoUploadProgress(0)
                            try {
                              // Simulate progress for better UX
                              const progressInterval = setInterval(() => {
                                setLogoUploadProgress(prev => {
                                  const newProgress = prev + Math.random() * 20
                                  return newProgress > 90 ? 90 : newProgress
                                })
                              }, 200)

                              const uploadResult = await CompanyService.uploadFile(file, userData.company_id, user.uid, "logos")

                              clearInterval(progressInterval)
                              setLogoUploadProgress(100)

                              if (uploadResult.success && uploadResult.file) {
                                setFormData(prev => ({ ...prev, logo: uploadResult.file!.url }))
                                setTimeout(() => {
                                  setShowUploadSuccess(true)
                                  setIsUploadingLogo(false)
                                  setLogoUploadProgress(0)
                                }, 500)
                              } else {
                                setIsUploadingLogo(false)
                                setLogoUploadProgress(0)
                              }
                            } catch (error) {
                              console.error("Error uploading logo:", error)
                              setIsUploadingLogo(false)
                              setLogoUploadProgress(0)
                            }
                          }
                        }}
                        disabled={!isEditing || isUploadingLogo}
                        className="hidden"
                        id="company-logo"
                      />
                      <Label
                        htmlFor="company-logo"
                        className={`cursor-pointer text-xs ${isUploadingLogo ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
                      >
                        {isUploadingLogo ? 'Uploading...' : 'Choose file'}
                      </Label>
                      {isUploadingLogo && (
                        <div className="mt-2 space-y-1">
                          <Progress value={logoUploadProgress} className="h-2" />
                          <p className="text-xs text-gray-500">{Math.round(logoUploadProgress)}%</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <Label htmlFor="address" className="text-xs font-medium text-gray-600">Address</Label>
                  <Input
                    id="address"
                    value={`${formData.address.street} ${formData.address.city} ${formData.address.province}`.trim()}
                    onChange={(e) => {
                      // For simplicity, we'll just update the street field
                      // In a real app, you might want a more sophisticated address parser
                      setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, street: e.target.value }
                      }))
                    }}
                    disabled={!isEditing}
                    placeholder="Enter full address"
                    className="h-8 text-sm"
                  />
                </div>

                {/* TIN */}
                <div className="space-y-1">
                  <Label htmlFor="tin" className="text-xs font-medium text-gray-600">TIN</Label>
                  <Input
                    id="tin"
                    value={formData.tin}
                    onChange={(e) => setFormData(prev => ({ ...prev, tin: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Tax Identification Number"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs font-medium text-gray-600">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="company@example.com"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Contact No. */}
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs font-medium text-gray-600">Contact No.</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow only numbers, spaces, hyphens, and plus sign
                      const sanitized = value.replace(/[^0-9+\-\s]/g, '')
                      setFormData(prev => ({ ...prev, phone: sanitized }))
                    }}
                    disabled={!isEditing}
                    placeholder="+63 912 345 6789"
                    className="h-8 text-sm"
                    pattern="^(\+63\s?|0)[0-9\s]{10,13}$"
                    title="Please enter a valid Philippine phone number (e.g., +63 912 345 6789 or 09123456789)"
                  />
                  {isEditing && formData.phone && !/^(\+63|0)[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, '')) && (
                    <p className="text-xs text-red-600">Please enter a valid Philippine phone number</p>
                  )}
                </div>

                {/* Website */}
                <div className="space-y-1">
                  <Label htmlFor="website" className="text-xs font-medium text-gray-600">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Enter website"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Company Profile */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Company Profile</Label>
                  {formData.company_profile ? (
                    <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                      <div className="flex items-center space-x-2">
                        <File className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-700">Company Profile Document</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(formData.company_profile, '_blank')}
                          className="h-6 w-6 p-0"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, company_profile: "" }))}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded p-3 text-center">
                      <File className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600 mb-1">Upload Company Profile</p>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file && userData?.company_id && user?.uid) {
                            setIsUploadingProfile(true)
                            setProfileUploadProgress(0)
                            try {
                              // Simulate progress for better UX
                              const progressInterval = setInterval(() => {
                                setProfileUploadProgress(prev => {
                                  const newProgress = prev + Math.random() * 20
                                  return newProgress > 90 ? 90 : newProgress
                                })
                              }, 200)

                              const uploadResult = await CompanyService.uploadFile(file, userData.company_id, user.uid, "profiles")

                              clearInterval(progressInterval)
                              setProfileUploadProgress(100)

                              if (uploadResult.success && uploadResult.file) {
                                setFormData(prev => ({ ...prev, company_profile: uploadResult.file!.url }))
                                setTimeout(() => {
                                  setIsUploadingProfile(false)
                                  setProfileUploadProgress(0)
                                }, 500)
                              } else {
                                setIsUploadingProfile(false)
                                setProfileUploadProgress(0)
                              }
                            } catch (error) {
                              console.error("Error uploading profile:", error)
                              setIsUploadingProfile(false)
                              setProfileUploadProgress(0)
                            }
                          }
                        }}
                        disabled={!isEditing || isUploadingProfile}
                        className="hidden"
                        id="company-profile"
                      />
                      <Label
                        htmlFor="company-profile"
                        className={`cursor-pointer text-xs ${isUploadingProfile ? 'text-gray-400' : 'text-blue-600 hover:text-blue-800'}`}
                      >
                        {isUploadingProfile ? 'Uploading...' : 'Choose file'}
                      </Label>
                      {isUploadingProfile && (
                        <div className="mt-2 space-y-1">
                          <Progress value={profileUploadProgress} className="h-2" />
                          <p className="text-xs text-gray-500">{Math.round(profileUploadProgress)}%</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Storage Section - Remaining space */}
        <div className="flex-1 bg-white flex flex-col">
          <Card className="flex-1 border-0 rounded-none">
            <CardHeader className="px-6 py-4 border-b">
              <CardTitle className="flex items-center space-x-2 text-lg font-semibold">
                <Folder className="h-5 w-5" />
                <span>File Storage</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {userData?.company_id && user?.uid && (
                <FileBrowser
                  companyId={userData.company_id}
                  userId={user.uid}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Dialogs */}
      <GenericSuccessDialog
        isOpen={showUploadSuccess}
        onClose={() => setShowUploadSuccess(false)}
        title="Upload Successful!"
        message="Your company logo has been uploaded successfully."
        type="upload"
      />

      <GenericSuccessDialog
        isOpen={showSaveSuccess}
        onClose={() => setShowSaveSuccess(false)}
        title="Profile Updated!"
        message="Your company profile has been updated successfully."
        type="save"
      />
    </div>
  )
}
