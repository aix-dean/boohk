"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Users, Plus, Search, Edit, Trash2, UserCheck, MapPin, Phone, Mail } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { TeamFormDialog } from "@/components/team-form-dialog"
import { getTeams, createTeam, updateTeam, deleteTeam, updateTeamStatus } from "@/lib/teams-service"
import type { Team, CreateTeamData } from "@/lib/types/team"

export default function TeamsPage() {
  const { userData } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [typeFilter, setTypeFilter] = useState<
    "all" | "operations" | "maintenance" | "installation" | "delivery" | "support"
  >("all")

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    filterTeams()
  }, [teams, searchTerm, statusFilter, typeFilter])

  const loadTeams = async () => {
    try {
      setLoading(true)
      const teamsData = await getTeams(userData?.company_id || undefined)
      setTeams(teamsData)
    } catch (error) {
      console.error("Error loading teams:", error)
      toast.error("Failed to load teams")
    } finally {
      setLoading(false)
    }
  }

  const filterTeams = () => {
    let filtered = teams

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (team) =>
          team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.leaderName?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((team) => team.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((team) => team.teamType === typeFilter)
    }

    setFilteredTeams(filtered)
  }

  const handleCreateTeam = async (data: CreateTeamData) => {
    if (!userData?.uid) {
      toast.error("User not authenticated")
      return
    }

    try {
      setFormLoading(true)
      await createTeam(data, userData.uid)
      toast.success("Team created successfully")
      setIsFormDialogOpen(false)
      loadTeams()
    } catch (error) {
      console.error("Error creating team:", error)
      toast.error("Failed to create team")
    } finally {
      setFormLoading(false)
    }
  }

  const handleUpdateTeam = async (data: CreateTeamData) => {
    if (!editingTeam) return

    try {
      setFormLoading(true)
      await updateTeam(editingTeam.id, data, userData?.company_id || undefined)
      toast.success("Team updated successfully")
      setIsFormDialogOpen(false)
      setEditingTeam(null)
      loadTeams()
    } catch (error) {
      console.error("Error updating team:", error)
      toast.error("Failed to update team")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return

    try {
      setDeleteLoading(true)
      await deleteTeam(teamToDelete.id, userData?.company_id || undefined)
      toast.success("Team deleted successfully")
      setDeleteDialogOpen(false)
      setTeamToDelete(null)
      loadTeams()
    } catch (error) {
      console.error("Error deleting team:", error)
      toast.error("Failed to delete team")
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleStatusToggle = async (team: Team) => {
    try {
      const newStatus = team.status === "active" ? "inactive" : "active"
      await updateTeamStatus(team.id, newStatus, userData?.company_id || undefined)
      toast.success(`Team ${newStatus === "active" ? "activated" : "deactivated"} successfully`)
      loadTeams()
    } catch (error) {
      console.error("Error updating team status:", error)
      toast.error("Failed to update team status")
    }
  }

  const getTeamTypeColor = (type: string) => {
    const colors = {
      operations: "bg-blue-100 text-blue-800",
      maintenance: "bg-yellow-100 text-yellow-800",
      installation: "bg-green-100 text-green-800",
      delivery: "bg-purple-100 text-purple-800",
      support: "bg-orange-100 text-orange-800",
    }
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  const getStatusColor = (status: string) => {
    return status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-lg">Loading teams...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Teams & Personnel
          </h1>
          <p className="text-gray-600 mt-1">Manage logistics teams and their members</p>
        </div>
        <Button onClick={() => setIsFormDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Team
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) => (
          <Card key={team.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getTeamTypeColor(team.teamType)}>{team.teamType}</Badge>
                    <Badge className={getStatusColor(team.status)}>{team.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingTeam(team)
                      setIsFormDialogOpen(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTeamToDelete(team)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600 line-clamp-2">{team.description}</p>

              <div className="space-y-2">
                {team.leaderName && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserCheck className="h-4 w-4 text-gray-400" />
                    <span>{team.leaderName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{team.location}</span>
                </div>
                {team.contactNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{team.contactNumber}</span>
                  </div>
                )}
                {team.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{team.email}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-gray-500"></div>
                <Button variant="outline" size="sm" onClick={() => handleStatusToggle(team)}>
                  {team.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>

              {team.specializations.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2">
                  {team.specializations.slice(0, 3).map((spec) => (
                    <Badge key={spec} variant="outline" className="text-xs">
                      {spec}
                    </Badge>
                  ))}
                  {team.specializations.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{team.specializations.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teams found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first team"}
            </p>
            {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
              <Button onClick={() => setIsFormDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Form Dialog */}
      <TeamFormDialog
        open={isFormDialogOpen}
        onOpenChange={(open) => {
          setIsFormDialogOpen(open)
          if (!open) setEditingTeam(null)
        }}
        onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam}
        team={editingTeam}
        loading={formLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{teamToDelete?.name}"? This action cannot be undone and will also remove
              all team members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? "Deleting..." : "Delete Team"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
