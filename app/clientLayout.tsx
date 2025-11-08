"use client"

import type React from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { TopNavigation } from "@/components/top-navigation"
import { SideNavigation } from "@/components/side-navigation"
import { Menu, X } from "lucide-react"
import { useResponsive } from "@/hooks/use-responsive"
import { useUserActivity } from "@/hooks/use-user-activity"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isMobile, isTablet } = useResponsive()

  // Track user activity for active users feature
  useUserActivity()

  const isSmallScreen = isMobile || isTablet

  // Skip the layout for login and register pages
  if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopNavigation />
      <div className="flex flex-1 relative">
        {/* Mobile sidebar backdrop */}
        {isSmallScreen && sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar - only render once */}
        <div
          className={`
          ${isSmallScreen ? "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out" : "relative"}
          ${isSmallScreen && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `}
        >
          <SideNavigation />

          {/* Close button for mobile - only show when sidebar is open on mobile */}
          {isSmallScreen && sidebarOpen && (
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white shadow-md z-60"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden h-[calc(100vh-64px)]">
          {/* Mobile sidebar toggle */}
          {isSmallScreen && (
            <div className="py-4 px-4 sm:px-6 lg:px-8 bg-gray-50 border-b border-gray-200">
              <button
                className="p-2 rounded-md bg-white shadow-sm border border-gray-200"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
            </div>
          )}

          {/* Router content area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className={`${pathname === "/account" ? "p-0" : "py-6 px-2 sm:px-4 lg:px-8"} min-h-full`}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
