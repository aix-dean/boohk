"use client"

import type React from "react"

import { useResponsive } from "@/hooks/use-responsive"
import { cn } from "@/lib/utils"

interface ResponsiveCardGridProps {
  children: React.ReactNode
  className?: string
  mobileColumns?: number
  tabletColumns?: number
  desktopColumns?: number
  gap?: "none" | "sm" | "md" | "lg" | "xl"
}

export function ResponsiveCardGrid({
  children,
  className,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = "md",
}: ResponsiveCardGridProps) {
  const { breakpoint } = useResponsive()

  const gapClasses = {
    none: "gap-0",
    sm: "gap-1",
    md: "gap-2",
    lg: "gap-4",
    xl: "gap-6",
  }

  const getGridCols = () => {
    if (breakpoint === "xs" || breakpoint === "sm") {
      return `grid-cols-${mobileColumns}`
    } else if (breakpoint === "md") {
      return `grid-cols-${tabletColumns}`
    } else {
      return `grid-cols-${desktopColumns}`
    }
  }

  return <div className={cn("grid", getGridCols(), gapClasses[gap], className)}>{children}</div>
}
