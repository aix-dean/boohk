"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"
import { tenantAuth } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

export default function ChangePasswordPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  const getRoastMessage = (field: string, error: string): string => {
    switch (field) {
      case "currentPassword":
        return "Current password is required"
      case "newPassword":
        if (error.includes("required")) {
          return "New password is required"
        } else if (error.includes("8 characters")) {
          return "Password must be at least 8 characters long"
        } else {
          return "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        }
      case "confirmPassword":
        if (error.includes("confirm")) {
          return "Please confirm your new password"
        } else {
          return "Passwords do not match"
        }
      default:
        return "Please fill in all required fields"
    }
  }

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!formData.currentPassword) {
      errors.currentPassword = "Current password is required"
    }

    if (!formData.newPassword) {
      errors.newPassword = "New password is required"
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters long"
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      errors.newPassword = "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = "Please confirm your new password"
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      // Show roast toast for the first error
      const firstError = Object.entries(validationErrors)[0]
      const roastMessage = getRoastMessage(firstError[0], firstError[1])
      toast({
        title: "Validation Error",
        description: roastMessage,
        variant: "destructive",
      })
      return
    }

    if (!user) return

    setIsSubmitting(true)

    try {
      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(user.email!, formData.currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, formData.newPassword)

      toast({
        title: "Success",
        description: "Your password has been successfully changed.",
      })

      // Reset form
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setErrors({})
    } catch (error: any) {
      console.error("Password change error:", error)

      let errorMessage = "Failed to change password. Please try again."

      switch (error.code) {
        case "auth/wrong-password":
          errorMessage = "Current password is incorrect."
          setErrors({ currentPassword: errorMessage })
          break
        case "auth/weak-password":
          errorMessage = "New password is too weak."
          setErrors({ newPassword: errorMessage })
          break
        case "auth/requires-recent-login":
          errorMessage = "Please log in again before changing your password."
          break
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Please try again later."
          break
        default:
          setErrors({ general: errorMessage })
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleCancel = () => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
    setErrors({})
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" data-testid="loader" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="relative size-full">
      {/* Title */}
      <div className="w-96 h-6  top-[59px] absolute justify-start text-black text-base font-bold font-['Inter'] leading-none">
        Change Password
      </div>

      {/* White rounded container */}
      <div className="w-[1002px] h-64  top-[97px] absolute bg-white rounded-[20px]">
        {/* Current Password Row */}
        <div className="w-full h-6 left-[29px] top-[26px] absolute flex items-start">
          <div className="w-[250px] h-3.5 justify-start text-black text-xs font-bold font-['Inter'] leading-3 mt-1">
            Current Password:
          </div>
          <div className="w-[250px] h-6 bg-white rounded-md border-[1.20px] border-gray-300 relative">
            <Input
              id="current-password"
              type={showPasswords.current ? "text" : "password"}
              placeholder="Enter current password"
              value={formData.currentPassword}
              onChange={handleInputChange("currentPassword")}
              className="w-full h-full border-none bg-transparent px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('current')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New Password Row */}
        <div className="w-full h-6 left-[29px] top-[59px] absolute flex items-start">
          <div className="w-[250px] h-3.5 justify-start text-black text-xs font-bold font-['Inter'] leading-3 mt-1">
            New Password:
          </div>
          <div className="w-[250px] h-6 bg-white rounded-md border-[1.20px] border-gray-300 relative">
            <Input
              id="new-password"
              type={showPasswords.new ? "text" : "password"}
              placeholder="Enter new password"
              value={formData.newPassword}
              onChange={handleInputChange("newPassword")}
              className="w-full h-full border-none bg-transparent px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('new')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password Row */}
        <div className="w-full h-6 left-[29px] top-[92px] absolute flex items-start">
          <div className="w-[250px] h-3.5 justify-start text-black text-xs font-bold font-['Inter'] leading-3 mt-1">
            Confirm Password:
          </div>
          <div className="w-[250px] h-6 bg-white rounded-md border-[1.20px] border-gray-300 relative">
            <Input
              id="confirm-password"
              type={showPasswords.confirm ? "text" : "password"}
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              onChange={handleInputChange("confirmPassword")}
              className="w-full h-full border-none bg-transparent px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('confirm')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="w-36 h-7 left-[673px] top-[139px] absolute bg-white rounded-[10px] border-2 border-gray-300 text-center justify-start text-zinc-800 text-base font-medium font-['Inter'] leading-none"
        >
          Cancel
        </button>

        {/* Save Button */}
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-36 h-7 left-[832px] top-[139px] absolute bg-indigo-700 rounded-[10px] text-center justify-start text-white text-base font-bold font-['Inter'] leading-none disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </button>


      </div>
    </div>
  )
}