"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { DomainSetupGuide } from "@/components/domain-setup-guide"

export default function DomainSetupPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => router.back()}
            className="text-black rounded-full p-3 hover:bg-gray-100"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">Email Domain Setup</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <DomainSetupGuide />
      </div>
    </div>
  )
}
