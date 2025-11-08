"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RedirectToUpload() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/sales/product/upload")
  }, [router])

  return null
}
