"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Plus, Save, RefreshCw, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { encashmentService } from "@/lib/encashment-service"
import { Card, CardContent } from "@/components/ui/card"

const STORAGE_KEY = "acc_encash_pcf_rows_v1"
const STORAGE_KEY_SETTINGS = "acc_encash_pcf_settings_v1"

const parseNumber = (value: any): number => {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return isNaN(value) ? 0 : value
  if (typeof value === "string") {
    const cleaned = value.replace(/[₱,\s]/g, "")
    const parsed = Number.parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function sumBy(arr: any[], key: string): number {
  return arr.reduce((sum, item) => sum + parseNumber(item[key]), 0)
}

// Assumptions: 1% = 0.01, 2% = 0.02
function compute(row: any): any {
  const gross = parseNumber(row.grossAmount)
  const netOfVat = gross / 1.12
  const inputVat = gross - netOfVat
  const onePercent = netOfVat * 0.01
  const twoPercent = netOfVat * 0.02
  const netAmount = gross - onePercent - twoPercent
  return { ...row, netOfVat, inputVat, onePercent, twoPercent, netAmount }
}

type PettyCashRow = {
  id: string
  category: string
  month: string
  date: string
  pettyCashVoucherNo: string
  supplierName: string
  description: string
  accountTitle: string
  documentTypeNo: string
  tinNo: string
  companyAddress: string
  grossAmount: number
  netOfVat: number
  inputVat: number
  onePercent: number
  twoPercent: number
  netAmount: number
  deleted: boolean
  type: string
}

type PettyCashSettings = {
  companyName: string
  pettyCashFundReplenishment: string
  cutOffPeriod: string
  pettyCashFundName: string
  pettyCashFundAmount: number
}

export function PettyCashFundTable() {
  const { toast } = useToast()
  const [rows, setRows] = useState<PettyCashRow[]>([])
  const [settings, setSettings] = useState<PettyCashSettings>({
    companyName: "",
    pettyCashFundReplenishment: "",
    cutOffPeriod: "",
    pettyCashFundName: "",
    pettyCashFundAmount: 0,
  })
  const [query, setQuery] = useState("")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [totalFundUsage, setTotalFundUsage] = useState(0)
  const [remainingBalanceForDeposit, setRemainingBalanceForDeposit] = useState(0)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [transactionForm, setTransactionForm] = useState({
    category: "",
    month: "",
    date: "",
    pcvNo: "",
    supplier: "",
    description: "",
    account: "",
    document: "",
    tin: "",
    address: "",
    grossAmount: "",
    netOfVat: "",
    inputVat: "",
    onePercent: "",
    twoPercent: "",
    netAmount: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Load settings
      const settingsData = await encashmentService.getPettyCashSettings()
      if (settingsData.length > 0) {
        setSettings(settingsData[0])
        setSettingsId(settingsData[0].id || null)
      }

      // Load transactions
      const transactionsData = await encashmentService.getPettyCashTransactions()
      setRows(transactionsData.map(compute))
      calculateTotals(transactionsData)
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load data from database. Using local data.")
      // Fallback to localStorage
      loadFromLocalStorage()
    } finally {
      setLoading(false)
    }
  }

  function loadFromLocalStorage() {
    try {
      const s = localStorage.getItem("acc_encash_pcf_settings_v1")
      if (s) setSettings(JSON.parse(s))
    } catch {}
    try {
      const saved = localStorage.getItem("acc_encash_pcf_rows_v1")
      if (saved) {
        const parsed = JSON.parse(saved)
        setRows(parsed.map(compute))
        calculateTotals(parsed)
        return
      }
    } catch {}
    setRows([])
    calculateTotals([])
  }

  const filtered = useMemo(() => rows.filter((r) => includesAny(r, query)), [rows, query])

  const calculateTotals = (data: any[]) => {
    const base = data.length ? data : rows
    const gross = sumBy(base, (r) => parseNumber(r.grossAmount) || 0)
    const netOfVat = sumBy(base, (r) => parseNumber(r.netOfVat) || 0)
    const inputVat = sumBy(base, (r) => parseNumber(r.inputVat) || 0)
    const oneP = sumBy(base, (r) => parseNumber(r.onePercent) || 0)
    const twoP = sumBy(base, (r) => parseNumber(r.twoPercent) || 0)
    const netAmount = sumBy(base, (r) => parseNumber(r.netAmount) || 0)

    const fundAmount = parseNumber(settings.pettyCashFundAmount) || 0
    const balanceForDeposit = fundAmount - netAmount
    const totalPettyCashFund = netAmount
    const pcfAmountBalance = fundAmount - totalPettyCashFund

    setTotalFundUsage(isNaN(totalPettyCashFund) ? 0 : totalPettyCashFund)
    setRemainingBalanceForDeposit(isNaN(balanceForDeposit) ? 0 : balanceForDeposit)
  }

  function addRow(formData: any) {
    setIsTransactionModalOpen(true)
  }

  async function handleTransactionSubmit() {
    const newRow = {
      ...transactionForm,
      grossAmount: parseNumber(transactionForm.grossAmount),
      netOfVat: parseNumber(transactionForm.netOfVat),
      inputVat: parseNumber(transactionForm.inputVat),
      onePercent: parseNumber(transactionForm.onePercent),
      twoPercent: parseNumber(transactionForm.twoPercent),
      netAmount: parseNumber(transactionForm.netAmount),
      type: "PETTYCASH",
      deleted: false,
    }

    try {
      const id = await encashmentService.createPettyCashTransaction(newRow)
      const rowWithId = { ...newRow, id }
      setRows((r) => [rowWithId, ...r])
      toast.success("New transaction added successfully.")

      // Reset form and close modal
      setTransactionForm({
        category: "",
        month: "",
        date: "",
        pcvNo: "",
        supplier: "",
        description: "",
        account: "",
        document: "",
        tin: "",
        address: "",
        grossAmount: "",
        netOfVat: "",
        inputVat: "",
        onePercent: "",
        twoPercent: "",
        netAmount: "",
      })
      setIsTransactionModalOpen(false)
    } catch (error) {
      console.error("Error adding transaction:", error)
      toast.error("Failed to add transaction. Please try again.")
    }
  }

  function handleGrossAmountChange(value: string) {
    const gross = parseNumber(value)
    const netOfVat = gross / 1.12
    const inputVat = netOfVat * 0.12
    const onePercent = netOfVat * 0.01
    const twoPercent = netOfVat * 0.02
    const netAmount = gross - onePercent - twoPercent

    setTransactionForm((prev) => ({
      ...prev,
      grossAmount: value,
      netOfVat: netOfVat.toFixed(2),
      inputVat: inputVat.toFixed(2),
      onePercent: onePercent.toFixed(2),
      twoPercent: twoPercent.toFixed(2),
      netAmount: netAmount.toFixed(2),
    }))
  }

  async function updateRow(id: string, patch: any) {
    const updatedRow = compute({ ...rows.find((r) => r.id === id)!, ...patch })

    try {
      await encashmentService.updatePettyCashTransaction(id, updatedRow)
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          return updatedRow
        }),
      )
    } catch (error) {
      console.error("Error updating transaction:", error)
      toast.error("Failed to update transaction. Please try again.")
    }
  }

  async function deleteRow(id: string) {
    try {
      await encashmentService.deletePettyCashTransaction(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success("Transaction deleted successfully.")
    } catch (error) {
      console.error("Error deleting transaction:", error)
      toast.error("Failed to delete transaction. Please try again.")
    }
  }

  async function deleteSelectedRows() {
    if (selectedRows.length === 0) return

    try {
      await encashmentService.deleteMultiplePettyCashTransactions(selectedRows)
      setRows((prev) => prev.filter((r) => !selectedRows.includes(r.id!)))
      setSelectedRows([])
      toast.success(`${selectedRows.length} transaction(s) deleted successfully.`)
    } catch (error) {
      console.error("Error deleting transactions:", error)
      toast.error("Failed to delete transactions. Please try again.")
    }
  }

  async function saveSettings() {
    try {
      if (settingsId) {
        await encashmentService.updatePettyCashSettings(settingsId, settings)
      } else {
        const id = await encashmentService.createPettyCashSettings(settings)
        setSettingsId(id)
      }
      setDirty(false)
      toast.success("Settings saved successfully.")
    } catch (error) {
      console.error("Error saving settings:", error)
      toast.error("Failed to save settings. Please try again.")
    }
  }

  function toggleRowSelection(id: string) {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    if (selectedRows.length === filtered.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filtered.map((row) => row.id!))
    }
  }

  const handleSaveAndClose = async () => {
    await saveSettings()
    setIsConfigModalOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Petty Cash Fund</h2>
            <p className="text-sm text-gray-600 mt-1">Manage petty cash fund settings and transactions</p>
          </div>
          <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Settings className="h-4 w-4 mr-2" />
                Configure Fund
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Petty Cash Fund Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Company Name</label>
                    <Input
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.companyName}
                      onChange={(e) => {
                        setSettings((s) => ({ ...s, companyName: e.target.value }))
                        setDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Fund Replenishment</label>
                    <Input
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.pettyCashFundReplenishment}
                      onChange={(e) => {
                        setSettings((s) => ({ ...s, pettyCashFundReplenishment: e.target.value }))
                        setDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Cut-off Period</label>
                    <Input
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.cutOffPeriod}
                      onChange={(e) => {
                        setSettings((s) => ({ ...s, cutOffPeriod: e.target.value }))
                        setDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Fund Name</label>
                    <Input
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.pettyCashFundName}
                      onChange={(e) => {
                        setSettings((s) => ({ ...s, pettyCashFundName: e.target.value }))
                        setDirty(true)
                      }}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Fund Amount</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.pettyCashFundAmount}
                      onChange={(e) => {
                        setSettings((s) => ({ ...s, pettyCashFundAmount: parseNumber(e.target.value) }))
                        setDirty(true)
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveAndClose}
                    disabled={!dirty || loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Fund Amount</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(settings.pettyCashFundAmount)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-green-700 dark:text-green-300">Total Fund Usage</div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(totalFundUsage)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Remaining Balance</div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatCurrency(remainingBalanceForDeposit)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
            <p className="text-sm text-gray-600">Manage petty cash transactions</p>
          </div>
          <div className="flex gap-2">
            {selectedRows.length > 0 && (
              <Button variant="destructive" size="sm" onClick={deleteSelectedRows} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedRows.length})
              </Button>
            )}
            <Button onClick={() => addRow({})} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Category</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Month</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Date</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">PCV No.</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Supplier</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Description</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Account</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Document</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">TIN</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4">Address</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Gross Amount</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Net of VAT</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Input VAT</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">1% Tax</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">2% Tax</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 text-right">Net Amount</TableHead>
                  <TableHead className="font-semibold text-gray-900 py-3 px-4 w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center text-gray-500 py-8">
                      Loading transactions...
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filtered.map((row, index) => (
                      <TableRow
                        key={row.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                      >
                        <TableCell className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(row.id!)}
                            onChange={() => toggleRowSelection(row.id!)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.category}
                            onChange={(e) => updateRow(row.id!, { category: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.month}
                            onChange={(e) => updateRow(row.id!, { month: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.date}
                            onChange={(e) => updateRow(row.id!, { date: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.pettyCashVoucherNo}
                            onChange={(e) => updateRow(row.id!, { pettyCashVoucherNo: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.supplierName}
                            onChange={(e) => updateRow(row.id!, { supplierName: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.description}
                            onChange={(e) => updateRow(row.id!, { description: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.accountTitle}
                            onChange={(e) => updateRow(row.id!, { accountTitle: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.documentTypeNo}
                            onChange={(e) => updateRow(row.id!, { documentTypeNo: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.tinNo}
                            onChange={(e) => updateRow(row.id!, { tinNo: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Input
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                            value={row.companyAddress}
                            onChange={(e) => updateRow(row.id!, { companyAddress: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-right"
                            value={row.grossAmount}
                            onChange={(e) => updateRow(row.id!, { grossAmount: parseNumber(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(row.netOfVat)}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(row.inputVat)}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(row.onePercent)}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(row.twoPercent)}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right text-sm font-bold text-gray-900">
                          {formatCurrency(row.netAmount)}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRow(row.id!)}
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center text-gray-500 py-8">
                          No transactions found. Try adjusting your search or add a new transaction.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
                <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                  <TableCell colSpan={11} className="font-bold text-gray-900 py-4 px-4">
                    TOTALS
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                    {formatCurrency(sumBy(rows, (r) => parseNumber(r.grossAmount)))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                    {formatCurrency(sumBy(rows, (r) => parseNumber(r.netOfVat)))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                    {formatCurrency(sumBy(rows, (r) => parseNumber(r.inputVat)))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                    {formatCurrency(sumBy(rows, (r) => parseNumber(r.onePercent)))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                    {formatCurrency(sumBy(rows, (r) => parseNumber(r.twoPercent)))}
                  </TableCell>
                  <TableCell className="text-right font-bold text-blue-600 py-4 px-4 text-lg">
                    {formatCurrency(sumBy(rows, (r) => parseNumber(r.netAmount)))}
                  </TableCell>
                  <TableCell className="py-4 px-4" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.category}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, category: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Month</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.month}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, month: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Date</label>
                <Input
                  type="date"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">PCV No.</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.pcvNo}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, pcvNo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Supplier</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.supplier}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, supplier: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Account</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.account}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, account: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Document</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.document}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, document: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">TIN</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.tin}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, tin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <Input
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.address}
                  onChange={(e) => setTransactionForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Gross Amount</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={transactionForm.grossAmount}
                  onChange={(e) => handleGrossAmountChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Net of VAT</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
                  value={transactionForm.netOfVat}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Input VAT</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
                  value={transactionForm.inputVat}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">1%</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
                  value={transactionForm.onePercent}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">2%</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
                  value={transactionForm.twoPercent}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Net Amount</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-gray-50"
                  value={transactionForm.netAmount}
                  readOnly
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsTransactionModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTransactionSubmit} className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function includesAny(obj: any, query: string): boolean {
  return Object.values(obj).some((value) => value.toString().toLowerCase().includes(query.toLowerCase()))
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

function formatCurrency(value: number | undefined | null): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "₱0.00"
  }
  return value.toLocaleString("en-US", { style: "currency", currency: "PHP" })
}

// Export default component for backward compatibility
export default PettyCashFundTable
