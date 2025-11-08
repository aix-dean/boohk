"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Calendar, Users, FileText, Wrench, CheckCircle } from "lucide-react"
import { CreateReportDialog } from "@/components/create-report-dialog"

const ledSites = [
  {
    id: "led-structure-1",
    name: "EDSA Northbound LED",
    location: "Quezon City",
    type: "LED Billboard",
    status: "Active",
    lastUpdate: "2 hours ago",
    occupancy: "85%",
    revenue: "₱125,000",
    structureHealth: "Good",
    lastInspection: "2024-01-15",
    nextMaintenance: "2024-02-15",
  },
  {
    id: "led-structure-2",
    name: "BGC Central Display",
    location: "Taguig City",
    type: "LED Display",
    status: "Active",
    lastUpdate: "30 minutes ago",
    occupancy: "78%",
    revenue: "₱95,000",
    structureHealth: "Excellent",
    lastInspection: "2024-01-20",
    nextMaintenance: "2024-02-20",
  },
  {
    id: "led-structure-3",
    name: "Ortigas LED Screen",
    location: "Pasig City",
    type: "Digital Screen",
    status: "Maintenance",
    lastUpdate: "4 hours ago",
    occupancy: "0%",
    revenue: "₱0",
    structureHealth: "Needs Repair",
    lastInspection: "2024-01-10",
    nextMaintenance: "Overdue",
  },
]

export default function LEDSitesStructure() {
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState("")

  const handleCreateReport = (siteId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedSiteId(siteId)
    setReportDialogOpen(true)

  }

  const getStructureBadge = (health: string) => {
    switch (health) {
      case "Excellent":
        return <Badge className="bg-green-500">Excellent</Badge>
      case "Good":
        return <Badge className="bg-blue-500">Good</Badge>
      case "Needs Repair":
        return <Badge variant="destructive">Needs Repair</Badge>
      default:
        return <Badge className="bg-yellow-500">Fair</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">LED Sites - Structure</h2>
        <Badge variant="secondary">{ledSites.length} LED Sites</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ledSites.map((site) => (
          <Card key={site.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{site.name}</CardTitle>
                {getStructureBadge(site.structureHealth)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  {site.location}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  Updated {site.lastUpdate}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2" />
                  {site.occupancy} Occupancy
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Last Inspection: {site.lastInspection}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Wrench className="h-4 w-4 mr-2" />
                  Next Maintenance: {site.nextMaintenance}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Revenue</span>
                  <span className="text-lg font-bold text-green-600">{site.revenue}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={(e) => handleCreateReport(site.id, e)}
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
                >
                  <FileText className="h-4 w-4" />
                  Create Report
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} siteId={selectedSiteId} />
    </div>
  )
}
