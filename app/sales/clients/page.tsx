"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, MoreHorizontal, Users, Shield } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"
import { Toaster } from "sonner"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { ClientDialog } from "@/components/client-dialog"

interface Company {
  id: string
  name: string
  address?: string
  industry?: string
  clientType: string
  partnerType?: string
  companyLogoUrl?: string
  created: Date
  user_company_id?: string
  deleted?: boolean
}

export default function ClientsPage() {
  const { userData } = useAuth()
  const router = useRouter()

  // State for companies data
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  // State for search filters
  const [operatorSearch, setOperatorSearch] = useState("")
  const [agencySearch, setAgencySearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")

  // State for client dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Load companies on initial render
  useEffect(() => {
    if (userData?.company_id) {
      loadCompanies()
    }
  }, [userData?.company_id])

  // Function to load companies from client_company collection
  const loadCompanies = async () => {
    setLoading(true)
    try {
      const companiesRef = collection(db, "client_company")
      const q = query(
        companiesRef,
        where("user_company_id", "==", userData?.company_id || ""),
        where("deleted", "!=", true)
      )
      const snapshot = await getDocs(q)

      const companiesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "",
        address: doc.data().address || "",
        industry: doc.data().industry || "",
        clientType: doc.data().clientType || "",
        partnerType: doc.data().partnerType || "",
        companyLogoUrl: doc.data().companyLogoUrl || "",
        created: doc.data().created?.toDate() || new Date(),
        user_company_id: doc.data().user_company_id || "",
        deleted: doc.data().deleted || false,
      }))

      setCompanies(companiesData)
    } catch (error) {
      console.error("Error loading companies:", error)
      toast.error("Failed to load companies")
    } finally {
      setLoading(false)
    }
  }

  // Function to handle company deletion
  const handleDeleteCompany = async (company: Company) => {
    if (confirm(`Are you sure you want to delete ${company.name}?`)) {
      try {
        await updateDoc(doc(db, "client_company", company.id), {
          deleted: true,
          updated: new Date()
        })
        toast.success("Company deleted successfully")
        loadCompanies()
      } catch (error) {
        console.error("Error deleting company:", error)
        toast.error("Failed to delete company")
      }
    }
  }

  const handleViewClient = (company: Company) => {
    router.push(`/sales/clients/${company.id}`)
  }

  // Filter companies by type and search
  const operators = companies.filter(
    (c) =>
      c.clientType === "partner" &&
      c.partnerType === "operator" &&
      c.name.toLowerCase().includes(operatorSearch.toLowerCase()),
  )

  const agencies = companies.filter(
    (c) =>
      c.clientType === "partner" &&
      c.partnerType === "agency" &&
      c.name.toLowerCase().includes(agencySearch.toLowerCase()),
  )

  const brands = companies.filter(
    (c) => c.clientType === "brand" && c.name.toLowerCase().includes(brandSearch.toLowerCase()),
  )

  // Company card component
  const CompanyCard = ({ company }: { company: Company }) => (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewClient(company)}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              {company.companyLogoUrl ? (
                <img
                  src={company.companyLogoUrl || "/placeholder.svg"}
                  alt={company.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-300 rounded"></div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{company.name}</h3>
              <p className="text-sm text-gray-500">
                Last Activity: {formatDistanceToNow(company.created, { addSuffix: true })}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewClient(company)
                }}
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteCompany(company)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster />

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 mb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">Clients</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partners Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Users className="h-6 w-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Partners</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Operators */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Operators</h3>
                  <span className="text-sm text-gray-500">Total: {operators.length}</span>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search operators..."
                    value={operatorSearch}
                    onChange={(e) => setOperatorSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loading ? (
                    <LoadingSkeleton />
                  ) : operators.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No operators found</p>
                  ) : (
                    operators.map((company) => <CompanyCard key={company.id} company={company} />)
                  )}
                </div>
              </div>

              {/* Agencies */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Agencies</h3>
                  <span className="text-sm text-gray-500">Total: {agencies.length}</span>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search agencies..."
                    value={agencySearch}
                    onChange={(e) => setAgencySearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loading ? (
                    <LoadingSkeleton />
                  ) : agencies.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No agencies found</p>
                  ) : (
                    agencies.map((company) => <CompanyCard key={company.id} company={company} />)
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Brands Section */}
        <div>
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Shield className="h-6 w-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Brands</h2>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Total: {brands.length}</span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search brands..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading ? (
                <LoadingSkeleton />
              ) : brands.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No brands found</p>
              ) : (
                brands.map((company) => <CompanyCard key={company.id} company={company} />)
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Client Button */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg"
        >
          + Add Client
        </Button>
      </div>

      {/* Client Dialog */}
      <ClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={(client) => {
          loadCompanies()
          setIsDialogOpen(false)
        }}
      />
    </div>
  )
}
