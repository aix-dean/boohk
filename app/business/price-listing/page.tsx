"use client"

import React from "react"
import { useAuth } from "@/contexts/auth-context"
import { RouteProtection } from "@/components/route-protection"
import PriceListingContent from "@/components/PriceListingContent"

export default function PriceListingPage() {
  const { user, userData } = useAuth()

  return (
    <RouteProtection requiredRoles="business">
      <div className="h-full overflow-hidden">
        <PriceListingContent />
      </div>
    </RouteProtection>
  )
}

