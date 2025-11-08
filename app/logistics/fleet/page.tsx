"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Plus,
  Filter,
  MapPin,
  Fuel,
  Calendar,
  Settings,
  Truck,
  AlertTriangle,
  CheckCircle,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useFleet } from "@/contexts/fleet-context"
import { useFleetFilters } from "@/hooks/use-fleet-filters"
import { RouteProtection } from "@/components/route-protection"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"

export default function FleetPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null)
  const { userData } = useAuth()

  const { vehicles, loading, error, stats, fetchVehicles, deleteVehicle, clearError } = useFleet()

  const { filteredVehicles } = useFleetFilters(vehicles, {
    search: searchQuery,
    status: statusFilter,
    vehicleType: "all",
    location: "all",
  })

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      })
      clearError()
    }
  }, [error, clearError])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800"
      case "inactive":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />
      case "maintenance":
        return <AlertTriangle className="h-4 w-4" />
      case "inactive":
        return <Settings className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const handleCreateVehicle = () => {
    router.push("/logistics/fleet/create")
  }

  const handleEditVehicle = (vehicleId: string) => {
    router.push(`/logistics/fleet/edit/${vehicleId}`)
  }

  const handleViewVehicle = (vehicleId: string) => {
    console.log("View vehicle details:", vehicleId)
  }

  const handleDeleteVehicle = (vehicleId: string) => {
    setVehicleToDelete(vehicleId)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteVehicle = async () => {
    if (vehicleToDelete) {
      try {
        await deleteVehicle(vehicleToDelete)
        toast({
          title: "Success",
          description: "Vehicle deleted successfully",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete vehicle",
          variant: "destructive",
        })
      }
    }
    setDeleteDialogOpen(false)
    setVehicleToDelete(null)
  }

  const handleAssignTask = (vehicleId: string) => {
    console.log("Assign task to vehicle:", vehicleId)
  }

  return (
    <RouteProtection requiredRoles="logistics">
      <div className="flex-1 overflow-auto relative bg-gray-50">
        <main className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
                <p className="text-gray-600 mt-1">Monitor and manage your vehicle fleet</p>
              </div>
              <Button onClick={handleCreateVehicle} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2">
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading vehicles...</p>
              </div>
            )}

            {!loading && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Vehicles</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <Truck className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Active</p>
                          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">In Maintenance</p>
                          <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Inactive</p>
                          <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
                        </div>
                        <Settings className="h-8 w-8 text-gray-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search vehicles, drivers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white border-gray-200"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40 bg-white border-gray-200">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" className="border-gray-200 bg-transparent">
                    <Filter className="h-4 w-4 mr-2" />
                    More Filters
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredVehicles.map((vehicle) => (
                    <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-semibold">{vehicle.vehicleNumber}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(vehicle.status)}>
                              <div className="flex items-center gap-1">
                                {getStatusIcon(vehicle.status)}
                                <span className="capitalize">{vehicle.status}</span>
                              </div>
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewVehicle(vehicle.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditVehicle(vehicle.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Vehicle
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteVehicle(vehicle.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Vehicle
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          {vehicle.vehicleType.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">{vehicle.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">Driver: {vehicle.driver}</span>
                        </div>
                        {vehicle.fuelLevel && (
                          <div className="flex items-center gap-2 text-sm">
                            <Fuel className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700">Fuel: {vehicle.fuelLevel}%</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${vehicle.fuelLevel}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        {vehicle.nextMaintenance && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700">Next Maintenance: {vehicle.nextMaintenance}</span>
                          </div>
                        )}
                        {vehicle.mileage && <div className="text-sm text-gray-600">Mileage: {vehicle.mileage}</div>}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewVehicle(vehicle.id)}
                            className="flex-1 bg-transparent"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAssignTask(vehicle.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            Assign Task
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredVehicles.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles found</h3>
                    <p className="text-gray-600">
                      {vehicles.length === 0
                        ? "Get started by adding your first vehicle to the fleet."
                        : "Try adjusting your search or filter criteria."}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this vehicle? This action cannot be undone and will remove all
                associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteVehicle} className="bg-red-600 hover:bg-red-700">
                Delete Vehicle
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteProtection>
  )
}
