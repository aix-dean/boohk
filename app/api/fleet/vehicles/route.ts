import { type NextRequest, NextResponse } from "next/server"
import type { FleetVehicle, FleetFormData } from "@/types/fleet"

// In-memory storage for demonstration - replace with actual database
const fleetCollection: FleetVehicle[] = [
  {
    id: "FL001",
    vehicleNumber: "ABC-1234",
    fleetName: "Service Fleet Alpha",
    vehicleType: "service-van",
    make: "Toyota",
    model: "Hiace",
    year: "2022",
    capacity: "8 passengers",
    registrationNumber: "ABC123456789",
    chassisNumber: "JTFSH3E16M0123456",
    engineNumber: "2TR-FE123456",
    fuelType: "gasoline",
    driver: "Juan Dela Cruz",
    status: "active",
    location: "Makati City",
    operationalNotes: "Primary service vehicle for Metro Manila operations.",
    purchaseDate: "2022-03-15",
    insuranceExpiry: "2024-12-31",
    registrationExpiry: "2024-06-30",
    lastMaintenance: "2024-01-15",
    nextMaintenance: "2024-04-15",
    fuelLevel: 85,
    mileage: "45,230 km",
    createdAt: "2022-03-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  },
]

// GET /api/fleet/vehicles - Get all vehicles
export async function GET() {
  try {
    return NextResponse.json(fleetCollection)
  } catch (error) {
    console.error("Error fetching vehicles:", error)
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 })
  }
}

// POST /api/fleet/vehicles - Create new vehicle
export async function POST(request: NextRequest) {
  try {
    const data: FleetFormData = await request.json()

    const newId = `FL${String(fleetCollection.length + 1).padStart(3, "0")}`

    const newVehicle: FleetVehicle = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fuelLevel: data.fuelLevel || 100,
      mileage: data.mileage || "0 km",
    }

    fleetCollection.push(newVehicle)

    return NextResponse.json(newVehicle, { status: 201 })
  } catch (error) {
    console.error("Error creating vehicle:", error)
    return NextResponse.json({ error: "Failed to create vehicle" }, { status: 500 })
  }
}
