import type { FleetVehicle, FleetFormData } from "@/types/fleet"

// API endpoints
const API_BASE = "/api/fleet"

export class FleetAPI {
  static async getVehicles(): Promise<FleetVehicle[]> {
    try {
      const response = await fetch(`${API_BASE}/vehicles`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching vehicles:", error)
      throw new Error("Failed to fetch vehicles")
    }
  }

  static async getVehicleById(id: string): Promise<FleetVehicle> {
    try {
      const response = await fetch(`${API_BASE}/vehicles/${id}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error("Error fetching vehicle:", error)
      throw new Error("Failed to fetch vehicle")
    }
  }

  static async createVehicle(data: FleetFormData): Promise<FleetVehicle> {
    try {
      const response = await fetch(`${API_BASE}/vehicles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error creating vehicle:", error)
      throw new Error("Failed to create vehicle")
    }
  }

  static async updateVehicle(id: string, data: FleetFormData): Promise<FleetVehicle> {
    try {
      const response = await fetch(`${API_BASE}/vehicles/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error updating vehicle:", error)
      throw new Error("Failed to update vehicle")
    }
  }

  static async deleteVehicle(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/vehicles/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error("Error deleting vehicle:", error)
      throw new Error("Failed to delete vehicle")
    }
  }

  static async assignTask(vehicleId: string, taskData: any): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/vehicles/${vehicleId}/assign-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(taskData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error("Error assigning task:", error)
      throw new Error("Failed to assign task")
    }
  }
}
