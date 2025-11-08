"use client"

import { useEffect, useMemo, useState } from "react"
import { uid, parseNumber, sumBy, includesAny, formatCurrency } from "./utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Save, Undo2, Search, Trash2 } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"

type SalesCollectionRow = {
  id: string
  clientName: string
  tin: string
  invoiceDate: string
  invoiceNumber: string
  invoiceAmount: number
  // computed
  netSales: number
  outputVat: number
  total: number
  creditableTax: number
  amountCollected: number
  orNo: string
  paidDate: string
}

const STORAGE_KEY = "acc_sales_collection_v1"

const MOCK_ROWS: SalesCollectionRow[] = [
  {
    id: uid("sc"),
    clientName: "Acme Foods Inc.",
    tin: "123-456-789-000",
    invoiceDate: "2024-12-13",
    invoiceNumber: "SI-2412001",
    invoiceAmount: 112000,
    netSales: 100000,
    outputVat: 12000,
    total: 112000,
    creditableTax: 2000,
    amountCollected: 110000,
    orNo: "OR-5001",
    paidDate: "2024-12-14",
  },
  {
    id: uid("sc"),
    clientName: "ByteTech Corp.",
    tin: "987-654-321-000",
    invoiceDate: "2024-12-13",
    invoiceNumber: "SI-2412002",
    invoiceAmount: 56000,
    netSales: 50000,
    outputVat: 6000,
    total: 56000,
    creditableTax: 1000,
    amountCollected: 55000,
    orNo: "OR-5002",
    paidDate: "2024-12-15",
  },
]

function recompute(row: SalesCollectionRow): SalesCollectionRow {
  const invoice = parseNumber(row.invoiceAmount)
  const netSales = invoice / 1.12
  const outputVat = netSales * 0.12
  const total = netSales + outputVat // equals invoice
  const creditableTax = netSales * 0.02
  const amountCollected = invoice - creditableTax
  return { ...row, netSales, outputVat, total, creditableTax, amountCollected }
}

export function SalesAndCollectionTable() {
  const { toast } = useToast()
  const [rows, setRows] = useState<SalesCollectionRow[]>([])
  const [query, setQuery] = useState("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SalesCollectionRow[]
        setRows(parsed.map(recompute))
      } catch {
        setRows(MOCK_ROWS.map(recompute))
      }
    } else {
      setRows(MOCK_ROWS.map(recompute))
    }
  }, [])

  const filtered = useMemo(() => rows.filter((r) => includesAny(r, query)), [rows, query])

  const totals = useMemo(() => {
    const base = filtered.length ? filtered : rows
    return {
      invoiceAmount: sumBy(base, (r) => r.invoiceAmount),
      netSales: sumBy(base, (r) => r.netSales),
      outputVat: sumBy(base, (r) => r.outputVat),
      total: sumBy(base, (r) => r.total),
      creditableTax: sumBy(base, (r) => r.creditableTax),
      amountCollected: sumBy(base, (r) => r.amountCollected),
    }
  }, [filtered, rows])

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
    setDirty(false)
    toast({ title: "Saved", description: "Sales & Collection saved to your browser." })
  }

  function resetToMock() {
    setRows(MOCK_ROWS.map(recompute))
    setDirty(true)
  }

  function addRow() {
    const newRow = recompute({
      id: uid("sc"),
      clientName: "",
      tin: "",
      invoiceDate: "",
      invoiceNumber: "",
      invoiceAmount: 0,
      netSales: 0,
      outputVat: 0,
      total: 0,
      creditableTax: 0,
      amountCollected: 0,
      orNo: "",
      paidDate: "",
    })
    setRows((r) => [newRow, ...r])
    setDirty(true)
  }

  function updateRow(id: string, patch: Partial<SalesCollectionRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        // Invoice Amount drives all formulas.
        return recompute(next)
      })
    )
    setDirty(true)
  }

  function deleteRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setDirty(true)
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle>Sales and Collection</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button onClick={addRow} className="bg-[#16a34a] hover:bg-[#15803d] text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Row
            </Button>
            <Button variant="outline" onClick={save} disabled={!dirty}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={resetToMock}>
              <Undo2 className="mr-2 h-4 w-4" /> Load Mock Data
            </Button>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search any field..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client’s Name</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Invoice No.</TableHead>
                <TableHead className="text-right">Invoice Amount</TableHead>
                <TableHead className="text-right">Net Sales</TableHead>
                <TableHead className="text-right">Output VAT</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Creditable Tax</TableHead>
                <TableHead className="text-right">Amount Collected</TableHead>
                <TableHead>OR No.</TableHead>
                <TableHead>Paid/Deposit Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[14rem]">
                    <Input
                      value={row.clientName}
                      onChange={(e) => updateRow(row.id, { clientName: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="min-w-[14rem]">
                    <Input value={row.tin} onChange={(e) => updateRow(row.id, { tin: e.target.value })} />
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    <Input
                      value={row.invoiceDate}
                      onChange={(e) => updateRow(row.id, { invoiceDate: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    <Input
                      value={row.invoiceNumber}
                      onChange={(e) => updateRow(row.id, { invoiceNumber: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-right min-w-[10rem]">
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="text-right"
                      value={row.invoiceAmount}
                      onChange={(e) => updateRow(row.id, { invoiceAmount: parseNumber(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.netSales)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.outputVat)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.total)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.creditableTax)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(row.amountCollected)}</TableCell>
                  <TableCell className="min-w-[10rem]">
                    <Input value={row.orNo} onChange={(e) => updateRow(row.id, { orNo: e.target.value })} />
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    <Input value={row.paidDate} onChange={(e) => updateRow(row.id, { paidDate: e.target.value })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteRow(row.id)} aria-label="Delete row">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground">
                    No rows. Try clearing the search or add a new row.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={4} className="font-medium">
                  Totals
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totals.invoiceAmount)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totals.netSales)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totals.outputVat)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totals.total)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totals.creditableTax)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(totals.amountCollected)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
