"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { salesQuotaService } from "@/lib/sales-quota-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, User } from "lucide-react"

interface SalesQuotaManagementDialogProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  month: number
  year: number
}

interface AssociateQuota {
  id: string
  name: string
  currentTarget: number
  newTarget: number
}

export function SalesQuotaManagementDialog({
  isOpen,
  onClose,
  companyId,
  month,
  year
}: SalesQuotaManagementDialogProps) {
  const [associates, setAssociates] = useState<AssociateQuota[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen && companyId) {
      fetchAssociatesAndQuotas()
    }
  }, [isOpen, companyId, month, year])

  const fetchAssociatesAndQuotas = async () => {
    setLoading(true)
    try {
      // Get all sales associates
      const salesAssociates = await salesQuotaService.getSalesAssociates(companyId)

      // Get existing quotas for this month/year
      const existingQuotas = await salesQuotaService.getCompanyQuotas(companyId, month, year)

      // Combine associates with their current quotas
      const associateQuotas: AssociateQuota[] = salesAssociates.map(associate => {
        const existingQuota = existingQuotas.find(q => q.associateId === associate.id)
        return {
          id: associate.id,
          name: associate.name,
          currentTarget: existingQuota?.targetQuotations || 0,
          newTarget: existingQuota?.targetQuotations || 0,
        }
      })

      setAssociates(associateQuotas)
    } catch (error) {
      console.error("Error fetching associates and quotas:", error)
      toast({
        title: "Error",
        description: "Failed to load sales associates and quotas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTargetChange = (associateId: string, newTarget: number) => {
    setAssociates(prev =>
      prev.map(associate =>
        associate.id === associateId
          ? { ...associate, newTarget: Math.max(0, newTarget) }
          : associate
      )
    )
  }

  const handleSaveQuotas = async () => {
    setSaving(true)
    try {
      const currentUserId = "admin" // In a real app, get from auth context

      // Save quotas for associates that have changed
      const savePromises = associates
        .filter(associate => associate.newTarget !== associate.currentTarget)
        .map(associate =>
          salesQuotaService.setAssociateQuota(
            associate.id,
            associate.name,
            companyId,
            month,
            year,
            associate.newTarget,
            currentUserId
          )
        )

      await Promise.all(savePromises)

      // Update local state to reflect saved changes
      setAssociates(prev =>
        prev.map(associate => ({
          ...associate,
          currentTarget: associate.newTarget,
        }))
      )

      toast({
        title: "Success",
        description: "Sales quotas have been updated successfully",
      })
    } catch (error) {
      console.error("Error saving quotas:", error)
      toast({
        title: "Error",
        description: "Failed to save sales quotas",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1] || 'Unknown'
  }

  const hasChanges = associates.some(associate => associate.newTarget !== associate.currentTarget)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Manage Sales Quotas - {getMonthName(month)} {year}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading sales associates...</p>
            </div>
          ) : associates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sales associates found for this company.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {associates.map((associate) => (
                  <Card key={associate.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Label htmlFor={`target-${associate.id}`} className="text-sm font-medium">
                            {associate.name}
                          </Label>
                          {associate.currentTarget > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Current target: {associate.currentTarget} quotations
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`target-${associate.id}`}
                            type="number"
                            min="0"
                            value={associate.newTarget}
                            onChange={(e) => handleTargetChange(associate.id, parseInt(e.target.value) || 0)}
                            className="w-24"
                            placeholder="0"
                          />
                          <span className="text-sm text-gray-600">quotations</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveQuotas}
                  disabled={!hasChanges || saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Saving..." : "Save Quotas"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}