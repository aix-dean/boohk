"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"

export function useIsAdmin() {
  const { user, userData } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setIsAdmin(false)
      return
    }

    // Check if the user has admin role or permissions
    // This is a simple check - you'll need to adapt this to your actual role/permission structure
    const checkAdminStatus = async () => {
      try {
        // For now, let's assume any authenticated user can access the admin section
        // In a real app, you would check specific roles or permissions
        setIsAdmin(true)

        // If you have a userData.role field, you could use something like:
        // setIsAdmin(userData?.role === 'admin' || userData?.isAdmin === true)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminStatus()
  }, [user, userData])

  return { isAdmin, loading }
}
