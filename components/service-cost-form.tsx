"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface ServiceCostFormProps {
  onTotalChange?: (total: number) => void
}

export function ServiceCostForm({ onTotalChange }: ServiceCostFormProps) {
  const [fees, setFees] = useState({
    crewFee: 0,
    overtimeFee: 0,
    transpo: 0,
    tollFee: 0,
    mealAllowance: 0,
    other: 0,
  })

  const updateFee = (field: keyof typeof fees, value: string) => {
    const numValue = Number.parseFloat(value) || 0
    const newFees = { ...fees, [field]: numValue }
    setFees(newFees)

    const total = Object.values(newFees).reduce((sum, fee) => sum + fee, 0)
    onTotalChange?.(total)
  }

  const total = Object.values(fees).reduce((sum, fee) => sum + fee, 0)

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-medium">Service Cost</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="crewFee" className="text-sm font-normal">
            Crew Fee:
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-sm">P</span>
            <Input
              id="crewFee"
              type="number"
              className="w-20 h-8 text-right"
              value={fees.crewFee || ""}
              onChange={(e) => updateFee("crewFee", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="overtimeFee" className="text-sm font-normal">
            Overtime Fee:
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-sm">P</span>
            <Input
              id="overtimeFee"
              type="number"
              className="w-20 h-8 text-right"
              value={fees.overtimeFee || ""}
              onChange={(e) => updateFee("overtimeFee", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="transpo" className="text-sm font-normal">
            Transpo:
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-sm">P</span>
            <Input
              id="transpo"
              type="number"
              className="w-20 h-8 text-right"
              value={fees.transpo || ""}
              onChange={(e) => updateFee("transpo", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="tollFee" className="text-sm font-normal">
            Toll Fee:
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-sm">P</span>
            <Input
              id="tollFee"
              type="number"
              className="w-20 h-8 text-right"
              value={fees.tollFee || ""}
              onChange={(e) => updateFee("tollFee", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="mealAllowance" className="text-sm font-normal">
            Meal Allowance:
          </Label>
          <div className="flex items-center gap-1">
            <span className="text-sm">P</span>
            <Input
              id="mealAllowance"
              type="number"
              className="w-20 h-8 text-right"
              value={fees.mealAllowance || ""}
              onChange={(e) => updateFee("mealAllowance", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start p-0 h-auto text-sm font-normal text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Other
        </Button>

        <div className="flex items-center justify-between pt-2 border-t">
          <Label className="text-sm font-medium">Total:</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">P</span>
            <span className="text-sm font-medium min-w-[80px] text-right">
              {total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
