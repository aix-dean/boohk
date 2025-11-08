"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Search,
  BookOpen,
  Users,
  Package,
  Settings,
  BarChart3,
  Truck,
  Monitor,
  Mail,
  FileText,
  CheckCircle,
  Download,
  Send,
  Clock,
  AlertCircle,
  MessageCircle,
  Zap,
} from "lucide-react"
import Link from "next/link"

const helpSections = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <BookOpen className="h-6 w-6" />,
    description: "Learn the basics of navigating and using Boohk",
    articles: [
      "Platform Overview and Navigation",
      "Setting Up Your Account",
      "Understanding User Roles and Permissions",
      "Dashboard Overview",
      "Quick Start Guide",
      "Authentication and Security",
    ],
  },
  {
    id: "sales-management",
    title: "Sales Management",
    icon: <BarChart3 className="h-6 w-6" />,
    description: "Manage clients, bookings, proposals, and sales processes",
    articles: [
      "Creating and Managing Client Profiles",
      "Product Catalog and Availability",
      "Booking Process and Reservations",
      "Creating Business Proposals",
      "Generating Professional Quotations",
      "Sales Team Chat and Collaboration",
      "Sales Analytics and Reporting",
    ],
  },
  {
    id: "quotation-proposal-system",
    title: "Quotations & Proposals",
    icon: <Mail className="h-6 w-6" />,
    description: "Create, send, and manage quotations and proposals via email",
    badge: "Enhanced",
    articles: [
      "Creating Professional Proposals",
      "Generating Quotations from Proposals",
      "Sending Quotations via Email",
      "Understanding the Email Workflow",
      "Client Accept/Decline Process",
      "Tracking Quotation Status",
      "Password-Protected Proposal Sharing",
      "PDF Generation and Downloads",
      "Email Template Customization",
      "Troubleshooting Email Delivery",
    ],
  },
  {
    id: "logistics-operations",
    title: "Logistics & Operations",
    icon: <Truck className="h-6 w-6" />,
    description: "Manage service assignments, maintenance, and field operations",
    articles: [
      "Creating Service Assignments",
      "Weather-Integrated Planning",
      "Site Performance Monitoring",
      "LED and Static Site Management",
      "Equipment Inventory Management",
      "Field Team Coordination",
      "Maintenance Scheduling",
      "Alert System and Notifications",
    ],
  },
  {
    id: "content-management",
    title: "Content Management",
    icon: <Monitor className="h-6 w-6" />,
    description: "Schedule, publish, and manage content across your network",
    articles: [
      "Content Scheduling and Publishing",
      "Weather-Based Content Planning",
      "Campaign Management",
      "Content Approval Workflows",
      "Screen Performance Analytics",
      "Content Library Management",
      "Site-Specific Content Management",
    ],
  },
  {
    id: "administration",
    title: "Administration",
    icon: <Settings className="h-6 w-6" />,
    description: "System configuration, user management, and advanced settings",
    articles: [
      "User Management and Access Control",
      "Role-Based Permissions",
      "System Configuration",
      "Inventory Management",
      "Product Catalog Management",
      "Chat Analytics and Monitoring",
      "Analytics and Reporting",
    ],
  },
  {
    id: "ai-assistant",
    title: "OHLIVER AI Assistant",
    icon: <MessageCircle className="h-6 w-6" />,
    description: "Get help from your AI-powered assistant",
    badge: "Enhanced",
    articles: [
      "Using the Chat Interface",
      "Getting Feature Guidance",
      "Asking Platform Questions",
      "Understanding AI Responses",
      "Best Practices for AI Interaction",
      "Conversation History and Rating",
    ],
  },
  {
    id: "integrations",
    title: "Integrations & APIs",
    icon: <Zap className="h-6 w-6" />,
    description: "Weather data, location services, and external integrations",
    articles: [
      "Weather Data Integration",
      "Google Places Autocomplete",
      "Location Services",
      "Email Service Configuration",
      "Firebase Integration",
      "Search Functionality",
    ],
  },
]

const commonTasks = [
  {
    title: "Create a Business Proposal",
    description: "Step-by-step guide to creating comprehensive proposals",
    icon: <FileText className="h-5 w-5" />,
    badge: "Enhanced",
    steps: [
      "Navigate to Sales > Proposals",
      "Click 'Create New Proposal' button",
      "Fill in client information and requirements",
      "Add products, pricing, and terms",
      "Review and save the proposal",
      "Generate quotation or share directly",
    ],
  },
  {
    title: "Send a Quotation via Email",
    description: "Generate and email professional quotations to clients",
    icon: <Mail className="h-5 w-5" />,
    badge: "New",
    steps: [
      "Create or select an existing proposal",
      "Click 'Generate Quotation' button",
      "Review quotation details and pricing",
      "Choose 'Send Email' option",
      "Enter client email address",
      "Click 'Send Email' to deliver instantly",
      "Track status in quotation list",
    ],
  },
  {
    title: "Create a Service Assignment",
    description: "Assign maintenance or installation tasks to field teams",
    icon: <Truck className="h-5 w-5" />,
    steps: [
      "Navigate to Logistics > Assignments",
      "Click 'New Assignment' button",
      "Select assignment type and target site",
      "Check weather conditions for scheduling",
      "Assign team members and set priority",
      "Save and notify assigned team",
    ],
  },
  {
    title: "Schedule Content with Weather Data",
    description: "Plan content publishing with weather considerations",
    icon: <Monitor className="h-5 w-5" />,
    badge: "Enhanced",
    steps: [
      "Go to CMS > Planner",
      "Select target screens and locations",
      "Check weather forecast for optimal timing",
      "Upload or select content from library",
      "Set publishing schedule with weather rules",
      "Review and confirm publishing plan",
    ],
  },
  {
    title: "Chat with OHLIVER Assistant",
    description: "Get instant help from your AI assistant",
    icon: <MessageCircle className="h-5 w-5" />,
    badge: "Enhanced",
    steps: [
      "Navigate to AI Assistant page",
      "Type your question in the chat interface",
      "Use quick suggestions for common tasks",
      "Review OHLIVER's step-by-step guidance",
      "Rate the conversation for improvement",
    ],
  },
]

const detailedGuides = {
  "quotation-email-workflow": {
    title: "Complete Quotation Email Workflow",
    description: "Comprehensive guide to the new email quotation system",
    sections: [
      {
        title: "1. Generating a Quotation",
        content: [
          "Navigate to Sales > Quotation Requests",
          "Create a new quotation or select an existing one",
          "Fill in all required details (client, products, pricing)",
          "Review the quotation for accuracy",
          "Click 'Generate Quotation' to create the final document",
        ],
      },
      {
        title: "2. Sending via Email",
        content: [
          "After generating, you'll see action options",
          "Click 'Send Email' button",
          "Enter the client's email address",
          "Review the email preview",
          "Click 'Send Email' to deliver immediately",
          "The system will show a confirmation message",
        ],
      },
      {
        title: "3. Client Experience",
        content: [
          "Client receives a professional email with quotation details",
          "Email includes complete pricing breakdown",
          "Two action buttons: 'Accept Quotation' and 'Decline Quotation'",
          "Clicking either button redirects to a response page",
          "Client can provide optional feedback when declining",
        ],
      },
      {
        title: "4. Status Tracking",
        content: [
          "Quotation status updates automatically",
          "Possible statuses: Pending, Accepted, Declined",
          "View status in the quotation list",
          "Receive notifications for status changes",
          "Track response times and follow up as needed",
        ],
      },
      {
        title: "5. Best Practices",
        content: [
          "Always verify client email addresses before sending",
          "Follow up on pending quotations within 7 days",
          "Use clear, professional language in quotations",
          "Include all relevant terms and conditions",
          "Monitor response rates to optimize your process",
        ],
      },
    ],
  },
}

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeSection, setActiveSection] = useState("")

  // Track which section is currently in view
  useEffect(() => {
    const handleScroll = () => {
      const sections = helpSections.map((section) => section.id)
      const scrollPosition = window.scrollY + 100

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(sectionId)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll() // Set initial active section

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const filteredSections = helpSections.filter(
    (section) =>
      section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.articles.some((article) => article.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 scroll-smooth">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Documentation</h1>
            <p className="text-xl text-gray-600 mb-6">
              Comprehensive guides and tutorials to help you master the Boohk platform
            </p>

            {/* Search */}
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search help articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Table of Contents - Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Table of Contents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {helpSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left p-2 rounded-lg transition-colors text-sm ${
                        activeSection === section.id
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {section.icon}
                        <span>{section.title}</span>
                        {section.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {section.badge}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/ai-assistant">
                    <Button variant="outline" className="w-full justify-start text-sm">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ask OHLIVER
                    </Button>
                  </Link>
                  <Link href="/features">
                    <Button variant="outline" className="w-full justify-start text-sm">
                      <Package className="h-4 w-4 mr-2" />
                      Features Overview
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full justify-start text-sm">
                    <Users className="h-4 w-4 mr-2" />
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Common Tasks */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Common Tasks</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {commonTasks.map((task, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">{task.icon}</div>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                        </div>
                        {task.badge && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {task.badge}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{task.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-2">
                        {task.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex items-start gap-3 text-sm">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                              {stepIndex + 1}
                            </span>
                            <span className="text-gray-700">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Detailed Guide for Quotation Email System */}
            <section id="quotation-email-system">
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Mail className="h-6 w-6 text-blue-600" />
                    <div>
                      <CardTitle className="text-xl text-blue-900">Quotation Email System</CardTitle>
                      <CardDescription className="text-blue-700">
                        Complete guide to sending professional quotations via email
                      </CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 ml-auto">New Feature</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {detailedGuides["quotation-email-workflow"].sections.map((section, index) => (
                    <div key={index} className="bg-white p-6 rounded-lg border border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h3>
                      <ul className="space-y-2">
                        {section.content.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start gap-3 text-sm text-gray-700">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Email Features Overview */}
                  <div className="bg-white p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Features Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Send className="h-5 w-5 text-blue-500 mt-1" />
                        <div>
                          <h4 className="font-medium text-gray-900">Professional Templates</h4>
                          <p className="text-sm text-gray-600">Branded email templates with company logo and styling</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                        <div>
                          <h4 className="font-medium text-gray-900">Accept/Decline Buttons</h4>
                          <p className="text-sm text-gray-600">
                            Direct action buttons in the email for client responses
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-orange-500 mt-1" />
                        <div>
                          <h4 className="font-medium text-gray-900">Status Tracking</h4>
                          <p className="text-sm text-gray-600">Real-time updates on quotation status and responses</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Download className="h-5 w-5 text-purple-500 mt-1" />
                        <div>
                          <h4 className="font-medium text-gray-900">PDF Download</h4>
                          <p className="text-sm text-gray-600">Option to download quotations as PDF files</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Troubleshooting */}
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      Troubleshooting Email Issues
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-gray-900">Email not sending?</h4>
                        <p className="text-sm text-gray-600">
                          Check that the client email address is valid and your email service is properly configured.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Client not receiving emails?</h4>
                        <p className="text-sm text-gray-600">
                          Ask the client to check their spam folder and add your domain to their safe sender list.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Accept/Decline buttons not working?</h4>
                        <p className="text-sm text-gray-600">
                          Ensure the NEXT_PUBLIC_APP_URL environment variable is correctly set to your domain.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Help Sections */}
            {filteredSections.map((section) => (
              <section key={section.id} id={section.id}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">{section.icon}</div>
                        <div>
                          <CardTitle className="text-xl">{section.title}</CardTitle>
                          <CardDescription>{section.description}</CardDescription>
                        </div>
                      </div>
                      {section.badge && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {section.articles.map((article, index) => (
                        <div
                          key={index}
                          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-900">{article}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            ))}

            {/* Contact Support */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-xl">Need Additional Help?</CardTitle>
                <CardDescription>Can't find what you're looking for? Our support team is here to help.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Link href="/ai-assistant">
                    <div className="p-4 bg-white rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
                      <BookOpen className="h-8 w-8 text-blue-600 mb-3" />
                      <h3 className="font-semibold mb-2">Ask OHLIVER</h3>
                      <p className="text-gray-600 text-sm">Get instant help from our AI assistant</p>
                    </div>
                  </Link>
                  <div className="p-4 bg-white rounded-lg border border-blue-200">
                    <Users className="h-8 w-8 text-blue-600 mb-3" />
                    <h3 className="font-semibold mb-2">Contact Support</h3>
                    <p className="text-gray-600 text-sm">Reach out to our human support team</p>
                  </div>
                  <Link href="/features">
                    <div className="p-4 bg-white rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer">
                      <Package className="h-8 w-8 text-blue-600 mb-3" />
                      <h3 className="font-semibold mb-2">Features Overview</h3>
                      <p className="text-gray-600 text-sm">Explore all platform capabilities</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
