"use client"

import type React from "react"
import { use } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore"
import { useAuth } from "@/contexts/auth-context"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Paperclip, X, Copy, Edit, Trash2, Upload, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { ReportData } from "@/lib/report-service"
import { getReportById } from "@/lib/report-service"
import { getClientById, type Client } from "@/lib/client-service"
import { emailService, type EmailTemplate } from "@/lib/email-service"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface ComposeEmailPageProps {
  params: Promise<{
    id: string
  }>
}

interface Attachment {
  name: string
  size: string
  type: string
  file?: File
  url?: string
}

interface ReportEmailTemplate extends EmailTemplate {
  template_type: "proposal" | "quotation" | "CE" | "report"
}

export default function AdminComposeEmailPage({ params }: ComposeEmailPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { user, userData } = useAuth()
  const [report, setReport] = useState<ReportData | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [emailData, setEmailData] = useState({
    to: "",
    cc: "",
    subject: "",
    message: `Hi AAA,

I hope you're doing well!

Please find attached the report for your project. The report includes the site details and project status based on our recent work.

If you have any questions or would like to discuss the findings, feel free to reach out to us. I'll be happy to assist you further.

Best regards,
Admin Executive
Admin Executive
Boohk
+639XXXXXXXXX`,
  })

  const [attachments, setAttachments] = useState<Attachment[]>([])

  const [templates, setTemplates] = useState<ReportEmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportEmailTemplate | null>(null)
  const [editTemplateData, setEditTemplateData] = useState({
    name: "",
    subject: "",
    body: "",
  })

  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  const fetchReportTemplates = async () => {
    if (!user?.uid) return

    try {
      setTemplatesLoading(true)

      const templatesRef = collection(db, "email_templates")
      const q = query(
        templatesRef,
        where("userId", "==", user.uid),
        where("template_type", "==", "report"),
        orderBy("created", "desc"),
      )

      const querySnapshot = await getDocs(q)
      const reportTemplates: ReportEmailTemplate[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        reportTemplates.push({
          id: doc.id,
          name: data.name,
          subject: data.subject,
          body: data.body,
          userId: data.userId,
          created: data.created,
          template_type: data.template_type || "report",
        })
      })

      if (reportTemplates.length === 0) {
        await createDefaultReportTemplates()
        const newQuerySnapshot = await getDocs(q)
        newQuerySnapshot.forEach((doc) => {
          const data = doc.data()
          reportTemplates.push({
            id: doc.id,
            name: data.name,
            subject: data.subject,
            body: data.body,
            userId: data.userId,
            created: data.created,
            template_type: data.template_type || "report",
          })
        })
      }

      setTemplates(reportTemplates)
    } catch (error) {
      console.error("Error fetching report templates:", error)
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      })
    } finally {
      setTemplatesLoading(false)
    }
  }

  const createDefaultReportTemplates = async () => {
    if (!user?.uid) return

    const defaultReportTemplates = [
      {
        name: "Standard Report",
        subject: "Report: [Project Name] - [Company Name]",
        body: `Dear [Client Name],

I hope this email finds you well.

Please find attached our detailed report for your project. We've completed the assessment and compiled all findings in the attached document.

The report includes:
- Detailed project assessment
- Current status and progress
- Key findings and recommendations
- Next steps and timeline

We're committed to delivering high-quality results and are available to discuss the report findings in detail.

Please review the attached report and feel free to reach out if you have any questions or would like to discuss any aspects in detail.

Looking forward to your feedback!

Best regards,
[Your Name]
[Your Position]
Boohk
[Contact Information]`,
        userId: user.uid,
        template_type: "report" as const,
      },
      {
        name: "Follow-up Report",
        subject: "Follow-up: Report for [Project Name]",
        body: `Dear [Client Name],

I wanted to follow up on the report we sent for [Project Name].

I hope you've had a chance to review the attached report. We're very interested in your feedback and are available to discuss the findings in detail.

If you have any questions about our assessment, recommendations, or next steps, I'd be happy to schedule a call to discuss them in detail.

We're also available to provide additional support or clarification as needed.

Please let me know your thoughts or if you need any additional information.

Best regards,
[Your Name]
[Your Position]
Boohk
[Contact Information]`,
        userId: user.uid,
        template_type: "report" as const,
      },
    ]

    try {
      for (const template of defaultReportTemplates) {
        await addDoc(collection(db, "email_templates"), {
          ...template,
          created: serverTimestamp(),
        })
      }
    } catch (error) {
      console.error("Error creating default report templates:", error)
    }
  }

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportData = await getReportById(resolvedParams.id)

        if (!reportData) {
          throw new Error("Report not found")
        }

        setReport(reportData)

        // Fetch client data if clientId exists
        if (reportData.clientId) {
          const clientData = await getClientById(reportData.clientId)
          if (clientData) {
            setClient(clientData)
            setEmailData((prev) => ({
              ...prev,
              to: clientData.email,
              cc: "",
              subject: `Report: ${reportData.siteName} - ${clientData.company} - Boohk`,
            }))
          }
        }

        await generateReportPDFs(reportData)
      } catch (error) {
        console.error("Error fetching report:", error)
        toast({
          title: "Error",
          description: "Failed to load report data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [resolvedParams.id, toast])

  useEffect(() => {
    if (user?.uid) {
      fetchReportTemplates()
    }
  }, [user?.uid])

  // Auto-redirect to dashboard after showing success dialog
  useEffect(() => {
    if (successDialogOpen) {
      const timer = setTimeout(() => {
        router.push("/sales/dashboard")
      }, 3000) // 3 seconds delay

      return () => clearTimeout(timer)
    }
  }, [successDialogOpen, router])

  const generateReportPDFs = async (reportData: ReportData) => {
    try {
      // For now, create a placeholder attachment since we don't have a report PDF generation API yet
      const fileName = `OH_PLUS_REPORT_${reportData.siteCode || reportData.siteId}.pdf`
      const placeholderPDFs: Attachment[] = [
        {
          name: fileName,
          size: "2.3 MB",
          type: "report",
          url: `https://ohplus.ph/api/admin/reports/${reportData.id}/pdf`,
        },
      ]

      setAttachments(placeholderPDFs)
    } catch (error) {
      console.error("Error generating report PDFs:", error)
      const fallbackFileName = `OH_PLUS_REPORT_${reportData.siteCode || reportData.siteId}.pdf`
      const fallbackPDFs: Attachment[] = [
        {
          name: fallbackFileName,
          size: "2.3 MB",
          type: "report",
          url: `https://ohplus.ph/api/admin/reports/${reportData.id}/pdf`,
        },
      ]
      setAttachments(fallbackPDFs)

      toast({
        title: "Warning",
        description: "Could not generate report PDF. Using fallback attachment.",
        variant: "destructive",
      })
    }
  }

  const handleBack = () => {
    router.back()
  }

  const handleSendEmail = async () => {
    if (!emailData.to.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      })
      return
    }

    if (!emailData.subject.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an email subject.",
        variant: "destructive",
      })
      return
    }

    setSending(true)

    try {
      const formData = new FormData()

      const toEmails = emailData.to
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email)
      const ccEmails = emailData.cc
        ? emailData.cc
            .split(",")
            .map((email) => email.trim())
            .filter((email) => email)
        : []

      formData.append("to", JSON.stringify(toEmails))
      if (ccEmails.length > 0) {
        formData.append("cc", JSON.stringify(ccEmails))
      }
      formData.append("subject", emailData.subject)
      formData.append("body", emailData.message)
      if (userData?.phone_number) {
        formData.append("currentUserPhoneNumber", userData.phone_number)
      }

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i]
        try {
          if (attachment.file) {
            formData.append(`attachment_${i}`, attachment.file)
          } else if (attachment.url && attachment.type === "report") {
            const pdfResponse = await fetch(attachment.url)
            if (pdfResponse.ok) {
              const pdfBlob = await pdfResponse.blob()
              const pdfFile = new File([pdfBlob], attachment.name, { type: "application/pdf" })
              formData.append(`attachment_${i}`, pdfFile)
            }
          }
        } catch (error) {
          console.error(`Error processing attachment ${attachment.name}:`, error)
        }
      }

      const response = await fetch("/api/send-email", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email")
      }

      try {
        const emailRecord = {
          body: emailData.message,
          created: serverTimestamp(),
          from: user?.email || "noreply@ohplus.ph",
          reportId: resolvedParams.id,
          sentAt: serverTimestamp(),
          status: "sent",
          subject: emailData.subject,
          to: toEmails,
          cc: ccEmails.length > 0 ? ccEmails : null,
          updated: serverTimestamp(),
          userId: user?.uid || null,
          email_type: "report",
          attachments: attachments.map((att) => ({
            fileName: att.name,
            fileSize: att.file?.size || 0,
            fileType: att.file?.type || "application/pdf",
            fileUrl: att.url || null,
          })),
        }

        await addDoc(collection(db, "emails"), emailRecord)
        console.log("Email record saved successfully")
      } catch (emailRecordError) {
        console.error("Error saving email record:", emailRecordError)
      }

      // Show success dialog instead of toast
      setSuccessDialogOpen(true)
    } catch (error) {
      console.error("Email sending error:", error)
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Could not send the email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleTemplateAction = (templateId: string, action: "copy" | "edit" | "delete") => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return

    console.log(`handleTemplateAction called with templateId: ${templateId}, action: ${action}`); // Debug log

    switch (action) {
      case "copy":
        setEmailData((prev) => ({
          ...prev,
          subject: template.subject,
          message: template.body,
        }))
        toast({
          title: "Template applied",
          description: `${template.name} has been applied to your email.`,
        })
        break
      case "edit":
        setEditingTemplate(template)
        setEditTemplateData({
          name: template.name,
          subject: template.subject,
          body: template.body,
        })
        setEditDialogOpen(true)
        break
      case "delete":
        handleDeleteTemplate(templateId)
        break
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await emailService.deleteEmailTemplate(templateId)
      await fetchReportTemplates()
      toast({
        title: "Template deleted",
        description: "The template has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting template:", error)
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      })
    }
  }

  const handleAddTemplate = async () => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "You must be logged in to create templates",
        variant: "destructive",
      })
      return
    }

    try {
      const templateName = `Report Template ${templates.length + 1}`
      const newTemplate = {
        name: templateName,
        subject: "New Report Template",
        body: "Enter your report template content here...",
        userId: user.uid,
        template_type: "report" as const,
      }

      await addDoc(collection(db, "email_templates"), {
        ...newTemplate,
        created: serverTimestamp(),
      })

      await fetchReportTemplates()

      toast({
        title: "Template created",
        description: `${templateName} has been created successfully.`,
      })
    } catch (error) {
      console.error("Error creating template:", error)
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      })
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate?.id || !user?.uid) {
      toast({
        title: "Error",
        description: "Unable to update template",
        variant: "destructive",
      })
      return
    }

    try {
      const templateRef = doc(db, "email_templates", editingTemplate.id)
      await updateDoc(templateRef, {
        name: editTemplateData.name,
        subject: editTemplateData.subject,
        body: editTemplateData.body,
        updated: serverTimestamp(),
      })

      await fetchReportTemplates()
      setEditDialogOpen(false)
      setEditingTemplate(null)

      toast({
        title: "Template updated",
        description: "The template has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating template:", error)
      toast({
        title: "Error",
        description: "Failed to update template",
        variant: "destructive",
      })
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
    toast({
      title: "Attachment removed",
      description: "The attachment has been removed from the email.",
    })
  }

  const handleAddAttachment = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB. Please choose a smaller file.`,
          variant: "destructive",
        })
        return
      }

      const newAttachment: Attachment = {
        name: file.name,
        size: formatFileSize(file.size),
        type: "user-upload",
        file: file,
      }

      setAttachments((prev) => [...prev, newAttachment])
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    toast({
      title: "Files added",
      description: `${files.length} file(s) have been added to your email.`,
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">Compose Email</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                    <Input
                      value={emailData.to}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, to: e.target.value }))}
                      placeholder="Enter recipient email"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cc:</label>
                    <Input
                      value={emailData.cc}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, cc: e.target.value }))}
                      placeholder="Enter CC email"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                    <Input
                      value={emailData.subject}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="Enter email subject"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Textarea
                      value={emailData.message}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder="Enter your message"
                      className="w-full min-h-[200px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attachments:</label>
                    <div className="space-y-2">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Paperclip className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-700">{attachment.name}</span>
                            <span className="text-xs text-gray-500">({attachment.size})</span>
                            {attachment.type === "user-upload" && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Uploaded</span>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveAttachment(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 bg-transparent"
                        onClick={handleAddAttachment}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Add Attachment
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-4">Templates:</h3>
                {templatesLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading templates...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span
                          className="text-sm text-gray-700 cursor-pointer"
                          onClick={() => handleTemplateAction(template.id!, "copy")}
                          title="Apply template"
                        >
                          {template.name}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTemplateAction(template.id!, "edit")}
                            className="h-6 w-6 p-0"
                            title="Edit template"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTemplateAction(template.id!, "delete")}
                            className="h-6 w-6 p-0"
                            title="Delete template"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={handleAddTemplate} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSendEmail}
            disabled={sending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8"
          >
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name:</label>
              <Input
                value={editTemplateData.name}
                onChange={(e) => setEditTemplateData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
              <Input
                value={editTemplateData.subject}
                onChange={(e) => setEditTemplateData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Enter email subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body:</label>
              <Textarea
                value={editTemplateData.body}
                onChange={(e) => setEditTemplateData((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Enter email body"
                className="min-h-[200px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplate} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm bg-transparent border-transparent" >
          <div className="text-center">
            <div className="flex justify-center bg-transparent">
              <img
                src="/images/success_report.png"
                alt="Success"
                className="w-22 object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}