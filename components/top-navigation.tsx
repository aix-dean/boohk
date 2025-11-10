"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, Settings, LogOut, User, Bell, ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { useIsAdmin } from "@/hooks/use-is-admin"

export function TopNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())

  const { user, userData, logout } = useAuth()
  const { unreadCount } = useUnreadMessages()
  const isAdmin = useIsAdmin()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const getPageTitle = (path: string) => {
    const segments = path.split("/").filter(Boolean)
    if (segments.length === 0) return "Dashboard"

    if (path === "/it") return "Dashboard"
    if (path === "/sales/dashboard") return "Sales - Dashboard"
    if (path === "/logistics/dashboard") return "Logistics - Dashboard"
    if (path === "/cms/dashboard") return "CMS - Dashboard"
    if (path === "/admin/dashboard") return "Admin - Dashboard"
    if (path === "/ai-assistant") return "AI Assistant"
    if (path === "/account") return "Account Settings"
    if (path === "/account/change-password") return "Account Settings"
    if (path === "/account/signature") return "Account Settings"
    if (path === "/settings") return "Settings"
    if (path === "/settings/subscription") return "Settings - Subscription"
    if (path === "/help") return "Help & Support"
    if (path === "/features") return "Features"

    // Add this new check for business section
    if (pathname.startsWith("/business")) return "Business Developer"

    if (segments[0]) {
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
        if (section === "Sales" && page === "Reservation") {
          return "Reservations"
        }
        return `${section} - ${page}`
      }
      return section
    }
    return "Dashboard"
  }

  const pageTitle = getPageTitle(pathname)

  const isSalesSection = pathname.startsWith("/sales")
  const isLogisticsSection = pathname.startsWith("/logistics")
  const isCmsSection = pathname.startsWith("/cms")
  const isAdminSection = pathname.startsWith("/admin")
  const isItSection = pathname.startsWith("/it")
  const isFinanceSection = pathname.startsWith("/finance")
  const isTreasurySection = pathname.startsWith("/treasury")
  const isAccountingSection = pathname.startsWith("/accounting")
  const isBusinessSection = pathname.startsWith("/business")
  const isAccountPage = pathname.startsWith("/account")

  const navBgColor = isSalesSection
    ? "bg-department-sales-red"
    : isAdminSection
      ? "bg-[#2a31b4]"
      : isCmsSection
        ? "bg-department-creatives-orange"
        : isItSection
          ? "bg-[#318080]"
          : isFinanceSection
            ? "bg-department-finance-green"
            : isTreasurySection
              ? "bg-[#379334]"
              : isAccountingSection
                ? "bg-department-accounting-purple"
                : isBusinessSection
                  ? "bg-[#4169e1]"
                  : isLogisticsSection
                    ? "bg-[#48a7fa]"
                    : "bg-[#A1A1A1]"
                    

  const diagonalBgColor = isSalesSection
    ? "bg-card-content-sales"
    : isAdminSection
      ? "bg-card-content-accounting"
      : isCmsSection
        ? "bg-card-content-creatives"
        : isItSection
          ? "bg-card-content-it"
          : isFinanceSection
            ? "bg-card-content-finance"
            : isTreasurySection
              ? "bg-card-content-treasury"
              : isAccountingSection
                ? "bg-card-content-accounting"
                : isBusinessSection
                  ? "bg-card-content-businessdev"
                  : isLogisticsSection
                    ? "bg-card-content-logistics"
                    : "bg-card-content-logistics"

  const handleMobileNavigation = (href: string) => {
    router.push(href)
    setIsOpen(false)
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error: any) {
      console.error("Logout error:", error)
      // You could add toast notification here if needed
    }
  }

  return (
    <nav className={`top-nav relative ${navBgColor} z-40`}>
      {/* Diagonal section - positioned to always be before the date area */}
      <svg
        className="absolute top-0 right-0 h-full w-[280px] z-0 hidden md:block"
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
      >
        <path
          d="M 5 0 Q 15 8 5 16 L 100 16 L 100 0 Z"
          fill={
            isSalesSection ? '#f49998' :
            isLogisticsSection ? '#98d3fd' :
            isCmsSection ? '#FFF3E0' :
            isAdminSection ? '#9498d9' :
            isTreasurySection ? '#81c999' :
            isItSection ? '#80bfbf' :
            isFinanceSection ? '#04933480' :
            isBusinessSection ? '#a0b4f0' :
            isAccountingSection ? '#2A31B480' :
            '#CFCFCF'
          }
        />
      </svg>

      <div className="top-nav-container text-white relative z-10">
        <div className="top-nav-content flex items-center justify-between w-full px-4 md:px-8">
          <div className="top-nav-left">
            {isAccountPage ? (
              <div className="flex items-center">
                <button
                  onClick={() => router.back()}
                  className="flex items-center text-white hover:text-gray-200 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  <span className="text-base font-black">Account Setting</span>
                </button>
              </div>
            ) : (
              <div className="top-nav-logo flex items-center">
                <h1 className="text-xl font-semibold text-white ml-4 hidden">
                  {(() => {
                    let title = pageTitle == "Admin - Subscriptions" ? "Admin - Plan Profile" : pageTitle.replace(/\bIt\b/g, "I.T")
                    return title.includes(" - ") ? title.split(" - ").slice(1).join(" - ") : title
                  })()}
                </h1>
              </div>
            )}
            <div className="top-nav-links hidden md:flex"></div>
          </div>

          <div className="top-nav-right flex items-center h-full relative z-20 flex-shrink-0">
             {" "}
             {/* Added relative z-20 and flex-shrink-0 */}
             {/* Date display in the light blue section with adjusted padding */}
             {(isAccountPage || !isAccountPage) && (
               <div className="hidden md:flex items-center justify-end h-full pl-8 pr-8 relative z-10">
                 {" "}
                 {/* Adjusted pl-8 */}
                 <span className="text-sm font-medium text-white">
                   {isAccountPage
                     ? format(currentTime, "h:mm a | MMM d, yyyy")
                     : format(currentTime, "MMMM d, yyyy, h:mm a")
                   }
                 </span>
               </div>
             )}
             {/* User controls section (bell and profile) - Conditionally rendered */}
             {!isAccountPage && ( // Only render if NOT on the account page
               <div className="flex items-center mr-6 md:mr-12 relative z-10">
                 {" "}
                 {/* Added relative z-10 */}
                 <button
                   className="p-2 rounded-full text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary relative"
                   aria-label="View notifications"
                 >
                   <img src="/icons8-notification-90.png" className="h-[25px] w-[25px]]" alt="Notifications" />
                   {unreadCount > 0 && (
                     <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                       {unreadCount}
                     </span>
                   )}
                 </button>
                 {/* Message button */}
                 <button
                   className="ml-3 p-2 rounded-full text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary relative"
                   aria-label="View messages"
                 >
                   <img src="/icons8-sms-90.png" className="h-[25px] w-[25px]" alt="Messages" />
                 </button>
                 {/* Profile button */}
                 <div className="ml-3 relative z-10">
                   <Link href="/account">
                     <button
                       type="button"
                       className="p-2 rounded-full text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                       aria-label="Go to profile"
                     >
                       <img src="/icons8-test-account-90 1.png" className="h-[25px] w-[25px]" alt="Account" />
                     </button>
                   </Link>
                 </div>
               </div>
             )}
            {/* Mobile menu button */}
            <div className="top-nav-mobile md:hidden">
              <button
                type="button"
                className="top-nav-mobile-button text-white"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
              >
                <span className="sr-only">Open main menu</span>
                {isOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsOpen(false)}></div>

          {/* Mobile menu */}
          <div className="top-nav-mobile-menu bg-white fixed inset-x-0 top-16 z-50 overflow-y-auto max-h-[calc(100vh-4rem)] shadow-lg">
            <div className="top-nav-mobile-links p-4">
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => handleMobileNavigation("/settings")}
                  className={`w-full text-left py-3 px-4 rounded-md flex items-center ${pathname.startsWith("/settings") ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-700"}`}
                >
                  <Settings className="mr-3 h-5 w-5 opacity-50" />
                  <span className="text-base">Settings</span>
                </button>

                <button
                  onClick={() => handleMobileNavigation("/account")}
                  className={`w-full text-left py-3 px-4 rounded-md flex items-center ${pathname.startsWith("/account") ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-700"}`}
                >
                  <User className="mr-3 h-5 w-5 opacity-50" />
                  <span className="text-base">Account</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => handleMobileNavigation("/admin")}
                    className={`w-full text-left py-3 px-4 rounded-md flex items-center ${pathname.startsWith("/admin") ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-700"}`}
                  >
                    <Settings className="mr-3 h-5 w-5 opacity-50" />
                    <span className="text-base">Admin</span>
                  </button>
                )}

              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}
