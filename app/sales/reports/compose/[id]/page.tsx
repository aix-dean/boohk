"use client"

import React from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, updateDoc } from "firebase/firestore"
import { uploadFileToFirebaseStorage } from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Paperclip, X, Copy, Edit, Trash2, Upload, Plus, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import type { ReportData } from "@/lib/report-service"
import { getReportById } from "@/lib/report-service"
import { getClientById, type Client } from "@/lib/client-service"
import { emailService, type EmailTemplate } from "@/lib/email-service"
import { CompanyService } from "@/lib/company-service"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { loadGoogleMaps } from "@/lib/google-maps-loader"

// IndexedDB utility for retrieving PDF blobs
const openPDFDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ReportPDFs', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs')
      }
    }
  })
}

const getPDFFromIndexedDB = async (key: string): Promise<{ blob: Blob; filename: string; timestamp: number } | null> => {
  const db = await openPDFDB()
  const transaction = db.transaction(['pdfs'], 'readonly')
  const store = transaction.objectStore('pdfs')
  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => {
      resolve(request.result || null)
    }
    request.onerror = () => reject(request.error)
  })
}

const deletePDFFromIndexedDB = async (key: string): Promise<void> => {
  const db = await openPDFDB()
  const transaction = db.transaction(['pdfs'], 'readwrite')
  const store = transaction.objectStore('pdfs')
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

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
  company_id: string
  userId: string
}

export default function ComposeEmailPage({ params }: ComposeEmailPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user, userData, projectData } = useAuth()
  const resolvedParams = React.use(params)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [emailData, setEmailData] = useState({
    to: "",
    cc: "",
    replyTo: "",
    subject: "",
    message: "",
  })

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [tempPdfLoaded, setTempPdfLoaded] = useState(false)
  const [totalAttachmentSize, setTotalAttachmentSize] = useState(0)

  const [templates, setTemplates] = useState<ReportEmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)

  // Template settings for preview (not used for reports)
  const [selectedSize, setSelectedSize] = useState<string>("A4")
  const [selectedOrientation, setSelectedOrientation] = useState<string>("Portrait")
  const [selectedLayout, setSelectedLayout] = useState<string>("1")
  const [selectedTemplateBackground, setSelectedTemplateBackground] = useState<string>("")

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReportEmailTemplate | null>(null)
  const [editTemplateData, setEditTemplateData] = useState({
    name: "",
    subject: "",
    body: "",
  })

  const [companyName, setCompanyName] = useState<string>("")
  const [logoFromUrl, setLogoFromUrl] = useState<string>("")
  const [companyIdToUse, setCompanyIdToUse] = useState<string>("")

  const fetchReportTemplates = useCallback(async () => {
    if (!userData?.company_id) return

    try {
      setTemplatesLoading(true)

      const templatesRef = collection(db, "email_templates")
      const q = query(
        templatesRef,
        where("company_id", "==", userData.company_id),
        where("template_type", "==", "report"),
        where("deleted", "!=", true),
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
          company_id: data.company_id,
          created: data.created,
          template_type: data.template_type || "report",
        })
      })

      // Remove any existing default templates
      const defaultTemplateNames = ["Standard Report", "Follow-up Report"]
      const templatesToDelete = reportTemplates.filter(template => defaultTemplateNames.includes(template.name))
      for (const template of templatesToDelete) {
        if (template.id) {
          try {
            await emailService.deleteEmailTemplate(template.id)
          } catch (deleteError) {
            console.error("Error deleting default template:", deleteError)
          }
        }
      }

      // Filter out the deleted templates from the list
      const filteredTemplates = reportTemplates.filter(template => !defaultTemplateNames.includes(template.name))

      setTemplates(filteredTemplates)
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
  }, [userData?.company_id, toast])

  const createDefaultReportTemplates = async () => {
    if (!userData?.company_id) return

    const templateCompanyName = companyName || projectData?.company_name || 'Your Company'
    const contactDetails = [
      '[Your Name]',
      templateCompanyName,
      `📞 ${userData?.phone_number || '+639XXXXXXXXX'}`,
      `📧 ${userData?.email || user?.email || 'noreply@ohplus.ph'}`,
      ...(projectData?.company_website ? [`🌐 ${projectData.company_website}`] : [])
    ].join('\n')



  }

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const reportData = await getReportById(resolvedParams.id)

        if (!reportData) {
          throw new Error("Report not found")
        }

        setReport(reportData)

        // Check if report has logistics_report attachment
        if (reportData.logistics_report) {
          const logisticsAttachment: Attachment = {
            name: "logistics_report.pdf",
            size: "PDF",
            type: "report",
            url: reportData.logistics_report,
          }
          setAttachments([logisticsAttachment])
          setTempPdfLoaded(true)
        } else {
          // Read URL parameters
          const urlParams = new URLSearchParams(window.location.search)
          const pdfKey = urlParams.get('pdfKey')

        if (pdfKey && !tempPdfLoaded) {
          // Use pre-generated PDF from IndexedDB
          try {
            const pdfData = await getPDFFromIndexedDB(pdfKey)
            if (pdfData) {
              const pdfFile = new File([pdfData.blob], pdfData.filename, {
                type: "application/pdf",
              })

                const reportPDFs: Attachment[] = [
                  {
                    name: pdfData.filename,
                    size: formatFileSize(pdfData.blob.size),
                    type: "report",
                    file: pdfFile,
                  },
                ]

                setAttachments(reportPDFs)
                setTempPdfLoaded(true)

                // Clean up IndexedDB
                await deletePDFFromIndexedDB(pdfKey)
              } else {
                console.warn('PDF not found in IndexedDB, no PDF attachment will be included')
                setTempPdfLoaded(true)
              }
            } catch (error) {
              console.error('Error retrieving PDF from IndexedDB:', error)
              setTempPdfLoaded(true)
            }
          } else if (!pdfKey && !tempPdfLoaded) {
            // No PDF available
            console.warn('No PDF key provided, no PDF attachment will be included')
            setTempPdfLoaded(true)
          }
        }

        // Set report data
        setReport(reportData)

        // Determine company name - prioritize report's companyId, fallback to projectData
        let finalCompanyName = 'Your Company'

        console.log('Company name resolution:', {
          projectDataCompanyName: projectData?.company_name,
          reportCompanyId: reportData.companyId
        })

        // First try to get company name from report's companyId
        let companyIdToUse = reportData.companyId
        setCompanyIdToUse(companyIdToUse || "")

        if (!companyIdToUse && reportData.clientId) {
          // Try to get company from client
          try {
            const clientData = await getClientById(reportData.clientId)
            if (clientData?.company_id) {
              companyIdToUse = clientData.company_id
              console.log('Using client company_id instead:', companyIdToUse)
            }
          } catch (clientError) {
            console.error("Error fetching client for company:", clientError)
          }
        }

        if (companyIdToUse && typeof companyIdToUse === 'string') {
          try {
            console.log('Fetching company data for ID:', companyIdToUse)
            const companyData = await CompanyService.getCompanyData(companyIdToUse)
            if (companyData?.name && companyData.name.trim()) {
              finalCompanyName = companyData.name.trim()
              console.log('Found company name from report:', finalCompanyName)
            } else {
              console.log('Company found but no name for ID:', companyIdToUse, 'companyData:', companyData)
            }

            // Log company address
            if (companyData?.address) {
              console.log('Found company address from report:', companyData.address)
            } else {
              console.log('No company address found for ID:', companyIdToUse)
            }
          } catch (companyError) {
            console.error("Error fetching company data for ID:", companyIdToUse, companyError)
          }
        } else {
          console.log('No valid companyId in report or client:', {
            reportCompanyId: reportData.companyId,
            reportClientId: reportData.clientId
          })
        }

        // If we still don't have a company name, try projectData
        if (finalCompanyName === 'Your Company' && projectData?.company_name) {
          finalCompanyName = projectData.company_name
          console.log('Using company name from projectData:', finalCompanyName)
        }

        console.log('Final company name:', finalCompanyName)

        setCompanyName(finalCompanyName)

        // Create the contact details section
        const replyToEmail = emailData.replyTo || userData?.email || user?.email || 'noreply@ohplus.ph'
        const contactDetails = [
          'Sales Executive',
          finalCompanyName,
          `📞 ${userData?.phone_number || '+639XXXXXXXXX'}`,
          `📧 ${replyToEmail}`,
          ...(projectData?.company_website && projectData.company_website !== 'www.ohplus.ph' ? [`🌐 ${projectData.company_website}`] : [])
        ].join('\n')

        console.log('Contact details construction:', {
          replyToEmail,
          userDataEmail: userData?.email,
          userEmail: user?.email,
          companyWebsite: projectData?.company_website
        })

        setEmailData((prev) => ({
          ...prev,
          to: reportData.client_email || "",
          cc: userData?.email || user?.email || "",
          replyTo: userData?.email || user?.email || "",
          subject: ``,
          message: ``,
        }))

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
    if (userData?.company_id) {
      fetchReportTemplates()
    }
  }, [userData?.company_id])

  // Calculate total attachment size
  useEffect(() => {
    const totalSize = attachments.reduce((sum, attachment) => {
      return sum + (attachment.file?.size || 0)
    }, 0)
    setTotalAttachmentSize(totalSize)
  }, [attachments])

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
      // Upload attachments to Firebase storage if they don't have URLs
      for (const attachment of attachments) {
        if (attachment.file && !attachment.url) {
          try {
            const uploadPath = `reports/attachments/${resolvedParams.id}/`
            const downloadURL = await uploadFileToFirebaseStorage(attachment.file, uploadPath)
            attachment.url = downloadURL
          } catch (uploadError) {
            console.error(`Error uploading attachment ${attachment.name}:`, uploadError)
            // Continue without URL, but log error
          }
        }
      }

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
      if (emailData.replyTo.trim()) {
        formData.append("replyTo", emailData.replyTo.trim())
      }
      formData.append("subject", emailData.subject)
      formData.append("body", emailData.message)
      if (userData?.phone_number) {
        formData.append("currentUserPhoneNumber", userData.phone_number)
      }

      // Pass company information
      if (userData?.company_id) {
        formData.append("companyId", userData.company_id)
      }
      if (projectData?.company_name) {
        formData.append("companyName", projectData.company_name)
      }
      if (projectData?.company_website) {
        formData.append("companyWebsite", projectData.company_website)
      }
      // Always send userDisplayName with fallback
      const displayName = userData?.displayName || user?.displayName || user?.email?.split('@')[0] || "Sales Executive"
      formData.append("userDisplayName", displayName)

      // Pass the company logo from URL parameter or fetch from database
      let companyLogoToUse = "public/boohk-logo.svg"

      // Use logo from URL parameter if provided
      if (logoFromUrl) {
        companyLogoToUse = logoFromUrl
        console.log("Using logo from URL parameter for email:", companyLogoToUse)
      } else if (companyIdToUse) {
        // Otherwise fetch from database as fallback
        try {
          const { doc, getDoc } = await import("firebase/firestore")
          const { db } = await import("@/lib/firebase")

          const companyDocRef = doc(db, "companies", companyIdToUse)
          const companyDocSnap = await getDoc(companyDocRef)

          if (companyDocSnap.exists()) {
            const companyData = companyDocSnap.data()
            if (companyData?.logo && companyData.logo.trim()) {
              companyLogoToUse = companyData.logo
              console.log("Using company logo for email:", companyLogoToUse)
            }
          }
        } catch (logoError) {
          console.error("Error fetching company logo for email:", logoError)
          // Continue with default logo
        }
      }

      if (companyLogoToUse && companyLogoToUse !== "public/boohk-logo.svg") {
        formData.append("companyLogo", companyLogoToUse)
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

      // Pass the report ID for the email template
      formData.append('reportId', resolvedParams.id)

      console.log('Sending email with company data:', {
        companyId: userData?.company_id,
        companyName: projectData?.company_name,
        companyLogo: companyLogoToUse,
        logoFromUrl: logoFromUrl
      })

      console.log("Sending email request to /api/send-email", {
        to: toEmails,
        cc: ccEmails,
        subject: emailData.subject,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
        companyId: userData?.company_id,
        userId: user?.uid
      })

      const response = await fetch("/api/send-email", {
        method: "POST",
        body: formData,
      })

      console.log("Email API response received", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        console.log("Email API returned error response", {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type')
        })

        try {
          // Read the response body once
          const responseText = await response.text()
          console.log("Email API error response content", {
            responseText: responseText.substring(0, 500), // First 500 chars to avoid huge logs
            isHtml: responseText.includes('<!DOCTYPE') || responseText.includes('<html'),
            length: responseText.length
          })

          // Try to parse as JSON first
          try {
            const errorData = JSON.parse(responseText)
            console.log("Parsed error data from API", errorData)
            errorMessage = errorData.error || errorMessage
          } catch (jsonParseError) {
            console.log("Failed to parse error response as JSON", jsonParseError)
            // If it's not JSON, check if it's HTML
            if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
              errorMessage = `Server error (HTTP ${response.status}). Please check your connection and try again.`
            } else {
              errorMessage = responseText || errorMessage
            }
          }
        } catch (readError) {
          console.log("Failed to read error response body", readError)
          // If we can't read the response at all
          errorMessage = `Server error (HTTP ${response.status}). Please check your connection and try again.`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("Email API success response", result)

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
          replyTo: emailData.replyTo || null,
          updated: serverTimestamp(),
          userId: user?.uid || null,
          company_id: userData?.company_id || null,
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

      toast({
        title: "Email sent!",
        description: "Your report has been sent successfully.",
      })

      router.push("/sales/reports?success=email-sent")
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
    if (!userData?.company_id) {
      toast({
        title: "Error",
        description: "Company information not available",
        variant: "destructive",
      })
      return
    }

    try {
      const templateName = `Report Template ${templates.length + 1}`
      const newTemplate = {
        name: templateName,
        subject: "",
        body: "",
        userId: user!.uid,
        company_id: userData.company_id,
        template_type: "report" as const,
        deleted: false,
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

  const handleViewAttachment = (attachment: Attachment) => {
    if (attachment.file) {
      const url = URL.createObjectURL(attachment.file)
      window.open(url, '_blank')
    } else if (attachment.url) {
      window.open(attachment.url, '_blank')
    } else {
      toast({
        title: "Cannot view attachment",
        description: "No file data available for this attachment.",
        variant: "destructive",
      })
    }
  }

  const handleAddAttachment = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const maxTotalSize = 35 * 1024 * 1024 // 35MB to leave buffer before 40MB limit
    let newFilesAdded = 0

    Array.from(files).forEach((file) => {
      // Check individual file size
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB. Please choose a smaller file.`,
          variant: "destructive",
        })
        return
      }

      // Check if adding this file would exceed total limit
      if (totalAttachmentSize + file.size > maxTotalSize) {
        toast({
          title: "Total size limit approaching",
          description: `Adding ${file.name} would exceed the recommended total size limit. Consider compressing files or removing attachments.`,
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

      setAttachments((prev) => [...prev, ...[newAttachment]])
      newFilesAdded++
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (newFilesAdded > 0) {
      toast({
        title: "Files added",
        description: `${newFilesAdded} file(s) have been added to your email.`,
      })
    }
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
    <div className="min-h-screen bg-white">
      <div className="p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <h1 className="text-base leading-tight font-bold text-gray-900">Compose email</h1>
          </Button>

        </div>

        <div className="flex flex-col space-y-4">
          <div className="flex space-x-6">
            <div className="flex-1">
              <div className="sm:gap-8 space-y-2">
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-8 sm:space-y-0">
                  <div className="flex items-center space-x-4 flex-1">
                    <label className="leading-tight font-medium text-darkslategray w-[60px] sm:w-[80px] text-xs">To:</label>
                    <Input
                      value={emailData.to}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, to: e.target.value }))}
                      placeholder="Enter recipient email"
                      className="w-full h-[27px] relative rounded-md bg-white border-silver border-solid border-[1.2px] box-border"
                    />
                  </div>
                  <div className="flex items-center space-x-4 flex-1">
                    <label className="leading-tight font-medium text-darkslategray w-[60px] sm:w-[80px] text-xs">CC:</label>
                    <Input
                      value={emailData.cc}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, cc: e.target.value }))}
                      placeholder="Enter CC email"
                      className="w-full h-[27px] relative rounded-md bg-white border-silver border-solid border-[1.2px] box-border"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-8">
                  <div className="flex items-center space-x-4 flex-1">
                    <label className="leading-tight font-medium text-darkslategray w-[60px] sm:w-[80px] text-xs">Subject:</label>
                    <Input
                      value={emailData.subject}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="Enter email subject"
                      className="w-full h-[27px] relative rounded-md bg-white border-silver border-solid border-[1.2px] box-border"
                    />
                  </div>
                  <div className="flex items-center space-x-4 flex-1">
                    <label className="leading-tight font-medium font-inter text-darkslategray w-[60px] sm:w-[80px] text-xs">Reply-To:</label>
                    <Input
                      value={emailData.replyTo}
                      onChange={(e) => setEmailData((prev) => ({ ...prev, replyTo: e.target.value }))}
                      placeholder="Enter reply-to email"
                      className="w-full h-[27px] relative rounded-md bg-white border-silver border-solid border-[1.2px] box-border"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden lg:block w-[276px]"></div>
          </div>

          <div className="flex flex-col space-y-4 lg:flex-row lg:space-x-6 lg:space-y-0">
            <div className="flex-1">
              <Textarea
                value={emailData.message}
                onChange={(e) => setEmailData((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Enter your message"
                className="bg-white rounded-lg border border-gray-300 box-border w-full h-[351px] resize-none text-xs"
              />
            </div>

            <div className="w-full lg:w-[276px]">
              <div className="bg-white rounded-xl shadow-[-2px_4px_10.5px_-2px_rgba(0,0,0,0.25)] p-4">
                <h3 className="font-semibold text-base text-black mb-4">Templates</h3>
                {templatesLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading templates...</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No email templates available.</p>
                    <p className="text-xs text-gray-400 mt-1">Create your first template to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="bg-gray-100 h-[33px] rounded-lg flex items-center justify-between px-4">
                        <span
                          className="text-xs font-medium text-gray-900 cursor-pointer text-darkslategray"
                          onClick={() => handleTemplateAction(template.id!, "copy")}
                          title="Apply template"
                        >
                          {template.name}
                        </span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTemplateAction(template.id!, "edit")}
                            className="p-0"
                          >
                            <Edit className="h-6 w-6 opacity-50" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTemplateAction(template.id!, "delete")}
                            className="p-0"
                          >
                            <Trash2 className="h-6 w-6 opacity-50" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleAddTemplate} className="w-full mt-4 bg-white box-border  border-[1.2px] border-gray-300 rounded-lg text-gray-900 font-medium text-xs h-[29px]">
                +Add Template
              </button>
            </div>

          </div>
          {/* attachment */}
          <div>

            {/* File size warning */}
            {totalAttachmentSize > 30 * 1024 * 1024 && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Large attachment size detected
                    </h3>
                    <div className="mt-1 text-sm text-yellow-700">
                      <p>
                        Total attachment size: {(totalAttachmentSize / (1024 * 1024)).toFixed(1)}MB.
                        Email services have a 40MB limit. Consider removing or compressing files.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Paperclip className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700 cursor-pointer" onClick={() => handleViewAttachment(attachment)}>{attachment.name}</span>
                    <span className="text-xs text-gray-500">({attachment.size})</span>
                    {attachment.type === "user-upload" && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Uploaded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <button onClick={handleAddAttachment} className="text-blue-600 underline text-base text-xs font-medium leading-tight">+Add attachment</button>
            </div>
          </div>
          {/* send and cancel button */}
          <div className="flex justify-center mt-6">
            <div className="flex flex-col space-y-4 lg:flex-row lg:space-x-6 lg:space-y-0 w-full">
              <div className="flex-1 flex justify-center">
                <div className="bg-white rounded-[50px] border border-gray-300 shadow-[-2px_4px_10.5px_-2px_rgba(0,0,0,0.25)] h-[67px] flex items-center justify-between px-4">
                  <button onClick={handleBack} className="w-[108px] h-[17px] relative text-base [text-decoration:underline] leading-[100%] inline-block font-inter text-darkslategray text-center cursor-pointer">Cancel</button>
                  <Button onClick={handleSendEmail} disabled={sending} className="bg-[#1d0beb] rounded-[10px] w-[133px] h-[27px] text-base">
                    <span className="text-base leading-[100%] inline-block font-inter text-white text-center">
                      {sending ? "Sending..." : "Send email"}
                    </span>
                  </Button>
                </div>
              </div>
              <div className="w-full lg:w-[276px]"></div>
            </div>
          </div>
        </div>



        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
        />

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
                placeholder="Enter your report subject here..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body:</label>
              <Textarea
                value={editTemplateData.body}
                onChange={(e) => setEditTemplateData((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Enter your report content here..."
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
    </div>
  )
}