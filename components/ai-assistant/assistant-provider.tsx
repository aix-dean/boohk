"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { AssistantWidget } from "./assistant-widget"

export function AssistantProvider() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Only render on client-side to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't show on auth pages
  const isAuthPage = pathname.includes("/login") || pathname.includes("/register")

  if (!mounted || isAuthPage) return null

  return <AssistantWidget />
}
