"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FileSpreadsheet, Wallet, HandCoins } from 'lucide-react'
import { RouteProtection } from "@/components/route-protection"

export default function AccountingDashboardPage() {
  return (
    <RouteProtection requiredRoles="accounting">
      <div className="flex-1 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounting Dashboard</h1>
            <p className="text-sm text-muted-foreground">Mock data with live formulas and local saves.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild className="bg-[#16a34a] hover:bg-[#15803d] text-white">
              <Link href="/accounting/sales-record">Sales Record</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/accounting/sales-and-collection">Sales and Collection</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/accounting/encashment">Encashment</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales Record</CardTitle>
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Add, edit, search. Formulas from Net Sales.</p>
              <Button asChild size="sm">
                <Link href="/accounting/sales-record">Open</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales & Collection</CardTitle>
              <Wallet className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Invoice Amount drives all the formulas.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/accounting/sales-and-collection">Open</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Encashment</CardTitle>
              <HandCoins className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Petty Cash, Revolving Fund, Additional.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/accounting/encashment">Open</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground">
          Note: 1% and 2% are assumed as 0.01 and 0.02 of Net of VAT. If your policy differs, we can adjust.
        </p>
      </div>
    </div>
    </RouteProtection>
  )
}
