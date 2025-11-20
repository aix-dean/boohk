"use client"

import React from "react"
import Image from "next/image"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import type { Product } from "@/lib/firebase-service"
import { Timestamp } from "firebase/firestore"

interface PriceHistoryDialogProps {
  rowDialogOpen: boolean
  setRowDialogOpen: (open: boolean) => void
  selectedRowProduct: Product | null
  priceHistories: Record<string, any[]>
  loadingPriceHistories: Set<string>
  newPriceInDialog: string
  setNewPriceInDialog: (value: string) => void
  showUpdateForm: boolean
  setShowUpdateForm: (show: boolean) => void
  isUpdatingPriceInDialog: boolean
  handleUpdatePriceInDialog: () => void
  getSiteCode: (product: Product | null) => string | null
}

export function PriceHistoryDialog({
  rowDialogOpen,
  setRowDialogOpen,
  selectedRowProduct,
  priceHistories,
  loadingPriceHistories,
  newPriceInDialog,
  setNewPriceInDialog,
  showUpdateForm,
  setShowUpdateForm,
  isUpdatingPriceInDialog,
  handleUpdatePriceInDialog,
  getSiteCode,
}: PriceHistoryDialogProps) {
  return (
    <Dialog open={rowDialogOpen} onOpenChange={(open) => { setRowDialogOpen(open); if (!open) setShowUpdateForm(false); }}>
      <DialogContent className="w-full max-w-[550px] p-0">
        <div className="relative">
          {/* Header */}
          <div className="flex justify-between items-center p-3 sm:p-4">
            <h2 className="text-lg font-semibold">Price History</h2>
            <button
              onClick={() => setRowDialogOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Product Info */}
          <div className="p-3 space-y-2 transform translate-y-[-17px] translate-x-[4px]">
            <div className="text-base font-bold text-gray-900">{selectedRowProduct?.name || "N/A"}</div>
            <div className="text-[#333333]" style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: '12px', lineHeight: '100%', letterSpacing: '0%' }}>Current Price</div>
            <div className="text-base font-bold text-gray-900 space-y-2 transform translate-y-[-9px]">
              {selectedRowProduct?.price ? `Php ${Number(selectedRowProduct.price).toLocaleString()} /spot /day` : "Not set"}
            </div>
          </div>

          {/* Price History Table or Update Form */}
          <div className="px-2 sm:px-3 pb-4 transform -translate-y-1">
            <div className="overflow-hidden">
              {/* Table Header */}
              <div className="bg-[#f9f9f9] px-4 sm:px-6 py-3">
                <div className="grid grid-cols-3 gap-4 text-xs font-bold text-gray-900">
                  <div>Price</div>
                  <div>Date</div>
                  <div>By</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="max-h-48 overflow-y-auto bg-[#f9f9f9] border-t border-gray-200">
                {loadingPriceHistories.has(selectedRowProduct?.id || "") ? (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin mr-2" />
                      <span>Loading price history...</span>
                    </div>
                  </div>
                ) : priceHistories[selectedRowProduct?.id || ""] && priceHistories[selectedRowProduct?.id || ""].length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {priceHistories[selectedRowProduct?.id || ""].map((history, index) => (
                      <div key={`history-${history.id || index}`} className="px-4 sm:px-6 py-3">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div className="font-normal">
                            Php {Number(history.price).toLocaleString()} /spot /day
                          </div>
                          <div>
                            {history.created instanceof Timestamp
                              ? new Date(history.created.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : history.created
                                ? new Date(history.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "N/A"}
                          </div>
                          <div>{history.name || "System"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No price history available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Update Price Form */}
          <div className="p-3 sm:p-4">
            {showUpdateForm && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="price-in-dialog" style={{ fontFamily: 'Inter', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0%' }}>
                  New Price
                </Label>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: '14px', lineHeight: '100%', letterSpacing: '0%', color: '#333333' }}>Php</span>
                  <Input
                    id="price-in-dialog"
                    type="text"
                    className="w-[108px] h-[24px]"
                    value={newPriceInDialog}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                      setNewPriceInDialog(value ? Number(value).toLocaleString() : '');
                    }}
                  />
                  <span className="text-gray-500">/spot/day</span>
                  <Button
                    onClick={handleUpdatePriceInDialog}
                    disabled={isUpdatingPriceInDialog || newPriceInDialog === ""}
                    className="bg-[#1d0beb] hover:bg-[#1a0ad6] w-[82px] h-[25px] rounded-md text-xs font-bold text-white ml-auto"
                  >
                    {isUpdatingPriceInDialog ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            )}
            {!showUpdateForm && (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setShowUpdateForm(true)
                    setNewPriceInDialog("")
                  }}
                  className="bg-white border border-gray-300 rounded-[5px] h-6 text-xs font-medium text-[#333333] hover:bg-gray-50"
                >
                  Update Price
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}