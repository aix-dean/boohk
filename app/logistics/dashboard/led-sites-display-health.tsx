"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Calendar, Users, FileText, Activity, AlertTriangle } from "lucide-react"
import { CreateReportDialog } from "@/components/create-report-dialog"

const ledSites = [
  {
    id: "led-health-1",
    name: "EDSA Northbound LED",
    location: "Quezon City",
    type: "LED Billboard",
    status: "Active",
    lastUpdate: "2 hours ago",
    occupancy: "85%",
    revenue: "₱125,000",
    displayHealth: "Excellent",
    temperature: "42°C",
    brightness: "85%",
  },
  {
    id: "led-health-2",
    name: "BGC Central Display",
    location: "Taguig City",
    type: "LED Display",
    status: "Active",
    lastUpdate: "30 minutes ago",
    occupancy: "78%",
    revenue: "₱95,000",
    displayHealth: "Good",
    temperature: "45°C",
    brightness: "90%",
  },
  {
    id: "led-health-3",
    name: "Ortigas LED Screen",
    location: "Pasig City",
    type: "Digital Screen",
    status: "Warning",
    lastUpdate: "4 hours ago",
    occupancy: "65%",
    revenue: "₱75,000",
    displayHealth: "Warning",
    temperature: "52°C",
    brightness: "70%",
  },
]

export default function LEDSitesDisplayHealth() {
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState("")

  const handleCreateReport = (siteId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedSiteId(siteId)
    setReportDialogOpen(true)
  }

  const getHealthBadge = (health: string) => {
    switch (health) {
      case "Excellent":
        return <Badge className="bg-green-500">Excellent</Badge>
      case "Good":
        return <Badge className="bg-blue-500">Good</Badge>
      case "Warning":
        return <Badge className="bg-yellow-500">Warning</Badge>
      default:
        return <Badge variant="destructive">Critical</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">LED Sites - Display Health</h2>
        <Badge variant="secondary">{ledSites.length} LED Sites</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ledSites.map((site) => (
          <Card key={site.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{site.name}</CardTitle>
                {getHealthBadge(site.displayHealth)}
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
                  <Activity className="h-4 w-4 mr-2" />
                  Temp: {site.temperature} | Brightness: {site.brightness}
                </div>
                {site.displayHealth === "Warning" && (
                  <div className="flex items-center text-sm text-yellow-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    High temperature detected
                  </div>
                )}
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
