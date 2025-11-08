"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { collection, query, where, orderBy, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { FileText, PlusCircle } from "lucide-react"
import { getClientById } from "@/lib/client-service"

export default function TreasuryQuotationsPage() {
  const { user } = useAuth()
  const [quotations, setQuotations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchAllQuotations = async () => {
    if (!user?.uid) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const quotationsRef = collection(db, "quotations")
      const q = query(
        quotationsRef,
        where("created_by", "==", user.uid),
        where("projectCompliance.signedQuotation.status", "==", "completed"),
        orderBy("created", "desc"),
      )

      const querySnapshot = await getDocs(q)
      const fetchedQuotations: any[] = []

      querySnapshot.forEach((doc) => {
        fetchedQuotations.push({ id: doc.id, ...doc.data() })
      })

      setQuotations(fetchedQuotations)
    } catch (error) {
      console.error("Error fetching quotations:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.uid) {
      fetchAllQuotations()
    }
  }, [user?.uid])

  const formatDate = (date: any) => {
    if (!date) return "N/A"
    try {
      if (date && typeof date.toDate === "function") {
        return format(date.toDate(), "MMM d, yyyy")
      }
      if (typeof date === "string") {
        return format(new Date(date), "MMM d, yyyy")
      }
      return "Invalid date"
    } catch (error) {
      return "Invalid date"
    }
  }

  const handleViewPDF = (quotation: any) => {
    const fileUrl = quotation.projectCompliance?.signedQuotation?.fileUrl
    if (fileUrl) {
      window.open(fileUrl, "_blank")
    } else {
      console.error("No signed quotation file URL found")
    }
  }

  const handleCreateCollectible = async (quotation: any) => {
    let clientName = quotation.client_name || ""

    if (quotation.client_id) {
      try {
        const clientData = await getClientById(quotation.client_id)
        if (clientData && clientData.company) {
          clientName = clientData.company
        }
      } catch (error) {
        console.error("Error fetching client data:", error)
      }
    }

    const params = new URLSearchParams({
      from_quotation: "true",
      client_name: clientName,
      total_amount: quotation.total_amount?.toString() || "0",
      quotation_number: quotation.quotation_number || "",
      quotation_id: quotation.id || "",
      client_email: quotation.client_email || "",
      client_phone: quotation.client_phone || "",
      client_address: quotation.client_address || "",
    })

    router.push(`/treasury/collectibles/create?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {user?.uid ? (
          <Card className="border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="px-6 py-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">Treasury Signed Contracts</CardTitle>
              {!loading && (
                <div className="text-sm text-gray-600 mt-2">Showing {quotations.length} signed contracts</div>
              )}
            </CardHeader>

            {loading ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-200">
                    <TableHead className="font-semibold text-gray-900 py-3">Contract Date</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3">Client Name</TableHead>
                    <TableHead className="font-semibold text-gray-900 py-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array(10)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i} className="border-b border-gray-100">
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : quotations.length > 0 ? (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead className="font-semibold text-gray-900 py-3">Contract Date</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Client Name</TableHead>
                      <TableHead className="font-semibold text-gray-900 py-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map((quotation) => (
                      <TableRow key={quotation.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="py-3 text-sm text-gray-700">{formatDate(quotation.created)}</TableCell>
                        <TableCell className="py-3 text-sm text-gray-700">{quotation.client_name || "N/A"}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewPDF(quotation)}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateCollectible(quotation)}
                              className="text-green-600 border-green-300 hover:bg-green-50 hover:text-green-700"
                            >
                              <PlusCircle className="h-3 w-3 mr-1" />
                              Create Collectible
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            ) : (
              <CardContent className="p-6 text-center text-gray-600">
                <p>No signed contracts found for your account.</p>
              </CardContent>
            )}
          </Card>
        ) : (
          <Card className="border-gray-200 shadow-sm rounded-xl">
            <CardContent className="p-6 text-center text-gray-600">
              <p>Please log in to view your signed contracts.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
