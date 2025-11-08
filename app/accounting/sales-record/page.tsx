import { SalesRecordTable } from "@/components/accounting/sales-record-table"

export default function Page() {
  return (
    <div className="min-h-screen overflow-x-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-2 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Accounting</span>
              <span>/</span>
              <span>Sales Record</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Sales Record Management
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Track and manage your sales records with automated calculations for VAT, taxes, and collections. 
              All data is stored locally in your browser.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          <SalesRecordTable />
          
          {/* Information Cards */}
          
        </div>
      </div>
    </div>
  )
}
