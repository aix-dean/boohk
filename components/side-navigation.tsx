"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Truck,
  AlertTriangle,
  FileText,
  Settings,
  ShieldCheck,
  BookOpen,
  Package,
  MessageCircle,
  FileCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ClipboardList,
  CloudRain,
  Cog,
  Monitor,
  DollarSign,
  Receipt,
  CreditCard,
  Wallet,
  CalendarCheck,
  Calculator, // Import Calculator icon
  User,
  Grid3x3,
  Tag,
  Smile,
  ChevronDown,
  ArrowLeft,
  SquarePen,
} from "lucide-react"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { useAuth } from "@/contexts/auth-context"
import { LogisticsNotifications, SalesNotifications, AdminNotifications, ITNotifications, TreasuryNotifications, BusinessDevNotifications } from "@/components/notifications"
import { DepartmentDropdown } from "@/components/department-dropdown"

// Custom SVG Icons
const TeamsIcon = ({ className, color = "white" }: { className?: string; color?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M4 13C5.1 13 6 12.1 6 11C6 9.9 5.1 9 4 9C2.9 9 2 9.9 2 11C2 12.1 2.9 13 4 13ZM5.13 14.1C4.76 14.04 4.39 14 4 14C3.01 14 2.07 14.21 1.22 14.58C0.48 14.9 0 15.62 0 16.43V18H4.5V16.39C4.5 15.56 4.73 14.78 5.13 14.1ZM20 13C21.1 13 22 12.1 22 11C22 9.9 21.1 9 20 9C18.9 9 18 9.9 18 11C18 12.1 18.9 13 20 13ZM24 16.43C24 15.62 23.52 14.9 22.78 14.58C21.93 14.21 20.99 14 20 14C19.61 14 19.24 14.04 18.87 14.1C19.27 14.78 19.5 15.56 19.5 16.39V18H24V16.43ZM16.24 13.65C15.07 13.13 13.63 12.75 12 12.75C10.37 12.75 8.93 13.14 7.76 13.65C6.68 14.13 6 15.21 6 16.39V18H18V16.39C18 15.21 17.32 14.13 16.24 13.65ZM8.07 16C8.16 15.77 8.2 15.61 8.98 15.31C9.95 14.93 10.97 14.75 12 14.75C13.03 14.75 14.05 14.93 15.02 15.31C15.79 15.61 15.83 15.77 15.93 16H8.07ZM12 8C12.55 8 13 8.45 13 9C13 9.55 12.55 10 12 10C11.45 10 11 9.55 11 9C11 8.45 11.45 8 12 8ZM12 6C10.34 6 9 7.34 9 9C9 10.66 10.34 12 12 12C13.66 12 15 10.66 15 9C15 7.34 13.66 6 12 6Z" fill={color}/>
  </svg>
)

const IntegrationIcon = ({ className, color = "white" }: { className?: string; color?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M18 4.5L14 8.5H17V15.5C17 16.6 16.1 17.5 15 17.5C13.9 17.5 13 16.6 13 15.5V8.5C13 6.29 11.21 4.5 9 4.5C6.79 4.5 5 6.29 5 8.5V15.5H2L6 19.5L10 15.5H7V8.5C7 7.4 7.9 6.5 9 6.5C10.1 6.5 11 7.4 11 8.5V15.5C11 17.71 12.79 19.5 15 19.5C17.21 19.5 19 17.71 19 15.5V8.5H22L18 4.5Z" fill={color}/>
  </svg>
)

const TransactionsIcon = ({ className, color = "white" }: { className?: string; color?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM15 6.5V9H11V11H15V13.5L18.5 10L15 6.5ZM9 10.5L5.5 14L9 17.5V15H13V13H9V10.5Z" fill={color}/>
  </svg>
)

const PayoutsIcon = ({ className, color = "white" }: { className?: string; color?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19 14V6C19 4.9 18.1 4 17 4H3C1.9 4 1 4.9 1 6V14C1 15.1 1.9 16 3 16H17C18.1 16 19 15.1 19 14ZM17 14H3V6H17V14ZM10 7C8.34 7 7 8.34 7 10C7 11.66 8.34 13 10 13C11.66 13 13 11.66 13 10C13 8.34 11.66 7 10 7ZM23 7V18C23 19.1 22.1 20 21 20H4V18H21V7H23Z" fill={color}/>
  </svg>
)

// Navigation data structure with icons
const navigationItems = [
  {
    section: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [],
  },
  {
    section: "features",
    title: "Features",
    icon: Package,
    items: [{ title: "Overview", href: "/features", icon: LayoutDashboard }],
  },
  {
    section: "sales",
    title: "Sales",
    icon: BarChart3,
    items: [
      { title: "Dashboard", href: "/sales/dashboard", icon: LayoutDashboard },
      { title: "Proposals", href: "/sales/proposals", icon: FileCheck },
      { title: "Cost Estimates", href: "/sales/cost-estimates", icon: Calculator },
      { title: "Price Listing", href: "/sales/price-listing", icon: DollarSign },
      { title: "Quotations", href: "/sales/quotations-list", icon: FileText }, // Added new item for Quotations
      { title: "Reservations", href: "/sales/reservation", icon: CalendarCheck },
      { title: "JOs", href: "/sales/job-orders", icon: ClipboardList },
      { title: "Clients", href: "/sales/clients", icon: Users },
      { title: "Billings", href: "/sales/billings", icon: FileText },
      { title: "Planner", href: "/sales/planner", icon: Calendar },
      { title: "Customer Chat", href: "/sales/chat", icon: MessageCircle },
    ],
  },
  {
    section: "logistics",
    title: "Logistics",
    icon: Truck,
    items: [
      { title: "Dashboard", href: "/logistics/dashboard", icon: LayoutDashboard },
      { title: "Service Assignments", href: "/logistics/assignments", icon: FileText },
      { title: "Planner", href: "/logistics/planner", icon: Calendar },
      { title: "Alerts", href: "/logistics/alerts", icon: AlertTriangle },
    ],
  },
  {
    section: "cms",
    title: "CMS",
    icon: FileText,
    items: [
      { title: "Dashboard", href: "/cms/dashboard", icon: LayoutDashboard },
      { title: "Planner", href: "/cms/planner", icon: Calendar },
      { title: "Orders", href: "/cms/orders", icon: FileText },
    ],
  },
  {
    section: "business",
    title: "Business",
    icon: BarChart3,
    items: [
      { title: "Dashboard", href: "/business/dashboard", icon: LayoutDashboard },
      { title: "Overview", href: "/business/overview", icon: BarChart3 },
      { title: "Reports", href: "/business/reports", icon: FileText },
    ],
  },
  {
    section: "finance",
    title: "Finance",
    icon: DollarSign,
    items: [
      { title: "Dashboard", href: "/finance", icon: LayoutDashboard },
      { title: "Invoices", href: "/finance/invoices", icon: Receipt },
      { title: "Expenses", href: "/finance/expenses", icon: CreditCard },
      { title: "Reports", href: "/finance/reports", icon: BarChart3 },
      { title: "Budget Planning", href: "/finance/budget", icon: Calendar },
      { title: "Tax Management", href: "/finance/tax", icon: FileText },
      { title: "Collectibles", href: "/finance/collectibles", icon: Package },
    ],
  },
  {
    section: "treasury",
    title: "Treasury",
    icon: Wallet,
    items: [
      { title: "Dashboard", href: "/treasury/dashboard", icon: LayoutDashboard },
      { title: "Collectibles", href: "/treasury/collectibles", icon: Package },
      { title: "Requests", href: "/treasury/requests", icon: FileText },
      { title: "Reports", href: "/treasury/reports", icon: BarChart3 },
    ],
  },
  {
    section: "accounting",
    title: "Accounting",
    icon: DollarSign,
    items: [
      { title: "Transactions", href: "/accounting/transactions", icon: TransactionsIcon },
      { title: "Payouts", href: "/accounting/payouts", icon: PayoutsIcon },
    ],
  },
  {
    section: "it",
    title: "IT",
    icon: Monitor,
    items: [
      { title: "Dashboard", href: "/it", icon: LayoutDashboard },
      { title: "System Status", href: "/it/system-status", icon: Monitor },
      { title: "Support Overview", href: "/it/support-overview", icon: AlertTriangle },
    ],
  },
  {
    section: "admin",
    title: "Admin",
    icon: ShieldCheck,
    items: [],
  },
  {
    section: "settings",
    title: "Settings",
    icon: Settings,
    items: [
      { title: "General", href: "/settings", icon: Settings },
      { title: "Plan Profile", href: "/admin/subscriptions", icon: FileText },
    ],
  },
  {
    section: "account",
    title: "Account",
    icon: User,
    items: [
      { title: "Profile", href: "/account", icon: User },
      { title: "Change Password", href: "/account/change-password", icon: Settings },
      { title: "Signature", href: "/account/signature", icon: SquarePen },
    ],
  },
]

function isActive(pathname: string, href: string) {
  // Special case for sales dashboard modes
  if (pathname === "/sales/dashboard") {
    const currentMode = sessionStorage.getItem('sales-dashboard-mode')
    if (href === "/sales/proposals" && currentMode === 'proposal') {
      return true
    }
    if (href === "/sales/cost-estimates" && currentMode === 'cost-estimate') {
      return true
    }
    if (href === "/sales/quotations-list" && currentMode === 'quotation') {
      return true
    }
  }

  return pathname === href
}

export function SideNavigation() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { unreadCount } = useUnreadMessages()
  const [showIntelligence, setShowIntelligence] = useState(false)

  // Determine the current section from the pathname
  let currentSection = pathname?.split("/")[1] || "dashboard"
  console.log("DEBUG: pathname =", pathname)
  console.log("DEBUG: initial currentSection =", currentSection)
  if (pathname?.startsWith("/sales")) {
    currentSection = "sales"
    console.log("DEBUG: set to sales")
  }
  if (pathname?.startsWith("/logistics")) {
    currentSection = "logistics"
    console.log("DEBUG: set to logistics")
  }
  if (pathname?.startsWith("/cms")) {
    currentSection = "cms"
    console.log("DEBUG: set to cms")
  }
  if (pathname?.startsWith("/admin")) {
    currentSection = "admin"
    console.log("DEBUG: set to admin")
  }
  if (pathname?.startsWith("/it")) {
    currentSection = "it"
    console.log("DEBUG: set to it")
  }
  if (pathname?.startsWith("/finance")) {
    currentSection = "finance"
    console.log("DEBUG: set to finance")
  }
  if (pathname?.startsWith("/accounting")) {
    currentSection = "accounting"
    console.log("DEBUG: set to accounting")
  }
  if (pathname?.startsWith("/treasury")) {
    currentSection = "treasury"
    console.log("DEBUG: set to treasury")
  }
  if (pathname?.startsWith("/business")) {
    currentSection = "business"
    console.log("DEBUG: set to business")
  }
  if (pathname?.startsWith("/account") && !pathname?.startsWith("/accounting")) {
    currentSection = "account"
    console.log("DEBUG: set to account")
  }
  console.log("DEBUG: final currentSection =", currentSection)

  // Find the navigation item for the current section
  const currentNavItem = navigationItems.find((item) => item.section === currentSection)

  if (
    !currentNavItem &&
    currentSection !== "admin" &&
    currentSection !== "sales" &&
    currentSection !== "logistics" &&
    currentSection !== "cms" &&
    currentSection !== "business" &&
    currentSection !== "it" &&
    currentSection !== "finance" &&
    currentSection !== "accounting" &&
    currentSection !== "account"
  ) {
    return null
  }

  const SectionIcon = currentNavItem?.icon

  const getDiagonalBgColor = (section: string) => {
    if (section === 'sales') return 'bg-[#f49998]'
    if (section === 'logistics') return 'bg-[#98d3fd]'
    if (section === 'admin') return 'bg-[#9498d9]'
    if (section === 'treasury') return 'bg-[#81c999]'
    if (section === 'it') return 'bg-[#80bfbf]'
    if (section === 'business') return 'bg-[#a0b4f0]'
    if (section === 'cms') return 'bg-[#fed7aa]'
    if (section === 'account') return 'bg-[#CFCFCF]'
    return 'bg-[#38b6ff]'
  }

  return (
    <div className="h-screen w-[234px] bg-gradient-to-b from-[#1a0f5c] via-[#4a1d7f] via-[#6b2d9e] to-[#2d4a9e] shadow-sm flex flex-col relative">
      <div className="h-16 flex items-center px-6">
        {pathname === '/account' ? (
          <Link href="/" className="flex items-center gap-2 text-white hover:text-white/80 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Account Setting</span>
          </Link>
        ) : (
          <DepartmentDropdown />
        )}
      </div>
      <div className="h-px bg-white/30 mx-6"></div>
      <nav className="px-4 flex-1 min-h-0 overflow-y-auto pb-16">
        {currentSection === "cms" ? (
          <>
            {/* Updates Center Section */}

            <div className="hidden bg-[#fbe0e0] backdrop-blur-sm rounded-[20px] p-3 text-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Updates Center</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-3/4"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button className="text-xs text-gray-900/90 hover:text-gray-900 transition-colors">See All</button>
              </div>
            </div>

            {/* Flat Navigation */}
            <div className="rounded-[20px] shadow-sm">
              <div className="p-1">
                {[
                  { title: "Dashboard", href: "/cms/dashboard", icon: LayoutDashboard },
                  { title: "Planner", href: "/cms/planner", icon: Calendar },
                  { title: "JOs", href: "/cms/orders", icon: ClipboardList },
                  { title: "Content Library", href: "/cms/content", icon: FileText },
                  { title: "Screen Management", href: "/cms/screens", icon: Monitor },
                  { title: "Campaign Scheduler", href: "/cms/scheduler", icon: Calendar },
                  { title: "Analytics", href: "/cms/analytics", icon: BarChart3 },
                  { title: "Settings", href: "/cms/settings", icon: Cog },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

          </>
        ) : currentSection === "logistics" ? (
          <>
            <LogisticsNotifications />

            {/* Flat Navigation */}
            <div className="rounded-[20px] shadow-sm">
              <div className="p-1">
                {[
                  { title: "Dashboard", href: "/logistics/dashboard", icon: LayoutDashboard },
                  { title: "Bulletin Board", href: "/logistics/bulletin-board", icon: ClipboardList },
                  { title: "Planner", href: "/logistics/planner", icon: Calendar },
                  { title: "Service Assignments", href: "/logistics/assignments", icon: FileText },
                  { title: "Job Orders", href: "/logistics/job-orders", icon: ClipboardList },
                  { title: "Reports", href: "/logistics/service-reports", icon: BarChart3 },
                  { title: "Fleet", href: "/logistics/fleet", icon: Truck },
                  { title: "Teams and Personnel", href: "/logistics/teams", icon: Users },
                  { title: "News and Weather", href: "/logistics/weather", icon: CloudRain },
                  { title: "To-do-list", href: "/logistics/todo-list", icon: ClipboardList },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

          </>
        ) : currentSection === "business" || currentSection === "it" || currentSection === "finance" || currentSection === "accounting" || currentSection === "treasury" ? (
          <>
            {/* Dynamic notification component based on section */}
            {currentSection === "business" && <BusinessDevNotifications />}
            {currentSection === "it" && <ITNotifications />}
            {currentSection === "finance" && <div className="hidden bg-white/55 backdrop-blur-sm rounded-[20px] p-3 text-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Updates Center</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-3/4"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-3/4"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button className="text-xs text-gray-900/90 hover:text-gray-900 transition-colors">See All</button>
              </div>
            </div>}
            {currentSection === "accounting" && <div className="hidden bg-white/55 backdrop-blur-sm rounded-[20px] p-3 text-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Updates Center</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button className="text-xs text-gray-900/90 hover:text-gray-900 transition-colors">See All</button>
              </div>
            </div>}
            {currentSection === "treasury" && <TreasuryNotifications />}

            {/* Flat Navigation */}
            <div className="rounded-[20px] shadow-sm">
              <div className="p-1">
                {currentSection === "business" && [
                  { title: "Inventory", href: "/business/inventory", icon: Package },
                  { title: "Price Listing", href: "/business/price-listing", icon: DollarSign },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
                {currentSection === "it" && [
                  { title: "Teams", href: "/it/teams", icon: TeamsIcon },
                  { title: "Integration", href: "/it/integration", icon: IntegrationIcon },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" color={active ? "#333333" : "white"} />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
                {currentSection === "finance" && [
                  { title: "Dashboard", href: "/finance", icon: LayoutDashboard },
                  { title: "Reports", href: "/finance/reports", icon: BarChart3 },
                  { title: "Budget Planning", href: "/finance/budget", icon: Calendar },
                  { title: "Invoices", href: "/finance/invoices", icon: Receipt },
                  { title: "Expenses", href: "/finance/expenses", icon: CreditCard },
                  { title: "Requests", href: "/finance/requests", icon: ClipboardList },
                  { title: "Collectibles", href: "/finance/collectibles", icon: Package },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
                {currentSection === "accounting" && [
                  { title: "Transactions", href: "/accounting/transactions", icon: TransactionsIcon },
                  { title: "Payouts", href: "/accounting/payouts", icon: PayoutsIcon },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
                {currentSection === "treasury" && [
                  { title: "Dashboard", href: "/treasury/dashboard", icon: LayoutDashboard },
                  { title: "Planner", href: "/treasury/planner", icon: Calendar },
                  { title: "Collectibles", href: "/treasury/collectibles", icon: Package },
                  { title: "Requests", href: "/treasury/requests", icon: FileText },
                  { title: "Reports", href: "/treasury/reports", icon: BarChart3 },
                  { title: "Settings", href: "/treasury/settings", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

          </>
        ) : currentSection === "finance" ? (
          <>
            {/* Updates Center Section */}
            <div className="hidden bg-[#fbe0e0] backdrop-blur-sm border border-green-500/30 rounded-[20px] p-3 text-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Updates Center</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-3/4"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-3/4"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button className="text-xs text-gray-900/90 hover:text-gray-900 transition-colors">See All</button>
              </div>
            </div>

            {/* To Go Section */}
            <div className="rounded-[20px] shadow-sm">
              <div className="px-3 py-2">
                <h3 className="text-sm font-medium text-white">To Go</h3>
              </div>
              <div className="p-1">
                {[
                  { title: "Dashboard", href: "/finance", icon: LayoutDashboard },
                  { title: "Reports", href: "/finance/reports", icon: BarChart3 },
                  { title: "Budget Planning", href: "/finance/budget", icon: Calendar },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* To Do Section */}
            <div className="rounded-[20px] shadow-sm">
              <div className="px-3 py-2">
                <h3 className="text-sm font-medium text-white">To Do</h3>
              </div>
              <div className="p-1">
                {[
                  { title: "Invoices", href: "/finance/invoices", icon: Receipt },
                  { title: "Expenses", href: "/finance/expenses", icon: CreditCard },
                  { title: "Requests", href: "/finance/requests", icon: ClipboardList },
                  { title: "Collectibles", href: "/finance/collectibles", icon: Package },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

          </>
        ) : currentSection === "accounting" ? (
          <>
            {/* Updates Center Section */}
            <div className="hidden bg-[#fbe0e0] backdrop-blur-sm border border-green-500/30 rounded-[20px] p-3 text-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Updates Center</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white/30 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 bg-white/40 rounded-full mb-1"></div>
                    <div className="h-2 bg-white/30 rounded-full w-2/3"></div>
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button className="text-xs text-gray-900/90 hover:text-gray-900 transition-colors">See All</button>
              </div>
            </div>

            {/* To Go Section */}
            <div className="rounded-[20px] shadow-sm">
              <div className="px-3 py-2">
                <h3 className="text-sm font-medium text-white">To Go</h3>
              </div>
              <div className="p-1">
                {[
                  { title: "Transactions", href: "/accounting/transactions", icon: TransactionsIcon },
                  { title: "Payouts", href: "/accounting/payouts", icon: PayoutsIcon },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>


          </>
        ) : currentSection === "admin" ? (
          <>
            <AdminNotifications />

            {/* Flat Navigation */}
            <div className="rounded-[20px] shadow-sm">
              <div className="p-1">
                {[
                  { title: "Dashboard", href: "/sales/dashboard", icon: LayoutDashboard },
                  { title: "Bulletin Board", href: "/admin/project-bulletin", icon: Monitor },
                  { title: "Planner", href: "/admin/planner", icon: Calendar },
                  { title: "Company", href: "/admin/company", icon: Users },
                  { title: "Clients", href: "/admin/clients", icon: Users },
                  { title: "Assets", href: "/admin/assets", icon: Package },
                  { title: "Petty Cash", href: "/admin/petty-cash", icon: DollarSign },
                  { title: "Plan Profile", href: "/admin/subscriptions", icon: FileText },
                  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
                  { title: "To-do-list", href: "/admin/todo-list", icon: ClipboardList },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

          </>
        ) : currentSection === "sales" ? (
            <>
              <SalesNotifications />

              {/* Flat Navigation */}
              <div className="rounded-[20px] shadow-sm">
                <div className="p-1">
                  {[
                    { title: "Enrolled Sites", href: "/sales/dashboard", icon: LayoutDashboard },
                    { title: "Reservations", href: "/sales/reservation", icon: CalendarCheck },
                    { title: "Price Listing", href: "/sales/price-listing", icon: DollarSign },
                  ].map((item) => {
                    const Icon = item.icon
                    const active = isActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                          !active && "hover:bg-white/10 rounded-[10px]",
                          active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

            </>
        ) : currentSection === "treasury" ? (
          <>
            <AdminNotifications />

            {/* To Go Section */}
            <div className="rounded-[20px] shadow-sm">
              <div className="px-3 py-2">
                <h3 className="text-sm font-medium text-white">To Go</h3>
              </div>
              <div className="p-1">
                {[
                  { title: "Dashboard", href: "/treasury/dashboard", icon: LayoutDashboard },
                  { title: "Collectibles", href: "/treasury/collectibles", icon: Package },
                  { title: "Requests", href: "/treasury/requests", icon: FileText },
                  { title: "Planner", href: "/treasury/planner", icon: Calendar },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* To Do Section */}
            <div className="rounded-[20px] shadow-sm">
              <div className="px-3 py-2">
                <h3 className="text-sm font-medium text-white">To Do</h3>
              </div>
              <div className="p-1">
                {[
                  { title: "Collectibles", href: "/treasury/collectibles", icon: Package },
                  { title: "To-Do List", href: "/treasury/todo-list", icon: ClipboardList },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

          </>
        ) : currentSection === "account" ? (
          <>
            {/* Account Menu */}
            <div className="rounded-[20px] shadow-sm">
              <div className="p-1">
                {[
                  { title: "Profile", href: "/account", icon: User },
                  { title: "Change Password", href: "/account/change-password", icon: Settings },
                  { title: "Signature", href: "/account/signature", icon: SquarePen },
                ].map((item) => {
                  const Icon = item.icon
                  const active = isActive(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                        !active && "hover:bg-white/10 rounded-[10px]",
                        active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-[20px] shadow-sm">
            <div className="px-3 py-2">
              <h3 className="text-sm font-medium text-white">Navigation</h3>
            </div>
            <div className="p-1">
              {currentNavItem?.items?.map((item) => {
                const Icon = item.icon
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-white font-bold text-base leading-none transition-colors",
                      !active && "hover:bg-white/10 rounded-[10px]",
                      active && "rounded-[10px] bg-white text-[#333] font-bold text-base leading-none mb-2 relative",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="px-4 pb-10">
        <div className="flex items-center justify-center gap-2">
          <img src="/boohk-logo.png" alt="Boohk Logo" style={{ height: '31.271px' }} />
          <img src="/boohk-text-login.png" alt="Boohk Text Login" style={{ height: '21px' }} />
        </div>
      </div>

      {showIntelligence && (
        <div className="absolute bottom-1 left-3 z-0">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-[20px] p-3 text-white w-[14.5rem]">
            <div className="flex items-center space-x-2 mb-3">
              <h3 className="text-sm font-medium">Intelligence</h3>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="relative">
              <div className="flex items-center space-x-2">
                <button className="p-1 hover:bg-white/10 rounded transition-colors">
                  <ChevronLeft className="h-4 w-4 text-white" />
                </button>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="h-12 rounded-md"></div>
                  <div className="h-12 rounded-md"></div>
                </div>
                <button className="p-1 hover:bg-white/10 rounded transition-colors">
                  <ChevronRight className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button className="text-xs text-white/90 hover:text-white transition-colors">See All</button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowIntelligence(!showIntelligence)}
        className="hidden fixed bottom-4 left-4 z-50 bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
      >
        <Sparkles className="h-5 w-5 text-white" />
      </button>
    </div>
  )
}
