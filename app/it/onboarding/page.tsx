"use client"

import { useState, useEffect } from "react"
import { RouteProtection } from "@/components/route-protection"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OnboardingTooltip } from "@/components/onboarding-tooltip"

export default function ITOnboardingPage() {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // Show onboarding tooltip when page loads
    setShowOnboarding(true)
  }, [])

  const closeOnboarding = () => {
    setShowOnboarding(false)
  }

  return (
    <RouteProtection requiredRoles="it">
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">IT Onboarding</h1>

          <Card>
            <CardHeader>
              <CardTitle>Welcome to the IT Department</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                This page provides onboarding information for new IT team members.
                The onboarding dialogs will appear automatically when you first visit this page.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Onboarding Tooltip */}
        {showOnboarding && (
          <OnboardingTooltip onClose={closeOnboarding} />
        )}
      </div>
    </RouteProtection>
  )
}