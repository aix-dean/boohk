"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export default function UnauthorizedPage() {
  const { user, userData, logout } = useAuth()
  const router = useRouter()

  // Redirect to login if not logged in
  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("Error logging out:", error)
    }
  }

  const handleGoToHome = () => {
    // If user has roles, try to navigate to their dashboard
    if (userData?.roles && userData.roles.length > 0) {
      if (userData.roles.includes("admin")) {
        router.push("/sales/dashboard")
      } else if (userData.roles.includes("sales")) {
        router.push("/sales/dashboard")
      } else if (userData.roles.includes("logistics")) {
        router.push("/logistics/dashboard")
      } else if (userData.roles.includes("cms")) {
        router.push("/cms/dashboard")
      } else {
        // Fallback to account page if no specific dashboard
        router.push("/account")
      }
    } else {
      // If no roles, go to account page
      router.push("/account")
    }
  }

  if (!user || !userData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Access Denied</CardTitle>
          <CardDescription className="text-gray-600">You don't have permission to access this page.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Your account ({userData.email}) doesn't have the required role to access this resource.
            </p>
            <p className="text-sm text-gray-600">If you believe this is an error, please contact your administrator.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button onClick={handleGoToHome} className="w-full">
            Go to Home
          </Button>
          <Button onClick={handleLogout} variant="outline" className="w-full bg-transparent">
            Log Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
