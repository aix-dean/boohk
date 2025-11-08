"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Calendar, Users, FileText, Shield, AlertCircle } from "lucide-react"
import { CreateReportDialog } from "@/components/create-report-dialog"

const ledSites = [
  {
    id: "led-compliance-1",
    name: "EDSA Northbound LED",
    location: "Quezon City",
    type: "LED Billboard",
    status: "Active",
    lastUpdate: "2 hours ago",
    occupancy: "85%",
    revenue: "₱125,000",
    complianceStatus: "Compliant",
    permitExpiry: "2024-12-31",
    lastAudit: "2024-01-15",
  },
  {
    id: "led-compliance-2",
    name: "BGC Central Display",
    location: "Taguig City",
    type: "LED Display",
    status: "Active",
    lastUpdate: "30 minutes ago",
    occupancy: "78%",
    revenue: "₱95,000",
    complianceStatus: "Compliant",
    permitExpiry: "2024-11-30",
    lastAudit: "2024-01-20",
  },
  {
    id: "led-compliance-3",
    name: "Ortigas LED Screen",
    location: "Pasig City",
    type: "Digital Screen",
    status: "Warning",
    lastUpdate: "4 hours ago",
    occupancy: "65%",
    revenue: "₱75,000",
    complianceStatus: "Expiring Soon",
    permitExpiry: "2024-02-28",
    lastAudit: "2024-01-10",
  },
]

export default function LEDSitesCompliance() {
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState("")

  const handleCreateReport = (siteId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedSiteId(siteId)
    setReportDialogOpen(true)
  }

  const getComplianceBadge = (status: string) => {
    switch (status) {
      case "Compliant":
        return <Badge className="bg-green-500">Compliant</Badge>
      case "Expiring Soon":
        return <Badge className="bg-yellow-500">Expiring Soon</Badge>
      case "Non-Compliant":
        return <Badge variant="destructive">Non-Compliant</Badge>
      default:
        return <Badge className="bg-gray-500">Unknown</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">LED Sites - Compliance</h2>
        <Badge variant="secondary">{ledSites.length} LED Sites</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ledSites.map((site) => (
          <Card key={site.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{site.name}</CardTitle>
                {getComplianceBadge(site.complianceStatus)}
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
                  <Shield className="h-4 w-4 mr-2" />
                  Permit Expires: {site.permitExpiry}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Last Audit: {site.lastAudit}
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
