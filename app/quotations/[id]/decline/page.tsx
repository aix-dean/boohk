"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { getQuotationById, updateQuotationStatus } from "@/lib/quotation-service"
import type { Quotation } from "@/lib/quotation-service"

export default function DeclineQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [declining, setDeclining] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuotation = async () => {
      if (!params.id) return

      try {
        const quotationId = Array.isArray(params.id) ? params.id[0] : params.id
        const quotationData = await getQuotationById(quotationId)

        if (!quotationData) {
          setError("Quotation not found")
          return
        }

        if (quotationData.status.toLowerCase() === "rejected") {
          setDeclined(true)
        }

        setQuotation(quotationData)
      } catch (error) {
        console.error("Error fetching quotation:", error)
        setError("Failed to load quotation")
      } finally {
        setLoading(false)
      }
    }

    fetchQuotation()
  }, [params.id])

  const handleDecline = async () => {
    if (!quotation) return

    setDeclining(true)
    try {
      await updateQuotationStatus(quotation.id!, "rejected")
      setDeclined(true)
    } catch (error) {
      console.error("Error declining quotation:", error)
      setError("Failed to decline quotation")
    } finally {
      setDeclining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading quotation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <CardTitle className="text-red-800">Quotation Declined</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You have declined quotation {quotation?.quotation_number}. Thank you for your consideration.
            </p>
            <Button onClick={() => router.push("/")}>Close</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Decline Quotation</CardTitle>
            <p className="text-center text-gray-600">Quotation #{quotation?.quotation_number}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quotation Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Quotation Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <span>{quotation?.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold">₱{quotation?.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Decline Reason */}
            <div>
              <Label htmlFor="reason">Reason for declining (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please let us know why you're declining this quotation..."
                rows={4}
                className="mt-2"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/quotations/${quotation?.id}/accept`)}
                className="flex-1"
              >
                Go Back to Accept
              </Button>
              <Button onClick={handleDecline} disabled={declining} variant="destructive" className="flex-1">
                {declining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Declining...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Confirm Decline
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              We appreciate your consideration and hope to work with you in the future.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
