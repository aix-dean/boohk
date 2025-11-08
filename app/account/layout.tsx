import type React from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <div className="flex min-h-screen w-full flex-col p-0">
          {children}
        </div>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
