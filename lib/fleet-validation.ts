import type { FleetFormData } from "@/types/fleet"

export interface ValidationError {
  field: string
  message: string
}

export class FleetValidation {
  static validateVehicleForm(data: FleetFormData): ValidationError[] {
    const errors: ValidationError[] = []

    // Required fields validation
    if (!data.vehicleNumber.trim()) {
      errors.push({ field: "vehicleNumber", message: "Vehicle number is required" })
    }

    if (!data.fleetName.trim()) {
      errors.push({ field: "fleetName", message: "Fleet name is required" })
    }

    if (!data.vehicleType) {
      errors.push({ field: "vehicleType", message: "Vehicle type is required" })
    }

    if (!data.registrationNumber.trim()) {
      errors.push({ field: "registrationNumber", message: "Registration number is required" })
    }

    if (data.vehicleNumber && !this.isValidVehicleNumber(data.vehicleNumber)) {
      errors.push({
        field: "vehicleNumber",
        message: "Vehicle number must be 3-20 characters with letters, numbers, and hyphens only",
      })
    }

    if (data.year && (Number.parseInt(data.year) < 1900 || Number.parseInt(data.year) > new Date().getFullYear() + 1)) {
      errors.push({
        field: "year",
        message: "Please enter a valid year",
      })
    }

    // Date validations
    if (data.insuranceExpiry && new Date(data.insuranceExpiry) < new Date()) {
      errors.push({
        field: "insuranceExpiry",
        message: "Insurance expiry date cannot be in the past",
      })
    }

    if (data.registrationExpiry && new Date(data.registrationExpiry) < new Date()) {
      errors.push({
        field: "registrationExpiry",
        message: "Registration expiry date cannot be in the past",
      })
    }

    return errors
  }

  static isValidVehicleNumber(vehicleNumber: string): boolean {
    // Allow alphanumeric characters, hyphens, and spaces
    // Length between 3-20 characters
    // Must start and end with alphanumeric character
    const pattern = /^[A-Za-z0-9][A-Za-z0-9\s-]*[A-Za-z0-9]$|^[A-Za-z0-9]$/
    return pattern.test(vehicleNumber) && vehicleNumber.length >= 3 && vehicleNumber.length <= 20
  }

  static validateVehicleNumber(vehicleNumber: string, existingVehicles: string[] = []): string | null {
    if (!vehicleNumber.trim()) {
      return "Vehicle number is required"
    }

    if (!this.isValidVehicleNumber(vehicleNumber)) {
      return "Vehicle number must be 3-20 characters with letters, numbers, and hyphens only"
    }

    if (existingVehicles.includes(vehicleNumber)) {
      return "Vehicle number already exists"
    }

    return null
  }

  static validateRegistrationNumber(registrationNumber: string, existingNumbers: string[] = []): string | null {
    if (!registrationNumber.trim()) {
      return "Registration number is required"
    }

    if (registrationNumber.length < 8) {
      return "Registration number must be at least 8 characters"
    }

    if (existingNumbers.includes(registrationNumber)) {
      return "Registration number already exists"
    }

    return null
  }
}
