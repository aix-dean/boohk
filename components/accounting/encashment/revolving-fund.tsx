"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Save, Trash2, Settings } from "lucide-react"
import { encashmentService } from "@/lib/encashment-service"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, includesAny, parseNumber, sumBy, uid } from "../utils"

type RevolvingSettings = {
  companyName: string
  revolvingFundName: string
  revolvingFundReplenishment: string
  cutOffPeriod: string
  revolvingFundAmount: number
}

type RevolvingRow = {
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
  // computed
  netOfVat: number
  inputVat: number
  onePercent: number
  twoPercent: number
  netAmount: number
  type: string
  deleted: boolean
}

const STORAGE_KEY = "acc_encash_rvf_rows_v1"
const STORAGE_KEY_SETTINGS = "acc_encash_rvf_settings_v1"

function compute(row: RevolvingRow): RevolvingRow {
  const gross = parseNumber(row.grossAmount)
  const netOfVat = gross / 1.12
  const inputVat = gross - netOfVat
  const onePercent = netOfVat * 0.01
  const twoPercent = netOfVat * 0.02
  const netAmount = gross - onePercent - twoPercent
  return { ...row, netOfVat, inputVat, onePercent, twoPercent, netAmount }
}

export function RevolvingFundTable() {
  const { toast } = useToast()
  const [rows, setRows] = useState<RevolvingRow[]>([])
  const [settings, setSettings] = useState<RevolvingSettings>({
    companyName: "",
    revolvingFundName: "",
    revolvingFundReplenishment: "",
    cutOffPeriod: "",
    revolvingFundAmount: 0,
  })
  const [query, setQuery] = useState("")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    category: "",
    month: "",
    date: "",
    pettyCashVoucherNo: "",
    supplierName: "",
    description: "",
    accountTitle: "",
    documentTypeNo: "",
    tinNo: "",
    companyAddress: "",
    grossAmount: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Load settings
      const savedSettings = await encashmentService.getSettings("REVOLVING_FUND")
      if (savedSettings) {
        setSettings(savedSettings as RevolvingSettings)
      }

      // Load transactions filtered by type and not deleted
      const transactions = await encashmentService.getTransactions("REVOLVING_FUND")
      if (transactions && transactions.length > 0) {
        setRows(transactions.map(compute))
      } else {
        // Fallback to localStorage for migration
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved) as RevolvingRow[]
            setRows(parsed.map((row) => compute({ ...row, type: "REVOLVING_FUND", deleted: false })))
          }
        } catch {
          // No action needed if localStorage fails
        }
      }
    } catch (error) {
      console.error("Error loading revolving fund data:", error)
      toast({
        title: "Error",
        description: "Failed to load revolving fund data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => rows.filter((r) => includesAny(r, query)), [rows, query])

  const totals = useMemo(() => {
    const base = filtered.length ? filtered : rows
    const gross = sumBy(base, (r) => r.grossAmount)
    const netOfVat = sumBy(base, (r) => r.netOfVat)
    const inputVat = sumBy(base, (r) => r.inputVat)
    const oneP = sumBy(base, (r) => r.onePercent)
    const twoP = sumBy(base, (r) => r.twoPercent)
    const netAmount = sumBy(base, (r) => r.netAmount)
    const balanceForDeposit = settings.revolvingFundAmount - netAmount
    const totalRevolvingFund = netAmount
    const rvfAmountBalance = settings.revolvingFundAmount - totalRevolvingFund
    return {
      gross,
      netOfVat,
      inputVat,
      oneP,
      twoP,
      netAmount,
      balanceForDeposit,
      totalRevolvingFund,
      rvfAmountBalance,
    }
  }, [filtered, rows, settings.revolvingFundAmount])

  function openTransactionModal() {
    setNewTransaction({
      category: "",
      month: "",
      date: "",
      pettyCashVoucherNo: "",
      supplierName: "",
      description: "",
      accountTitle: "",
      documentTypeNo: "",
      tinNo: "",
      companyAddress: "",
      grossAmount: 0,
    })
    setShowTransactionModal(true)
  }

  async function saveTransaction() {
    try {
      const transaction = compute({
        id: uid("rvf"),
        ...newTransaction,
        type: "REVOLVING_FUND",
        deleted: false,
      })

      await encashmentService.createTransaction(transaction)
      setRows((r) => [transaction, ...r])
      setShowTransactionModal(false)

      toast({
        title: "Success",
        description: "Transaction added successfully",
      })
    } catch (error) {
      console.error("Error saving transaction:", error)
      toast({
        title: "Error",
        description: "Failed to save transaction",
        variant: "destructive",
      })
    }
  }

  function updateRow(id: string, patch: Partial<RevolvingRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        return compute({ ...r, ...patch })
      }),
    )
    setDirty(true)
  }

  async function deleteRow(id: string) {
    try {
      await encashmentService.softDeleteTransaction(id)
      // Remove from local state after successful soft delete
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

  async function saveAll() {
    try {
      // Save settings
      await encashmentService.createSettings({ ...settings, type: "REVOLVING_FUND" })

      // Save transactions
      for (const row of rows) {
        await encashmentService.createTransaction({
          ...row,
          type: "REVOLVING_FUND",
          deleted: false,
        })
      }

      setDirty(false)
      toast({
        title: "Success",
        description: "Revolving Fund data saved successfully",
      })
    } catch (error) {
      console.error("Error saving revolving fund data:", error)
      toast({
        title: "Error",
        description: "Failed to save revolving fund data",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading revolving fund data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Fund Configuration Section */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Revolving Fund</h3>
            <p className="text-sm text-gray-600">Manage revolving fund settings and transactions</p>
          </div>
          <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Settings className="mr-2 h-4 w-4" />
                Configure Fund
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configure Revolving Fund</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fundAmount">Fund Amount</Label>
                  <Input
                    id="fundAmount"
                    type="number"
                    value={settings.revolvingFundAmount}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, revolvingFundAmount: parseNumber(e.target.value) }))
                    }
                    placeholder="Enter fund amount"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      saveAll()
                      setIsConfigModalOpen(false)
                    }}
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <div className="p-4">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Fund Amount</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(settings.revolvingFundAmount)}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <div className="p-4">
              <div className="text-sm font-medium text-green-700 dark:text-green-300">Total Fund Usage</div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {formatCurrency(totals.netAmount)}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
            <div className="p-4">
              <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Remaining Balance</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {formatCurrency(settings.revolvingFundAmount - totals.netAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
            <p className="text-sm text-gray-600">Manage revolving fund transactions</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Transaction</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={newTransaction.category}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, category: e.target.value }))}
                      placeholder="Enter category"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="month">Month</Label>
                    <Input
                      id="month"
                      value={newTransaction.month}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, month: e.target.value }))}
                      placeholder="Enter month"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pettyCashVoucherNo">PCV No.</Label>
                    <Input
                      id="pettyCashVoucherNo"
                      value={newTransaction.pettyCashVoucherNo}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, pettyCashVoucherNo: e.target.value }))}
                      placeholder="Enter PCV number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierName">Supplier</Label>
                    <Input
                      id="supplierName"
                      value={newTransaction.supplierName}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, supplierName: e.target.value }))}
                      placeholder="Enter supplier name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newTransaction.description}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountTitle">Account</Label>
                    <Input
                      id="accountTitle"
                      value={newTransaction.accountTitle}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, accountTitle: e.target.value }))}
                      placeholder="Enter account title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="documentTypeNo">Document</Label>
                    <Input
                      id="documentTypeNo"
                      value={newTransaction.documentTypeNo}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, documentTypeNo: e.target.value }))}
                      placeholder="Enter document number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tinNo">TIN</Label>
                    <Input
                      id="tinNo"
                      value={newTransaction.tinNo}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, tinNo: e.target.value }))}
                      placeholder="Enter TIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Address</Label>
                    <Input
                      id="companyAddress"
                      value={newTransaction.companyAddress}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, companyAddress: e.target.value }))}
                      placeholder="Enter company address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grossAmount">Gross Amount</Label>
                    <Input
                      id="grossAmount"
                      type="number"
                      value={newTransaction.grossAmount}
                      onChange={(e) =>
                        setNewTransaction((prev) => ({ ...prev, grossAmount: parseNumber(e.target.value) }))
                      }
                      placeholder="Enter gross amount"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowTransactionModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveTransaction}>Add Transaction</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={saveAll}
              disabled={!dirty}
              className="border-gray-300 hover:bg-gray-50 bg-transparent"
            >
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </div>
          <div className="relative w-full sm:w-80">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
              {filtered.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                >
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
                      onChange={(e) => updateRow(row.id, { grossAmount: parseNumber(e.target.value) })}
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
                  <TableCell colSpan={17} className="text-center text-gray-500 py-8">
                    No transactions found. Try adjusting your search or add a new transaction.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-blue-50 border-t-2 border-blue-200">
                <TableCell colSpan={10} className="font-bold text-gray-900 py-4 px-4">
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
