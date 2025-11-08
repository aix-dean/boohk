"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ServiceAssignmentsTable } from "@/components/service-assignments-table"
import { Plus, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { ServiceAssignmentSuccessDialog } from "@/components/service-assignment-success-dialog"

export default function ServiceAssignmentsPage() {
   const router = useRouter()
   const { userData } = useAuth()
   const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
   const [searchQuery, setSearchQuery] = useState("")
   const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)

   const [showServiceAssignmentSuccessDialog, setShowServiceAssignmentSuccessDialog] = useState(false)
   const [createdServiceAssignmentSaNumber, setCreatedServiceAssignmentSaNumber] = useState<string>("")

   useEffect(() => {
     // Check if we just created a service assignment
     const lastCreatedServiceAssignmentSaNumber = sessionStorage.getItem("lastCreatedServiceAssignmentSaNumber")
     if (lastCreatedServiceAssignmentSaNumber) {
       setCreatedServiceAssignmentSaNumber(lastCreatedServiceAssignmentSaNumber)
       setShowServiceAssignmentSuccessDialog(true)
       // Clear the session storage
       sessionStorage.removeItem("lastCreatedServiceAssignmentId")
       sessionStorage.removeItem("lastCreatedServiceAssignmentSaNumber")
     }
   }, [])

  const handleSelectAssignment = async (id: string) => {
    router.push(`/logistics/assignments/${id}`)
  }

  const handleCreateAssignment = () => {
    setIsCreatingAssignment(true)
    router.push("/logistics/assignments/create")

    // Reset loading state after a short delay to ensure smooth transition
    setTimeout(() => {
      setIsCreatingAssignment(false)
    }, 1000)
  }

  return (
    <div className="bg-neutral-50 min-h-screen">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Service Assignments</h1>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              onClick={handleCreateAssignment}
            >
              Create SA
            </Button>
            <Button
              variant="outline"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              History
            </Button>
          </div>
        </div>

        <div>
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search assignments..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-full w-80"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white rounded-[20px] p-8">
              <ServiceAssignmentsTable
                onSelectAssignment={handleSelectAssignment}
                searchQuery={searchQuery}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Service Assignment Success Dialog */}
      <ServiceAssignmentSuccessDialog
        open={showServiceAssignmentSuccessDialog}
        onOpenChange={setShowServiceAssignmentSuccessDialog}
        saNumber={createdServiceAssignmentSaNumber}
        onViewAssignments={() => router.push('/logistics/assignments')}
      />
    </div>
  )
}
