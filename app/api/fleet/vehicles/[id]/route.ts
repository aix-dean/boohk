import { type NextRequest, NextResponse } from "next/server"
import type { FleetVehicle, FleetFormData } from "@/types/fleet"

// In-memory storage reference - replace with actual database
// This should reference the same collection as the main route
const fleetCollection: FleetVehicle[] = []

// GET /api/fleet/vehicles/[id] - Get single vehicle
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vehicle = fleetCollection.find((v) => v.id === params.id)

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error("Error fetching vehicle:", error)
    return NextResponse.json({ error: "Failed to fetch vehicle" }, { status: 500 })
  }
}

// PUT /api/fleet/vehicles/[id] - Update vehicle
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data: FleetFormData = await request.json()
    const vehicleIndex = fleetCollection.findIndex((v) => v.id === params.id)

    if (vehicleIndex === -1) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }

    const updatedVehicle: FleetVehicle = {
      ...fleetCollection[vehicleIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    }

    fleetCollection[vehicleIndex] = updatedVehicle

    return NextResponse.json(updatedVehicle)
  } catch (error) {
    console.error("Error updating vehicle:", error)
    return NextResponse.json({ error: "Failed to update vehicle" }, { status: 500 })
  }
}

// DELETE /api/fleet/vehicles/[id] - Delete vehicle
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vehicleIndex = fleetCollection.findIndex((v) => v.id === params.id)

    if (vehicleIndex === -1) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })
    }

    fleetCollection.splice(vehicleIndex, 1)

    return NextResponse.json({ message: "Vehicle deleted successfully" })
  } catch (error) {
    console.error("Error deleting vehicle:", error)
    return NextResponse.json({ error: "Failed to delete vehicle" }, { status: 500 })
  }
}
