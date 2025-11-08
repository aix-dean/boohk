"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Paperclip, Send, Plus, Smile, X, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { emailService, type EmailTemplate } from "@/lib/email-service"
import { getReportsLegacy as getReports, type ReportData } from "@/lib/report-service"
import { getProductById, type Product } from "@/lib/firebase-service"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileAttachment {
  file: File
  fileName: string
  fileSize: number
  fileType: string
}

export default function ComposeEmailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reportId = params.id as string
  const [report, setReport] = useState<ReportData | null>(null)
  const [product, setProduct] = useState<Product | null>(null)

  // Email form state
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")

  useEffect(() => {
    if (reportId && user) {
      fetchData()
    }
  }, [reportId, user])

  const fetchData = async () => {
    try {
      setDebugInfo("Loading report data...")

      // Fetch report data
      const reports = await getReports()
      const foundReport = reports.find((r) => r.id === reportId)

      if (foundReport) {
        setReport(foundReport)
        setDebugInfo(`Report found: ${foundReport.siteName}`)

        // Fetch product data
        if (foundReport.siteId) {
          try {
            const productData = await getProductById(foundReport.siteId)
            setProduct(productData)
            setDebugInfo((prev) => prev + ` | Product: ${productData?.name || "Not found"}`)
          } catch (error) {
            console.log("Product not found, continuing without product data")
            setDebugInfo((prev) => prev + " | Product: Not found")
          }
        }

        // Set default subject
        setSubject(`${getReportTypeDisplay(foundReport.reportType)} - ${foundReport.siteName}`)

        // Set default body
        setBody(`Hi [Customer's Name],

I hope you're doing well.

Attached is the ${getReportTypeDisplay(foundReport.reportType).toLowerCase()} for ${foundReport.siteName}. We've prepared a comprehensive analysis based on your requirements and current project status.

Please feel free to review and let me know if you have any questions or would like to explore additional options. I'm happy to assist.

Looking forward to your feedback!

Best regards,
[Your Full Name]
[Your Position]
[Company Name]
[Contact Info]`)
      } else {
        setDebugInfo("Report not found!")
      }

      // Fetch email templates
      if (user?.uid) {
        const userTemplates = await emailService.getEmailTemplates(user.uid)
        if (userTemplates.length === 0) {
          // Create default templates if none exist
          await emailService.createDefaultTemplates(user.uid)
          const newTemplates = await emailService.getEmailTemplates(user.uid)
          setTemplates(newTemplates)
        } else {
          setTemplates(userTemplates)
        }
        setDebugInfo((prev) => prev + ` | Templates: ${userTemplates.length}`)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setDebugInfo(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      toast({
        title: "Error",
        description: "Failed to load email compose data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddAttachment = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newAttachments: FileAttachment[] = []

    Array.from(files).forEach((file) => {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 10MB and cannot be attached.`,
          variant: "destructive",
        })
        return
      }

      const attachment: FileAttachment = {
        file: file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
      }

      newAttachments.push(attachment)
    })

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments])
      toast({
        title: "Files Attached",
        description: `${newAttachments.length} file(s) have been attached to your email.`,
      })
      setDebugInfo((prev) => prev + ` | Files attached: ${newAttachments.length}`)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const getReportTypeDisplay = (type: string) => {
    return type
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template.id || null)
    setSubject(template.subject)
    setBody(template.body)
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSendEmail = async () => {
    if (!user?.uid || !to.trim() || !subject.trim() || !body.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (To, Subject, Body).",
        variant: "destructive",
      })
      return
    }

    // Validate email addresses
    const toEmails = to
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email)

    const invalidToEmails = toEmails.filter((email) => !validateEmail(email))
    if (invalidToEmails.length > 0) {
      toast({
        title: "Invalid Email",
        description: `Invalid email addresses: ${invalidToEmails.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    const ccEmails = cc
      ? cc
          .split(",")
          .map((email) => email.trim())
          .filter((email) => email)
      : []

    const invalidCcEmails = ccEmails.filter((email) => !validateEmail(email))
    if (invalidCcEmails.length > 0) {
      toast({
        title: "Invalid CC Email",
        description: `Invalid CC email addresses: ${invalidCcEmails.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setSending(true)
    setDebugInfo((prev) => prev + " | Creating email record...")

    try {
      // Create FormData for file upload
      const formData = new FormData()

      // Add email data
      formData.append("from", "noreply@resend.dev")
      formData.append("to", JSON.stringify(toEmails))
      formData.append("subject", subject)
      formData.append("body", body)
      formData.append("userId", user.uid)

      if (ccEmails.length > 0) {
        formData.append("cc", JSON.stringify(ccEmails))
      }
      if (selectedTemplate) {
        formData.append("templateId", selectedTemplate)
      }
      if (reportId) {
        formData.append("reportId", reportId)
      }

      // Add file attachments
      attachments.forEach((attachment, index) => {
        formData.append(`attachment_${index}`, attachment.file)
      })

      setDebugInfo((prev) => prev + " | Sending email with attachments...")

      // Send email directly via API route with FormData
      const response = await fetch("/api/send-email", {
        method: "POST",
        body: formData, // Send FormData directly (no Content-Type header needed)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send email")
      }

      setDebugInfo((prev) => prev + " | Email sent successfully!")

      toast({
        title: "Email Sent!",
        description: `Your email has been sent successfully to ${toEmails.join(", ")}.`,
      })

      // Navigate back to preview
      router.push(`/logistics/reports/preview`)
    } catch (error) {
      console.error("Error sending email:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to send email. Please try again."
      setDebugInfo((prev) => prev + ` | Send Error: ${errorMessage}`)

      toast({
        title: "Send Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading compose email...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="*/*" onChange={handleFileSelect} className="hidden" />

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
          <h1 className="text-xl font-semibold">Compose Email</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Debug Info */}
        {debugInfo && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs font-mono">Debug: {debugInfo}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email Compose Form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                {/* To Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To: <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="recipient@example.com, another@example.com"
                    className="w-full"
                  />
                </div>

                {/* CC Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cc:</label>
                  <Input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="w-full"
                  />
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject: <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="w-full"
                  />
                </div>

                {/* Body Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message: <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full min-h-[300px] resize-none"
                  />
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attachments:</label>
                    <div className="space-y-2">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                          <Paperclip className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-blue-600 flex-1">{attachment.fileName}</span>
                          <span className="text-xs text-gray-500">
                            {(attachment.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 bg-transparent"
                    onClick={handleAddAttachment}
                  >
                    <Paperclip className="h-4 w-4" />
                    +Add Attachment
                  </Button>

                  <Button
                    onClick={handleSendEmail}
                    disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Templates Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Templates:</h3>
                </div>

                <div className="space-y-2">
                  {templates.map((template, index) => (
                    <div key={template.id} className="flex items-center gap-2">
                      <Button
                        variant={selectedTemplate === template.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTemplateSelect(template)}
                        className="flex-1 justify-start text-left"
                      >
                        {template.name}
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-full bg-yellow-100 text-yellow-600"
                        >
                          <Smile className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-full bg-blue-100 text-blue-600"
                        >
                          <Smile className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 rounded-full bg-green-100 text-green-600"
                        >
                          <Smile className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Separator className="my-3" />

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 bg-transparent"
                  >
                    <Plus className="h-4 w-4" />
                    +Add Template
                    <div className="ml-auto">
                      <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Smile className="h-3 w-3 text-yellow-600" />
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Report Info */}
            {report && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Report Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {getReportTypeDisplay(report.reportType)}
                    </div>
                    <div>
                      <span className="font-medium">Site:</span> {report.siteName}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span> {new Date(report.date).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{" "}
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        {report.completionPercentage || 100}% Complete
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Domain Notice */}
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="text-sm text-yellow-800">
                  <strong>Note:</strong> Emails are sent from noreply@resend.dev. This is Resend's default testing
                  domain.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
