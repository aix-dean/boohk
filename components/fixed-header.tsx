"use client"

import React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Bell, Search, ChevronLeft } from "lucide-react" // Removed LogOut, User, Settings as they are no longer needed for the profile dropdown

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { useIsAdmin } from "@/hooks/use-is-admin"
import { useSalesNotifications, useLogisticsNotifications, useAdminNotifications } from "@/hooks/use-notifications"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface FixedHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onMenuClick: () => void
}

interface BreadcrumbItemData {
  label: string
  href?: string
  isPage?: boolean
}

export function FixedHeader({ onMenuClick, className, ...props }: FixedHeaderProps) {
  const pathname = usePathname()
  const { user, userData } = useAuth() // Removed signOut as it's no longer in this component's direct interaction
  const { unreadCount } = useUnreadMessages()
  const isAdmin = useIsAdmin()

  // Get notifications based on user role
  const { notifications: salesNotifications, unreadCount: salesUnreadCount } = useSalesNotifications()
  const { notifications: logisticsNotifications, unreadCount: logisticsUnreadCount } = useLogisticsNotifications()
  const { notifications: adminNotifications, unreadCount: adminUnreadCount } = useAdminNotifications()

  // Determine which notifications to show
  const currentNotifications = isAdmin ? adminNotifications : (userData?.roles?.includes('logistics') ? logisticsNotifications : salesNotifications)
  const currentUnreadCount = isAdmin ? adminUnreadCount : (userData?.roles?.includes('logistics') ? logisticsUnreadCount : salesUnreadCount)

  // --- Debugging Logs ---
  console.log("Current Pathname:", pathname)
  const isAdminPage = pathname.startsWith("/admin")
  console.log("Is Admin Page:", isAdminPage)
  // --- End Debugging Logs ---

  // Determine current section for colors
  let currentSection = pathname?.split("/")[1] || "dashboard"
  if (pathname?.startsWith("/sales")) {
    currentSection = "sales"
  }
  if (pathname?.startsWith("/logistics")) {
    currentSection = "logistics"
  }
  if (pathname?.startsWith("/admin")) {
    currentSection = "admin"
  }
  if (pathname?.startsWith("/treasury")) {
    currentSection = "treasury"
  }

  const getHeaderColors = (section: string) => {
    switch (section) {
      case 'sales':
        return {
          bg: 'linear-gradient(to right, #FF3131, #FF313180)',
          hover: '#FF313180'
        }
      case 'logistics':
        return {
          bg: 'linear-gradient(to right, #32A7FA, #32A7FA80)',
          hover: '#32A7FA80'
        }
      case 'admin':
        return {
          bg: 'linear-gradient(to right, #2A31B4, #2A31B480)',
          hover: '#2A31B480'
        }
      case 'treasury':
        return {
          bg: 'linear-gradient(to right, #049334, #04933480)',
          hover: '#04933480'
        }
      case 'it':
        return {
          bg: 'linear-gradient(to right, #2A31B4, #2A31B480)',
          hover: '#2A31B480'
        }
      case 'business':
        return {
          bg: 'linear-gradient(to right, #4169E1, #4169E180)',
          hover: '#4169E180'
        }
      default:
        return {
          bg: 'linear-gradient(to right, #FF3131, #FF313180)',
          hover: '#FF313180'
        }
    }
  }

  const headerColors = getHeaderColors(currentSection)

  const getBreadcrumbs = (path: string): BreadcrumbItemData[] => {
    const segments = path.split("/").filter(Boolean)
    const breadcrumbs: BreadcrumbItemData[] = []

    if (path === "/sales/dashboard") {
      breadcrumbs.push({ label: "Admin - Dashboard", isPage: true })
    } else if (path.startsWith("/admin/")) {
      breadcrumbs.push({ label: "Admin - Dashboard", href: "/sales/dashboard" })
      const adminSubPath = segments[1]
      if (adminSubPath) {
        const pageLabel = adminSubPath
          .replace(/-/g, " ")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
        breadcrumbs.push({ label: pageLabel, isPage: true })
      }
    } else if (path.startsWith("/sales/dashboard")) {
      breadcrumbs.push({ label: "Admin - Dashboard", href: "/sales/dashboard" })
      breadcrumbs.push({ label: "Sales - Dashboard", isPage: true })
    } else if (path.startsWith("/logistics/dashboard")) {
      breadcrumbs.push({ label: "Admin - Dashboard", href: "/sales/dashboard" })
      breadcrumbs.push({ label: "Logistics - Dashboard", isPage: true })
    } else if (segments.length === 0) {
      breadcrumbs.push({ label: "Dashboard", isPage: true })
    } else {
      // General handling for other paths
      const section = segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
      let page = ""

      if (segments.length > 1) {
        page = segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
        if (segments.length > 2 && segments[2].match(/\[.*\]/)) {
          page = segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
        } else if (segments.length > 2 && segments[1] === "edit" && segments[2].match(/\[.*\]/)) {
          page = `Edit ${segments[0].slice(0, -1)}`
        } else if (segments.length > 2 && segments[1] === "create") {
          page = `Create ${segments[0].slice(0, -1)}`
        } else if (segments.length > 2 && segments[1] === "new") {
          page = `New ${segments[0].slice(0, -1)}`
        } else if (segments.length > 2 && segments[1] === "view") {
          page = `View ${segments[0].slice(0, -1)}`
        } else if (segments.length > 2 && segments[1] === "cost-estimates") {
          page = `Cost Estimates`
        } else if (segments.length > 2 && segments[1] === "generate-quotation") {
          page = `Generate Quotation`
        } else if (segments.length > 2 && segments[1] === "create-cost-estimate") {
          page = `Create Cost Estimate`
        } else if (segments.length > 2 && segments[1] === "accept") {
          page = `Accept Quotation`
        } else if (segments.length > 2 && segments[1] === "decline") {
          page = `Decline Quotation`
        } else if (segments.length > 2 && segments[1] === "chat") {
          page = `Chat`
        } else if (segments.length > 2 && segments[1] === "bulletin-board") {
          page = `Bulletin Board`
        } else if (segments.length > 2 && segments[1] === "project-campaigns") {
          page = `Project Campaigns`
        } else if (segments.length > 2 && segments[1] === "quotation-requests") {
          page = `Quotation Requests`
        } else if (segments.length > 2 && segments[1] === "bookings") {
          page = `Bookings`
        } else if (segments.length > 2 && segments[1] === "alerts") {
          page = `Alerts`
        } else if (segments.length > 2 && segments[1] === "assignments") {
          page = `Assignments`
        } else if (segments.length > 2 && segments[1] === "planner") {
          page = `Planner`
        } else if (segments.length > 2 && segments[1] === "access-management") {
          page = `Access Management`
        } else if (segments.length > 2 && segments[1] === "chat-analytics") {
          page = `Chat Analytics`
        }

        page = page
          .replace(/-/g, " ")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      }

      if (page) {
        breadcrumbs.push({ label: section, href: `/${segments[0]}` })
        breadcrumbs.push({ label: page, isPage: true })
      } else {
        breadcrumbs.push({ label: section, isPage: true })
      }
    }
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(pathname)

  const showAdminBackButton =
    (pathname.startsWith("/admin/") && pathname !== "/sales/dashboard") ||
    pathname.startsWith("/sales/dashboard") ||
    pathname.startsWith("/logistics/dashboard")

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4 border-b-0 px-4 sm:static sm:h-auto",
        className,
      )}
      style={{ backgroundImage: headerColors.bg }}
      {...props}
    >
      {/* New: Back button for admin sub-pages, sales dashboard, and logistics dashboard */}
      {showAdminBackButton && (
        <Link href="/sales/dashboard" passHref>
          <Button
            variant="default"
            className="bg-black hover:bg-black/90 text-white rounded-full px-4 py-2 flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Admin
          </Button>
        </Link>
      )}
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden bg-transparent" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          {/* Mobile navigation content would go here, if needed */}
        </SheetContent>
      </Sheet>
      {/* Replaced h1 with Breadcrumb component */}
      <Breadcrumb>
        <BreadcrumbList className="text-white">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {item.label === "Admin - Dashboard" && item.href && !showAdminBackButton ? (
                  <Link href={item.href} passHref>
                    <Button
                      variant="default"
                      className="bg-black hover:bg-black/90 text-white rounded-full px-4 py-2 flex items-center gap-1"
                      asChild
                    >
                      <span>
                        <ChevronLeft className="h-4 w-4" /> Admin
                      </span>
                    </Button>
                  </Link>
                ) : item.isPage ? (
                  <BreadcrumbPage className="font-normal text-white">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href || "#"} className="transition-colors hover:text-gray-200 text-white">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator className="text-white" />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="relative ml-auto flex-1 md:grow-0">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white" />
        <Input
          type="search"
          placeholder="Search..."
          className="w-full rounded-lg bg-gray-700 placeholder:text-gray-300 text-white pl-8 md:w-[200px] lg:w-[336px]"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative rounded-full text-white",
              headerColors.hover,
            )}
          >
            <Bell className="h-5 w-5" />
            {currentUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {currentUnreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {currentNotifications.length === 0 ? (
            <DropdownMenuItem>No new notifications</DropdownMenuItem>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {currentNotifications.slice(0, 5).map((notification) => (
                <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3 cursor-pointer">
                  <div className="font-medium text-sm">{notification.title}</div>
                  <div className="text-xs text-gray-600 mt-1">{notification.description}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {notification.created && new Date(notification.created.toDate()).toLocaleDateString()}
                  </div>
                </DropdownMenuItem>
              ))}
              {currentNotifications.length > 5 && (
                <DropdownMenuItem className="text-center text-blue-600">
                  View all notifications
                </DropdownMenuItem>
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Directly link the profile icon to the /account page */}
      <Link href="/account" passHref>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "overflow-hidden rounded-full text-white",
            headerColors.hover,
          )}
          asChild
        >
          <Avatar>
            <AvatarImage src={user?.photoURL || "/placeholder-user.jpg"} alt="User Avatar" />
            <AvatarFallback>
              {userData?.first_name ? userData.first_name.charAt(0) : user?.email?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </Link>
    </header>
  )
}
