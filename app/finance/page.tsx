"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Receipt, PieChart, BarChart3, FileText, Calendar, AlertCircle } from 'lucide-react'
import { RouteProtection } from "@/components/route-protection"

export default function FinancePage() {
  return (
    <RouteProtection requiredRoles="finance">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Finance Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Button>
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱2,450,000</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12.5% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱485,000</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-orange-600 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                23 pending invoices
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱1,250,000</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 flex items-center">
                <TrendingDown className="h-3 w-3 mr-1" />
                +3.2% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱1,200,000</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                +8.1% from last month
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Transactions */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest financial activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  id: "INV-001",
                  client: "Summit Media",
                  amount: "₱125,000",
                  type: "Invoice",
                  status: "Paid",
                  date: "2024-01-15"
                },
                {
                  id: "EXP-002",
                  client: "Equipment Maintenance",
                  amount: "₱45,000",
                  type: "Expense",
                  status: "Processed",
                  date: "2024-01-14"
                },
                {
                  id: "INV-003",
                  client: "GTS Holdings",
                  amount: "₱89,500",
                  type: "Invoice",
                  status: "Pending",
                  date: "2024-01-13"
                },
                {
                  id: "PAY-004",
                  client: "Supplier Payment",
                  amount: "₱67,200",
                  type: "Payment",
                  status: "Completed",
                  date: "2024-01-12"
                }
              ].map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      transaction.type === 'Invoice' ? 'bg-green-100 text-green-600' :
                      transaction.type === 'Expense' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {transaction.type === 'Invoice' ? <Receipt className="h-4 w-4" /> :
                       transaction.type === 'Expense' ? <CreditCard className="h-4 w-4" /> :
                       <DollarSign className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.client}</p>
                      <p className="text-sm text-muted-foreground">{transaction.id} • {transaction.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{transaction.amount}</p>
                    <Badge variant={
                      transaction.status === 'Paid' || transaction.status === 'Completed' ? 'default' :
                      transaction.status === 'Pending' ? 'secondary' : 'outline'
                    }>
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common financial tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Receipt className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <CreditCard className="mr-2 h-4 w-4" />
              Record Expense
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <DollarSign className="mr-2 h-4 w-4" />
              Process Payment
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Reports
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Budget Planning
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Tax Documents
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
            <CardDescription>Monthly comparison for the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mr-2" />
              Chart visualization would go here
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
            <CardDescription>Incoming and outgoing cash flow trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mr-2" />
              Cash flow chart would go here
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </RouteProtection>
  )
}
