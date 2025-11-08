"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowLeft, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getSentEmailsForCompany } from "@/lib/report-service"
import { searchEmails } from "@/lib/algolia-service"
import { useAuth } from "@/contexts/auth-context"
import { format } from "date-fns"
import { SentHistoryDialog } from "@/components/sent-history-dialog"

interface EmailRecord {
  id: string
  sentAt: Date
  subject: string
  to: string[]
  cc?: string[]
  body: string
  attachments: any[]
}

export default function SentHistoryPage() {
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null)

  const router = useRouter()
  const { userData } = useAuth()

  useEffect(() => {
    if (userData?.company_id) {
      performSearch()
    }
  }, [userData?.company_id])

  useEffect(() => {
    performSearch()
  }, [searchQuery])

  const performSearch = async () => {
    if (!userData?.company_id) return

    setLoading(true)
    try {
      const filters = `company_id:${userData.company_id} AND email_type:report`
      const searchResponse = await searchEmails(searchQuery, userData.company_id, 0, 10, filters)
      if (searchResponse.error) {
        console.error("Search error:", searchResponse.error)
        setEmails([])
      } else {
        // Map Algolia results to EmailRecord format
        const emailRecords: EmailRecord[] = searchResponse.hits.map(hit => ({
          id: (hit as any).id,
          sentAt: new Date((hit as any).sentAt), // Assuming sentAt is ISO string
          subject: (hit as any).subject,
          to: Array.isArray((hit as any).to) ? (hit as any).to : [(hit as any).to], // Ensure array
          cc: (hit as any).cc ? (Array.isArray((hit as any).cc) ? (hit as any).cc : [(hit as any).cc]) : undefined,
          body: (hit as any).body,
          attachments: (hit as any).attachments || []
        }))
        setEmails(emailRecords)
      }
    } catch (error) {
      console.error("Error searching emails:", error)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center text-gray-700 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span className="text-lg font-semibold">Sent History</span>
        </button>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 opacity-30" />
          <Input
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-[257px] h-[30px] rounded-[15px]"
          />
        </div>

        {/* Emails List */}
        <div className="bg-white rounded-tl-[10px] rounded-tr-[10px] overflow-hidden">
          {/* Table Headers */}
          <div className="px-6 pt-4 hidden sm:block">
            <div className="grid grid-cols-4 pb-4 border-b border-gray-300 gap-4 text-xs font-semibold text-gray-900">
              <div>Date Sent</div>
              <div>Time</div>
              <div>Subject</div>
              <div>To</div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading sent history...</span>
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              {searchQuery ? "No emails found matching your search" : "No sent emails found"}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {emails.map((email, index) => (
                <div
                  key={`${email.id}-${index}`}
                  className="bg-[#f6f9ff] border-2 border-[#b8d9ff] rounded-[10px] p-4 hover:bg-[#e8f0ff] transition-colors cursor-pointer"
                  onClick={() => { setSelectedEmail(email); setDialogOpen(true); }}
                >
                  <div className="grid grid-cols-4 gap-4 items-center text-sm">
                    <div className="text-gray-900">
                      {format(email.sentAt, "MMM d, yyyy")}
                    </div>
                    <div className="text-gray-900">
                      {format(email.sentAt, "h:mm a")}
                    </div>
                    <div className="text-gray-900 truncate" title={email.subject}>
                      {email.subject}
                    </div>
                    <div className="text-gray-900 truncate" title={email.to.join(", ")}>
                      {email.to.join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SentHistoryDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedEmail(null); }}
        emailToShow={selectedEmail || undefined}
      />
    </div>
  )
}