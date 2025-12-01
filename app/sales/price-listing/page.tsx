"use client"

import { RouteProtection } from "@/components/route-protection"
import PriceListingContent from "@/components/PriceListingContent"

export default function PriceListingPage() {
  return (
    <RouteProtection requiredRoles="sales">
      <div className="h-full overflow-hidden">
        <PriceListingContent />
      </div>
    </RouteProtection>
  )
}
