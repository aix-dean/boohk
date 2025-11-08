"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Calculator, Loader2, Download, ArrowLeft, Share2, Plus, Minus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { CostEstimate } from "@/lib/types/cost-estimate"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"

const categoryLabels = {
  media_cost: "Media Cost",
  production_cost: "Production Cost",
  installation_cost: "Installation Cost",
  maintenance_cost: "Maintenance Cost",
  other: "Other",
}

// Generate QR code URL for cost estimate
function generateQRCodeUrl(costEstimateId: string): string {
  const url = `https://ohplus.aix.ph/cost-estimates/view/${costEstimateId}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
}

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

export default function PublicCostEstimateViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingResponse, setSubmittingResponse] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    async function fetchCostEstimate() {
      if (params.id) {
        try {
          const response = await fetch(`/api/cost-estimates/public/${params.id}`)

          if (response.ok) {
            const data = await response.json()
            setCostEstimate({
              ...data,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
              approvedAt: data.approvedAt ? new Date(data.approvedAt) : undefined,
              rejectedAt: data.rejectedAt ? new Date(data.rejectedAt) : undefined,
              validUntil: data.validUntil ? new Date(data.validUntil) : null, // Ensure validUntil is a Date or null
            })

            // Update status to viewed if it was in sent status
            if (data.status === "sent") {
              updateViewedStatus(data.id)
            }
          } else {
            toast({
              title: "Error",
              description: "Cost estimate not found or not available",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("Error fetching cost estimate:", error)
          toast({
            title: "Error",
            description: "Failed to load cost estimate",
            variant: "destructive",
          })
        } finally {
          setLoading(false)
        }
      }
    }

    fetchCostEstimate()
  }, [params.id, toast])

  const updateViewedStatus = async (costEstimateId: string) => {
    try {
      await fetch(`/api/cost-estimates/update-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          costEstimateId,
          status: "viewed",
          userId: "public_viewer",
        }),
      })
    } catch (error) {
      console.error("Error updating viewed status:", error)
    }
  }

  const handleApprove = async () => {
    if (!costEstimate) return

    setSubmittingResponse(true)
    try {
      const response = await fetch(`/api/cost-estimates/update-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          costEstimateId: costEstimate.id,
          status: "accepted",
          userId: "public_viewer",
        }),
      })

      if (response.ok) {
        setCostEstimate({ ...costEstimate, status: "accepted" })
        toast({
          title: "Cost estimate approved!",
          description: "Thank you for your approval. We will proceed with the next steps.",
        })
      } else {
        throw new Error("Failed to approve cost estimate")
      }
    } catch (error) {
      console.error("Error approving cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to approve cost estimate. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmittingResponse(false)
    }
  }

  const handleReject = async () => {
    if (!costEstimate) return

    setSubmittingResponse(true)
    try {
      const response = await fetch(`/api/cost-estimates/update-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          costEstimateId: costEstimate.id,
          status: "declined",
          userId: "public_viewer",
          rejectionReason: "Declined by client",
        }),
      })

      if (response.ok) {
        setCostEstimate({ ...costEstimate, status: "declined" })
        toast({
          title: "Cost estimate rejected",
          description: "Your feedback has been recorded. We will contact you to discuss alternatives.",
        })
      } else {
        throw new Error("Failed to reject cost estimate")
      }
    } catch (error) {
      console.error("Error rejecting cost estimate:", error)
      toast({
        title: "Error",
        description: "Failed to reject cost estimate. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmittingResponse(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!costEstimate) return

    // This is a placeholder - in a real implementation, you would generate and download the PDF
    toast({
      title: "Download started",
      description: "Your cost estimate PDF is being prepared for download.",
    })

    // Simulate PDF download delay
    setTimeout(() => {
      toast({
        title: "Download complete",
        description: "Cost estimate PDF has been downloaded.",
      })
    }, 2000)
  }

  const copyLinkToClipboard = () => {
    if (!costEstimate) return

    const url = `https://ohplus.aix.ph/cost-estimates/view/${costEstimate.id}`
    navigator.clipboard.writeText(url)

    toast({
      title: "Link copied",
      description: "Cost estimate link copied to clipboard",
    })
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
            <Calculator className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Cost Estimate Not Found</h1>
          <p className="text-gray-600">The cost estimate you're looking for doesn't exist or may have been removed.</p>
        </div>
      </div>
    )
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.1, 2)) // Max zoom 200%
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.1, 0.3)) // Min zoom 30%
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
  }

  return (
    <>
      {/* Fixed header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <span className="text-black font-medium">Public Cost Estimate View</span>
        <span className="text-black italic ml-2">{costEstimate?.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="h-7 w-7 p-0 hover:bg-gray-200"
              disabled={zoomLevel <= 0.3}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              className="h-7 px-2 text-xs font-medium hover:bg-gray-200 min-w-[50px]"
            >
              {Math.round(zoomLevel * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="h-7 w-7 p-0 hover:bg-gray-200"
              disabled={zoomLevel >= 2}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center">
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
          <div
            className="flex flex-col gap-8 transition-transform duration-200 ease-in-out"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center top" }}
          >
            <div className="bg-white shadow-lg border-transparent relative w-[210mm] min-h-[297mm]">
              {/* Document Header */}
              <div className="border-b-2 border-orange-600 p-6 sm:p-8">
                <div className="flex justify-between items-start mb-4 md:mb-6">
                  <CompanyLogo className="w-16 h-12 md:w-20 md:h-14" />
                  <div className="text-right">
                    <h1 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
                      COST ESTIMATE
                    </h1>
                    <div className="inline-block bg-green-500 text-white px-3 py-1 md:px-4 md:py-1 rounded-md font-semibold text-sm md:text-base">
                      ₱{costEstimate.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Content */}
              <div className="p-6 sm:p-8">
            {/* Client Information Header */}
            <div className="mb-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    {costEstimate.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">{costEstimate.client?.name || "Valued Client"}</p>
                    <p className="text-gray-700">{costEstimate.client?.company || ""}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">RFQ No.</p>
                  <p className="font-semibold text-gray-900">{costEstimate.id}</p>
                </div>
              </div>

              {/* Greeting Message */}
              <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                <p className="text-gray-800 leading-relaxed font-medium">
                  Good Day! Thank you for considering Golden Touch for your business needs. We are pleased to submit our
                  quotation for your requirements:
                </p>
              </div>

              {/* Details Section */}
              <div className="mb-4">
                <p className="font-semibold text-gray-900">Details as follows:</p>
              </div>

              {/* Cost Estimate Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200 font-[Calibri]">
                  Cost Estimate Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Title</h3>
                    <p className="text-base font-medium text-gray-900">{costEstimate.title}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Created Date</h3>
                    <p className="text-base text-gray-900">{costEstimate.createdAt.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Valid Until</h3>
                    <p className="text-base text-gray-900">
                      {costEstimate.validUntil ? costEstimate.validUntil.toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
                    <Badge
                      className={`${
                        costEstimate.status === "accepted"
                          ? "bg-green-100 text-green-800 border-green-200"
                          : costEstimate.status === "declined"
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                      } border font-medium px-3 py-1`}
                    >
                      {costEstimate.status === "accepted" && <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                      {costEstimate.status === "declined" && <XCircle className="h-3.5 w-3.5 mr-1" />}
                      <span className="capitalize">{costEstimate.status}</span>
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Amount</h3>
                    <p className="text-base font-semibold text-gray-900">{costEstimate.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200 font-[Calibri]">
                  Cost Breakdown
                </h2>

                <div className="border border-gray-300 rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-2 px-4 text-left font-medium text-gray-700 border-b border-gray-300">
                          Description
                        </th>
                        <th className="py-2 px-4 text-left font-medium text-gray-700 border-b border-gray-300">
                          Category
                        </th>
                        <th className="py-2 px-4 text-center font-medium text-gray-700 border-b border-gray-300">
                          Qty
                        </th>
                        <th className="py-2 px-4 text-right font-medium text-gray-700 border-b border-gray-300">
                          Unit Price
                        </th>
                        <th className="py-2 px-4 text-right font-medium text-gray-700 border-b border-gray-300">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {costEstimate.lineItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="py-3 px-4 border-b border-gray-200">
                            <div className="font-medium text-gray-900">{item.description}</div>
                          </td>
                          <td className="py-3 px-4 border-b border-gray-200">
                            <span className="inline-block px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                              {categoryLabels[item.category]}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center border-b border-gray-200">{item.quantity}</td>
                          <td className="py-3 px-4 text-right border-b border-gray-200">
                            {item.unitPrice.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right border-b border-gray-200">
                            <div className="font-medium text-gray-900">{item.total.toLocaleString()}</div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-3 px-4 text-right font-medium">
                          Subtotal:
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{costEstimate.lineItems.reduce((sum, item) => sum + item.total, 0).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-3 px-4 text-right font-medium">
                          VAT (12%):
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{(costEstimate.lineItems.reduce((sum, item) => sum + item.total, 0) * 0.12).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-orange-50">
                        <td colSpan={4} className="py-3 px-4 text-right font-bold">
                          Total Amount:
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-orange-600">
                          {costEstimate.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {costEstimate.notes && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200 font-[Calibri]">
                    Notes
                  </h2>
                  <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                    <p className="text-sm text-gray-700 leading-relaxed">{costEstimate.notes}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {costEstimate.status === "sent" || costEstimate.status === "viewed" ? (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-1 border-b border-gray-200 font-[Calibri]">
                    Your Response
                  </h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <p className="text-gray-700 mb-4">
                      Please review the cost estimate above and let us know if you approve or need any modifications.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        onClick={handleApprove}
                        disabled={submittingResponse}
                        className="bg-green-600 hover:bg-green-700 flex-1"
                      >
                        {submittingResponse ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Approve Cost Estimate
                      </Button>
                      <Button
                        onClick={handleReject}
                        disabled={submittingResponse}
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 flex-1 bg-transparent"
                      >
                        {submittingResponse ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Request Changes
                      </Button>
                    </div>
                  </div>
                </div>
              ) : costEstimate.status === "accepted" ? (
                <div className="mb-8">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-900 mb-2">Cost Estimate Approved</h3>
                    <p className="text-green-700">
                      Thank you for approving this cost estimate. We will proceed with the next steps and contact you
                      soon.
                    </p>
                    <p className="text-green-700 text-sm mt-2">
                      Approved on: {new Date().toLocaleDateString()} at{" "}
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ) : costEstimate.status === "declined" ? (
                <div className="mb-8">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-900 mb-2">Changes Requested</h3>
                    <p className="text-red-700">
                      We have received your feedback. Our team will review your requirements and contact you with a
                      revised estimate.
                    </p>
                    <p className="text-red-700 text-sm mt-2">
                      Rejected on: {new Date().toLocaleDateString()} at{" "}
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Document Footer */}
              <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
                <p>This cost estimate is subject to final approval and may be revised based on project requirements.</p>
                <p className="mt-1">© {new Date().getFullYear()} OH+ Outdoor Advertising. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Share Cost Estimate</h3>
            <div className="flex flex-col items-center mb-4">
              <img
                src={generateQRCodeUrl(costEstimate.id) || "/placeholder.svg"}
                alt="QR Code"
                className="w-48 h-48 border border-gray-300 p-2 mb-2"
              />
              <p className="text-sm text-gray-600">Scan to view this cost estimate</p>
            </div>
            <div className="flex flex-col space-y-3">
              <Button onClick={copyLinkToClipboard} className="w-full">
                <Share2 className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button variant="outline" onClick={() => setShowQRModal(false)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
