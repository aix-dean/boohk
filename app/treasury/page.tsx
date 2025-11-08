"use client"

import { useEffect } from "react"
import { redirect } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export default function TreasuryPage() {
    const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      if (user) {
        redirect("/treasury/dashboard")
      } else {
        redirect("/login")
      }
    }
  }, [user, loading])

  return null

}