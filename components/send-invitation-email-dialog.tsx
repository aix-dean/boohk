"use client"

import type React from "react"

import { useState } from "react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, Mail, Send } from "lucide-react"
import type { Timestamp } from "firebase/firestore"

interface SendInvitationEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: {
    id: string
    code: string
    createdAt: Timestamp
    expiresAt: Timestamp
    usageLimit: number
    usageCount: number
    role: string
    permissions: string[]
    status: "active" | "inactive" | "expired"
    createdBy: string
    companyId: string
    usedBy?: string[]
    description?: string
  }
}

export function SendInvitationEmailDialog({ open, onOpenChange, code }: SendInvitationEmailDialogProps) {
  const { userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    recipientEmail: "",
    recipientName: "",
    subject: `Invitation to join ${userData?.companyName || "our organization"}`,
    message: `You've been invited to join our organization. Use the invitation code below to register your account.`,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const registrationUrl = `${window.location.origin}/register?orgCode=${code.code}`

      const response = await fetch("/api/invitations/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: formData.recipientEmail,
          recipientName: formData.recipientName,
          subject: formData.subject,
          message: formData.message,
          invitationCode: code.code,
          registrationUrl,
          senderName: userData?.displayName || userData?.email,
          companyName: userData?.companyName,
          role: code.role,
          expiresAt: code.expiresAt.toDate().toLocaleDateString(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send email")
      }

      toast.success("Invitation email sent successfully")

      // Reset form
      setFormData({
        recipientEmail: "",
        recipientName: "",
        subject: `Invitation to join ${userData?.companyName || "our organization"}`,
        message: `You've been invited to join our organization. Use the invitation code below to register your account.`,
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error sending email:", error)
      toast.error("Failed to send invitation email")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Send Invitation Email</span>
          </DialogTitle>
          <DialogDescription>Send an invitation email with the registration code to a new user</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invitation Code Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Code:</span>
                  <code className="ml-2 bg-muted px-2 py-1 rounded font-mono">{code.code}</code>
                </div>
                <div>
                  <span className="font-medium">Role:</span>
                  <Badge variant="outline" className="ml-2">
                    {code.role}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Expires:</span>
                  <span className="ml-2">{formatDate(code.expiresAt)}</span>
                </div>
                <div>
                  <span className="font-medium">Usage:</span>
                  <span className="ml-2">
                    {code.usageCount}/{code.usageLimit === 0 ? "∞" : code.usageLimit}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recipient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Email Address *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={formData.recipientEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                  placeholder="recipient@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientName">Full Name</Label>
                <Input
                  id="recipientName"
                  type="text"
                  value={formData.recipientName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, recipientName: e.target.value }))}
                  placeholder="John Doe"
                />
                <p className="text-xs text-muted-foreground">Optional - used for personalization</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Personal Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Add a personal message to the invitation..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be included in the email along with the invitation code and registration
                  instructions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Preview</CardTitle>
              <CardDescription>This is how the email will appear to the recipient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
                <div className="border-b pb-2">
                  <div className="text-sm text-muted-foreground">
                    To: {formData.recipientEmail || "recipient@example.com"}
                  </div>
                  <div className="text-sm text-muted-foreground">From: {userData?.email}</div>
                  <div className="font-medium">{formData.subject}</div>
                </div>

                <div className="space-y-3 text-sm">
                  <p>Hello {formData.recipientName || "there"},</p>

                  <p>{formData.message}</p>

                  <div className="bg-white p-3 rounded border">
                    <p className="font-medium">Your invitation code:</p>
                    <code className="text-lg font-mono bg-gray-100 px-2 py-1 rounded">{code.code}</code>
                  </div>

                  <p>
                    <strong>Role:</strong> {code.role}
                    <br />
                    <strong>Valid until:</strong> {formatDate(code.expiresAt)}
                  </p>

                  <p>
                    Click the link below to register your account:
                    <br />
                    <span className="text-blue-600 underline">
                      {window.location.origin}/register?orgCode={code.code}
                    </span>
                  </p>

                  <p>
                    Best regards,
                    <br />
                    {userData?.displayName || userData?.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
