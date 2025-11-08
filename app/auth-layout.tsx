"use client"

import type React from "react"

import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import ClientLayout from "./clientLayout"

interface AuthLayoutProps {
  children: React.ReactNode
}

const RedirectToLogin = () => {
  // Directly use the relative path for internal navigation
  window.location.href = "/login"
  return null
}

const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/register/select-subscription",
  "/unauthorized", // Add unauthorized page to public routes
]

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { user, userData, loading } = useAuth() // Get userData here
  const pathname = usePathname()

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname?.startsWith("/unauthorized") // Handle unauthorized path
  const isPublicProposal = pathname?.startsWith("/proposals/view/")
  const isPublicQuotation = pathname?.startsWith("/quotations/")
  const isPublicCostEstimate = pathname?.startsWith("/cost-estimates/view/")


  // If it's a public proposal view, render without navigation and without auth check
  if (isPublicProposal || isPublicQuotation || isPublicCostEstimate) {
    return <div className="min-h-screen bg-gray-50">{children}</div>
  }

  // If it's a public route (login, register, select-subscription, onboarding), render directly
  if (isPublicRoute) {
    return <>{children}</>
  }

  // For protected routes, show loading state while checking authentication
  if (loading) {
    console.log("AuthLayout: Loading state, showing spinner")
    console.log("Current pathname:", pathname)
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
      </div>
    )
  }

  // If user is not logged in and trying to access a protected route, redirect to login
  if (!user) {
    console.log("AuthLayout: User is null, redirecting to login")
    console.log("Current pathname:", pathname)
    return <RedirectToLogin />
  }

  // If user has no roles, redirect to unauthorized page
  if (user && userData && (!userData.roles || userData.roles.length === 0)) {
    console.log("AuthLayout: User has no roles, redirecting to unauthorized")
    console.log("User roles:", userData.roles)
    console.log("User permissions:", userData.permissions)
    if (pathname !== "/unauthorized") {
      window.location.href = "/unauthorized"
      return null
    }
  }

  // If all checks pass (user is logged in), render ClientLayout
  console.log("AuthLayout: All checks passed, rendering ClientLayout")
  console.log("User:", user?.uid)
  console.log("UserData roles:", userData?.roles)
  console.log("Current pathname:", pathname)
  return <ClientLayout>{children}</ClientLayout>
}
