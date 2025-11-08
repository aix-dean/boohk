"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Send, ArrowLeft, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import { getCostEstimate, updateCostEstimateStatus } from "@/lib/cost-estimate-service"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

const CompanyLogo: React.FC<{ className?: string }> = ({ className }) => {
  const { userData } = useAuth()
  const [companyLogo, setCompanyLogo] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCompanyLogo = async () => {
      if (!userData?.company_id) {
        setCompanyLogo("/ohplus-new-logo.png") // Default fallback
        setLoading(false)
        return
      }

      try {
        const companyDocRef = doc(db, "companies", userData.company_id)
        const companyDocSnap = await getDoc(companyDocRef)

        if (companyDocSnap.exists()) {
          const companyData = companyDocSnap.data()
          if (companyData.photo_url && companyData.photo_url.trim() !== "") {
            setCompanyLogo(companyData.photo_url)
          } else {
            setCompanyLogo("/ohplus-new-logo.png") // Default fallback
          }
        } else {
          setCompanyLogo("/ohplus-new-logo.png") // Default fallback
        }
      } catch (error) {
        console.error("Error fetching company logo:", error)
        setCompanyLogo("/ohplus-new-logo.png") // Default fallback
      } finally {
        setLoading(false)
      }
    }

    fetchCompanyLogo()
  }, [userData?.company_id])

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <img
      src={companyLogo || "/placeholder.svg"}
      alt="Company logo"
      className={`object-cover rounded-lg border border-gray-200 shadow-sm bg-white ${className}`}
      onError={(e) => {
        // Fallback to default logo if image fails to load
        const target = e.target as HTMLImageElement
        target.src = "/ohplus-new-logo.png"
      }}
    />
  )
}

export default function ComposeEmailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user, userData } = useAuth()

  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)

  // Email form state
  const [ccEmail, setCcEmail] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")

  useEffect(() => {
    const fetchCostEstimate = async () => {
      if (!params.id) return

      try {
        const ce = await getCostEstimate(params.id as string)
        if (ce) {
          setCostEstimate(ce)
        } else {
          toast({
            title: "Cost Estimate Not Found",
            description: "The cost estimate you're looking for doesn't exist.",
            variant: "destructive",
          })
          router.push("/sales/cost-estimates")
        }
      } catch (error) {
        console.error("Error fetching cost estimate:", error)
        toast({
          title: "Error",
          description: "Failed to load cost estimate. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCostEstimate()
  }, [params.id, router, toast])

  useEffect(() => {
    if (costEstimate) {
      setEmailSubject(`Cost Estimate: ${costEstimate.title || "Custom Cost Estimate"} - Boohk`)
      setEmailBody(
        `Dear ${costEstimate.client?.contactPerson || costEstimate.client?.company || "Valued Client"},\n\nWe are pleased to provide you with a detailed cost estimate for your advertising campaign. Please find the full cost estimate attached and accessible via the link below.\n\nThank you for considering Boohk for your advertising needs. We look forward to working with you to bring your campaign to life!\n\nBest regards,\nThe Boohk Team`,
      )
      // Note: CC field is intentionally left empty (no auto-fill)
    }
  }, [costEstimate])

  const handleSendEmail = async () => {
    if (!costEstimate || !user?.email) return

    if (!costEstimate.client?.email) {
      toast({
        title: "Missing Client Email",
        description: "Cannot send email: Client email address is not available.",
        variant: "destructive",
      })
      return
    }

    // Validate CC emails if provided
    const ccEmailsArray = ccEmail
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+\$/
    for (const email of ccEmailsArray) {
      if (!emailRegex.test(email)) {
        toast({
          title: "Invalid CC Email",
          description: `Please enter a valid email address for CC: ${email}`,
          variant: "destructive",
        })
        return
      }
    }

    setSendingEmail(true)
    try {
      const response = await fetch("/api/cost-estimates/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          costEstimate: costEstimate,
          clientEmail: costEstimate.client.email,
          client: costEstimate.client,
          currentUserEmail: user.email, // This will be used as reply-to
          ccEmail: ccEmail,
          subject: emailSubject,
          body: emailBody,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to send email")
      }

      toast({
        title: "Email Sent Successfully",
        description: "The cost estimate has been sent to the client.",
      })

      // Update status to sent
      await updateCostEstimateStatus(costEstimate.id, "sent")

      // Navigate back to the cost estimate page
      router.push(`/sales/cost-estimates/${params.id}`)
    } catch (error) {
      console.error("Error sending email:", error)
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSendingEmail(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!costEstimate) return

    try {
      const response = await fetch(`/api/cost-estimates/generate-pdf/${costEstimate.id}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `cost-estimate-${costEstimate.costEstimateNumber || costEstimate.id}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error("Failed to generate PDF")
      }
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast({
        title: "Error",
        description: "Failed to download PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading cost estimate...</p>
        </div>
      </div>
    )
  }

  if (!costEstimate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Send className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Cost Estimate Not Found</h1>
          <p className="text-gray-600">The cost estimate you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => router.push("/sales/cost-estimates")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cost Estimates
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Fixed header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/sales/cost-estimates/${params.id}`)}
          className="h-8 w-8 p-0 hover:bg-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-black font-medium">Compose Email</span>
        <span className="text-black italic ml-2">{costEstimate?.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={handleDownloadPDF}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white shadow-lg border-transparent relative w-[210mm] min-h-[297mm]">
            {/* Document Header */}
            <div className="border-b-2 border-orange-600 p-6 sm:p-8">
              <div className="flex justify-between items-start mb-4 md:mb-6">
                <CompanyLogo className="w-16 h-12 md:w-20 md:h-14" />
                <div className="text-right">
                  <h1 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
                    COMPOSE EMAIL
                  </h1>
                  <div className="inline-block bg-blue-500 text-white px-3 py-1 md:px-4 md:py-1 rounded-md font-semibold text-sm md:text-base">
                    Cost Estimate
                  </div>
                </div>
              </div>
            </div>

            {/* Email Composition Form */}
            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200">
                  Email Details
                </h2>

                <div className="space-y-4">
                  {/* To Field */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="to" className="text-right font-medium">
                      To
                    </Label>
                    <Input
                      id="to"
                      value={costEstimate?.client?.email || ""}
                      readOnly
                      className="col-span-3"
                    />
                  </div>

                  {/* CC Field */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="cc" className="text-right font-medium">
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

                  {/* From Field */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="from" className="text-right font-medium">
                      From
                    </Label>
                    <Input
                      id="from"
                      value="Boohk <noreply@ohplus.ph>"
                      readOnly
                      className="col-span-3"
                    />
                  </div>

                  {/* Reply-To Field */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="replyTo" className="text-right font-medium">
                      Reply-To
                    </Label>
                    <Input
                      id="replyTo"
                      value={user?.email || ""}
                      readOnly
                      className="col-span-3"
                    />
                  </div>

                  {/* Subject Field */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="subject" className="text-right font-medium">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g., Cost Estimate for Your Advertising Campaign"
                    />
                  </div>

                  {/* Body Field */}
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="body" className="text-right pt-2 font-medium">
                      Body
                    </Label>
                    <Textarea
                      id="body"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="col-span-3 min-h-[200px]"
                      placeholder="e.g., Dear [Client Name],\n\nPlease find our cost estimate attached...\n\nBest regards,\nThe Boohk Team"
                    />
                  </div>
                </div>
              </div>

              {/* Cost Estimate Preview */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200">
                  Cost Estimate Preview
                </h2>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Title:</span>
                      <p className="text-gray-900">{costEstimate.title}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total Amount:</span>
                      <p className="text-gray-900 font-semibold">
                        ₱{costEstimate.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Client:</span>
                      <p className="text-gray-900">{costEstimate.client?.company || costEstimate.client?.contactPerson}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Valid Until:</span>
                      <p className="text-gray-900">
                        {costEstimate.validUntil ? new Date(costEstimate.validUntil).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/sales/cost-estimates/${params.id}`)}
                  disabled={sendingEmail}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
