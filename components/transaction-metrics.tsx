import { Booking } from 'oh-db-models'

interface TransactionMetricsProps {
  transactions: Booking[]
}

export function TransactionMetrics({ transactions }: TransactionMetricsProps) {
  const totalTransactions = transactions.length
  const totalRetailRevenue = transactions.reduce((sum, t) => sum + (t.transaction?.amount || 0), 0)
  const totalFees = transactions.reduce((sum, t) => sum + (t.transaction?.fees?.totalFee || 0) + (t.tax?.taxAmount || 0) + (t.discount?.discountTotal || 0), 0)
  const netSales = totalRetailRevenue - totalFees

  return (
    <div className="w-full overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-indigo-600 text-white rounded-lg px-4 py-4 sm:px-6 sm:py-[17px] min-w-0">
          <div className="text-xs mb-2 truncate">Total Transactions</div>
          <div className="text-lg sm:text-xl font-semibold truncate">{totalTransactions}</div>
        </div>
        <div className="bg-white rounded-lg px-4 py-4 sm:px-6 sm:py-[17px] border border-gray-200 min-w-0">
          <div className="text-xs text-gray-600 mb-2 truncate">Total Retail Revenue</div>
          <div className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
            ₱{totalRetailRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white rounded-lg px-4 py-4 sm:px-6 sm:py-[17px] border border-gray-200 min-w-0">
          <div className="text-xs text-gray-600 mb-2 truncate">Fees and Commissions</div>
          <div className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
            ₱{totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white rounded-lg px-4 py-4 sm:px-6 sm:py-[17px] border border-gray-200 min-w-0">
          <div className="text-xs text-gray-600 mb-2 truncate">Net Sales</div>
          <div className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
            ₱{netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}