"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil } from "lucide-react"
import { ComingSoonModal } from "@/components/coming-soon-dialog"

export default function PayoutsPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    setShowModal(true)
  }, [])

  const handleClose = () => {
    setShowModal(false)
    router.back()
  }

  const handleNotify = () => {
    setShowModal(false)
    router.back()
  }

  return (
    <>
      {showModal && <ComingSoonModal onClose={handleClose} onNotify={handleNotify} />}
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Payouts</h1>
          <Select defaultValue="this-month">
            <SelectTrigger className="w-[140px] bg-white border-gray-300">
              <SelectValue placeholder="This month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This month</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="this-year">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payout Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Total Payouts Received */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-2">Total Payouts Received</div>
            <div className="text-2xl font-semibold text-green-600">₱0.0</div>
          </div>

          {/* Pending Payout Amount */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-2">Pending Payout Amount</div>
            <div className="text-2xl font-semibold text-gray-900">₱0.0</div>
          </div>

          {/* Last Payout Date */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-2">Last Payout Date</div>
            <div className="text-2xl font-semibold text-gray-900">-</div>
          </div>

          {/* Min. Payout Amount */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="text-sm text-gray-600">Min. Payout Amount</div>
              <button className="text-gray-400 hover:text-gray-600">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="text-2xl font-semibold text-gray-900">₱0.00</div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="text-sm text-gray-600">Payment Method</div>
              <button className="text-gray-400 hover:text-gray-600">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">-</span>
              </div>
              <div className="text-sm text-gray-900">
                <span className="font-medium">Bank</span>
                <span className="text-gray-500"> (••••)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}