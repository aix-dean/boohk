"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { FleetVehicle, FleetFormData, FleetStats, FleetFilters } from "@/types/fleet"
import { FleetService } from "@/lib/fleet-service"

interface FleetContextType {
  vehicles: FleetVehicle[]
  loading: boolean
  error: string | null
  filters: FleetFilters
  stats: FleetStats

  // Actions
  fetchVehicles: () => Promise<void>
  createVehicle: (data: FleetFormData) => Promise<string>
  updateVehicle: (id: string, data: FleetFormData) => Promise<void>
  deleteVehicle: (id: string) => Promise<void>
  getVehicleById: (id: string) => FleetVehicle | undefined
  setFilters: (filters: Partial<FleetFilters>) => void
  clearError: () => void
}

const FleetContext = createContext<FleetContextType | undefined>(undefined)

export function FleetProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<FleetFilters>({
    search: "",
    status: "all",
    vehicleType: "all",
    location: "all",
  })

  // Calculate stats
  const stats: FleetStats = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "active").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    inactive: vehicles.filter((v) => v.status === "inactive").length,
  }

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fetchedVehicles = await FleetService.getAllVehicles()
      setVehicles(fetchedVehicles)
    } catch (err) {
      setError("Failed to fetch vehicles")
      console.error("Error fetching vehicles:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const createVehicle = useCallback(async (data: FleetFormData): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const vehicleId = await FleetService.createVehicle(data)

      // Fetch the created vehicle to add to state
      const createdVehicle = await FleetService.getVehicleById(vehicleId)
      if (createdVehicle) {
        setVehicles((prev) => [createdVehicle, ...prev])
      }

      return vehicleId
    } catch (err) {
      setError("Failed to create vehicle")
      console.error("Error creating vehicle:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateVehicle = useCallback(async (id: string, data: FleetFormData) => {
    setLoading(true)
    setError(null)
    try {
      await FleetService.updateVehicle(id, data)

      // Fetch the updated vehicle to update state
      const updatedVehicle = await FleetService.getVehicleById(id)
      if (updatedVehicle) {
        setVehicles((prev) => prev.map((vehicle) => (vehicle.id === id ? updatedVehicle : vehicle)))
      }
    } catch (err) {
      setError("Failed to update vehicle")
      console.error("Error updating vehicle:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteVehicle = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await FleetService.deleteVehicle(id)
      setVehicles((prev) => prev.filter((vehicle) => vehicle.id !== id))
    } catch (err) {
      setError("Failed to delete vehicle")
      console.error("Error deleting vehicle:", err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getVehicleById = useCallback(
    (id: string): FleetVehicle | undefined => {
      return vehicles.find((vehicle) => vehicle.id === id)
    },
    [vehicles],
  )

  const setFilters = useCallback((newFilters: Partial<FleetFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value: FleetContextType = {
    vehicles,
    loading,
    error,
    filters,
    stats,
    fetchVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleById,
    setFilters,
    clearError,
  }

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet() {
  const context = useContext(FleetContext)
  if (context === undefined) {
    throw new Error("useFleet must be used within a FleetProvider")
  }
  return context
}
