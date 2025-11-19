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
      <DialogContent className="sm:max-w-[550px] p-0">
        <div className="relative">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">Price History</h2>
            <button
              onClick={() => setRowDialogOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Product Info */}
          <div className="p-4 space-y-2">
            <div className="text-sm text-gray-600">{selectedRowProduct?.name || "N/A"}</div>
            <div className="text-sm text-gray-500">{getSiteCode(selectedRowProduct) || "N/A"}</div>
            <div className="text-sm text-gray-500">Current Price</div>
            <div className="text-sm font-medium">
              {selectedRowProduct?.price ? `₱${Number(selectedRowProduct.price).toLocaleString()}/month` : "Not set"}
            </div>
          </div>

          {/* Price History Table or Update Form */}
          <div className="px-3 pb-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-3 border-b">
                <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-900">
                  <div>Price</div>
                  <div>Date</div>
                  <div>By</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="max-h-48 overflow-y-auto">
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
                      <div key={`history-${history.id || index}`} className="px-6 py-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="font-medium">
                            ₱{Number(history.price).toLocaleString()}
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
          <div className="p-4 border-t">
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
                    className="w-32"
                    value={newPriceInDialog}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                      setNewPriceInDialog(value ? Number(value).toLocaleString() : '');
                    }}
                  />
                  <span className="text-gray-500">/spot/day</span>
                  <Button
                    onClick={handleUpdatePriceInDialog}
                    disabled={isUpdatingPriceInDialog}
                    className="bg-blue-500 hover:bg-blue-600 ml-auto"
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
                    setNewPriceInDialog(selectedRowProduct?.price ? Number(selectedRowProduct.price).toLocaleString() : "")
                  }}
                  className="bg-[#ff3131] hover:bg-[#e02828]"
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