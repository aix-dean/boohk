"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "@/components/ui/use-toast"

interface CompanyRegistrationDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CompanyRegistrationDialog({ isOpen, onClose, onSuccess }: CompanyRegistrationDialogProps) {
  const { user, updateUserData } = useAuth()
  const [loading, setLoading] = useState(false)
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

    if (!formData.name || !formData.business_type || !formData.position) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Create company document and let Firestore generate the ID
      const companyDocRef = await addDoc(collection(db, "companies"), {
        name: formData.name,
        business_type: formData.business_type,
        position: formData.position,
        website: formData.website || "",
        address: {
          street: formData.address.street || "",
          city: formData.address.city || "",
          province: formData.address.province || "",
        },
        created_at: serverTimestamp(),
        created_by: user.uid,
        updated_at: serverTimestamp(),
      })

      // Use the Firestore-generated document ID
      const companyId = companyDocRef.id

      // Update user document with the Firestore-generated company_id
      await updateUserData({ company_id: companyId })

      toast({
        title: "Success",
        description: "Company registered successfully!",
      })

      // Reset form
      setFormData({
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

      onSuccess()
    } catch (error) {
      console.error("Error registering company:", error)
      toast({
        title: "Error",
        description: "Failed to register company. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Register Your Company</DialogTitle>
          <DialogDescription>
            Please provide your company information to continue adding sites to your inventory.
          </DialogDescription>
        </DialogHeader>
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
              Business Type <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.business_type} onValueChange={(value) => handleInputChange("business_type", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
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
              Your Position <span className="text-red-500">*</span>
            </Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => handleInputChange("position", e.target.value)}
              placeholder="e.g., Manager, Director, Owner"
              required
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
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Company
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
