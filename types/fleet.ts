export interface FleetVehicle {
  id: string
  vehicleNumber: string
  fleetName: string
  vehicleType: string
  make: string
  model: string
  year: string
  capacity: string
  registrationNumber: string
  chassisNumber: string
  engineNumber: string
  fuelType: string
  driver: string
  status: "active" | "inactive" | "maintenance"
  location: string
  operationalNotes: string
  purchaseDate: string
  insuranceExpiry: string
  registrationExpiry: string
  lastMaintenance?: string
  nextMaintenance?: string
  fuelLevel?: number
  mileage?: string
  createdAt?: string
  updatedAt?: string
}

export interface FleetFormData {
  vehicleNumber: string
  fleetName: string
  vehicleType: string
  make: string
  model: string
  year: string
  capacity: string
  registrationNumber: string
  chassisNumber: string
  engineNumber: string
  fuelType: string
  driver: string
  status: "active" | "inactive" | "maintenance"
  location: string
  operationalNotes: string
  purchaseDate: string
  insuranceExpiry: string
  registrationExpiry: string
}

export interface FleetStats {
  total: number
  active: number
  maintenance: number
  inactive: number
}

export interface FleetFilters {
  search: string
  status: string
  vehicleType: string
  location: string
}
