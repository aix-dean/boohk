"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { getSubscriptionPlans, subscriptionService } from "@/lib/subscription-service"
import type { BillingCycle, SubscriptionPlanType } from "@/lib/types/subscription"
import { CheckCircle, Loader2, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { getUserProductsCount } from "@/lib/firebase-service"

const promoEndDate = new Date(2025, 6, 19, 23, 59, 0)

export default function SubscriptionPage() {
  const { user, userData, subscriptionData, loading, refreshSubscriptionData } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [currentUserCount, setCurrentUserCount] = useState<number>(0)
  const [loadingUserCount, setLoadingUserCount] = useState(true)
  const [currentInventoryCount, setCurrentInventoryCount] = useState<number>(0)
  const [loadingInventoryCount, setLoadingInventoryCount] = useState(true)
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  } | null>(null)

  const plans = getSubscriptionPlans()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  // Fetch current user count using the same logic as user management page
  useEffect(() => {
    const fetchUserCount = async () => {
      if (!userData?.company_id) {
        setCurrentUserCount(0)
        setLoadingUserCount(false)
        return
      }

      try {
        setLoadingUserCount(true)
        const usersRef = collection(db, "boohk_users")
        const usersQuery = query(usersRef, where("company_id", "==", userData.company_id))
        const usersSnapshot = await getDocs(usersQuery)
        setCurrentUserCount(usersSnapshot.size)
      } catch (error) {
        console.error("Error fetching user count:", error)
        setCurrentUserCount(0)
      } finally {
        setLoadingUserCount(false)
      }
    }

    fetchUserCount()
  }, [userData?.company_id])

  // Fetch current inventory count
  useEffect(() => {
    const fetchInventoryCount = async () => {
      if (!userData?.company_id) {
        setCurrentInventoryCount(0)
        setLoadingInventoryCount(false)
        return
      }

      try {
        setLoadingInventoryCount(true)
        const count = await getUserProductsCount(userData.company_id, { active: true })
        setCurrentInventoryCount(count)
      } catch (error) {
        console.error("Error fetching inventory count:", error)
        setCurrentInventoryCount(0)
      } finally {
        setLoadingInventoryCount(false)
      }
    }

    fetchInventoryCount()
  }, [userData?.company_id])

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!loading && user && userData?.company_id) {
        try {
          const subscription = await subscriptionService.getSubscriptionByCompanyId(userData.company_id)
          console.log("Fetched subscription by company ID:", subscription)
        } catch (error) {
          console.error("Error fetching subscription by company ID:", error)
        }
      }
    }

    fetchSubscriptionData()
  }, [loading, user, userData])

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const difference = promoEndDate.getTime() - now

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      setTimeLeft({ days, hours, minutes, seconds })
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [])

  const handleUpgrade = useCallback(
    async (planId: string) => {
      if (!user || !userData?.license_key) {
        toast({
          title: "Authentication Required",
          description: "Please log in to manage your subscription.",
          variant: "destructive",
        })
        return
      }

      setIsUpdating(true)
      setSelectedPlanId(planId)

      try {
        const selectedPlan = plans.find((plan) => plan.id === planId)
        if (!selectedPlan) {
          toast({
            title: "Error",
            description: "Selected plan not found.",
            variant: "destructive",
          })
          return
        }

        if (selectedPlan.id === "enterprise") {
          toast({
            title: "Enterprise Plan",
            description: "Please contact us directly for Enterprise plan inquiries.",
            variant: "default",
          })
          return
        }

        const newPlanType: SubscriptionPlanType = selectedPlan.id as SubscriptionPlanType
        const billingCycle: BillingCycle = selectedPlan.billingCycle === "N/A" ? "monthly" : selectedPlan.billingCycle

        await subscriptionService.createSubscription(
          userData.license_key,
          newPlanType,
          billingCycle,
          user.uid,
          new Date(),
          null,
          "active",
          null,
          null,
        )

        toast({
          title: "Subscription Activated",
          description: `Welcome to the ${selectedPlan.name}! Your new subscription has been created.`,
        })

        await refreshSubscriptionData()
      } catch (error: any) {
        console.error("Failed to select plan:", error)
        toast({
          title: "Error",
          description: `Failed to activate subscription: ${error instanceof Error ? error.message : String(error)}`,
          variant: "destructive",
        })
      } finally {
        setIsUpdating(false)
        setSelectedPlanId(null)
      }
    },
    [user, userData, plans, refreshSubscriptionData, toast],
  )

  const isCurrentPlan = useCallback(
    (planId: string) => {
      return subscriptionData?.planType === planId
    },
    [subscriptionData],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  const currentPlan = subscriptionData?.planType || "None"
  const currentPlanDetails = plans.find((plan) => plan.id === currentPlan)

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {subscriptionData && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-6">
              Current Plan:{" "}
              <span
                className={cn(
                  "font-extrabold",
                  subscriptionData.status === "active" && "text-green-600",
                  subscriptionData.status === "trialing" && "text-blue-600",
                  (subscriptionData.status === "inactive" ||
                    subscriptionData.status === "expired" ||
                    subscriptionData.status === "cancelled") &&
                    "text-red-600",
                )}
              >
                {currentPlanDetails?.name || "No Active Plan"}
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="flex flex-col rounded-xl border-2 shadow-sm">
                <CardHeader className="bg-purple-700 text-white p-4 rounded-t-xl">
                  <CardTitle className="text-xl font-bold">Plan</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <h3 className="text-xl font-semibold capitalize text-gray-900">
                      {currentPlanDetails?.name || "N/A"}
                    </h3>
                    {currentPlanDetails?.price !== 0 && currentPlanDetails?.billingCycle !== "N/A" && (
                      <p className="text-lg text-gray-700 mt-1">
                        Php {currentPlanDetails?.price.toLocaleString()}{" "}
                        <span className="text-base font-medium text-gray-500">
                          /{currentPlanDetails?.billingCycle === "monthly" ? "month" : "year"}
                        </span>
                      </p>
                    )}
                    <ul className="mt-4 space-y-2 text-sm text-gray-700">
                      {currentPlanDetails?.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <CheckCircle className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-col rounded-xl border-2 shadow-sm">
                <CardHeader className="bg-purple-700 text-white p-4 rounded-t-xl">
                  <CardTitle className="text-xl font-bold">Cycle</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Start: {formatDate(subscriptionData.startDate)}
                    </p>
                    <p className="text-lg font-semibold text-gray-900">End: {formatDate(subscriptionData.endDate)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex flex-col rounded-xl border-2 shadow-sm">
                <CardHeader className="bg-purple-700 text-white p-4 rounded-t-xl">
                  <CardTitle className="text-xl font-bold">Users</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    {loadingUserCount ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm text-gray-600">Loading...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-gray-900">{currentUserCount} users</p>
                        <p className="text-sm text-gray-600">
                          {subscriptionData.maxUsers === -1
                            ? "(Unlimited users)"
                            : `(Max of ${subscriptionData.maxUsers} users)`}
                        </p>
                      </>
                    )}
                  </div>
                  <Link href="/admin/user-management">
                    <Button variant="outline" className="mt-4 w-full bg-transparent">
                      Manage Users
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="flex flex-col rounded-xl border-2 shadow-sm">
                <CardHeader className="bg-purple-700 text-white p-4 rounded-t-xl">
                  <CardTitle className="text-xl font-bold">Inventory</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    {loadingInventoryCount ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm text-gray-600">Loading...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-gray-900">{currentInventoryCount} sites</p>
                        <p className="text-sm text-gray-600">
                          {subscriptionData.maxProducts === -1
                            ? "(Unlimited sites)"
                            : `(Max of ${subscriptionData.maxProducts} sites)`}
                        </p>
                      </>
                    )}
                  </div>
                  <Link href="/admin/inventory">
                    <Button variant="outline" className="mt-4 w-full bg-transparent">
                      View Inventory
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Manage Your Subscription</h1>
          <p className="mt-3 text-lg text-gray-600">
            View your current plan or select a new one to fit your evolving needs.
          </p>
          <div className="mt-6">
            <Link href="/admin/subscriptions/choose-plan">
              <Button className="bg-primary text-white hover:bg-primary/90">
                Select or Upgrade Subscription <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
