"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getQuotationById, updateQuotationStatus } from "@/lib/quotation-service"
import type { Quotation } from "@/lib/quotation-service"

export default function AcceptQuotationPage() {
  const params = useParams()
  const router = useRouter()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
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

        if (quotationData.status.toLowerCase() === "accepted") {
          setAccepted(true)
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

  const handleAccept = async () => {
    if (!quotation) return

    setAccepting(true)
    try {
      await updateQuotationStatus(quotation.id!, "accepted")
      setAccepted(true)
    } catch (error) {
      console.error("Error accepting quotation:", error)
      setError("Failed to accept quotation")
    } finally {
      setAccepting(false)
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

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <CardTitle className="text-green-800">Quotation Accepted!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Thank you for accepting quotation {quotation?.quotation_number}. Our team will contact you shortly to
              proceed with the next steps.
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
            <CardTitle className="text-center">Accept Quotation</CardTitle>
            <p className="text-center text-gray-600">Quotation #{quotation?.quotation_number}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quotation Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Quotation Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Product:</span>
                  <span>{quotation?.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span>{quotation?.duration_days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Start Date:</span>
                  <span>{quotation?.start_date ? new Date(quotation.start_date).toLocaleDateString() : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">End Date:</span>
                  <span>{quotation?.end_date ? new Date(quotation.end_date).toLocaleDateString() : "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Total Amount */}
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
              <p className="text-green-800 font-semibold text-lg">
                Total Amount: ₱{quotation?.total_amount.toLocaleString()}
              </p>
            </div>

            {/* Notes */}
            {quotation?.notes && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Additional Notes</h4>
                <p className="text-blue-700 text-sm">{quotation.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button onClick={handleAccept} disabled={accepting} className="flex-1 bg-green-600 hover:bg-green-700">
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Quotation
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/quotations/${quotation?.id}/decline`)}
                className="flex-1"
              >
                Decline
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              By accepting this quotation, you agree to the terms and conditions outlined above.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
