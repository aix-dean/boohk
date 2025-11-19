import { Booking } from 'oh-db-models'

interface TransactionMetricsProps {
  transactions: Booking[]
}

export function TransactionMetrics({ transactions }: TransactionMetricsProps) {
  const totalTransactions = transactions.length
  const totalRetailRevenue = transactions.reduce((sum, t) => sum + (t.transaction?.amount || 0), 0)
  const totalFees = transactions.reduce((sum, t) => sum + (t.transaction?.fees.totalFee || 0) + (t.tax?.taxAmount || 0) + (t.discount?.discountTotal || 0), 0)
  const netSales = totalRetailRevenue - totalFees

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-indigo-600 text-white rounded-lg px-6 py-[17px]">
        <div className="text-xs mb-2">Total Transactions</div>
        <div className="text-xl font-semibold">{totalTransactions}</div>
      </div>
      <div className="bg-white rounded-lg px-6 py-[17px] border border-gray-200">
        <div className="text-xs text-gray-600 mb-2">Total Retail Revenue</div>
        <div className="text-xl font-semibold text-gray-900">
          ₱{totalRetailRevenue.toLocaleString()}
        </div>
      </div>
      <div className="bg-white rounded-lg px-6 py-[17px] border border-gray-200">
        <div className="text-xs text-gray-600 mb-2">Fees and Commissions</div>
        <div className="text-xl font-semibold text-gray-900">
          ₱{totalFees.toLocaleString()}
        </div>
      </div>
      <div className="bg-white rounded-lg px-6 py-[17px] border border-gray-200">
        <div className="text-xs text-gray-600 mb-2">Net Sales</div>
        <div className="text-xl font-semibold text-gray-900">
          ₱{netSales.toLocaleString()}
        </div>
      </div>
    </div>
  )
}