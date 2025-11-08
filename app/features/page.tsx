"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  BarChart3,
  Truck,
  FileText,
  ShieldCheck,
  Settings,
  ArrowRight,
  Star,
  Clock,
  CheckCircle,
  MessageCircle,
  Users,
} from "lucide-react"
import Image from "next/image"

const features = [
  {
    section: "Sales",
    description: "Customer relationship and revenue management",
    icon: BarChart3,
    color: "bg-green-500",
    pages: [
      {
        title: "Sales Dashboard",
        href: "/sales/dashboard",
        description: "Sales performance metrics and analytics",
        status: "active",
      },
      {
        title: "Bookings",
        href: "/sales/bookings",
        description: "Manage customer bookings and reservations",
        status: "active",
      },
      {
        title: "Clients",
        href: "/sales/clients",
        description: "Customer database and relationship management",
        status: "active",
      },
      {
        title: "Products",
        href: "/sales/products",
        description: "Product catalog and inventory management",
        status: "active",
      },
      {
        title: "Proposals",
        href: "/sales/proposals",
        description: "Create and manage detailed business proposals",
        status: "active",
      },
      {
        title: "Quotations",
        href: "/sales/quotation-requests",
        description: "Generate professional quotations with PDF export",
        status: "active",
      },
      {
        title: "Quotation Email System",
        href: "/sales/quotation-requests",
        description: "Send professional quotations via email with accept/decline options",
        status: "active",
      },
      {
        title: "Sales Chat",
        href: "/sales/chat",
        description: "Internal team communication and collaboration",
        status: "active",
      },
      {
        title: "Sales Planner",
        href: "/sales/planner",
        description: "Schedule and plan sales activities with weather integration",
        status: "active",
      },
      {
        title: "Project Campaigns",
        href: "/sales/project-campaigns",
        description: "Manage customer bookings and reservations",
        status: "active",
      },
    ],
  },
  {
    section: "Logistics",
    description: "Operations and resource management",
    icon: Truck,
    color: "bg-orange-500",
    pages: [
      {
        title: "Logistics Dashboard",
        href: "/logistics/dashboard",
        description: "Operational metrics and comprehensive site monitoring",
        status: "active",
      },
      {
        title: "Service Assignments",
        href: "/logistics/assignments",
        description: "Assign and track service tasks with weather considerations",
        status: "active",
      },
      {
        title: "Site Management",
        href: "/logistics/sites",
        description: "Monitor LED and static billboard sites",
        status: "active",
      },
      {
        title: "Logistics Planner",
        href: "/logistics/planner",
        description: "Schedule logistics operations and maintenance",
        status: "active",
      },
      {
        title: "Alerts & Monitoring",
        href: "/logistics/alerts",
        description: "System alerts and real-time notifications",
        status: "active",
      },
      {
        title: "Products & Inventory",
        href: "/logistics/products",
        description: "Track logistics inventory and equipment",
        status: "active",
      },
    ],
  },
  {
    section: "CMS",
    description: "Content management and publishing",
    icon: FileText,
    color: "bg-purple-500",
    pages: [
      {
        title: "CMS Dashboard",
        href: "/cms/dashboard",
        description: "Content overview and publishing metrics",
        status: "active",
      },
      {
        title: "Content Planner",
        href: "/cms/planner",
        description: "Schedule and plan content publishing with weather data",
        status: "active",
      },
      {
        title: "Content Orders",
        href: "/cms/orders",
        description: "Manage content creation and approval workflows",
        status: "active",
      },
      {
        title: "Site Details",
        href: "/cms/details",
        description: "Detailed content management for specific sites",
        status: "active",
      },
    ],
  },
  {
    section: "Admin",
    description: "System administration and management",
    icon: ShieldCheck,
    color: "bg-red-500",
    pages: [
      {
        title: "Admin Dashboard",
        href: "/admin",
        description: "System overview and administrative controls",
        status: "active",
      },
      {
        title: "Inventory Management",
        href: "/admin/inventory",
        description: "Manage system inventory and assets",
        status: "active",
      },
      {
        title: "Product Management",
        href: "/admin/products",
        description: "Create and manage product catalog",
        status: "active",
      },
      {
        title: "Access Management",
        href: "/admin/access-management",
        description: "User roles, permissions, and security settings",
        status: "active",
      },
      {
        title: "Chat Analytics",
        href: "/admin/chat-analytics",
        description: "Monitor and analyze chat system usage",
        status: "active",
      },
    ],
  },
  {
    section: "Settings",
    description: "System configuration and preferences",
    icon: Settings,
    color: "bg-gray-500",
    pages: [
      {
        title: "General Settings",
        href: "/settings",
        description: "Account settings and preferences",
        status: "active",
      },
      {
        title: "Account Management",
        href: "/account",
        description: "Personal account information and security",
        status: "active",
      },
      {
        title: "Subscription",
        href: "/settings/subscription",
        description: "Manage subscription plans and billing",
        status: "active",
      },
    ],
  },
  {
    section: "OHLIVER Assistant",
    description: "AI-powered help and guidance",
    icon: MessageCircle,
    color: "bg-blue-500",
    pages: [
      {
        title: "Chat with OHLIVER",
        href: "/ai-assistant",
        description: "Full-screen chat interface with your AI assistant",
        status: "active",
      },
    ],
  },
  {
    section: "Public Access",
    description: "Client-facing features and external access",
    icon: Users,
    color: "bg-indigo-500",
    pages: [
      {
        title: "Proposal Viewer",
        href: "/proposals/view",
        description: "Public proposal viewing with password protection",
        status: "active",
      },
      {
        title: "Quotation Response",
        href: "/quotations",
        description: "Client quotation accept/decline interface",
        status: "active",
      },
    ],
  },
  {
    section: "Authentication",
    description: "User authentication and security",
    icon: ShieldCheck,
    color: "bg-teal-500",
    pages: [
      {
        title: "Login",
        href: "/login",
        description: "Secure user authentication",
        status: "active",
      },
      {
        title: "Registration",
        href: "/register",
        description: "New user account creation",
        status: "active",
      },
      {
        title: "Password Recovery",
        href: "/forgot-password",
        description: "Password reset functionality",
        status: "active",
      },
    ],
  },
]

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      )
    case "development":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          In Development
        </Badge>
      )
    case "beta":
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
          <Star className="w-3 h-3 mr-1" />
          Beta
        </Badge>
      )
    default:
      return null
  }
}

export default function FeaturesPage() {
  const totalPages = features.reduce((acc, section) => acc + section.pages.length, 0)
  const activePages = features.reduce(
    (acc, section) => acc + section.pages.filter((page) => page.status === "active").length,
    0,
  )
  const totalModules = features.length

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Features Overview</h1>
        <p className="text-lg text-gray-600 mb-4">
          Explore all the features and capabilities available in the OH Plus platform
        </p>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4 min-w-[120px]">
            <div className="text-2xl font-bold text-gray-900">{totalModules}</div>
            <div className="text-sm text-gray-600">Modules</div>
          </div>
          <div className="bg-white rounded-lg border p-4 min-w-[120px]">
            <div className="text-2xl font-bold text-green-600">{activePages}</div>
            <div className="text-sm text-gray-600">Active Pages</div>
          </div>
          <div className="bg-white rounded-lg border p-4 min-w-[120px]">
            <div className="text-2xl font-bold text-gray-900">{totalPages}</div>
            <div className="text-sm text-gray-600">Total Pages</div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="space-y-8">
        {features.map((section) => {
          const SectionIcon = section.icon

          return (
            <Card key={section.section} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <div className="flex items-center gap-4">
                  <div className={`${section.color} p-3 rounded-lg text-white`}>
                    {section.section === "OHLIVER Assistant" ? (
                      <div className="relative w-6 h-6">
                        <Image
                          src="/ohliver-mascot.png"
                          alt="OHLIVER"
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      </div>
                    ) : (
                      <SectionIcon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900">{section.section}</CardTitle>
                    <CardDescription className="text-gray-600">{section.description}</CardDescription>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="outline" className="bg-white">
                      {section.pages.length} {section.pages.length === 1 ? "page" : "pages"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {section.pages.map((page) => (
                    <div
                      key={page.href}
                      className="group border rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {page.title}
                        </h3>
                        {getStatusBadge(page.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{page.description}</p>
                      <div className="flex items-center justify-between">
                        <Link href={page.href}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors"
                            disabled={page.status === "development"}
                          >
                            {page.status === "development" ? "Coming Soon" : "Visit Page"}
                            {page.status !== "development" && (
                              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                            )}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-gray-600 mb-4">
              If you need assistance with any of these features or have suggestions for new ones, please contact our
              support team or ask OHLIVER, your AI assistant.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm">
                Contact Support
              </Button>
              <Button variant="outline" size="sm">
                Feature Request
              </Button>
              <Link href="/ai-assistant">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <div className="relative w-4 h-4">
                    <Image src="/ohliver-mascot.png" alt="OHLIVER" width={16} height={16} className="rounded-full" />
                  </div>
                  Ask OHLIVER
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
