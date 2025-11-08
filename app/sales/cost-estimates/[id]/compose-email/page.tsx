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
import { getCostEstimate, getCostEstimatesByPageId, updateCostEstimateStatus, generateAndUploadCostEstimatePDF, updateCostEstimate } from "@/lib/cost-estimate-service"
import { useAuth } from "@/contexts/auth-context"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import { emailService, type EmailTemplate } from "@/lib/email-service"
import { ProposalSentSuccessDialog } from "@/components/proposal-sent-success-dialog"
import { db, getDoc, doc } from "@/lib/firebase"

export default function ComposeEmailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { user, userData } = useAuth()

  const dataFetched = useRef(false)
  const userDataRef = useRef(userData)
  const [isInitialized, setIsInitialized] = useState(false)

  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [relatedCostEstimates, setRelatedCostEstimates] = useState<CostEstimate[]>([])
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

  const preGenerateAllPDFs = useCallback(
    async (mainCostEstimate: CostEstimate, relatedCostEstimates: CostEstimate[], companyDataParam?: any) => {
      if (!mainCostEstimate) return

      setPdfGenerating(true)
      try {
        console.log("[v0] Pre-generating all PDFs for email attachments...")
        const currentUserData = userDataRef.current
        const userDataForPDF = currentUserData
          ? {
              first_name: currentUserData.first_name || user?.displayName?.split(" ")[0] || "",
              last_name: currentUserData.last_name || user?.displayName?.split(" ").slice(1).join(" ") || "",
              email: currentUserData.email || user?.email || "",
              company_id: currentUserData.company_id || undefined,
            }
          : undefined

        // Fetch current user's signature once for all PDFs
        let userSignatureDataUrl: string | null = null
        let signatureDate: Date | null = null
        if (user?.uid) {
          try {
            const { doc, getDoc } = await import("firebase/firestore")
            const { db } = await import("@/lib/firebase")
            const userDocRef = doc(db, "iboard_users", user.uid)
            const userDoc = await getDoc(userDocRef)

            if (userDoc.exists()) {
              const userDataFetched = userDoc.data()
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.url) {
                const signatureUrl = userDataFetched.signature.url
                console.log('[v0] Found current user signature URL:', signatureUrl)

                // Convert signature image to base64 data URL
                try {
                  const response = await fetch(signatureUrl)
                  if (response.ok) {
                    const blob = await response.blob()
                    const arrayBuffer = await blob.arrayBuffer()
                    const base64 = Buffer.from(arrayBuffer).toString('base64')
                    const mimeType = blob.type || 'image/png'
                    userSignatureDataUrl = `data:${mimeType};base64,${base64}`
                    console.log('[v0] Converted current user signature to base64 data URL')
                  } else {
                    console.warn('[v0] Failed to fetch current user signature image:', response.status)
                  }
                } catch (fetchError) {
                  console.error('[v0] Error converting current user signature to base64:', fetchError)
                }
              }
              // Also fetch signature date
              if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
                signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
              }
            }
          } catch (error) {
            console.error('[v0] Error fetching current user signature:', error)
          }
        }

        // Load company logo if available
        let logoDataUrl: string | null = null
        if (companyDataParam?.logo) {
          try {
            console.log("[v0] Fetching company logo from:", companyDataParam.logo)
            const response = await fetch(companyDataParam.logo)
            if (response.ok) {
              const blob = await response.blob()
              logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(blob)
              })
              console.log("[v0] Company logo loaded successfully")
            } else {
              console.error("[v0] Failed to fetch company logo:", response.status, response.statusText)
            }
          } catch (error) {
            console.error("[v0] Error loading company logo:", error)
          }
        } else {
          console.log("[v0] No company logo available in company data")
        }

        // Helper function to fetch PDF from URL and convert to base64
        const fetchPDFAsBase64 = async (url: string): Promise<string> => {
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`)
          }
          const blob = await response.blob()
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              resolve(result.split(',')[1]) // Remove data:application/pdf;base64, prefix
            }
            reader.readAsDataURL(blob)
          })
        }

        const allPDFs: Array<{ filename: string; content: string }> = []

        // Handle PDF for main cost estimate
        try {
          let mainPdfBase64: string

          if (mainCostEstimate.pdf) {
            try {
              mainPdfBase64 = await fetchPDFAsBase64(mainCostEstimate.pdf)
              console.log("[v0] Main PDF fetched from existing URL")
            } catch (fetchError) {
              console.error("[v0] Error fetching main PDF from URL:", fetchError)
              // Fall back to generating PDF
              const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(mainCostEstimate, userDataForPDF, companyDataParam, userSignatureDataUrl)

              // Update cost estimate with PDF URL, password, and signature date
              await updateCostEstimate(mainCostEstimate.id, {
                pdf: pdfUrl,
                password: password,
                signature_date: signatureDate
              })

              mainPdfBase64 = await fetchPDFAsBase64(pdfUrl)
              console.log("[v0] Main PDF generated as fallback")
            }
          } else {
            // Generate PDF using the new service
            console.log("[v0] Main PDF generation request:", {
              hasLogoDataUrl: !!logoDataUrl,
              logoDataUrlLength: logoDataUrl?.length || 0,
              hasCompanyData: !!companyDataParam,
              hasCompanyLogo: !!companyDataParam?.logo,
            })

            const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(mainCostEstimate, userDataForPDF, companyDataParam, userSignatureDataUrl)

            // Update cost estimate with PDF URL, password, and signature date
            await updateCostEstimate(mainCostEstimate.id, {
              pdf: pdfUrl,
              password: password,
              signature_date: signatureDate
            })

            mainPdfBase64 = await fetchPDFAsBase64(pdfUrl)
            console.log("[v0] Main PDF generated successfully")
          }

          const mainFilename = `CE-${mainCostEstimate.costEstimateNumber}_${mainCostEstimate.client?.company || "Client"}_Cost_Estimate.pdf`
          allPDFs.push({
            filename: mainFilename,
            content: mainPdfBase64,
          })
          setPreGeneratedPDF(mainPdfBase64)
        } catch (error) {
          console.error("[v0] Error handling main PDF:", error)
        }

        const uniqueRelatedCostEstimates = relatedCostEstimates.filter((costEstimate) => costEstimate.id !== mainCostEstimate.id)

        // Handle PDFs for unique related cost estimates only
        for (let i = 0; i < uniqueRelatedCostEstimates.length; i++) {
          const costEstimate = uniqueRelatedCostEstimates[i]
          try {
            console.log(`[v0] Handling PDF ${i + 1}/${uniqueRelatedCostEstimates.length} for cost estimate:`, costEstimate.id)

            // Create unique cost estimate number with suffix
            const baseCostEstimateNumber = costEstimate.costEstimateNumber || costEstimate.id?.slice(-8) || "CE-000"
            const uniqueCostEstimateNumber = `${baseCostEstimateNumber}-${String.fromCharCode(65 + i)}` // Appends -A, -B, -C, etc.

            let pdfBase64: string

            if (costEstimate.pdf) {
              try {
                pdfBase64 = await fetchPDFAsBase64(costEstimate.pdf)
                console.log(`[v0] PDF ${i + 1} fetched from existing URL`)
              } catch (fetchError) {
                console.error(`[v0] Error fetching PDF from URL for cost estimate ${costEstimate.id}:`, fetchError)
                // Fall back to generating PDF
                const modifiedCostEstimate = {
                  ...costEstimate,
                  costEstimateNumber: uniqueCostEstimateNumber,
                }

                const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(modifiedCostEstimate, userDataForPDF, companyDataParam, userSignatureDataUrl)

                // Update cost estimate with PDF URL, password, and signature date
                await updateCostEstimate(costEstimate.id, {
                  pdf: pdfUrl,
                  password: password,
                  signature_date: signatureDate
                })

                pdfBase64 = await fetchPDFAsBase64(pdfUrl)
                console.log(`[v0] PDF ${i + 1} generated as fallback`)
              }
            } else {
              // Generate PDF using the new service
              const modifiedCostEstimate = {
                ...costEstimate,
                costEstimateNumber: uniqueCostEstimateNumber,
              }

              console.log(`[v0] Related PDF ${i + 1} generation request:`, {
                hasLogoDataUrl: !!logoDataUrl,
                logoDataUrlLength: logoDataUrl?.length || 0,
                hasCompanyData: !!companyDataParam,
                hasCompanyLogo: !!companyDataParam?.logo,
              })

              const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(modifiedCostEstimate, userDataForPDF, companyDataParam, userSignatureDataUrl)

              // Update cost estimate with PDF URL, password, and signature date
              await updateCostEstimate(costEstimate.id, {
                pdf: pdfUrl,
                password: password,
                signature_date: signatureDate
              })

              pdfBase64 = await fetchPDFAsBase64(pdfUrl)
              console.log(`[v0] PDF ${i + 1} generated successfully`)
            }

            const filename = `CE-${uniqueCostEstimateNumber}_${costEstimate.client?.company || "Client"}_Cost_Estimate.pdf`
            allPDFs.push({
              filename,
              content: pdfBase64,
            })
          } catch (error) {
            console.error(`[v0] Error handling PDF for cost estimate ${costEstimate.id}:`, error)
          }
        }

        setPreGeneratedPDFs(allPDFs)
        console.log(`[v0] All PDFs pre-generated successfully. Total: ${allPDFs.length}`)

        if (allPDFs.length === 0) {
          toast({
            title: "PDF Generation Warning",
            description: "No PDFs could be generated. Email will be sent without PDF attachments.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("[v0] Error pre-generating PDFs:", error)
        toast({
          title: "PDF Generation Warning",
          description: "Some PDFs could not be generated. Email may be sent with fewer attachments.",
          variant: "destructive",
        })
      } finally {
        setPdfGenerating(false)
      }
    },
    [user, toast],
  )

  const fetchData = useCallback(async () => {
    if (dataFetched.current) return

    const currentUserData = userDataRef.current
    if (!currentUserData) return

    try {
      console.log("[v0] fetchData called with userData:", currentUserData)
      console.log("[v0] userData.company_id:", currentUserData?.company_id)

      const id = params.id as string
      const costEstimate = await getCostEstimate(id)
      if (!costEstimate) {
        toast({
          title: "Error",
          description: "Cost estimate not found",
          variant: "destructive",
        })
        return
      }
      setCostEstimate(costEstimate)

      // Fetch company data
      let fetchedCompanyData: any = null
      if (costEstimate.company_id) {
        try {
          const companyDoc = await getDoc(doc(db, "companies", costEstimate.company_id))
          if (companyDoc.exists()) {
            const companyData = companyDoc.data()
            fetchedCompanyData = {
              id: companyDoc.id,
              name: companyData.name,
              company_location: companyData.company_location || companyData.address,
              address: companyData.address,
              company_website: companyData.company_website || companyData.website,
              logo: companyData.logo, // Ensure logo field is properly included
              contact_person: companyData.contact_person,
              email: companyData.email,
              phone: companyData.phone,
              social_media: companyData.social_media || {},
              created_by: companyData.created_by,
              created: companyData.created?.toDate ? companyData.created.toDate() : companyData.created_at?.toDate(),
              updated: companyData.updated?.toDate ? companyData.updated.toDate() : companyData.updated_at?.toDate(),
            }
            console.log("[v0] Company data fetched with logo:", !!fetchedCompanyData.logo)
          }
        } catch (error) {
          console.error("Error fetching company data:", error)
        }
      }

      let related: CostEstimate[] = []
      if (costEstimate.page_id) {
        related = await getCostEstimatesByPageId(costEstimate.page_id)
        setRelatedCostEstimates(related)

        const uniqueRelated = related.filter((ce) => ce.id !== costEstimate.id)
        const attachmentNames = [
          `CE-${costEstimate.costEstimateNumber}_${costEstimate.client?.company || "Client"}_Cost_Estimate.pdf`,
          ...uniqueRelated.map(
            (ce, index) =>
              `CE-${ce.costEstimateNumber}_${ce.client?.company || "Client"}_Cost_Estimate_Page_${ce.page_number || index + 2}.pdf`,
          ),
        ]
        setPdfAttachments(attachmentNames)
      } else {
        related = []
        setRelatedCostEstimates([costEstimate])
        setPdfAttachments([
          `CE-${costEstimate.costEstimateNumber}_${costEstimate.client?.company || "Client"}_Cost_Estimate.pdf`,
        ])
      }

      await preGenerateAllPDFs(costEstimate, related, fetchedCompanyData)

      setToEmail(costEstimate.client?.email || "")
      setCcEmail(user?.email || "")
      setReplyToEmail(user?.email || "")
      setSubject("")
      setBody("")

      const companyId = currentUserData?.company_id || costEstimate?.company_id
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
        console.error("Company ID not found in user data or cost estimate")
        console.log("[v0] userData:", currentUserData)
        console.log("[v0] costEstimate company_id:", costEstimate?.company_id)

        console.warn("No company_id available, continuing without templates")
        setTemplates([])
      }

      dataFetched.current = true
      setIsInitialized(true)
    } catch (error) {
      console.error("Error fetching cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to load cost estimate data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [params.id, user, toast, preGenerateAllPDFs])

  useEffect(() => {
    if (userData && !isInitialized && !dataFetched.current) {
      console.log("[v0] userData is available, calling fetchData")
      fetchData()
    } else if (userData === undefined) {
      setLoading(false)
    }
  }, [userData, isInitialized, fetchData])

  const applyTemplate = (template: EmailTemplate) => {
    const replacements = {
      "{title}": costEstimate?.title || "Custom Cost Estimate",
      "{clientName}": costEstimate?.client?.name || costEstimate?.client?.company || "Valued Client",
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

    const companyId = userData?.company_id || costEstimate?.company_id

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
    if (!costEstimate || !toEmail) {
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

      const formattedUserData = userData
        ? {
            first_name: userData.first_name || user?.displayName?.split(" ")[0] || "",
            last_name: userData.last_name || user?.displayName?.split(" ").slice(1).join(" ") || "",
            email: userData.email || user?.email || "",
            company_id: userData.company_id,
            phone_number: userData.phone_number || "",
          }
        : undefined

      const requestBody = {
        costEstimate: costEstimate,
        clientEmail: toEmail,
        client: { name: costEstimate.client?.name, company: costEstimate.client?.company, email: costEstimate.client?.email },
        currentUserEmail: user?.email,
        ccEmail: ccEmail,
        replyToEmail: replyToEmail,
        subject: subject,
        body: body,
        attachments: allAttachments,
        preGeneratedPDFs: preGeneratedPDFs,
        uploadedFiles: uploadedFilesData,
        userData: formattedUserData, // Send formatted userData for PDF generation fallback
      }

      console.log("[v0] Sending request with body:", {
        hasCostEstimate: !!requestBody.costEstimate,
        clientEmail: requestBody.clientEmail,
        uploadedFilesCount: uploadedFilesData.length,
        preGeneratedPDFsCount: preGeneratedPDFs.length,
        totalAttachments: allAttachments.length,
      })

      const response = await fetch("/api/cost-estimates/send-email", {
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

      // Update status for all related cost estimates to "sent"
      const allCostEstimatesToUpdate = [costEstimate, ...relatedCostEstimates.filter(ce => ce.id !== costEstimate.id)]
      for (const estimate of allCostEstimatesToUpdate) {
        try {
          await updateCostEstimateStatus(estimate.id, "sent")
          console.log(`[v0] Updated status to 'sent' for cost estimate: ${estimate.id}`)
        } catch (statusError) {
          console.error(`[v0] Failed to update status for cost estimate ${estimate.id}:`, statusError)
        }
      }

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
    router.push("/sales/cost-estimates")
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
          {pdfGenerating && <div className="text-sm text-gray-600">Preparing PDF for email attachment...</div>}
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
            Preparing {relatedCostEstimates.length} PDF(s)...
          </div>
        )}
        {preGeneratedPDFs.length > 0 && !pdfGenerating && (
          <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            {preGeneratedPDFs.length} PDF(s) Ready
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
              {sending ? "Sending..." : pdfGenerating ? `Preparing ${relatedCostEstimates.length} PDF(s)...` : "Send email"}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Template Dialog */}
      <Dialog open={showAddTemplateDialog} onOpenChange={setShowAddTemplateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Email Template</DialogTitle>
            <DialogDescription>Create a new email template that can be reused for future cost estimates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Standard Cost Estimate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={newTemplateSubject}
                onChange={(e) => setNewTemplateSubject(e.target.value)}
                placeholder="e.g., Cost Estimate: {title} - {companyName}"
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
                placeholder="e.g., Standard Cost Estimate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-subject">Subject</Label>
              <Input
                id="edit-template-subject"
                value={newTemplateSubject}
                onChange={(e) => setNewTemplateSubject(e.target.value)}
                placeholder="e.g., Cost Estimate: {title} - {companyName}"
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
