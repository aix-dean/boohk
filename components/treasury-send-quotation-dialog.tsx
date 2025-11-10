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
import { useAuth } from "@/contexts/auth-context"
import type { Quotation } from "@/lib/types/quotation"
import { updateQuotationStatus } from "@/lib/quotation-service"

interface TreasurySendQuotationDialogProps {
  isOpen: boolean
  onClose: () => void
  quotation: Quotation | null
  requestorEmail: string
  onQuotationSent: (quotationId: string, newStatus: Quotation["status"]) => void
}

export function TreasurySendQuotationDialog({
  isOpen,
  onClose,
  quotation,
  requestorEmail,
  onQuotationSent,
}: TreasurySendQuotationDialogProps) {
  const { toast } = useToast()
  const { userData } = useAuth()
  const [isSending, setIsSending] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [ccEmail, setCcEmail] = useState("")
  const [replyToEmail, setReplyToEmail] = useState("")

  useEffect(() => {
    if (isOpen && quotation) {
      setSubject(`Treasury Quotation ${quotation.quotation_number} - OBoohk Operator`)
      setBody(
        `Dear ${quotation.client_name || "Valued Client"},\n\nPlease find your treasury quotation attached and linked below. You can accept or decline it directly via the links.\n\nBest regards,\nThe OBoohk Operator Treasury Team`,
      )
      if (userData?.email) {
        setReplyToEmail(userData.email)
      } else {
        setReplyToEmail("")
      }
      setCcEmail("") // Reset CC email when dialog opens
    }
  }, [isOpen, quotation, userData])

  const handleSendEmail = async () => {
    if (!quotation) {
      toast({
        title: "Error",
        description: "No quotation data available to send.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/quotations/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quotationId: quotation.id,
          toEmail: requestorEmail,
          subject,
          body,
          ccEmail,
          replyToEmail,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await updateQuotationStatus(quotation.id, "sent")
        onQuotationSent(quotation.id, "sent")
        onClose()
      } else {
        throw new Error(result.error || "Failed to send email")
      }
    } catch (error: any) {
      console.error("Error sending treasury quotation email:", error)
      toast({
        title: "Failed to Send Email",
        description: error.message || "An unexpected error occurred.",
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Treasury Quotation via Email</DialogTitle>
          <DialogDescription>
            Review the email details before sending the treasury quotation to{" "}
            <span className="font-semibold text-gray-900">{requestorEmail}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="to" className="text-right">
              To
            </Label>
            <Input id="to" value={requestorEmail} readOnly className="col-span-3" />
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
            <Input id="from" value="OBoohk Operator Treasury <noreply@resend.dev>" readOnly className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="replyTo" className="text-right">
              Reply-To
            </Label>
            <Input
              id="replyTo"
              value={replyToEmail}
              onChange={(e) => setReplyToEmail(e.target.value)}
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
              placeholder={`Treasury Quotation ${quotation?.quotation_number || ""} - OBoohk Operator`}
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
              placeholder="e.g., Dear [Client Name],\n\nPlease find your treasury quotation attached...\n\nBest regards,\nThe OBoohk Operator Treasury Team"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
              </>
            ) : (
              "Send Email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
