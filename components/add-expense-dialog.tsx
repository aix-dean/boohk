"use client"

import { useState, useRef } from "react"
import { X, Upload, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface AddExpenseDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: ExpenseData) => void
}

interface ExpenseData {
  item: string
  amount: number
  requestedBy: string
  attachments: File[]
}

interface FormErrors {
  date?: string
  item?: string
  amount?: string
  requestedBy?: string
}

export function AddExpenseDialog({ isOpen, onClose, onSubmit }: AddExpenseDialogProps) {
  const [formData, setFormData] = useState<ExpenseData>({
    item: "",
    amount: 0,
    requestedBy: "",
    attachments: [],
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.item.trim()) newErrors.item = "Item is required"
    if (!formData.amount || formData.amount <= 0) newErrors.amount = "Amount must be greater than 0"
    if (!formData.requestedBy.trim()) newErrors.requestedBy = "Requested by is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    onSubmit?.(formData)
    handleClose()
  }

  const handleClose = () => {
    setFormData({
      item: "",
      amount: 0,
      requestedBy: "",
      attachments: [],
    })
    setErrors({})
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({ ...prev, attachments: files }))
  }

  const handleInputChange = (field: keyof Omit<ExpenseData, 'attachments'>, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#000000] text-lg md:text-xl">
            <span>+ Add Expense</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">

          <div>
            <label className="block text-sm font-medium text-[#000000] mb-2">
              Item:
            </label>
            <Input
              value={formData.item}
              onChange={(e) => handleInputChange('item', e.target.value)}
              className="border-[#c4c4c4] h-10 md:h-11"
              placeholder="Enter item name"
            />
            {errors.item && <p className="text-red-500 text-xs mt-1">{errors.item}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#000000] mb-2">
              Amount:
            </label>
            <Input
              type="number"
              value={formData.amount || ""}
              onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
              className="border-[#c4c4c4] h-10 md:h-11"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#000000] mb-2">
              Requested By:
            </label>
            <Input
              value={formData.requestedBy}
              onChange={(e) => handleInputChange('requestedBy', e.target.value)}
              className="border-[#c4c4c4] h-10 md:h-11"
              placeholder="Enter requester name"
            />
            {errors.requestedBy && <p className="text-red-500 text-xs mt-1">{errors.requestedBy}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#000000] mb-2">
              Attachments:
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#c4c4c4] text-[#a1a1a1] bg-[#efefef] justify-center hover:bg-[#e0e0e0] h-10 md:h-11"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
            {formData.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {formData.attachments.map((file, index) => (
                  <p key={index} className="text-xs text-[#a1a1a1]">
                    {file.name}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-[#c4c4c4] text-[#000000] bg-transparent hover:bg-[#f0f0f0] w-full sm:w-auto h-10 md:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#737fff] hover:bg-[#5a5fff] text-white w-full sm:w-auto h-10 md:h-11"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}