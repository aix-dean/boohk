import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Slider } from "@/components/ui/slider"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import LoopTimeline from "@/components/loop-timeline"
import { getProductById, getServiceAssignmentsByProductId } from "@/lib/firebase-service"
import {
  ArrowLeft,
  Edit,
  Trash2,
  List,
  Wrench,
  Settings,
  Clock,
  Power,
  RotateCcw,
  Pause,
  ToggleLeft,
  Timer,
  RefreshCw,
  Camera,
  TestTube,
  Play,
  Sun,
  FolderSyncIcon as Sync,
  Calendar,
} from "lucide-react"

interface Props {
  params: {
    id: string
  }
}

// Enhanced product data interface for CMS details
interface CMSProductData {
  id: string
  name: string
  description: string
  status: string
  type: string
  image?: string
  dimensions?: string
  created: string
  updated: string
  company_id?: string
  seller_id?: string
  traffic_count?: number
  cms: {
    end_time: string
    loops_per_day: number
    spot_duration: number
    start_time: string
  }
  programList: Array<{
    id: string
    name: string
    duration: string
    timeSlot: string
    advertiser: string
    price: string
    status: string
  }>
  serviceAssignments: Array<{
    id: string
    title: string
    assignedTo: string
    date: string
    status: string
    notes: string
  }>
  ledStatus: {
    powerStatus: string
    temperature: string
    connection: string
    videoSource: string
    activeContent: string
    lastReboot: string
    lastTimeSync: string
    warnings: string[]
  }
  livePreview: Array<{
    id: string
    health: string
    image: string
  }>
}

// Fetch product data from Firebase
async function getProductData(id: string): Promise<CMSProductData | null> {
  try {
    // Get product from Firebase
    const product = await getProductById(id)

    if (!product) {
      return null
    }

    // Get service assignments for this product
    const serviceAssignments = await getServiceAssignmentsByProductId(id)

    // Convert Firebase product to CMS product data format
    const cmsProductData: CMSProductData = {
      id: product.id || id,
      name: product.name || "Unknown Product",
      description: product.description || "No description available",
      status: product.status || "PENDING",
      type: product.type || "RENTAL",
      image: product.imageUrl || "/placeholder.svg?height=200&width=200",
      dimensions: `H: ${product.specs_rental?.height || 12} × W: ${product.specs_rental?.width || 12}`,
      created: product.created ? new Date(product.created.seconds * 1000).toLocaleDateString() : "Unknown",
      updated: product.updated ? new Date(product.updated.seconds * 1000).toLocaleDateString() : "Unknown",
      company_id: product.company_id,
      seller_id: product.seller_id,
      traffic_count: product.specs_rental?.traffic_count || 0,
      cms: {
        end_time: product.cms?.end_time || "18:00",
        loops_per_day: product.cms?.loops_per_day || 20,
        spot_duration: product.cms?.spot_duration || 15,
        start_time: product.cms?.start_time || "06:00",
      },
      // Mock program list - in a real app, this would come from a separate collection
      programList: [
        {
          id: "SPOT001",
          name: "Morning Slot",
          duration: "15 seconds",
          timeSlot: "06:00 AM - 12:00 PM",
          advertiser: "Coca Cola",
          price: "PHP 1,200",
          status: "Active",
        },
        {
          id: "SPOT002",
          name: "Afternoon Slot",
          duration: "30 seconds",
          timeSlot: "12:00 PM - 06:00 PM",
          advertiser: "Samsung",
          price: "PHP 1,800",
          status: "Active",
        },
        {
          id: "SPOT003",
          name: "Evening Slot",
          duration: "15 seconds",
          timeSlot: "06:00 PM - 12:00 AM",
          advertiser: "Nike",
          price: "PHP 2,100",
          status: "Pending",
        },
        {
          id: "SPOT004",
          name: "Late Night Slot",
          duration: "30 seconds",
          timeSlot: "12:00 AM - 06:00 AM",
          advertiser: "-",
          price: "PHP 900",
          status: "Available",
        },
      ],
      // Convert service assignments from Firebase
      serviceAssignments: serviceAssignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.jobDescription || "Service Assignment",
        assignedTo: assignment.assignedTo || "Unassigned",
        date: assignment.coveredDateStart ? new Date(assignment.coveredDateStart).toLocaleDateString() : "TBD",
        status: assignment.status || "Pending",
        notes: assignment.message || "No notes available",
      })),
      // Mock LED status - in a real app, this would come from IoT devices or separate collection
      ledStatus: {
        powerStatus: "On",
        temperature: "32°C",
        connection: "Online",
        videoSource: "HDMI 1",
        activeContent: "Current Campaign",
        lastReboot: new Date().toLocaleDateString() + " 09:15 AM",
        lastTimeSync: new Date().toLocaleDateString() + " 08:00 AM",
        warnings:
          product.specs_rental?.elevation && product.specs_rental.elevation > 100 ? ["High elevation detected"] : [],
      },
      // Mock live preview - in a real app, this would come from live camera feeds
      livePreview: [
        {
          id: `${product.name?.substring(0, 10) || "LED"} 3.2`,
          health: "100% Healthy",
          image: "/placeholder.svg?height=100&width=150",
        },
        {
          id: `${product.specs_rental?.location?.substring(0, 10) || "SITE"} 1.0`,
          health: "100% Healthy",
          image: "/placeholder.svg?height=100&width=150",
        },
        {
          id: "BACKUP LED 1.0",
          health: "100% Healthy",
          image: "/placeholder.svg?height=100&width=150",
        },
        {
          id: "MAIN LED 2.1",
          health: product.active ? "100% Healthy" : "90% Healthy",
          image: "/placeholder.svg?height=100&width=150",
        },
      ],
    }

    return cmsProductData
  } catch (error) {
    console.error("Error fetching product data:", error)
    return null
  }
}

export default async function Page({ params }: Props) {
  const { id } = params

  if (!id) {
    notFound()
  }

  const product = await getProductData(id)

  if (!product) {
    notFound()
  }

  // Calculate spots per loop based on time difference and spot duration
  const calculateSpotsPerLoop = (startTime: string, endTime: string, spotDuration: number) => {
    const [startHour, startMinute] = startTime.split(":").map(Number)
    const [endHour, endMinute] = endTime.split(":").map(Number)

    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    const loopDurationMinutes = endTotalMinutes - startTotalMinutes
    const loopDurationSeconds = loopDurationMinutes * 60

    return Math.floor(loopDurationSeconds / spotDuration)
  }

  const spotsPerLoop = calculateSpotsPerLoop(product.cms.start_time, product.cms.end_time, product.cms.spot_duration)

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "available":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "in progress":
      case "ongoing":
        return "bg-blue-100 text-blue-800"
      case "scheduled":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(price)
  }

  const formatLocation = (location: string) => {
    return location && location.length > 50 ? location.substring(0, 50) + "..." : location || "Not specified"
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/cms/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
        <div className="flex gap-2">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
          <Button variant="destructive">
            <Trash2 size={16} className="mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Title and Badges */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <Badge className={getStatusColor(product.status)}>
          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
        </Badge>
        <Badge variant="outline">{product.type}</Badge>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left - Image */}
        <div className="col-span-2">
          <div className="bg-gray-100 rounded-lg p-4">
            <Image
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              width={200}
              height={200}
              className="w-full h-auto rounded"
            />
          </div>
        </div>

        {/* Middle - Description and CMS Config */}
        <div className="col-span-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
            <p className="text-gray-900">{product.description}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">CMS Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>Spots per loop: {product.cms.loops_per_day}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>Spot duration: {product.cms.spot_duration}s</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>
                  Loop time: {product.cms.start_time} - {product.cms.end_time}
                </span>
              </div>
            </div>
          </div>

          {product.traffic_count && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Traffic Count</h3>
              <p className="text-gray-900">{product.traffic_count.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Right - ID and Dimensions */}
        <div className="col-span-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">ID</h3>
            <p className="text-sm font-mono">{product.id}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Dimensions</h3>
            <p className="text-sm">{product.dimensions}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} />
              <span>Created: {product.created}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} />
              <span>Updated: {product.updated}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="program-list" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-100">
          <TabsTrigger value="program-list" className="flex items-center gap-2">
            <List size={16} />
            Program List
          </TabsTrigger>
          <TabsTrigger value="service" className="flex items-center gap-2">
            <Wrench size={16} />
            Service
          </TabsTrigger>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Settings size={16} />
            Controls
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock size={16} />
            Loop Timeline
          </TabsTrigger>
        </TabsList>

        {/* Program List Tab */}
        <TabsContent value="program-list" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List size={20} />
              <h2 className="text-xl font-semibold">Program List</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <List size={16} className="mr-2" />
                List
              </Button>
              <Button variant="outline" size="sm">
                <Calendar size={16} className="mr-2" />
                Calendar
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Time Slot</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.programList.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="font-mono text-sm">{program.id}</TableCell>
                      <TableCell className="font-medium">{program.name}</TableCell>
                      <TableCell>{program.duration}</TableCell>
                      <TableCell>{program.timeSlot}</TableCell>
                      <TableCell>{program.advertiser}</TableCell>
                      <TableCell>{program.price}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(program.status)}>{program.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700">+ Add Program</Button>
          </div>
        </TabsContent>

        {/* Service Tab */}
        <TabsContent value="service" className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench size={20} />
            <h2 className="text-xl font-semibold">Service Assignments</h2>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.serviceAssignments.length > 0 ? (
                    product.serviceAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-mono text-sm">{assignment.id}</TableCell>
                        <TableCell className="font-medium">{assignment.title}</TableCell>
                        <TableCell>{assignment.assignedTo}</TableCell>
                        <TableCell>{assignment.date}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(assignment.status)}>{assignment.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{assignment.notes}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No service assignments found for this product.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700">+ Create Service Assignment</Button>
          </div>
        </TabsContent>

        {/* Controls Tab */}
        <TabsContent value="controls" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* LED Site Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings size={18} />
                  LED Site Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Power Status</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">{product.ledStatus.powerStatus}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Connection</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">{product.ledStatus.connection}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Temperature</span>
                    <p className="text-sm mt-1">{product.ledStatus.temperature}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Video Source</span>
                    <p className="text-sm mt-1">{product.ledStatus.videoSource}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Active Content</span>
                    <p className="text-sm mt-1 text-blue-600">{product.ledStatus.activeContent}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Last Time Sync</span>
                    <p className="text-sm mt-1">{product.ledStatus.lastTimeSync}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-gray-500">Last Reboot</span>
                    <p className="text-sm mt-1">{product.ledStatus.lastReboot}</p>
                  </div>
                </div>

                {product.ledStatus.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <span className="text-sm font-medium">⚠ Warnings</span>
                    </div>
                    <ul className="mt-1 text-sm text-yellow-700">
                      {product.ledStatus.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Remote Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Power size={18} />
                  Remote Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <Power size={16} />
                    Power Off
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <RotateCcw size={16} />
                    Restart Players
                  </Button>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Content Controls</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <Pause size={16} />
                      Pause Content
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <ToggleLeft size={16} />
                      Switch Source
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">System Controls</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <Timer size={16} />
                      NTP Time Sync
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <RefreshCw size={16} />
                      Screen Refresh
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Monitoring</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <Camera size={16} />
                      Screenshot
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <RefreshCw size={16} />
                      Refresh Status
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <TestTube size={16} />
                      Test Pattern
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <Play size={16} />
                      Run Diagnostics
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <Sun size={16} />
                      Auto Brightness
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                      <Sync size={16} />
                      Sync Playback
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span>Content</span>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Display Health
                  </Badge>
                  <span>Structure</span>
                </div>
                <span>
                  {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString()}
                </span>
                <Button size="sm" variant="outline">
                  Live
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {product.livePreview.map((preview) => (
                  <div key={preview.id} className="text-center">
                    <div className="bg-gray-100 rounded-lg p-2 mb-2">
                      <Image
                        src={preview.image || "/placeholder.svg"}
                        alt={preview.id}
                        width={150}
                        height={100}
                        className="w-full h-auto rounded"
                      />
                    </div>
                    <p className="text-sm font-medium">{preview.id}</p>
                    <Badge
                      className={
                        preview.health.includes("100%")
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {preview.health}
                    </Badge>
                  </div>
                ))}
              </div>

              <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Create Service Assignment</Button>
            </CardContent>
          </Card>

          {/* Brightness and Volume Controls */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Brightness Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Slider defaultValue={[75]} max={100} step={1} className="w-full" />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Volume Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Slider defaultValue={[60]} max={100} step={1} className="w-full" />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Loop Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <LoopTimeline
            cmsData={product.cms}
            productId={product.id}
            companyId={product.company_id}
            sellerId={product.seller_id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
