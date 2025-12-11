"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <div className="flex min-h-screen w-full">
      
          {/* Main Content */}
          <main className="flex-1 ">
            {children}
          </main>
        </div>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
