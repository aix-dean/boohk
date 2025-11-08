"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, Globe, Users, Activity, MapPin, Clock, Monitor } from "lucide-react"

interface AnalyticsDocument {
  id: string
  action: string
  created: any
  geopoint: [number, number]
  ip_address: string
  isGuest: boolean
  page: string
  platform: string
  tags: Array<{
    action: string
    isGuest: boolean
    page: string
    platform: string
    section: string
    uid: string
  }>
  uid: string
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "analytics_ohplus"), orderBy("created", "desc"), limit(50))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AnalyticsDocument[]

        setAnalytics(docs)
        setLoading(false)
        setIsLive(true)
      },
      (error) => {
        console.error("Error fetching analytics:", error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "N/A"
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  const formatGeopoint = (geopoint: [number, number]) => {
    if (!geopoint || !Array.isArray(geopoint)) return "N/A"
    return `${geopoint[0]?.toFixed(6)}, ${geopoint[1]?.toFixed(6)}`
  }

  const totalViews = analytics.length
  const guestViews = analytics.filter((doc) => doc.isGuest).length
  const webPlatform = analytics.filter((doc) => doc.platform === "WEB").length
  const uniquePages = new Set(analytics.map((doc) => doc.page)).size

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">Real-time monitoring of analytics_ohplus collection</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500" : "bg-gray-400"}`} />
            <span className="text-sm text-gray-600">{isLive ? "Live" : "Offline"}</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalViews}</div>
              <p className="text-xs text-muted-foreground">All page views tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guest Views</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guestViews}</div>
              <p className="text-xs text-muted-foreground">Views from guest users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Web Platform</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{webPlatform}</div>
              <p className="text-xs text-muted-foreground">Views from web platform</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Pages</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniquePages}</div>
              <p className="text-xs text-muted-foreground">Different pages visited</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Recent Analytics Events</span>
            </CardTitle>
            <CardDescription>Latest {analytics.length} analytics events from the collection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>UID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{formatTimestamp(doc.created)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {doc.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{doc.page}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Monitor className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs">{doc.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.isGuest ? "destructive" : "default"}>
                          {doc.isGuest ? "Guest" : "User"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs">{formatGeopoint(doc.geopoint)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{doc.ip_address}</TableCell>
                      <TableCell className="font-mono text-xs">{doc.uid || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Document Structure */}
        {analytics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Latest Document Structure</CardTitle>
              <CardDescription>Raw structure of the most recent analytics document</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap">
                {JSON.stringify(analytics[0], null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {analytics.length === 0 && !loading && (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No analytics data found in the collection</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
