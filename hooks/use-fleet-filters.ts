"use client"

import { useMemo } from "react"
import type { FleetVehicle, FleetFilters } from "@/types/fleet"

export function useFleetFilters(vehicles: FleetVehicle[], filters: FleetFilters) {
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesSearch =
          vehicle.vehicleNumber.toLowerCase().includes(searchLower) ||
          vehicle.driver.toLowerCase().includes(searchLower) ||
          vehicle.vehicleType.toLowerCase().includes(searchLower) ||
          vehicle.fleetName.toLowerCase().includes(searchLower) ||
          vehicle.location.toLowerCase().includes(searchLower)

        if (!matchesSearch) return false
      }

      // Status filter
      if (filters.status !== "all" && vehicle.status !== filters.status) {
        return false
      }

      // Vehicle type filter
      if (filters.vehicleType !== "all" && vehicle.vehicleType !== filters.vehicleType) {
        return false
      }

      // Location filter
      if (filters.location !== "all" && vehicle.location !== filters.location) {
        return false
      }

      return true
    })
  }, [vehicles, filters])

  const uniqueVehicleTypes = useMemo(() => {
    const types = [...new Set(vehicles.map((v) => v.vehicleType))]
    return types.sort()
  }, [vehicles])

  const uniqueLocations = useMemo(() => {
    const locations = [...new Set(vehicles.map((v) => v.location))]
    return locations.sort()
  }, [vehicles])

  return {
    filteredVehicles,
    uniqueVehicleTypes,
    uniqueLocations,
    totalFiltered: filteredVehicles.length,
    totalVehicles: vehicles.length,
  }
}
