"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { CompanyService } from "@/lib/company-service"
import { toast } from "@/components/ui/use-toast"

interface CompanyUpdateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CompanyUpdateDialog({ isOpen, onClose, onSuccess }: CompanyUpdateDialogProps) {
  const { user, userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    business_type: "",
    position: "",
    website: "",
    address: {
      street: "",
      city: "",
      province: "",
    },
  })

  // Load existing company data when dialog opens
  useEffect(() => {
    if (isOpen && userData?.company_id) {
      loadCompanyData()
    }
  }, [isOpen, userData?.company_id])

  const loadCompanyData = async () => {
    if (!userData?.company_id) return

    setLoading(true)
    try {
      const companyData = await CompanyService.getCompanyData(userData.company_id)
      if (companyData) {
        setFormData({
          name: companyData.name || "",
          business_type: companyData.business_type || "",
          position: companyData.position || "",
          website: companyData.website || "",
          address: {
            street: companyData.address?.street || "",
            city: companyData.address?.city || "",
            province: companyData.address?.province || "",
          },
        })
      }
    } catch (error) {
      console.error("Error loading company data:", error)
      toast({
        title: "Error",
        description: "Failed to load company data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith("address.")) {
      const addressField = field.split(".")[1]
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name?.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required.",
        variant: "destructive",
      })
      return
    }

    if (!userData?.company_id || !user?.uid) {
      toast({
        title: "Error",
        description: "User not authenticated or company not found.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      await CompanyService.updateCompanyData(userData.company_id, user.uid, formData)

      toast({
        title: "Success",
        description: "Company information updated successfully!",
      })

      onSuccess()
    } catch (error) {
      console.error("Error updating company:", error)
      toast({
        title: "Error",
        description: "Failed to update company information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Your Company Information</DialogTitle>
          <DialogDescription>
            Please provide your company name to continue uploading products. Other fields are optional but recommended.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading company data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter your company name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-type">
                Business Type
              </Label>
              <Select value={formData.business_type} onValueChange={(value) => handleInputChange("business_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operator">Operator</SelectItem>
                  <SelectItem value="Freelance">Freelance</SelectItem>
                  <SelectItem value="Media Buyer">Media Buyer</SelectItem>
                  <SelectItem value="Printing Company">Printing Company</SelectItem>
                  <SelectItem value="Equipment Supplier">Equipment Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">
                Your Position
              </Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => handleInputChange("position", e.target.value)}
                placeholder="e.g., Manager, Director, Owner (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://www.yourcompany.com"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Address</Label>
              <div className="space-y-2">
                <Input
                  value={formData.address.street}
                  onChange={(e) => handleInputChange("address.street", e.target.value)}
                  placeholder="Street Address"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={formData.address.city}
                    onChange={(e) => handleInputChange("address.city", e.target.value)}
                    placeholder="City"
                  />
                  <Input
                    value={formData.address.province}
                    onChange={(e) => handleInputChange("address.province", e.target.value)}
                    placeholder="Province"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Company
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}