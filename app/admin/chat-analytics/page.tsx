"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Users, TrendingUp, Star, Download } from "lucide-react"

interface ConversationStats {
  totalConversations: number
  totalMessages: number
  activeUsers: number
  averageRating: number
}

interface Analytics {
  id: string
  date: string
  totalConversations: number
  totalMessages: number
  averageMessagesPerConversation: number
  averageResponseTime: number
  topPages: Array<{ page: string; count: number }>
  topQuestions: Array<{ question: string; count: number }>
  userSatisfactionRating: number
  errorRate: number
}

export default function ChatAnalyticsPage() {
  const [stats, setStats] = useState<ConversationStats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    fetchStats()
    fetchAnalytics()
  }, [dateRange])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/chat/analytics?type=stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/chat/analytics?startDate=${dateRange.start}&endDate=${dateRange.end}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportData = () => {
    const csvContent = [
      ["Date", "Conversations", "Messages", "Avg Response Time", "User Rating"],
      ...analytics.map((a) => [
        a.date,
        a.totalConversations,
        a.totalMessages,
        a.averageResponseTime,
        a.userSatisfactionRating,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-analytics-${dateRange.start}-${dateRange.end}.csv`
    a.click()
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chat Analytics</h1>
          <p className="text-muted-foreground">Monitor AI Assistant performance and user interactions</p>
        </div>
        <Button onClick={exportData} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversations.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}/5</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <Button onClick={fetchAnalytics} className="mt-6">
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Tabs */}
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Analytics</TabsTrigger>
          <TabsTrigger value="pages">Popular Pages</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Conversation Data</CardTitle>
              <CardDescription>Conversation and message trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading analytics...</div>
              ) : (
                <div className="space-y-4">
                  {analytics.map((day) => (
                    <div key={day.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{day.date}</div>
                        <div className="text-sm text-muted-foreground">
                          {day.totalConversations} conversations, {day.totalMessages} messages
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">Avg: {day.averageMessagesPerConversation.toFixed(1)} msg/conv</Badge>
                        <Badge variant="outline">{day.averageResponseTime}ms response</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Popular Pages</CardTitle>
              <CardDescription>Pages where users most frequently use the AI Assistant</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.length > 0 && analytics[0]?.topPages ? (
                <div className="space-y-2">
                  {Array.isArray(analytics[0].topPages)
                    ? // Handle array format
                      analytics[0].topPages.map((page, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span>{page.page}</span>
                          <Badge>{page.count} interactions</Badge>
                        </div>
                      ))
                    : // Handle object format from Firestore
                      Object.entries(analytics[0].topPages).map(([page, count], index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span>{page}</span>
                          <Badge>{count as number} interactions</Badge>
                        </div>
                      ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No page data available for the selected date range
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Response times and user satisfaction</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.map((day) => (
                  <div key={day.id} className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">Date</div>
                      <div className="font-medium">{day.date}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Response Time</div>
                      <div className="font-medium">{day.averageResponseTime}ms</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">User Rating</div>
                      <div className="font-medium">{day.userSatisfactionRating}/5</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
