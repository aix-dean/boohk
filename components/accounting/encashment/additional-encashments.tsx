"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Search, Trash2, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, includesAny, parseNumber as parseNumberUtil, sumBy as sumByUtil, uid } from "../utils"
import { encashmentService } from "@/lib/encashment-service"

type AdditionalSettings = {
  id?: string
  type: string
  fundLabel: string
  fundAmount: number
  deleted: boolean
  createdAt: Date
  updatedAt: Date
}

type AdditionalRow = {
  id: string
  type: string
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
  createdAt: Date
  updatedAt: Date
}

const STORAGE_KEY = "acc_encash_add_rows_v1"
const STORAGE_KEY_SETTINGS = "acc_encash_add_settings_v1"

export function AdditionalEncashmentsTable() {
  const { toast } = useToast()
  const [rows, setRows] = useState<AdditionalRow[]>([])
  const [settings, setSettings] = useState<AdditionalSettings>({
    type: "ADDITIONAL_ENCASHMENT",
    fundLabel: "",
    fundAmount: 0,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [newTransaction, setNewTransaction] = useState<Partial<AdditionalRow>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const settingsData = await encashmentService.getSettings("ADDITIONAL_ENCASHMENT")
      if (settingsData.length > 0) {
        setSettings(settingsData[0] as AdditionalSettings)
      } else {
        try {
          const s = localStorage.getItem(STORAGE_KEY_SETTINGS)
          if (s) setSettings(JSON.parse(s) as AdditionalSettings)
        } catch {}
      }

      const transactionsData = await encashmentService.getTransactions("ADDITIONAL_ENCASHMENT")
      if (transactionsData.length > 0) {
        setRows(transactionsData.map(compute) as AdditionalRow[])
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved) as AdditionalRow[]
            setRows(parsed.map(compute))
          }
        } catch {}
      }
    } catch (error) {
      console.error("Error loading additional encashments data:", error)
      toast({
        title: "Error",
        description: "Failed to load additional encashments data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => rows.filter((r) => includesAny(r, query)), [rows, query])

  const totals = useMemo(() => {
    const base = filtered.length ? filtered : rows
    const gross = sumByUtil(base, (r) => r.grossAmount)
    const netOfVat = sumByUtil(base, (r) => r.netOfVat)
    const inputVat = sumByUtil(base, (r) => r.inputVat)
    const oneP = sumByUtil(base, (r) => r.onePercent)
    const twoP = sumByUtil(base, (r) => r.twoPercent)
    const netAmount = sumByUtil(base, (r) => r.netAmount)
    const balanceForDeposit = parseNumberUtil(settings.fundAmount) - netAmount
    const totalAdditionalEncashments = netAmount
    const additionalEncashmentsBalance = parseNumberUtil(settings.fundAmount) - totalAdditionalEncashments
    return {
      gross,
      netOfVat,
      inputVat,
      oneP,
      twoP,
      netAmount,
      balanceForDeposit,
      totalAdditionalEncashments,
      additionalEncashmentsBalance,
    }
  }, [filtered, rows, settings.fundAmount])

  const handleAddTransaction = async () => {
    try {
      const transaction: AdditionalRow = {
        id: uid("add"),
        type: "ADDITIONAL_ENCASHMENT",
        category: newTransaction.category || "",
        month: newTransaction.month || "",
        date: newTransaction.date || "",
        pettyCashVoucherNo: newTransaction.pettyCashVoucherNo || "",
        supplierName: newTransaction.supplierName || "",
        description: newTransaction.description || "",
        accountTitle: newTransaction.accountTitle || "",
        documentTypeNo: newTransaction.documentTypeNo || "",
        tinNo: newTransaction.tinNo || "",
        companyAddress: newTransaction.companyAddress || "",
        grossAmount: parseNumberUtil(newTransaction.grossAmount),
        netOfVat: 0,
        inputVat: 0,
        onePercent: 0,
        twoPercent: 0,
        netAmount: 0,
        deleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const computedTransaction = compute(transaction)
      await encashmentService.createTransaction(computedTransaction)
      setRows((r) => [computedTransaction, ...r])
      setNewTransaction({})
      setIsTransactionModalOpen(false)

      toast({
        title: "Success",
        description: "Transaction added successfully",
      })
    } catch (error) {
      console.error("Error adding transaction:", error)
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      })
    }
  }

  const updateRow = async (id: string, patch: Partial<AdditionalRow>) => {
    try {
      const updatedRow = rows.find((r) => r.id === id)
      if (!updatedRow) return

      const newRow = compute({ ...updatedRow, ...patch, updatedAt: new Date() })
      await encashmentService.updateTransaction(id, newRow)

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          return newRow
        }),
      )
    } catch (error) {
      console.error("Error updating transaction:", error)
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      })
    }
  }

  const deleteRow = async (id: string) => {
    try {
      await encashmentService.deleteTransaction(id)
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting transaction:", error)
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return

    try {
      const deletePromises = Array.from(selectedRows).map((id) => encashmentService.deleteTransaction(id))
      await Promise.all(deletePromises)

      setRows((prev) => prev.filter((row) => !selectedRows.has(row.id)))
      setSelectedRows(new Set())

      toast({
        title: "Success",
        description: `${selectedRows.size} transactions deleted successfully`,
      })
    } catch (error) {
      console.error("Error deleting transactions:", error)
      toast({
        title: "Error",
        description: "Failed to delete transactions",
        variant: "destructive",
      })
    }
  }

  const handleSaveSettings = async () => {
    try {
      const settingsToSave = {
        ...settings,
        updatedAt: new Date(),
      }

      if (settings.id) {
        await encashmentService.updateSettings(settings.id, settingsToSave)
      } else {
        const newSettings = {
          ...settingsToSave,
          id: uid("settings"),
          createdAt: new Date(),
        }
        await encashmentService.createSettings(newSettings)
        setSettings(newSettings)
      }

      setIsConfigModalOpen(false)
      toast({
        title: "Success",
        description: "Settings saved successfully",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Fund Amount</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(settings.fundAmount)}</p>
            </div>
            <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
              <div className="h-6 w-6 bg-blue-600 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Total Fund Usage</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {formatCurrency(totals.totalAdditionalEncashments)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-200 rounded-full flex items-center justify-center">
              <div className="h-6 w-6 bg-green-600 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Remaining Balance</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {formatCurrency(totals.additionalEncashmentsBalance)}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center">
              <div className="h-6 w-6 bg-purple-600 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Additional Encashments</h2>
              <p className="text-sm text-gray-600 mt-1">Manage additional encashment transactions and balances</p>
            </div>
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Settings className="mr-2 h-4 w-4" /> Configure Fund
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Configure Additional Encashments Fund</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Fund Label</label>
                    <Input
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.fundLabel}
                      onChange={(e) => setSettings((s) => ({ ...s, fundLabel: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Fund Amount</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      value={settings.fundAmount}
                      onChange={(e) => setSettings((s) => ({ ...s, fundAmount: parseNumberUtil(e.target.value) }))}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSaveSettings} className="flex-1">
                      Save Settings
                    </Button>
                    <Button variant="outline" onClick={() => setIsConfigModalOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                  <Plus className="mr-2 h-4 w-4" /> Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Transaction</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Input
                      value={newTransaction.category || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Month</label>
                    <Input
                      value={newTransaction.month || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, month: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date</label>
                    <Input
                      value={newTransaction.date || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">PCV No.</label>
                    <Input
                      value={newTransaction.pettyCashVoucherNo || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, pettyCashVoucherNo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Supplier</label>
                    <Input
                      value={newTransaction.supplierName || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, supplierName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      value={newTransaction.description || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account Title</label>
                    <Input
                      value={newTransaction.accountTitle || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, accountTitle: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Document Type/No.</label>
                    <Input
                      value={newTransaction.documentTypeNo || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, documentTypeNo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">TIN No.</label>
                    <Input
                      value={newTransaction.tinNo || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, tinNo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company Address</label>
                    <Input
                      value={newTransaction.companyAddress || ""}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, companyAddress: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium">Gross Amount</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={newTransaction.grossAmount || ""}
                      onChange={(e) =>
                        setNewTransaction((prev) => ({ ...prev, grossAmount: parseNumberUtil(e.target.value) }))
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button onClick={handleAddTransaction} className="flex-1">
                    Add Transaction
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNewTransaction({})
                      setIsTransactionModalOpen(false)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {selectedRows.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete} className="shadow-sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedRows.size})
              </Button>
            )}
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search transactions..."
              className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
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
                    checked={selectedRows.size === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(filtered.map((row) => row.id)))
                      } else {
                        setSelectedRows(new Set())
                      }
                    }}
                    className="rounded border-gray-300"
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
                <TableHead className="font-semibold text-gray-900 py-3 px-4 w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                >
                  <TableCell className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedRows)
                        if (e.target.checked) {
                          newSelected.add(row.id)
                        } else {
                          newSelected.delete(row.id)
                        }
                        setSelectedRows(newSelected)
                      }}
                      className="rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.category}
                      onChange={(e) => updateRow(row.id, { category: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.month}
                      onChange={(e) => updateRow(row.id, { month: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.date}
                      onChange={(e) => updateRow(row.id, { date: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.pettyCashVoucherNo}
                      onChange={(e) => updateRow(row.id, { pettyCashVoucherNo: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.supplierName}
                      onChange={(e) => updateRow(row.id, { supplierName: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.accountTitle}
                      onChange={(e) => updateRow(row.id, { accountTitle: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.documentTypeNo}
                      onChange={(e) => updateRow(row.id, { documentTypeNo: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.tinNo}
                      onChange={(e) => updateRow(row.id, { tinNo: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <Input
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                      value={row.companyAddress}
                      onChange={(e) => updateRow(row.id, { companyAddress: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right">
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="border-0 bg-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-right"
                      value={row.grossAmount}
                      onChange={(e) => updateRow(row.id, { grossAmount: parseNumberUtil(e.target.value) })}
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
                      onClick={() => deleteRow(row.id)}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={18} className="text-center text-gray-500 py-8">
                    No transactions found. Try adjusting your search or add a new transaction.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                <TableCell colSpan={11} className="font-bold text-gray-900 py-4 px-4">
                  TOTALS
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                  {formatCurrency(totals.gross)}
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                  {formatCurrency(totals.netOfVat)}
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                  {formatCurrency(totals.inputVat)}
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                  {formatCurrency(totals.oneP)}
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 py-4 px-4">
                  {formatCurrency(totals.twoP)}
                </TableCell>
                <TableCell className="text-right font-bold text-blue-600 py-4 px-4 text-lg">
                  {formatCurrency(totals.netAmount)}
                </TableCell>
                <TableCell className="py-4 px-4" />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function compute(row: AdditionalRow): AdditionalRow {
  const gross = parseNumberUtil(row.grossAmount)
  const netOfVat = gross / 1.12
  const inputVat = gross - netOfVat
  const onePercent = netOfVat * 0.01
  const twoPercent = netOfVat * 0.02
  const netAmount = gross - onePercent - twoPercent
  return { ...row, netOfVat, inputVat, onePercent, twoPercent, netAmount }
}
