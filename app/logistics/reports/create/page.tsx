"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { CreateReportDialog } from "@/components/create-report-dialog"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function CreateReportPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const assignmentId = searchParams.get("assignment")

  const [assignmentData, setAssignmentData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (assignmentId) {
      fetchAssignmentData()
    } else {
      setError("No assignment ID provided")
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    // Open dialog once assignment data is loaded
    if (assignmentData && !loading && !error) {
      setIsDialogOpen(true)
    }
  }, [assignmentData, loading, error])

  const fetchAssignmentData = async () => {
    if (!assignmentId) return

    try {
      setLoading(true)
      setError(null)

      const assignmentDoc = await getDoc(doc(db, "service_assignments", assignmentId))

      if (assignmentDoc.exists()) {
        const data = { id: assignmentDoc.id, ...assignmentDoc.data() }
        setAssignmentData(data)
      } else {
        setError("Assignment not found")
      }
    } catch (err) {
      console.error("Error fetching assignment:", err)
      setError("Failed to load assignment data")
    } finally {
      setLoading(false)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    // Navigate back to assignments page
    router.push("/logistics/assignments")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading assignment data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">{error}</p>
          <button
            onClick={() => router.push("/logistics/assignments")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Assignments
          </button>
        </div>
      </div>
    )
  }

  if (!assignmentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No assignment data available</p>
          <button
            onClick={() => router.push("/logistics/assignments")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Assignments
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Create Report Dialog */}
      <CreateReportDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        siteId={assignmentData.projectSiteId}
        module="logistics"
        hideJobOrderSelection={false}
      />

      {/* This handles the case where dialog is closed */}
      {!isDialogOpen && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Report creation cancelled</p>
            <button
              onClick={() => router.push("/logistics/assignments")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Assignments
            </button>
          </div>
        </div>
      )}
    </div>
  )
}