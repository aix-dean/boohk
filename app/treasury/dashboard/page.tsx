"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, PieChart, Pie, Cell } from "recharts"
import { RouteProtection } from "@/components/route-protection"

const events = [
  {
    date: "12, Sep",
    items: [
      { id: "RR0932", label: "Start Date", color: "bg-green-500" },
      { id: "SA00512", label: "Deadline", color: "bg-blue-500" },
      { id: "NAN305", label: "Yearly Maintenan.", color: "bg-red-500" },
      { text: "Attend Supplier's Expo @ ....", color: "bg-yellow-500" },
    ],
  },
  {
    date: "13, Sep",
    items: [],
  },
  {
    date: "14, Sep",
    items: [{ id: "NAN305", label: "Yearly Maintenan.", color: "bg-red-500" }],
  },
]

const monthlyData = [
  { month: "Jan", amount: 3500000 },
  { month: "Feb", amount: 4200000 },
  { month: "Mar", amount: 5000000 },
  { month: "Apr", amount: 3800000 },
  { month: "May", amount: 4500000 },
  { month: "Jun", amount: 3200000 },
  { month: "Jul", amount: 5200000 },
  { month: "Aug", amount: 4800000 },
  { month: "Sep", amount: 1500000 },
  { month: "Oct", amount: 3900000 },
  { month: "Nov", amount: 4100000 },
  { month: "Dec", amount: 3700000 },
]

const collectionData = [
  { name: "Collected", value: 800000, color: "hsl(var(--success))" },
  { name: "Outstanding", value: 200000, color: "hsl(var(--muted))" },
]

const inData = [{ item: "Collectibles", amount: "Php 1,000,000.00" }]

const outData = [
  { item: "Petty Cash", amount: "Php 18,000.00" },
  { item: "Service Expense", amount: "Php 9,000.00" },
]

export default function TreasuryDashboardPage() {
  const total = collectionData.reduce((sum, item) => sum + item.value, 0)
  const collectedPercentage = Math.round((collectionData[0].value / total) * 100)

  return (
    <RouteProtection requiredRoles="treasury">
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Treasury Dashboard</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Today Events */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {events.map((event, index) => (
                  <div key={index}>
                    <h3 className="font-medium text-base mb-3">{event.date}</h3>
                    {event.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No events for this day.</p>
                    ) : (
                      <div className="space-y-2">
                        {event.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                            <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                            <div className="flex-1">
                              {item.id && <span className="font-medium text-sm">{item.id}- </span>}
                              <span className="text-sm">{item.label || item.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Charts */}
          <div className="lg:col-span-1 space-y-6">
            {/* Monthly Collections */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Monthly collections</CardTitle>
                <Select defaultValue="2025">
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="h-48 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value / 1000000}M`}
                      />
                      <Bar dataKey="amount" fill="#22d3ee" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">Best month:</span>
                    <br />
                    <span className="font-semibold">Mar- 5,000,000</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Worst month:</span>
                    <br />
                    <span className="font-semibold">Sep- 1,500,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Collected vs Outstanding */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Collected vs Outstanding</CardTitle>
                <Select defaultValue="last-30-days">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last-30-days">last 30 days</SelectItem>
                    <SelectItem value="last-60-days">last 60 days</SelectItem>
                    <SelectItem value="last-90-days">last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Item</span>
                      <span className="text-sm font-medium">Amount</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Collected</span>
                      <span className="text-sm font-semibold">Php 800,000.00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Outstanding</span>
                      <span className="text-sm font-semibold">Php 200,000.00</span>
                    </div>
                  </div>

                  <div className="relative w-24 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={collectionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={40}
                          startAngle={90}
                          endAngle={450}
                          dataKey="value"
                        >
                          {collectionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-success">{collectedPercentage}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span>Collected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    <span>Outstanding</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Financial Summary */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* IN Section */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-success" />
                    <CardTitle className="text-lg font-semibold">IN</CardTitle>
                  </div>
                  <Select defaultValue="last-30-days">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last-30-days">last 30 days</SelectItem>
                      <SelectItem value="last-60-days">last 60 days</SelectItem>
                      <SelectItem value="last-90-days">last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Item</span>
                      <span className="text-sm font-medium">Amount</span>
                    </div>
                    {inData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{item.item}</span>
                        <span className="text-sm font-semibold">{item.amount}</span>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">TOTAL:</span>
                        <span className="font-bold text-lg">Php 1,000,000.00</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* OUT Section */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-destructive" />
                    <CardTitle className="text-lg font-semibold">OUT</CardTitle>
                  </div>
                  <Select defaultValue="last-30-days">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last-30-days">last 30 days</SelectItem>
                      <SelectItem value="last-60-days">last 60 days</SelectItem>
                      <SelectItem value="last-90-days">last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Item</span>
                      <span className="text-sm font-medium">Amount</span>
                    </div>
                    {outData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{item.item}</span>
                        <span className="text-sm font-semibold">{item.amount}</span>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">TOTAL:</span>
                        <span className="font-bold text-lg">Php 27,000.00</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </RouteProtection>
  )
}