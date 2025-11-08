"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface ConfigurationDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: ConfigurationData) => void
  initialData?: ConfigurationData
  isLoading?: boolean
}

interface ConfigurationData {
  pettyCashAmount: number
  warnAmount: number
}

interface FormErrors {
  pettyCashAmount?: string
  warnAmount?: string
}

export function ConfigurationDialog({ isOpen, onClose, onSave, initialData, isLoading = false }: ConfigurationDialogProps) {
  const [formData, setFormData] = useState<ConfigurationData>({
    pettyCashAmount: initialData?.pettyCashAmount || 10000,
    warnAmount: initialData?.warnAmount || 2000,
  })
  const [errors, setErrors] = useState<FormErrors>({})

  // Reset form when dialog opens with initial data
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        pettyCashAmount: initialData.pettyCashAmount,
        warnAmount: initialData.warnAmount,
      })
    }
  }, [isOpen, initialData])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.pettyCashAmount || formData.pettyCashAmount <= 0) {
      newErrors.pettyCashAmount = "Petty cash amount must be greater than 0"
    }

    if (!formData.warnAmount || formData.warnAmount <= 0) {
      newErrors.warnAmount = "Warning amount must be greater than 0"
    }

    if (formData.warnAmount >= formData.pettyCashAmount) {
      newErrors.warnAmount = "Warning amount must be less than petty cash amount"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    onSave(formData)
    handleClose()
  }

  const handleClose = () => {
    setFormData({
      pettyCashAmount: initialData?.pettyCashAmount || 10000,
      warnAmount: initialData?.warnAmount || 2000,
    })
    setErrors({})
    onClose()
  }

  const handleInputChange = (field: keyof ConfigurationData, value: string) => {
    const numValue = parseFloat(value.replace(/,/g, '')) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const formatCurrency = (value: number): string => {
    return value.toLocaleString()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#000000] text-lg md:text-xl">Petty Cash Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          <div>
            <label className="block text-base md:text-lg font-medium text-[#000000] mb-2 md:mb-3">
              Petty Cash Amount:
            </label>
            <Input
              type="text"
              value={formatCurrency(formData.pettyCashAmount)}
              onChange={(e) => handleInputChange('pettyCashAmount', e.target.value)}
              className="w-full border-[#c4c4c4] bg-[#fafafa] text-[#000000] h-10 md:h-11"
              placeholder="10,000"
            />
            {errors.pettyCashAmount && (
              <p className="text-red-500 text-sm mt-1">{errors.pettyCashAmount}</p>
            )}
          </div>

          <div>
            <label className="block text-base md:text-lg font-medium text-[#000000] mb-2 md:mb-3">
              Warn when amount reaches:
            </label>
            <Input
              type="text"
              value={formatCurrency(formData.warnAmount)}
              onChange={(e) => handleInputChange('warnAmount', e.target.value)}
              className="w-full border-[#c4c4c4] bg-[#fafafa] text-[#000000] h-10 md:h-11"
              placeholder="2,000"
            />
            {errors.warnAmount && (
              <p className="text-red-500 text-sm mt-1">{errors.warnAmount}</p>
            )}
          </div>

          <div className="text-sm text-[#a1a1a1] bg-[#f9f9f9] p-3 md:p-4 rounded-md">
            <p className="font-medium mb-2">Configuration Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-xs md:text-sm">
              <li>Petty cash amount is the total fund available</li>
              <li>Warning triggers when remaining balance reaches this threshold</li>
              <li>Warning amount should be less than petty cash amount</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#c4c4c4] text-[#000000] bg-transparent hover:bg-[#fafafa] w-full sm:w-auto h-10 md:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-[#737fff] hover:bg-[#5a5fff] text-white disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto h-10 md:h-11"
          >
            {isLoading ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}