"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { bookingService, type Booking } from "@/lib/booking-service"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore"
import { format, differenceInMonths, parse } from "date-fns"
import { Arrow } from "@radix-ui/react-dropdown-menu"
import { ArrowLeft } from "lucide-react"
import { PDFViewer } from "@/components/ui/pdf-viewer"
import type { Collectible } from "@/lib/types/collectible"
import type { Invoice } from "@/lib/types/invoice"

interface CollectibleFormData {
  billingType: string
  rate: number
  startDate: string
  endDate: string
  totalMonths: string
  depositRequired: string
  depositTerms: string
  depositAmount: number
  advanceRequired: string
  advanceTerms: string
}

export default function CreateCollectiblesPage() {
  const params = useParams()
  const router = useRouter()
  const { userData } = useAuth()
  const bookingId = params.bookingId as string

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState<CollectibleFormData>({
    billingType: "Monthly",
    rate: "",
    startDate: "",
    endDate: "",
    totalMonths: "",
    depositRequired: "From comp.settings",
    depositTerms: "From comp.settings",
    depositAmount: "",
    advanceRequired: "From comp.settings",
    advanceTerms: "From comp.settings",
  })

  // Fetch booking data
  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId || !userData?.company_id) return

      try {
        // Get booking by ID - we'll need to implement this in bookingService
        const bookingsRef = collection(db, "booking")
        const bookingDoc = await bookingService.getBookingById(bookingId)
        if (bookingDoc) {
          setBooking(bookingDoc)

          // Pre-fill form with booking data
          const startDate = bookingDoc.start_date?.toDate()
          const endDate = bookingDoc.end_date?.toDate()

          // Calculate total months from date difference
          let totalMonths = ""
          if (startDate && endDate) {
            totalMonths = (differenceInMonths(endDate, startDate) + 1).toString()
          }

          setFormData(prev => ({
            ...prev,
            rate: bookingDoc.costDetails?.pricePerMonth?.toString() || "",
            startDate: startDate ? format(startDate, "yyyy-MM-dd") : "",
            endDate: endDate ? format(endDate, "yyyy-MM-dd") : "",
            totalMonths: totalMonths,
            depositAmount: bookingDoc.costDetails?.pricePerMonth?.toString() || "",
          }))
        }
      } catch (error) {
        console.error("Error fetching booking:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [bookingId, userData?.company_id])

  const handleInputChange = (field: keyof CollectibleFormData, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }

      // Clear deposit amount when deposit is not required
      if (field === 'depositRequired' && value === 'No') {
        newData.depositAmount = ''
      }

      // Update deposit amount based on deposit terms
      if (field === 'depositTerms' && newData.depositRequired === 'Yes') {
        const termsMonths = parseInt(value.split(' ')[0]) || 1
        const rateNum = parseFloat(newData.rate) || 0
        newData.depositAmount = (rateNum * termsMonths).toString()
      }

      // Update deposit amount when rate changes and deposit is required
      if (field === 'rate' && newData.depositRequired === 'Yes') {
        const termsMonths = parseInt(newData.depositTerms.split(' ')[0]) || 1
        const rateNum = parseFloat(value) || 0
        newData.depositAmount = (rateNum * termsMonths).toString()
      }

      return newData
    })
  }

  const calculatePaymentSchedule = () => {
    const rate = parseFloat(formData.rate) || 0
    const totalMonths = parseInt(formData.totalMonths) || 0
    const depositAmount = parseFloat(formData.depositAmount) || 0
    const startDate = new Date(formData.startDate)

    // For One Time billing, show only one invoice with total amount
    if (formData.billingType === "One Time") {
      const total = (formData.depositRequired === "Yes" ? depositAmount : 0) + rate * totalMonths
      return [{ date: "On Invoice", amount: total }]
    }

    const schedule = []

    // Add deposit if required
    if (formData.depositRequired === "Yes" && depositAmount > 0) {
      schedule.push({
        date: "Deposit (deductible)",
        amount: depositAmount,
      })
    }

    // Add monthly payments
    for (let i = 0; i < totalMonths; i++) {
      const paymentDate = new Date(startDate)
      paymentDate.setMonth(startDate.getMonth() + i)

      const endDate = new Date(paymentDate)
      endDate.setMonth(paymentDate.getMonth() + 1)

      schedule.push({
        date: `${format(paymentDate, "MMM dd, yyyy")}-${format(endDate, "MMM dd, yyyy")}`,
        amount: rate,
      })
    }

    return schedule
  }

  const handleSubmit = async () => {
    if (!booking || !userData?.company_id) return

    setSubmitting(true)
    try {
      const paymentSchedule = calculatePaymentSchedule()
      const collectiblesToCreate: Omit<Collectible, 'id'>[] = []

      for (const payment of paymentSchedule) {
        let dueDate: Date | null = null
        let period: string | undefined = undefined

        if (formData.billingType === "One Time") {
          period = "One Time"
          dueDate = new Date(formData.startDate)
        } else if (payment.date === "Deposit (deductible)") {
          period = "Deposit"
          dueDate = new Date(formData.startDate)
        } else if (payment.date.includes("-")) {
          // Monthly payment: "Jan 01, 2024-Jan 31, 2024"
          const [startStr] = payment.date.split("-")
          dueDate = parse(startStr, "MMM dd, yyyy", new Date())
          period = format(dueDate, "MMMM yyyy")
        }

        const collectibleData: Omit<Collectible, 'id'> = {
          booking_id: bookingId,
          company_id: userData.company_id,
          product: {
            id: booking.product_id,
            name: booking.product_name,
            owner: booking.product_owner,
          },
          client: {
            id: booking.client.id,
            name: booking.client.name,
            company_name: booking.client.company_name,
            company_id: booking.client.company_id,
          },
          booking: {
            id: bookingId,
            project_name: booking.project_name,
            reservation_id: booking.reservation_id,
            start_date: booking.start_date,
            end_date: booking.end_date,
          },
          billing_type: formData.billingType,
          rate: parseFloat(formData.rate),
          total_months: parseInt(formData.totalMonths),
          deposit_required: formData.depositRequired,
          deposit_terms: formData.depositTerms,
          deposit_amount: parseFloat(formData.depositAmount),
          advance_required: formData.advanceRequired,
          advance_terms: formData.advanceTerms,
          amount: payment.amount,
          vat_amount: payment.amount * 0.12,
          with_holding_tax: payment.amount * 0.05,
          due_date: dueDate,
          period,
          status: "pending",
          contract_pdf_url: booking.projectCompliance?.signedContract?.fileUrl || undefined,
          created: serverTimestamp(),
          updated: serverTimestamp(),
        }

        collectiblesToCreate.push(collectibleData)
      }

      // Create all collectible documents
      const collectibleRefs = await Promise.all(
        collectiblesToCreate.map(data => addDoc(collection(db, "collectibles"), data))
      )

      // Create corresponding invoice documents
      const invoicesToCreate: Omit<Invoice, 'id'>[] = collectibleRefs.map((ref, index) => {
        const collectibleData = collectiblesToCreate[index]
        return {
          collectible_id: ref.id,
          ...collectibleData,
          contract_pdf_url: booking.projectCompliance?.signedContract?.fileUrl || undefined,
        }
      })

      const invoiceRefs = await Promise.all(
        invoicesToCreate.map(data => addDoc(collection(db, "invoices"), data))
      )

      // Update collectibles with invoice_id
      await Promise.all(
        collectibleRefs.map((collectibleRef, index) =>
          updateDoc(collectibleRef, { invoice_id: invoiceRefs[index].id })
        )
      )

      // Update booking document with isCollectibles: true
      const bookingRef = doc(db, "booking", bookingId)
      await updateDoc(bookingRef, { isCollectibles: true })

      // Show success and redirect
      router.push("/treasury/requests")
    } catch (error) {
      console.error("Error creating collectibles:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push("/treasury/requests")
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center py-8">Loading...</div>
      </div>
    )
  }

  const paymentSchedule = calculatePaymentSchedule()

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <div className="flex-1">
            {/* Main Content Area with Form and PDF Preview */}
            <div className="flex-1 bg-neutral-50 p-8">
              <div className="flex gap-2 h-full">
                {/* Left Side - Form */}
                <div className="flex-[1] w-[300px]">
                  {/* Title */}
                  <div className="mb-8 flex items-center gap-2">
                    <ArrowLeft className="h-8 w-8 cursor-pointer" onClick={ () => router.back()}/>
                    <h2 className="text-gray-700 text-xxl font-bold">Create Collectibles</h2>
                  </div>

                  {/* Form */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-black text-xl font-semibold mb-4">Collectible details</h3>

                      <div className="space-y-3">
                        {/* Billing Type */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Billing Type:
                          </label>
                          <Select
                            value={formData.billingType}
                            onValueChange={(value) => handleInputChange("billingType", value)}
                          >
                            <SelectTrigger className="w-48 h-8 bg-white border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                              <SelectItem value="One Time">One Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Rate */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Rate:
                          </label>
                          <Input
                            type="number"
                            value={formData.rate}
                            onChange={(e) => handleInputChange("rate", e.target.value)}
                            className="w-48 h-8 bg-white border-gray-300"
                            placeholder="Enter rate"
                            disabled={formData.billingType === "One Time"}
                          />
                        </div>

                        {/* Start Date */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Start Date:
                          </label>
                          <Input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => handleInputChange("startDate", e.target.value)}
                            className="w-48 h-8 bg-white border-gray-300"
                            disabled={formData.billingType === "One Time"}
                          />
                        </div>

                        {/* End Date */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            End Date:
                          </label>
                          <Input
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => handleInputChange("endDate", e.target.value)}
                            className="w-48 h-8 bg-white border-gray-300"
                            disabled={formData.billingType === "One Time"}
                          />
                        </div>

                        {/* Total months */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Total months:
                          </label>
                          <Input
                            type="number"
                            value={formData.totalMonths}
                            onChange={(e) => handleInputChange("totalMonths", e.target.value)}
                            className="w-48 h-8 bg-white border-gray-300"
                            placeholder="Enter total months"
                            disabled={formData.billingType === "One Time"}
                          />
                        </div>

                        {/* Deposit required */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Deposit required?:
                          </label>
                          <Select
                            value={formData.depositRequired}
                            onValueChange={(value) => handleInputChange("depositRequired", value)}
                            disabled={formData.billingType === "One Time"}
                          >
                            <SelectTrigger className="w-48 h-8 bg-white border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Deposit terms */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Deposit terms:
                          </label>
                          <Select
                            value={formData.depositTerms}
                            onValueChange={(value) => handleInputChange("depositTerms", value)}
                            disabled={formData.depositRequired === "No" || formData.billingType === "One Time"}
                          >
                            <SelectTrigger className="w-48 h-8 bg-white border-gray-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1 month">1 month</SelectItem>
                              <SelectItem value="2 months">2 months</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Deposit amount */}
                        <div className="flex items-center gap-3">
                          <label className="text-black text-xs font-semibold min-w-[120px]">
                            Deposit amount:
                          </label>
                          <Input
                            type="number"
                            value={formData.depositAmount}
                            onChange={(e) => handleInputChange("depositAmount", e.target.value)}
                            className="w-48 h-8 bg-white border-gray-300"
                            placeholder="Auto-compute"
                            disabled={formData.depositRequired === "No" || formData.billingType === "One Time"}
                          />
                        </div>

                        {/* Advance required and terms - hidden for One Time billing */}
                        {formData.billingType !== "One Time" && (
                          <>
                            <div className="flex items-center gap-3">
                              <label className="text-black text-xs font-semibold min-w-[120px]">
                                Advance required?:
                              </label>
                              <Select
                                value={formData.advanceRequired}
                                onValueChange={(value) => handleInputChange("advanceRequired", value)}
                              >
                                <SelectTrigger className="w-48 h-8 bg-white border-gray-300">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-3">
                              <label className="text-black text-xs font-semibold min-w-[120px]">
                                Advance terms:
                              </label>
                              <Select
                                value={formData.advanceTerms}
                                onValueChange={(value) => handleInputChange("advanceTerms", value)}
                                disabled={formData.advanceRequired === "No" || formData.billingType === "One Time"}
                              >
                                <SelectTrigger className="w-48 h-8 bg-white border-gray-300">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1 month">1 month</SelectItem>
                                  <SelectItem value="2 months">2 months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="mt-12 w-[300px]">
                    <h3 className="text-black text-xl font-semibold mb-4">Preview</h3>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-black text-xl font-semibold">Date</div>
                      <div className="text-black text-xl font-semibold text-right">Amount</div>
                    </div>

                    <div className="space-y-4">
                      {paymentSchedule.map((payment, index) => (
                        <div key={index} className="bg-gray-100 rounded-2xl p-4 shadow">
                          <div className="grid grid-cols-2 gap-4 items-center">
                            <div className="text-black text-xl font-light">
                              {payment.date}
                            </div>
                            <div className="text-blue-600 text-xl font-semibold text-right underline">
                              {payment.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons - Moved to bottom after preview */}
                  <div className="flex justify-center space-x-4 mt-8 w-[300px]">
                    <Button
                      onClick={handleCancel}
                      className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-8"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                    >
                      {submitting ? "Saving..." : "Save & Submit"}
                    </Button>
                  </div>
                </div>

                {/* Right Side - PDF Preview */}
                <div className="flex-[3] w-full">
                  <div className="h-full">
                    <h3 className="text-white text-center bg-[#A1A1A1] w-80 rounded-xl mx-auto py-1 text-xl font-semibold mb-6">Contract Preview</h3>
                    {booking?.projectCompliance?.signedContract?.fileUrl ? (
                      <div className="h-auto flex flex-col">
                        <PDFViewer
                          fileUrl={booking.projectCompliance.signedContract.fileUrl}
                          className="flex-1 h-[1000px]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[700px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <div className="text-center text-gray-500">
                          <div className="mb-4">
                            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="text-lg font-medium mb-2">No Contract Available</div>
                          <div className="text-sm">The signed contract will be displayed here</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}