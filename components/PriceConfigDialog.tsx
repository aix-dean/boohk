"use client"

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface PriceConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectPricingType: (type: 'regular' | 'premium') => void
  onContinue: () => void
  selectedPricingType: 'regular' | 'premium' | null
  priceConfigurations: any
  isFetchingPriceConfig: boolean
  width: string
  height: string
}

export function PriceConfigDialog({
  isOpen,
  onClose,
  onSelectPricingType,
  onContinue,
  selectedPricingType,
  priceConfigurations,
  isFetchingPriceConfig,
  width,
  height
}: PriceConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[20px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#333333]">Select Pricing Type</DialogTitle>
          <DialogDescription className="text-sm text-[#666666]">
            Choose the pricing type for this site. The price will be calculated based on the dimensions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isFetchingPriceConfig ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#1d0beb]" />
              <span className="ml-2 text-sm text-[#666666]">Loading price configurations...</span>
            </div>
          ) : priceConfigurations ? (
            <>
              <div
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedPricingType === 'regular' ? 'border-[#1d0beb] bg-blue-50' : 'border-gray-300'
                }`}
                onClick={() => onSelectPricingType('regular')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[#333333]">Regular Pricing</div>
                    <div className="text-sm text-[#666666]">
                      Price per sq. ft: ₱{priceConfigurations.regularPrice?.toLocaleString() || '0.00'}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {selectedPricingType === 'regular' && (
                      <div className="w-4 h-4 bg-[#1d0beb] rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
                {selectedPricingType === 'regular' && (() => {
                  const widthFt = parseFloat(width.replace(/,/g, '')) || 0
                  const heightFt = parseFloat(height.replace(/,/g, '')) || 0
                  const squareFootage = widthFt * heightFt
                  const pricePerSqFt = priceConfigurations.regularPrice || 0
                  const calculatedPrice = squareFootage * pricePerSqFt

                  return (
                    <div className="mt-2 text-xs text-[#666666] space-y-1">
                      <div>Dimensions: {widthFt} ft × {heightFt} ft = {squareFootage.toFixed(2)} sq ft</div>
                      <div>Price per sq ft: ₱{pricePerSqFt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="font-medium">Calculated price: ₱{calculatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  )
                })()}
              </div>

              <div
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedPricingType === 'premium' ? 'border-[#1d0beb] bg-blue-50' : 'border-gray-300'
                }`}
                onClick={() => onSelectPricingType('premium')}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[#333333]">Premium Pricing</div>
                    <div className="text-sm text-[#666666]">
                      Price per sq. ft: ₱{priceConfigurations.premiumPrice?.toLocaleString() || '0.00'}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {selectedPricingType === 'premium' && (
                      <div className="w-4 h-4 bg-[#1d0beb] rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
                {selectedPricingType === 'premium' && (() => {
                  const widthFt = parseFloat(width.replace(/,/g, '')) || 0
                  const heightFt = parseFloat(height.replace(/,/g, '')) || 0
                  const squareFootage = widthFt * heightFt
                  const pricePerSqFt = priceConfigurations.premiumPrice || 0
                  const calculatedPrice = squareFootage * pricePerSqFt

                  return (
                    <div className="mt-2 text-xs text-[#666666] space-y-1">
                      <div>Dimensions: {widthFt} ft × {heightFt} ft = {squareFootage.toFixed(2)} sq ft</div>
                      <div>Price per sq ft: ₱{pricePerSqFt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="font-medium">Calculated price: ₱{calculatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  )
                })()}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-[#666666]">
              No price configurations found. Please set up price configurations in your settings.
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#c4c4c4] text-[#4e4e4e] hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={onContinue}
            className="bg-[#1d0beb] hover:bg-[#1508d1] text-white"
            disabled={!selectedPricingType || isFetchingPriceConfig}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}