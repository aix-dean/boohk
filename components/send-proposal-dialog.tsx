"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Proposal } from "@/lib/types/proposal"
import { updateProposalStatus } from "@/lib/proposal-service"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { ProposalSentSuccessDialog } from "./proposal-sent-success-dialog"

interface SendProposalDialogProps {
  isOpen: boolean
  onClose: () => void
  proposal: Proposal
  onProposalSent: (proposalId: string, newStatus: Proposal["status"]) => void
}

export function SendProposalDialog({ isOpen, onClose, proposal, onProposalSent }: SendProposalDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const { userData } = useAuth()
  const [isSending, setIsSending] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [ccEmail, setCcEmail] = useState("")
  const [currentUserEmail, setCurrentUserEmail] = useState("")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSubject("")
      setBody("")
      if (userData?.email) {
        setCurrentUserEmail(userData.email)
      } else {
        setCurrentUserEmail("")
      }
    }
  }, [isOpen, proposal, userData])

  const handleSendProposal = async () => {
    setIsSending(true)
    try {
      const formData = new FormData()
      formData.append("proposal", JSON.stringify(proposal))
      formData.append("clientEmail", proposal.client.email)
      formData.append("subject", subject)
      formData.append("body", body)
      formData.append("currentUserEmail", currentUserEmail)
      formData.append("ccEmail", ccEmail)

      const response = await fetch("/api/proposals/send-email", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await updateProposalStatus(proposal.id, "sent")
        onProposalSent(proposal.id, "sent")
        onClose() // Close the send proposal dialog immediately
        setShowSuccessDialog(true) // Show the new success dialog
        // The router.push will now happen after the success dialog dismisses
      } else {
        throw new Error(result.error || "Failed to send email")
      }
    } catch (error: any) {
      console.error("Error sending proposal:", error)
      toast({
        title: "Failed to Send Proposal",
        description: error.message || "An unexpected error occurred.",
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  // Callback function to handle navigation after success dialog dismisses
  const handleSuccessDialogDismissAndNavigate = () => {
    setShowSuccessDialog(false) // Hide the success dialog
    router.push("/sales/dashboard") // Now navigate
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Send Proposal</DialogTitle>
            <DialogDescription>
              Review the email details before sending the proposal to{" "}
              <span className="font-semibold text-gray-900">{proposal.client.email}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">
                To
              </Label>
              <Input id="to" value={proposal.client.email} readOnly className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cc" className="text-right">
                CC
              </Label>
              <Input
                id="cc"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="Optional: comma-separated emails"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">
                From
              </Label>
              <Input id="from" value="OH Plus <noreply@resend.dev>" readOnly className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="replyTo" className="text-right">
                Reply-To
              </Label>
              <Input
                id="replyTo"
                value={currentUserEmail}
                onChange={(e) => setCurrentUserEmail(e.target.value)}
                placeholder="Your email"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                Subject
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Proposal for Your Advertising Campaign"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="body" className="text-right pt-2">
                Body
              </Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="col-span-3 min-h-[150px]"
                placeholder="e.g., Dear [Client Name],\n\nPlease find our proposal attached...\n\nBest regards,\nThe OH Plus Team"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSendProposal} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                "Send Proposal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProposalSentSuccessDialog
        isOpen={showSuccessDialog}
        onDismissAndNavigate={handleSuccessDialogDismissAndNavigate}
      />
    </>
  )
}
