"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { FileText, MoreVertical, Printer, Send } from "lucide-react"
import type { FinanceRequest } from "@/lib/types/finance-request"
import { generateReplenishRequestPDF } from "@/lib/replenish-pdf"

type Props = {
  request: FinanceRequest
}

function base64ToPdfBlob(base64: string): Blob {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: "application/pdf" })
}

export default function ReplenishReportActions({ request }: Props) {
  const { toast } = useToast()
  const [openSend, setOpenSend] = useState(false)
  const [sending, setSending] = useState(false)

  const subjectDefault = useMemo(
    () => `Replenishment Request Report - #${String(request["Request No."] ?? request.id)}`,
    [request],
  )
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState(subjectDefault)
  const [message, setMessage] = useState(
    `Hello,\n\nPlease find attached the replenishment request report for Request #${String(request["Request No."] ?? request.id)}.\n\nThank you.`,
  )

  const handlePrint = async () => {
    try {
      const base64 = await generateReplenishRequestPDF(request as any, { returnBase64: true })
      if (!base64) throw new Error("PDF generation failed")
      const blob = base64ToPdfBlob(base64)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      console.error(err)
      toast({
        title: "Unable to print",
        description: "We couldn't generate the PDF for printing.",
        variant: "destructive",
      })
    }
  }

  const handleSend = async () => {
    const recipients = to
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
    if (recipients.length === 0) {
      toast({ title: "Missing recipient", description: "Add at least one email.", variant: "destructive" })
      return
    }

    try {
      setSending(true)
      const base64 = await generateReplenishRequestPDF(request as any, { returnBase64: true })
      if (!base64) throw new Error("PDF generation failed")

      const blob = base64ToPdfBlob(base64)
      const file = new File([blob], `replenish-request-${String(request["Request No."] ?? request.id)}.pdf`, {
        type: "application/pdf",
      })

      const form = new FormData()
      form.append("to", JSON.stringify(recipients))
      const ccList = cc
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
      if (ccList.length) form.append("cc", JSON.stringify(ccList))
      form.append("subject", subject)
      form.append("body", message)
      form.append("attachment_0", file)

      const res = await fetch("/api/send-email", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Email send failed")
      }

      toast({ title: "Report sent", description: "The PDF report has been emailed successfully." })
      setOpenSend(false)
    } catch (err: any) {
      console.error(err)
      toast({ title: "Failed to send", description: err?.message || "Unknown error.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Replenishment report actions">
            <MoreVertical className="h-4 w-4 mr-2" />
            Report
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Replenish
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenSend(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Report
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openSend} onOpenChange={setOpenSend}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Replenishment Report</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label htmlFor="to" className="text-sm text-muted-foreground">
                To (comma separated)
              </label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@example.com, other@example.com"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="cc" className="text-sm text-muted-foreground">
                CC (optional, comma separated)
              </label>
              <Input id="cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc1@example.com" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="subject" className="text-sm text-muted-foreground">
                Subject
              </label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label htmlFor="message" className="text-sm text-muted-foreground">
                Message
              </label>
              <Textarea id="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSend(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
