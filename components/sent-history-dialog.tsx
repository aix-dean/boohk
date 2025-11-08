"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import { ArrowLeft, X } from "lucide-react"
import { emailService } from "@/lib/email-service"

interface SentHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId?: string
  reportId?: string
  companyId?: string
  emailType?: "proposal" | "cost_estimate" | "quotation" | "report"
  emailToShow?: EmailRecord
}

interface EmailRecord {
  id: string
  created: Date
  subject: string
  to: string[]
  cc?: string[]
  body: string
  attachments: any[]
  from?: string
}

export function SentHistoryDialog({ open, onOpenChange, proposalId, reportId, companyId, emailType, emailToShow }: SentHistoryDialogProps) {
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null)
  const [currentView, setCurrentView] = useState<'list' | 'detail'>('list')
  const [fileViewerOpen, setFileViewerOpen] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null)

  useEffect(() => {
    if (open && emailToShow) {
      setSelectedEmail(emailToShow)
      setCurrentView('detail')
    } else if (open && (proposalId || reportId)) {
      // Fetch emails for the specific item
      fetchEmails()
      setCurrentView('list')
    }
  }, [open, emailToShow, proposalId, reportId])

  useEffect(() => {
    if (!open) {
      setEmails([])
      setSelectedEmail(null)
      setCurrentView('list')
      setLoading(false)
    }
  }, [open])

  const fetchEmails = async () => {
    if (!companyId) return

    setLoading(true)
    try {
      const firebaseEmails = await emailService.getEmailsByFilters(companyId, reportId, emailType)
      // Map Firebase results to EmailRecord format
      const emailRecords: EmailRecord[] = firebaseEmails.map(email => ({
        id: email.id || '',
        created: email.created ? email.created.toDate() : new Date(),
        subject: email.subject,
        to: email.to,
        cc: email.cc,
        body: email.body,
        attachments: email.attachments || []
      }))
      setEmails(emailRecords)
    } catch (error) {
      console.error("Error fetching emails:", error)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }


  const handleAttachmentClick = (attachment: any) => {
    setSelectedAttachment(attachment)
    setFileViewerOpen(true)
  }

  const handleCloseFileViewer = () => {
    setFileViewerOpen(false)
    setSelectedAttachment(null)
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only p-0 gap-0 m-0">Email</DialogTitle>
      <DialogContent className="w-[900px] min-h-[500px] max-h-[500px] flex flex-col bg-white rounded-md p-0 border-0 shadow-xl">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-2">
          <button
            onClick={() => {
              if (currentView === 'detail') {
                setCurrentView('list')
                setSelectedEmail(null)
              } else {
                onOpenChange(false)
              }
            }}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-bold">
              Email
            </span>
          </button>

          <button
            onClick={() => onOpenChange(false)}
            className="hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 text-sm text-gray-800 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading sent history...</span>
            </div>
          ) : currentView === 'list' ? (
            <>
              {/* Table Headers */}
              <div className="bg-white pb-4 border-b border-gray-300">
                <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-gray-900">
                  <div>Date</div>
                  <div>Time</div>
                  <div>Subject</div>
                  <div>To</div>
                </div>
              </div>

              {emails.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No emails found for this report.
                </div>
              ) : (
                <div className="space-y-3 pt-4">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      className="bg-[#f6f9ff] border-2 border-[#b8d9ff] rounded-[10px] p-4 cursor-pointer hover:bg-[#e8f0ff] transition-colors"
                      onClick={() => {
                        setSelectedEmail(email)
                        setCurrentView('detail')
                      }}
                    >
                      <div className="grid grid-cols-4 gap-4 items-center text-xs">
                        <div className="text-gray-900">
                          {format(email.created, 'MMM d, yyyy')}
                        </div>
                        <div className="text-gray-900">
                          {format(email.created, 'h:mm a')}
                        </div>
                        <div className="text-gray-900 truncate" title={email.subject}>
                          {email.subject}
                        </div>
                        <div className="text-gray-900 truncate" title={email.to.join(', ')}>
                          {email.to.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : selectedEmail ? (
            <>
              {/* Metadata grid */}
              <div className="flex gap-8">
                {/* Labels */}
                <div className="font-bold text-gray-800 space-y-2">
                  <div className="text-xs font-semibold">Date:</div>
                  <div className="text-xs font-semibold">To:</div>
                  <div className="text-xs font-semibold">Cc:</div>
                  <div className="text-xs font-semibold">Subject:</div>
                  <div className="text-xs font-semibold">Message:</div>
                </div>
                {/* Values */}
                <div className="text-gray-800 text-xs space-y-2">
                  <div>{format(selectedEmail.created, 'MMM d, yyyy')}</div>
                  <div className="break-words">{selectedEmail.to.join(', ')}</div>
                  <div className="break-words">
                    {selectedEmail.cc?.join(', ') || 'N/A'}
                  </div>
                  <div>{selectedEmail.subject}</div>
                  <div className="whitespace-pre-line">{selectedEmail.body}</div>
                </div>
              </div>

              {/* Attachments */}
              {selectedEmail.attachments?.length > 0 && (
                <div className="mb-4 mt-2">
                  <div className="flex items-start gap-2">
                    <div className="font-semibold text-xs text-gray-800">Attachments:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((attachment, index) => (
                        <button
                          key={index}
                          onClick={() => handleAttachmentClick(attachment)}
                          className="text-blue-600 hover:text-blue-800 underline text-sm bg-transparent text-xs font-semibold border-none cursor-pointer p-0"
                        >
                          {attachment.fileName}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No email selected.
            </div>
          )}
        </div>
      </DialogContent>

      {/* File Viewer Dialog */}
      <Dialog open={fileViewerOpen} onOpenChange={setFileViewerOpen}>
        <DialogContent className="w-[900px] min-h-[60vh] max-h-[95vh] bg-white rounded-md p-0 border-0 shadow-xl">
          <DialogTitle className="sr-only">File Viewer</DialogTitle>
          <div className="relative h-full">
            <button
              onClick={handleCloseFileViewer}
              className="absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close file viewer"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            <div className="p-6 h-full">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                {selectedAttachment?.fileName || 'File Viewer'}
              </h2>
              <iframe
                src={selectedAttachment?.fileUrl}
                className="w-full h-[calc(100%-2rem)] border rounded-md"
                title={selectedAttachment?.fileName || 'File Viewer'}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}