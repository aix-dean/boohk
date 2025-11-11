"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TransactionsPage() {
  const transactions = [
    {
      date: "Oct 18, 2025",
      siteImage: "/led-billboard-shopping-mall.jpg",
      siteName: "Ayala Mall Corner LED",
      siteCode: "NAN0231",
      bookingId: "BK#00054",
      totalDays: 3,
      grossAmount: 45000,
      fees: 2250,
      tax: 5130,
      discount: 0,
      payoutAmount: 37620,
      status: "For Review",
    },
    {
      date: "Oct 18, 2025",
      siteImage: "/led-billboard-santa-cruz.jpg",
      siteName: "LED at Santa Cruz",
      siteCode: "NAN0232",
      bookingId: "BK#00055",
      totalDays: 5,
      grossAmount: 75000,
      fees: 3750,
      tax: 8550,
      discount: 0,
      payoutAmount: 62700,
      status: "Upcoming",
    },
    {
      date: "Oct 18, 2025",
      siteImage: "/3d-led-billboard.jpg",
      siteName: "3D LED at BGC",
      siteCode: "NAN0233",
      bookingId: "BK#00056",
      totalDays: 15,
      grossAmount: 225000,
      fees: 11250,
      tax: 25650,
      discount: 0,
      payoutAmount: 188100,
      status: "Paid",
    },
    {
      date: "Oct 18, 2025",
      siteImage: "/digital-billboard-abc.jpg",
      siteName: "Billboard ABC",
      siteCode: "NAN0234",
      bookingId: "BK#00057",
      totalDays: 1,
      grossAmount: 15000,
      fees: 750,
      tax: 1710,
      discount: 0,
      payoutAmount: 12540,
      status: "Paid",
    },
    {
      date: "Oct 18, 2025",
      siteImage: "/edsa-led-billboard.jpg",
      siteName: "EDSA LED",
      siteCode: "NAN0235",
      bookingId: "BK#00058",
      totalDays: 8,
      grossAmount: 120000,
      fees: 6000,
      tax: 13680,
      discount: 0,
      payoutAmount: 100000,
      status: "Paid",
    },
    {
      date: "Oct 18, 2025",
      siteImage: "/led-billboard-2-0.jpg",
      siteName: "LED Billboard 2.0",
      siteCode: "NAN0236",
      bookingId: "BK#00059",
      totalDays: 5,
      grossAmount: 75000,
      fees: 3750,
      tax: 8550,
      discount: 0,
      payoutAmount: 62700,
      status: "Declined",
    },
    {
      date: "Oct 18, 2025",
      siteImage: "/led-billboard-display.jpg",
      siteName: "LED Billboard",
      siteCode: "NAN0237",
      bookingId: "BK#00060",
      totalDays: 3,
      grossAmount: 45000,
      fees: 2250,
      tax: 5130,
      discount: 0,
      payoutAmount: 37620,
      status: "Paid",
    },
  ]

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString()}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "For Review":
        return "text-blue-600"
      case "Upcoming":
        return "text-green-600"
      case "Paid":
        return "text-green-600"
      case "Declined":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
          <Select defaultValue="this-month">
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="This month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This month</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="this-year">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-indigo-600 text-white rounded-lg p-6">
            <div className="text-sm mb-2">Total Transactions</div>
            <div className="text-3xl font-semibold">103</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Total Retail Revenue</div>
            <div className="text-2xl font-semibold text-gray-900">₱3,042,650.00</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Fees and Commissions / Payout</div>
            <div className="text-2xl font-semibold text-gray-900">₱912,795.00</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Net Sales</div>
            <div className="text-2xl font-semibold text-gray-900">₱2,129,855.00</div>
          </div>
        </div>


        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-white">
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Date</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Site</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Booking ID</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Total Days</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Gross Amount</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Fees</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Tax (12%)</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Discount</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Payout Amount</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 text-sm text-gray-900">{transaction.date}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={transaction.siteImage || "/placeholder.svg"}
                          alt={transaction.siteName}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <div>
                          <div className="text-xs text-gray-500">{transaction.siteCode}</div>
                          <div className="text-sm text-gray-900 font-medium">{transaction.siteName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">{transaction.bookingId}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{transaction.totalDays}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{formatCurrency(transaction.grossAmount)}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{formatCurrency(transaction.fees)}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{formatCurrency(transaction.tax)}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{formatCurrency(transaction.discount)}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{formatCurrency(transaction.payoutAmount)}</td>
                    <td className="py-4 px-4">
                      <span className={`text-sm font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}