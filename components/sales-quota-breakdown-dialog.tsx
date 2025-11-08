"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { salesQuotaService } from "@/lib/sales-quota-service"
import type { SalesAssociateQuota } from "@/lib/types/sales-quota"
import { Users, Target, TrendingUp, AlertTriangle } from "lucide-react"

interface SalesQuotaBreakdownDialogProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  month: number
  year: number
}

export function SalesQuotaBreakdownDialog({
  isOpen,
  onClose,
  companyId,
  month,
  year
}: SalesQuotaBreakdownDialogProps) {
  const [associateQuotas, setAssociateQuotas] = useState<SalesAssociateQuota[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && companyId) {
      fetchAssociateQuotas()
    }
  }, [isOpen, companyId, month, year])

  const fetchAssociateQuotas = async () => {
    setLoading(true)
    try {
      const quotas = await salesQuotaService.getAssociateQuotasForBreakdown(companyId, month, year)
      setAssociateQuotas(quotas)
    } catch (error) {
      console.error("Error fetching associate quotas:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'above-target':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'on-target':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'below-target':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'above-target':
        return <TrendingUp className="w-4 h-4" />
      case 'on-target':
        return <Target className="w-4 h-4" />
      case 'below-target':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return null
    }
  }

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1] || 'Unknown'
  }

  const totalTargets = associateQuotas.reduce((sum, quota) => sum + quota.targetQuotations, 0)
  const totalActual = associateQuotas.reduce((sum, quota) => sum + quota.actualQuotations, 0)
  const averageAchievement = associateQuotas.length > 0
    ? Math.round(associateQuotas.reduce((sum, quota) => sum + quota.achievementPercentage, 0) / associateQuotas.length)
    : 0

  const onTrackCount = associateQuotas.filter(q => q.status === 'above-target' || q.status === 'on-target').length
  const belowTargetCount = associateQuotas.filter(q => q.status === 'below-target').length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Sales Quota Breakdown - {getMonthName(month)} {year}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Team Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{averageAchievement}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Associates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{associateQuotas.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">On Track</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{onTrackCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Below Target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{belowTargetCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Total Target Quotations: {totalTargets}</span>
                  <span>Total Actual Quotations: {totalActual}</span>
                </div>
                <Progress value={totalTargets > 0 ? (totalActual / totalTargets) * 100 : 0} className="h-3" />
                <div className="text-center text-sm text-gray-600">
                  {totalTargets > 0 ? Math.round((totalActual / totalTargets) * 100) : 0}% of total target achieved
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Associate Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Individual Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading associate data...</p>
                </div>
              ) : associateQuotas.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No sales quotas found for this period.
                </div>
              ) : (
                <div className="space-y-4">
                  {associateQuotas.map((quota) => (
                    <div key={quota.associateId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-gray-900">{quota.associateName}</h3>
                          <Badge className={`${getStatusColor(quota.status)} flex items-center gap-1`}>
                            {getStatusIcon(quota.status)}
                            {quota.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">{quota.achievementPercentage}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-sm text-gray-600">Target</div>
                          <div className="text-lg font-semibold">{quota.targetQuotations} quotations</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Actual</div>
                          <div className="text-lg font-semibold">{quota.actualQuotations} quotations</div>
                        </div>
                      </div>

                      <Progress
                        value={Math.min(quota.achievementPercentage, 100)}
                        className="h-2"
                      />

                      {quota.achievementPercentage > 100 && (
                        <div className="text-xs text-green-600 mt-1">
                          +{quota.achievementPercentage - 100}% over target
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}