"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Paperclip, Edit, Trash2, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getQuotation, getQuotationsByPageId, updateQuotationStatus } from "@/lib/quotation-service"
import { useAuth } from "@/contexts/auth-context"
import type { Quotation } from "@/lib/types/quotation"
import { emailService, type EmailTemplate } from "@/lib/email-service"
import { ProposalSentSuccessDialog } from "@/components/proposal-sent-success-dialog"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function ComposeEmailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { user, userData } = useAuth()

  const dataFetched = useRef(false)
  const userDataRef = useRef(userData)
  const [isInitialized, setIsInitialized] = useState(false)

  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [relatedQuotations, setRelatedQuotations] = useState<Quotation[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState<number | null>(null)
  const [preGeneratedPDF, setPreGeneratedPDF] = useState<string | null>(null)
  const [preGeneratedPDFs, setPreGeneratedPDFs] = useState<Array<{ filename: string; content: string }>>([])
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const [showAddTemplateDialog, setShowAddTemplateDialog] = useState(false)
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [newTemplateSubject, setNewTemplateSubject] = useState("")
  const [newTemplateBody, setNewTemplateBody] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)

  const [toEmail, setToEmail] = useState("")
  const [ccEmail, setCcEmail] = useState("")
  const [replyToEmail, setReplyToEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [pdfAttachments, setPdfAttachments] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [companyName, setCompanyName] = useState("")

  useEffect(() => {
    userDataRef.current = userData
  }, [userData])

  const loadExistingPDFs = useCallback(
    async (mainQuotation: Quotation, relatedQuotations: Quotation[]) => {
      if (!mainQuotation) return

      setPdfGenerating(true)
      try {
        console.log("[v0] Loading existing PDFs for email attachments...")
        const allPDFs: Array<{ filename: string; content: string }> = []

        // Process main quotation PDF
        if (mainQuotation.pdf) {
          try {
            console.log("[v0] Loading PDF for main quotation:", mainQuotation.id)
            const response = await fetch(mainQuotation.pdf)
            if (!response.ok) {
              throw new Error(`Failed to fetch PDF: ${response.status}`)
            }

            const blob = await response.blob()
            const pdfBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => {
                const result = reader.result as string
                resolve(result.split(',')[1]) // Remove data:application/pdf;base64, prefix
              }
              reader.readAsDataURL(blob)
            })

            const mainFilename = `QT-${mainQuotation.quotation_number}_${mainQuotation.client_company_name || "Client"}_Quotation.pdf`
            allPDFs.push({
              filename: mainFilename,
              content: pdfBase64,
            })
            setPreGeneratedPDF(pdfBase64)
            console.log("[v0] Main PDF loaded successfully")
          } catch (error) {
            console.error("[v0] Error loading main PDF:", error)
            toast({
              title: "PDF Loading Warning",
              description: `Could not load PDF for main quotation. ${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: "destructive",
            })
          }
        } else {
          console.warn("[v0] Main quotation does not have a PDF field")
          toast({
            title: "PDF Missing",
            description: "Main quotation does not have an existing PDF. Email will be sent without PDF attachment.",
            variant: "destructive",
          })
        }

        const uniqueRelatedQuotations = relatedQuotations.filter((quotation) => quotation.id !== mainQuotation.id)

        // Load PDFs for unique related quotations only
        for (let i = 0; i < uniqueRelatedQuotations.length; i++) {
          const quotation = uniqueRelatedQuotations[i]
          if (quotation.pdf) {
            try {
              console.log(`[v0] Loading PDF ${i + 1}/${uniqueRelatedQuotations.length} for quotation:`, quotation.id)

              const response = await fetch(quotation.pdf)
              if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.status}`)
              }

              const blob = await response.blob()
              const pdfBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = () => {
                  const result = reader.result as string
                  resolve(result.split(',')[1]) // Remove data:application/pdf;base64, prefix
                }
                reader.readAsDataURL(blob)
              })

              // Create unique quotation number with suffix
              const baseQuotationNumber = quotation.quotation_number || quotation.id?.slice(-8) || "QT-000"
              const uniqueQuotationNumber = `${baseQuotationNumber}-${String.fromCharCode(65 + i)}` // Appends -A, -B, -C, etc.

              const filename = `QT-${uniqueQuotationNumber}_${quotation.client_company_name || "Client"}_Quotation.pdf`
              allPDFs.push({
                filename,
                content: pdfBase64,
              })
              console.log(`[v0] PDF ${i + 1} loaded successfully:`, filename)
            } catch (error) {
              console.error(`[v0] Error loading PDF for quotation ${quotation.id}:`, error)
              toast({
                title: "PDF Loading Warning",
                description: `Could not load PDF for related quotation ${quotation.quotation_number || quotation.id?.slice(-8)}. ${error instanceof Error ? error.message : 'Unknown error'}`,
                variant: "destructive",
              })
            }
          } else {
            console.warn(`[v0] Related quotation ${quotation.id} does not have a PDF field`)
          }
        }

        setPreGeneratedPDFs(allPDFs)
        console.log(`[v0] All existing PDFs loaded successfully. Total: ${allPDFs.length}`)

        if (allPDFs.length === 0) {
          toast({
            title: "PDF Loading Warning",
            description: "No existing PDFs could be loaded. Email will be sent without PDF attachments.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("[v0] Error loading existing PDFs:", error)
        toast({
          title: "PDF Loading Error",
          description: "Failed to load existing PDFs. Email may be sent with fewer attachments.",
          variant: "destructive",
        })
      } finally {
        setPdfGenerating(false)
      }
    },
    [toast],
  )

  const fetchData = useCallback(async () => {
    if (dataFetched.current) return

    const currentUserData = userDataRef.current
    if (!currentUserData) return

    try {
      console.log("[v0] fetchData called with userData:", currentUserData)
      console.log("[v0] userData.company_id:", currentUserData?.company_id)

      const id = params.id as string
      const quotation = await getQuotation(id)
      if (!quotation) {
        toast({
          title: "Error",
          description: "Quotation not found",
          variant: "destructive",
        })
        return
      }
      setQuotation(quotation)

      // Fetch company data
      let fetchedCompanyData: any = null
      if (quotation.company_id) {
        try {
          const companyDoc = await getDoc(doc(db, "companies", quotation.company_id))
          if (companyDoc.exists()) {
            fetchedCompanyData = { id: companyDoc.id, ...companyDoc.data() }
            setCompanyName(fetchedCompanyData.name || "Company")
          }
        } catch (error) {
          console.error("Error fetching company data:", error)
        }
      }

      let related: Quotation[] = []
      if (quotation.page_id) {
        related = await getQuotationsByPageId(quotation.page_id)
        setRelatedQuotations(related)

        const uniqueRelated = related.filter((quot) => quot.id !== quotation.id)
        const attachmentNames = [
          `QT-${quotation.quotation_number}_${quotation.client_company_name || "Client"}_Quotation.pdf`,
          ...uniqueRelated.map(
            (quot, index) =>
              `QT-${quot.quotation_number}_${quot.client_company_name || "Client"}_Quotation_Page_${quot.page_number || index + 2}.pdf`,
          ),
        ]
        setPdfAttachments(attachmentNames)
      } else {
        related = []
        setRelatedQuotations([quotation])
        setPdfAttachments([
          `QT-${quotation.quotation_number}_${quotation.client_company_name || "Client"}_Quotation.pdf`,
        ])
      }

      await loadExistingPDFs(quotation, related)

      setToEmail(quotation.client_email || "")
      setCcEmail(user?.email || "")
      setReplyToEmail(user?.email || "")

      const companyId = currentUserData?.company_id || quotation?.company_id
      console.log("[v0] Final companyId being used:", companyId)

      if (companyId) {
        try {
          console.log("[v0] Using company_id:", companyId)
          const userTemplates = await emailService.getEmailTemplates(companyId)
          console.log("[v0] Fetched user templates:", userTemplates)
          const ceTemplates = userTemplates.filter(template => 'template_type' in template && template.template_type === "CE")
          setTemplates(ceTemplates)

        } catch (error) {
          console.error("Error fetching templates:", error)
          setTemplates([])
        }
      } else {
        console.error("Company ID not found in user data or quotation")
        console.log("[v0] userData:", currentUserData)
        console.log("[v0] quotation company_id:", quotation?.company_id)

        console.warn("No company_id available, continuing without templates")
        setTemplates([])
      }

      dataFetched.current = true
      setIsInitialized(true)
    } catch (error) {
      console.error("Error fetching quotation:", error)
      toast({
        title: "Error",
        description: "Failed to load quotation data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [params.id, user, toast, loadExistingPDFs])

  useEffect(() => {
    if (userData && !isInitialized && !dataFetched.current) {
      console.log("[v0] userData is available, calling fetchData")
      fetchData()
    } else if (userData === null) {
      setLoading(false)
    }
  }, [userData, isInitialized, fetchData])




  const applyTemplate = (template: EmailTemplate) => {
    const replacements = {
      "{title}": quotation?.items?.name || "Custom Quotation",
      "{clientName}": quotation?.client_name || quotation?.client_company_name || "Valued Client",
      "{userName}": user?.displayName || "Sales Executive",
      "{companyName}": "OH Plus",
      "{userContact}": user?.phoneNumber || "",
      "{userEmail}": user?.email || "",
    }

    let newSubject = template.subject
    let newBody = template.body

    Object.entries(replacements).forEach(([placeholder, value]) => {
      newSubject = newSubject.replace(new RegExp(placeholder, "g"), value)
      newBody = newBody.replace(new RegExp(placeholder, "g"), value)
    })

    setSubject(newSubject)
    setBody(newBody)
  }

  const handleAddTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all template fields",
        variant: "destructive",
      })
      return
    }

    const companyId = userData?.company_id || quotation?.company_id

    if (!companyId) {
      toast({
        title: "Error",
        description: "Company ID not found. Cannot create template.",
        variant: "destructive",
      })
      return
    }

    setSavingTemplate(true)
    try {
      const templateId = await emailService.createEmailTemplate({
        name: newTemplateName.trim(),
        subject: newTemplateSubject.trim(),
        body: newTemplateBody.trim(),
        userId: user!.uid,
        company_id: companyId,
        template_type: "CE",
        deleted: false,
      } as any)

      const newTemplate: EmailTemplate = {
        id: templateId,
        name: newTemplateName.trim(),
        subject: newTemplateSubject.trim(),
        body: newTemplateBody.trim(),
        userId: user!.uid,
        company_id: companyId,
        deleted: false,
      }

      setTemplates((prev) => [...prev, newTemplate])
      setShowAddTemplateDialog(false)
      setNewTemplateName("")
      setNewTemplateSubject("")
      setNewTemplateBody("")

      toast({
        title: "Template Added",
        description: "Email template has been created successfully",
      })
    } catch (error) {
      console.error("Error creating template:", error)
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!templateId) return
    try {
      await emailService.softDeleteEmailTemplate(templateId)
      setTemplates((prev) => prev.filter((template) => template.id !== templateId))
      toast({
        title: "Template Deleted",
        description: "Email template has been deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting template:", error)
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setNewTemplateName(template.name)
    setNewTemplateSubject(template.subject)
    setNewTemplateBody(template.body)
    setShowEditTemplateDialog(true)
  }

  const handleSaveEditedTemplate = async () => {
    if (!editingTemplate || !newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all template fields",
        variant: "destructive",
      })
      return
    }

    setSavingTemplate(true)
    try {
      const updatedTemplate = await emailService.updateEmailTemplate(editingTemplate.id!, {
        name: newTemplateName.trim(),
        subject: newTemplateSubject.trim(),
        body: newTemplateBody.trim(),
      })

      setTemplates((prev) => prev.map((template) => (template.id === editingTemplate.id ? updatedTemplate : template)))

      setShowEditTemplateDialog(false)
      setEditingTemplate(null)
      setNewTemplateName("")
      setNewTemplateSubject("")
      setNewTemplateBody("")

      toast({
        title: "Template Updated",
        description: "Email template has been updated successfully",
      })
    } catch (error) {
      console.error("Error updating template:", error)
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles = Array.from(files)
      setUploadedFiles((prev) => [...prev, ...newFiles])

      toast({
        title: "Files Added",
        description: `${newFiles.length} file(s) added to attachments`,
      })
    }

    event.target.value = ""
  }

  const removePdfAttachment = (index: number) => {
    setPdfAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSendEmail = async () => {
    if (!quotation || !toEmail) {
      toast({
        title: "Missing Information",
        description: "Please ensure all required fields are filled",
        variant: "destructive",
      })
      return
    }

    setSending(true)
    try {
      console.log("[v0] Starting email send process...")
      console.log("[v0] Uploaded files count:", uploadedFiles.length)
      console.log("[v0] Pre-generated PDFs available:", preGeneratedPDFs.length)

      const uploadedFilesData =
        uploadedFiles.length > 0
          ? await Promise.all(
              uploadedFiles.map(async (file) => {
                const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = reader.result as string
                    resolve(result.split(",")[1])
                  }
                  reader.readAsDataURL(file)
                })

                return {
                  filename: file.name,
                  content: base64,
                  type: file.type,
                }
              }),
            )
          : []

      console.log("[v0] Processed uploaded files:", uploadedFilesData.length)

      const allAttachments = [...preGeneratedPDFs.map((pdf) => pdf.filename), ...uploadedFiles.map((f) => f.name)]

      const requestBody = {
        quotation: quotation,
        clientEmail: toEmail,
        client: { name: quotation.client_name, company: quotation.client_company_name, email: quotation.client_email },
        currentUserEmail: user?.email,
        ccEmail: ccEmail,
        replyToEmail: replyToEmail,
        subject: subject,
        body: body,
        attachments: allAttachments,
        preGeneratedPDFs: preGeneratedPDFs,
        uploadedFiles: uploadedFilesData,
        userData: userData, // Send userData for PDF generation fallback
      }

      console.log("[v0] Sending request with body:", {
        hasQuotation: !!requestBody.quotation,
        clientEmail: requestBody.clientEmail,
        uploadedFilesCount: uploadedFilesData.length,
        preGeneratedPDFsCount: preGeneratedPDFs.length,
        totalAttachments: allAttachments.length,
      })

      const response = await fetch("/api/quotations/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("[v0] Response status:", response.status)

      const result = await response.json()
      console.log("[v0] Response result:", result)

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send email")
      }

      console.log("[v0] Email sent successfully!")

      // Update status of all quotations in the same page to "sent"
      const quotationsToUpdate = [quotation, ...relatedQuotations]
      console.log("[v0] Updating status to 'sent' for", quotationsToUpdate.length, "quotations")

      for (const quot of quotationsToUpdate) {
        if (quot.id) {
          try {
            console.log(`[v0] Updating quotation ${quot.id} status to 'sent'...`)
            await updateQuotationStatus(quot.id, "sent")
            console.log(`[v0] Quotation ${quot.id} status updated to 'sent' successfully`)
          } catch (statusError) {
            console.error(`[v0] Failed to update quotation ${quot.id} status:`, statusError)
            // Continue with other quotations even if one fails
          }
        }
      }

      // Update local state to reflect the changes
      setQuotation(prev => prev ? { ...prev, status: "sent" } : null)
      setRelatedQuotations(prev => prev.map(quot => ({ ...quot, status: "sent" })))

      setShowSuccessDialog(true)
    } catch (error) {
      console.error("[v0] Error sending email:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleDownloadAttachment = async (attachment: string, index: number) => {
    if (preGeneratedPDFs[index]) {
      try {
        const pdfData = preGeneratedPDFs[index]

        const byteCharacters = atob(pdfData.content)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)

        window.open(url, "_blank")

        setTimeout(() => URL.revokeObjectURL(url), 1000)

        toast({
          title: "PDF Opened",
          description: `${attachment} has been opened in a new tab.`,
        })
      } catch (error) {
        console.error("Error opening PDF:", error)
        toast({
          title: "Error",
          description: "Failed to open PDF. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleViewUploadedFile = (file: File) => {
    const url = URL.createObjectURL(file)
    window.open(url, "_blank")

    setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast({
      title: "File Opened",
      description: `${file.name} has been opened in a new tab.`,
    })
  }

  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false)
    router.push("/sales/quotations-list")
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (loading || userData === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-lg">Loading...</div>
          {pdfGenerating && <div className="text-sm text-gray-600">Loading existing PDFs for email attachment...</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex items-center space-x-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Compose email</h1>
        {pdfGenerating && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Loading {relatedQuotations.length} PDF(s)...
          </div>
        )}
        {preGeneratedPDFs.length > 0 && !pdfGenerating && (
          <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            {preGeneratedPDFs.length} PDF(s) Loaded
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col lg:flex-row space-y-6 lg:space-y-0 lg:space-x-6">
          {/* Email Form */}
          <div className="flex-1">
            <div className="space-y-4">
              {/* To Field */}
              <div className="flex items-center space-x-4">
                <label className="text-lg font-medium text-gray-900 w-20">To:</label>
                <Input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="bg-white rounded-[10px] border-2 border-[#c4c4c4] h-[39px] flex-1"
                />
              </div>

              {/* CC Field */}
              <div className="flex items-center space-x-4">
                <label className="text-lg font-medium text-gray-900 w-20">CC:</label>
                <Input value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} placeholder="cc@example.com" className="bg-white rounded-[10px] border-2 border-[#c4c4c4] h-[39px] flex-1" />
              </div>

              {/* Reply-To Field */}
              <div className="flex items-center space-x-4">
                <label className="text-lg font-medium text-gray-900 w-20">Reply-To:</label>
                <Input
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder="reply-to@example.com"
                  className="bg-white rounded-[10px] border-2 border-[#c4c4c4] h-[39px] flex-1"
                />
              </div>

              {/* Subject Field */}
              <div className="flex items-center space-x-4">
                <label className="text-lg font-medium text-gray-900 w-20">Subject:</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter your cost estimate subject here..." className="bg-white rounded-[10px] border-2 border-[#c4c4c4] h-[39px] flex-1" />
              </div>

              {/* Body Field */}
              <div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter your cost estimate content here..."
                  className="bg-white rounded-[10px] border-2 border-[#c4c4c4] w-full h-[543px] resize-none"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attachments:</label>

                <div className="space-y-2">
                  {preGeneratedPDFs.map((pdf, index) => (
                    <div key={`pdf-${index}`} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{pdf.filename}</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">PDF</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadAttachment(pdf.filename, index)}
                          title="View attachment"
                          disabled={downloadingPDF === index}
                        >
                          {downloadingPDF === index ? "Opening..." : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {uploadedFiles.map((file, index) => (
                    <div key={`upload-${index}`} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Uploaded</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewUploadedFile(file)}
                          title="View attachment"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeUploadedFile(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  />
                  <button onClick={() => document.getElementById("file-upload")?.click()} className="text-[#2d3fff] underline text-lg font-medium">+Add attachment</button>
                </div>
              </div>
            </div>
          </div>

          {/* Templates Sidebar */}
          <div className="w-[346px]">
            <div className="bg-white rounded-[20px] shadow-[-2px_4px_10.5px_-2px_rgba(0,0,0,0.25)] p-4">
              <h3 className="font-semibold text-lg text-black mb-4">Templates</h3>
              {templates.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No email templates available.</p>
                  <p className="text-xs text-gray-400 mt-1">Create your first template to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div key={template.id} className="bg-[#c4c4c4] bg-opacity-20 h-[56px] rounded-[10px] flex items-center justify-between px-4">
                      <span
                        className="text-lg font-medium text-gray-900 cursor-pointer"
                        onClick={() => applyTemplate(template)}
                        title="Apply template"
                      >
                        {template.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                          className="p-0"
                        >
                          <Edit className="h-6 w-6 opacity-50" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => template.id && handleDeleteTemplate(template.id)}
                          className="p-0"
                        >
                          <Trash2 className="h-6 w-6 opacity-50" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={() => setShowAddTemplateDialog(true)} className="w-full mt-4 bg-white border-2 border-[#c4c4c4] rounded-[10px] text-gray-900 font-medium text-lg h-[39px]">
                +Add Template
              </Button>
            </div>
          </div>
        </div>

        {/* Send Button */}
        <div className="flex justify-center mt-6">
          <div className="bg-white rounded-[50px] border-[1.5px] border-[#c4c4c4] shadow-[-2px_4px_10.5px_-2px_rgba(0,0,0,0.25)] w-[440px] h-[61px] flex items-center justify-between px-4">
            <button onClick={() => router.back()} className="text-gray-900 underline text-lg">Cancel</button>
            <Button onClick={handleSendEmail} disabled={sending || !toEmail || !subject || pdfGenerating} className="bg-[#1d0beb] text-white rounded-[15px] px-6 py-2 text-2xl font-bold">
              {sending ? "Sending..." : pdfGenerating ? `Loading ${relatedQuotations.length} PDF(s)...` : "Send email"}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Template Dialog */}
      <Dialog open={showAddTemplateDialog} onOpenChange={setShowAddTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Email Template</DialogTitle>
            <DialogDescription>Create a new email template that can be reused for future quotations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Standard Quotation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={newTemplateSubject}
                onChange={(e) => setNewTemplateSubject(e.target.value)}
                placeholder="e.g., Quotation: {title} - {companyName}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-body">Body</Label>
              <Textarea
                id="template-body"
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
                placeholder="Hi {clientName},&#10;&#10;Please find attached..."
                className="min-h-[200px]"
              />
            </div>
            <div className="text-sm text-gray-500">
              <p className="font-medium mb-1">Available placeholders:</p>
              <p>{"{clientName}, {title}, {userName}, {companyName}, {userContact}, {userEmail}"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTemplate} disabled={savingTemplate}>
              {savingTemplate ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={showEditTemplateDialog} onOpenChange={setShowEditTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>Update the email template details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-template-name">Template Name</Label>
              <Input
                id="edit-template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Standard Quotation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-subject">Subject</Label>
              <Input
                id="edit-template-subject"
                value={newTemplateSubject}
                onChange={(e) => setNewTemplateSubject(e.target.value)}
                placeholder="e.g., Quotation: {title} - {companyName}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-body">Body</Label>
              <Textarea
                id="edit-template-body"
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
                placeholder="Hi {clientName},&#10;&#10;Please find attached..."
                className="min-h-[200px]"
              />
            </div>
            <div className="text-sm text-gray-500">
              <p className="font-medium mb-1">Available placeholders:</p>
              <p>{"{clientName}, {title}, {userName}, {companyName}, {userContact}, {userEmail}"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditedTemplate} disabled={savingTemplate}>
              {savingTemplate ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <ProposalSentSuccessDialog
        isOpen={showSuccessDialog}
        onDismissAndNavigate={handleSuccessDialogClose}
      />
    </div>
  )
}
