"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, X } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useFleet } from "@/contexts/fleet-context"
import { FleetValidation } from "@/lib/fleet-validation"
import type { FleetFormData } from "@/types/fleet"
import { RouteProtection } from "@/components/route-protection"
import { toast } from "@/hooks/use-toast"

export default function CreateFleetPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { createVehicle, loading } = useFleet()
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState<FleetFormData>({
    vehicleNumber: "",
    fleetName: "",
    vehicleType: "",
    make: "",
    model: "",
    year: "",
    capacity: "",
    registrationNumber: "",
    chassisNumber: "",
    engineNumber: "",
    fuelType: "",
    driver: "",
    status: "active",
    location: "",
    operationalNotes: "",
    purchaseDate: "",
    insuranceExpiry: "",
    registrationExpiry: "",
  })

  const handleInputChange = (field: keyof FleetFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors = FleetValidation.validateVehicleForm(formData)
    if (errors.length > 0) {
      const errorMap = errors.reduce(
        (acc, error) => {
          acc[error.field] = error.message
          return acc
        },
        {} as Record<string, string>,
      )
      setValidationErrors(errorMap)
      return
    }

    try {
      const vehicleId = await createVehicle(formData)
      toast({
        title: "Success",
        description: "Vehicle created successfully",
      })
      router.push("/logistics/fleet")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create vehicle",
        variant: "destructive",
      })
    }
  }

  const handleCancel = () => {
    router.push("/logistics/fleet")
  }

  return (
    <RouteProtection requiredRoles="logistics">
      <div className="flex-1 overflow-auto relative bg-gray-50">
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header Section */}
            <div className="flex items-center gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={handleCancel} className="bg-white border-gray-200">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Fleet
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Add New Vehicle</h1>
                <p className="text-gray-600 mt-1">Create a new fleet vehicle record</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleNumber">Vehicle Number *</Label>
                      <Input
                        id="vehicleNumber"
                        value={formData.vehicleNumber}
                        onChange={(e) => handleInputChange("vehicleNumber", e.target.value)}
                        placeholder="e.g., ABC-1234, FLEET001, VAN-A1"
                        required
                        className={validationErrors.vehicleNumber ? "border-red-500" : ""}
                      />
                      {validationErrors.vehicleNumber && (
                        <p className="text-sm text-red-600">{validationErrors.vehicleNumber}</p>
                      )}
                      <p className="text-xs text-gray-500">3-20 characters, letters, numbers, and hyphens allowed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fleetName">Fleet Name *</Label>
                      <Input
                        id="fleetName"
                        value={formData.fleetName}
                        onChange={(e) => handleInputChange("fleetName", e.target.value)}
                        placeholder="e.g., Service Fleet Alpha"
                        required
                        className={validationErrors.fleetName ? "border-red-500" : ""}
                      />
                      {validationErrors.fleetName && (
                        <p className="text-sm text-red-600">{validationErrors.fleetName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleType">Vehicle Type *</Label>
                      <Select
                        value={formData.vehicleType}
                        onValueChange={(value) => handleInputChange("vehicleType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="service-van">Service Van</SelectItem>
                          <SelectItem value="installation-truck">Installation Truck</SelectItem>
                          <SelectItem value="cargo-truck">Cargo Truck</SelectItem>
                          <SelectItem value="maintenance-vehicle">Maintenance Vehicle</SelectItem>
                          <SelectItem value="pickup-truck">Pickup Truck</SelectItem>
                          <SelectItem value="sedan">Sedan</SelectItem>
                          <SelectItem value="suv">SUV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="maintenance">Under Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="make">Make</Label>
                      <Input
                        id="make"
                        value={formData.make}
                        onChange={(e) => handleInputChange("make", e.target.value)}
                        placeholder="e.g., Toyota"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={formData.model}
                        onChange={(e) => handleInputChange("model", e.target.value)}
                        placeholder="e.g., Hiace"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={formData.year}
                        onChange={(e) => handleInputChange("year", e.target.value)}
                        placeholder="e.g., 2022"
                        min="1900"
                        max="2030"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        value={formData.capacity}
                        onChange={(e) => handleInputChange("capacity", e.target.value)}
                        placeholder="e.g., 1500 kg or 8 passengers"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuelType">Fuel Type</Label>
                      <Select value={formData.fuelType} onValueChange={(value) => handleInputChange("fuelType", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fuel type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gasoline">Gasoline</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="lpg">LPG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Registration & Legal */}
              <Card>
                <CardHeader>
                  <CardTitle>Registration & Legal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Registration Number *</Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                        placeholder="e.g., ABC123456789"
                        required
                        className={validationErrors.registrationNumber ? "border-red-500" : ""}
                      />
                      {validationErrors.registrationNumber && (
                        <p className="text-sm text-red-600">{validationErrors.registrationNumber}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chassisNumber">Chassis Number</Label>
                      <Input
                        id="chassisNumber"
                        value={formData.chassisNumber}
                        onChange={(e) => handleInputChange("chassisNumber", e.target.value)}
                        placeholder="Vehicle chassis number"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="engineNumber">Engine Number</Label>
                      <Input
                        id="engineNumber"
                        value={formData.engineNumber}
                        onChange={(e) => handleInputChange("engineNumber", e.target.value)}
                        placeholder="Vehicle engine number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchaseDate">Purchase Date</Label>
                      <Input
                        id="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => handleInputChange("purchaseDate", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="insuranceExpiry">Insurance Expiry</Label>
                      <Input
                        id="insuranceExpiry"
                        type="date"
                        value={formData.insuranceExpiry}
                        onChange={(e) => handleInputChange("insuranceExpiry", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationExpiry">Registration Expiry</Label>
                      <Input
                        id="registrationExpiry"
                        type="date"
                        value={formData.registrationExpiry}
                        onChange={(e) => handleInputChange("registrationExpiry", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Operational Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Operational Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="driver">Assigned Driver</Label>
                      <Input
                        id="driver"
                        value={formData.driver}
                        onChange={(e) => handleInputChange("driver", e.target.value)}
                        placeholder="Driver name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Current Location</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange("location", e.target.value)}
                        placeholder="e.g., Makati City"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operationalNotes">Operational Notes</Label>
                    <Textarea
                      id="operationalNotes"
                      value={formData.operationalNotes}
                      onChange={(e) => handleInputChange("operationalNotes", e.target.value)}
                      placeholder="Any special notes, restrictions, or operational details..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading}
                  className="bg-white border-gray-200"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Creating..." : "Create Vehicle"}
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </RouteProtection>
  )
}
